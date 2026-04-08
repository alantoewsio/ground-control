from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.firewall_config_sync import list_sync_entity_catalog
from app.models import (
    Firewall,
    FirewallConfigEntry,
    FirewallConfigSyncRun,
    TaskQueue,
)
from app.monitor_database import MonitorSessionLocal
from app.monitor_models import FirewallWebadminPing
from app.monitor_series import get_connectivity_series
from app.task_queue_service import task_queue_history_summary_counts


def parse_firewall_ids_query(raw: str | None) -> list[int]:
    if not raw or not str(raw).strip():
        return []
    out: list[int] = []
    for part in str(raw).split(","):
        s = part.strip()
        if not s:
            continue
        try:
            n = int(s, 10)
        except ValueError:
            continue
        if n > 0:
            out.append(n)
    return sorted(set(out))


def parse_chart_timezone(raw: str | None) -> tuple[ZoneInfo | None, str]:
    """
    IANA zone for dashboard chart buckets, or (None, \"UTC\") if missing/invalid.
    None means use UTC hour boundaries (legacy).
    """
    if raw is None or not str(raw).strip():
        return None, "UTC"
    s = str(raw).strip()
    if len(s) > 120:
        return None, "UTC"
    try:
        return ZoneInfo(s), s
    except Exception:
        return None, "UTC"


def _utc_midnight_today() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _connected_success_count_naive(
    mdb, firewall_ids: list[int], ds_naive: datetime, de_naive: datetime
) -> int:
    """Distinct firewalls with ≥1 successful probe in [ds, de) (naive UTC storage)."""
    n = (
        mdb.query(func.count(func.distinct(FirewallWebadminPing.firewall_id)))
        .filter(
            FirewallWebadminPing.firewall_id.in_(firewall_ids),
            FirewallWebadminPing.checked_at >= ds_naive,
            FirewallWebadminPing.checked_at < de_naive,
            FirewallWebadminPing.response_ms.isnot(None),
        )
        .scalar()
    )
    return int(n or 0)


def _offline_failures_in_hour(
    mdb, monitored_scope: list[int], hs_naive: datetime, he_naive: datetime
) -> int:
    if not monitored_scope:
        return 0
    return int(
        mdb.query(func.count(func.distinct(FirewallWebadminPing.firewall_id)))
        .filter(
            FirewallWebadminPing.firewall_id.in_(monitored_scope),
            FirewallWebadminPing.checked_at >= hs_naive,
            FirewallWebadminPing.checked_at < he_naive,
            FirewallWebadminPing.response_ms.is_(None),
        )
        .scalar()
        or 0
    )


def _prefetch_monitored_pings(
    mdb,
    monitored_scope: list[int],
    prefetch_lo_naive: datetime,
    prefetch_hi_naive: datetime,
) -> dict[int, list[FirewallWebadminPing]]:
    if not monitored_scope:
        return {}
    rows = (
        mdb.query(FirewallWebadminPing)
        .filter(
            FirewallWebadminPing.firewall_id.in_(monitored_scope),
            FirewallWebadminPing.checked_at >= prefetch_lo_naive,
            FirewallWebadminPing.checked_at < prefetch_hi_naive,
        )
        .order_by(FirewallWebadminPing.firewall_id, FirewallWebadminPing.checked_at)
        .all()
    )
    out: dict[int, list[FirewallWebadminPing]] = defaultdict(list)
    for r in rows:
        out[r.firewall_id].append(r)
    return dict(out)


def _monitored_connected_count_at_end_of_hour(
    monitored_scope: list[int],
    pings_by_fw: dict[int, list[FirewallWebadminPing]],
    idx: dict[int, int],
    last_row: dict[int, FirewallWebadminPing | None],
    he_naive: datetime,
) -> int:
    """
    Monitored firewalls whose most recent probe strictly before ``he_naive`` exists
    and succeeded (response_ms set). Matches sparse probe intervals (no hit required
    inside the hour itself).
    """
    for fid in monitored_scope:
        rows = pings_by_fw.get(fid) or []
        i = idx[fid]
        while i < len(rows) and rows[i].checked_at < he_naive:
            last_row[fid] = rows[i]
            i += 1
        idx[fid] = i
    return sum(
        1
        for fid in monitored_scope
        if last_row.get(fid) is not None and last_row[fid].response_ms is not None
    )


