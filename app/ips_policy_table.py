"""IPS policy rows for Firewalls · Intrusion Prevention · Policy table."""

from __future__ import annotations

import json
from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from app.firewall_config_sync import ENTITY_IPS_POLICY
from app.models import Firewall, FirewallConfigEntry

COL_FIREWALLS = "__firewalls"
COL_POLICY_BODY = "__policy_body"


def _text_scalar(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, dict):
        raw = raw.get("#text") if "#text" in raw else raw.get("text")
    return str(raw).strip()


def _scalar_from_payload(data: dict[str, Any], key: str) -> str:
    return _text_scalar(data.get(key))


def _policy_canonical_json(pol: dict[str, Any]) -> str:
    return json.dumps(pol, sort_keys=True, separators=(",", ":"), default=str)


def _policy_body_cell_preview(canonical: str, max_len: int = 72) -> str:
    s = canonical.strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def normalize_ips_policy_payload(raw: dict[str, Any]) -> dict[str, Any]:
    """Return a deep-copied JSON-friendly policy dict with RuleList.Rule as a list."""
    import copy

    out = copy.deepcopy(raw) if isinstance(raw, dict) else {}
    rl = out.get("RuleList")
    if not isinstance(rl, dict):
        out["RuleList"] = {"Rule": []}
        return out
    rule = rl.get("Rule")
    if rule is None:
        rl["Rule"] = []
    elif isinstance(rule, dict):
        rl["Rule"] = [rule]
    elif isinstance(rule, list):
        rl["Rule"] = [r for r in rule if isinstance(r, dict)]
    else:
        rl["Rule"] = []
    return out


