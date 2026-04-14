"""Repo-tracked JSON store for Designer · Modals flyout properties (titles, object-edit-flyout)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app import config

PROPERTIES_FILE_RELATIVE = Path("data") / "designer_modal_properties.json"
SCHEMA_VERSION = 1

_TITLE_MAX = 500
_ENTITY_TYPE_MAX = 128


def properties_file_path() -> Path:
    return (config.BASE_DIR / PROPERTIES_FILE_RELATIVE).resolve()


def default_document() -> dict[str, Any]:
    return {
        "version": SCHEMA_VERSION,
        "view_flyout_title": "",
        "edit_flyout_title": "",
        "object_edit_flyout_title": "",
        "object_edit_entity_type": "",
    }


def load_document() -> dict[str, Any]:
    path = properties_file_path()
    if not path.is_file():
        return default_document()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default_document()
    if not isinstance(raw, dict):
        return default_document()
    return raw


def _clip_str(s: Any, max_len: int) -> str:
    t = str(s) if s is not None else ""
    if len(t) > max_len:
        return t[:max_len]
    return t


def normalize_modal_props(body: dict[str, Any] | None) -> dict[str, Any]:
    if not body or not isinstance(body, dict):
        body = {}
    et = _clip_str(body.get("object_edit_entity_type"), _ENTITY_TYPE_MAX).strip()
    return {
        "view_flyout_title": _clip_str(body.get("view_flyout_title"), _TITLE_MAX).strip(),
        "edit_flyout_title": _clip_str(body.get("edit_flyout_title"), _TITLE_MAX).strip(),
        "object_edit_flyout_title": _clip_str(
            body.get("object_edit_flyout_title"), _TITLE_MAX
        ).strip(),
        "object_edit_entity_type": et,
    }


def get_modal_props() -> dict[str, Any]:
    doc = load_document()
    base = default_document()
    merged = normalize_modal_props(
        {
            "view_flyout_title": doc.get("view_flyout_title", base["view_flyout_title"]),
            "edit_flyout_title": doc.get("edit_flyout_title", base["edit_flyout_title"]),
            "object_edit_flyout_title": doc.get(
                "object_edit_flyout_title", base["object_edit_flyout_title"]
            ),
            "object_edit_entity_type": doc.get(
                "object_edit_entity_type", base["object_edit_entity_type"]
            ),
        }
    )
    return {"version": SCHEMA_VERSION, **merged}


def save_modal_props(body: dict[str, Any]) -> dict[str, Any]:
    normalized = normalize_modal_props(body)
    path = properties_file_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = default_document()
    doc.update(normalized)
    doc["version"] = SCHEMA_VERSION
    text = json.dumps(doc, indent=2, sort_keys=False) + "\n"
    tmp = path.with_suffix(".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)
    return normalized
