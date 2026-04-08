"""Tests for ``app.database``."""

from __future__ import annotations

import app.config as config
from app.database import (
    _migrate_postgres_task_queue_scope_target,  # noqa: SLF001
    _migrate_sqlite_configurations_cloned_from_firewall,  # noqa: SLF001
    _migrate_sqlite_configurations_member_firewall_ids,  # noqa: SLF001
    _migrate_sqlite_firewall_columns,  # noqa: SLF001
    _migrate_sqlite_task_queue_columns,  # noqa: SLF001
    _migrate_sqlite_task_queue_completed_columns,  # noqa: SLF001
    _migrate_sqlite_task_queue_scope_target,  # noqa: SLF001
    get_db,
    init_db,
)


def test_init_db_idempotent(main_session):
    init_db()


def test_get_db_generator():
    gen = get_db()
    db = next(gen)
    try:
        assert db is not None
    finally:
        try:
            next(gen)
        except StopIteration:
            pass


def test_migrate_skips_when_not_sqlite(monkeypatch):
    monkeypatch.setattr(config, "database_url", lambda: "postgresql://localhost/x")
    _migrate_sqlite_firewall_columns()
    _migrate_sqlite_task_queue_columns()
    _migrate_sqlite_task_queue_completed_columns()
    _migrate_sqlite_task_queue_scope_target()
    _migrate_postgres_task_queue_scope_target()
    _migrate_sqlite_configurations_cloned_from_firewall()
    _migrate_sqlite_configurations_member_firewall_ids()
