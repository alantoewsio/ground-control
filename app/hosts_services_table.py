"""Flatten host/service config cache rows into standard table + flyout payloads."""

from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy.orm import Session

from app.interface_table import (
    COL_ID_FIREWALL,
    COL_ID_FIREWALLS,
    COL_ID_NAME,
    _extra_column_label,
    _name_value,
    flatten_payload,
)
from app.models import ConfigurationConfigEntry, FirewallConfigEntry

_LEAF_HUMANIZE_ACRONYM = re.compile(r"([A-Z]{2,})([A-Z][a-z]+)")
_LEAF_HUMANIZE_WORD = re.compile(r"([a-z0-9])([A-Z])")

COL_ID_LOCK = "__lock"

# Multivalue cells for indexed JSON paths (joined in API; split in UI as pills). Must match gc-network-entity.js.
_HS_MULTIVALUE_SEP = "\x1e"


def _hs_logical_flat_key(key: str) -> str:
    """Strip numeric path segments so e.g. ServiceDetails.ServiceDetail.0.Protocol merges with .1.Protocol."""
    parts = key.split(".")
    logical = [p for p in parts if not p.isdigit()]
    return ".".join(logical)


def _hs_path_sort_tuple(key: str) -> tuple[Any, ...]:
    """Sort flattened keys so array index 2 orders before 10."""
    t: list[tuple[int, Any]] = []
    for p in key.split("."):
        if p.isdigit():
            t.append((0, int(p)))
        else:
            t.append((1, p.lower()))
    return tuple(t)


def _consolidate_hs_indexed_flat(flat: dict[str, str]) -> dict[str, str]:
    """
    Merge keys that differ only by list indices into one column per logical path.
    Multiple distinct values become one string with ``_HS_MULTIVALUE_SEP`` between them.
    """
    groups: dict[str, list[tuple[str, str]]] = {}
    for k, v in flat.items():
        lk = _hs_logical_flat_key(k)
        groups.setdefault(lk, []).append((k, v))
    out: dict[str, str] = {}
    for lk, pairs in groups.items():
        if len(pairs) == 1 and pairs[0][0] == lk:
            out[lk] = pairs[0][1]
            continue
        seen: set[str] = set()
        ordered: list[str] = []
        for _ok, val in sorted(pairs, key=lambda x: _hs_path_sort_tuple(x[0])):
            s = (val or "").strip()
            if not s or s in seen:
                continue
            seen.add(s)
            ordered.append(s)
        out[lk] = _HS_MULTIVALUE_SEP.join(ordered)
    return out


def _hs_use_indexed_path_consolidation(entity_type: str) -> bool:
    return entity_type in (
        "service",
        "service_group",
        "ip_hostgroup",
        "fqdn_hostgroup",
        "country_group",
    )


# Flattened logical keys for group member lists → table column header "Members"
_HS_GROUP_MEMBER_COL: dict[str, str] = {
    "ip_hostgroup": "HostList.Host",
    "fqdn_hostgroup": "FQDNHostList.FQDNHost",
    "service_group": "ServiceList.Service",
    "country_group": "CountryList.Country",
}


def _apply_hs_group_member_column_label(
    column_labels: dict[str, str], entity_type: str
) -> None:
    col_key = _HS_GROUP_MEMBER_COL.get(entity_type)
    if col_key:
        column_labels[col_key] = "Members"


def _hs_cell_search_fragment(cell: str) -> str:
    """Include every pill value in row search text."""
    if _HS_MULTIVALUE_SEP not in cell:
        return cell
    return cell.replace(_HS_MULTIVALUE_SEP, " ")


def list_ip_hostgroups_for_firewall(db: Session, firewall_id: int) -> list[dict[str, str]]:
    """Cached ``ip_hostgroup`` rows for one firewall: name + description (for flyout picker)."""
    if firewall_id <= 0:
        return []
    rows = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == "ip_hostgroup",
        )
        .all()
    )
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for ent in rows:
        try:
            data = json.loads(ent.payload_json)
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict):
            continue
        n = str(data.get("Name") or "").strip()
        if not n or n in seen:
            continue
        seen.add(n)
        d = str(data.get("Description") or "").strip()
        out.append({"name": n, "description": d})
    out.sort(key=lambda x: x["name"].lower())
    return out


