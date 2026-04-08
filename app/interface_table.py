"""Build network interfaces table: flatten JSON payloads and derived primary columns."""

from __future__ import annotations

import copy
import json
import re
from collections import defaultdict
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.firewall_config_sync import ENTITY_ZONE
from app.models import Firewall, FirewallConfigEntry

# Logical column ids (Type, Name, Zone, Status, Address, Hardware, Auto-negotiation, Firewall)
COL_ID_TYPE = "__type"
COL_ID_NAME = "__name"
COL_ID_ZONE = "__zone"
COL_ID_STATUS = "__status"
COL_ID_ADDRESS = "__address_cidr"
COL_ID_HARDWARE = "__hardware"
COL_ID_AUTO_NEGOTIATION = "__auto_negotiation"
COL_ID_FIREWALL = "firewall"
COL_ID_FIREWALLS = "__firewalls"

PRIMARY_ORDER = [
    COL_ID_NAME,
    COL_ID_ZONE,
    COL_ID_STATUS,
    COL_ID_ADDRESS,
    COL_ID_HARDWARE,
    COL_ID_AUTO_NEGOTIATION,
    COL_ID_FIREWALL,
]

UNIFIED_PRIMARY_ORDER = [
    COL_ID_TYPE,
    COL_ID_NAME,
    COL_ID_ZONE,
    COL_ID_STATUS,
    COL_ID_ADDRESS,
    COL_ID_HARDWARE,
    COL_ID_AUTO_NEGOTIATION,
    COL_ID_FIREWALLS,
]

ENTITY_TYPE_DISPLAY: dict[str, str] = {
    "interface": "Interface",
    "vlan": "VLAN",
    "bridge_pair": "Bridge pair",
    "lag": "LAG",
    "alias": "Alias",
}

COLUMN_LABELS: dict[str, str] = {
    COL_ID_TYPE: "Type",
    COL_ID_NAME: "Name",
    COL_ID_ZONE: "Zone",
    COL_ID_STATUS: "Status",
    COL_ID_ADDRESS: "Address (CIDR)",
    COL_ID_HARDWARE: "Hardware",
    COL_ID_AUTO_NEGOTIATION: "Auto-negotiation",
    COL_ID_FIREWALL: "Firewall",
    COL_ID_FIREWALLS: "Firewalls",
}

DEFAULT_VISIBLE_IDS = [
    COL_ID_NAME,
    COL_ID_ZONE,
    COL_ID_STATUS,
    COL_ID_ADDRESS,
    COL_ID_HARDWARE,
    COL_ID_AUTO_NEGOTIATION,
    COL_ID_FIREWALL,
]

UNIFIED_DEFAULT_VISIBLE_IDS = [
    COL_ID_TYPE,
    COL_ID_NAME,
    COL_ID_ZONE,
    COL_ID_STATUS,
    COL_ID_ADDRESS,
    COL_ID_HARDWARE,
    COL_ID_AUTO_NEGOTIATION,
    COL_ID_FIREWALLS,
]

UNIFIED_COMBINED_DEFAULT_VISIBLE_IDS = [
    COL_ID_TYPE,
    COL_ID_NAME,
    COL_ID_ZONE,
    COL_ID_STATUS,
    COL_ID_ADDRESS,
    COL_ID_HARDWARE,
    COL_ID_AUTO_NEGOTIATION,
    COL_ID_FIREWALLS,
]


def _unified_bundle_compare_value(bundle: dict[str, Any], col: str) -> str:
    """Use table ``cells`` for primary columns; fall back to ``flat`` for extras-only keys."""
    cells = bundle.get("cells") or {}
    if col in cells:
        v = cells.get(col)
        return "" if v is None else str(v).strip()
    flat = bundle.get("flat") or {}
    fv = flat.get(col)
    return "" if fv is None else str(fv).strip()


def _skip_key(k: str) -> bool:
    return not isinstance(k, str) or k.startswith("@")


def _leaf_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        return str(value)
    return json.dumps(value, separators=(",", ":"), default=str)


def flatten_payload(obj: Any, prefix: str = "", out: dict[str, str] | None = None) -> dict[str, str]:
    """Nested dicts/lists become dot-indexed paths; @ keys skipped at every level."""
    if out is None:
        out = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            if _skip_key(k):
                continue
            path = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                flatten_payload(v, path, out)
            elif isinstance(v, list):
                if not v:
                    continue
                if all(not isinstance(x, (dict, list)) for x in v):
                    out[path] = ",".join(_leaf_str(x) for x in v)
                else:
                    for i, item in enumerate(v):
                        ip = f"{path}.{i}"
                        if isinstance(item, dict):
                            flatten_payload(item, ip, out)
                        elif isinstance(item, list):
                            flatten_payload(item, ip, out)
                        else:
                            out[ip] = _leaf_str(item)
            else:
                out[path] = _leaf_str(v)
    elif isinstance(obj, list) and prefix:
        flatten_payload({"_": obj}, prefix, out)
    return out


def _netmask_bits(netmask: str) -> int | None:
    netmask = netmask.strip()
    parts = netmask.split(".")
    if len(parts) != 4:
        return None
    try:
        octets = [int(p) for p in parts]
    except ValueError:
        return None
    if any(o < 0 or o > 255 for o in octets):
        return None
    bits = "".join(f"{o:08b}" for o in octets)
    if "01" in bits:
        return None
    return bits.count("1")


def _ipv4_with_cidr(ip: str, netmask: str) -> str:
    ip = ip.strip()
    netmask = netmask.strip()
    if not ip:
        return ""
    b = _netmask_bits(netmask)
    if b is None:
        return ip
    return f"{ip}/{b}"


_IPV4_RE = re.compile(
    r"^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$"
)


def _is_ipv4(s: str) -> bool:
    return bool(s and _IPV4_RE.match(s.strip()))