def connected_firewall_dashboard_series(
    firewall_ids: list[int],
    monitored_ids: set[int],
    *,
    days: int = 7,
    current_offline_count: int | None = None,
    chart_tz: ZoneInfo | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Build ``connected_by_day`` and hourly chart rows in one monitor DB session.

    With ``chart_tz`` set (browser IANA zone), days and hour buckets use that
    timezone's midnight boundaries; ``date`` on each hourly row is the local
    calendar date. With ``chart_tz`` None, UTC midnights are used (legacy).

    Green (connected) counts **monitored** firewalls only (same devices as the red
    failure series). Each hour uses **end-of-hour reachability**: last probe before
    the hour end succeeded, so sparse probe intervals do not dip to zero mid-hour.

    For the wall-clock hour containing "now" in the chosen zone, ``offline_count``
    is at least ``current_offline_count`` (dashboard card) when that count > 0.
    """
    if not firewall_ids or days < 1:
        return [], []
    scope = set(firewall_ids)
    monitored_scope = sorted(scope & monitored_ids)
    by_day: list[dict[str, Any]] = []
    hourly: list[dict[str, Any]] = []
    now_utc = datetime.now(timezone.utc)

    with MonitorSessionLocal() as mdb:
        if chart_tz is None:
            anchor = _utc_midnight_today()
            window_start = anchor - timedelta(days=days - 1)
            window_end = anchor + timedelta(days=1)
            total_hours = days * 24
            ws_naive = _naive_utc(window_start)
            prefetch_lo = ws_naive - timedelta(days=2)
            prefetch_hi = _naive_utc(now_utc)
            pings_by_fw = _prefetch_monitored_pings(mdb, monitored_scope, prefetch_lo, prefetch_hi)

            for offset in range(days - 1, -1, -1):
                day_start = anchor - timedelta(days=offset)
                day_end = day_start + timedelta(days=1)
                dkey = day_start.date().isoformat()
                ds_n = _naive_utc(day_start)
                de_n = _naive_utc(day_end)
                cnt = _connected_success_count_naive(mdb, monitored_scope, ds_n, de_n)
                by_day.append({"date": dkey, "connected_count": cnt})

            idx = {fid: 0 for fid in monitored_scope}
            last_row: dict[int, FirewallWebadminPing | None] = {fid: None for fid in monitored_scope}
            for h in range(total_hours):
                hour_start = window_start + timedelta(hours=h)
                hour_end = hour_start + timedelta(hours=1)
                if hour_end > window_end:
                    break
                if hour_start > now_utc:
                    break
                hs = _naive_utc(hour_start)
                he = _naive_utc(hour_end)
                dkey = hour_start.date().isoformat()
                connected_n = _monitored_connected_count_at_end_of_hour(
                    monitored_scope, pings_by_fw, idx, last_row, he
                )
                monitored_n = len(monitored_scope)
                disconnected_n = max(0, monitored_n - connected_n)
                offline_n = _offline_failures_in_hour(mdb, monitored_scope, hs, he)
                if (
                    current_offline_count is not None
                    and current_offline_count > 0
                    and hour_start <= now_utc < hour_end
                ):
                    offline_n = max(offline_n, current_offline_count)
                hourly.append(
                    {
                        "hour_start": hour_start.replace(microsecond=0).isoformat(),
                        "date": dkey,
                        "connected_count": connected_n,
                        "disconnected_count": disconnected_n,
                        "offline_count": offline_n,
                    }
                )
        else:
            user_tz = chart_tz
            now_local = datetime.now(user_tz)
            local_today = now_local.date()
            anchor_local = datetime(
                local_today.year,
                local_today.month,
                local_today.day,
                0,
                0,
                0,
                tzinfo=user_tz,
            )
            window_start_local = anchor_local - timedelta(days=days - 1)
            window_end_local = anchor_local + timedelta(days=1)
            ws_naive = _naive_utc(window_start_local.astimezone(timezone.utc))
            prefetch_lo = ws_naive - timedelta(days=2)
            prefetch_hi = _naive_utc(now_utc)
            pings_by_fw = _prefetch_monitored_pings(mdb, monitored_scope, prefetch_lo, prefetch_hi)

            for offset in range(days - 1, -1, -1):
                day_date = local_today - timedelta(days=offset)
                ds_local = datetime(
                    day_date.year, day_date.month, day_date.day, 0, 0, 0, tzinfo=user_tz
                )
                de_local = ds_local + timedelta(days=1)
                dkey = day_date.isoformat()
                ds_naive = _naive_utc(ds_local.astimezone(timezone.utc))
                de_naive = _naive_utc(de_local.astimezone(timezone.utc))
                cnt = _connected_success_count_naive(mdb, monitored_scope, ds_naive, de_naive)
                by_day.append({"date": dkey, "connected_count": cnt})

            idx = {fid: 0 for fid in monitored_scope}
            last_row = {fid: None for fid in monitored_scope}
            h = window_start_local
            while h < window_end_local:
                if h > now_local:
                    break
                h_end = h + timedelta(hours=1)
                hs_naive = _naive_utc(h.astimezone(timezone.utc))
                he_naive = _naive_utc(h_end.astimezone(timezone.utc))
                dkey = h.date().isoformat()
                connected_n = _monitored_connected_count_at_end_of_hour(
                    monitored_scope, pings_by_fw, idx, last_row, he_naive
                )
                monitored_n = len(monitored_scope)
                disconnected_n = max(0, monitored_n - connected_n)
                offline_n = _offline_failures_in_hour(mdb, monitored_scope, hs_naive, he_naive)
                if (
                    current_offline_count is not None
                    and current_offline_count > 0
                    and h <= now_local < h_end
                ):
                    offline_n = max(offline_n, current_offline_count)
                hour_start_utc = h.astimezone(timezone.utc).replace(microsecond=0)
                hourly.append(
                    {
                        "hour_start": hour_start_utc.isoformat(),
                        "date": dkey,
                        "connected_count": connected_n,
                        "disconnected_count": disconnected_n,
                        "offline_count": offline_n,
                    }
                )
                h = h_end

    return by_day, hourly


def connected_firewall_count_by_day(
    firewall_ids: list[int], *, days: int = 7
) -> list[dict[str, Any]]:
    """Backward-compatible wrapper; treats all ``firewall_ids`` as monitored for daily counts."""
    by_day, _ = connected_firewall_dashboard_series(
        firewall_ids, set(firewall_ids), days=days
    )
    return by_day


def latest_ping_rows_for_firewalls(firewall_ids: list[int]) -> dict[int, FirewallWebadminPing]:
    if not firewall_ids:
        return {}
    from app.db_utils import chunked_ids

    by_id: dict[int, FirewallWebadminPing] = {}
    with MonitorSessionLocal() as mdb:
        for chunk in chunked_ids(firewall_ids):
            subq = (
                mdb.query(
                    FirewallWebadminPing.firewall_id.label("fid"),
                    func.max(FirewallWebadminPing.checked_at).label("last_at"),
                )
                .filter(FirewallWebadminPing.firewall_id.in_(chunk))
                .group_by(FirewallWebadminPing.firewall_id)
                .subquery()
            )
            rows = (
                mdb.query(FirewallWebadminPing)
                .join(
                    subq,
                    (FirewallWebadminPing.firewall_id == subq.c.fid)
                    & (FirewallWebadminPing.checked_at == subq.c.last_at),
                )
                .all()
            )
            for r in rows:
                if r.firewall_id not in by_id:
                    by_id[r.firewall_id] = r
    return by_id


def count_monitored_offline(db: Session, firewall_ids: list[int]) -> int:
    """
    Firewalls in scope with monitoring enabled whose latest probe failed
    (or have no probe row yet).
    """
    if not firewall_ids:
        return 0
    fws = db.query(Firewall).filter(Firewall.id.in_(firewall_ids)).all()
    latest = latest_ping_rows_for_firewalls(firewall_ids)
    offline = 0
    for fw in fws:
        if not fw.monitor_enabled:
            continue
        ping = latest.get(fw.id)
        if ping is None or ping.response_ms is None:
            offline += 1
    return offline


def sync_entity_type_counts(db: Session, firewall_ids: list[int]) -> list[dict[str, Any]]:
    if not firewall_ids:
        return []
    catalog = list_sync_entity_catalog()
    label_by_id = {x["id"]: x["label"] for x in catalog}
    catalog_ids = [x["id"] for x in catalog]
    catalog_set = frozenset(catalog_ids)

    rows = (
        db.query(FirewallConfigEntry.entity_type, func.count(FirewallConfigEntry.id))
        .filter(FirewallConfigEntry.firewall_id.in_(firewall_ids))
        .group_by(FirewallConfigEntry.entity_type)
        .all()
    )
    counts: dict[str, int] = {str(et): int(cnt) for et, cnt in rows}

    out: list[dict[str, Any]] = [
        {
            "entity_type": cid,
            "label": label_by_id[cid],
            "count": counts.get(cid, 0),
        }
        for cid in catalog_ids
    ]

    extras = [(eid, c) for eid, c in counts.items() if eid not in catalog_set]
    extras.sort(key=lambda t: (-t[1], t[0]))
    for eid, cnt in extras:
        out.append(
            {
                "entity_type": eid,
                "label": label_by_id.get(eid, eid),
                "count": cnt,
            }
        )
    return out


def sync_sankey_flows(db: Session, firewall_ids: list[int]) -> list[dict[str, Any]]:
    """Per-firewall, per-entity_type cache counts for dashboard Sankey (flow > 0 only)."""
    if not firewall_ids:
        return []
    rows = (
        db.query(
            FirewallConfigEntry.entity_type,
            FirewallConfigEntry.firewall_id,
            func.count(FirewallConfigEntry.id),
        )
        .filter(FirewallConfigEntry.firewall_id.in_(firewall_ids))
        .group_by(FirewallConfigEntry.entity_type, FirewallConfigEntry.firewall_id)
        .all()
    )
    return [
        {"entity_type": str(et), "firewall_id": int(fid), "count": int(cnt)}
        for et, fid, cnt in rows
        if int(cnt) > 0
    ]


def pending_tasks_by_firewall(
    db: Session, firewall_ids: list[int]
) -> tuple[int, list[dict[str, Any]]]:
    if not firewall_ids:
        return 0, []
    rows = (
        db.query(TaskQueue.firewall_id, func.count(TaskQueue.id))
        .filter(
            TaskQueue.firewall_id.in_(firewall_ids),
            TaskQueue.status == "pending",
        )
        .group_by(TaskQueue.firewall_id)
        .order_by(func.count(TaskQueue.id).desc())
        .all()
    )
    total = sum(int(c) for _, c in rows)
    return total, [{"firewall_id": int(fid), "count": int(c)} for fid, c in rows]


def sync_runs_daily_counts(
    db: Session, firewall_ids: list[int], *, days: int = 7
) -> list[dict[str, Any]]:
    """UTC calendar-day buckets of sync attempts in the rolling window ending today."""
    if not firewall_ids or days < 1:
        return []
    anchor = _utc_midnight_today()
    window_start = anchor - timedelta(days=days - 1)
    window_end = anchor + timedelta(days=1)
    ws = _naive_utc(window_start)
    we = _naive_utc(window_end)
    rows = (
        db.query(FirewallConfigSyncRun.started_at, FirewallConfigSyncRun.status)
        .filter(
            FirewallConfigSyncRun.firewall_id.in_(firewall_ids),
            FirewallConfigSyncRun.started_at >= ws,
            FirewallConfigSyncRun.started_at < we,
        )
        .all()
    )
    by_day: dict[str, dict[str, int]] = defaultdict(
        lambda: {"success": 0, "error": 0, "running": 0, "other": 0}
    )
    for started_at, status in rows:
        if started_at is None:
            continue
        dkey = _naive_utc(started_at).date().isoformat()
        st = (status or "").strip().lower()
        if st == "success":
            by_day[dkey]["success"] += 1
        elif st == "error":
            by_day[dkey]["error"] += 1
        elif st == "running":
            by_day[dkey]["running"] += 1
        else:
            by_day[dkey]["other"] += 1
    out: list[dict[str, Any]] = []
    for offset in range(days - 1, -1, -1):
        day_date = (anchor - timedelta(days=offset)).date()
        dkey = day_date.isoformat()
        z = by_day.get(dkey)
        if z is None:
            bucket = {"success": 0, "error": 0, "running": 0, "other": 0}
        else:
            bucket = {k: int(z[k]) for k in ("success", "error", "running", "other")}
        out.append({"date": dkey, **bucket})
    return out


def cache_freshness_stacked_by_entity_type(
    db: Session, firewall_ids: list[int], *, max_types: int = 24
) -> list[dict[str, Any]]:
    """
    Per ``entity_type``, count cached rows by age of ``updated_at`` (freshness buckets).

    Buckets: ``fresh`` <1h, ``recent`` 1–24h, ``aging`` 24h–7d, ``stale`` ≥7d.
    Rows are ordered by total count descending (most cached types first).
    """
    if not firewall_ids:
        return []
    rows = (
        db.query(FirewallConfigEntry.entity_type, FirewallConfigEntry.updated_at)
        .filter(FirewallConfigEntry.firewall_id.in_(firewall_ids))
        .all()
    )
    catalog = list_sync_entity_catalog()
    label_by_id = {x["id"]: x["label"] for x in catalog}
    now = datetime.now(timezone.utc)
    acc: dict[str, dict[str, int]] = defaultdict(
        lambda: {"fresh": 0, "recent": 0, "aging": 0, "stale": 0}
    )
    for et, upd in rows:
        if upd is None:
            continue
        if upd.tzinfo is None:
            upd_utc = upd.replace(tzinfo=timezone.utc)
        else:
            upd_utc = upd.astimezone(timezone.utc)
        age_h = (now - upd_utc).total_seconds() / 3600.0
        key = str(et)
        if age_h < 1.0:
            b = "fresh"
        elif age_h < 24.0:
            b = "recent"
        elif age_h < 168.0:
            b = "aging"
        else:
            b = "stale"
        acc[key][b] += 1

    def total_for(et: str) -> int:
        z = acc[et]
        return int(z["fresh"] + z["recent"] + z["aging"] + z["stale"])

    ordered = sorted(acc.keys(), key=lambda e: (-total_for(e), e.casefold()))
    out: list[dict[str, Any]] = []
    for et in ordered[: max(0, max_types)]:
        z = acc[et]
        out.append(
            {
                "entity_type": et,
                "label": label_by_id.get(et, et),
                "fresh": int(z["fresh"]),
                "recent": int(z["recent"]),
                "aging": int(z["aging"]),
                "stale": int(z["stale"]),
            }
        )
    return out


def firewall_summaries(db: Session, firewall_ids: list[int]) -> list[dict[str, Any]]:
    if not firewall_ids:
        return []
    rows = (
        db.query(Firewall)
        .filter(Firewall.id.in_(firewall_ids))
        .order_by(Firewall.name.asc().nulls_last(), Firewall.host.asc())
        .all()
    )
    return [
        {
            "id": f.id,
            "name": f.name,
            "host": f.host,
            "port": f.port,
            "monitor_enabled": f.monitor_enabled,
        }
        for f in rows
    ]


def latency_series_for_firewalls(
    firewall_ids: list[int], *, range_key: str = "24h"
) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    rk = (range_key or "24h").strip().lower()
    for fid in firewall_ids:
        gran, points = get_connectivity_series(fid, rk)
        out[str(fid)] = {
            "firewall_id": fid,
            "granularity": gran,
            "range": rk,
            "points": points,
        }
    return out


def build_dashboard_payload(
    db: Session, firewall_ids: list[int], *, chart_timezone: str | None = None
) -> dict[str, Any]:
    chart_tz, chart_tz_label = parse_chart_timezone(chart_timezone)
    if not firewall_ids:
        return {
            "firewall_ids": [],
            "managed_count": 0,
            "offline_count": 0,
            "pending_tasks_total": 0,
            "pending_tasks_by_firewall": [],
            "connected_by_day": [],
            "connected_chart_hourly": [],
            "chart_timezone": chart_tz_label,
            "sync_entity_counts": [],
            "sync_sankey_flows": [],
            "sync_runs_daily": [],
            "task_queue_history_summary": {
                "approved_7d": 0,
                "denied_7d": 0,
                "approved_today": 0,
                "denied_today": 0,
            },
            "cache_freshness_by_entity_type": [],
            "firewalls": [],
            "latency_by_firewall": {},
        }

    existing = (
        db.query(Firewall.id).filter(Firewall.id.in_(firewall_ids)).order_by(Firewall.id).all()
    )
    ids = [r[0] for r in existing]
    monitored_rows = (
        db.query(Firewall.id)
        .filter(Firewall.id.in_(ids), Firewall.monitor_enabled.is_(True))
        .all()
    )
    monitored_ids = {r[0] for r in monitored_rows}
    offline_now = count_monitored_offline(db, ids)
    by_day, hourly = connected_firewall_dashboard_series(
        ids,
        monitored_ids,
        days=7,
        current_offline_count=offline_now,
        chart_tz=chart_tz,
    )
    pending_total, pending_by_fw = pending_tasks_by_firewall(db, ids)

    return {
        "firewall_ids": ids,
        "managed_count": len(ids),
        "offline_count": offline_now,
        "pending_tasks_total": pending_total,
        "pending_tasks_by_firewall": pending_by_fw,
        "connected_by_day": by_day,
        "connected_chart_hourly": hourly,
        "chart_timezone": chart_tz_label,
        "sync_entity_counts": sync_entity_type_counts(db, ids),
        "sync_sankey_flows": sync_sankey_flows(db, ids),
        "sync_runs_daily": sync_runs_daily_counts(db, ids, days=7),
        "task_queue_history_summary": task_queue_history_summary_counts(db, ids, days=7),
        "cache_freshness_by_entity_type": cache_freshness_stacked_by_entity_type(db, ids),
        "firewalls": firewall_summaries(db, ids),
        "latency_by_firewall": latency_series_for_firewalls(ids, range_key="24h"),
    }
