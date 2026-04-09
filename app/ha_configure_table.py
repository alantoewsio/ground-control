"""HA configuration: table payload from config cache (sync entity ``ha_configure``)."""

from __future__ import annotations

import html as html_mod
import json
from collections import defaultdict
from typing import Any
from urllib.parse import quote

from sqlalchemy.orm import Session

from app.firewall_config_sync import ENTITY_HA_CONFIGURE, ENTITY_TYPES_INTERFACES_TAB
from app.models import Firewall, FirewallConfigEntry

# gc-network-entity list-cell separator (must match static/gc-network-entity.js)
_LIST_SEP = "\x1e"


def _hue_label(label: str) -> int:
    h = 0
    for c in label.casefold():
        h = (h * 31 + ord(c)) % 360
    return h


def _iface_link_or_text(name: str, names_lc: set[str]) -> str:
    n = name.strip()
    if not n:
        return ""
    esc = html_mod.escape(n)
    if n.casefold() in names_lc:
        u = html_mod.escape(f"/firewalls/network?if_search={quote(n, safe='')}")
        return f'<a class="gc-ha-if-pill-link" href="{u}">{esc}</a>'
    return esc


def _iface_pills_row(names: list[str], names_lc: set[str]) -> str:
    parts: list[str] = []
    for raw in names:
        n = raw.strip()
        if not n:
            continue
        hue = _hue_label(n)
        inner = _iface_link_or_text(n, names_lc)
        parts.append(f'<span class="gc-zone-pill" style="--gc-zone-h: {hue}">{inner}</span>')
    if not parts:
        return ""
    return '<span class="gc-hw-pill-row">' + "".join(parts) + "</span>"


def _iface_scalar_cell(name: str, names_lc: set[str]) -> str:
    n = name.strip()
    if not n:
        return ""
    inner = _iface_link_or_text(n, names_lc)
    return inner


def _text_scalar(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, dict):
        raw = raw.get("#text") if "#text" in raw else raw.get("text")
    return str(raw).strip()


def _unwrap_block(raw: Any) -> dict[str, Any] | None:
    if raw is None:
        return None
    if isinstance(raw, list):
        if len(raw) != 1:
            return None
        raw = raw[0]
    if isinstance(raw, dict) and raw:
        return raw
    return None


def _monitor_port_names(interactive: dict[str, Any] | None) -> list[str]:
    if not interactive:
        return []
    mp = interactive.get("MonitorPorts")
    if mp is None:
        return []
    if isinstance(mp, list):
        mp = mp[0] if mp else {}
    if not isinstance(mp, dict):
        return []
    iface = mp.get("Interface")
    if iface is None:
        return []
    if isinstance(iface, list):
        out = [_text_scalar(x) for x in iface]
    else:
        out = [_text_scalar(iface)]
    return [x for x in out if x]


def _peer_admin_rows(interactive: dict[str, Any] | None) -> list[dict[str, str]]:
    if not interactive:
        return []
    pal = interactive.get("PeerAdministrationList")
    if pal is None:
        return []
    if isinstance(pal, list):
        pal = pal[0] if pal else {}
    if not isinstance(pal, dict):
        return []
    peers = pal.get("PeerConfiguration")
    if peers is None:
        return []
    if not isinstance(peers, list):
        peers = [peers]
    rows: list[dict[str, str]] = []
    for p in peers:
        if not isinstance(p, dict):
            continue
        rows.append(
            {
                "Interface": _text_scalar(p.get("Interface")),
                "IPAddressV4": _text_scalar(p.get("IPAddressV4")),
                "IPAddressV6": _text_scalar(p.get("IPAddressV6")),
                "ReserveBridgePort": _text_scalar(p.get("ReserveBridgePort")),
            }
        )
    return rows


def _interactive_nonempty(inter: dict[str, Any] | None) -> bool:
    if not inter:
        return False
    for k, v in inter.items():
        if not v:
            continue
        if k == "NodeName" and not _text_scalar(v):
            continue
        return True
    return False


def _normalize_ha_device(raw: str) -> str:
    """Map API ``Device`` to XML doc values: Auxilliary | Active_Active | Active_Passive."""
    s = raw.strip()
    if not s:
        return ""
    low = s.replace("-", "_").replace(" ", "_").casefold()
    if "auxilliary" in low or low == "auxiliary":
        return "Auxilliary"
    if "active_active" in low or "activeactive" in low:
        return "Active_Active"
    if "active_passive" in low or ("primary" in low and "passive" in low):
        return "Active_Passive"
    return s


