"""Profiles · system policy rows (schedules, quotas, VPN profiles) with optional combined view."""

from __future__ import annotations

import json
from collections import defaultdict
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.firewall_config_sync import (
    ENTITY_ACCESS_TIME_POLICY,
    ENTITY_ADMIN_PROFILE,
    ENTITY_DATA_TRANSFER_POLICY,
    ENTITY_SCHEDULE,
    ENTITY_SURFING_QUOTA_POLICY,
    ENTITY_VPN_PROFILE,
)
from app.models import Firewall, FirewallConfigEntry


def _text_scalar(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, dict):
        raw = raw.get("#text") if "#text" in raw else raw.get("text")
    return str(raw).strip()


def _scalar_from_payload(data: dict[str, Any], key: str) -> str:
    return _text_scalar(data.get(key))


def _schedule_type_cell(data: dict[str, Any]) -> str:
    raw = _scalar_from_payload(data, "Type")
    if raw == "OneTime":
        return "One time"
    if raw == "Recurring":
        return "Recurring"
    return raw


def _access_time_strategy_cell(data: dict[str, Any]) -> str:
    raw = _scalar_from_payload(data, "Strategy")
    if not raw:
        return "Allow"
    u = raw.upper()
    if u in ("Y", "ALLOW"):
        return "Allow"
    if u in ("N", "DENY"):
        return "Deny"
    return raw


def _payload_canonical(data: dict[str, Any]) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), default=str)


# Table column ids where Sophos/API strings differ only by casing or spacing (false drift).
_PROFILE_DRIFT_CASEFOLD_COLS = frozenset(
    {
        "__schedule",
        "__keying",
        "__cycle",
        "__period",
        "__restriction",
        "__type",
    }
)


def _normalize_drift_scalar(column_id: str, val: str) -> str:
    """Normalize cell text for combined-view equality (not for display)."""
    s = (val or "").strip()
    if column_id in _PROFILE_DRIFT_CASEFOLD_COLS:
        return " ".join(s.casefold().split())
    return s


def _detail_preview(canonical: str, max_len: int = 80) -> str:
    s = canonical.strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def _rows_db(
    db: Session, firewall_ids: list[int], entity_type: str
) -> list[tuple[FirewallConfigEntry, Firewall]]:
    if not firewall_ids:
        return []
    return (
        db.query(FirewallConfigEntry, Firewall)
        .join(Firewall, Firewall.id == FirewallConfigEntry.firewall_id)
        .filter(
            FirewallConfigEntry.entity_type == entity_type,
            FirewallConfigEntry.firewall_id.in_(firewall_ids),
        )
        .order_by(
            Firewall.name.asc().nulls_last(),
            Firewall.host.asc(),
            FirewallConfigEntry.external_name.asc(),
        )
        .all()
    )


