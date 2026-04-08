from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import case, func, select

from app.monitor_database import MonitorSessionLocal
from app.monitor_models import FirewallConnectivityRollup, FirewallWebadminPing

_log = logging.getLogger(__name__)

Resolution = Literal["hour", "day"]


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def utc_hour_start(dt: datetime) -> datetime:
    d = _naive_utc(dt)
    return d.replace(minute=0, second=0, microsecond=0)


def utc_day_start(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, 0, 0, 0, 0)


def rollup_hour(mdb, hour_start: datetime) -> int:
    """
    Aggregate raw pings in [hour_start, hour_start + 1h) into hourly rollups.
    Returns number of firewall rollup rows written.
    """
    hour_start = utc_hour_start(hour_start)
    hour_end = hour_start + timedelta(hours=1)
    ok_expr = case((FirewallWebadminPing.response_ms.isnot(None), 1), else_=0)

    stmt = (
        select(
            FirewallWebadminPing.firewall_id,
            func.count().label("n"),
            func.sum(ok_expr).label("ok"),
            func.avg(FirewallWebadminPing.response_ms).label("avg_ms"),
            func.max(FirewallWebadminPing.response_ms).label("max_ms"),
            func.min(FirewallWebadminPing.response_ms).label("min_ms"),
        )
        .where(
            FirewallWebadminPing.checked_at >= hour_start,
            FirewallWebadminPing.checked_at < hour_end,
        )
        .group_by(FirewallWebadminPing.firewall_id)
    )
    rows = mdb.execute(stmt).all()
    n_out = 0
    for r in rows:
        fid = int(r.firewall_id)
        n = int(r.n or 0)
        ok = int(r.ok or 0)
        fail = max(0, n - ok)
        avg_ms = float(r.avg_ms) if r.avg_ms is not None else None
        max_ms = float(r.max_ms) if r.max_ms is not None else None
        min_ms = float(r.min_ms) if r.min_ms is not None else None

        mdb.query(FirewallConnectivityRollup).filter(
            FirewallConnectivityRollup.firewall_id == fid,
            FirewallConnectivityRollup.period_start == hour_start,
            FirewallConnectivityRollup.resolution == "hour",
        ).delete(synchronize_session=False)
        mdb.add(
            FirewallConnectivityRollup(
                firewall_id=fid,
                period_start=hour_start,
                resolution="hour",
                sample_count=n,
                ok_count=ok,
                fail_count=fail,
                avg_response_ms=avg_ms,
                max_response_ms=max_ms,
                min_response_ms=min_ms,
            )
        )
        n_out += 1
    return n_out


def rollup_day(mdb, day_start: datetime) -> int:
    """Build daily rollups from hourly rows for UTC calendar day of day_start."""
    d = utc_hour_start(day_start).date()
    start = utc_day_start(d)
    end = start + timedelta(days=1)
    hours = (
        mdb.query(FirewallConnectivityRollup)
        .filter(
            FirewallConnectivityRollup.resolution == "hour",
            FirewallConnectivityRollup.period_start >= start,
            FirewallConnectivityRollup.period_start < end,
        )
        .all()
    )
    by_fw: dict[int, list[FirewallConnectivityRollup]] = defaultdict(list)
    for h in hours:
        by_fw[h.firewall_id].append(h)

    n_out = 0
    for fid, group in by_fw.items():
        sample_count = sum(h.sample_count for h in group)
        ok_count = sum(h.ok_count for h in group)
        fail_count = sum(h.fail_count for h in group)
        avgs = [
            (h.avg_response_ms, h.ok_count)
            for h in group
            if h.avg_response_ms is not None and h.ok_count > 0
        ]
        avg_ms = None
        if avgs:
            num = sum(a * c for a, c in avgs)
            den = sum(c for _, c in avgs)
            if den > 0:
                avg_ms = num / den
        max_ms = None
        mins: list[float] = []
        maxes: list[float] = []
        for h in group:
            if h.max_response_ms is not None:
                maxes.append(h.max_response_ms)
            if h.min_response_ms is not None:
                mins.append(h.min_response_ms)
        max_ms = max(maxes) if maxes else None
        min_ms = min(mins) if mins else None

        mdb.query(FirewallConnectivityRollup).filter(
            FirewallConnectivityRollup.firewall_id == fid,
            FirewallConnectivityRollup.period_start == start,
            FirewallConnectivityRollup.resolution == "day",
        ).delete(synchronize_session=False)
        mdb.add(
            FirewallConnectivityRollup(
                firewall_id=fid,
                period_start=start,
                resolution="day",
                sample_count=sample_count,
                ok_count=ok_count,
                fail_count=fail_count,
                avg_response_ms=avg_ms,
                max_response_ms=max_ms,
                min_response_ms=min_ms,
            )
        )
        n_out += 1
    return n_out


def run_rollup_for_previous_complete_utc_hour() -> int:
    """Roll up the last fully completed UTC hour (safe to call repeatedly)."""
    now = _utc_now()
    hour = utc_hour_start(now)
    prev = hour - timedelta(hours=1)
    with MonitorSessionLocal() as mdb:
        n = rollup_hour(mdb, prev)
        mdb.commit()
    if n:
        _log.debug("Hourly monitor rollup for %s: %s firewall(s)", prev.isoformat(), n)
    return n


def run_rollup_for_previous_utc_day() -> int:
    """Roll up yesterday (UTC) from hourly rows."""
    today_start = utc_hour_start(_utc_now()).date()
    y = today_start - timedelta(days=1)
    day_start = utc_day_start(y)
    with MonitorSessionLocal() as mdb:
        n = rollup_day(mdb, day_start)
        mdb.commit()
    if n:
        _log.debug("Daily monitor rollup for %s: %s firewall(s)", y.isoformat(), n)
    return n


def backfill_hourly_rollups(max_hours: int = 72) -> int:
    """
    Recompute hourly rollups for the last `max_hours` complete UTC hours.
    Useful after upgrades or missed cron. Returns total rollup rows written.
    """
    now = _utc_now()
    current_hour = utc_hour_start(now)
    total = 0
    with MonitorSessionLocal() as mdb:
        for i in range(1, max_hours + 1):
            h = current_hour - timedelta(hours=i)
            total += rollup_hour(mdb, h)
        mdb.commit()
    if total:
        _log.info("Monitor hourly rollup backfill: %s firewall-hour row(s)", total)
    return total