def _alias_address_display(flat: dict[str, str]) -> str:
    """CIDR string for Alias rows (IPv4 + netmask or IPv6 + prefix)."""
    fam = (flat.get("IPFamily") or "").strip().lower()
    if fam == "ipv6":
        ip6 = (flat.get("IPv6") or "").strip()
        pfx = (flat.get("Prefix") or "").strip()
        if ip6 and pfx:
            return f"{ip6}/{pfx}"
        return ip6 or ""
    ip = (flat.get("IPAddress") or "").strip()
    nm = (flat.get("Netmask") or "").strip()
    if ip and _is_ipv4(ip) and nm and _netmask_bits(nm) is not None:
        return _ipv4_with_cidr(ip, nm)
    if ip:
        return ip
    return ""


def _address_cidrs(flat: dict[str, str]) -> tuple[str, set[str]]:
    """Build CIDR strings from IPAddress + Netmask pairs; return (display, consumed keys)."""
    consumed: set[str] = set()
    cidrs: list[str] = []

    def add_pair(ip_key: str, nm_key: str) -> None:
        ip = flat.get(ip_key, "").strip()
        nm = flat.get(nm_key, "").strip()
        if not ip and not nm:
            return
        if ip and _is_ipv4(ip) and nm and _netmask_bits(nm) is not None:
            cidrs.append(_ipv4_with_cidr(ip, nm))
            consumed.add(ip_key)
            consumed.add(nm_key)
        elif ip:
            cidrs.append(ip)
            if nm:
                consumed.add(nm_key)
            consumed.add(ip_key)

    add_pair("IPAddress", "Netmask")
    if not cidrs and (flat.get("IPv4Address") or "").strip():
        add_pair("IPv4Address", "Netmask")

    prefixes: set[str] = set()
    suffix = ".IPAddress"
    for k in flat:
        if k.endswith(suffix):
            prefixes.add(k[: -len(suffix)])

    for pref in sorted(prefixes):
        add_pair(f"{pref}.IPAddress", f"{pref}.Netmask")

    return (" · ".join(cidrs) if cidrs else "", consumed)


def list_network_cidrs_from_flat(
    flat: dict[str, str], *, entity_type: str = ""
) -> list[str]:
    """Extract individual CIDR or IP strings from a flattened interface/VLAN/alias payload."""
    et = (entity_type or "").strip().lower()
    if et == "alias":
        s = _alias_address_display(flat).strip()
        return [s] if s else []
    display, _ = _address_cidrs(flat)
    if not display.strip():
        return []
    out: list[str] = []
    for chunk in display.split("·"):
        t = chunk.strip()
        if t:
            out.append(t)
    return out


def _zone_display(flat: dict[str, str]) -> tuple[str, set[str]]:
    consumed: set[str] = set()
    for key in ("NetworkZone", "Zone", "Network.Zones", "ZoneName"):
        v = flat.get(key, "").strip()
        if v:
            consumed.add(key)
            return v, consumed
    for k, v in flat.items():
        if k == "Zone" or k.endswith(".Zone") or k.endswith(".NetworkZone"):
            if v.strip():
                consumed.add(k)
                return v.strip(), consumed
    return "", consumed


def _status_display(flat: dict[str, str]) -> tuple[str, set[str]]:
    consumed: set[str] = set()
    parts: list[str] = []
    for key in ("InterfaceStatus", "Status", "LinkStatus", "OperationalStatus"):
        v = flat.get(key, "").strip()
        if v and v not in parts:
            parts.append(v)
            consumed.add(key)
    for k in list(flat.keys()):
        if k in consumed:
            continue
        if re.search(r"(InterfaceStatus|LinkStatus|OperationalStatus)$", k):
            v = flat.get(k, "").strip()
            if v and v not in parts:
                parts.append(v)
                consumed.add(k)
    return (" · ".join(parts), consumed)


def _auto_negotiation_value(flat: dict[str, str]) -> str:
    for key in ("AutoNegotiation", "AutoNegotiate", "MediaAutoNegotiation"):
        v = flat.get(key, "").strip()
        if v:
            return v
    return ""


def _name_value(flat: dict[str, str], external_name: str) -> tuple[str, set[str]]:
    consumed: set[str] = set()
    n = flat.get("Name", "").strip()
    if n:
        consumed.add("Name")
        return n, consumed
    return external_name, consumed


# Keys merged into primary columns — omit from extra columns to avoid duplicates.
_EXTRA_KEY_BLOCKLIST: frozenset[str] = frozenset(
    {
        "Name",
        "NetworkZone",
        "Zone",
        "ZoneName",
        "InterfaceStatus",
        "Status",
        "LinkStatus",
        "OperationalStatus",
        "IPAddress",
        "IPv4Address",
        "Netmask",
        "Hardware",
        "InterfaceSpeed",
        "MACAddress",
        "FEC",
        "AutoNegotiation",
        "AutoNegotiate",
        "MediaAutoNegotiation",
        # Alias IPv6 fields are folded into the address column
        "IPv6",
        "Prefix",
    }
)


def _exclude_from_extras(key: str) -> bool:
    if key in _EXTRA_KEY_BLOCKLIST:
        return True
    if key.endswith(".IPAddress") or key.endswith(".IPv4Address") or key.endswith(".Netmask"):
        return True
    if re.search(r"\.(InterfaceStatus|LinkStatus|OperationalStatus)$", key):
        return True
    if re.search(r"\.(NetworkZone|Zone)$", key):
        return True
    return False


def _xmlish_scalar(node: Any) -> str:
    if node is None:
        return ""
    if isinstance(node, dict) and "#text" in node:
        return str(node["#text"]).strip()
    return str(node).strip()


def collect_lag_member_names_from_payload(data: dict[str, Any]) -> list[str]:
    """Member port names from LAG XML / LAG-shaped Interface payloads."""
    if not isinstance(data, dict):
        return []
    mi = data.get("MemberInterface")
    if mi is None:
        return []
    out: list[str] = []

    def push_iface(x: Any) -> None:
        s = _xmlish_scalar(x)
        if s:
            out.append(s)

    if isinstance(mi, list):
        for block in mi:
            if isinstance(block, dict) and block.get("Interface") is not None:
                push_iface(block.get("Interface"))
        return out
    if isinstance(mi, dict):
        raw = mi.get("Interface")
        if isinstance(raw, list):
            for x in raw:
                push_iface(x)
        else:
            push_iface(raw)
    return out


