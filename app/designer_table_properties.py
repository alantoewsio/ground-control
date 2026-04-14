"""Repo-tracked JSON store for per-table designer sandbox settings (Designer · Tables, etc.).

All users see the same committed configuration: reads and writes use top-level
``instances[<instance_id>]``. Legacy files may still contain ``per_user``; on read we fall
back to the first matching instance there, and the next save writes only ``instances`` and
drops ``per_user``.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from app import config

PROPERTIES_FILE_RELATIVE = Path("data") / "designer_table_properties.json"
SCHEMA_VERSION = 1
PER_USER_KEY = "per_user"
INSTANCE_ID_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_.-]{0,127}$")

_STR_MAX = 200_000
_TITLE_MAX = 500
_COMBINE_BY_COL_RE = re.compile(r"^[a-zA-Z0-9_.-]{1,512}$")


def properties_file_path() -> Path:
    return (config.BASE_DIR / PROPERTIES_FILE_RELATIVE).resolve()


def default_document() -> dict[str, Any]:
    return {"version": SCHEMA_VERSION, "instances": {}}


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
    inst = raw.get("instances")
    if not isinstance(inst, dict):
        raw = dict(raw)
        raw["instances"] = {}
    return raw


def _legacy_per_user_instance(doc: dict[str, Any], instance_id: str) -> dict[str, Any] | None:
    pu = doc.get(PER_USER_KEY)
    if not isinstance(pu, dict):
        return None
    for bucket in pu.values():
        if not isinstance(bucket, dict):
            continue
        im = bucket.get("instances")
        if not isinstance(im, dict):
            continue
        raw = im.get(instance_id)
        if isinstance(raw, dict):
            return raw
    return None


def _normalize_combine_by_column(val: Any) -> str:
    """Persisted column id for Hosts & Services combined view; empty = default name rules."""
    s = _clip_str(val, 512).strip()
    if not s or s == "__name":
        return ""
    if not _COMBINE_BY_COL_RE.fullmatch(s):
        return ""
    return s


def _clip_str(s: Any, max_len: int) -> str:
    t = str(s) if s is not None else ""
    if len(t) > max_len:
        return t[:max_len]
    return t


def _normalize_secondary_filters(val: Any) -> list[dict[str, Any]]:
    if not isinstance(val, list):
        return []
    out: list[dict[str, Any]] = []
    for item in val[:200]:
        if not isinstance(item, dict):
            continue
        prop = _clip_str(item.get("prop"), 512).strip()
        op = _clip_str(item.get("op"), 16).strip() or "="
        if not prop:
            continue
        row: dict[str, Any] = {"prop": prop, "op": op}
        if op == "in":
            tags = item.get("tags")
            if isinstance(tags, list):
                row["tags"] = [_clip_str(t, 2048) for t in tags[:500] if str(t).strip()][:200]
            else:
                row["tags"] = []
        else:
            row["scalar"] = _clip_str(item.get("scalar"), 8192)
        out.append(row)
    return out


def _opt_bool_from_body(
    body: dict[str, Any], key: str, *, default_if_absent: bool
) -> bool:
    if key not in body:
        return default_if_absent
    return bool(body.get(key))


def normalize_instance_props(body: dict[str, Any]) -> dict[str, Any]:
    """Coerce client JSON into a storable instance record."""
    title = _clip_str(body.get("title"), _TITLE_MAX).strip() or "Preview table"
    entity_types = body.get("entity_types")
    et_list: list[str] = []
    if isinstance(entity_types, list):
        for x in entity_types[:500]:
            s = _clip_str(x, 64).strip()
            if s:
                et_list.append(s)
    hidden = body.get("hidden_column_ids")
    hid_list: list[str] = []
    if isinstance(hidden, list):
        for x in hidden[:500]:
            s = _clip_str(x, 512).strip()
            if s:
                hid_list.append(s)
    col_vis = body.get("column_visibility")
    col_vis_out: dict[str, bool] | None = None
    if isinstance(col_vis, dict):
        col_vis_out = {}
        for k, v in list(col_vis.items())[:800]:
            key = _clip_str(k, 512).strip()
            if key:
                col_vis_out[key] = bool(v)
    opt_combine_view = True
    if "opt_combine_view" in body:
        opt_combine_view = bool(body.get("opt_combine_view"))

    return {
        "title": title,
        "design_mode": bool(body.get("design_mode")),
        "entity_types": et_list,
        "secondary_filters": _normalize_secondary_filters(body.get("secondary_filters")),
        "hidden_column_ids": hid_list,
        "column_order": _clip_str(body.get("column_order"), _STR_MAX),
        "column_overrides": _clip_str(body.get("column_overrides"), _STR_MAX),
        "opt_row_selectors": _opt_bool_from_body(
            body, "opt_row_selectors", default_if_absent=True
        ),
        "opt_add_btn": _opt_bool_from_body(body, "opt_add_btn", default_if_absent=True),
        "opt_delete_btn": _opt_bool_from_body(
            body, "opt_delete_btn", default_if_absent=True
        ),
        "opt_read_only": _opt_bool_from_body(
            body, "opt_read_only", default_if_absent=False
        ),
        "opt_combine_view": opt_combine_view,
        "combine_by_column": _normalize_combine_by_column(body.get("combine_by_column")),
        "column_visibility": col_vis_out,
    }


def merge_with_defaults(stored: dict[str, Any] | None) -> dict[str, Any]:
    base = normalize_instance_props({})
    if not stored or not isinstance(stored, dict):
        return base
    merged = normalize_instance_props(
        {
            "title": stored.get("title", base["title"]),
            "design_mode": stored.get("design_mode", base["design_mode"]),
            "entity_types": stored.get("entity_types", base["entity_types"]),
            "secondary_filters": stored.get("secondary_filters", base["secondary_filters"]),
            "hidden_column_ids": stored.get("hidden_column_ids", base["hidden_column_ids"]),
            "column_order": stored.get("column_order", base["column_order"]),
            "column_overrides": stored.get("column_overrides", base["column_overrides"]),
            "opt_row_selectors": stored.get("opt_row_selectors", base["opt_row_selectors"]),
            "opt_add_btn": stored.get("opt_add_btn", base["opt_add_btn"]),
            "opt_delete_btn": stored.get("opt_delete_btn", base["opt_delete_btn"]),
            "opt_read_only": stored.get("opt_read_only", base["opt_read_only"]),
            "opt_combine_view": stored.get("opt_combine_view", base["opt_combine_view"]),
            "combine_by_column": stored.get(
                "combine_by_column", base["combine_by_column"]
            ),
            "column_visibility": stored.get("column_visibility", base["column_visibility"]),
        }
    )
    return merged


def get_instance_props(instance_id: str) -> dict[str, Any]:
    doc = load_document()
    inst = doc.get("instances") or {}
    if isinstance(inst, dict):
        raw = inst.get(instance_id)
        if isinstance(raw, dict):
            return merge_with_defaults(raw)
    raw_legacy = _legacy_per_user_instance(doc, instance_id)
    return merge_with_defaults(raw_legacy)


def save_instance_props(instance_id: str, body: dict[str, Any]) -> dict[str, Any]:
    if not INSTANCE_ID_RE.match(instance_id):
        raise ValueError("Invalid instance id")
    normalized = normalize_instance_props(body)
    path = properties_file_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = load_document()
    doc["version"] = SCHEMA_VERSION
    if "instances" not in doc or not isinstance(doc["instances"], dict):
        doc["instances"] = {}
    doc["instances"][instance_id] = normalized
    if PER_USER_KEY in doc:
        del doc[PER_USER_KEY]
    text = json.dumps(doc, indent=2, sort_keys=False) + "\n"
    tmp = path.with_suffix(".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)
    return normalized
