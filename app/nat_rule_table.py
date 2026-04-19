"""Read-only Protect · Firewall NAT rules table from cached ``nat_rule`` config entries.

Mirrors :mod:`app.firewall_rule_table` for the ``nat_rule`` entity.  We keep the
same intended-order computation (``Position`` + ``After`` graph) so the per-firewall
drag-to-reorder UX in the page works identically for NAT rules.

Schema reference: ``xml-api-docs/Protect/Firewall/NatRule.md`` (root ``<NATRule>``).
"""

from __future__ import annotations

import json
from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from app.firewall_config_sync import ENTITY_NAT_RULE
from app.firewall_rule_table import (
    _compute_rule_positions,
    _rule_after_name,
    _sync_index_from_payload,
)
from app.models import Firewall, FirewallConfigEntry
from app.web_protect_cache_table import _scalar_from_payload


def _string_join(value: Any, *, max_items: int | None = 4) -> str:
    """Render an XML repeating element (``<Network>x</Network>...``) as a comma list.

    Accepts the dict-with-list, list-of-dicts, list-of-strings and bare-string
    shapes that ``xmltodict``-style parsers produce.  We stop after ``max_items``
    and append an ellipsis so the table cell stays scannable.
    """
    if value is None:
        return ""
    items: list[str] = []

    def _push(raw: Any) -> None:
        if raw is None:
            return
        if isinstance(raw, list):
            for item in raw:
                _push(item)
            return
        if isinstance(raw, dict):
            for v in raw.values():
                _push(v)
            return
        text = str(raw).strip()
        if text:
            items.append(text)

    _push(value)
    if not items:
        return ""
    if max_items is not None and len(items) > max_items:
        head = items[:max_items]
        return ", ".join(head) + f" +{len(items) - max_items} more"
    return ", ".join(items)


def _members_from_container(data: dict[str, Any], container: str, child: str) -> Any:
    """Pull the child list out of a ``<Container><Child>...</Child></Container>`` block.

    Tolerates both the bare-list shape (``{"OriginalSourceNetworks": ["a", "b"]}``)
    and the wrapped shape produced by ``xmltodict``
    (``{"OriginalSourceNetworks": {"Network": ["a", "b"]}}``).
    """
    block = data.get(container)
    if block is None:
        return None
    if isinstance(block, list):
        # Could be a list of wrapper dicts or a list of bare strings.
        if block and isinstance(block[0], dict):
            collected: list[Any] = []
            for entry in block:
                if isinstance(entry, dict):
                    collected.append(entry.get(child))
            return collected
        return block
    if isinstance(block, dict):
        return block.get(child)
    return block


