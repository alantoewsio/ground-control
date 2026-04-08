"""Shared helpers for inferring firewall reachability from monitor materialization."""

from __future__ import annotations

from datetime import datetime, timezone

from app.models import Firewall


def last_online_at_as_utc_aware(last: object) -> datetime:
    """Coerce DB ``last_online_at`` to UTC-aware for safe subtraction (SQLite is often naive)."""
    if not isinstance(last, datetime):
        raise TypeError("expected datetime")
    if last.tzinfo is None:
        return last.replace(tzinfo=timezone.utc)
    return last.astimezone(timezone.utc)


def firewall_is_online(fw: Firewall) -> bool:
    """True when ``last_online_at`` is recent vs ``monitor_interval_minutes`` (same rule as inventory UI)."""
    if not fw.last_online_at:
        return False
    try:
        last = last_online_at_as_utc_aware(fw.last_online_at)
        now = datetime.now(timezone.utc)
        interval = max(10, (fw.monitor_interval_minutes or 5) * 2)
        return (now - last).total_seconds() < interval * 60
    except Exception:
        return False
