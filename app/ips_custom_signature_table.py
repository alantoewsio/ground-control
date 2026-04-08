"""IPS custom signature rows for Firewalls · Intrusion Prevention · Custom signatures."""

from __future__ import annotations

import json
from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from app.firewall_config_sync import ENTITY_IPS_CUSTOM_SIGNATURE
from app.models import Firewall, FirewallConfigEntry

COL_FIREWALLS = "__firewalls"
COL_CUSTOM_RULE = "__custom_rule"


def _text_scalar(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, dict):
        raw = raw.get("#text") if "#text" in raw else raw.get("text")
    return str(raw).strip()


def _scalar_from_payload(data: dict[str, Any], key: str) -> str:
    return _text_scalar(data.get(key))


def _rule_preview(rule: str) -> str:
    return rule if len(rule) <= 80 else rule[:77] + "…"


def _ips_sig_rows_flat(
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
        proto = _scalar_from_payload(data, "Protocol")
        sev = _scalar_from_payload(data, "Severity")
        action = _scalar_from_payload(data, "RecommendedAction")
        rule = _scalar_from_payload(data, "CustomRule")
        fw_label = (fw.name or "").strip() or (fw.host or "").strip() or str(fw.id)
        preview = _rule_preview(rule)
        search = " ".join(
            [
                name.lower(),
                proto.lower(),
                sev.lower(),
                action.lower(),
                fw_label.lower(),
                (fw.host or "").lower(),
                rule.lower(),
            ]
        )
        rows.append(
            {
                "entity_type": ENTITY_IPS_CUSTOM_SIGNATURE,
                "firewall_id": fw.id,
                "firewall_label": fw_label,
                "config_entry_id": ent.id,
                "signature": data,
                "cells": {
                    "__name": name,
                    "__protocol": proto,
                    "__severity": sev,
                    "__action": action,
                    "__firewall": fw_label,
                    "__rule_preview": preview,
                },
                "search": search,
            }
        )
    return rows


def _ips_sig_rows_combined(
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
        proto = _scalar_from_payload(data, "Protocol")
        sev = _scalar_from_payload(data, "Severity")
        action = _scalar_from_payload(data, "RecommendedAction")
        rule = _scalar_from_payload(data, "CustomRule")
        fw_label = (fw.name or "").strip() or (fw.host or "").strip() or str(fw.id)
        if name not in groups:
            order_keys.append(name)
        groups[name].append((ent, fw, data, name, proto, sev, action, rule, fw_label))

    out_rows: list[dict[str, Any]] = []
    for gname in order_keys:
        sources = groups[gname]
        fws_ordered: list[str] = []
        fw_seen: set[str] = set()
        for _e, _f, _d, _n, _p, _s, _a, _r, fw_label in sources:
            if fw_label not in fw_seen:
                fw_seen.add(fw_label)
                fws_ordered.append(fw_label)

        proto_by_fw: dict[str, str] = {}
        sev_by_fw: dict[str, str] = {}
        act_by_fw: dict[str, str] = {}
        rule_by_fw: dict[str, str] = {}
        for _ent, _fw, _data, _nm, proto, sev, action, rule, fw_label in sources:
            proto_by_fw[fw_label] = proto
            sev_by_fw[fw_label] = sev
            act_by_fw[fw_label] = action
            rule_by_fw[fw_label] = rule

        per_field: dict[str, dict[str, str]] = {}
        if len({v for v in proto_by_fw.values()}) > 1:
            per_field["__protocol"] = dict(proto_by_fw)
        if len({v for v in sev_by_fw.values()}) > 1:
            per_field["__severity"] = dict(sev_by_fw)
        if len({v for v in act_by_fw.values()}) > 1:
            per_field["__action"] = dict(act_by_fw)
        if len({v for v in rule_by_fw.values()}) > 1:
            per_field[COL_CUSTOM_RULE] = dict(rule_by_fw)

        combine_conflict = bool(per_field)
        rep_ent, rep_fw, rep_data, rep_name, rep_proto, rep_sev, rep_action, rep_rule, rep_fw_label = (
            sources[0]
        )
        rep_preview = _rule_preview(rep_rule)

        cells: dict[str, str] = {
            "__name": rep_name,
            "__protocol": rep_proto,
            "__severity": rep_sev,
            "__action": rep_action,
            COL_FIREWALLS: " · ".join(fws_ordered),
            "__rule_preview": rep_preview,
            COL_CUSTOM_RULE: rep_preview,
        }

        fw_ids_merged: list[int] = []
        fw_id_seen: set[int] = set()
        edit_targets: list[dict[str, Any]] = []
        for ent, fw, data, nm, proto, sev, action, rule, fw_label in sources:
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
                rep_name.lower(),
                rep_proto.lower(),
                rep_sev.lower(),
                rep_action.lower(),
                " ".join(x.lower() for x in fws_ordered),
                (rep_fw.host or "").lower(),
                rep_rule.lower(),
            ]
        )
        row_obj: dict[str, Any] = {
            "entity_type": ENTITY_IPS_CUSTOM_SIGNATURE,
            "firewall_id": rep_fw.id,
            "firewall_ids": fw_ids_merged,
            "firewall_label": rep_fw_label,
            "firewall_labels": list(fws_ordered),
            "config_entry_id": rep_ent.id,
            "ips_custom_sig_edit_targets": edit_targets,
            "signature": rep_data,
            "cells": cells,
            "search": search,
            "ips_custom_sig_combine_conflict": combine_conflict,
        }
        if combine_conflict:
            row_obj["ips_custom_sig_combine_per_field"] = per_field
        out_rows.append(row_obj)

    return out_rows


