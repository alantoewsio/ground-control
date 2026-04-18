"""Network · DHCP tab: table rows from cached ``DHCPServer`` XML payloads.

This module supports three DHCP entity types:

* ``dhcp_server`` (IPv4)  — bespoke summary columns kept for IPAM back-compat.
* ``dhcp_server_ipv6``    — generic HS-style flattened table (delegates to
  :func:`app.hosts_services_table.build_hosts_services_table_rows`).
* ``dhcp_relay``          — generic HS-style flattened table (delegates to
  :func:`app.hosts_services_table.build_hosts_services_table_rows`).

The HS-style ``api_firewalls_hosts_services_table?entity_type=…`` endpoint
already dispatches to the generic flattener when the entity is in
``HOSTS_SERVICES_ENTITY_TYPES``; the helpers below exist so other modules
(IPAM, designer catalogs, future tests) can ask "is this a DHCP entity?" or
build combined-view rows without going through the FastAPI layer.
"""

from __future__ import annotations

from typing import Any

from app.hosts_services_table import (
    build_hosts_services_table_rows,
    build_hs_table_rows_combined,
)
from app.interface_table import COL_ID_FIREWALL, flatten_payload

DHCP_ENTITY_TYPES: frozenset[str] = frozenset(
    {"dhcp_server", "dhcp_server_ipv6", "dhcp_relay"}
)


def is_dhcp_entity_type(entity_type: str) -> bool:
    """True when ``entity_type`` is one of the three DHCP cache ids."""
    return (entity_type or "").strip() in DHCP_ENTITY_TYPES

COL_DHCP_NAME = "__name"
COL_DHCP_INTERFACE = "__dhcp_interface"
COL_DHCP_IP_LEASE = "__dhcp_ip_lease"
COL_DHCP_STATIC = "__dhcp_static_leases"

DHCP_PRIMARY_ORDER = [
    COL_DHCP_NAME,
    COL_DHCP_INTERFACE,
    COL_DHCP_IP_LEASE,
    COL_DHCP_STATIC,
    COL_ID_FIREWALL,
]

DHCP_COLUMN_LABELS: dict[str, str] = {
    COL_DHCP_NAME: "Server name",
    COL_DHCP_INTERFACE: "Interface",
    COL_DHCP_IP_LEASE: "Dynamic lease ranges",
    COL_DHCP_STATIC: "Static leases",
    COL_ID_FIREWALL: "Firewall",
}

DHCP_DEFAULT_VISIBLE = [
    COL_DHCP_NAME,
    COL_DHCP_INTERFACE,
    COL_DHCP_IP_LEASE,
    COL_DHCP_STATIC,
    COL_ID_FIREWALL,
]


def _xml_text(node: Any) -> str:
    if node is None:
        return ""
    if isinstance(node, dict) and "#text" in node:
        return str(node["#text"]).strip()
    return str(node).strip()


def _normalize_ip_lease_list(data: dict[str, Any]) -> list[str]:
    block = data.get("IPLease")
    if block is None:
        return []
    if isinstance(block, dict):
        raw = block.get("IP")
    else:
        raw = None
    if raw is None:
        return []
    if isinstance(raw, list):
        return [_xml_text(x) for x in raw if _xml_text(x)]
    s = _xml_text(raw)
    return [s] if s else []


