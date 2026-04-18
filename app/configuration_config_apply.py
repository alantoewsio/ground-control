"""Apply Hosts & Services / Network edits to configurations via the task queue (cache on approval)."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.firewall_config_sync import (
    ENTITY_ALIAS,
    ENTITY_BRIDGE_PAIR,
    ENTITY_INTERFACE,
    ENTITY_IP_HOST,
    ENTITY_IP_HOSTGROUP,
    ENTITY_LAG,
    ENTITY_VLAN,
    ENTITY_ZONE,
)
from app.interface_flyout_merge import (
    alias_create_merged_payload,
    bridge_pair_create_merged_payload,
    bridge_pair_member_iface_set_from_payload,
    lag_create_merged_payload,
    lag_member_iface_set_from_payload,
    merge_alias_flyout_form,
    merge_bridge_pair_flyout_form,
    merge_interface_flyout_form,
    merge_lag_flyout_form,
    merge_vlan_flyout_form,
    merge_zone_flyout_form,
    zone_create_merged_payload,
)
from app.ip_host_flyout_merge import merge_ip_host_flyout_form
from app.models import Configuration, ConfigurationConfigEntry
from app.task_queue_service import (
    HS_TASK_ENTITY_TYPES,
    LagCreateCacheConflictError,
    enqueue_configuration_delete,
    enqueue_configuration_merged,
    hs_entity_external_name,
    hs_entity_identity_label,
    merge_hs_flyout_form,
)

NETWORK_CONFIG_DELETABLE_TYPES = frozenset(
    {
        ENTITY_VLAN,
        ENTITY_BRIDGE_PAIR,
        ENTITY_LAG,
        ENTITY_ALIAS,
        ENTITY_ZONE,
    }
)

def _json_dump(obj: dict[str, Any]) -> str:
    return json.dumps(obj, separators=(",", ":"), default=str)

def _configuration_exists(db: Session, configuration_id: int) -> bool:
    return db.get(Configuration, configuration_id) is not None

def _json_mapping_from_entry_payload(payload_json: str) -> dict[str, Any]:
    try:
        raw = json.loads(payload_json)
    except json.JSONDecodeError:
        return {}
    return raw if isinstance(raw, dict) else {}


def _validate_lag_create_against_configuration_cache(
    db: Session,
    *,
    configuration_id: int,
    merged: dict[str, Any],
    force: bool,
) -> None:
    if force:
        return
    hw = str(merged.get("Hardware") or "").strip()
    new_ifs = lag_member_iface_set_from_payload(merged)

    lag_rows = (
        db.query(ConfigurationConfigEntry)
        .filter(
            ConfigurationConfigEntry.configuration_id == configuration_id,
            ConfigurationConfigEntry.entity_type == ENTITY_LAG,
        )
        .all()
    )
    same_hw = next((r for r in lag_rows if r.external_name == hw), None)
    if same_hw is not None:
        cached = _json_mapping_from_entry_payload(same_hw.payload_json)
        old_ifs = lag_member_iface_set_from_payload(cached)
        if old_ifs == new_ifs and len(new_ifs) >= 2:
            raise LagCreateCacheConflictError(
                "A LAG with this hardware and the same member interfaces is already "
                "in the cache. Edit that row to queue an update."
            )

    for row in lag_rows:
        if row.external_name == hw:
            continue
        cached = _json_mapping_from_entry_payload(row.payload_json)
        old_ifs = lag_member_iface_set_from_payload(cached)
        overlap = old_ifs & new_ifs
        if overlap:
            names = ", ".join(sorted(overlap))
            raise LagCreateCacheConflictError(
                f'Interface(s) {names} already belong to LAG "{row.external_name}" '
                "in the cache. Refresh the configuration if the cache is out of date."
            )

    bridge_rows = (
        db.query(ConfigurationConfigEntry)
        .filter(
            ConfigurationConfigEntry.configuration_id == configuration_id,
            ConfigurationConfigEntry.entity_type == ENTITY_BRIDGE_PAIR,
        )
        .all()
    )
    for row in bridge_rows:
        cached = _json_mapping_from_entry_payload(row.payload_json)
        old_ifs = bridge_pair_member_iface_set_from_payload(cached)
        overlap = old_ifs & new_ifs
        if overlap:
            names = ", ".join(sorted(overlap))
            raise LagCreateCacheConflictError(
                f'Interface(s) {names} already belong to bridge pair "{row.external_name}" '
                "in the cache. Refresh the configuration if the cache is out of date."
            )


def _has_ip_hostgroup_cache(
    db: Session, *, configuration_id: int, external_name: str
) -> bool:
    row = (
        db.query(ConfigurationConfigEntry.id)
        .filter(
            ConfigurationConfigEntry.configuration_id == configuration_id,
            ConfigurationConfigEntry.entity_type == ENTITY_IP_HOSTGROUP,
            ConfigurationConfigEntry.external_name == external_name,
        )
        .first()
    )
    return row is not None

def _audit(
    *,
    created_by_user_id: str | None,
    created_by_username: str | None,
) -> tuple[str | None, str | None]:
    return created_by_user_id, created_by_username

def apply_configuration_interface_update(
    db: Session,
    *,
    config_entry_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    entry = db.get(ConfigurationConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_INTERFACE:
        raise ValueError("Not an interface config entry")
    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")
    merged = merge_interface_flyout_form(base, form)
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_merged(
        db,
        configuration_id=entry.configuration_id,
        entity_type=entry.entity_type,
        external_name=entry.external_name,
        merged=merged,
        created_by_user_id=uid,
        created_by_username=un,
    )

def apply_configuration_vlan_update(
    db: Session,
    *,
    config_entry_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    entry = db.get(ConfigurationConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_VLAN:
        raise ValueError("Not a VLAN config entry")
    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")
    merged = merge_vlan_flyout_form(base, form)
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_merged(
        db,
        configuration_id=entry.configuration_id,
        entity_type=entry.entity_type,
        external_name=entry.external_name,
        merged=merged,
        created_by_user_id=uid,
        created_by_username=un,
    )

def apply_configuration_alias_update(
    db: Session,
    *,
    config_entry_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    entry = db.get(ConfigurationConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_ALIAS:
        raise ValueError("Not an alias config entry")
    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")
    merged = merge_alias_flyout_form(base, form)
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_merged(
        db,
        configuration_id=entry.configuration_id,
        entity_type=entry.entity_type,
        external_name=entry.external_name,
        merged=merged,
        created_by_user_id=uid,
        created_by_username=un,
    )

def apply_configuration_bridge_pair_update(
    db: Session,
    *,
    config_entry_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    entry = db.get(ConfigurationConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_BRIDGE_PAIR:
        raise ValueError("Not a bridge pair config entry")
    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")
    merged = merge_bridge_pair_flyout_form(base, form)
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_merged(
        db,
        configuration_id=entry.configuration_id,
        entity_type=entry.entity_type,
        external_name=entry.external_name,
        merged=merged,
        created_by_user_id=uid,
        created_by_username=un,
    )


def apply_configuration_lag_update(
    db: Session,
    *,
    config_entry_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    entry = db.get(ConfigurationConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_LAG:
        raise ValueError("Not a LAG config entry")
    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")
    merged = merge_lag_flyout_form(base, form)
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_merged(
        db,
        configuration_id=entry.configuration_id,
        entity_type=entry.entity_type,
        external_name=entry.external_name,
        merged=merged,
        created_by_user_id=uid,
        created_by_username=un,
    )


def apply_configuration_lag_create(
    db: Session,
    *,
    configuration_id: int,
    form: dict[str, Any],
    force: bool = False,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    if not _configuration_exists(db, configuration_id):
        raise ValueError("Configuration not found")
    merged = lag_create_merged_payload(form)
    _validate_lag_create_against_configuration_cache(
        db,
        configuration_id=configuration_id,
        merged=merged,
        force=force,
    )
    hw = str(merged.get("Hardware") or "").strip()
    if not hw:
        raise ValueError("Hardware is required")
    exists = (
        db.query(ConfigurationConfigEntry.id)
        .filter(
            ConfigurationConfigEntry.configuration_id == configuration_id,
            ConfigurationConfigEntry.entity_type == ENTITY_LAG,
            ConfigurationConfigEntry.external_name == hw,
        )
        .first()
    )
    if exists is not None:
        raise ValueError(
            "A LAG with this hardware name already exists for the selected configuration."
        )
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_merged(
        db,
        configuration_id=configuration_id,
        entity_type=ENTITY_LAG,
        external_name=hw,
        merged=merged,
        created_by_user_id=uid,
        created_by_username=un,
    )


def apply_configuration_bridge_pair_create(
    db: Session,
    *,
    configuration_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    if not _configuration_exists(db, configuration_id):
        raise ValueError("Configuration not found")
    merged = bridge_pair_create_merged_payload(form)
    hw = str(merged.get("Hardware") or "").strip()
    if not hw:
        raise ValueError("Hardware is required")
    exists = (
        db.query(ConfigurationConfigEntry.id)
        .filter(
            ConfigurationConfigEntry.configuration_id == configuration_id,
            ConfigurationConfigEntry.entity_type == ENTITY_BRIDGE_PAIR,
            ConfigurationConfigEntry.external_name == hw,
        )
        .first()
    )
    if exists is not None:
        raise ValueError(
            "A bridge pair with this hardware name already exists for the selected configuration."
        )
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_merged(
        db,
        configuration_id=configuration_id,
        entity_type=ENTITY_BRIDGE_PAIR,
        external_name=hw,
        merged=merged,
        created_by_user_id=uid,
        created_by_username=un,
    )

def apply_configuration_alias_create(
    db: Session,
    *,
    configuration_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    if not _configuration_exists(db, configuration_id):
        raise ValueError("Configuration not found")
    merged = alias_create_merged_payload(form)
    name = str(merged.get("Name") or "").strip()
    if not name:
        raise ValueError("Name is required")
    exists = (
        db.query(ConfigurationConfigEntry.id)
        .filter(
            ConfigurationConfigEntry.configuration_id == configuration_id,
            ConfigurationConfigEntry.entity_type == ENTITY_ALIAS,
            ConfigurationConfigEntry.external_name == name,
        )
        .first()
    )
    if exists is not None:
        raise ValueError(
            "An alias with this name already exists for the selected configuration."
        )
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_merged(
        db,
        configuration_id=configuration_id,
        entity_type=ENTITY_ALIAS,
        external_name=name,
        merged=merged,
        created_by_user_id=uid,
        created_by_username=un,
    )

def apply_configuration_vlan_create(
    db: Session,
    *,
    configuration_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    if not _configuration_exists(db, configuration_id):
        raise ValueError("Configuration not found")
    name = str(form.get("name") or "").strip()
    if not name:
        raise ValueError("Name is required")
    vid = str(form.get("vlan_id") or "").strip()
    if not vid:
        raise ValueError("VLAN ID is required")
    hw = str(form.get("hardware") or "").strip()
    if not hw:
        raise ValueError("Hardware is required")
    parent = str(form.get("interface_parent") or "").strip()
    if not parent:
        raise ValueError("Interface is required")
    base: dict[str, Any] = {
        "Hardware": hw,
        "Interface": parent,
        "VLANID": vid,
    }
    merged = merge_vlan_flyout_form(base, form)
    exists = (
        db.query(ConfigurationConfigEntry.id)
        .filter(
            ConfigurationConfigEntry.configuration_id == configuration_id,
            ConfigurationConfigEntry.entity_type == ENTITY_VLAN,
            ConfigurationConfigEntry.external_name == name,
        )
        .first()
    )
    if exists is not None:
        raise ValueError(
            "A VLAN with this name already exists for the selected configuration."
        )
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_merged(
        db,
        configuration_id=configuration_id,
        entity_type=ENTITY_VLAN,
        external_name=name,
        merged=merged,
        created_by_user_id=uid,
        created_by_username=un,
    )

def apply_configuration_ip_host_update(
    db: Session,
    *,
    config_entry_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    entry = db.get(ConfigurationConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_IP_HOST:
        raise ValueError("Not an IP host config entry")
    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")
    if str(base.get("HostType") or "").strip() == "System Host":
        raise ValueError("System host objects cannot be edited here")
    merged = merge_ip_host_flyout_form(base, form)
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_merged(
        db,
        configuration_id=entry.configuration_id,
        entity_type=entry.entity_type,
        external_name=entry.external_name,
        merged=merged,
        created_by_user_id=uid,
        created_by_username=un,
    )

def apply_configuration_ip_host_delete(
    db: Session,
    *,
    config_entry_id: int,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    entry = db.get(ConfigurationConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_IP_HOST:
        raise ValueError("Not an IP host config entry")
    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")
    if str(base.get("HostType") or "").strip() == "System Host":
        raise ValueError("System host objects cannot be deleted here")
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_delete(
        db,
        configuration_id=entry.configuration_id,
        entity_type=entry.entity_type,
        external_name=entry.external_name,
        created_by_user_id=uid,
        created_by_username=un,
    )

def apply_configuration_ip_host_update_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    seen: set[int] = set()
    ids: list[int] = []
    for raw in config_entry_ids:
        try:
            n = int(raw)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        ids.append(n)
    if not ids:
        raise ValueError("Select at least one configuration")
    for cid in ids:
        apply_configuration_ip_host_update(
            db,
            config_entry_id=cid,
            form=form,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )

def apply_configuration_ip_host_delete_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    seen: set[int] = set()
    ids: list[int] = []
    for raw in config_entry_ids:
        try:
            n = int(raw)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        ids.append(n)
    if not ids:
        raise ValueError("No config entries to delete")
    for cid in ids:
        apply_configuration_ip_host_delete(
            db,
            config_entry_id=cid,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )

def apply_configuration_ip_host_create(
    db: Session,
    *,
    configuration_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    if not _configuration_exists(db, configuration_id):
        raise ValueError("Configuration not found")
    base: dict[str, Any] = {}
    merged = merge_ip_host_flyout_form(base, form)
    name = str(merged.get("Name") or "").strip()
    if not name:
        raise ValueError("Name is required")
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_merged(
        db,
        configuration_id=configuration_id,
        entity_type=ENTITY_IP_HOST,
        external_name=name,
        merged=merged,
        created_by_user_id=uid,
        created_by_username=un,
    )

def apply_configuration_ip_host_create_many(
    db: Session,
    *,
    configuration_ids: list[int],
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    seen: set[int] = set()
    ids: list[int] = []
    for raw in configuration_ids:
        try:
            n = int(raw)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        ids.append(n)
    if not ids:
        raise ValueError("Select at least one configuration")
    base: dict[str, Any] = {}
    merged = merge_ip_host_flyout_form(base, form)
    name = str(merged.get("Name") or "").strip()
    if not name:
        raise ValueError("Name is required")
    ip_host_merged = dict(merged)
    selected_groups: list[str] = []
    raw_hg = form.get("host_groups")
    if isinstance(raw_hg, list):
        for x in raw_hg:
            g = str(x).strip()
            if g and g not in selected_groups:
                selected_groups.append(g)
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    for cid in ids:
        if not _configuration_exists(db, cid):
            raise ValueError(f"Configuration not found: {cid}")
        for gname in selected_groups:
            if _has_ip_hostgroup_cache(db, configuration_id=cid, external_name=gname):
                continue
            hg_payload = {
                "Name": gname,
                "Description": None,
                "IPFamily": "IPv4",
            }
            enqueue_configuration_merged(
                db,
                configuration_id=cid,
                entity_type=ENTITY_IP_HOSTGROUP,
                external_name=gname,
                merged=hg_payload,
                created_by_user_id=uid,
                created_by_username=un,
            )
        enqueue_configuration_merged(
            db,
            configuration_id=cid,
            entity_type=ENTITY_IP_HOST,
            external_name=name,
            merged=ip_host_merged,
            created_by_user_id=uid,
            created_by_username=un,
        )

def apply_configuration_hs_entity_update(
    db: Session,
    *,
    config_entry_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    if form.get("__gc_op"):
        raise ValueError("Invalid form payload")
    entry = db.get(ConfigurationConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type == ENTITY_IP_HOST:
        apply_configuration_ip_host_update(
            db,
            config_entry_id=config_entry_id,
            form=form,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
        return
    if entry.entity_type not in HS_TASK_ENTITY_TYPES:
        raise ValueError("Unsupported config entry type for hosts/services update")
    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")
    merged = merge_hs_flyout_form(entry.entity_type, base, form)
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_merged(
        db,
        configuration_id=entry.configuration_id,
        entity_type=entry.entity_type,
        external_name=entry.external_name,
        merged=merged,
        created_by_user_id=uid,
        created_by_username=un,
    )
    # ref_countries refresh runs when the task is approved (see process_task).

def apply_configuration_hs_entity_update_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    seen: set[int] = set()
    ids: list[int] = []
    for raw in config_entry_ids:
        try:
            n = int(raw)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        ids.append(n)
    if not ids:
        raise ValueError("No config entries to update")
    for cid in ids:
        apply_configuration_hs_entity_update(
            db,
            config_entry_id=cid,
            form=form,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )

def apply_configuration_hs_config_delete(
    db: Session,
    *,
    config_entry_id: int,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    entry = db.get(ConfigurationConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type == ENTITY_IP_HOST:
        apply_configuration_ip_host_delete(
            db,
            config_entry_id=config_entry_id,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
        return
    if entry.entity_type not in HS_TASK_ENTITY_TYPES:
        raise ValueError("Unsupported entity type for delete")
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_delete(
        db,
        configuration_id=entry.configuration_id,
        entity_type=entry.entity_type,
        external_name=entry.external_name,
        created_by_user_id=uid,
        created_by_username=un,
    )

def apply_configuration_hs_deletes_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    seen: set[int] = set()
    ids: list[int] = []
    for raw in config_entry_ids:
        try:
            n = int(raw)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        ids.append(n)
    if not ids:
        raise ValueError("No config entries to delete")
    for cid in ids:
        apply_configuration_hs_config_delete(
            db,
            config_entry_id=cid,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )

def apply_configuration_network_entity_delete(
    db: Session,
    *,
    config_entry_id: int,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    entry = db.get(ConfigurationConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type == ENTITY_INTERFACE:
        raise ValueError("Physical interfaces cannot be deleted from this table")
    if entry.entity_type not in NETWORK_CONFIG_DELETABLE_TYPES:
        raise ValueError("Unsupported entity type for delete")
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_delete(
        db,
        configuration_id=entry.configuration_id,
        entity_type=entry.entity_type,
        external_name=entry.external_name,
        created_by_user_id=uid,
        created_by_username=un,
    )

def apply_configuration_network_entity_deletes_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    seen: set[int] = set()
    ids: list[int] = []
    for raw in config_entry_ids:
        try:
            n = int(raw)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        ids.append(n)
    if not ids:
        raise ValueError("No config entries to delete")
    for cid in ids:
        apply_configuration_network_entity_delete(
            db,
            config_entry_id=cid,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )

def apply_configuration_hs_entity_create_many(
    db: Session,
    *,
    configuration_ids: list[int],
    entity_type: str,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    if entity_type == ENTITY_IP_HOST:
        apply_configuration_ip_host_create_many(
            db,
            configuration_ids=configuration_ids,
            form=form,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
        return
    if entity_type not in HS_TASK_ENTITY_TYPES:
        raise ValueError("Unsupported entity type for create")
    seen: set[int] = set()
    cids: list[int] = []
    for raw in configuration_ids:
        try:
            n = int(raw)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        cids.append(n)
    if not cids:
        raise ValueError("Select at least one configuration")
    base: dict[str, Any] = {}
    merged = merge_hs_flyout_form(entity_type, base, form)
    name = hs_entity_external_name(entity_type, merged)
    if not name:
        raise ValueError(hs_entity_identity_label(entity_type) + " is required")
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    for cid in cids:
        if not _configuration_exists(db, cid):
            raise ValueError(f"Configuration not found: {cid}")
        exists = (
            db.query(ConfigurationConfigEntry.id)
            .filter(
                ConfigurationConfigEntry.configuration_id == cid,
                ConfigurationConfigEntry.entity_type == entity_type,
                ConfigurationConfigEntry.external_name == name,
            )
            .first()
        )
        if exists is not None:
            raise ValueError(
                f'An object named "{name}" already exists for this configuration.'
            )
        enqueue_configuration_merged(
            db,
            configuration_id=cid,
            entity_type=entity_type,
            external_name=name,
            merged=merged,
            created_by_user_id=uid,
            created_by_username=un,
        )


def apply_configuration_zone_update(
    db: Session,
    *,
    config_entry_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    entry = db.get(ConfigurationConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_ZONE:
        raise ValueError("Not a zone config entry")
    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")
    merged = merge_zone_flyout_form(base, form)
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_merged(
        db,
        configuration_id=entry.configuration_id,
        entity_type=entry.entity_type,
        external_name=entry.external_name,
        merged=merged,
        created_by_user_id=uid,
        created_by_username=un,
    )


def apply_configuration_zone_update_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    seen: set[int] = set()
    ids: list[int] = []
    for raw in config_entry_ids:
        try:
            n = int(raw)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        ids.append(n)
    if not ids:
        raise ValueError("No configuration entries to update")
    for cid in ids:
        apply_configuration_zone_update(
            db,
            config_entry_id=cid,
            form=form,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )


def apply_configuration_zone_create(
    db: Session,
    *,
    configuration_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    if not _configuration_exists(db, configuration_id):
        raise ValueError("Configuration not found")
    merged = zone_create_merged_payload(form)
    name = str(merged.get("Name") or "").strip()
    if not name:
        raise ValueError("Name is required")
    exists = (
        db.query(ConfigurationConfigEntry.id)
        .filter(
            ConfigurationConfigEntry.configuration_id == configuration_id,
            ConfigurationConfigEntry.entity_type == ENTITY_ZONE,
            ConfigurationConfigEntry.external_name == name,
        )
        .first()
    )
    if exists is not None:
        raise ValueError(
            f'A zone named "{name}" already exists for the selected configuration.'
        )
    uid, un = _audit(
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    enqueue_configuration_merged(
        db,
        configuration_id=configuration_id,
        entity_type=ENTITY_ZONE,
        external_name=name,
        merged=merged,
        created_by_user_id=uid,
        created_by_username=un,
    )


def apply_configuration_zone_create_batch(
    db: Session,
    *,
    configuration_ids: list[int],
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> None:
    seen: set[int] = set()
    cids: list[int] = []
    for raw in configuration_ids:
        try:
            n = int(raw)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        cids.append(n)
    if not cids:
        raise ValueError("Select at least one configuration")
    for cid in cids:
        apply_configuration_zone_create(
            db,
            configuration_id=cid,
            form=form,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
