"""Read-only Authentication / Profiles tables from cached firewall_config_entry rows."""

from __future__ import annotations

import json
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.firewall_config_sync import (
    ENTITY_ADMIN_PROFILE,
    ENTITY_USER,
    ENTITY_USER_GROUP,
)
from app.models import Firewall, FirewallConfigEntry


def _text_scalar(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, dict):
        raw = raw.get("#text") if "#text" in raw else raw.get("text")
    return str(raw).strip()


def _scalar_from_payload(data: dict[str, Any], key: str) -> str:
    return _text_scalar(data.get(key))


def _group_detail(data: dict[str, Any]) -> dict[str, Any]:
    gd = data.get("GroupDetail")
    if isinstance(gd, list) and gd:
        gd = gd[0]
    return gd if isinstance(gd, dict) else {}


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
                "external_name": ent.external_name,
                "cells": cells,
                "search": " ".join(search_parts),
                "payload": data,
            }
        )
    return out


def build_auth_user_table_payload(db: Session, firewall_ids: list[int]) -> dict[str, Any]:
    columns = [
        "__username",
        "__name",
        "__type",
        "__group",
        "__profile",
        "__email",
        "__firewall",
    ]
    column_labels = {
        "__username": "Username",
        "__name": "Name",
        "__type": "User type",
        "__group": "Group",
        "__profile": "Profile",
        "__email": "Email",
        "__firewall": "Firewall",
    }

    def cells(data: dict[str, Any], ent: FirewallConfigEntry, fw_label: str) -> dict[str, str]:
        email = ""
        el = data.get("EmailList")
        if isinstance(el, dict):
            eid = el.get("EmailID")
            if isinstance(eid, list):
                email = _text_scalar(eid[0]) if eid else ""
            else:
                email = _text_scalar(eid)
        return {
            "__username": _scalar_from_payload(data, "Username") or (ent.external_name or ""),
            "__name": _scalar_from_payload(data, "Name"),
            "__type": _scalar_from_payload(data, "UserType"),
            "__group": _scalar_from_payload(data, "Group"),
            "__profile": _scalar_from_payload(data, "Profile"),
            "__email": email,
            "__firewall": fw_label,
        }

    return {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": list(columns),
        "rows": _rows_for_entity(db, firewall_ids, ENTITY_USER, cells_fn=cells),
    }


def build_auth_user_group_table_payload(db: Session, firewall_ids: list[int]) -> dict[str, Any]:
    columns = ["__name", "__type", "__surfing", "__access", "__firewall"]
    column_labels = {
        "__name": "Group name",
        "__type": "Group type",
        "__surfing": "Surfing quota",
        "__access": "Access time",
        "__firewall": "Firewall",
    }

    def cells(data: dict[str, Any], ent: FirewallConfigEntry, fw_label: str) -> dict[str, str]:
        gd = _group_detail(data)
        return {
            "__name": _scalar_from_payload(gd, "Name") or (ent.external_name or ""),
            "__type": _scalar_from_payload(gd, "GroupType"),
            "__surfing": _scalar_from_payload(gd, "SurfingQuotaPolicy"),
            "__access": _scalar_from_payload(gd, "AccessTimePolicy"),
            "__firewall": fw_label,
        }

    return {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": list(columns),
        "rows": _rows_for_entity(db, firewall_ids, ENTITY_USER_GROUP, cells_fn=cells),
    }


def build_admin_profile_options_payload(
    db: Session, firewall_ids: list[int]
) -> dict[str, Any]:
    """Distinct administration profile names from cache for the given firewall id(s).

    When multiple firewalls are selected, returns the intersection of profile names
    that exist on every firewall (same name must be cached on each).
    """
    if not firewall_ids:
        return {"options": []}
    rows = (
        db.query(
            FirewallConfigEntry.firewall_id,
            FirewallConfigEntry.external_name,
            FirewallConfigEntry.payload_json,
        )
        .filter(
            FirewallConfigEntry.entity_type == ENTITY_ADMIN_PROFILE,
            FirewallConfigEntry.firewall_id.in_(firewall_ids),
        )
        .all()
    )
    names_by_fw: dict[int, set[str]] = {}
    for fid, ext_name, payload_json in rows:
        try:
            data = json.loads(payload_json)
        except json.JSONDecodeError:
            data = {}
        nm = ""
        if isinstance(data, dict):
            nm = _scalar_from_payload(data, "Name").strip()
        if not nm:
            nm = (ext_name or "").strip()
        if not nm:
            continue
        names_by_fw.setdefault(int(fid), set()).add(nm)

    combined: set[str] | None = None
    for fid in firewall_ids:
        s = names_by_fw.get(int(fid), set())
        combined = s if combined is None else (combined & s)

    if combined is None:
        return {"options": []}
    return {"options": sorted(combined, key=str.casefold)}


def build_user_group_options_payload(
    db: Session, firewall_ids: list[int]
) -> dict[str, Any]:
    """Distinct user group names from cache (GroupDetail.Name) for the firewall id(s).

    Multiple firewalls: intersection of group names present on every selected firewall.
    """
    if not firewall_ids:
        return {"options": []}
    rows = (
        db.query(
            FirewallConfigEntry.firewall_id,
            FirewallConfigEntry.external_name,
            FirewallConfigEntry.payload_json,
        )
        .filter(
            FirewallConfigEntry.entity_type == ENTITY_USER_GROUP,
            FirewallConfigEntry.firewall_id.in_(firewall_ids),
        )
        .all()
    )
    names_by_fw: dict[int, set[str]] = {}
    for fid, ext_name, payload_json in rows:
        try:
            data = json.loads(payload_json)
        except json.JSONDecodeError:
            data = {}
        nm = ""
        if isinstance(data, dict):
            gd = _group_detail(data)
            nm = _scalar_from_payload(gd, "Name").strip()
        if not nm:
            nm = (ext_name or "").strip()
        if not nm:
            continue
        names_by_fw.setdefault(int(fid), set()).add(nm)

    combined: set[str] | None = None
    for fid in firewall_ids:
        s = names_by_fw.get(int(fid), set())
        combined = s if combined is None else (combined & s)

    if combined is None:
        return {"options": []}
    return {"options": sorted(combined, key=str.casefold)}