def _dedupe_ids(raw_ids: list[int]) -> list[int]:
    seen: set[int] = set()
    out: list[int] = []
    for raw in raw_ids:
        try:
            n = int(raw)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        out.append(n)
    return out


def _aggregate_entity_for_firewalls(
    db: Session, firewall_ids: list[int], entity_type: str
) -> dict[str, Any]:
    """Batch-query aggregate: one SQL round-trip instead of one per firewall."""
    from app.db_utils import chunked_in_query

    ids = _dedupe_ids(firewall_ids)
    total = len(ids)
    if total == 0:
        return {"firewall_ids": [], "groups": []}

    rows = chunked_in_query(
        lambda chunk: (
            db.query(
                FirewallConfigEntry.firewall_id,
                FirewallConfigEntry.external_name,
                FirewallConfigEntry.payload_json,
            )
            .filter(
                FirewallConfigEntry.firewall_id.in_(chunk),
                FirewallConfigEntry.entity_type == entity_type,
            )
            .all()
        ),
        ids,
    )

    stats: dict[str, dict[str, Any]] = {}
    seen_per_fw: dict[int, set[str]] = {}
    for fid, ext_name, payload_json in rows:
        gn = str(ext_name or "").strip()
        if not gn:
            continue
        fw_set = seen_per_fw.setdefault(fid, set())
        if gn in fw_set:
            continue
        fw_set.add(gn)
        if gn not in stats:
            stats[gn] = {"present_count": 0, "description": ""}
        stats[gn]["present_count"] += 1
        if not stats[gn]["description"] and payload_json:
            try:
                data = json.loads(payload_json)
                if isinstance(data, dict):
                    d = str(data.get("Description") or "").strip()
                    if d:
                        stats[gn]["description"] = d
            except json.JSONDecodeError:
                pass

    groups: list[dict[str, Any]] = []
    for name in sorted(stats.keys(), key=lambda x: x.lower()):
        info = stats[name]
        pc = int(info["present_count"])
        groups.append(
            {
                "name": name,
                "description": str(info.get("description") or ""),
                "present_count": pc,
                "total_firewalls": total,
                "on_all_firewalls": pc == total,
            }
        )
    return {"firewall_ids": ids, "groups": groups}


def _aggregate_entity_for_configurations(
    db: Session, configuration_ids: list[int], entity_type: str
) -> dict[str, Any]:
    """Batch-query aggregate: one SQL round-trip instead of one per configuration."""
    from app.db_utils import chunked_in_query

    ids = _dedupe_ids(configuration_ids)
    total = len(ids)
    if total == 0:
        return {"configuration_ids": [], "groups": []}

    rows = chunked_in_query(
        lambda chunk: (
            db.query(
                ConfigurationConfigEntry.configuration_id,
                ConfigurationConfigEntry.external_name,
                ConfigurationConfigEntry.payload_json,
            )
            .filter(
                ConfigurationConfigEntry.configuration_id.in_(chunk),
                ConfigurationConfigEntry.entity_type == entity_type,
            )
            .all()
        ),
        ids,
    )

    stats: dict[str, dict[str, Any]] = {}
    seen_per_cfg: dict[int, set[str]] = {}
    for cid, ext_name, payload_json in rows:
        gn = str(ext_name or "").strip()
        if not gn:
            continue
        cfg_set = seen_per_cfg.setdefault(cid, set())
        if gn in cfg_set:
            continue
        cfg_set.add(gn)
        if gn not in stats:
            stats[gn] = {"present_count": 0, "description": ""}
        stats[gn]["present_count"] += 1
        if not stats[gn]["description"] and payload_json:
            try:
                data = json.loads(payload_json)
                if isinstance(data, dict):
                    d = str(data.get("Description") or "").strip()
                    if d:
                        stats[gn]["description"] = d
            except json.JSONDecodeError:
                pass

    groups: list[dict[str, Any]] = []
    for name in sorted(stats.keys(), key=lambda x: x.lower()):
        info = stats[name]
        pc = int(info["present_count"])
        groups.append(
            {
                "name": name,
                "description": str(info.get("description") or ""),
                "present_count": pc,
                "total_firewalls": total,
                "on_all_firewalls": pc == total,
            }
        )
    return {"configuration_ids": ids, "groups": groups}


