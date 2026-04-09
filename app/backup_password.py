"""Persisted backup archive password (encrypted with the app Fernet key)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app import config, crypto


_STATE_NAME = ".gc_backup_settings.json"


def _state_path() -> Path:
    pr = config.persist_root()
    base = (pr if pr is not None else config.BASE_DIR).resolve()
    candidate = (base / _STATE_NAME).resolve()
    try:
        candidate.relative_to(base)
    except ValueError as exc:
        raise RuntimeError("Invalid persist root for backup settings path") from exc
    return candidate


def _load_raw() -> dict[str, Any]:
    p = _state_path()
    if not p.is_file():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _save_raw(data: dict[str, Any]) -> None:
    p = _state_path()
    p.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _saved_password_from_raw(raw: dict[str, Any]) -> str | None:
    token = (raw.get("encrypted_backup_password") or "").strip()
    if not token:
        return None
    try:
        return crypto.decrypt_secret(token)
    except ValueError:
        return None


def backup_password_is_configured() -> bool:
    """True only when a stored password exists and decrypts with the current Fernet key."""
    return get_saved_backup_password() is not None


def get_saved_backup_password() -> str | None:
    return _saved_password_from_raw(_load_raw())


def validate_backup_password_policy(pw: str) -> None:
    if len(pw) < 10:
        raise ValueError("Backup password must be at least 10 characters.")
    if len(pw) > 256:
        raise ValueError("Backup password is too long.")


def set_backup_password(new_password: str) -> None:
    """Set or replace the backup password (admin-only at the API layer)."""
    validate_backup_password_policy(new_password)
    enc = crypto.encrypt_secret(new_password)
    data = _load_raw()
    data["encrypted_backup_password"] = enc
    _save_raw(data)


def backup_password_status_payload() -> dict[str, Any]:
    raw = _load_raw()
    token = (raw.get("encrypted_backup_password") or "").strip()
    readable = _saved_password_from_raw(raw) is not None
    return {
        "password_configured": readable,
        # Token on disk but Fernet decrypt failed (wrong key, corruption, etc.)
        "password_needs_reset": bool(token) and not readable,
    }
