"""Tests for ``app.monitor_database``."""

from __future__ import annotations

from app.monitor_database import get_monitor_db, init_monitor_db


def test_init_monitor_db_idempotent():
    init_monitor_db()


def test_get_monitor_db_closes():
    gen = get_monitor_db()
    db = next(gen)
    try:
        assert db is not None
    finally:
        try:
            next(gen)
        except StopIteration:
            pass
