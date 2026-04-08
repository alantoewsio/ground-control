"""IPS switch: table payload from config cache (sync entity ``ips_switch``)."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.firewall_config_sync import (
    ENTITY_DOS_SETTINGS,
    ENTITY_IPS_SWITCH,
    ENTITY_SPOOF_PREVENTION,
)
from app.interface_table import zone_names_for_firewalls
from app.models import Firewall, FirewallConfigEntry


def _text_scalar(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, dict):
        raw = raw.get("#text") if "#text" in raw else raw.get("text")
    return str(raw).strip()


def _zones_from_spoof_block(block: Any) -> list[str]:
    """Parse IPSpoofing / MACFilter / IPMACFilter EnableOnZone.Zone from cached XML dict."""
    if not isinstance(block, dict):
        return []
    eoz = block.get("EnableOnZone")
    if not isinstance(eoz, dict):
        return []
    z = eoz.get("Zone")
    if z is None:
        return []
    if isinstance(z, list):
        out: list[str] = []
        for item in z:
            t = _text_scalar(item)
            if t and t.casefold() != "disable":
                out.append(t)
        return out
    t = _text_scalar(z)
    if not t or t.casefold() == "disable":
        return []
    return [t]


def spoof_prevention_enabled_from_payload(data: dict[str, Any]) -> bool | None:
    if not isinstance(data, dict):
        return None
    v = _text_scalar(data.get("SpoofPrevention")).lower()
    if v in ("enable", "enabled", "on"):
        return True
    if v in ("disable", "disabled", "off"):
        return False
    return None


def restrict_unknown_ip_on_trusted_mac_from_payload(data: dict[str, Any]) -> bool:
    if not isinstance(data, dict):
        return False
    v = _text_scalar(data.get("RestrictUnknownIPOnTrustedMAC")).lower()
    return v in ("enable", "enabled", "on")


def spoof_zone_selection_from_payload(data: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Per-zone checkboxes for the flyout (WAN only uses MAC filter in UI)."""
    if not isinstance(data, dict):
        return {}
    ip_z = set(_zones_from_spoof_block(data.get("IPSpoofing")))
    mac_z = set(_zones_from_spoof_block(data.get("MACFilter")))
    pair_z = set(_zones_from_spoof_block(data.get("IPMACFilter")))
    out: dict[str, dict[str, Any]] = {}
    for name in sorted(ip_z | mac_z | pair_z):
        wan = name.casefold() == "wan"
        out[name] = {
            "wan": wan,
            "ip_spoof": (name in ip_z) and not wan,
            "mac_filter": name in mac_z,
            "pair_filter": (name in pair_z) and not wan,
        }
    return out


def ips_switch_status_from_payload(data: dict[str, Any]) -> str | None:
    """Return 'enable', 'disable', or None if unknown."""
    if not isinstance(data, dict):
        return None
    s = _text_scalar(data.get("Status")).lower()
    if s in ("enable", "enabled", "on"):
        return "enable"
    if s in ("disable", "disabled", "off"):
        return "disable"
    return None


