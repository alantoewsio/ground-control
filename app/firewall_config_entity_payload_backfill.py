"""Insert missing ``firewall_config_entity_payload_fields`` rows from cached config payloads (no updates)."""

from __future__ import annotations

import json
from typing import Any, Iterator, Mapping

from sqlalchemy import func, inspect
from sqlalchemy.orm import Session

from app.firewall_config_entity_payload_catalog import (
    apply_inferred_data_entry_types_where_unset,
    infer_default_data_entry_type_for_property,
    json_value_kind,
)
from app.models import (
    ConfigurationConfigEntry,
    FirewallConfigEntityPayloadField,
    FirewallConfigEntry,
)


def ensure_firewall_config_entity_payload_fields_table(db: Session) -> None:
    """Create the catalog table if it does not exist (idempotent)."""
    bind = db.get_bind()
    insp = inspect(bind)
    if insp.has_table("firewall_config_entity_payload_fields"):
        return
    FirewallConfigEntityPayloadField.__table__.create(bind=bind, checkfirst=True)


def _load_existing_keys(db: Session) -> set[tuple[str, str]]:
    rows = (
        db.query(
            FirewallConfigEntityPayloadField.entity_type,
            FirewallConfigEntityPayloadField.property_name,
        )
        .all()
    )
    return {(str(et), str(pn)) for et, pn in rows}


def _load_max_display_order_by_entity(db: Session) -> dict[str, int]:
    rows = (
        db.query(
            FirewallConfigEntityPayloadField.entity_type,
            func.max(FirewallConfigEntityPayloadField.display_order),
        )
        .group_by(FirewallConfigEntityPayloadField.entity_type)
        .all()
    )
    return {str(et): int(m) if m is not None else 0 for et, m in rows}


def _bump_display_order(entity_type: str, counters: dict[str, int]) -> int:
    et = str(entity_type or "").strip()
    nxt = counters.get(et, 0) + 1
    counters[et] = nxt
    return nxt


def _parse_top_level_payload_dict(payload_str: str) -> Mapping[str, Any] | None:
    try:
        data = json.loads(payload_str or "{}")
    except (json.JSONDecodeError, TypeError):
        return None
    return data if isinstance(data, dict) else None


def _iter_nested_dict_paths(
    obj: Mapping[str, Any],
    prefix: str = "",
    *,
    depth: int = 0,
    max_depth: int = 32,
) -> Iterator[tuple[str, Any]]:
    """
    Yield ``(property_path, value)`` for every key in a nested JSON object tree.

    Paths use dot notation (e.g. ``Interface.Address``). Only dict values are recursed; list and
    scalar leaves are not expanded.
    """
    if depth > max_depth:
        return
    for raw_key, val in obj.items():
        prop = str(raw_key).strip()
        if not prop:
            continue
        path = f"{prefix}.{prop}" if prefix else prop
        if len(path) > 512:
            path = path[:512]
        yield path, val
        if isinstance(val, dict):
            yield from _iter_nested_dict_paths(
                val, path, depth=depth + 1, max_depth=max_depth
            )


def _process_payload(
    entity_type: str,
    payload_str: str,
    *,
    existing: set[tuple[str, str]],
    db: Session,
    order_next: dict[str, int],
) -> tuple[int, int]:
    """
    Returns (entries_increment, rows_inserted_increment).
    ``entries_increment`` is 1 if we consumed one cache entry (for stats).
    """
    data = _parse_top_level_payload_dict(payload_str)
    if data is None:
        return 1, 0
    et = str(entity_type or "").strip()
    if not et:
        return 1, 0
    inserted = 0
    max_paths_per_entry = 2000
    for n, (prop, val) in enumerate(_iter_nested_dict_paths(data)):
        if n >= max_paths_per_entry:
            break
        key = (et, prop)
        if key in existing:
            continue
        kind = json_value_kind(val)
        inferred_det = infer_default_data_entry_type_for_property(prop)
        do = _bump_display_order(et, order_next)
        db.add(
            FirewallConfigEntityPayloadField(
                entity_type=et[:32] if len(et) > 32 else et,
                property_name=prop[:512] if len(prop) > 512 else prop,
                json_value_kind=kind[:32] if len(kind) > 32 else kind,
                dependent_on=None,
                data_entry_type=inferred_det,
                data_entry_properties=None,
                show_as=None,
                display_order=do,
            )
        )
        existing.add(key)
        inserted += 1
    return 1, inserted


def _iter_model_by_id(db: Session, model: type[Any], *, batch_size: int = 800):
    last_id = 0
    pk = model.id
    while True:
        batch = (
            db.query(model)
            .filter(pk > last_id)
            .order_by(pk)
            .limit(batch_size)
            .all()
        )
        if not batch:
            break
        for row in batch:
            yield row
        last_id = batch[-1].id


def backfill_missing_entity_payload_fields_from_cache(
    db: Session,
    *,
    include_firewall_cache: bool = True,
    include_configuration_cache: bool = True,
) -> dict[str, int]:
    """
    Scan ``firewall_config_entries`` and/or ``configuration_config_entries`` payloads.
    For each key path in the JSON object tree (top-level and nested dict keys, dot-separated),
    insert a catalog row if (entity_type, property_name) is absent. Nested lists are not expanded.
    After inserts, :func:`apply_inferred_data_entry_types_where_unset` fills blank ``data_entry_type``
    (NULL / empty / whitespace) from name, description, and transaction-id heuristics without
    overwriting a non-blank user choice.
    """
    ensure_firewall_config_entity_payload_fields_table(db)
    existing = _load_existing_keys(db)
    order_next = _load_max_display_order_by_entity(db)
    entries_scanned = 0
    rows_inserted = 0

    if include_firewall_cache:
        for row in _iter_model_by_id(db, FirewallConfigEntry):
            e, ins = _process_payload(
                row.entity_type,
                row.payload_json,
                existing=existing,
                db=db,
                order_next=order_next,
            )
            entries_scanned += e
            rows_inserted += ins

    if include_configuration_cache:
        for row in _iter_model_by_id(db, ConfigurationConfigEntry):
            e, ins = _process_payload(
                row.entity_type,
                row.payload_json,
                existing=existing,
                db=db,
                order_next=order_next,
            )
            entries_scanned += e
            rows_inserted += ins

    db.flush()
    inferred_set = apply_inferred_data_entry_types_where_unset(db)
    db.commit()
    return {
        "entries_scanned": entries_scanned,
        "rows_inserted": rows_inserted,
        "data_entry_types_inferred": inferred_set,
    }
