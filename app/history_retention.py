"""Purge historical tables according to Data Management limits (age + approximate size).

Per category, rows older than ``max_age_days`` are removed first, then oldest rows are removed
until the approximate text-column byte total is at or below ``max_bytes`` (same estimate as
Settings · Data Management). Deleting ``firewall_config_sync_runs`` cascades to related
``firewall_config_changelog`` rows for those runs.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.data_management import (
    _access_log_byte_expr,
    _changelog_byte_expr,
    _sync_run_byte_expr,
    _task_completed_byte_expr,
    load_data_management_limits,
)
from app.models import (
    AccessSessionLog,
    FirewallConfigChangelogEntry,
    FirewallConfigSyncRun,
    TaskQueueCompleted,
)

_log = logging.getLogger(__name__)

_BATCH_SIZE = 500
_MAX_SIZE_ROUNDS = 10_000


def _naive_utc_cutoff(max_age_days: int) -> datetime:
    return (datetime.now(timezone.utc) - timedelta(days=max_age_days)).replace(tzinfo=None)


def _purge_by_age(db: Session, model: Any, date_col: Any, cutoff: datetime) -> int:
    return int(
        db.query(model)
        .filter(date_col < cutoff)
        .delete(synchronize_session=False)
        or 0
    )


def _purge_oldest_until_under_bytes(
    db: Session,
    model: Any,
    id_col: Any,
    date_col: Any,
    byte_expr: Any,
    max_bytes: int,
) -> int:
    deleted = 0
    for _ in range(_MAX_SIZE_ROUNDS):
        total_b = int(
            db.query(func.coalesce(func.sum(byte_expr), 0))
            .select_from(model)
            .scalar()
            or 0
        )
        if total_b <= max_bytes:
            break
        batch = (
            db.query(id_col)
            .order_by(date_col.asc(), id_col.asc())
            .limit(_BATCH_SIZE)
            .all()
        )
        if not batch:
            break
        ids = [row[0] for row in batch]
        n = (
            db.query(model)
            .filter(id_col.in_(ids))
            .delete(synchronize_session=False)
        )
        deleted += int(n or 0)
        db.flush()
    return deleted


def _purge_firewall_config_changelog(db: Session, lim: dict[str, int]) -> int:
    c = FirewallConfigChangelogEntry
    expr = _changelog_byte_expr()
    deleted = 0
    cutoff = _naive_utc_cutoff(int(lim["max_age_days"]))
    deleted += _purge_by_age(db, c, c.created_at, cutoff)
    deleted += _purge_oldest_until_under_bytes(
        db, c, c.id, c.created_at, expr, int(lim["max_bytes"])
    )
    return deleted


def _purge_firewall_config_sync_runs(db: Session, lim: dict[str, int]) -> int:
    s = FirewallConfigSyncRun
    expr = _sync_run_byte_expr()
    deleted = 0
    cutoff = _naive_utc_cutoff(int(lim["max_age_days"]))
    deleted += _purge_by_age(db, s, s.started_at, cutoff)
    deleted += _purge_oldest_until_under_bytes(
        db, s, s.id, s.started_at, expr, int(lim["max_bytes"])
    )
    return deleted


def _purge_task_queue_completed(db: Session, lim: dict[str, int]) -> int:
    t = TaskQueueCompleted
    expr = _task_completed_byte_expr()
    deleted = 0
    cutoff = _naive_utc_cutoff(int(lim["max_age_days"]))
    deleted += _purge_by_age(db, t, t.completed_at, cutoff)
    deleted += _purge_oldest_until_under_bytes(
        db, t, t.id, t.completed_at, expr, int(lim["max_bytes"])
    )
    return deleted


def _purge_access_session_logs(db: Session, lim: dict[str, int]) -> int:
    a = AccessSessionLog
    expr = _access_log_byte_expr()
    deleted = 0
    cutoff = _naive_utc_cutoff(int(lim["max_age_days"]))
    deleted += _purge_by_age(db, a, a.created_at, cutoff)
    deleted += _purge_oldest_until_under_bytes(
        db, a, a.id, a.created_at, expr, int(lim["max_bytes"])
    )
    return deleted


def run_history_retention_sweep(db: Session) -> dict[str, int]:
    """
    Enforce max_age_days (delete rows older than cutoff) then max_bytes (delete oldest until
    approximate text size is under the limit). Commits after each category.
    """
    limits = load_data_management_limits()
    counts: dict[str, int] = {}
    counts["cache_updates"] = _purge_firewall_config_changelog(db, limits["cache_updates"])
    db.commit()
    counts["sync_logs"] = _purge_firewall_config_sync_runs(db, limits["sync_logs"])
    db.commit()
    counts["task_queue_history"] = _purge_task_queue_completed(db, limits["task_queue_history"])
    db.commit()
    counts["access_logs"] = _purge_access_session_logs(db, limits["access_logs"])
    db.commit()
    if any(counts.values()):
        _log.info("History retention sweep removed rows: %s", counts)
    return counts
