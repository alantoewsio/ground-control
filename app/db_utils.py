"""Database utilities: IN-clause chunking and SQLite WAL mode."""

from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any

from sqlalchemy import event, inspect, text
from sqlalchemy.engine import Engine

_log = logging.getLogger(__name__)

SQLITE_MAX_CHUNK = 500


def chunked_ids(ids: Sequence[int], chunk_size: int = SQLITE_MAX_CHUNK) -> list[list[int]]:
    """Split a list of IDs into chunks safe for SQLite IN(...) clauses."""
    if not ids:
        return []
    result: list[list[int]] = []
    for i in range(0, len(ids), chunk_size):
        result.append(list(ids[i : i + chunk_size]))
    return result


def chunked_in_query(
    query_fn,
    ids: Sequence[int],
    chunk_size: int = SQLITE_MAX_CHUNK,
) -> list[Any]:
    """Execute *query_fn(chunk)* for each chunk of *ids* and return concatenated results.

    ``query_fn`` receives a ``list[int]`` and must return an iterable of rows.
    """
    if not ids:
        return []
    out: list[Any] = []
    for chunk in chunked_ids(ids, chunk_size):
        out.extend(query_fn(chunk))
    return out


def repair_postgresql_serials_to_max_id(engine: Engine, *, tables: tuple[str, ...]) -> None:
    """
    Align SERIAL/IDENTITY sequences with MAX(id) per table.

    After pg_restore, COPY with explicit ids, or SQLite→Postgres moves, sequences can lag
    behind row data; the next INSERT then collides on the primary key. Monitoring and
    access logs are especially visible because they insert frequently.
    """
    if engine.dialect.name != "postgresql":
        return
    insp = inspect(engine)
    adjusted: list[str] = []
    with engine.begin() as conn:
        for table in tables:
            if not insp.has_table(table):
                continue
            seq = conn.execute(
                text("SELECT pg_get_serial_sequence(:tbl, 'id')"),
                {"tbl": table},
            ).scalar()
            if not seq:
                continue
            max_id = conn.execute(text(f"SELECT MAX(id) FROM {table}")).scalar()
            if max_id is None:
                conn.execute(
                    text("SELECT setval(CAST(:seq AS regclass), 1, false)"),
                    {"seq": seq},
                )
            else:
                conn.execute(
                    text("SELECT setval(CAST(:seq AS regclass), :mx, true)"),
                    {"seq": seq, "mx": int(max_id)},
                )
            adjusted.append(table)
    if adjusted:
        _log.info(
            "PostgreSQL id sequences aligned with MAX(id) for %d table(s): %s",
            len(adjusted),
            ", ".join(adjusted),
        )


def enable_wal_mode(engine: Engine) -> None:
    """Register an event listener that enables WAL journal mode on SQLite connections."""
    if not str(engine.url).startswith("sqlite"):
        return

    @event.listens_for(engine, "connect")
    def _set_wal(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


