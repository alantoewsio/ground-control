"""Web filter policy rows for Protect · Web (flat + combined)."""

from __future__ import annotations

import json
from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from app.firewall_config_sync import ENTITY_WEBFILTER_POLICY
from app.ips_policy_table import COL_FIREWALLS, COL_POLICY_BODY
from app.models import Firewall, FirewallConfigEntry
from app.webfilter_policy_merge import (
    normalize_webfilter_policy_payload,
    wfp_canonical_json,
)


def _text_scalar(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, dict):
        raw = raw.get("#text") if "#text" in raw else raw.get("text")
    return str(raw).strip()


def _scalar_from_payload(data: dict[str, Any], key: str) -> str:
    return _text_scalar(data.get(key))


def _policy_body_preview(pol: dict[str, Any]) -> str:
    canon = wfp_canonical_json(pol)
    if len(canon) <= 72:
        return canon
    return canon[:71] + "…"


def _wfp_table_rows_flat(
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
        pol = normalize_webfilter_policy_payload(data)
        name = _scalar_from_payload(data, "Name") or ent.external_name
        desc = _scalar_from_payload(data, "Description")
        fw_label = (fw.name or "").strip() or (fw.host or "").strip() or str(fw.id)
        da = _scalar_from_payload(data, "DefaultAction")
        rep = _scalar_from_payload(data, "EnableReporting")
        rl = pol.get("RuleList") if isinstance(pol.get("RuleList"), dict) else {}
        rule = rl.get("Rule") if isinstance(rl, dict) else []
        n_rules = len(rule) if isinstance(rule, list) else (1 if rule else 0)
        search = " ".join(
            [
                name.lower(),
                desc.lower(),
                da.lower(),
                rep.lower(),
                fw_label.lower(),
                (fw.host or "").lower(),
                _policy_body_preview(pol).lower(),
            ]
        )
        rows.append(
            {
                "entity_type": ENTITY_WEBFILTER_POLICY,
                "firewall_id": fw.id,
                "firewall_label": fw_label,
                "config_entry_id": ent.id,
                "policy": pol,
                "cells": {
                    "__name": name,
                    "__description": desc,
                    "__default_action": da,
                    "__reporting": rep,
                    "__rules": str(n_rules),
                    "__firewall": fw_label,
                },
                "search": search,
            }
        )
    return rows


def _wfp_table_rows_combined(
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
        name = (_scalar_from_payload(data, "Name") or ent.external_name or "").strip()
        if not name:
            name = "—"
        desc = _scalar_from_payload(data, "Description")
        fw_label = (fw.name or "").strip() or (fw.host or "").strip() or str(fw.id)
        pol = normalize_webfilter_policy_payload(data)
        canon = wfp_canonical_json(pol)
        if name not in groups:
            order_keys.append(name)
        groups[name].append((ent, fw, pol, desc, fw_label, name, canon))

    out_rows: list[dict[str, Any]] = []
    for gname in order_keys:
        sources = groups[gname]
        fws_ordered: list[str] = []
        fw_seen: set[str] = set()
        for _e, _f, _p, _d, fw_label, _n, _c in sources:
            if fw_label not in fw_seen:
                fw_seen.add(fw_label)
                fws_ordered.append(fw_label)

        desc_by_fw: dict[str, str] = {}
        canon_by_fw: dict[str, str] = {}
        for ent, fw, pol, desc, fw_label, _nm, canon in sources:
            desc_by_fw[fw_label] = desc
            canon_by_fw[fw_label] = canon

        per_field: dict[str, dict[str, str]] = {}
        if len({v for v in desc_by_fw.values()}) > 1:
            per_field["__description"] = dict(desc_by_fw)
        if len({v for v in canon_by_fw.values()}) > 1:
            # Full canonical JSON per firewall so combined-view flyouts can apply one scope’s policy.
            per_field[COL_POLICY_BODY] = dict(canon_by_fw)

        combine_conflict = bool(per_field)
        rep_ent, rep_fw, rep_pol, rep_desc, rep_fw_label, rep_name, rep_canon = sources[0]
        rl = rep_pol.get("RuleList") if isinstance(rep_pol.get("RuleList"), dict) else {}
        rule = rl.get("Rule") if isinstance(rl, dict) else []
        n_rules = len(rule) if isinstance(rule, list) else (1 if rule else 0)

        cells: dict[str, str] = {
            "__name": rep_name,
            "__description": rep_desc,
            "__default_action": _scalar_from_payload(rep_pol, "DefaultAction"),
            "__reporting": _scalar_from_payload(rep_pol, "EnableReporting"),
            "__rules": str(n_rules),
            COL_FIREWALLS: " · ".join(fws_ordered),
            COL_POLICY_BODY: _policy_body_preview(rep_pol),
        }

        fw_ids_merged: list[int] = []
        fw_id_seen: set[int] = set()
        edit_targets: list[dict[str, Any]] = []
        for ent, fw, pol, desc, fw_label, _nm, _c in sources:
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
            "entity_type": ENTITY_WEBFILTER_POLICY,
            "firewall_id": rep_fw.id,
            "firewall_ids": fw_ids_merged,
            "firewall_label": rep_fw_label,
            "firewall_labels": list(fws_ordered),
            "config_entry_id": rep_ent.id,
            "wfp_edit_targets": edit_targets,
            "policy": rep_pol,
            "cells": cells,
            "search": " ".join(search_parts),
            "wfp_combine_conflict": combine_conflict,
        }
        if combine_conflict:
            row_obj["wfp_combine_per_field"] = per_field
        out_rows.append(row_obj)

    return out_rows


def build_webfilter_policy_table_payload(
    db: Session, firewall_ids: list[int], *, combine: bool = True
) -> dict[str, Any]:
    columns_flat = [
        "__name",
        "__description",
        "__default_action",
        "__reporting",
        "__rules",
        "__firewall",
    ]
    column_labels_flat = {
        "__name": "Name",
        "__description": "Description",
        "__default_action": "Default action",
        "__reporting": "Reporting",
        "__rules": "Rules",
        "__firewall": "Firewall",
    }
    columns_combined = [
        "__name",
        "__description",
        "__default_action",
        "__reporting",
        "__rules",
        COL_FIREWALLS,
        COL_POLICY_BODY,
    ]
    column_labels_combined = {
        "__name": "Name",
        "__description": "Description",
        "__default_action": "Default action",
        "__reporting": "Reporting",
        "__rules": "Rules",
        COL_FIREWALLS: "Firewalls",
        COL_POLICY_BODY: "Policy",
    }
    columns_visible_flat = list(columns_flat)
    columns_visible_combined = ["__name", "__description", COL_FIREWALLS, "__rules"]

    meta_false = {
        "wfp_combined": False,
        "wfp_combine_conflicts": False,
    }
    meta_true = {
        "wfp_combined": True,
        "wfp_combine_conflicts": False,
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
            FirewallConfigEntry.entity_type == ENTITY_WEBFILTER_POLICY,
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
        rows = _wfp_table_rows_flat(rows_db)
        return {
            "columns": columns_flat,
            "column_labels": column_labels_flat,
            "columns_visible_by_default": columns_visible_flat,
            "rows": rows,
            **meta_false,
        }

    rows_c = _wfp_table_rows_combined(rows_db)
    conflicts = any(bool(r.get("wfp_combine_conflict")) for r in rows_c)
    return {
        "columns": columns_combined,
        "column_labels": column_labels_combined,
        "columns_visible_by_default": columns_visible_combined,
        "rows": rows_c,
        "wfp_combined": True,
        "wfp_combine_conflicts": conflicts,
    }
