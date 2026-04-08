"""Read-only Protect · Firewall rules table from cached ``firewall_rule`` config entries."""

from __future__ import annotations

import json
from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from app.firewall_config_sync import ENTITY_FIREWALL_RULE, ENTITY_FIREWALL_RULE_GROUP
from app.models import Firewall, FirewallConfigEntry
from app.web_protect_cache_table import _scalar_from_payload


def _first_dict_block(data: dict[str, Any], key: str) -> dict[str, Any] | None:
    v = data.get(key)
    if isinstance(v, list) and v:
        v = v[0]
    return v if isinstance(v, dict) else None


def _rule_action(data: dict[str, Any]) -> str:
    for k in ("UserPolicy", "NetworkPolicy", "HTTPBasedPolicy"):
        block = _first_dict_block(data, k)
        if block:
            a = _scalar_from_payload(block, "Action")
            if a:
                return a
    return ""


def _rule_after_name(data: dict[str, Any]) -> str:
    after = data.get("After")
    if isinstance(after, list) and after:
        after = after[0]
    if isinstance(after, dict):
        return _scalar_from_payload(after, "Name")
    if after is None:
        return ""
    return str(after).strip()


def _normalized_rule_name(name: str | None) -> str:
    return str(name or "").strip().casefold()


def _string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        out: list[str] = []
        for item in value:
            out.extend(_string_list(item))
        return out
    if isinstance(value, dict):
        out: list[str] = []
        for v in value.values():
            out.extend(_string_list(v))
        return out
    text = str(value).strip()
    return [text] if text else []


def _security_policy_names_from_group_payload(data: dict[str, Any]) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()

    def _push(raw: Any) -> None:
        for name in _string_list(raw):
            key = _normalized_rule_name(name)
            if not key or key in seen:
                continue
            seen.add(key)
            names.append(name)

    _push(data.get("SecurityPolicy"))
    spl = data.get("SecurityPolicyList")
    if isinstance(spl, dict):
        _push(spl.get("SecurityPolicy"))
    elif isinstance(spl, list):
        for block in spl:
            if isinstance(block, dict):
                _push(block.get("SecurityPolicy"))
            else:
                _push(block)
    return names


def _compute_rule_positions(rule_refs: list[tuple[str, str]]) -> list[int]:
    """
    Compute 1-based intended order from (rule_name, after_name) references.
    Falls back to input order for malformed/cyclic graphs.
    """
    count = len(rule_refs)
    if count < 2:
        return [1] if count else []
    by_name: dict[str, int] = {}
    for idx, (name, _) in enumerate(rule_refs):
        key = str(name or "").strip()
        if key and key not in by_name:
            by_name[key] = idx
    children: dict[int, list[int]] = defaultdict(list)
    has_valid_parent = [False] * count
    for idx, (_, after_name) in enumerate(rule_refs):
        ref = str(after_name or "").strip()
        parent = by_name.get(ref)
        if parent is None or parent == idx:
            continue
        has_valid_parent[idx] = True
        children[parent].append(idx)
    roots = [idx for idx in range(count) if not has_valid_parent[idx]]
    ordered: list[int] = []
    seen: set[int] = set()
    deferred: list[int] = []

    def append_chain(start_idx: int) -> None:
        cur = start_idx
        while cur not in seen:
            seen.add(cur)
            ordered.append(cur)
            followers = [x for x in children.get(cur, []) if x not in seen]
            if not followers:
                return
            cur = followers[0]
            if len(followers) > 1:
                deferred.extend(followers[1:])

    for root in roots:
        if root in seen:
            continue
        append_chain(root)
        while deferred:
            nxt = deferred.pop(0)
            if nxt not in seen:
                append_chain(nxt)
    for idx in range(count):
        if idx not in seen:
            append_chain(idx)

    positions = [0] * count
    for pos, idx in enumerate(ordered, start=1):
        positions[idx] = pos
    return positions