def aggregate_ip_hostgroups_for_firewalls(
    db: Session, firewall_ids: list[int]
) -> dict[str, Any]:
    """
    Union of cached IP host group names across firewalls, with counts for multi-firewall add UI.

    Each group includes ``on_all_firewalls`` when ``present_count == total_firewalls``.
    """
    return _aggregate_entity_for_firewalls(db, firewall_ids, "ip_hostgroup")


def _hosts_exclude_from_extras(key: str) -> bool:
    """Name is promoted to the primary __name column."""
    return key == "Name"


def _hs_ordered_extras_for_entity(entity_type: str, extras: list[str]) -> list[str]:
    """
    Alphabetical extras put CountryList.Country before Description (C < D), unlike other
    group tabs where Description sorts before HostList / ServiceList. Match that pattern
    so Description stays left of Members for country groups.
    """
    if entity_type != "country_group" or not extras:
        return extras
    desc = "Description"
    mem = "CountryList.Country"
    prioritized: list[str] = []
    seen: set[str] = set()
    if desc in extras:
        prioritized.append(desc)
        seen.add(desc)
    if mem in extras:
        prioritized.append(mem)
        seen.add(mem)
    rest = [k for k in extras if k not in seen]
    return prioritized + rest


def _ip_host_combine_group_key(
    flat: dict[str, str],
    external_name: str,
) -> tuple[str, str]:
    """Combined-mode row identity: display name plus host type (Sophos HostType)."""
    name_val, _ = _name_value(flat, external_name)
    hname = (name_val or external_name or "").strip()
    if not hname:
        hname = "—"
    ht = (flat.get("HostType") or "").strip()
    if not ht:
        ht = "—"
    return (hname, ht)


def _humanize_camel_segment(segment: str) -> str:
    """e.g. DestinationPort -> Destination Port, ICMPType -> ICMP Type."""
    s = _LEAF_HUMANIZE_ACRONYM.sub(r"\1 \2", segment)
    s = _LEAF_HUMANIZE_WORD.sub(r"\1 \2", s)
    return s


def _service_table_column_label(key: str) -> str:
    """Services table: dotted flatten keys -> short title case (last JSON field)."""
    if "." not in key:
        return _extra_column_label(key)
    parts = key.split(".")
    leaf = parts[-1]
    if leaf.isdigit():
        tail = [p for p in parts if not p.isdigit()]
        leaf = tail[-1] if tail else leaf
    return _humanize_camel_segment(leaf)


def _hs_combine_group_key(
    entity_type: str,
    flat: dict[str, str],
    external_name: str,
) -> tuple[Any, ...]:
    """Stable identity for combined rows (name + type discriminator when needed)."""
    name_val, _ = _name_value(flat, external_name)
    hname = (name_val or external_name or "").strip()
    if not hname:
        hname = "—"
    et = entity_type
    if et == "service":
        st = (flat.get("Type") or "").strip() or "—"
        return (hname, st)
    if et == "mac_host":
        mt = (flat.get("Type") or "").strip() or "—"
        return (hname, mt)
    if et == "fqdn_host":
        fq = (flat.get("FQDN") or "").strip() or "—"
        return (hname, fq)
    return (hname,)


