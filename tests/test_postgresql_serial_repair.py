"""repair_postgresql_serials_to_max_id is a no-op on SQLite."""

from __future__ import annotations

from sqlalchemy import create_engine

from app.db_utils import repair_postgresql_serials_to_max_id


def test_repair_serials_sqlite_noop() -> None:
    eng = create_engine("sqlite:///:memory:")
    repair_postgresql_serials_to_max_id(
        eng, tables=("firewalls", "firewall_webadmin_pings")
    )