def build_firewall_rule_table_payload(db: Session, firewall_ids: list[int]) -> dict[str, Any]:
    columns = [
        "__position",
        "__name",
        "__group",
        "__description",
        "__status",
        "__ip_family",
        "__section",
        "__policy_type",
        "__action",
        "__firewall",
    ]
    column_labels = {
        "__position": "Position",
        "__name": "Name",
        "__group": "Group",
        "__description": "Description",
        "__status": "Status",
        "__ip_family": "IP family",
        "__section": "Section",
        "__policy_type": "Policy type",
        "__action": "Action",
        "__firewall": "Firewall",
    }

    def cells(
        data: dict[str, Any], ent: FirewallConfigEntry, fw_label: str, group_name: str
    ) -> dict[str, str]:
        name = _scalar_from_payload(data, "Name") or (ent.external_name or "")
        desc = _scalar_from_payload(data, "Description") or _scalar_from_payload(data, "Desc")
        return {
            "__position": "",
            "__name": name,
            "__group": group_name,
            "__description": desc,
            "__status": _scalar_from_payload(data, "Status"),
            "__ip_family": _scalar_from_payload(data, "IPFamily"),
            "__section": _scalar_from_payload(data, "Section"),
            "__policy_type": _scalar_from_payload(data, "PolicyType"),
            "__action": _rule_action(data),
            "__firewall": fw_label,
        }

    if not firewall_ids:
        rows: list[dict[str, Any]] = []
        return {
            "columns": columns,
            "column_labels": column_labels,
            "columns_visible_by_default": list(columns),
            "rows": rows,
        }

    group_rows_db = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.entity_type == ENTITY_FIREWALL_RULE_GROUP,
            FirewallConfigEntry.firewall_id.in_(firewall_ids),
        )
        .order_by(FirewallConfigEntry.firewall_id.asc(), FirewallConfigEntry.external_name.asc())
        .all()
    )
    rule_group_by_firewall: dict[int, dict[str, list[str]]] = defaultdict(dict)
    for group_ent in group_rows_db:
        try:
            group_payload = json.loads(group_ent.payload_json)
        except json.JSONDecodeError:
            group_payload = {}
        if not isinstance(group_payload, dict):
            group_payload = {}
        group_name = (
            _scalar_from_payload(group_payload, "Name") or str(group_ent.external_name or "").strip()
        )
        if not group_name:
            continue
        fw_rule_groups = rule_group_by_firewall[int(group_ent.firewall_id)]
        for rule_name in _security_policy_names_from_group_payload(group_payload):
            rule_key = _normalized_rule_name(rule_name)
            if not rule_key:
                continue
            names = fw_rule_groups.setdefault(rule_key, [])
            if group_name not in names:
                names.append(group_name)

    rows_db = (
        db.query(FirewallConfigEntry, Firewall)
        .join(Firewall, Firewall.id == FirewallConfigEntry.firewall_id)
        .filter(
            FirewallConfigEntry.entity_type == ENTITY_FIREWALL_RULE,
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
        rule_name = _scalar_from_payload(data, "Name") or (ent.external_name or "")
        rule_key = _normalized_rule_name(rule_name)
        group_names = rule_group_by_firewall.get(int(fw.id), {}).get(rule_key, [])
        c = cells(data, ent, fw_label, group_names[0] if group_names else "")
        fw_id = int(fw.id)
        if fw_id not in rows_by_firewall:
            firewall_order.append(fw_id)
        rows_by_firewall[fw_id].append(
            {
                "entity_type": ENTITY_FIREWALL_RULE,
                "firewall_id": fw.id,
                "firewall_label": fw_label,
                "config_entry_id": ent.id,
                "cells": c,
                "__rule_name": c.get("__name", ""),
                "__after_name": _rule_after_name(data),
                "__firewall_host": (fw.host or "").strip(),
            }
        )

    rows: list[dict[str, Any]] = []
    for fw_id in firewall_order:
        group = rows_by_firewall[fw_id]
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
        "columns_visible_by_default": list(columns),
        "rows": rows,
    }