def build_hosts_services_table_rows(
    parsed: list[tuple[Any, Any, dict[str, Any]]],
    *,
    entity_type: str,
) -> dict[str, Any]:
    """
    One row per FirewallConfigEntry: Name, Firewall, then dynamic columns from JSON.
    """
    flat_per_row: list[dict[str, str]] = []
    for _ent, _fw, data in parsed:
        flat = flatten_payload(data)
        flat_per_row.append(flat)

    merge_indexed = _hs_use_indexed_path_consolidation(entity_type)
    display_flats = (
        [_consolidate_hs_indexed_flat(f) for f in flat_per_row]
        if merge_indexed
        else flat_per_row
    )

    key_union: set[str] = set()
    for f in display_flats:
        key_union.update(f.keys())
    extras = sorted(k for k in key_union if not _hosts_exclude_from_extras(k))
    extras = _hs_ordered_extras_for_entity(entity_type, extras)
    columns = [COL_ID_NAME, COL_ID_FIREWALL, *extras]
    if entity_type == "ip_host":
        columns = [COL_ID_LOCK, COL_ID_NAME, COL_ID_FIREWALL, *extras]

    column_labels: dict[str, str] = {
        COL_ID_NAME: "Name",
        COL_ID_FIREWALL: "Firewall",
    }
    _label_extra = (
        _service_table_column_label
        if entity_type in ("service", "service_group")
        else _extra_column_label
    )
    for k in extras:
        column_labels[k] = _label_extra(k)

    _apply_hs_group_member_column_label(column_labels, entity_type)

    if entity_type == "ip_host":
        column_labels[COL_ID_LOCK] = ""

    default_visible = [COL_ID_NAME, COL_ID_FIREWALL]
    for k in extras[:6]:
        if k not in default_visible:
            default_visible.append(k)
    if entity_type == "ip_host":
        default_visible = [COL_ID_LOCK, COL_ID_NAME, COL_ID_FIREWALL] + [
            k for k in default_visible if k not in (COL_ID_LOCK, COL_ID_NAME, COL_ID_FIREWALL)
        ]

    out_rows: list[dict[str, Any]] = []
    for (ent, fw, _data), flat, disp_flat in zip(
        parsed, flat_per_row, display_flats, strict=True
    ):
        fw_label = fw.name or fw.host or str(fw.id)
        name_val, _ = _name_value(flat, ent.external_name)
        display_name = (name_val or ent.external_name or "").strip() or "—"

        cells: dict[str, str] = {
            COL_ID_NAME: display_name,
            COL_ID_FIREWALL: fw_label,
        }
        for k in extras:
            cells[k] = disp_flat.get(k, "")

        is_system_host = (flat.get("HostType") or "").strip() == "System Host"
        if entity_type == "ip_host":
            cells[COL_ID_LOCK] = ""

        search_parts = [
            fw_label.lower(),
            ent.external_name.lower(),
            display_name.lower(),
            entity_type.lower(),
        ]
        for k in columns:
            search_parts.append(_hs_cell_search_fragment(cells.get(k, "")).lower())
        tgt = {
            "firewall_id": fw.id,
            "config_entry_id": ent.id,
            "firewall_label": fw_label,
        }
        row_obj: dict[str, Any] = {
            "cells": cells,
            "search": " ".join(search_parts),
            "flat": flat,
            "firewall_id": fw.id,
            "config_entry_id": ent.id,
            "entity_type": entity_type,
            "external_name": ent.external_name,
            "hs_edit_targets": [tgt],
        }
        if entity_type == "ip_host":
            row_obj["system_host"] = is_system_host
            row_obj["ip_host_edit_targets"] = [tgt]
        out_rows.append(row_obj)

    meta: dict[str, Any] = {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": default_visible,
        "rows": out_rows,
        "hs_combined": False,
        "hs_combine_conflicts": False,
    }
    if entity_type == "ip_host":
        meta["ip_hosts_combine_conflicts"] = False
        meta["ip_hosts_combined"] = False
    return meta