def _ha_configuration_mode(quick: dict[str, Any] | None, inter: dict[str, Any] | None) -> str:
    """``quick`` | ``interactive`` | ``none`` — matches HA_Quick vs HA_Interactive blocks (see HAConfigure.md)."""
    q_on = bool(quick and (_text_scalar(quick.get("Device")) or _text_scalar(quick.get("DedicatedLink"))))
    i_on = _interactive_nonempty(inter)
    if i_on:
        return "interactive"
    if q_on:
        return "quick"
    return "none"


def _passphrase_from_blocks(
    quick: dict[str, Any] | None, inter: dict[str, Any] | None
) -> str:
    """Passphrase for display/copy: interactive (incl. Auxiliary sub-block) then Quick."""
    if inter:
        dev = _normalize_ha_device(_text_scalar(inter.get("Device")))
        aux = _unwrap_block(inter.get("Auxilliary"))
        if dev == "Auxilliary" and aux:
            p = _text_scalar(aux.get("Passphrase"))
            if p:
                return p
        p = _text_scalar(inter.get("Passphrase"))
        if p:
            return p
    if quick:
        return _text_scalar(quick.get("Passphrase"))
    return ""


def _dedicated_ha_link_display(
    quick: dict[str, Any] | None, inter: dict[str, Any] | None
) -> str:
    """``DedicatedLink`` from Interactive (Auxiliary sub-block when role is Auxiliary) or Quick."""
    if inter:
        dev = _normalize_ha_device(_text_scalar(inter.get("Device")))
        aux = _unwrap_block(inter.get("Auxilliary"))
        if dev == "Auxilliary" and aux:
            v = _text_scalar(aux.get("DedicatedLink"))
            if v:
                return v
        return _text_scalar(inter.get("DedicatedLink"))
    if quick:
        return _text_scalar(quick.get("DedicatedLink"))
    return ""