def _flat_rows(
    rows_db: list[tuple[FirewallConfigEntry, Firewall]],
    *,
    entity_type: str,
    cell_values: Callable[[dict[str, Any]], dict[str, str]],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for ent, fw in rows_db:
        try:
            data = json.loads(ent.payload_json)
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        fw_label = (fw.name or "").strip() or (fw.host or "").strip() or str(fw.id)
        cells = cell_values(data)
        cells = {**cells, "__firewall": fw_label}
        search_parts = [str(v).lower() for v in cells.values() if v]
        search_parts.append(fw_label.lower())
        if fw.host:
            search_parts.append((fw.host or "").lower())
        out.append(
            {
                "entity_type": entity_type,
                "firewall_id": fw.id,
                "firewall_label": fw_label,
                "config_entry_id": ent.id,
                "external_name": ent.external_name,
                "cells": cells,
                "search": " ".join(search_parts),
                "payload": data,
            }
        )
    return out


def _combined_rows(
    rows_db: list[tuple[FirewallConfigEntry, Firewall]],
    *,
    entity_type: str,
    meta_prefix: str,
    detail_column_id: str,
    cell_values: Callable[[dict[str, Any]], dict[str, str]],
    drift_granularity: str = "canonical",
) -> tuple[list[dict[str, Any]], bool]:
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
        if name not in groups:
            order_keys.append(name)
        fw_label = (fw.name or "").strip() or (fw.host or "").strip() or str(fw.id)
        groups[name].append((ent, fw, data, fw_label))

    out_rows: list[dict[str, Any]] = []
    conflicts_any = False
    targets_key = f"{meta_prefix}_edit_targets"
    conflict_key = f"{meta_prefix}_combine_conflict"
    per_field_key = f"{meta_prefix}_combine_per_field"

    for gname in order_keys:
        sources = groups[gname]
        fws_ordered: list[str] = []
        fw_seen: set[str] = set()
        for _ent, _fw, _data, fw_label in sources:
            if fw_label not in fw_seen:
                fw_seen.add(fw_label)
                fws_ordered.append(fw_label)

        canon_by_fw: dict[str, str] = {}
        for ent, fw, data, fw_label in sources:
            canon_by_fw[fw_label] = _payload_canonical(data)

        per_field: dict[str, dict[str, str]] = {}
        if drift_granularity == "cells":
            cells_by_fw: dict[str, dict[str, str]] = {}
            for ent, fw, data, fw_label in sources:
                cells_by_fw[fw_label] = cell_values(data)
            col_order: list[str] = []
            seen_c: set[str] = set()
            for fw_l in fws_ordered:
                for ck in cells_by_fw.get(fw_l, {}):
                    if ck not in seen_c:
                        seen_c.add(ck)
                        col_order.append(ck)
            for col_id in col_order:
                norms = {
                    fw_l: _normalize_drift_scalar(
                        col_id, cells_by_fw.get(fw_l, {}).get(col_id, "")
                    )
                    for fw_l in fws_ordered
                }
                if len({norms[fw_l] for fw_l in fws_ordered}) > 1:
                    per_field[col_id] = {
                        fw_l: cells_by_fw.get(fw_l, {}).get(col_id, "")
                        for fw_l in fws_ordered
                    }
        elif len({v for v in canon_by_fw.values()}) > 1:
            per_field[detail_column_id] = dict(canon_by_fw)

        combine_conflict = bool(per_field)
        if combine_conflict:
            conflicts_any = True

        rep_ent, rep_fw, rep_data, rep_fw_label = sources[0]
        rep_cells_base = cell_values(rep_data)
        rep_canon = canon_by_fw[rep_fw_label]
        cells: dict[str, str] = {
            **rep_cells_base,
            "__firewalls": " · ".join(fws_ordered),
            detail_column_id: _detail_preview(rep_canon),
        }

        fw_ids_merged: list[int] = []
        fw_id_seen: set[int] = set()
        edit_targets: list[dict[str, Any]] = []
        for ent, fw, data, fw_label in sources:
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
            gname.lower(),
            " ".join(x.lower() for x in fws_ordered),
            (rep_fw.host or "").lower(),
            rep_canon.lower(),
        ]
        row_obj: dict[str, Any] = {
            "entity_type": entity_type,
            "firewall_id": rep_fw.id,
            "firewall_ids": fw_ids_merged,
            "firewall_label": rep_fw_label,
            "firewall_labels": list(fws_ordered),
            "config_entry_id": rep_ent.id,
            targets_key: edit_targets,
            "payload": rep_data,
            "cells": cells,
            "search": " ".join(search_parts),
            conflict_key: combine_conflict,
        }
        if combine_conflict:
            row_obj[per_field_key] = per_field
        out_rows.append(row_obj)

    return out_rows, conflicts_any


