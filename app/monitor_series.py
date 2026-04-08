from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, TypeVar

from sqlalchemy import asc

from app.monitor_database import MonitorSessionLocal
from app.monitor_models import FirewallConnectivityRollup, FirewallWebadminPing

MAX_CHART_POINTS_RAW = 900

_T = TypeVar("_T")


@dataclass
class SeriesPoint:
    t: str  # ISO 8601 UTC
    up_pct: float
    avg_ms: float | None
    samples: int

    def as_json(self) -> dict[str, Any]:
        return asdict(self)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso_utc(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def _downsample(items: list[_T], max_points: int) -> list[_T]:
    if len(items) <= max_points or max_points < 1:
        return items
    step = max(1, math.ceil(len(items) / max_points))
    return [items[i] for i in range(0, len(items), step)]


def _raw_points_for_firewall(
    firewall_id: int, since: datetime, until: datetime
) -> list[SeriesPoint]:
    with MonitorSessionLocal() as mdb:
        rows = (
            mdb.query(FirewallWebadminPing)
            .filter(
                FirewallWebadminPing.firewall_id == firewall_id,
                FirewallWebadminPing.checked_at >= since,
                FirewallWebadminPing.checked_at <= until,
            )
            .order_by(asc(FirewallWebadminPing.checked_at))
            .all()
        )
    out: list[SeriesPoint] = []
    for r in rows:
        ok = r.response_ms is not None
        out.append(
            SeriesPoint(
                t=_iso_utc(r.checked_at),
                up_pct=100.0 if ok else 0.0,
                avg_ms=float(r.response_ms) if r.response_ms is not None else None,
                samples=1,
            )
        )
    return _downsample(out, MAX_CHART_POINTS_RAW)


def _hourly_rollups(
    firewall_id: int, since: datetime, until: datetime
) -> list[SeriesPoint]:
    with MonitorSessionLocal() as mdb:
        rows = (
            mdb.query(FirewallConnectivityRollup)
            .filter(
                FirewallConnectivityRollup.firewall_id == firewall_id,
                FirewallConnectivityRollup.resolution == "hour",
                FirewallConnectivityRollup.period_start >= since,
                FirewallConnectivityRollup.period_start <= until,
            )
            .order_by(asc(FirewallConnectivityRollup.period_start))
            .all()
        )
    out: list[SeriesPoint] = []
    for r in rows:
        if r.sample_count <= 0:
            continue
        up_pct = 100.0 * r.ok_count / r.sample_count
        out.append(
            SeriesPoint(
                t=_iso_utc(r.period_start),
                up_pct=round(up_pct, 2),
                avg_ms=r.avg_response_ms,
                samples=r.sample_count,
            )
        )
    return out


def _daily_rollups(
    firewall_id: int, since: datetime, until: datetime
) -> list[SeriesPoint]:
    with MonitorSessionLocal() as mdb:
        rows = (
            mdb.query(FirewallConnectivityRollup)
            .filter(
                FirewallConnectivityRollup.firewall_id == firewall_id,
                FirewallConnectivityRollup.resolution == "day",
                FirewallConnectivityRollup.period_start >= since,
                FirewallConnectivityRollup.period_start <= until,
            )
            .order_by(asc(FirewallConnectivityRollup.period_start))
            .all()
        )
    out: list[SeriesPoint] = []
    for r in rows:
        if r.sample_count <= 0:
            continue
        up_pct = 100.0 * r.ok_count / r.sample_count
        out.append(
            SeriesPoint(
                t=_iso_utc(r.period_start),
                up_pct=round(up_pct, 2),
                avg_ms=r.avg_response_ms,
                samples=r.sample_count,
            )
        )
    return out


def get_connectivity_series(
    firewall_id: int, range_key: str
) -> tuple[str, list[dict[str, Any]]]:
    """
    Returns (granularity_label, points) for charting.
    range_key: 24h, 48h, 7d, 30d, 365d
    """
    now = _utc_now()
    until = now
    rk = (range_key or "24h").strip().lower()
    if rk == "48h":
        since = now - timedelta(hours=48)
        pts = _raw_points_for_firewall(firewall_id, since, until)
        return "raw", [p.as_json() for p in pts]
    if rk == "24h":
        since = now - timedelta(hours=24)
        pts = _raw_points_for_firewall(firewall_id, since, until)
        return "raw", [p.as_json() for p in pts]
    if rk == "7d":
        since = now - timedelta(days=7)
        pts = _hourly_rollups(firewall_id, since, until)
        return "hour", [p.as_json() for p in pts]
    if rk == "30d":
        since = now - timedelta(days=30)
        pts = _hourly_rollups(firewall_id, since, until)
        return "hour", [p.as_json() for p in pts]
    if rk == "365d":
        since = now - timedelta(days=365)
        pts = _daily_rollups(firewall_id, since, until)
        return "day", [p.as_json() for p in pts]
    since = now - timedelta(hours=24)
    pts = _raw_points_for_firewall(firewall_id, since, until)
    return "raw", [p.as_json() for p in pts]
