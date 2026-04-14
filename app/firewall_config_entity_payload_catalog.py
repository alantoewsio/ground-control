"""Discover and persist top-level ``payload_json`` keys per ``entity_type`` during config sync."""

from __future__ import annotations

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
        inferred = infer_default_data_entry_type_for_property(row.property_name)
        if inferred:
            row.data_entry_type = inferred
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
        inferred_det = infer_default_data_entry_type_for_property(prop)
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
                    data_entry_properties=None,
                    show_as=None,
                    display_order=ord_seq,
                )
            )
            continue
        if row.json_value_kind != kind:
            row.json_value_kind = "mixed"
            row.updated_at = _utc_now()
        if row_data_entry_type_is_unset(row) and inferred_det is not None:
            row.data_entry_type = inferred_det
            row.updated_at = _utc_now()