def build_ips_custom_signature_table_payload(
    db: Session, firewall_ids: list[int], *, combine: bool = True
) -> dict[str, Any]:
    columns_flat = [
        "__name",
        "__protocol",
        "__severity",
        "__action",
        "__firewall",
        "__rule_preview",
    ]
    column_labels_flat = {
        "__name": "Name",
        "__protocol": "Protocol",
        "__severity": "Severity",
        "__action": "Recommended action",
        "__firewall": "Firewall",
        "__rule_preview": "Custom rule",
    }
    columns_combined = [
        "__name",
        "__protocol",
        "__severity",
        "__action",
        COL_FIREWALLS,
        "__rule_preview",
        COL_CUSTOM_RULE,
    ]
    column_labels_combined = {
        "__name": "Name",
        "__protocol": "Protocol",
        "__severity": "Severity",
        "__action": "Recommended action",
        COL_FIREWALLS: "Firewalls",
        "__rule_preview": "Custom rule",
        COL_CUSTOM_RULE: "Custom rule (full)",
    }
    columns_visible_flat = [
        "__name",
        "__protocol",
        "__severity",
        "__action",
        "__firewall",
    ]
    columns_visible_combined = [
        "__name",
        "__protocol",
        "__severity",
        "__action",
        COL_FIREWALLS,
    ]

    meta_false = {
        "ips_custom_sig_combined": False,
        "ips_custom_sig_combine_conflicts": False,
    }
    meta_true = {
        "ips_custom_sig_combined": True,
        "ips_custom_sig_combine_conflicts": False,
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
            FirewallConfigEntry.entity_type == ENTITY_IPS_CUSTOM_SIGNATURE,
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
        rows = _ips_sig_rows_flat(rows_db)
        return {
            "columns": columns_flat,
            "column_labels": column_labels_flat,
            "columns_visible_by_default": columns_visible_flat,
            "rows": rows,
            **meta_false,
        }

    rows_c = _ips_sig_rows_combined(rows_db)
    conflicts = any(bool(r.get("ips_custom_sig_combine_conflict")) for r in rows_c)
    return {
        "columns": columns_combined,
        "column_labels": column_labels_combined,
        "columns_visible_by_default": columns_visible_combined,
        "rows": rows_c,
        "ips_custom_sig_combined": True,
        "ips_custom_sig_combine_conflicts": conflicts,
    }
