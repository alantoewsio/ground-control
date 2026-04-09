"""Data retention limits and history storage statistics for Settings · Data Management."""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import case, exists, func
from sqlalchemy.orm import Session

from app import config
from app.models import (
    AccessSessionLog,
    Firewall,
    FirewallConfigChangelogEntry,
    FirewallConfigEntry,
    FirewallConfigSyncRun,
    TaskQueueCompleted,
)

STATE_FILENAME = ".gc_data_management.json"
ONE_GIB = 1024**3
DEFAULT_MAX_BYTES = ONE_GIB
DEFAULT_MAX_AGE_DAYS = 365

CATEGORY_META: tuple[tuple[str, str], ...] = (
    ("cache_updates", "Cache updates"),
    ("task_queue_history", "Task queue history"),
    ("sync_logs", "Sync logs"),
    ("access_logs", "Access logs"),
)

_CATEGORY_IDS = frozenset(k for k, _ in CATEGORY_META)

_policy_lock = threading.Lock()
_policy_cache: dict[str, dict[str, int]] | None = None


def clear_data_management_policy_cache() -> None:
    """Drop in-memory policy cache (e.g. after tests repoint ``BASE_DIR``)."""
    global _policy_cache
    with _policy_lock:
        _policy_cache = None


def _state_path() -> Path:
    return config.BASE_DIR / STATE_FILENAME


def default_limits() -> dict[str, dict[str, int]]:
    return {
        cid: {"max_bytes": DEFAULT_MAX_BYTES, "max_age_days": DEFAULT_MAX_AGE_DAYS}
        for cid, _ in CATEGORY_META
    }


def _merge_limits(raw: dict[str, Any] | None) -> dict[str, dict[str, int]]:
    base = default_limits()
    if not isinstance(raw, dict):
        return base
    limits = raw.get("limits")
    if not isinstance(limits, dict):
        return base
    for cid, _ in CATEGORY_META:
        entry = limits.get(cid)
        if not isinstance(entry, dict):
            continue
        mb = entry.get("max_bytes")
        ma = entry.get("max_age_days")
        if isinstance(mb, int) and mb >= 1_048_576:
            base[cid]["max_bytes"] = mb
        if isinstance(ma, int) and ma >= 1:
            base[cid]["max_age_days"] = ma
    return base


def load_data_management_limits() -> dict[str, dict[str, int]]:
    global _policy_cache
    with _policy_lock:
        if _policy_cache is not None:
            return {k: dict(v) for k, v in _policy_cache.items()}
        path = _state_path()
        raw: dict[str, Any] | None = None
        if path.is_file():
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                raw = None
        merged = _merge_limits(raw)
        _policy_cache = {k: dict(v) for k, v in merged.items()}
        return merged


def save_data_management_limits(limits: dict[str, dict[str, int]]) -> dict[str, dict[str, int]]:
    global _policy_cache
    merged = _merge_limits({"limits": limits})
    path = _state_path()
    payload = {"limits": merged}
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    with _policy_lock:
        _policy_cache = {k: dict(v) for k, v in merged.items()}
    return merged


def validate_limits_patch(limits: dict[str, Any]) -> tuple[dict[str, dict[str, int]], list[str]]:
    errs: list[str] = []
    out: dict[str, dict[str, int]] = {}
    current = load_data_management_limits()
    for cid, _ in CATEGORY_META:
        entry = limits.get(cid)
        if entry is None:
            out[cid] = dict(current[cid])
            continue
        if not isinstance(entry, dict):
            errs.append(f"{cid}: expected an object")
            out[cid] = dict(current[cid])
            continue
        mb = entry.get("max_bytes", current[cid]["max_bytes"])
        ma = entry.get("max_age_days", current[cid]["max_age_days"])
        if not isinstance(mb, int) or mb < 1_048_576:
            errs.append(f"{cid}: max_bytes must be an integer >= 1048576 (1 MiB)")
            mb = current[cid]["max_bytes"]
        if not isinstance(ma, int) or ma < 1:
            errs.append(f"{cid}: max_age_days must be an integer >= 1")
            ma = current[cid]["max_age_days"]
        out[cid] = {"max_bytes": mb, "max_age_days": ma}
    for k in limits:
        if k not in _CATEGORY_IDS:
            errs.append(f"Unknown category: {k}")
    return out, errs