def _ips_policy_table_rows_flat(
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
        name = _scalar_from_payload(data, "Name") or ent.external_name
        desc = _scalar_from_payload(data, "Description")
        fw_label = (fw.name or "").strip() or (fw.host or "").strip() or str(fw.id)
        pol = normalize_ips_policy_payload(data)
        search = " ".join(
            [
                name.lower(),
                desc.lower(),
                fw_label.lower(),
                (fw.host or "").lower(),
            ]
        )
        rows.append(
            {
                "entity_type": ENTITY_IPS_POLICY,
                "firewall_id": fw.id,
                "firewall_label": fw_label,
                "config_entry_id": ent.id,
                "policy": pol,
                "cells": {
                    "__name": name,
                    "__description": desc,
                    "__firewall": fw_label,
                },
                "search": search,
            }
        )
    return rows


def _ips_policy_table_rows_combined(
    rows_db: list[tuple[FirewallConfigEntry, Firewall]],
) -> list[dict[str, Any]]:
    """Merge rows by policy name; detect description / full-policy drift per firewall."""
    groups: dict[str, list[Any]] = defaultdict(list)
    order_keys: list[str] = []

    for ent, fw in rows_db:
        try:
            data = json.loads(ent.payload_json)
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        name = (_scalar_from_payload(data, "Name") or ent.external_name or "").strip()
        if not name:
            name = "—"
        desc = _scalar_from_payload(data, "Description")
        fw_label = (fw.name or "").strip() or (fw.host or "").strip() or str(fw.id)
        pol = normalize_ips_policy_payload(data)
        if name not in groups:
            order_keys.append(name)
        groups[name].append((ent, fw, pol, desc, fw_label, name))

    out_rows: list[dict[str, Any]] = []
    for gname in order_keys:
        sources = groups[gname]
        fws_ordered: list[str] = []
        fw_seen: set[str] = set()
        for _ent, _fw, _pol, _desc, fw_label, _nm in sources:
            if fw_label not in fw_seen:
                fw_seen.add(fw_label)
                fws_ordered.append(fw_label)

        desc_by_fw: dict[str, str] = {}
        canon_by_fw: dict[str, str] = {}
        for ent, fw, pol, desc, fw_label, _nm in sources:
            desc_by_fw[fw_label] = desc
            canon_by_fw[fw_label] = _policy_canonical_json(pol)

        per_field: dict[str, dict[str, str]] = {}
        if len({v for v in desc_by_fw.values()}) > 1:
            per_field["__description"] = dict(desc_by_fw)
        if len({v for v in canon_by_fw.values()}) > 1:
            per_field[COL_POLICY_BODY] = dict(canon_by_fw)

        combine_conflict = bool(per_field)
        rep_ent, rep_fw, rep_pol, rep_desc, rep_fw_label, rep_name = sources[0]
        rep_canon = canon_by_fw[rep_fw_label]

        cells: dict[str, str] = {
            "__name": rep_name,
            "__description": rep_desc,
            COL_FIREWALLS: " · ".join(fws_ordered),
            COL_POLICY_BODY: _policy_body_cell_preview(rep_canon),
        }

        fw_ids_merged: list[int] = []
        fw_id_seen: set[int] = set()
        edit_targets: list[dict[str, Any]] = []
        for ent, fw, pol, desc, fw_label, _nm in sources:
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

        search_parts = [
            rep_name.lower(),
            rep_desc.lower(),
            " ".join(x.lower() for x in fws_ordered),
            (rep_fw.host or "").lower(),
            rep_canon.lower(),
        ]
        row_obj: dict[str, Any] = {
            "entity_type": ENTITY_IPS_POLICY,
            "firewall_id": rep_fw.id,
            "firewall_ids": fw_ids_merged,
            "firewall_label": rep_fw_label,
            "firewall_labels": list(fws_ordered),
            "config_entry_id": rep_ent.id,
            "ips_policy_edit_targets": edit_targets,
            "policy": rep_pol,
            "cells": cells,
            "search": " ".join(search_parts),
            "ips_policy_combine_conflict": combine_conflict,
        }
        if combine_conflict:
            row_obj["ips_policy_combine_per_field"] = per_field
        out_rows.append(row_obj)

    return out_rows


def build_ips_policy_table_payload(
    db: Session, firewall_ids: list[int], *, combine: bool = True
) -> dict[str, Any]:
    columns_flat = ["__name", "__description", "__firewall"]
    column_labels_flat = {
        "__name": "Name",
        "__description": "Description",
        "__firewall": "Firewall",
    }
    columns_combined = ["__name", "__description", COL_FIREWALLS, COL_POLICY_BODY]
    column_labels_combined = {
        "__name": "Name",
        "__description": "Description",
        COL_FIREWALLS: "Firewalls",
        COL_POLICY_BODY: "Policy content",
    }
    columns_visible_flat = list(columns_flat)
    columns_visible_combined = ["__name", "__description", COL_FIREWALLS]

    meta_false = {
        "ips_policy_combined": False,
        "ips_policy_combine_conflicts": False,
    }
    meta_true = {
        "ips_policy_combined": True,
        "ips_policy_combine_conflicts": False,
    }

    if not firewall_ids:
        if combine:
            return {
                "columns": columns_combined,
                "column_labels": column_labels_combined,
                "columns_visible_by_default": columns_visible_combined,
                "rows": [],
                **meta_true,
            }
        return {
            "columns": columns_flat,
            "column_labels": column_labels_flat,
            "columns_visible_by_default": columns_visible_flat,
            "rows": [],
            **meta_false,
        }

    rows_db = (
        db.query(FirewallConfigEntry, Firewall)
        .join(Firewall, Firewall.id == FirewallConfigEntry.firewall_id)
        .filter(
            FirewallConfigEntry.entity_type == ENTITY_IPS_POLICY,
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
        rows = _ips_policy_table_rows_flat(rows_db)
        return {
            "columns": columns_flat,
            "column_labels": column_labels_flat,
            "columns_visible_by_default": columns_visible_flat,
            "rows": rows,
            **meta_false,
        }

    rows_c = _ips_policy_table_rows_combined(rows_db)
    conflicts = any(bool(r.get("ips_policy_combine_conflict")) for r in rows_c)
    return {
        "columns": columns_combined,
        "column_labels": column_labels_combined,
        "columns_visible_by_default": columns_visible_combined,
        "rows": rows_c,
        "ips_policy_combined": True,
        "ips_policy_combine_conflicts": conflicts,
    }