def build_ip_host_table_rows_combined(
    parsed: list[tuple[Any, Any, dict[str, Any]]],
) -> dict[str, Any]:
    """
    IP hosts: one row per unique (name, HostType) across firewalls (Name + Firewalls + extras).
    When the same field differs by firewall within that group, the row is flagged for the modal.
    """
    flat_per_row: list[dict[str, str]] = []
    for _ent, _fw, data in parsed:
        flat = flatten_payload(data)
        flat_per_row.append(flat)

    groups: dict[tuple[str, str], dict[str, Any]] = {}
    order_keys: list[tuple[str, str]] = []

    for (ent, fw, _data), flat in zip(parsed, flat_per_row, strict=True):
        gkey = _ip_host_combine_group_key(flat, ent.external_name)
        fw_label = fw.name or fw.host or str(fw.id)
        is_system = (flat.get("HostType") or "").strip() == "System Host"
        if gkey not in groups:
            groups[gkey] = {
                "fws_ordered": [],
                "fw_seen": set(),
                "sources": [],
                "rep_ent": ent,
                "rep_fw": fw,
                "rep_flat": flat,
            }
            order_keys.append(gkey)
        g = groups[gkey]
        g["sources"].append(
            {
                "firewall": fw_label,
                "flat": flat,
                "ent": ent,
                "fw": fw,
                "is_system": is_system,
            }
        )
        if fw_label not in g["fw_seen"]:
            g["fw_seen"].add(fw_label)
            g["fws_ordered"].append(fw_label)

    key_union: set[str] = set()
    for g in groups.values():
        for src in g["sources"]:
            key_union.update(src["flat"].keys())
    extras = sorted(k for k in key_union if not _hosts_exclude_from_extras(k))
    columns = [COL_ID_LOCK, COL_ID_NAME, COL_ID_FIREWALLS, *extras]

    column_labels: dict[str, str] = {
        COL_ID_NAME: "Name",
        COL_ID_FIREWALLS: "Firewalls",
        COL_ID_LOCK: "",
    }
    for k in extras:
        column_labels[k] = _extra_column_label(k)

    default_visible = [COL_ID_LOCK, COL_ID_NAME, COL_ID_FIREWALLS] + [
        k for k in extras[:6] if k not in (COL_ID_LOCK, COL_ID_NAME, COL_ID_FIREWALLS)
    ]

    out_rows: list[dict[str, Any]] = []
    for gkey in order_keys:
        g = groups[gkey]
        hname = gkey[0]
        rep_flat = g["rep_flat"]
        ent = g["rep_ent"]
        fw = g["rep_fw"]
        fws = g["fws_ordered"]
        sources = g["sources"]

        cells: dict[str, str] = {
            COL_ID_NAME: hname,
            COL_ID_FIREWALLS: " · ".join(fws),
        }
        per_field: dict[str, dict[str, str]] = {}
        for k in extras:
            per_fw: dict[str, str] = {}
            norms: set[str] = set()
            for src in sources:
                fw_n = src["firewall"]
                v = src["flat"].get(k, "")
                per_fw[fw_n] = v
                norms.add(v.strip())
            if len(norms) > 1:
                per_field[k] = per_fw

        for k in extras:
            cells[k] = rep_flat.get(k, "")

        all_system = all(s["is_system"] for s in sources)
        cells[COL_ID_LOCK] = ""

        search_parts = [hname.lower(), " ".join(x.lower() for x in fws)]
        for k in columns:
            search_parts.append(cells.get(k, "").lower())
        targets = [
            {
                "firewall_id": src["fw"].id,
                "config_entry_id": src["ent"].id,
                "firewall_label": src["firewall"],
            }
            for src in sources
        ]
        row_obj: dict[str, Any] = {
            "cells": cells,
            "search": " ".join(search_parts),
            "flat": rep_flat,
            "firewall_labels": fws,
            "firewall_id": fw.id,
            "config_entry_id": ent.id,
            "entity_type": "ip_host",
            "external_name": ent.external_name,
            "system_host": all_system,
            "ip_host_combine_conflict": bool(per_field),
            "hs_combine_conflict": bool(per_field),
            "hs_edit_targets": targets,
            "ip_host_edit_targets": targets,
        }
        if per_field:
            row_obj["ip_host_combine_per_field"] = per_field
            row_obj["hs_combine_per_field"] = per_field
        out_rows.append(row_obj)

    combine_conflicts = any(bool(r.get("ip_host_combine_conflict")) for r in out_rows)

    return {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": default_visible,
        "rows": out_rows,
        "ip_hosts_combine_conflicts": combine_conflicts,
        "ip_hosts_combined": True,
        "hs_combine_conflicts": combine_conflicts,
        "hs_combined": True,
    }


