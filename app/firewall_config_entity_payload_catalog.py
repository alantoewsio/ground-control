"""Discover and persist top-level ``payload_json`` keys per ``entity_type`` during config sync."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models import FirewallConfigEntityPayloadField


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def json_value_kind(value: Any) -> str:
    """Rough JSON Schema style kind for a Python value from parsed API payloads."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, dict):
        return "object"
    if isinstance(value, list):
        return "array"
    return "unknown"


def infer_default_data_entry_type_for_property(property_name: str) -> str | None:
    """
    Default ``data_entry_type`` for catalog rows from common API naming (Sophos-style and snake_case).

    Returns ``Hidden`` for transaction-id-style keys, ``text-single`` for name-like keys,
    ``text-multiline`` for description-like keys, or ``None`` when no rule matches.
    """
    if not property_name or not str(property_name).strip():
        return None
    last = str(property_name).strip().rsplit(".", 1)[-1]
    if not last:
        return None
    ll = last.lower()
    if ll == "description" or last.endswith("Description") or ll.endswith("_description"):
        return "text-multiline"
    # API transaction / correlation ids (hide in forms)
    tail_no_at = ll[1:] if last.startswith("@") else ll
    if (
        tail_no_at == "transactionid"
        or ll == "transaction_id"
        or ll.endswith("_transaction_id")
        or last.endswith("TransactionId")
    ):
        return "Hidden"
    if ll == "name" or last == "Name":
        return "text-single"
    if last.endswith("Name") and len(last) > 4:
        return "text-single"
    if ll.endswith("_name"):
        return "text-single"
    return None


def row_data_entry_type_is_unset(row: FirewallConfigEntityPayloadField) -> bool:
    """True when no catalog control is chosen (NULL, empty, or whitespace-only)."""
    v = row.data_entry_type
    if v is None:
        return True
    return not str(v).strip()


def row_data_entry_properties_is_unset(row: FirewallConfigEntityPayloadField) -> bool:
    """True when ``data_entry_properties`` is NULL, empty, or whitespace-only."""
    v = row.data_entry_properties
    if v is None:
        return True
    return not str(v).strip()


def _member_lookup_multi_data_entry_properties_json() -> str:
    """
    Canonical member-lookup props for array defaults.

    Keep ``multi`` mirrored at root and ``source.multi`` for runtime compatibility.
    """
    return json.dumps(
        {
            "multi": True,
            "source": {
                "multi": True,
            },
        },
        separators=(",", ":"),
        sort_keys=True,
    )


def infer_default_catalog_settings_for_field(
    property_name: str, json_kind: str
) -> tuple[str | None, str | None]:
    """
    Infer default catalog settings for new/blank rows.

    Rules:
    - ``array`` -> ``member-lookup`` with multi-select enabled
    - ``object`` -> no control (``None`` data entry type)
    - other kinds -> name-based fallback inference
    """
    kind = str(json_kind or "").strip().lower()
    if kind == "array":
        return "member-lookup", _member_lookup_multi_data_entry_properties_json()
    if kind == "object":
        return None, None
    return infer_default_data_entry_type_for_property(property_name), None


def apply_inferred_data_entry_types_where_unset(db: Session) -> int:
    """
    Set ``data_entry_type`` from :func:`infer_default_data_entry_type_for_property` where the
    value is unset (NULL, ``''``, or whitespace). Does not replace a non-blank user choice.
    """
    col = FirewallConfigEntityPayloadField.data_entry_type
    n = 0
    rows = (
        db.query(FirewallConfigEntityPayloadField)
        .filter(
            or_(
                col.is_(None),
                col == "",
                func.trim(col) == "",
            )
        )
        .all()
    )
    for row in rows:
        inferred, inferred_props = infer_default_catalog_settings_for_field(
            row.property_name, row.json_value_kind
        )
        if inferred:
            row.data_entry_type = inferred
            if inferred_props is not None and row_data_entry_properties_is_unset(row):
                row.data_entry_properties = inferred_props
            n += 1
    return n


def record_entity_payload_field_rows(
    db: Session, entity_type: str, item: dict[str, Any]
) -> None:
    """
    Upsert catalog rows for each top-level key on ``item`` (one unique row per entity_type + key).
    """
    max_ord = (
        db.query(func.max(FirewallConfigEntityPayloadField.display_order))
        .filter(FirewallConfigEntityPayloadField.entity_type == entity_type)
        .scalar()
    )
    ord_seq = int(max_ord) if max_ord is not None else 0
    for raw_key, val in item.items():
        prop = str(raw_key).strip()
        if not prop:
            continue
        kind = json_value_kind(val)
        inferred_det, inferred_props = infer_default_catalog_settings_for_field(prop, kind)
        row = (
            db.query(FirewallConfigEntityPayloadField)
            .filter(
                FirewallConfigEntityPayloadField.entity_type == entity_type,
                FirewallConfigEntityPayloadField.property_name == prop,
            )
            .one_or_none()
        )
        if row is None:
            ord_seq += 1
            db.add(
                FirewallConfigEntityPayloadField(
                    entity_type=entity_type,
                    property_name=prop,
                    json_value_kind=kind,
                    dependent_on=None,
                    data_entry_type=inferred_det,
                    data_entry_properties=inferred_props,
                    show_as=None,
                    display_type="text",
                    display_order=ord_seq,
                )
            )
            continue
        if row.json_value_kind != kind:
            row.json_value_kind = "mixed"
            row.updated_at = _utc_now()
        if row_data_entry_type_is_unset(row) and inferred_det is not None:
            row.data_entry_type = inferred_det
            if inferred_props is not None and row_data_entry_properties_is_unset(row):
                row.data_entry_properties = inferred_props
            row.updated_at = _utc_now()