def interface_payload_is_lag_master(data: dict[str, Any]) -> bool:
    return len(collect_lag_member_names_from_payload(data)) > 0


def lag_hardware_name_from_payload(data: dict[str, Any]) -> str:
    if not isinstance(data, dict):
        return ""
    for key in ("Hardware", "LagInterface"):
        s = _xmlish_scalar(data.get(key))
        if s:
            return s
    return ""


def _extra_column_label(key: str) -> str:
    """Human-readable header for dynamic columns; strips known redundant prefixes."""
    if key.startswith("MSS."):
        key = key[4:]
    if key.startswith("__"):
        return key
    if "." in key:
        return key.rsplit(".", 1)[-1]
    return key


# Top-level zone JSON keys (non–ApplianceAccess): friendlier picker labels.
_ZONE_TOPLEVEL_COLUMN_LABELS: dict[str, str] = {
    "Type": "Type",
    "Description": "Description",
    "MemberPorts": "Member ports",
}


def _split_camel_case_words(label: str) -> str:
    """CaptivePortal -> Captive Portal; leaves short ALL-CAPS tokens (e.g. HTTPS, IPsec) unchanged."""
    s = (label or "").replace("_", " ").strip()
    if not s:
        return s
    if re.fullmatch(r"[A-Z0-9]{2,12}", s):
        return s
    t = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", s)
    t = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", t)
    return t


def _access_control_value_norm(s: str) -> str:
    """Compare ApplianceAccess cell values case-insensitively, ignoring outer whitespace."""
    return (s or "").strip().lower()


# Combined zone flyout: per-scope table + conflict chrome (keys match data-gc-combine-field-keys in UI).
ZONE_FLYOUT_LAYOUT_KEYS: tuple[tuple[str, Callable[[dict[str, str]], str]], ...] = (
    ("__flyout.NetworkZone", lambda flat: _zone_display(flat)[0]),
    ("__flyout.Hardware", lambda flat: str(flat.get("Hardware", "")).strip()),
    ("__flyout.GatewayName", lambda flat: str(flat.get("GatewayName", "")).strip()),
    ("__flyout.GatewayIP", lambda flat: str(flat.get("GatewayIP", "")).strip()),
)

ZONE_FLYOUT_LAYOUT_JSON_KEYS: tuple[tuple[str, str], ...] = (
    ("__flyout.NetworkZone", "network_zone"),
    ("__flyout.Hardware", "hardware"),
    ("__flyout.GatewayName", "gateway_name"),
    ("__flyout.GatewayIP", "gateway_ip"),
)


