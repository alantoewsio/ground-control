"""Repo-tracked layout graph settings for Designer Data Controls."""

from __future__ import annotations

import json
import re
import threading
from pathlib import Path
from typing import Any

from app import config

LAYOUT_FILE_RELATIVE = Path("data") / "designer_data_controls_layout.json"
SCHEMA_VERSION = 1
ENTITY_TYPE_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]{0,31}$")

_NODE_ID_RE = re.compile(r"^[a-zA-Z0-9_.:-]{1,128}$")
_HANDLE_ID_RE = re.compile(r"^[a-zA-Z0-9_.:-]{1,128}$")
_LOGIC_OPS = {"and", "or", "not"}
_LOGIC_KINDS = {"gate", "if_value", "csv_array"}


class LayoutMapLockedError(ValueError):
    """Raised when a PUT is attempted while the saved layout map is locked."""


def layout_file_path() -> Path:
    return (config.BASE_DIR / LAYOUT_FILE_RELATIVE).resolve()


def _default_layout() -> dict[str, Any]:
    return {
        "node_positions": {},
        "connections": [],
        "logic_nodes": [],
        "control_add_only": {},
        "member_lookup_data_source": {},
        "member_lookup_multi": {},
        "layout_locked": False,
    }


def _default_document() -> dict[str, Any]:
    return {"version": SCHEMA_VERSION, "entity_types": {}}


# Serialize read-modify-write so concurrent PUTs for different entity types do not
# drop each other's updates (each save reloads the full JSON document).
_LAYOUT_STORE_LOCK = threading.Lock()


def _read_layout_document_from_disk() -> dict[str, Any]:
    """Parse layout store JSON. Caller must hold _LAYOUT_STORE_LOCK when paired with writes."""
    path = layout_file_path()
    if not path.is_file():
        return _default_document()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return _default_document()
    if not isinstance(raw, dict):
        return _default_document()
    entity_types = raw.get("entity_types")
    if not isinstance(entity_types, dict):
        return _default_document()
    return {"version": SCHEMA_VERSION, "entity_types": entity_types}


def _to_num(value: Any, default: float) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return default
    if n != n:  # NaN
        return default
    if n < -20000:
        return -20000
    if n > 20000:
        return 20000
    return n


def _normalize_node_positions(value: Any) -> dict[str, dict[str, float]]:
    if not isinstance(value, dict):
        return {}
    out: dict[str, dict[str, float]] = {}
    for raw_node_id, raw_pos in list(value.items())[:1200]:
        node_id = str(raw_node_id or "").strip()
        if not node_id or not _NODE_ID_RE.match(node_id):
            continue
        if not isinstance(raw_pos, dict):
            continue
        out[node_id] = {
            "x": _to_num(raw_pos.get("x"), 0.0),
            "y": _to_num(raw_pos.get("y"), 0.0),
        }
    return out


def _normalize_connections(value: Any) -> list[dict[str, Any]]:
    """Normalize edges; optional ``edge_id`` disambiguates multiple wires on the same tuple."""
    if not isinstance(value, list):
        return []
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in value[:4000]:
        if not isinstance(item, dict):
            continue
        src_node = str(item.get("source_node_id") or "").strip()
        src_handle = str(item.get("source_handle") or "").strip()
        dst_node = str(item.get("target_node_id") or "").strip()
        dst_handle = str(item.get("target_handle") or "").strip()
        if (
            not _NODE_ID_RE.match(src_node)
            or not _HANDLE_ID_RE.match(src_handle)
            or not _NODE_ID_RE.match(dst_node)
            or not _HANDLE_ID_RE.match(dst_handle)
        ):
            continue
        edge_raw = str(item.get("edge_id") or "").strip()
        edge_id = edge_raw if edge_raw and _NODE_ID_RE.match(edge_raw) else ""
        tuple_key = f"{src_node}|{src_handle}|{dst_node}|{dst_handle}"
        dedupe_key = edge_id or tuple_key
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        row: dict[str, Any] = {
            "source_node_id": src_node,
            "source_handle": src_handle,
            "target_node_id": dst_node,
            "target_handle": dst_handle,
        }
        if edge_id:
            row["edge_id"] = edge_id
        out.append(row)
    return out