def build_profile_entity_table_payload(
    db: Session,
    firewall_ids: list[int],
    *,
    entity_type: str,
    meta_prefix: str,
    detail_column_id: str,
    columns_flat: list[str],
    column_labels_flat: dict[str, str],
    columns_combined: list[str],
    column_labels_combined: dict[str, str],
    columns_visible_flat: list[str],
    columns_visible_combined: list[str],
    cell_values: Callable[[dict[str, Any]], dict[str, str]],
    combine: bool = True,
    drift_granularity: str = "canonical",
) -> dict[str, Any]:
    """Generic named-profile table with optional per-name merge across firewalls."""
    meta_false = {
        f"{meta_prefix}_combined": False,
        f"{meta_prefix}_combine_conflicts": False,
    }
    meta_true = {
        f"{meta_prefix}_combined": True,
        f"{meta_prefix}_combine_conflicts": False,
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

    rows_db = _rows_db(db, firewall_ids, entity_type)

    if not combine:
        rows = _flat_rows(
            rows_db, entity_type=entity_type, cell_values=cell_values
        )
        return {
            "columns": columns_flat,
            "column_labels": column_labels_flat,
            "columns_visible_by_default": columns_visible_flat,
            "rows": rows,
            **meta_false,
        }

    rows_c, conflicts = _combined_rows(
        rows_db,
        entity_type=entity_type,
        meta_prefix=meta_prefix,
        detail_column_id=detail_column_id,
        cell_values=cell_values,
        drift_granularity=drift_granularity,
    )
    return {
        "columns": columns_combined,
        "column_labels": column_labels_combined,
        "columns_visible_by_default": columns_visible_combined,
        "rows": rows_c,
        f"{meta_prefix}_combined": True,
        f"{meta_prefix}_combine_conflicts": conflicts,
    }


COL_SCHED_DETAIL = "__schedule_detail"
COL_AT_DETAIL = "__at_detail"
COL_SQ_DETAIL = "__sq_detail"
COL_DT_DETAIL = "__dt_detail"
COL_VPN_DETAIL = "__vpn_detail"
COL_AP_DETAIL = "__ap_detail"


def build_schedule_table_payload(
    db: Session, firewall_ids: list[int], *, combine: bool = True
) -> dict[str, Any]:
    def cells(data: dict[str, Any]) -> dict[str, str]:
        return {
            "__name": _scalar_from_payload(data, "Name"),
            "__type": _schedule_type_cell(data),
            "__description": _scalar_from_payload(data, "Description"),
        }

    return build_profile_entity_table_payload(
        db,
        firewall_ids,
        entity_type=ENTITY_SCHEDULE,
        meta_prefix="schedule",
        detail_column_id=COL_SCHED_DETAIL,
        columns_flat=["__name", "__type", "__description", "__firewall"],
        column_labels_flat={
            "__name": "Name",
            "__type": "Type",
            "__description": "Description",
            "__firewall": "Firewall",
        },
        columns_combined=[
            "__name",
            "__type",
            "__description",
            "__firewalls",
            COL_SCHED_DETAIL,
        ],
        column_labels_combined={
            "__name": "Name",
            "__type": "Type",
            "__description": "Description",
            "__firewalls": "Firewalls",
            COL_SCHED_DETAIL: "Definition",
        },
        columns_visible_flat=["__name", "__type", "__description", "__firewall"],
        columns_visible_combined=["__name", "__type", "__description", "__firewalls"],
        cell_values=cells,
        combine=combine,
    )


def build_access_time_policy_table_payload(
    db: Session, firewall_ids: list[int], *, combine: bool = True
) -> dict[str, Any]:
    def cells(data: dict[str, Any]) -> dict[str, str]:
        return {
            "__name": _scalar_from_payload(data, "Name"),
            "__strategy": _access_time_strategy_cell(data),
            "__schedule": _scalar_from_payload(data, "Schedule"),
            "__description": _scalar_from_payload(data, "Description"),
        }

    return build_profile_entity_table_payload(
        db,
        firewall_ids,
        entity_type=ENTITY_ACCESS_TIME_POLICY,
        meta_prefix="accesstime",
        detail_column_id=COL_AT_DETAIL,
        columns_flat=["__name", "__strategy", "__schedule", "__description", "__firewall"],
        column_labels_flat={
            "__name": "Name",
            "__strategy": "Strategy",
            "__schedule": "Schedule",
            "__description": "Description",
            "__firewall": "Firewall",
        },
        columns_combined=[
            "__name",
            "__strategy",
            "__schedule",
            "__description",
            "__firewalls",
            COL_AT_DETAIL,
        ],
        column_labels_combined={
            "__name": "Name",
            "__strategy": "Strategy",
            "__schedule": "Schedule",
            "__description": "Description",
            "__firewalls": "Firewalls",
            COL_AT_DETAIL: "Definition",
        },
        columns_visible_flat=[
            "__name",
            "__strategy",
            "__schedule",
            "__description",
            "__firewall",
        ],
        columns_visible_combined=[
            "__name",
            "__strategy",
            "__schedule",
            "__description",
            "__firewalls",
        ],
        cell_values=cells,
        combine=combine,
        drift_granularity="cells",
    )


def build_surfing_quota_policy_table_payload(
    db: Session, firewall_ids: list[int], *, combine: bool = True
) -> dict[str, Any]:
    def cells(data: dict[str, Any]) -> dict[str, str]:
        return {
            "__name": _scalar_from_payload(data, "Name"),
            "__cycle": _scalar_from_payload(data, "CycleType"),
            "__period": _scalar_from_payload(data, "PerDay"),
            "__description": _scalar_from_payload(data, "Description"),
        }

    return build_profile_entity_table_payload(
        db,
        firewall_ids,
        entity_type=ENTITY_SURFING_QUOTA_POLICY,
        meta_prefix="surfingquota",
        detail_column_id=COL_SQ_DETAIL,
        columns_flat=["__name", "__cycle", "__period", "__description", "__firewall"],
        column_labels_flat={
            "__name": "Name",
            "__cycle": "Cycle type",
            "__period": "Period",
            "__description": "Description",
            "__firewall": "Firewall",
        },
        columns_combined=[
            "__name",
            "__cycle",
            "__period",
            "__description",
            "__firewalls",
            COL_SQ_DETAIL,
        ],
        column_labels_combined={
            "__name": "Name",
            "__cycle": "Cycle type",
            "__period": "Period",
            "__description": "Description",
            "__firewalls": "Firewalls",
            COL_SQ_DETAIL: "Definition",
        },
        columns_visible_flat=["__name", "__cycle", "__period", "__description", "__firewall"],
        columns_visible_combined=[
            "__name",
            "__cycle",
            "__period",
            "__description",
            "__firewalls",
        ],
        cell_values=cells,
        combine=combine,
    )


def build_data_transfer_policy_table_payload(
    db: Session, firewall_ids: list[int], *, combine: bool = True
) -> dict[str, Any]:
    def cells(data: dict[str, Any]) -> dict[str, str]:
        return {
            "__name": _scalar_from_payload(data, "Name"),
            "__restriction": _scalar_from_payload(data, "RestrictionBasedOn"),
            "__cycle": _scalar_from_payload(data, "CycleType"),
            "__description": _scalar_from_payload(data, "Description"),
        }

    return build_profile_entity_table_payload(
        db,
        firewall_ids,
        entity_type=ENTITY_DATA_TRANSFER_POLICY,
        meta_prefix="datatransfer",
        detail_column_id=COL_DT_DETAIL,
        columns_flat=[
            "__name",
            "__restriction",
            "__cycle",
            "__description",
            "__firewall",
        ],
        column_labels_flat={
            "__name": "Name",
            "__restriction": "Restriction",
            "__cycle": "Cycle type",
            "__description": "Description",
            "__firewall": "Firewall",
        },
        columns_combined=[
            "__name",
            "__restriction",
            "__cycle",
            "__description",
            "__firewalls",
            COL_DT_DETAIL,
        ],
        column_labels_combined={
            "__name": "Name",
            "__restriction": "Restriction",
            "__cycle": "Cycle type",
            "__description": "Description",
            "__firewalls": "Firewalls",
            COL_DT_DETAIL: "Definition",
        },
        columns_visible_flat=[
            "__name",
            "__restriction",
            "__cycle",
            "__description",
            "__firewall",
        ],
        columns_visible_combined=[
            "__name",
            "__restriction",
            "__cycle",
            "__description",
            "__firewalls",
        ],
        cell_values=cells,
        combine=combine,
    )


def build_vpn_profile_table_payload(
    db: Session, firewall_ids: list[int], *, combine: bool = True
) -> dict[str, Any]:
    def cells(data: dict[str, Any]) -> dict[str, str]:
        return {
            "__name": _scalar_from_payload(data, "Name"),
            "__keying": _scalar_from_payload(data, "KeyingMethod"),
            "__description": _scalar_from_payload(data, "Description"),
        }

    return build_profile_entity_table_payload(
        db,
        firewall_ids,
        entity_type=ENTITY_VPN_PROFILE,
        meta_prefix="vpnprofile",
        detail_column_id=COL_VPN_DETAIL,
        columns_flat=["__name", "__keying", "__description", "__firewall"],
        column_labels_flat={
            "__name": "Name",
            "__keying": "Keying method",
            "__description": "Description",
            "__firewall": "Firewall",
        },
        columns_combined=[
            "__name",
            "__keying",
            "__description",
            "__firewalls",
            COL_VPN_DETAIL,
        ],
        column_labels_combined={
            "__name": "Name",
            "__keying": "Keying method",
            "__description": "Description",
            "__firewalls": "Firewalls",
            COL_VPN_DETAIL: "Definition",
        },
        columns_visible_flat=["__name", "__keying", "__description", "__firewall"],
        columns_visible_combined=["__name", "__keying", "__description", "__firewalls"],
        cell_values=cells,
        combine=combine,
    )


def build_admin_profile_table_payload(
    db: Session, firewall_ids: list[int], *, combine: bool = True
) -> dict[str, Any]:
    """Administration profiles (device access) with optional per-name merge across firewalls."""

    def cells(data: dict[str, Any]) -> dict[str, str]:
        return {
            "__name": _scalar_from_payload(data, "Name"),
        }

    return build_profile_entity_table_payload(
        db,
        firewall_ids,
        entity_type=ENTITY_ADMIN_PROFILE,
        meta_prefix="adminprofile",
        detail_column_id=COL_AP_DETAIL,
        columns_flat=["__name", "__firewall"],
        column_labels_flat={
            "__name": "Profile name",
            "__firewall": "Firewall",
        },
        columns_combined=["__name", "__firewalls", COL_AP_DETAIL],
        column_labels_combined={
            "__name": "Profile name",
            "__firewalls": "Firewalls",
            COL_AP_DETAIL: "Definition",
        },
        columns_visible_flat=["__name", "__firewall"],
        columns_visible_combined=["__name", "__firewalls"],
        cell_values=cells,
        combine=combine,
    )