def build_nat_rule_table_payload(db: Session, firewall_ids: list[int]) -> dict[str, Any]:
    columns = [
        "__position",
        "__name",
        "__description",
        "__status",
        "__ip_family",
        "__original_src",
        "__original_dst",
        "__original_service",
        "__translated_src",
        "__translated_dst",
        "__translated_service",
        "__inbound_if",
        "__outbound_if",
        "__linked_rule",
        "__firewall",
    ]
    column_labels = {
        "__position": "Position",
        "__name": "Name",
        "__description": "Description",
        "__status": "Status",
        "__ip_family": "IP family",
        "__original_src": "Original source",
        "__original_dst": "Original destination",
        "__original_service": "Original service",
        "__translated_src": "Translated source",
        "__translated_dst": "Translated destination",
        "__translated_service": "Translated service",
        "__inbound_if": "Inbound interfaces",
        "__outbound_if": "Outbound interfaces",
        "__linked_rule": "Linked firewall rule",
        "__firewall": "Firewall",
    }
    # Hide the busier columns by default so the cells fit on screen; the user
    # can opt in via the column picker.  Keep the same defaults the firewall
    # rules table uses (Position / Name / Status / IP family / Action-equivalent
    # primary translation columns + Firewall).
    columns_visible_by_default = [
        "__position",
        "__name",
        "__status",
        "__ip_family",
        "__original_src",
        "__original_dst",
        "__translated_src",
        "__translated_dst",
        "__firewall",
    ]

    def cells(
        data: dict[str, Any], ent: FirewallConfigEntry, fw_label: str
    ) -> dict[str, str]:
        name = _scalar_from_payload(data, "Name") or (ent.external_name or "")
        desc = _scalar_from_payload(data, "Description") or _scalar_from_payload(data, "Desc")
        original_src = _string_join(
            _members_from_container(data, "OriginalSourceNetworks", "Network")
        )
        original_dst = _string_join(
            _members_from_container(data, "OriginalDestinationNetworks", "Network")
        )
        original_svc = _string_join(_members_from_container(data, "OriginalServices", "Service"))
        inbound = _string_join(_members_from_container(data, "InboundInterfaces", "Interface"))
        outbound = _string_join(_members_from_container(data, "OutboundInterfaces", "Interface"))
        return {
            "__position": "",
            "__name": name,
            "__description": desc,
            "__status": _scalar_from_payload(data, "Status"),
            "__ip_family": _scalar_from_payload(data, "IPFamily"),
            "__original_src": original_src,
            "__original_dst": original_dst,
            "__original_service": original_svc,
            "__translated_src": _scalar_from_payload(data, "TranslatedSource"),
            "__translated_dst": _scalar_from_payload(data, "TranslatedDestination"),
            "__translated_service": _scalar_from_payload(data, "TranslatedService"),
            "__inbound_if": inbound,
            "__outbound_if": outbound,
            "__linked_rule": _scalar_from_payload(data, "LinkedFirewallrule"),
            "__firewall": fw_label,
        }

    if not firewall_ids:
        rows: list[dict[str, Any]] = []
        return {
            "columns": columns,
            "column_labels": column_labels,
            "columns_visible_by_default": columns_visible_by_default,
            "rows": rows,
        }

    rows_db = (
        db.query(FirewallConfigEntry, Firewall)
        .join(Firewall, Firewall.id == FirewallConfigEntry.firewall_id)
        .filter(
            FirewallConfigEntry.entity_type == ENTITY_NAT_RULE,
            FirewallConfigEntry.firewall_id.in_(firewall_ids),
        )
        .order_by(
            Firewall.name.asc().nulls_last(),
            Firewall.host.asc(),
            FirewallConfigEntry.external_name.asc(),
        )
        .all()
    )
    rows_by_firewall: dict[int, list[dict[str, Any]]] = defaultdict(list)
    firewall_order: list[int] = []
    for ent, fw in rows_db:
        try:
            data = json.loads(ent.payload_json)
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        fw_label = (fw.name or "").strip() or (fw.host or "").strip() or str(fw.id)
        c = cells(data, ent, fw_label)
        rule_name = c.get("__name", "")
        fw_id = int(fw.id)
        if fw_id not in rows_by_firewall:
            firewall_order.append(fw_id)
        rows_by_firewall[fw_id].append(
            {
                "entity_type": ENTITY_NAT_RULE,
                "firewall_id": fw.id,
                "firewall_label": fw_label,
                "config_entry_id": ent.id,
                "cells": c,
                "__rule_name": rule_name,
                "__after_name": _rule_after_name(data),
                "__sync_index": _sync_index_from_payload(data),
                "__firewall_host": (fw.host or "").strip(),
            }
        )

    rows: list[dict[str, Any]] = []
    for fw_id in firewall_order:
        group = rows_by_firewall[fw_id]
        # See ``firewall_rule_table.build_firewall_rule_table_payload`` for
        # why we prefer the on-device sync index over the After-chain graph.
        sync_indices = [r.get("__sync_index") for r in group]
        if group and all(isinstance(i, int) and i >= 1 for i in sync_indices):
            positions = [int(i) for i in sync_indices]
        else:
            refs = [
                (str(r.get("__rule_name", "")).strip(), str(r.get("__after_name", "")).strip())
                for r in group
            ]
            positions = _compute_rule_positions(refs)
        for idx, row in enumerate(group):
            p = positions[idx] if idx < len(positions) else (idx + 1)
            row["cells"]["__position"] = str(p)
            row["search"] = " ".join(
                str(v).lower() for v in row["cells"].values() if str(v).strip()
            )
            if row.get("firewall_label"):
                row["search"] += " " + str(row["firewall_label"]).lower()
            if row.get("__firewall_host"):
                row["search"] += " " + str(row["__firewall_host"]).lower()
            row.pop("__rule_name", None)
            row.pop("__after_name", None)
            row.pop("__sync_index", None)
            row.pop("__firewall_host", None)
        group.sort(
            key=lambda r: (
                int(r["cells"].get("__position") or "0"),
                str(r["cells"].get("__name") or "").lower(),
            )
        )
        rows.extend(group)

    return {
        "columns": columns,
        "column_labels": column_labels,
        "columns_visible_by_default": columns_visible_by_default,
        "rows": rows,
    }