def _ha_flags(root: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for key in (
        "DisableHA",
        "HA_Interactive_Reset",
        "HA_Quick_Stop",
    ):
        blk = root.get(key)
        if blk is None:
            continue
        if isinstance(blk, list) and not blk:
            continue
        out.append(key)
    return out


def _flyout_sections(root: dict[str, Any]) -> dict[str, Any]:
    quick = _unwrap_block(root.get("HA_Quick"))
    inter = _unwrap_block(root.get("HA_Interactive"))
    qrows: list[dict[str, str]] = []
    if quick:
        qrows.append(
            {
                "Device": _text_scalar(quick.get("Device")),
                "NodeName": _text_scalar(quick.get("NodeName")),
                "DedicatedLink": _text_scalar(quick.get("DedicatedLink")),
                "Passphrase": _text_scalar(quick.get("Passphrase")),
            }
        )
    irows: list[dict[str, str]] = []
    if inter:
        aux = _unwrap_block(inter.get("Auxilliary"))
        irows.append(
            {
                "Device": _text_scalar(inter.get("Device")),
                "NodeName": _text_scalar(inter.get("NodeName")),
                "ClusterID": _text_scalar(inter.get("ClusterID")),
                "Passphrase": _text_scalar(inter.get("Passphrase")),
                "DedicatedLink": _text_scalar(inter.get("DedicatedLink")),
                "DedicatedLinkIPAddress": _text_scalar(inter.get("DedicatedLinkIPAddress")),
                "KeepAlive_Interval": _text_scalar(inter.get("KeepAlive_Interval")),
                "KeepAlive_Attempts": _text_scalar(inter.get("KeepAlive_Attempts")),
                "HostMAC": _text_scalar(inter.get("HostMAC")),
                "FallbackPrimaryDevice": _text_scalar(inter.get("FallbackPrimaryDevice")),
                "Auxilliary.DedicatedLink": _text_scalar(aux.get("DedicatedLink")) if aux else "",
                "Auxilliary.Passphrase": _text_scalar(aux.get("Passphrase")) if aux else "",
            }
        )
    return {
        "quick_rows": qrows,
        "interactive_rows": irows,
        "monitor_ports": _monitor_port_names(inter),
        "peer_rows": _peer_admin_rows(inter),
        "flags": _ha_flags(root),
    }


def build_ha_form_model(root: dict[str, Any]) -> dict[str, Any]:
    """
    Normalized view for the HA flyout UI, aligned with xml-api-docs ``HAConfigure.md``
    (HA_Quick, HA_Interactive, Auxiliary, MonitorPorts, PeerAdministrationList, etc.).
    """
    quick = _unwrap_block(root.get("HA_Quick"))
    inter = _unwrap_block(root.get("HA_Interactive"))
    mode = _ha_configuration_mode(quick, inter)
    device_raw = ""
    if inter and _interactive_nonempty(inter):
        device_raw = _text_scalar(inter.get("Device"))
    elif quick:
        device_raw = _text_scalar(quick.get("Device"))
    device_norm = _normalize_ha_device(device_raw)
    passphrase = _passphrase_from_blocks(quick, inter)
    ded = _dedicated_ha_link_display(quick, inter)

    host_mac = _text_scalar(inter.get("HostMAC")) if inter else ""
    host_mac_lc = host_mac.casefold()
    hypervisor_mac_on = host_mac_lc in ("enable", "enabled", "on")

    return {
        "configuration_mode": mode,
        "device_raw": device_raw,
        "device_normalized": device_norm,
        "cluster_id": _text_scalar(inter.get("ClusterID")) if inter else "",
        "node_name": _text_scalar(inter.get("NodeName"))
        if inter and _text_scalar(inter.get("NodeName"))
        else (_text_scalar(quick.get("NodeName")) if quick else ""),
        "passphrase_set": bool(passphrase),
        "passphrase_masked": "••••••••" if passphrase else "",
        "passphrase_copy": passphrase,
        "dedicated_ha_link": ded,
        "dedicated_peer_ha_ipv4": _text_scalar(inter.get("DedicatedLinkIPAddress"))
        if inter
        else "",
        "monitor_ports": _monitor_port_names(inter),
        "peer_rows": _peer_admin_rows(inter),
        "preferred_primary": _text_scalar(inter.get("FallbackPrimaryDevice"))
        if inter
        else "",
        "keepalive_interval": _text_scalar(inter.get("KeepAlive_Interval")) if inter else "",
        "keepalive_attempts": _text_scalar(inter.get("KeepAlive_Attempts")) if inter else "",
        "use_hypervisor_mac": hypervisor_mac_on,
        "host_mac_raw": host_mac,
        "flags": _ha_flags(root),
    }


def _table_scalar_fields(
    quick: dict[str, Any] | None, inter: dict[str, Any] | None
) -> dict[str, str]:
    """Prefer interactive values when that block carries configuration."""
    use_i = _interactive_nonempty(inter)
    q = quick or {}
    i = inter or {}
    device = _text_scalar(i.get("Device")) if use_i else ""
    if not device:
        device = _text_scalar(q.get("Device"))
    node = _text_scalar(i.get("NodeName")) if use_i else ""
    if not node:
        node = _text_scalar(q.get("NodeName"))
    ded = _dedicated_ha_link_display(quick, inter)
    return {
        "Device": device,
        "NodeName": node,
        "DedicatedLink": ded,
        "ClusterID": _text_scalar(i.get("ClusterID")),
        "DedicatedLinkIPAddress": _text_scalar(i.get("DedicatedLinkIPAddress")),
        "KeepAlive_Interval": _text_scalar(i.get("KeepAlive_Interval")),
        "KeepAlive_Attempts": _text_scalar(i.get("KeepAlive_Attempts")),
        "HostMAC": _text_scalar(i.get("HostMAC")),
        "FallbackPrimaryDevice": _text_scalar(i.get("FallbackPrimaryDevice")),
    }


def interface_names_by_firewall_id(
    db: Session, firewall_ids: list[int]
) -> dict[int, list[str]]:
    if not firewall_ids:
        return {}
    rows = (
        db.query(FirewallConfigEntry.firewall_id, FirewallConfigEntry.external_name)
        .filter(
            FirewallConfigEntry.firewall_id.in_(firewall_ids),
            FirewallConfigEntry.entity_type.in_(ENTITY_TYPES_INTERFACES_TAB),
        )
        .all()
    )
    buckets: dict[int, set[str]] = defaultdict(set)
    for fid, name in rows:
        n = (name or "").strip()
        if n:
            buckets[int(fid)].add(n)
    return {fid: sorted(names) for fid, names in buckets.items()}


def build_ha_configure_table_payload(
    db: Session, firewall_ids: list[int]
) -> dict[str, Any]:
    columns = [
        "__name",
        "__firewall_description",
        "Device",
        "NodeName",
        "DedicatedLink",
        "ClusterID",
        "MonitorPorts",
        "Interface",
        "DedicatedLinkIPAddress",
        "KeepAlive_Interval",
        "KeepAlive_Attempts",
        "HostMAC",
        "FallbackPrimaryDevice",
    ]
    column_labels = {
        "__name": "Firewall",
        "__firewall_description": "Firewall description",
        "Device": "Device",
        "NodeName": "NodeName",
        "DedicatedLink": "DedicatedLink",
        "ClusterID": "ClusterID",
        "MonitorPorts": "MonitorPorts",
        "Interface": "Interface",
        "DedicatedLinkIPAddress": "DedicatedLinkIPAddress",
        "KeepAlive_Interval": "KeepAlive_Interval",
        "KeepAlive_Attempts": "KeepAlive_Attempts",
        "HostMAC": "HostMAC",
        "FallbackPrimaryDevice": "FallbackPrimaryDevice",
    }
    columns_visible_by_default = [
        "__name",
        "Device",
        "NodeName",
        "DedicatedLink",
        "ClusterID",
        "MonitorPorts",
        "Interface",
    ]
    if not firewall_ids:
        return {
            "columns": columns,
            "column_labels": column_labels,
            "columns_visible_by_default": columns_visible_by_default,
            "rows": [],
        }

    if_names = interface_names_by_firewall_id(db, firewall_ids)

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
            FirewallConfigEntry.entity_type == ENTITY_HA_CONFIGURE,
        )
        .all()
    )
    by_fw: dict[int, FirewallConfigEntry] = {e.firewall_id: e for e in entries}

    out_rows: list[dict[str, Any]] = []
    for fw in fw_rows:
        display = (fw.name or "").strip() or (fw.host or "").strip() or str(fw.id)
        fw_desc = (fw.description or "").strip()
        ent = by_fw.get(fw.id)
        in_cache = ent is not None
        root: dict[str, Any] = {}
        if ent:
            try:
                raw = json.loads(ent.payload_json)
            except json.JSONDecodeError:
                raw = {}
            root = raw if isinstance(raw, dict) else {}

        quick = _unwrap_block(root.get("HA_Quick"))
        inter = _unwrap_block(root.get("HA_Interactive"))
        scalars = _table_scalar_fields(quick, inter)
        mon = _monitor_port_names(inter)
        peers = _peer_admin_rows(inter)
        peer_ifaces = [p["Interface"] for p in peers if p.get("Interface")]

        mon_join = _LIST_SEP.join(mon) if mon else ""
        peer_join = _LIST_SEP.join(peer_ifaces) if peer_ifaces else ""

        search_parts = [
            display.lower(),
            fw_desc.lower() if fw_desc else "",
            *[x.lower() for x in scalars.values() if x],
            *[x.lower() for x in mon],
            *[x.lower() for x in peer_ifaces],
        ]

        flyout = _flyout_sections(root)
        flyout["raw"] = root
        ha_form = build_ha_form_model(root) if in_cache else None

        names_lc = {n.casefold() for n in if_names.get(fw.id, [])}

        gc_cell_html: dict[str, str] = {}
        gc_cell_sort: dict[str, str] = {}
        if mon:
            pr = _iface_pills_row(mon, names_lc)
            if pr:
                gc_cell_html["MonitorPorts"] = pr
                gc_cell_sort["MonitorPorts"] = " ".join(mon)
        if peer_ifaces:
            pr2 = _iface_pills_row(peer_ifaces, names_lc)
            if pr2:
                gc_cell_html["Interface"] = pr2
                gc_cell_sort["Interface"] = " ".join(peer_ifaces)
        dl = scalars["DedicatedLink"]
        if dl.strip():
            gc_cell_html["DedicatedLink"] = _iface_scalar_cell(dl, names_lc)
            gc_cell_sort["DedicatedLink"] = dl.strip()

        out_rows.append(
            {
                "entity_type": ENTITY_HA_CONFIGURE,
                "firewall_id": fw.id,
                "config_entry_id": ent.id if ent else None,
                "ha_in_cache": in_cache,
                "interface_names": if_names.get(fw.id, []),
                "interface_names_lower": sorted(names_lc),
                "ha_flyout": flyout,
                "ha_form": ha_form,
                "gc_cell_html": gc_cell_html or None,
                "gc_cell_sort": gc_cell_sort or None,
                "cells": {
                    "__name": display,
                    "__firewall_description": fw_desc,
                    "Device": scalars["Device"],
                    "NodeName": scalars["NodeName"],
                    "DedicatedLink": scalars["DedicatedLink"],
                    "ClusterID": scalars["ClusterID"],
                    "MonitorPorts": mon_join,
                    "Interface": peer_join,
                    "DedicatedLinkIPAddress": scalars["DedicatedLinkIPAddress"],
                    "KeepAlive_Interval": scalars["KeepAlive_Interval"],
                    "KeepAlive_Attempts": scalars["KeepAlive_Attempts"],
                    "HostMAC": scalars["HostMAC"],
                    "FallbackPrimaryDevice": scalars["FallbackPrimaryDevice"],
                },
                "search": " ".join([p for p in search_parts if p]),
            }
        )

    return {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": columns_visible_by_default,
        "rows": out_rows,
    }