def _normalize_logic_nodes(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in value[:300]:
        if not isinstance(item, dict):
            continue
        node_id = str(item.get("id") or "").strip()
        op = str(item.get("op") or "").strip().lower()
        kind = str(item.get("kind") or "").strip().lower()
        if not _NODE_ID_RE.match(node_id):
            continue
        if not node_id.startswith("logic:"):
            continue
        if kind not in _LOGIC_KINDS:
            kind = "gate"
        if op not in _LOGIC_OPS:
            op = "and"
        if node_id in seen:
            continue
        seen.add(node_id)
        out.append(
            {
                "id": node_id,
                "kind": kind,
                "op": op,
                "true_value": str(item.get("true_value") or ""),
                "false_value": str(item.get("false_value") or ""),
            }
        )
    return out


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return bool(value)
    s = str(value).strip().lower()
    if not s:
        return False
    if s in {"0", "false", "off", "no", "none", "null"}:
        return False
    if s in {"1", "true", "on", "yes"}:
        return True
    return True


def _normalize_control_add_only(value: Any) -> dict[str, bool]:
    if not isinstance(value, dict):
        return {}
    out: dict[str, bool] = {}
    for raw_node_id, raw_flag in list(value.items())[:1200]:
        node_id = str(raw_node_id or "").strip()
        if not node_id or not _NODE_ID_RE.match(node_id):
            continue
        if not node_id.startswith("ctrl:"):
            continue
        out[node_id] = _coerce_bool(raw_flag)
    return out


def _normalize_member_lookup_data_source(value: Any) -> dict[str, str]:
    """Per ctrl node, optional entity_type string for member-lookup cache scope (layout display cards)."""
    if not isinstance(value, dict):
        return {}
    out: dict[str, str] = {}
    for raw_node_id, raw_et in list(value.items())[:1200]:
        node_id = str(raw_node_id or "").strip()
        if not node_id or not _NODE_ID_RE.match(node_id):
            continue
        if not node_id.startswith("ctrl:"):
            continue
        et = str(raw_et or "").strip()
        if not et or not ENTITY_TYPE_RE.match(et):
            continue
        out[node_id] = et
    return out


def _normalize_member_lookup_multi(value: Any) -> dict[str, bool]:
    """Per ctrl node, bool Multi-select override for member-lookup controls."""
    if not isinstance(value, dict):
        return {}
    out: dict[str, bool] = {}
    for raw_node_id, raw_flag in list(value.items())[:1200]:
        node_id = str(raw_node_id or "").strip()
        if not node_id or not _NODE_ID_RE.match(node_id):
            continue
        if not node_id.startswith("ctrl:"):
            continue
        out[node_id] = _coerce_bool(raw_flag)
    return out


def normalize_layout(value: Any) -> dict[str, Any]:
    data = value if isinstance(value, dict) else {}
    return {
        "node_positions": _normalize_node_positions(data.get("node_positions")),
        "connections": _normalize_connections(data.get("connections")),
        "logic_nodes": _normalize_logic_nodes(data.get("logic_nodes")),
        "control_add_only": _normalize_control_add_only(data.get("control_add_only")),
        "member_lookup_data_source": _normalize_member_lookup_data_source(
            data.get("member_lookup_data_source")
        ),
        "member_lookup_multi": _normalize_member_lookup_multi(
            data.get("member_lookup_multi")
        ),
        "layout_locked": _coerce_bool(data.get("layout_locked")),
    }


def get_layout_for_entity_type(entity_type: str) -> dict[str, Any]:
    et = str(entity_type or "").strip()
    if not ENTITY_TYPE_RE.match(et):
        raise ValueError("Invalid entity type")
    with _LAYOUT_STORE_LOCK:
        doc = _read_layout_document_from_disk()
        raw = doc["entity_types"].get(et)
    return normalize_layout(raw)


def save_layout_for_entity_type(entity_type: str, layout: Any) -> dict[str, Any]:
    et = str(entity_type or "").strip()
    if not ENTITY_TYPE_RE.match(et):
        raise ValueError("Invalid entity type")
    with _LAYOUT_STORE_LOCK:
        doc = _read_layout_document_from_disk()
        prev_raw = doc["entity_types"].get(et)
        prev = normalize_layout(prev_raw if isinstance(prev_raw, dict) else {})
        if prev.get("layout_locked"):
            raise LayoutMapLockedError(
                "Layout map is locked for this object type; unlock it before saving changes."
            )
        normalized = normalize_layout(layout)
        doc["version"] = SCHEMA_VERSION
        doc["entity_types"][et] = normalized
        path = layout_file_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        text = json.dumps(doc, indent=2, sort_keys=False) + "\n"
        tmp = path.with_suffix(".tmp")
        tmp.write_text(text, encoding="utf-8")
        tmp.replace(path)
    return normalized


def get_layout_lock_flags() -> dict[str, bool]:
    """``entity_type`` → layout map locked, for all types present in the layout store."""
    with _LAYOUT_STORE_LOCK:
        doc = _read_layout_document_from_disk()
        raw_types = doc.get("entity_types")
    if not isinstance(raw_types, dict):
        return {}
    out: dict[str, bool] = {}
    for k, v in raw_types.items():
        et = str(k or "").strip()
        if not et or not ENTITY_TYPE_RE.match(et):
            continue
        if isinstance(v, dict):
            out[et] = _coerce_bool(v.get("layout_locked"))
    return out


def set_layout_map_locked(entity_type: str, locked: bool) -> dict[str, Any]:
    """Persist only the layout lock flag (creates an empty normalized layout if missing)."""
    et = str(entity_type or "").strip()
    if not ENTITY_TYPE_RE.match(et):
        raise ValueError("Invalid entity type")
    with _LAYOUT_STORE_LOCK:
        doc = _read_layout_document_from_disk()
        prev_raw = doc["entity_types"].get(et)
        merged = normalize_layout(prev_raw if isinstance(prev_raw, dict) else {})
        merged["layout_locked"] = bool(locked)
        doc["version"] = SCHEMA_VERSION
        doc["entity_types"][et] = merged
        path = layout_file_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        text = json.dumps(doc, indent=2, sort_keys=False) + "\n"
        tmp = path.with_suffix(".tmp")
        tmp.write_text(text, encoding="utf-8")
        tmp.replace(path)
    return merged
