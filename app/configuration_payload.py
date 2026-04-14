"""API payloads for Configuration virtual firewalls (remap firewall_* fields → configuration_*)."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.firewall_config_sync import (
    ENTITY_ALIAS,
    ENTITY_BRIDGE_PAIR,
    ENTITY_DHCP_SERVER,
    ENTITY_INTERFACE,
    ENTITY_LAG,
    ENTITY_VLAN,
    ENTITY_ZONE,
)
from app.dhcp_server_table import build_dhcp_server_table_rows
from app.hosts_services_table import (
    build_hosts_services_table_rows,
    build_hs_table_rows_combined,
    build_ip_host_table_rows_combined,
)
from app.interface_table import (
    build_interface_table_rows,
    build_unified_interfaces_tab_rows,
    build_unified_interfaces_tab_rows_combined,
    build_zone_network_table_rows,
    build_zone_network_table_rows_flat,
    interface_payload_is_lag_master,
    lag_hardware_name_from_payload,
)
from app.models import Configuration, ConfigurationConfigEntry


def _deep_remap_hs_object(obj: Any) -> None:
    if isinstance(obj, dict):
        if "firewall_id" in obj:
            obj["configuration_id"] = obj.pop("firewall_id")
        if "firewall_label" in obj:
            obj["configuration_label"] = obj.pop("firewall_label")
        if "firewall_labels" in obj and "configuration_labels" not in obj:
            obj["configuration_labels"] = obj.pop("firewall_labels")
        if "firewall_ids" in obj and "configuration_ids" not in obj:
            obj["configuration_ids"] = obj.pop("firewall_ids")
        for k, v in list(obj.items()):
            if k in ("configuration_id", "configuration_label", "configuration_labels"):
                continue
            _deep_remap_hs_object(v)
    elif isinstance(obj, list):
        for x in obj:
            _deep_remap_hs_object(x)


def remap_hs_api_payload_for_configuration(payload: dict[str, Any]) -> dict[str, Any]:
    """Mutates payload: Firewall column → Configuration, ids on rows and nested edit targets."""
    cl = payload.get("column_labels")
    if isinstance(cl, dict):
        if cl.get("firewall") == "Firewall":
            cl["firewall"] = "Configuration"
    for row in payload.get("rows") or []:
        if isinstance(row, dict):
            _deep_remap_hs_object(row)
    return payload


def _parsed_configuration_entries(
    db: Session, configuration_ids: list[int], entity_type: str
) -> list[tuple[ConfigurationConfigEntry, Configuration, dict[str, Any]]]:
    rows_db = (
        db.query(ConfigurationConfigEntry, Configuration)
        .join(Configuration, Configuration.id == ConfigurationConfigEntry.configuration_id)
        .filter(
            ConfigurationConfigEntry.entity_type == entity_type,
            ConfigurationConfigEntry.configuration_id.in_(configuration_ids),
        )
        .order_by(
            Configuration.name.asc().nulls_last(),
            Configuration.id.asc(),
            ConfigurationConfigEntry.external_name.asc(),
        )
        .all()
    )
    parsed: list[tuple[ConfigurationConfigEntry, Configuration, dict[str, Any]]] = []
    for ent, cfg in rows_db:
        try:
            data = json.loads(ent.payload_json)
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        parsed.append((ent, cfg, data))
    return parsed


def configuration_network_table_payload(
    db: Session,
    configuration_ids: list[int],
    entity_type: str,
    *,
    zones_combine: bool = True,
) -> dict[str, Any]:
    if not configuration_ids:
        empty: dict[str, Any] = {
            "columns": [],
            "column_labels": {},
            "columns_visible_by_default": [],
            "rows": [],
        }
        if entity_type == ENTITY_ZONE:
            empty["zones_combine_conflicts"] = False
            empty["zones_combined"] = zones_combine
        return empty

    parsed = _parsed_configuration_entries(db, configuration_ids, entity_type)
    if entity_type == ENTITY_ZONE:
        payload = (
            build_zone_network_table_rows(parsed)
            if zones_combine
            else build_zone_network_table_rows_flat(parsed)
        )
    elif entity_type == ENTITY_DHCP_SERVER:
        payload = build_dhcp_server_table_rows(parsed)
    else:
        payload = build_interface_table_rows(parsed)

    cl = payload.get("column_labels")
    if isinstance(cl, dict):
        if cl.get("firewall") == "Firewall":
            cl["firewall"] = "Configuration"
        if cl.get("__firewalls") == "Firewalls":
            cl["__firewalls"] = "Configurations"
    for row in payload.get("rows") or []:
        if isinstance(row, dict) and "firewall_id" in row:
            row["configuration_id"] = row.pop("firewall_id")
    if entity_type == ENTITY_ZONE:
        for row in payload.get("rows") or []:
            if not isinstance(row, dict):
                continue
            if "firewall_labels" in row:
                row["configuration_labels"] = row.pop("firewall_labels")
            fwi = row.get("firewall_ids")
            if isinstance(fwi, list) and fwi:
                row["configuration_ids"] = list(fwi)
            zt = row.get("zone_edit_targets")
            if isinstance(zt, list):
                for t in zt:
                    if isinstance(t, dict) and "firewall_id" in t:
                        t["configuration_id"] = t.pop("firewall_id")
    return payload


def configuration_unified_interfaces_payload(
    db: Session, configuration_ids: list[int], *, combine: bool = True
) -> dict[str, Any]:
    """Interfaces tab: interface + VLAN + bridge-pair + LAG + alias rows (Type column, ``entity_type``)."""
    if not configuration_ids:
        return {
            "columns": [],
            "column_labels": {},
            "columns_visible_by_default": [],
            "rows": [],
            "interfaces_combined": combine,
            "interfaces_combine_conflicts": False,
        }
    lag_hw_by_cfg: dict[int, set[str]] = {}
    for ent, cfg, _data in _parsed_configuration_entries(
        db, configuration_ids, ENTITY_LAG
    ):
        lag_hw_by_cfg.setdefault(cfg.id, set()).add(ent.external_name)

    tagged: list[tuple[ConfigurationConfigEntry, Configuration, dict[str, Any], str, str]] = []
    for et in (ENTITY_INTERFACE, ENTITY_VLAN, ENTITY_BRIDGE_PAIR, ENTITY_LAG, ENTITY_ALIAS):
        for ent, cfg, data in _parsed_configuration_entries(db, configuration_ids, et):
            if et == ENTITY_INTERFACE:
                if interface_payload_is_lag_master(data):
                    hw_lag = lag_hardware_name_from_payload(data)
                    if hw_lag and hw_lag in lag_hw_by_cfg.get(cfg.id, set()):
                        continue
            tagged.append((ent, cfg, data, et, "configuration"))
    tagged.sort(
        key=lambda t: (
            (t[1].name or "").lower(),
            str(t[1].id),
            t[0].external_name.lower(),
        )
    )
    if combine:
        payload = build_unified_interfaces_tab_rows_combined(tagged)
    else:
        payload = build_unified_interfaces_tab_rows(tagged)
    cl = payload.get("column_labels")
    if isinstance(cl, dict):
        if cl.get("firewall") == "Firewall":
            cl["firewall"] = "Configuration"
        if cl.get("__firewalls") == "Firewalls":
            cl["__firewalls"] = "Configurations"
    return payload


def configuration_hosts_services_table_payload(
    db: Session,
    configuration_ids: list[int],
    entity_type: str,
    *,
    combine: bool = True,
    combine_by: str | None = None,
) -> dict[str, Any]:
    if not configuration_ids:
        empty: dict[str, Any] = {
            "columns": [],
            "column_labels": {},
            "columns_visible_by_default": [],
            "rows": [],
            "hs_combined": combine,
            "hs_combine_conflicts": False,
        }
        if entity_type == "ip_host":
            empty["ip_hosts_combine_conflicts"] = False
            empty["ip_hosts_combined"] = combine
        return empty

    parsed = _parsed_configuration_entries(db, configuration_ids, entity_type)
    if combine:
        if entity_type == "ip_host":
            payload = build_ip_host_table_rows_combined(parsed, combine_by=combine_by)
        else:
            payload = build_hs_table_rows_combined(
                parsed, entity_type=entity_type, combine_by=combine_by
            )
    else:
        payload = build_hosts_services_table_rows(parsed, entity_type=entity_type)

    return remap_hs_api_payload_for_configuration(payload)