def build_hs_table_rows_combined(
    parsed: list[tuple[Any, Any, dict[str, Any]]],
    *,
    entity_type: str,
) -> dict[str, Any]:
    """
    Combined view for non-IP-host entities: one row per merge key across firewalls.
    """
    flat_per_row: list[dict[str, str]] = []
    for _ent, _fw, data in parsed:
        flat = flatten_payload(data)
        flat_per_row.append(flat)

    groups: dict[tuple[Any, ...], dict[str, Any]] = {}
    order_keys: list[tuple[Any, ...]] = []

    for (ent, fw, _data), flat in zip(parsed, flat_per_row, strict=True):
        gkey = _hs_combine_group_key(entity_type, flat, ent.external_name)
        fw_label = fw.name or fw.host or str(fw.id)
        if gkey not in groups:
            groups[gkey] = {
                "fws_ordered": [],
                "fw_seen": set(),
                "sources": [],
                "rep_ent": ent,
                "rep_fw": fw,
                "rep_flat": flat,
            }
            order_keys.append(gkey)
        g = groups[gkey]
        g["sources"].append(
            {
                "firewall": fw_label,
                "flat": flat,
                "ent": ent,
                "fw": fw,
            }
        )
        if fw_label not in g["fw_seen"]:
            g["fw_seen"].add(fw_label)
            g["fws_ordered"].append(fw_label)

    merge_indexed = _hs_use_indexed_path_consolidation(entity_type)
    key_union: set[str] = set()
    for g in groups.values():
        for src in g["sources"]:
            f = src["flat"]
            disp = _consolidate_hs_indexed_flat(f) if merge_indexed else f
            key_union.update(disp.keys())
    extras = sorted(k for k in key_union if not _hosts_exclude_from_extras(k))
    extras = _hs_ordered_extras_for_entity(entity_type, extras)
    columns = [COL_ID_NAME, COL_ID_FIREWALLS, *extras]

    column_labels: dict[str, str] = {
        COL_ID_NAME: "Name",
        COL_ID_FIREWALLS: "Firewalls",
    }
    _label_extra = (
        _service_table_column_label
        if entity_type in ("service", "service_group")
        else _extra_column_label
    )
    for k in extras:
        column_labels[k] = _label_extra(k)

    _apply_hs_group_member_column_label(column_labels, entity_type)

    default_visible = [COL_ID_NAME, COL_ID_FIREWALLS] + [
        k for k in extras[:6] if k not in (COL_ID_NAME, COL_ID_FIREWALLS)
    ]

    out_rows: list[dict[str, Any]] = []
    for gkey in order_keys:
        g = groups[gkey]
        hname = gkey[0]
        rep_flat = g["rep_flat"]
        ent = g["rep_ent"]
        fw = g["rep_fw"]
        fws = g["fws_ordered"]
        sources = g["sources"]

        cells: dict[str, str] = {
            COL_ID_NAME: hname,
            COL_ID_FIREWALLS: " · ".join(fws),
        }
        per_field: dict[str, dict[str, str]] = {}
        for k in extras:
            per_fw: dict[str, str] = {}
            norms: set[str] = set()
            for src in sources:
                fw_n = src["firewall"]
                f = src["flat"]
                disp = _consolidate_hs_indexed_flat(f) if merge_indexed else f
                v = disp.get(k, "")
                per_fw[fw_n] = v
                norms.add(v.strip())
            if len(norms) > 1:
                per_field[k] = per_fw

        rep_disp = _consolidate_hs_indexed_flat(rep_flat) if merge_indexed else rep_flat
        for k in extras:
            cells[k] = rep_disp.get(k, "")

        search_parts = [hname.lower(), " ".join(x.lower() for x in fws)]
        for k in columns:
            search_parts.append(_hs_cell_search_fragment(cells.get(k, "")).lower())
        targets = [
            {
                "firewall_id": src["fw"].id,
                "config_entry_id": src["ent"].id,
                "firewall_label": src["firewall"],
            }
            for src in sources
        ]
        row_obj: dict[str, Any] = {
            "cells": cells,
            "search": " ".join(search_parts),
            "flat": rep_flat,
            "firewall_labels": fws,
            "firewall_id": fw.id,
            "config_entry_id": ent.id,
            "entity_type": entity_type,
            "external_name": ent.external_name,
            "hs_edit_targets": targets,
            "hs_combine_conflict": bool(per_field),
        }
        if per_field:
            row_obj["hs_combine_per_field"] = per_field
        out_rows.append(row_obj)

    combine_conflicts = any(bool(r.get("hs_combine_conflict")) for r in out_rows)

    return {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": default_visible,
        "rows": out_rows,
        "hs_combined": True,
        "hs_combine_conflicts": combine_conflicts,
    }