def _zone_flyout_layout_json_from_flat(flat: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for lk, jk in ZONE_FLYOUT_LAYOUT_JSON_KEYS:
        getter = next(g for k, g in ZONE_FLYOUT_LAYOUT_KEYS if k == lk)
        out[jk] = getter(flat)
    return out


def _zone_append_flyout_layout_to_access_per(
    access_per_firewall: dict[str, dict[str, str]],
    sources: list[dict[str, Any]],
) -> None:
    for lk, getter in ZONE_FLYOUT_LAYOUT_KEYS:
        per_fw: dict[str, str] = {}
        for src in sources:
            fw_n = str(src["firewall"])
            per_fw[fw_n] = getter(src["flat"])
        norms = {_access_control_value_norm(v) for v in per_fw.values()}
        if len(norms) > 1:
            access_per_firewall[lk] = per_fw


def _zone_collect_layout_map_for_lk(row: dict[str, Any], lk: str) -> dict[str, str]:
    ap = row.get("access_per_firewall") or {}
    if lk in ap and isinstance(ap[lk], dict):
        return dict(ap[lk])
    jk = next((j for k, j in ZONE_FLYOUT_LAYOUT_JSON_KEYS if k == lk), "")
    if not jk:
        return {}
    out: dict[str, str] = {}
    for t in row.get("zone_edit_targets") or []:
        if not isinstance(t, dict):
            continue
        lab = str(t.get("scope_label") or "").strip()
        if not lab:
            continue
        out[lab] = str(t.get(jk) or "").strip()
    return out


def _zone_table_extra_column_label(key: str) -> str:
    """Zones table: dotted column ids use the last segment; CamelCase becomes spaced words."""
    if key in _ZONE_TOPLEVEL_COLUMN_LABELS:
        return _split_camel_case_words(_ZONE_TOPLEVEL_COLUMN_LABELS[key])
    if "." in key:
        last = key.rsplit(".", 1)[-1]
        t = last.replace("_", " ").strip()
        if t:
            return _split_camel_case_words(t)
        rest = key.rsplit(".", 2)
        if len(rest) >= 2 and rest[-2].strip():
            return _split_camel_case_words(rest[-2].replace("_", " ").strip())
        return "Field"
    base = _extra_column_label(key)
    if isinstance(base, str) and base.strip():
        return _split_camel_case_words(base)
    return _split_camel_case_words(key.replace("_", " ").strip() or "Field")


def build_interface_table_rows(
    parsed: list[tuple[Any, Any, dict[str, Any]]],
) -> dict[str, Any]:
    """
    `parsed` is (FirewallConfigEntry, Firewall, raw_payload_dict) per row.
    Returns API payload: columns, column_labels, columns_visible_by_default, rows.
    """
    key_union: set[str] = set()
    flat_per_row: list[dict[str, str]] = []

    for _ent, _fw, data in parsed:
        flat = flatten_payload(data)
        flat_per_row.append(flat)
        key_union.update(flat.keys())

    extras = sorted(k for k in key_union if not _exclude_from_extras(k))
    columns = PRIMARY_ORDER + extras

    column_labels = dict(COLUMN_LABELS)
    for k in extras:
        column_labels[k] = _extra_column_label(k)

    out_rows: list[dict[str, Any]] = []
    for (ent, fw, _data), flat in zip(parsed, flat_per_row, strict=True):
        fw_label = fw.name or fw.host or str(fw.id)
        name_val, _ = _name_value(flat, ent.external_name)
        zone_val, _ = _zone_display(flat)
        status_val, _ = _status_display(flat)
        addr_val, _ = _address_cidrs(flat)
        hw_val = flat.get("Hardware", "").strip()
        auto_neg_val = _auto_negotiation_value(flat)

        cells: dict[str, str] = {
            COL_ID_NAME: name_val,
            COL_ID_ZONE: zone_val,
            COL_ID_STATUS: status_val,
            COL_ID_ADDRESS: addr_val,
            COL_ID_HARDWARE: hw_val,
            COL_ID_AUTO_NEGOTIATION: auto_neg_val,
            COL_ID_FIREWALL: fw_label,
        }
        for k in extras:
            cells[k] = flat.get(k, "")

        search_parts = [fw_label.lower(), ent.external_name.lower(), name_val.lower()]
        for k in columns:
            search_parts.append(cells.get(k, "").lower())
        out_rows.append(
            {
                "cells": cells,
                "search": " ".join(search_parts),
                "flat": flat,
                "firewall_id": fw.id,
                "config_entry_id": ent.id,
            }
        )

    return {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": DEFAULT_VISIBLE_IDS,
        "rows": out_rows,
    }


def build_unified_interfaces_tab_rows(
    parsed: list[tuple[Any, Any, dict[str, Any], str] | tuple[Any, Any, dict[str, Any], str, str]],
) -> dict[str, Any]:
    """
    Interfaces tab: interface, VLAN, and bridge-pair rows with a Type column and ``entity_type`` on each row.
    ``parsed`` is (entry, Firewall|Configuration, raw_payload_dict, entity_type_id) per row,
    optionally with a fifth ``scope`` value: ``\"firewall\"`` (default) or ``\"configuration\"``.
    """
    normalized: list[tuple[Any, Any, dict[str, Any], str, str]] = []
    for item in parsed:
        if len(item) == 5:
            ent, parent, data, et, scope = item
        else:
            ent, parent, data, et = item
            scope = "firewall"
        normalized.append((ent, parent, data, et, scope))

    key_union: set[str] = set()
    flat_per_row: list[dict[str, str]] = []

    for _ent, _fw, data, _et, _sc in normalized:
        flat = flatten_payload(data)
        flat_per_row.append(flat)
        key_union.update(flat.keys())

    extras = sorted(k for k in key_union if not _exclude_from_extras(k))
    columns = UNIFIED_PRIMARY_ORDER + extras

    column_labels = dict(COLUMN_LABELS)
    for k in extras:
        column_labels[k] = _extra_column_label(k)

    out_rows: list[dict[str, Any]] = []
    for idx, (ent, fw, data, et, scope) in enumerate(normalized):
        flat = flat_per_row[idx]
        fw_label = fw.name or getattr(fw, "host", None) or str(fw.id)
        name_val, _ = _name_value(flat, ent.external_name)
        zone_val, _ = _zone_display(flat)
        status_val, _ = _status_display(flat)
        if et == "alias":
            addr_val = _alias_address_display(flat)
            hw_val = (flat.get("Interface") or "").strip()
        elif et == "lag":
            addr_val, _ = _address_cidrs(flat)
            hw0 = flat.get("Hardware", "").strip()
            mems = collect_lag_member_names_from_payload(data)
            hw_val = (hw0 + " — " if hw0 else "") + ", ".join(mems) if mems else hw0
        else:
            addr_val, _ = _address_cidrs(flat)
            hw_val = flat.get("Hardware", "").strip()
        auto_neg_val = _auto_negotiation_value(flat)
        type_display = ENTITY_TYPE_DISPLAY.get(et, et)

        cells: dict[str, str] = {
            COL_ID_TYPE: type_display,
            COL_ID_NAME: name_val,
            COL_ID_ZONE: zone_val,
            COL_ID_STATUS: status_val,
            COL_ID_ADDRESS: addr_val,
            COL_ID_HARDWARE: hw_val,
            COL_ID_AUTO_NEGOTIATION: auto_neg_val,
            COL_ID_FIREWALLS: fw_label,
        }
        for k in extras:
            cells[k] = flat.get(k, "")

        search_parts = [
            fw_label.lower(),
            ent.external_name.lower(),
            name_val.lower(),
            type_display.lower(),
            et.lower(),
            scope.lower(),
        ]
        for k in columns:
            search_parts.append(cells.get(k, "").lower())
        row_obj: dict[str, Any] = {
            "cells": cells,
            "search": " ".join(search_parts),
            "flat": flat,
            "raw_payload": copy.deepcopy(data),
            "entity_type": et,
            "config_entry_id": ent.id,
            "scope": scope,
        }
        if scope == "configuration":
            row_obj["configuration_id"] = fw.id
            row_obj["firewall_id"] = None
            row_obj["configuration_labels"] = [fw_label]
        else:
            row_obj["firewall_id"] = fw.id
            row_obj["configuration_id"] = None
            row_obj["firewall_labels"] = [fw_label]
        out_rows.append(row_obj)

    return {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": UNIFIED_DEFAULT_VISIBLE_IDS,
        "rows": out_rows,
        "interfaces_combined": False,
        "interfaces_combine_conflicts": False,
    }


def _norm_interface_cell_compare(val: str) -> str:
    return (val or "").strip().casefold()


def _unified_interface_source_bundle(
    ent: Any,
    parent: Any,
    data: dict[str, Any],
    et: str,
    scope: str,
) -> dict[str, Any]:
    flat = flatten_payload(data)
    fw_label = parent.name or getattr(parent, "host", None) or str(parent.id)
    name_val, _ = _name_value(flat, ent.external_name)
    zone_val, _ = _zone_display(flat)
    status_val, _ = _status_display(flat)
    if et == "alias":
        addr_val = _alias_address_display(flat)
        hw_val = (flat.get("Interface") or "").strip()
    elif et == "lag":
        addr_val, _ = _address_cidrs(flat)
        hw0 = flat.get("Hardware", "").strip()
        mems = collect_lag_member_names_from_payload(data)
        hw_val = (hw0 + " — " if hw0 else "") + ", ".join(mems) if mems else hw0
    else:
        addr_val, _ = _address_cidrs(flat)
        hw_val = flat.get("Hardware", "").strip()
    auto_neg_val = _auto_negotiation_value(flat)
    type_display = ENTITY_TYPE_DISPLAY.get(et, et)
    cells: dict[str, str] = {
        COL_ID_TYPE: type_display,
        COL_ID_NAME: name_val,
        COL_ID_ZONE: zone_val,
        COL_ID_STATUS: status_val,
        COL_ID_ADDRESS: addr_val,
        COL_ID_HARDWARE: hw_val,
        COL_ID_AUTO_NEGOTIATION: auto_neg_val,
        COL_ID_FIREWALLS: fw_label,
    }
    out: dict[str, Any] = {
        "flat": flat,
        "cells": cells,
        "entity_type": et,
        "scope": scope,
        "fw_label": fw_label,
        "config_entry_id": int(ent.id),
        "data": data,
    }
    if scope == "configuration":
        out["firewall_id"] = None
        out["configuration_id"] = int(parent.id)
    else:
        out["firewall_id"] = int(parent.id)
        out["configuration_id"] = None
    return out


def build_unified_interfaces_tab_rows_combined(
    parsed: list[tuple[Any, Any, dict[str, Any], str] | tuple[Any, Any, dict[str, Any], str, str]],
) -> dict[str, Any]:
    """
    Interfaces tab combined: merge rows that share the same scope kind (firewall vs
    configuration), ``entity_type``, and display name across selected scopes.
    """
    normalized: list[tuple[Any, Any, dict[str, Any], str, str]] = []
    for item in parsed:
        if len(item) == 5:
            ent, parent, data, et, scope = item
        else:
            ent, parent, data, et = item
            scope = "firewall"
        normalized.append((ent, parent, data, et, scope))

    bundles: list[dict[str, Any]] = []
    for ent, parent, data, et, scope in normalized:
        bundles.append(_unified_interface_source_bundle(ent, parent, data, et, scope))

    def group_key(b: dict[str, Any]) -> tuple[str, str, str]:
        name_val = (b["cells"].get(COL_ID_NAME) or "").strip()
        nk = name_val.casefold() if name_val else "—"
        return (b["scope"], b["entity_type"], nk)

    groups: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for b in bundles:
        groups[group_key(b)].append(b)

    def source_sort_key(b: dict[str, Any]) -> tuple[str, str]:
        return ((b["fw_label"] or "").lower(), str(b["config_entry_id"]))

    ordered_group_keys = sorted(
        groups.keys(),
        key=lambda k: (
            k[0],
            ENTITY_TYPE_DISPLAY.get(k[1], k[1]).lower(),
            k[2],
        ),
    )

    key_union: set[str] = set()
    for b in bundles:
        key_union.update(b["flat"].keys())
    extras = sorted(k for k in key_union if not _exclude_from_extras(k))
    columns = [
        COL_ID_TYPE,
        COL_ID_NAME,
        COL_ID_ZONE,
        COL_ID_STATUS,
        COL_ID_ADDRESS,
        COL_ID_HARDWARE,
        COL_ID_AUTO_NEGOTIATION,
        COL_ID_FIREWALLS,
        *extras,
    ]
    column_labels = dict(COLUMN_LABELS)
    column_labels[COL_ID_FIREWALLS] = "Firewalls"
    for k in extras:
        column_labels[k] = _extra_column_label(k)

    compare_cols = [
        COL_ID_ZONE,
        COL_ID_STATUS,
        COL_ID_ADDRESS,
        COL_ID_HARDWARE,
        COL_ID_AUTO_NEGOTIATION,
        *extras,
    ]

    out_rows: list[dict[str, Any]] = []
    for gkey in ordered_group_keys:
        sources = sorted(groups[gkey], key=source_sort_key)
        rep = sources[0]
        fw_labels = [b["fw_label"] for b in sources]
        cells_out: dict[str, str] = {
            k: v for k, v in rep["cells"].items() if k != COL_ID_FIREWALLS
        }
        cells_out[COL_ID_FIREWALLS] = " · ".join(fw_labels)
        for k in extras:
            cells_out[k] = rep["flat"].get(k, "")

        per_field: dict[str, dict[str, str]] = {}
        for col in compare_cols:
            mp = {b["fw_label"]: _unified_bundle_compare_value(b, col) for b in sources}
            norms = {_norm_interface_cell_compare(v) for v in mp.values()}
            if len(norms) > 1:
                per_field[col] = mp

        search_parts = [
            " ".join(x.lower() for x in fw_labels),
            rep["entity_type"].lower(),
            rep["scope"].lower(),
        ]
        for k in columns:
            search_parts.append((cells_out.get(k) or "").lower())

        fw_ids_merged: list[int] = []
        fw_seen: set[int] = set()
        cfg_ids_merged: list[int] = []
        cfg_seen: set[int] = set()
        if_combine_sources: list[dict[str, Any]] = []
        interface_edit_targets: list[dict[str, Any]] = []
        for b in sources:
            if_combine_sources.append(
                {
                    "firewall_id": b["firewall_id"],
                    "configuration_id": b["configuration_id"],
                    "config_entry_id": b["config_entry_id"],
                    "entity_type": b["entity_type"],
                    "scope": b["scope"],
                    "scope_label": b["fw_label"],
                    "flat": b["flat"],
                }
            )
            t: dict[str, Any] = {
                "config_entry_id": b["config_entry_id"],
                "entity_type": b["entity_type"],
            }
            if b["firewall_id"] is not None:
                t["firewall_id"] = b["firewall_id"]
                fid = int(b["firewall_id"])
                if fid > 0 and fid not in fw_seen:
                    fw_seen.add(fid)
                    fw_ids_merged.append(fid)
            if b["configuration_id"] is not None:
                t["configuration_id"] = b["configuration_id"]
                cid = int(b["configuration_id"])
                if cid > 0 and cid not in cfg_seen:
                    cfg_seen.add(cid)
                    cfg_ids_merged.append(cid)
            interface_edit_targets.append(t)

        row_obj: dict[str, Any] = {
            "cells": cells_out,
            "search": " ".join(search_parts),
            "flat": rep["flat"],
            "raw_payload": copy.deepcopy(rep["data"]),
            "entity_type": rep["entity_type"],
            "config_entry_id": rep["config_entry_id"],
            "scope": rep["scope"],
            "firewall_id": rep["firewall_id"],
            "configuration_id": rep["configuration_id"],
            "interfaces_row_combined": True,
            "if_combine_conflict": bool(per_field),
            "interface_edit_targets": interface_edit_targets,
            "if_combine_sources": if_combine_sources,
        }
        if rep["scope"] == "configuration":
            row_obj["configuration_labels"] = list(fw_labels)
        else:
            row_obj["firewall_labels"] = list(fw_labels)
        if fw_ids_merged:
            row_obj["firewall_ids"] = fw_ids_merged
        if cfg_ids_merged:
            row_obj["configuration_ids"] = cfg_ids_merged
        if per_field:
            row_obj["if_combine_per_field"] = per_field
        out_rows.append(row_obj)

    combine_conflicts = any(bool(r.get("if_combine_conflict")) for r in out_rows)
    return {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": UNIFIED_COMBINED_DEFAULT_VISIBLE_IDS,
        "rows": out_rows,
        "interfaces_combined": True,
        "interfaces_combine_conflicts": combine_conflicts,
    }


def zone_names_for_firewalls(db: Session, firewall_ids: list[int]) -> dict[int, list[str]]:
    """
    Display names of cached zone entities per firewall (same derivation as the Network · Zones table).
    Used e.g. for IPS spoof flyout so listed zones always match the row's firewall.
    """
    if not firewall_ids:
        return {}
    ids = list(dict.fromkeys(int(x) for x in firewall_ids if int(x) > 0))
    if not ids:
        return {}
    rows_db = (
        db.query(FirewallConfigEntry, Firewall)
        .join(Firewall, Firewall.id == FirewallConfigEntry.firewall_id)
        .filter(
            FirewallConfigEntry.entity_type == ENTITY_ZONE,
            FirewallConfigEntry.firewall_id.in_(ids),
        )
        .order_by(
            Firewall.name.asc().nulls_last(),
            Firewall.host.asc(),
            FirewallConfigEntry.external_name.asc(),
        )
        .all()
    )
    out: dict[int, list[str]] = {i: [] for i in ids}
    seen: dict[int, set[str]] = {i: set() for i in ids}
    for ent, fw in rows_db:
        try:
            data = json.loads(ent.payload_json)
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        flat = flatten_payload(data)
        name_val, _ = _name_value(flat, ent.external_name)
        zname = (name_val or ent.external_name or "").strip()
        if not zname or zname == "—":
            continue
        fid = int(fw.id)
        if fid not in seen or zname in seen[fid]:
            continue
        seen[fid].add(zname)
        out[fid].append(zname)
    return out


def build_zone_network_table_rows(
    parsed: list[tuple[Any, Any, dict[str, Any]]],
) -> dict[str, Any]:
    """
    Zones tab: one row per unique zone name across selected firewalls.
    Columns: Name, Firewalls (where the zone appears), then dynamic extras from JSON.
    """
    flat_per_row: list[dict[str, str]] = []
    for _ent, _fw, data in parsed:
        flat = flatten_payload(data)
        flat_per_row.append(flat)

    groups: dict[str, dict[str, Any]] = {}
    order_keys: list[str] = []

    for (ent, fw, _data), flat in zip(parsed, flat_per_row, strict=True):
        name_val, _ = _name_value(flat, ent.external_name)
        zname = (name_val or ent.external_name or "").strip()
        if not zname:
            zname = "—"
        fw_label = fw.name or fw.host or str(fw.id)
        if zname not in groups:
            groups[zname] = {
                "fws_ordered": [],
                "fw_seen": set(),
                "sources": [],
                "rep_ent": ent,
                "rep_fw": fw,
                "rep_flat": flat,
            }
            order_keys.append(zname)
        g = groups[zname]
        g["sources"].append(
            {"ent": ent, "firewall": fw_label, "firewall_id": fw.id, "flat": flat}
        )
        if fw_label not in g["fw_seen"]:
            g["fw_seen"].add(fw_label)
            g["fws_ordered"].append(fw_label)

    key_union: set[str] = set()
    for g in groups.values():
        for src in g["sources"]:
            key_union.update(src["flat"].keys())
    extras = sorted(k for k in key_union if not _exclude_from_extras(k))
    columns = [COL_ID_NAME, COL_ID_FIREWALLS, *extras]

    column_labels: dict[str, str] = {
        COL_ID_NAME: "Name",
        COL_ID_FIREWALLS: "Firewalls",
    }
    for k in extras:
        column_labels[k] = _zone_table_extra_column_label(k)

    zones_default_visible = [COL_ID_NAME, COL_ID_FIREWALLS, *extras]

    out_rows: list[dict[str, Any]] = []
    for zname in order_keys:
        g = groups[zname]
        rep_flat = g["rep_flat"]
        ent = g["rep_ent"]
        fw = g["rep_fw"]
        fws = g["fws_ordered"]

        cells: dict[str, str] = {
            COL_ID_NAME: zname,
            COL_ID_FIREWALLS: " · ".join(fws),
        }
        access_per_firewall: dict[str, dict[str, str]] = {}
        for k in extras:
            if not k.startswith("ApplianceAccess."):
                continue
            per_fw: dict[str, str] = {}
            for src in g["sources"]:
                fw_n = src["firewall"]
                per_fw[fw_n] = src["flat"].get(k, "")
            norms = {_access_control_value_norm(v) for v in per_fw.values()}
            if len(norms) > 1:
                access_per_firewall[k] = per_fw

        _zone_append_flyout_layout_to_access_per(access_per_firewall, g["sources"])

        access_conflict = bool(access_per_firewall)
        for k in extras:
            cells[k] = rep_flat.get(k, "")

        search_parts = [zname.lower(), " ".join(x.lower() for x in fws)]
        for k in columns:
            search_parts.append(cells.get(k, "").lower())
        fw_ids_merged: list[int] = []
        fw_id_seen: set[int] = set()
        for src in g["sources"]:
            raw_id = src.get("firewall_id")
            if raw_id is None:
                continue
            try:
                fid = int(raw_id)
            except (TypeError, ValueError):
                continue
            if fid > 0 and fid not in fw_id_seen:
                fw_id_seen.add(fid)
                fw_ids_merged.append(fid)
        zone_edit_targets = []
        for src in g["sources"]:
            if src.get("ent") is None or src.get("firewall_id") is None:
                continue
            lay = _zone_flyout_layout_json_from_flat(src["flat"])
            zone_edit_targets.append(
                {
                    "firewall_id": int(src["firewall_id"]),
                    "config_entry_id": int(src["ent"].id),
                    "scope_label": str(src["firewall"]),
                    **lay,
                }
            )
        row_out: dict[str, Any] = {
            "cells": cells,
            "search": " ".join(search_parts),
            "flat": rep_flat,
            "firewall_labels": fws,
            "firewall_id": fw.id,
            "firewall_ids": fw_ids_merged,
            "entity_type": "zone",
            "config_entry_id": ent.id,
            "access_conflict": access_conflict,
            "zone_edit_targets": zone_edit_targets,
        }
        if access_conflict:
            row_out["access_per_firewall"] = access_per_firewall
        out_rows.append(row_out)

    combine_conflicts = any(bool(r.get("access_conflict")) for r in out_rows)

    return {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": zones_default_visible,
        "rows": out_rows,
        "zones_combine_conflicts": combine_conflicts,
        "zones_combined": True,
    }


def build_zone_network_table_rows_flat(
    parsed: list[tuple[Any, Any, dict[str, Any]]],
) -> dict[str, Any]:
    """
    Zones tab with combine off: one row per zone entry per firewall (no merging by name).
    Columns: Name, Firewall, then dynamic extras (same zone-specific labels as combined mode).
    """
    flat_per_row: list[dict[str, str]] = []
    for _ent, _fw, data in parsed:
        flat = flatten_payload(data)
        flat_per_row.append(flat)

    key_union: set[str] = set()
    for f in flat_per_row:
        key_union.update(f.keys())
    extras = sorted(k for k in key_union if not _exclude_from_extras(k))
    columns = [COL_ID_NAME, COL_ID_FIREWALL, *extras]

    column_labels: dict[str, str] = {
        COL_ID_NAME: "Name",
        COL_ID_FIREWALL: "Firewall",
    }
    for k in extras:
        column_labels[k] = _zone_table_extra_column_label(k)

    zones_default_visible = [COL_ID_NAME, COL_ID_FIREWALL, *extras]

    out_rows: list[dict[str, Any]] = []
    for (ent, fw, _data), flat in zip(parsed, flat_per_row, strict=True):
        fw_label = fw.name or fw.host or str(fw.id)
        name_val, _ = _name_value(flat, ent.external_name)
        zname = (name_val or ent.external_name or "").strip()
        if not zname:
            zname = "—"

        cells: dict[str, str] = {
            COL_ID_NAME: zname,
            COL_ID_FIREWALL: fw_label,
        }
        for k in extras:
            cells[k] = flat.get(k, "")

        search_parts = [fw_label.lower(), ent.external_name.lower(), zname.lower()]
        for k in columns:
            search_parts.append(cells.get(k, "").lower())
        lay = _zone_flyout_layout_json_from_flat(flat)
        out_rows.append(
            {
                "cells": cells,
                "search": " ".join(search_parts),
                "flat": flat,
                "firewall_id": fw.id,
                "entity_type": "zone",
                "config_entry_id": ent.id,
                "zone_edit_targets": [
                    {
                        "firewall_id": int(fw.id),
                        "config_entry_id": int(ent.id),
                        "scope_label": fw_label,
                        **lay,
                    }
                ],
            }
        )

    return {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": zones_default_visible,
        "rows": out_rows,
        "zones_combine_conflicts": False,
        "zones_combined": False,
    }


def _zone_row_scope_labels(row: dict[str, Any]) -> list[str]:
    fl = row.get("firewall_labels")
    if isinstance(fl, list) and fl:
        return [str(x) for x in fl]
    cl = row.get("configuration_labels")
    if isinstance(cl, list) and cl:
        return [str(x) for x in cl]
    return []


def _merge_zone_access_per_column(
    rw: dict[str, Any] | None,
    rc: dict[str, Any] | None,
    col_key: str,
) -> dict[str, str]:
    out: dict[str, str] = {}
    for r in (rw, rc):
        if r is None:
            continue
        ap = r.get("access_per_firewall") or {}
        if isinstance(ap, dict) and col_key in ap and isinstance(ap[col_key], dict):
            for scope, val in ap[col_key].items():
                out[str(scope)] = str(val) if val is not None else ""
        else:
            for lab in _zone_row_scope_labels(r):
                out[lab] = str((r.get("cells") or {}).get(col_key, ""))
    return out


def _zone_row_expand_to_union(row: dict[str, Any], col_union: list[str]) -> dict[str, Any]:
    nr = dict(row)
    cells = dict(row.get("cells") or {})
    for c in col_union:
        cells.setdefault(c, "")
    nr["cells"] = cells
    return nr


def _merge_zone_fw_cfg_row_pair(
    rw: dict[str, Any],
    rc: dict[str, Any],
    col_union: list[str],
    extras: list[str],
) -> dict[str, Any]:
    cells_rw = dict(rw.get("cells") or {})
    cells_rc = dict(rc.get("cells") or {})
    cells: dict[str, str] = {}
    for c in col_union:
        if c == COL_ID_NAME:
            cells[c] = (cells_rw.get(c, "") or cells_rc.get(c, "")).strip() or "—"
        elif c == COL_ID_FIREWALLS:
            labs_merged: list[str] = []
            seen: set[str] = set()
            for lb in _zone_row_scope_labels(rw) + _zone_row_scope_labels(rc):
                if lb and lb not in seen:
                    seen.add(lb)
                    labs_merged.append(lb)
            cells[c] = " · ".join(labs_merged)
        else:
            va = str(cells_rw.get(c, "")).strip()
            vb = str(cells_rc.get(c, "")).strip()
            cells[c] = va if va else vb

    access_per: dict[str, dict[str, str]] = {}
    for k in extras:
        if not k.startswith("ApplianceAccess."):
            continue
        merged = _merge_zone_access_per_column(rw, rc, k)
        norms = {_access_control_value_norm(v) for v in merged.values()}
        if len(norms) > 1:
            access_per[k] = merged

    for lk, _getter in ZONE_FLYOUT_LAYOUT_KEYS:
        ma = _zone_collect_layout_map_for_lk(rw, lk)
        mb = _zone_collect_layout_map_for_lk(rc, lk)
        merged_l = {**ma, **mb}
        if not merged_l:
            continue
        norms_l = {_access_control_value_norm(v) for v in merged_l.values()}
        if len(norms_l) > 1:
            access_per[lk] = merged_l

    access_conflict = bool(access_per)
    fw_ids_merged = list(rw.get("firewall_ids") or [])
    cfg_ids_merged = list(rc.get("configuration_ids") or [])
    zt: list[dict[str, Any]] = []
    zt.extend(list(rw.get("zone_edit_targets") or []))
    zt.extend(list(rc.get("zone_edit_targets") or []))

    labs_ordered: list[str] = []
    seen_l: set[str] = set()
    for lb in _zone_row_scope_labels(rw) + _zone_row_scope_labels(rc):
        if lb and lb not in seen_l:
            seen_l.add(lb)
            labs_ordered.append(lb)

    search_parts = [cells[COL_ID_NAME].lower(), " ".join(x.lower() for x in labs_ordered)]
    for k in col_union:
        search_parts.append(str(cells.get(k, "")).lower())

    out_row: dict[str, Any] = {
        "cells": cells,
        "search": " ".join(search_parts),
        "flat": dict(rw.get("flat") or rc.get("flat") or {}),
        "firewall_labels": labs_ordered,
        "firewall_ids": fw_ids_merged,
        "configuration_ids": cfg_ids_merged,
        "entity_type": "zone",
        "config_entry_id": rw.get("config_entry_id") or rc.get("config_entry_id"),
        "firewall_id": rw.get("firewall_id"),
        "configuration_id": rc.get("configuration_id"),
        "access_conflict": access_conflict,
        "zone_edit_targets": zt,
    }
    if access_conflict:
        out_row["access_per_firewall"] = access_per
    return out_row


def _merge_zone_cross_resolve_row(
    rw: dict[str, Any] | None,
    rc: dict[str, Any] | None,
    col_union: list[str],
    extras: list[str],
) -> dict[str, Any]:
    if rw is None:
        assert rc is not None
        return _zone_row_expand_to_union(rc, col_union)
    if rc is None:
        return _zone_row_expand_to_union(rw, col_union)
    return _merge_zone_fw_cfg_row_pair(rw, rc, col_union, extras)


def merge_zone_combined_payloads_cross_scope(
    fw_payload: dict[str, Any],
    cfg_payload: dict[str, Any],
) -> dict[str, Any]:
    """
    Merge firewall-scope and configuration-scope *combined* zone tables by zone name.

    Used when the client requests both firewall_ids and configuration_ids with combine on,
    so each side is already merged within its scope type.
    """
    ra = list(fw_payload.get("rows") or [])
    rb = list(cfg_payload.get("rows") or [])
    if not rb:
        return dict(fw_payload)
    if not ra:
        return dict(cfg_payload)

    cols_a = list(fw_payload.get("columns") or [])
    cols_b = list(cfg_payload.get("columns") or [])
    col_union: list[str] = []
    seen_c: set[str] = set()
    for c in cols_a + cols_b:
        if c not in seen_c:
            seen_c.add(c)
            col_union.append(c)

    extras = [c for c in col_union if c not in (COL_ID_NAME, COL_ID_FIREWALLS)]

    column_labels: dict[str, str] = dict(fw_payload.get("column_labels") or {})
    cl_b = cfg_payload.get("column_labels") or {}
    if isinstance(cl_b, dict):
        for k, v in cl_b.items():
            column_labels.setdefault(k, v)
    column_labels[COL_ID_NAME] = "Name"
    column_labels[COL_ID_FIREWALLS] = "Scope"

    by_name: dict[str, dict[str, Any | None]] = {}
    order: list[str] = []

    def register_row(r: dict[str, Any], side: str) -> None:
        cells = r.get("cells") or {}
        zname = str(cells.get(COL_ID_NAME, "")).strip() or "—"
        if zname not in by_name:
            by_name[zname] = {"fw": None, "cfg": None}
            order.append(zname)
        by_name[zname][side] = r

    for r in ra:
        register_row(r, "fw")
    for r in rb:
        register_row(r, "cfg")

    out_rows = [
        _merge_zone_cross_resolve_row(
            by_name[z]["fw"], by_name[z]["cfg"], col_union, extras
        )
        for z in order
    ]

    combine_conflicts = any(bool(r.get("access_conflict")) for r in out_rows)

    vis_a = list(fw_payload.get("columns_visible_by_default") or [])
    vis_b = list(cfg_payload.get("columns_visible_by_default") or [])
    vis: list[str] = []
    seen_v: set[str] = set()
    for x in vis_a + vis_b:
        if x in col_union and x not in seen_v:
            seen_v.add(x)
            vis.append(x)

    return {
        "columns": col_union,
        "column_labels": column_labels,
        "columns_visible_by_default": vis,
        "rows": out_rows,
        "zones_combine_conflicts": combine_conflicts,
        "zones_combined": True,
    }
