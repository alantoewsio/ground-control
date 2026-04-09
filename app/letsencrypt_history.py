"""Persisted Let's Encrypt / Certbot activity (SQLite under ``.gc_letsencrypt``)."""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_db_lock = threading.Lock()


def _db_path() -> Path:
    from app.letsencrypt_service import letsencrypt_data_dir

    return letsencrypt_data_dir() / "history.db"


def _connect() -> sqlite3.Connection:
    p = _db_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(p), timeout=60.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS letsencrypt_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            operation TEXT NOT NULL,
            status TEXT NOT NULL,
            domains TEXT NOT NULL,
            validation_method TEXT,
            requested_by TEXT NOT NULL,
            exit_code INTEGER,
            message TEXT,
            log_excerpt TEXT,
            extra_json TEXT
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_le_hist_created ON letsencrypt_history(created_at DESC)"
    )


def append_event(
    *,
    operation: str,
    status: str,
    domains: list[str],
    requested_by: str,
    validation_method: str | None = None,
    exit_code: int | None = None,
    message: str | None = None,
    log_excerpt: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    """Append one history row (thread-safe)."""
    created = datetime.now(timezone.utc).isoformat()
    dom = ", ".join(domains) if domains else ""
    excerpt = (log_excerpt or "")[:24000]
    extra_s = json.dumps(extra, separators=(",", ":")) if extra else None
    with _db_lock:
        conn = _connect()
        try:
            _ensure_schema(conn)
            conn.execute(
                """
                INSERT INTO letsencrypt_history (
                    created_at, operation, status, domains, validation_method,
                    requested_by, exit_code, message, log_excerpt, extra_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    created,
                    operation,
                    status,
                    dom,
                    validation_method or "",
                    requested_by or "—",
                    exit_code,
                    message or "",
                    excerpt,
                    extra_s,
                ),
            )
        finally:
            conn.close()


def list_recent(*, limit: int = 500, offset: int = 0) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit), 2000))
    offset = max(0, int(offset))
    with _db_lock:
        conn = _connect()
        try:
            _ensure_schema(conn)
            cur = conn.execute(
                """
                SELECT id, created_at, operation, status, domains, validation_method,
                       requested_by, exit_code, message, log_excerpt, extra_json
                FROM letsencrypt_history
                ORDER BY id DESC
                LIMIT ? OFFSET ?
                """,
                (limit, offset),
            )
            rows = cur.fetchall()
        finally:
            conn.close()
    out: list[dict[str, Any]] = []
    for r in rows:
        extra = None
        if r["extra_json"]:
            try:
                extra = json.loads(r["extra_json"])
            except (json.JSONDecodeError, TypeError):
                extra = None
        blob = " ".join(
            str(x).lower()
            for x in [
                r["id"],
                r["created_at"],
                r["operation"],
                r["status"],
                r["domains"],
                r["validation_method"],
                r["requested_by"],
                r["exit_code"],
                r["message"],
                r["log_excerpt"],
            ]
            if x is not None and x != ""
        )
        out.append(
            {
                "id": r["id"],
                "created_at": r["created_at"] or "",
                "operation": r["operation"] or "",
                "status": r["status"] or "",
                "domains": r["domains"] or "",
                "validation_method": r["validation_method"] or "—",
                "requested_by": r["requested_by"] or "—",
                "exit_code": r["exit_code"],
                "message": r["message"] or "",
                "log_excerpt": r["log_excerpt"] or "",
                "log_preview": (r["log_excerpt"] or "")[:200] + ("…" if len(r["log_excerpt"] or "") > 200 else ""),
                "extra": extra,
                "search_blob": blob,
            }
        )
    return out