def iter_static_lease_dicts(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Yield lease dicts from ``StaticLease`` / ``Lease`` (xmltodict shapes)."""
    sl = data.get("StaticLease")
    if sl is None:
        return []
    if isinstance(sl, dict):
        raw = sl.get("Lease")
    else:
        raw = None
    if raw is None:
        return []
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    if isinstance(raw, dict):
        return [raw]
    return []


def static_lease_summary(data: dict[str, Any]) -> tuple[str, int]:
    leases = iter_static_lease_dicts(data)
    if not leases:
        return "", 0
    parts: list[str] = []
    for L in leases[:12]:
        hn = _xml_text(L.get("HostName"))
        ip = _xml_text(L.get("IPAddress"))
        mac = _xml_text(L.get("MACAddress"))
        chunk = hn or ip or mac or "lease"
        if ip and ip != chunk:
            chunk = f"{chunk} → {ip}"
        parts.append(chunk)
    more = len(leases) - len(parts)
    s = " · ".join(parts)
    if more > 0:
        s = f"{s} (+{more} more)" if s else f"+{more} more"
    return s, len(leases)


def _exclude_from_dhcp_extras(key: str) -> bool:
    if key in ("Name", "Interface"):
        return True
    if key.startswith("IPLease") or key.startswith("StaticLease"):
        return True
    return False


def build_dhcp_server_table_rows(
    parsed: list[tuple[Any, Any, dict[str, Any]]],
) -> dict[str, Any]:
    """
    ``parsed`` is (FirewallConfigEntry|ConfigurationConfigEntry, Firewall|Configuration, payload).
    """
    key_union: set[str] = set()
    flat_per_row: list[dict[str, str]] = []
    for _ent, _parent, data in parsed:
        flat = flatten_payload(data)
        flat_per_row.append(flat)
        key_union.update(flat.keys())
    extras = sorted(k for k in key_union if not _exclude_from_dhcp_extras(k))
    columns = DHCP_PRIMARY_ORDER + extras
    column_labels = dict(DHCP_COLUMN_LABELS)
    for k in extras:
        column_labels[k] = k if "." not in k else k.rsplit(".", 1)[-1]

    out_rows: list[dict[str, Any]] = []
    for (ent, parent, data), flat in zip(parsed, flat_per_row, strict=True):
        pname = getattr(parent, "name", None) or getattr(parent, "host", None)
        fw_label = (pname or str(getattr(parent, "id", ""))).strip()
        name_val = _xml_text(data.get("Name")) or getattr(ent, "external_name", "") or ""
        iface = _xml_text(data.get("Interface"))
        ranges = _normalize_ip_lease_list(data)
        lease_disp = " · ".join(ranges) if ranges else ""
        static_disp, _n = static_lease_summary(data)

        cells: dict[str, str] = {
            COL_DHCP_NAME: name_val,
            COL_DHCP_INTERFACE: iface,
            COL_DHCP_IP_LEASE: lease_disp,
            COL_DHCP_STATIC: static_disp,
            COL_ID_FIREWALL: fw_label,
        }
        for k in extras:
            cells[k] = flat.get(k, "")

        search_parts = [
            fw_label.lower(),
            str(getattr(ent, "external_name", "")).lower(),
            name_val.lower(),
            iface.lower(),
            lease_disp.lower(),
            static_disp.lower(),
        ]
        for k in columns:
            search_parts.append((cells.get(k) or "").lower())

        out_rows.append(
            {
                "cells": cells,
                "search": " ".join(search_parts),
                "flat": flat,
                "raw_payload": data,
                "entity_type": "dhcp_server",
                "config_entry_id": ent.id,
                "firewall_id": parent.id,
            }
        )

    return {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": DHCP_DEFAULT_VISIBLE,
        "rows": out_rows,
    }


def build_dhcp_server_ipv6_table_rows(
    parsed: list[tuple[Any, Any, dict[str, Any]]],
) -> dict[str, Any]:
    """Per-firewall flattened table for ``DHCPServerIpv6`` cache entries."""
    return build_hosts_services_table_rows(parsed, entity_type="dhcp_server_ipv6")


def build_dhcp_relay_table_rows(
    parsed: list[tuple[Any, Any, dict[str, Any]]],
) -> dict[str, Any]:
    """Per-firewall flattened table for ``DHCPRelay`` cache entries."""
    return build_hosts_services_table_rows(parsed, entity_type="dhcp_relay")


def build_dhcp_table_rows_combined(
    parsed: list[tuple[Any, Any, dict[str, Any]]],
    *,
    entity_type: str,
    combine_by: str | None = None,
) -> dict[str, Any]:
    """Combined / configuration view for any DHCP entity type.

    For ``dhcp_server`` (IPv4) the combined view also delegates to the generic
    HS combiner so cross-firewall identity merge works the same as Routing /
    LSACL.  The bespoke summary columns from :func:`build_dhcp_server_table_rows`
    are only used by IPAM / the legacy single-firewall view.
    """
    et = (entity_type or "").strip()
    if et not in DHCP_ENTITY_TYPES:
        raise ValueError(f"Not a DHCP entity_type: {entity_type!r}")
    return build_hs_table_rows_combined(
        parsed, entity_type=et, combine_by=combine_by
    )
