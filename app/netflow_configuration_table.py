"""NetFlow configuration: table payload for selected firewalls (cache row when synced, else zeros/empty)."""

from __future__ import annotations

import html as html_mod
import json
from typing import Any

from sqlalchemy.orm import Session

from app.firewall_config_sync import ENTITY_NETFLOW_CONFIGURATION
from app.models import Firewall, FirewallConfigEntry
from app.netflow_configuration_merge import netflow_servers_from_payload

_LIST_SEP = "\x1e"


def _server_display_name(s: dict[str, str]) -> str:
    n = (s.get("ServerName") or "").strip()
    if n:
        return n
    return (s.get("NetflowServer") or "").strip()


def _hue_label(label: str) -> int:
    h = 0
    for c in label.casefold():
        h = (h * 31 + ord(c)) % 360
    return h


def _name_pills_row(names: list[str]) -> str:
    parts: list[str] = []
    for raw in names:
        n = raw.strip()
        if not n:
            continue
        hue = _hue_label(n)
        esc = html_mod.escape(n)
        parts.append(f'<span class="gc-zone-pill" style="--gc-zone-h: {hue}">{esc}</span>')
    if not parts:
        return ""
    return '<span class="gc-hw-pill-row">' + "".join(parts) + "</span>"


def _count_pill(n: int) -> str:
    t = str(max(0, int(n)))
    return f'<span class="gc-table-value-pill">{html_mod.escape(t)}</span>'


def _table_row_for_firewall_netflow(
    fw: Firewall,
    ent: FirewallConfigEntry | None,
) -> dict[str, Any]:
    display = (fw.name or "").strip() or (fw.host or "").strip() or str(fw.id)
    fw_desc = (fw.description or "").strip()

    root: dict[str, Any] = {}
    config_entry_id: int | None = None
    if ent is not None:
        config_entry_id = ent.id
        try:
            raw = json.loads(ent.payload_json)
        except json.JSONDecodeError:
            raw = {}
        root = raw if isinstance(raw, dict) else {}

    servers = netflow_servers_from_payload(root)
    names = [_server_display_name(s) for s in servers]
    names = [n for n in names if n]
    count = len(servers)

    search_parts = [
        display.lower(),
        fw_desc.lower() if fw_desc else "",
        *[n.lower() for n in names],
        *[s.get("NetflowServer", "").lower() for s in servers],
    ]

    gc_html: dict[str, str] = {
        "netflow_record_count": _count_pill(count),
        "server_names": _name_pills_row(names) if names else "",
    }

    return {
        "entity_type": ENTITY_NETFLOW_CONFIGURATION,
        "firewall_id": fw.id,
        "config_entry_id": config_entry_id,
        "netflow_servers": servers,
        "gc_cell_html": gc_html,
        "gc_cell_sort": {
            "netflow_record_count": f"{count:06d}",
            "server_names": " ".join(names),
        },
        "cells": {
            "__name": display,
            "__firewall_description": fw_desc,
            "netflow_record_count": str(count),
            "server_names": _LIST_SEP.join(names) if names else "",
        },
        "search": " ".join([p for p in search_parts if p]),
    }


def build_netflow_configuration_table_payload(
    db: Session, firewall_ids: list[int]
) -> dict[str, Any]:
    columns = [
        "__name",
        "__firewall_description",
        "netflow_record_count",
        "server_names",
    ]
    column_labels = {
        "__name": "Firewall",
        "__firewall_description": "Firewall description",
        "netflow_record_count": "Records",
        "server_names": "Servers",
    }
    columns_visible_by_default = [
        "__name",
        "netflow_record_count",
        "server_names",
    ]
    if not firewall_ids:
        return {
            "columns": columns,
            "column_labels": column_labels,
            "columns_visible_by_default": columns_visible_by_default,
            "rows": [],
        }

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
            FirewallConfigEntry.entity_type == ENTITY_NETFLOW_CONFIGURATION,
        )
        .all()
    )
    by_fw: dict[int, FirewallConfigEntry] = {e.firewall_id: e for e in entries}

    out_rows: list[dict[str, Any]] = [
        _table_row_for_firewall_netflow(fw, by_fw.get(fw.id)) for fw in fw_rows
    ]

    return {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": columns_visible_by_default,
        "rows": out_rows,
    }
