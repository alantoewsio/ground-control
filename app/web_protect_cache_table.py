"""Read-only Protect · Web tables from cached firewall_config_entry rows."""

from __future__ import annotations

import json
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.firewall_config_sync import ENTITY_URL_GROUP, ENTITY_USER_ACTIVITY
from app.models import Firewall, FirewallConfigEntry


def _text_scalar(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, dict):
        raw = raw.get("#text") if "#text" in raw else raw.get("text")
    return str(raw).strip()


def _scalar_from_payload(data: dict[str, Any], key: str) -> str:
    return _text_scalar(data.get(key))


def _list_len_under(parent: Any, item_key: str) -> str:
    if not isinstance(parent, dict):
        return "0"
    item = parent.get(item_key)
    if item is None:
        return "0"
    if isinstance(item, list):
        return str(len(item))
    return "1"


def _category_list_count(data: dict[str, Any]) -> str:
    cl = data.get("CategoryList")
    return _list_len_under(cl, "Category")


def _url_list_count(data: dict[str, Any]) -> str:
    ul = data.get("URLlist") or data.get("URLLIST")
    return _list_len_under(ul, "URL")


def _rows_for_entity(
    db: Session,
    firewall_ids: list[int],
    entity_type: str,
    *,
    cells_fn: Callable[[dict[str, Any], FirewallConfigEntry, str], dict[str, str]],
) -> list[dict[str, Any]]:
    if not firewall_ids:
        return []
    rows_db = (
        db.query(FirewallConfigEntry, Firewall)
        .join(Firewall, Firewall.id == FirewallConfigEntry.firewall_id)
        .filter(
            FirewallConfigEntry.entity_type == entity_type,
            FirewallConfigEntry.firewall_id.in_(firewall_ids),
        )
        .order_by(
            Firewall.name.asc().nulls_last(),
            Firewall.host.asc(),
            FirewallConfigEntry.external_name.asc(),
        )
        .all()
    )
    out: list[dict[str, Any]] = []
    for ent, fw in rows_db:
        try:
            data = json.loads(ent.payload_json)
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        fw_label = (fw.name or "").strip() or (fw.host or "").strip() or str(fw.id)
        cells = cells_fn(data, ent, fw_label)
        search_parts = [str(v).lower() for v in cells.values() if v]
        search_parts.append(fw_label.lower())
        if fw.host:
            search_parts.append((fw.host or "").lower())
        out.append(
            {
                "entity_type": entity_type,
                "firewall_id": fw.id,
                "firewall_label": fw_label,
                "config_entry_id": ent.id,
                "cells": cells,
                "search": " ".join(search_parts),
            }
        )
    return out


def build_user_activity_table_payload(db: Session, firewall_ids: list[int]) -> dict[str, Any]:
    columns = ["__name", "__description", "__categories", "__firewall"]
    column_labels = {
        "__name": "Name",
        "__description": "Description",
        "__categories": "Categories",
        "__firewall": "Firewall",
    }

    def cells(data: dict[str, Any], ent: FirewallConfigEntry, fw_label: str) -> dict[str, str]:
        name = _scalar_from_payload(data, "Name") or (ent.external_name or "")
        return {
            "__name": name,
            "__description": _scalar_from_payload(data, "Desc"),
            "__categories": _category_list_count(data),
            "__firewall": fw_label,
        }

    return {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": list(columns),
        "rows": _rows_for_entity(db, firewall_ids, ENTITY_USER_ACTIVITY, cells_fn=cells),
    }


def build_url_group_table_payload(db: Session, firewall_ids: list[int]) -> dict[str, Any]:
    columns = ["__name", "__description", "__builtin", "__urls", "__firewall"]
    column_labels = {
        "__name": "Name",
        "__description": "Description",
        "__builtin": "Built-in",
        "__urls": "URLs",
        "__firewall": "Firewall",
    }

    def cells(data: dict[str, Any], ent: FirewallConfigEntry, fw_label: str) -> dict[str, str]:
        name = _scalar_from_payload(data, "Name") or (ent.external_name or "")
        return {
            "__name": name,
            "__description": _scalar_from_payload(data, "Description"),
            "__builtin": _scalar_from_payload(data, "IsDefault"),
            "__urls": _url_list_count(data),
            "__firewall": fw_label,
        }

    return {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": list(columns),
        "rows": _rows_for_entity(db, firewall_ids, ENTITY_URL_GROUP, cells_fn=cells),
    }