def build_ips_switch_table_payload(db: Session, firewall_ids: list[int]) -> dict[str, Any]:
    columns = [
        "__name",
        "__firewall_description",
        "__ips_status",
        "__dos_configure",
        "__spoof_configure",
    ]
    column_labels = {
        "__name": "Firewall",
        "__firewall_description": "Firewall description",
        "__ips_status": "IPS Status",
        "__dos_configure": "DoS protection",
        "__spoof_configure": "Spoof protection",
    }
    columns_visible_by_default = list(columns)
    if not firewall_ids:
        return {
            "columns": columns,
            "column_labels": column_labels,
            "columns_visible_by_default": columns_visible_by_default,
            "rows": [],
        }

    zone_names_by_fw = zone_names_for_firewalls(db, firewall_ids)

    fw_rows = (
        db.query(Firewall)
        .filter(Firewall.id.in_(firewall_ids))
        .order_by(Firewall.name.asc().nulls_last(), Firewall.host.asc())
        .all()
    )
    entries = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.firewall_id.in_(firewall_ids),
            FirewallConfigEntry.entity_type.in_(
                (ENTITY_IPS_SWITCH, ENTITY_DOS_SETTINGS, ENTITY_SPOOF_PREVENTION)
            ),
        )
        .all()
    )
    ips_by_fw: dict[int, FirewallConfigEntry] = {}
    dos_by_fw: dict[int, FirewallConfigEntry] = {}
    spoof_by_fw: dict[int, FirewallConfigEntry] = {}
    for e in entries:
        if e.entity_type == ENTITY_IPS_SWITCH:
            ips_by_fw[e.firewall_id] = e
        elif e.entity_type == ENTITY_DOS_SETTINGS:
            dos_by_fw[e.firewall_id] = e
        elif e.entity_type == ENTITY_SPOOF_PREVENTION:
            spoof_by_fw[e.firewall_id] = e

    rows: list[dict[str, Any]] = []
    for fw in fw_rows:
        ent = ips_by_fw.get(fw.id)
        ips_known = False
        ips_enabled = False
        status_cell = ""
        config_entry_id: int | None = None
        if ent:
            config_entry_id = ent.id
            try:
                data = json.loads(ent.payload_json)
            except json.JSONDecodeError:
                data = {}
            if not isinstance(data, dict):
                data = {}
            st = ips_switch_status_from_payload(data)
            if st is not None:
                ips_known = True
                ips_enabled = st == "enable"
                status_cell = "enable" if ips_enabled else "disable"
        display = (fw.name or "").strip() or (fw.host or "").strip() or str(fw.id)
        fw_desc = (fw.description or "").strip()
        search_parts = [display.lower()]
        if fw_desc:
            search_parts.append(fw_desc.lower())
        if status_cell:
            search_parts.append(status_cell)
            search_parts.append("on" if ips_enabled else "off")

        dos_settings: dict[str, Any] | None = None
        dos_settings_in_cache = False
        dos_ent = dos_by_fw.get(fw.id)
        if dos_ent is not None:
            dos_settings_in_cache = True
            try:
                raw_dos = json.loads(dos_ent.payload_json)
            except json.JSONDecodeError:
                raw_dos = {}
            dos_settings = raw_dos if isinstance(raw_dos, dict) else {}

        spoof_prevention_enabled = False
        spoof_prevention_in_cache = False
        spoof_zone_selection: dict[str, dict[str, Any]] = {}
        restrict_unknown_ip_on_trusted_mac = False
        sp_ent = spoof_by_fw.get(fw.id)
        if sp_ent is not None:
            spoof_prevention_in_cache = True
            try:
                sp_data = json.loads(sp_ent.payload_json)
            except json.JSONDecodeError:
                sp_data = {}
            if isinstance(sp_data, dict):
                se = spoof_prevention_enabled_from_payload(sp_data)
                if se is not None:
                    spoof_prevention_enabled = se
                restrict_unknown_ip_on_trusted_mac = restrict_unknown_ip_on_trusted_mac_from_payload(
                    sp_data
                )
                spoof_zone_selection = spoof_zone_selection_from_payload(sp_data)
                if spoof_prevention_enabled:
                    search_parts.append("spoof on")
                else:
                    search_parts.append("spoof off")

        rows.append(
            {
                "entity_type": ENTITY_IPS_SWITCH,
                "firewall_id": fw.id,
                "config_entry_id": config_entry_id,
                "ips_known": ips_known,
                "ips_enabled": ips_enabled,
                "dos_settings_in_cache": dos_settings_in_cache,
                "dos_settings": dos_settings,
                "spoof_prevention_in_cache": spoof_prevention_in_cache,
                "spoof_prevention_enabled": spoof_prevention_enabled,
                "restrict_unknown_ip_on_trusted_mac": restrict_unknown_ip_on_trusted_mac,
                "spoof_zone_selection": spoof_zone_selection,
                "spoof_flyout_zone_names": zone_names_by_fw.get(fw.id, []),
                "cells": {
                    "__name": display,
                    "__firewall_description": fw_desc,
                    "__ips_status": status_cell,
                    "__dos_configure": "",
                    "__spoof_configure": "",
                },
                "search": " ".join(search_parts),
            }
        )
    return {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": columns_visible_by_default,
        "rows": rows,
    }
