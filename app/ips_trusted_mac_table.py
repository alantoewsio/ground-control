"""Trusted MAC rows for Firewalls · Intrusion Prevention."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from app.firewall_config_sync import ENTITY_TRUSTED_MAC
from app.models import Firewall, FirewallConfigEntry

COL_FIREWALLS = "__firewalls"


def _text_scalar(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, dict):
        raw = raw.get("#text") if "#text" in raw else raw.get("text")
    return str(raw).strip()


def _scalar_from_payload(data: dict[str, Any], key: str) -> str:
    return _text_scalar(data.get(key))


def _addr_preview(s: str, max_len: int = 48) -> str:
    t = (s or "").strip()
    if len(t) <= max_len:
        return t
    return t[: max_len - 1] + "…"


def _trusted_mac_combine_key(mac_display: str, external_name: str) -> str:
    """Stable merge key: hex-only uppercase MAC, else stripped display / external name."""
    raw = (mac_display or "").strip() or (external_name or "").strip()
    hex_only = re.sub(r"[^0-9a-fA-F]", "", raw).upper()
    if len(hex_only) >= 6:
        return hex_only
    return raw.lower() if raw else "—"


def _ips_tmac_rows_flat(
    rows_db: list[tuple[FirewallConfigEntry, Firewall]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for ent, fw in rows_db:
        try:
            data = json.loads(ent.payload_json)
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        mac = _scalar_from_payload(data, "MACAddress") or ent.external_name
        v4a = _scalar_from_payload(data, "IPV4Association") or "None"
        v4addr = _scalar_from_payload(data, "IPV4Address")
        v6a = _scalar_from_payload(data, "IPV6Association") or "None"
        v6addr = _scalar_from_payload(data, "IPV6Address")
        fw_label = (fw.name or "").strip() or (fw.host or "").strip() or str(fw.id)
        v4pv = _addr_preview(v4addr)
        v6pv = _addr_preview(v6addr)
        search = " ".join(
            [
                mac.lower(),
                v4a.lower(),
                v4addr.lower(),
                v6a.lower(),
                v6addr.lower(),
                fw_label.lower(),
                (fw.host or "").lower(),
            ]
        )
        rows.append(
            {
                "entity_type": ENTITY_TRUSTED_MAC,
                "firewall_id": fw.id,
                "firewall_label": fw_label,
                "config_entry_id": ent.id,
                "trusted_mac": data,
                "cells": {
                    "__name": mac,
                    "__ipv4_assoc": v4a,
                    "__ipv4_addr": v4pv,
                    "__ipv6_assoc": v6a,
                    "__ipv6_addr": v6pv,
                    "__firewall": fw_label,
                },
                "search": search,
            }
        )
    return rows


def _ips_tmac_rows_combined(
    rows_db: list[tuple[FirewallConfigEntry, Firewall]],
) -> list[dict[str, Any]]:
    groups: dict[str, list[Any]] = defaultdict(list)
    order_keys: list[str] = []

    for ent, fw in rows_db:
        try:
            data = json.loads(ent.payload_json)
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        mac = _scalar_from_payload(data, "MACAddress") or ent.external_name
        gkey = _trusted_mac_combine_key(mac, ent.external_name or "")
        if gkey not in groups:
            order_keys.append(gkey)
        groups[gkey].append((ent, fw, data, mac))

    out_rows: list[dict[str, Any]] = []
    for gkey in order_keys:
        sources = groups[gkey]
        fws_ordered: list[str] = []
        fw_seen: set[str] = set()
        for _ent, _fw, _data, _mac in sources:
            fw_label = (
                (_fw.name or "").strip() or (_fw.host or "").strip() or str(_fw.id)
            )
            if fw_label not in fw_seen:
                fw_seen.add(fw_label)
                fws_ordered.append(fw_label)

        v4a_by_fw: dict[str, str] = {}
        v4addr_by_fw: dict[str, str] = {}
        v6a_by_fw: dict[str, str] = {}
        v6addr_by_fw: dict[str, str] = {}
        for ent, fw, data, mac in sources:
            fw_label = (fw.name or "").strip() or (fw.host or "").strip() or str(fw.id)
            v4a_by_fw[fw_label] = _scalar_from_payload(data, "IPV4Association") or "None"
            v4addr_by_fw[fw_label] = _scalar_from_payload(data, "IPV4Address")
            v6a_by_fw[fw_label] = _scalar_from_payload(data, "IPV6Association") or "None"
            v6addr_by_fw[fw_label] = _scalar_from_payload(data, "IPV6Address")

        per_field: dict[str, dict[str, str]] = {}
        if len({v for v in v4a_by_fw.values()}) > 1:
            per_field["__ipv4_assoc"] = dict(v4a_by_fw)
        if len({v for v in v4addr_by_fw.values()}) > 1:
            per_field["__ipv4_addr"] = dict(v4addr_by_fw)
        if len({v for v in v6a_by_fw.values()}) > 1:
            per_field["__ipv6_assoc"] = dict(v6a_by_fw)
        if len({v for v in v6addr_by_fw.values()}) > 1:
            per_field["__ipv6_addr"] = dict(v6addr_by_fw)

        combine_conflict = bool(per_field)
        rep_ent, rep_fw, rep_data, rep_mac = sources[0]
        rep_fw_label = (rep_fw.name or "").strip() or (rep_fw.host or "").strip() or str(
            rep_fw.id
        )
        v4a = _scalar_from_payload(rep_data, "IPV4Association") or "None"
        v4addr = _scalar_from_payload(rep_data, "IPV4Address")
        v6a = _scalar_from_payload(rep_data, "IPV6Association") or "None"
        v6addr = _scalar_from_payload(rep_data, "IPV6Address")

        cells: dict[str, str] = {
            "__name": rep_mac,
            "__ipv4_assoc": v4a,
            "__ipv4_addr": _addr_preview(v4addr),
            "__ipv6_assoc": v6a,
            "__ipv6_addr": _addr_preview(v6addr),
            COL_FIREWALLS: " · ".join(fws_ordered),
        }

        fw_ids_merged: list[int] = []
        fw_id_seen: set[int] = set()
        edit_targets: list[dict[str, Any]] = []
        for ent, fw, data, mac in sources:
            fw_label = (fw.name or "").strip() or (fw.host or "").strip() or str(fw.id)
            edit_targets.append(
                {
                    "config_entry_id": ent.id,
                    "firewall_id": fw.id,
                    "firewall_label": fw_label,
                }
            )
            if fw.id > 0 and fw.id not in fw_id_seen:
                fw_id_seen.add(fw.id)
                fw_ids_merged.append(fw.id)

        search = " ".join(
            [
                rep_mac.lower(),
                v4a.lower(),
                v4addr.lower(),
                v6a.lower(),
                v6addr.lower(),
                " ".join(x.lower() for x in fws_ordered),
                (rep_fw.host or "").lower(),
            ]
        )
        row_obj: dict[str, Any] = {
            "entity_type": ENTITY_TRUSTED_MAC,
            "firewall_id": rep_fw.id,
            "firewall_ids": fw_ids_merged,
            "firewall_label": rep_fw_label,
            "firewall_labels": list(fws_ordered),
            "config_entry_id": rep_ent.id,
            "ips_trusted_mac_edit_targets": edit_targets,
            "trusted_mac": rep_data,
            "cells": cells,
            "search": search,
            "ips_trusted_mac_combine_conflict": combine_conflict,
        }
        if combine_conflict:
            row_obj["ips_trusted_mac_combine_per_field"] = per_field
        out_rows.append(row_obj)

    return out_rows


def build_ips_trusted_mac_table_payload(
    db: Session, firewall_ids: list[int], *, combine: bool = True
) -> dict[str, Any]:
    columns_flat = [
        "__name",
        "__ipv4_assoc",
        "__ipv4_addr",
        "__ipv6_assoc",
        "__ipv6_addr",
        "__firewall",
    ]
    column_labels = {
        "__name": "MAC address",
        "__ipv4_assoc": "IPv4 association",
        "__ipv4_addr": "IPv4 address",
        "__ipv6_assoc": "IPv6 association",
        "__ipv6_addr": "IPv6 address",
        "__firewall": "Firewall",
        COL_FIREWALLS: "Firewalls",
    }
    columns_visible_flat = list(columns_flat)
    columns_combined = [
        "__name",
        "__ipv4_assoc",
        "__ipv4_addr",
        "__ipv6_assoc",
        "__ipv6_addr",
        COL_FIREWALLS,
    ]
    columns_visible_combined = list(columns_combined)

    meta_false = {
        "ips_trusted_mac_combined": False,
        "ips_trusted_mac_combine_conflicts": False,
    }
    meta_true = {
        "ips_trusted_mac_combined": True,
        "ips_trusted_mac_combine_conflicts": False,
    }

    if not firewall_ids:
        if combine:
            return {
                "columns": columns_combined,
                "column_labels": column_labels,
                "columns_visible_by_default": columns_visible_combined,
                "rows": [],
                **meta_true,
            }
        return {
            "columns": columns_flat,
            "column_labels": column_labels,
            "columns_visible_by_default": columns_visible_flat,
            "rows": [],
            **meta_false,
        }

    rows_db = (
        db.query(FirewallConfigEntry, Firewall)
        .join(Firewall, Firewall.id == FirewallConfigEntry.firewall_id)
        .filter(
            FirewallConfigEntry.entity_type == ENTITY_TRUSTED_MAC,
            FirewallConfigEntry.firewall_id.in_(firewall_ids),
        )
        .order_by(
            Firewall.name.asc().nulls_last(),
            Firewall.host.asc(),
            FirewallConfigEntry.external_name.asc(),
        )
        .all()
    )

    if not combine:
        rows = _ips_tmac_rows_flat(rows_db)
        return {
            "columns": columns_flat,
            "column_labels": column_labels,
            "columns_visible_by_default": columns_visible_flat,
            "rows": rows,
            **meta_false,
        }

    rows_c = _ips_tmac_rows_combined(rows_db)
    conflicts = any(bool(r.get("ips_trusted_mac_combine_conflict")) for r in rows_c)
    return {
        "columns": columns_combined,
        "column_labels": column_labels,
        "columns_visible_by_default": columns_visible_combined,
        "rows": rows_c,
        "ips_trusted_mac_combined": True,
        "ips_trusted_mac_combine_conflicts": conflicts,
    }