def _list_names_from_entries(
    db: Session, firewall_id: int, entity_type: str
) -> list[dict[str, str]]:
    if firewall_id <= 0:
        return []
    rows = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == entity_type,
        )
        .all()
    )
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for ent in rows:
        try:
            data = json.loads(ent.payload_json)
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict):
            continue
        n = str(data.get("Name") or "").strip()
        if not n or n in seen:
            continue
        seen.add(n)
        d = str(data.get("Description") or "").strip()
        out.append({"name": n, "description": d})
    out.sort(key=lambda x: x["name"].lower())
    return out


def list_fqdn_hostgroups_for_firewall(db: Session, firewall_id: int) -> list[dict[str, str]]:
    return _list_names_from_entries(db, firewall_id, "fqdn_hostgroup")


def list_ip_hosts_for_firewall(db: Session, firewall_id: int) -> list[dict[str, str]]:
    return _list_names_from_entries(db, firewall_id, "ip_host")


def list_fqdn_hosts_for_firewall(db: Session, firewall_id: int) -> list[dict[str, str]]:
    return _list_names_from_entries(db, firewall_id, "fqdn_host")


def list_mac_hosts_for_firewall(db: Session, firewall_id: int) -> list[dict[str, str]]:
    return _list_names_from_entries(db, firewall_id, "mac_host")


def list_services_for_firewall(db: Session, firewall_id: int) -> list[dict[str, str]]:
    return _list_names_from_entries(db, firewall_id, "service")


def aggregate_named_entities_for_firewalls(
    db: Session, firewall_ids: list[int], entity_type: str
) -> dict[str, Any]:
    """Union of cached object names across firewalls (same shape as IP host group aggregate)."""
    return _aggregate_entity_for_firewalls(db, firewall_ids, entity_type)


def _list_names_from_configuration_entries(
    db: Session, configuration_id: int, entity_type: str
) -> list[dict[str, str]]:
    if configuration_id <= 0:
        return []
    rows = (
        db.query(ConfigurationConfigEntry)
        .filter(
            ConfigurationConfigEntry.configuration_id == configuration_id,
            ConfigurationConfigEntry.entity_type == entity_type,
        )
        .all()
    )
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for ent in rows:
        try:
            data = json.loads(ent.payload_json)
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict):
            continue
        n = str(data.get("Name") or "").strip()
        if not n or n in seen:
            continue
        seen.add(n)
        d = str(data.get("Description") or "").strip()
        out.append({"name": n, "description": d})
    out.sort(key=lambda x: x["name"].lower())
    return out


def list_ip_hostgroups_for_configuration(
    db: Session, configuration_id: int
) -> list[dict[str, str]]:
    return _list_names_from_configuration_entries(
        db, configuration_id, "ip_hostgroup"
    )


def list_fqdn_hostgroups_for_configuration(
    db: Session, configuration_id: int
) -> list[dict[str, str]]:
    return _list_names_from_configuration_entries(
        db, configuration_id, "fqdn_hostgroup"
    )


def aggregate_ip_hostgroups_for_configurations(
    db: Session, configuration_ids: list[int]
) -> dict[str, Any]:
    return _aggregate_entity_for_configurations(db, configuration_ids, "ip_hostgroup")


def aggregate_named_entities_for_configurations(
    db: Session, configuration_ids: list[int], entity_type: str
) -> dict[str, Any]:
    return _aggregate_entity_for_configurations(db, configuration_ids, entity_type)
