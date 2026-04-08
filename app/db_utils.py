"""Database utilities: IN-clause chunking and SQLite WAL mode."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import event
from sqlalchemy.engine import Engine

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


def enable_wal_mode(engine: Engine) -> None:
    """Register an event listener that enables WAL journal mode on SQLite connections."""
    if not str(engine.url).startswith("sqlite"):
        return

    @event.listens_for(engine, "connect")
    def _set_wal(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