def _utc_age_days(oldest: datetime | None) -> int | None:
    if oldest is None:
        return None
    if oldest.tzinfo is None:
        oldest = oldest.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - oldest
    sec = max(0, int(delta.total_seconds()))
    return max(0, sec // 86400)


def _fmt_bytes(n: int) -> str:
    if n < 0:
        n = 0
    if n < 1024:
        return f"{n} B"
    kb = n / 1024.0
    if kb < 1024.0:
        return f"{kb:.1f} KB" if kb < 100 else f"{kb:.0f} KB"
    mb = kb / 1024.0
    if mb < 1024.0:
        return f"{mb:.2f} MB" if mb < 10 else f"{mb:.1f} MB"
    gb = mb / 1024.0
    if gb < 1024.0:
        return f"{gb:.2f} GB" if gb < 10 else f"{gb:.1f} GB"
    tb = gb / 1024.0
    return f"{tb:.2f} TB" if tb < 10 else f"{tb:.1f} TB"


def _changelog_byte_expr():
    c = FirewallConfigChangelogEntry
    return (
        func.coalesce(func.length(c.old_payload_json), 0)
        + func.coalesce(func.length(c.new_payload_json), 0)
        + func.coalesce(func.length(c.external_name), 0)
        + func.coalesce(func.length(c.entity_type), 0)
        + func.coalesce(func.length(c.action), 0)
    )


def _task_completed_byte_expr():
    t = TaskQueueCompleted
    return (
        func.coalesce(func.length(t.payload_json), 0)
        + func.coalesce(func.length(t.external_name), 0)
        + func.coalesce(func.length(t.entity_type), 0)
        + func.coalesce(func.length(t.outcome), 0)
        + func.coalesce(func.length(t.created_by_user_id), 0)
        + func.coalesce(func.length(t.created_by_username), 0)
        + func.coalesce(func.length(t.completed_by_user_id), 0)
        + func.coalesce(func.length(t.completed_by_username), 0)
    )


def _sync_run_byte_expr():
    s = FirewallConfigSyncRun
    return (
        func.coalesce(func.length(s.id), 0)
        + func.coalesce(func.length(s.status), 0)
        + func.coalesce(func.length(s.error_message), 0)
    )


def _access_log_byte_expr():
    a = AccessSessionLog
    return (
        func.coalesce(func.length(a.session_id), 0)
        + func.coalesce(func.length(a.access_type), 0)
        + func.coalesce(func.length(a.event_kind), 0)
        + func.coalesce(func.length(a.initiated_by_user_id), 0)
        + func.coalesce(func.length(a.initiated_by_username), 0)
        + func.coalesce(func.length(a.client_ip), 0)
        + func.coalesce(func.length(a.details), 0)
    )


def _firewall_config_entry_byte_expr():
    e = FirewallConfigEntry
    return (
        func.coalesce(func.length(e.payload_json), 0)
        + func.coalesce(func.length(e.external_name), 0)
        + func.coalesce(func.length(e.entity_type), 0)
    )


def firewall_config_cache_by_entity(db: Session) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Per ``entity_type`` counts and byte estimates for firewall config cache: managed vs orphaned."""
    e = FirewallConfigEntry
    f = Firewall
    byte_expr = _firewall_config_entry_byte_expr()
    q = (
        db.query(
            e.entity_type,
            func.sum(case((f.id.isnot(None), 1), else_=0)),
            func.sum(case((f.id.is_(None), 1), else_=0)),
            func.coalesce(func.sum(case((f.id.isnot(None), byte_expr), else_=0)), 0),
            func.coalesce(func.sum(case((f.id.is_(None), byte_expr), else_=0)), 0),
        )
        .select_from(e)
        .outerjoin(f, f.id == e.firewall_id)
        .group_by(e.entity_type)
        .order_by(func.lower(e.entity_type))
    )
    rows_out: list[dict[str, Any]] = []
    tot_m_cnt = tot_o_cnt = tot_m_b = tot_o_b = 0
    for et, m_cnt, o_cnt, m_b, o_b in q.all():
        mc = int(m_cnt or 0)
        oc = int(o_cnt or 0)
        mb = int(m_b or 0)
        ob = int(o_b or 0)
        tot_m_cnt += mc
        tot_o_cnt += oc
        tot_m_b += mb
        tot_o_b += ob
        rows_out.append(
            {
                "entity_type": str(et),
                "managed_record_count": mc,
                "managed_approx_bytes": mb,
                "managed_approx_storage": _fmt_bytes(mb),
                "orphaned_record_count": oc,
                "orphaned_approx_bytes": ob,
                "orphaned_approx_storage": _fmt_bytes(ob),
            }
        )
    totals = {
        "managed_record_count": tot_m_cnt,
        "managed_approx_bytes": tot_m_b,
        "managed_approx_storage": _fmt_bytes(tot_m_b),
        "orphaned_record_count": tot_o_cnt,
        "orphaned_approx_bytes": tot_o_b,
        "orphaned_approx_storage": _fmt_bytes(tot_o_b),
    }
    return rows_out, totals


def delete_orphaned_firewall_config_entries(db: Session) -> int:
    """Remove ``firewall_config_entries`` rows whose ``firewall_id`` has no matching firewall."""
    ex = exists().where(Firewall.id == FirewallConfigEntry.firewall_id)
    deleted = db.query(FirewallConfigEntry).filter(~ex).delete(synchronize_session=False)
    db.commit()
    return int(deleted or 0)


def data_management_get_payload(db: Session) -> dict[str, Any]:
    fc_rows, fc_totals = firewall_config_cache_by_entity(db)
    return {
        "categories": history_storage_summary(db),
        "firewall_cache_by_entity": fc_rows,
        "firewall_cache_totals": fc_totals,
    }


def history_storage_summary(db: Session) -> list[dict[str, Any]]:
    limits = load_data_management_limits()

    c = FirewallConfigChangelogEntry
    q1 = db.query(
        func.count(c.id),
        func.min(c.created_at),
        func.coalesce(func.sum(_changelog_byte_expr()), 0),
    ).one()
    cnt1, oldest1, bytes1 = int(q1[0] or 0), q1[1], int(q1[2] or 0)

    t = TaskQueueCompleted
    q2 = db.query(
        func.count(t.id),
        func.min(t.completed_at),
        func.coalesce(func.sum(_task_completed_byte_expr()), 0),
    ).one()
    cnt2, oldest2, bytes2 = int(q2[0] or 0), q2[1], int(q2[2] or 0)

    s = FirewallConfigSyncRun
    q3 = db.query(
        func.count(s.id),
        func.min(s.started_at),
        func.coalesce(func.sum(_sync_run_byte_expr()), 0),
    ).one()
    cnt3, oldest3, bytes3 = int(q3[0] or 0), q3[1], int(q3[2] or 0)

    a = AccessSessionLog
    q4 = db.query(
        func.count(a.id),
        func.min(a.created_at),
        func.coalesce(func.sum(_access_log_byte_expr()), 0),
    ).one()
    cnt4, oldest4, bytes4 = int(q4[0] or 0), q4[1], int(q4[2] or 0)

    stats = [
        ("cache_updates", cnt1, bytes1, oldest1),
        ("task_queue_history", cnt2, bytes2, oldest2),
        ("sync_logs", cnt3, bytes3, oldest3),
        ("access_logs", cnt4, bytes4, oldest4),
    ]

    rows: list[dict[str, Any]] = []
    for cid, label in CATEGORY_META:
        cnt, bts, oldest = next(s[1:] for s in stats if s[0] == cid)
        lim = limits[cid]
        rows.append(
            {
                "id": cid,
                "label": label,
                "record_count": cnt,
                "approx_bytes": bts,
                "approx_storage": _fmt_bytes(bts),
                "oldest_record_age_days": _utc_age_days(oldest),
                "max_bytes": lim["max_bytes"],
                "max_age_days": lim["max_age_days"],
            }
        )
    return rows
