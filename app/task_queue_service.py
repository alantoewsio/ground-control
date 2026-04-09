"""Enqueue and execute task_queue rows against Sophos firewalls."""

from __future__ import annotations

import difflib
import json
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

import requests
import xmltodict
from sophosfirewall_python.api_client import (
    SophosFirewallAPIError,
    SophosFirewallAuthFailure,
    SophosFirewallZeroRecords,
)
from sophosfirewall_python.firewallapi import SophosFirewall
from sophosfirewall_python.host import FQDNHost, FQDNHostGroup, IPHostGroup
from sophosfirewall_python.service import Service, ServiceGroup
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app import crypto
from app.auth_identity_tasks import (
    firewall_has_admin_profile_cache_row,
    firewall_has_user_cache_row,
    firewall_has_user_group_cache_row,
    merge_admin_profile_payload,
    merge_user_group_payload,
    merge_user_payload,
    submit_admin_profile_create,
    submit_admin_profile_update,
    submit_user_create,
    submit_user_group_add,
    submit_user_group_update,
    submit_user_update,
    user_group_name_from_merged,
    username_from_user_payload,
)
from app.auth_identity_tasks import (
    task_payload_matches_cache as auth_task_payload_matches_cache,
)
from app.firewall_api_client import (
    normalize_firewall_api_timeout_seconds,
    patch_sophos_firewall_request_timeout,
)
from app.firewall_config_sync import (
    ENTITY_ACCESS_TIME_POLICY,
    ENTITY_ADMIN_PROFILE,
    ENTITY_ALIAS,
    ENTITY_BRIDGE_PAIR,
    ENTITY_DATA_TRANSFER_POLICY,
    ENTITY_DECRYPTION_PROFILE,
    ENTITY_DOS_BYPASS_RULE,
    ENTITY_DOS_SETTINGS,
    ENTITY_FIREWALL_RULE,
    ENTITY_FIREWALL_RULE_GROUP,
    ENTITY_INTERFACE,
    ENTITY_IP_HOST,
    ENTITY_IP_HOSTGROUP,
    ENTITY_IPS_CUSTOM_SIGNATURE,
    ENTITY_IPS_FULL_SIGNATURE_PACK,
    ENTITY_IPS_POLICY,
    ENTITY_IPS_SWITCH,
    ENTITY_LAG,
    ENTITY_SCHEDULE,
    ENTITY_SPOOF_PREVENTION,
    ENTITY_SURFING_QUOTA_POLICY,
    ENTITY_TRUSTED_MAC,
    ENTITY_USER,
    ENTITY_USER_GROUP,
    ENTITY_VLAN,
    ENTITY_VPN_PROFILE,
    ENTITY_WEBFILTER_POLICY,
    ENTITY_ZONE,
    run_firewall_config_sync,
)
from app.firewall_connectivity import firewall_is_online
from app.hs_flyout_merge import (
    merge_country_group_form,
    merge_fqdn_host_form,
    merge_fqdn_hostgroup_form,
    merge_ip_hostgroup_form,
    merge_mac_host_form,
    merge_service_form,
    merge_service_group_form,
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
from app.ips_custom_signature_merge import (
    task_payload_for_signature_update,
    validate_and_build_signature_payload,
)
from app.ips_dos_spoof_task import (
    merge_dos_settings_payload,
    merge_spoof_prevention_payload,
)
from app.ips_policy_merge import (
    policy_from_client_dict,
    task_payload_for_update,
)
from app.ips_trusted_mac_merge import (
    task_payload_for_trusted_mac_update,
    trusted_mac_update_params_for_api,
    validate_and_build_trusted_mac_payload,
)
from app.models import (
    Configuration,
    ConfigurationConfigEntry,
    Firewall,
    FirewallConfigChangelogEntry,
    FirewallConfigEntry,
    FirewallConfigSyncRun,
    TaskQueue,
    TaskQueueCompleted,
)
from app.profile_entity_merge import merge_profile_entity_payload
from app.secrets_database import get_firewall_password_encrypted
from app.webfilter_policy_merge import (
    policy_from_client_dict as wfp_policy_from_client_dict,
)
from app.webfilter_policy_merge import (
    task_payload_for_wfp_update,
)

# Stored on ``task_queue_completed.outcome`` when a row is discarded from the queue.
TASK_QUEUE_OUTCOME_REMOVED = "removed_from_queue"

# Max IDs per list in batch / task-queue API bodies (mitigates unbounded work; Sonar S6680).
TASK_QUEUE_BATCH_IDS_MAX = 500

_TEST_SINGLETON_ENTITY_TYPES = frozenset(
    {
        ENTITY_IPS_SWITCH,
        ENTITY_DOS_SETTINGS,
        ENTITY_SPOOF_PREVENTION,
    }
)

PROFILE_ENTITY_XML: dict[str, str] = {
    ENTITY_SCHEDULE: "Schedule",
    ENTITY_ACCESS_TIME_POLICY: "AccessTimePolicy",
    ENTITY_SURFING_QUOTA_POLICY: "SurfingQuotaPolicy",
    ENTITY_DATA_TRANSFER_POLICY: "DataTransferPolicy",
    ENTITY_DECRYPTION_PROFILE: "DecryptionProfile",
    ENTITY_VPN_PROFILE: "VPNProfile",
}

GENERIC_SYNC_XML_ENTITY_TAGS: dict[str, str] = {
    "acl_rule": "LocalServiceACL",
    "admin_authen": "AdminAuthentication",
    "admin_settings": "AdminSettings",
    "backup": "BackupRestore",
    "dns_forwarders": "DNS",
    ENTITY_DOS_BYPASS_RULE: "DoSBypassRule",
    ENTITY_FIREWALL_RULE: "FirewallRule",
    ENTITY_IPS_FULL_SIGNATURE_PACK: "IPSFullSignaturePack",
    "notification": "Notification",
    "notification_list": "NotificationList",
    "reports_retention": "DataManagement",
    ENTITY_FIREWALL_RULE_GROUP: "FirewallRuleGroup",
    "snmpv3_user": "SNMPv3User",
    "syslog_server": "SyslogServers",
    "url_group": "WebFilterURLGroup",
    "useractivity": "UserActivity",
}

GENERIC_SYNC_LOOKUP_XML_KEYS: dict[str, str] = {
    "acl_rule": "RuleName",
}

GENERIC_SYNC_SINGLETON_ENTITY_TYPES: frozenset[str] = frozenset(
    {
        "admin_authen",
        "admin_settings",
        "backup",
        "dns_forwarders",
        ENTITY_IPS_SWITCH,
        ENTITY_DOS_SETTINGS,
        ENTITY_SPOOF_PREVENTION,
        ENTITY_IPS_FULL_SIGNATURE_PACK,
        "reports_retention",
    }
)


def _firewall_has_ip_hostgroup_cache_entry(
    db: Session, *, firewall_id: int, external_name: str
) -> bool:
    row = (
        db.query(FirewallConfigEntry.id)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_IP_HOSTGROUP,
            FirewallConfigEntry.external_name == external_name,
        )
        .first()
    )
    return row is not None


def _firewall_has_ip_host_cache_entry(
    db: Session, *, firewall_id: int, external_name: str
) -> bool:
    row = (
        db.query(FirewallConfigEntry.id)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_IP_HOST,
            FirewallConfigEntry.external_name == external_name,
        )
        .first()
    )
    return row is not None


def _firewall_has_lag_cache_entry(
    db: Session, *, firewall_id: int, external_name: str
) -> bool:
    row = (
        db.query(FirewallConfigEntry.id)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_LAG,
            FirewallConfigEntry.external_name == external_name,
        )
        .first()
    )
    return row is not None


def _firewall_has_bridge_pair_cache_entry(
    db: Session, *, firewall_id: int, external_name: str
) -> bool:
    row = (
        db.query(FirewallConfigEntry.id)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_BRIDGE_PAIR,
            FirewallConfigEntry.external_name == external_name,
        )
        .first()
    )
    return row is not None


def _firewall_has_alias_cache_entry(
    db: Session, *, firewall_id: int, external_name: str
) -> bool:
    row = (
        db.query(FirewallConfigEntry.id)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_ALIAS,
            FirewallConfigEntry.external_name == external_name,
        )
        .first()
    )
    return row is not None


def _firewall_has_zone_cache_entry(
    db: Session, *, firewall_id: int, external_name: str
) -> bool:
    row = (
        db.query(FirewallConfigEntry.id)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_ZONE,
            FirewallConfigEntry.external_name == external_name,
        )
        .first()
    )
    return row is not None


class BridgePairCreateCacheConflictError(Exception):
    """Local cache disagrees with this create; caller may retry with ``force=True``."""

    pass


class LagCreateCacheConflictError(Exception):
    """Local cache disagrees with this LAG create; caller may retry with ``force=True``."""

    pass


def _parse_lag_cache_payload(row: FirewallConfigEntry) -> dict[str, Any]:
    try:
        raw = json.loads(row.payload_json)
    except json.JSONDecodeError:
        return {}
    return raw if isinstance(raw, dict) else {}


def _validate_lag_create_against_cache(
    db: Session,
    *,
    firewall_id: int,
    merged: dict[str, Any],
    force: bool,
) -> None:
    if force:
        return
    hw = str(merged.get("Hardware") or "").strip()
    new_ifs = lag_member_iface_set_from_payload(merged)

    lag_rows = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_LAG,
        )
        .all()
    )
    same_hw = next((r for r in lag_rows if r.external_name == hw), None)
    if same_hw is not None:
        cached = _parse_lag_cache_payload(same_hw)
        old_ifs = lag_member_iface_set_from_payload(cached)
        if old_ifs == new_ifs and len(new_ifs) >= 2:
            raise LagCreateCacheConflictError(
                "A LAG with this hardware and the same member interfaces is already "
                "in the cache. Edit that row to queue an update."
            )

    for row in lag_rows:
        if row.external_name == hw:
            continue
        cached = _parse_lag_cache_payload(row)
        old_ifs = lag_member_iface_set_from_payload(cached)
        overlap = old_ifs & new_ifs
        if overlap:
            names = ", ".join(sorted(overlap))
            raise LagCreateCacheConflictError(
                f'Interface(s) {names} already belong to LAG "{row.external_name}" '
                "in the cache. Sync the firewall if the cache is out of date."
            )

    bridge_rows = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_BRIDGE_PAIR,
        )
        .all()
    )
    for row in bridge_rows:
        cached = _parse_bridge_pair_cache_payload(row)
        old_ifs = bridge_pair_member_iface_set_from_payload(cached)
        overlap = old_ifs & new_ifs
        if overlap:
            names = ", ".join(sorted(overlap))
            raise LagCreateCacheConflictError(
                f'Interface(s) {names} already belong to bridge pair "{row.external_name}" '
                "in the cache. Sync the firewall if the cache is out of date."
            )


def _parse_bridge_pair_cache_payload(row: FirewallConfigEntry) -> dict[str, Any]:
    try:
        raw = json.loads(row.payload_json)
    except json.JSONDecodeError:
        return {}
    return raw if isinstance(raw, dict) else {}


def _validate_bridge_pair_create_against_cache(
    db: Session,
    *,
    firewall_id: int,
    merged: dict[str, Any],
    force: bool,
) -> None:
    """
    Block enqueue only for real conflicts: same hardware + same members as cache, or
    member interfaces already used on another cached bridge pair. A row with the same
    hardware name but different member interfaces is treated as stale cache (allowed).
    """
    if force:
        return
    hw = str(merged.get("Hardware") or "").strip()
    new_ifs = bridge_pair_member_iface_set_from_payload(merged)

    rows = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_BRIDGE_PAIR,
        )
        .all()
    )

    same_hw: FirewallConfigEntry | None = next(
        (r for r in rows if r.external_name == hw), None
    )
    if same_hw is not None:
        cached = _parse_bridge_pair_cache_payload(same_hw)
        old_ifs = bridge_pair_member_iface_set_from_payload(cached)
        if old_ifs == new_ifs and len(new_ifs) >= 2:
            raise BridgePairCreateCacheConflictError(
                "A bridge pair with this hardware and the same member interfaces is already "
                "in the cache. Edit that row to queue an update."
            )

    for row in rows:
        if row.external_name == hw:
            continue
        cached = _parse_bridge_pair_cache_payload(row)
        old_ifs = bridge_pair_member_iface_set_from_payload(cached)
        overlap = old_ifs & new_ifs
        if overlap:
            names = ", ".join(sorted(overlap))
            raise BridgePairCreateCacheConflictError(
                f'Interface(s) {names} already belong to bridge pair "{row.external_name}" '
                "in the cache. Sync the firewall if the cache is out of date."
            )


def _payload_dict_for_compare(d: dict[str, Any]) -> dict[str, Any]:
    """Keys excluded from cache-vs-queue equality (matches send-time update_params rules)."""
    return {
        k: v
        for k, v in d.items()
        if not str(k).startswith("@") and k != "__gc_op"
    }


def _normalized_payload_digest(obj: dict[str, Any]) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str)


def _task_payload_matches_cache(
    entry: FirewallConfigEntry | None, pending: dict[str, Any]
) -> bool:
    """True when the pending payload is semantically unchanged from the cached entry."""
    if entry is None:
        return False
    if pending.get("__gc_op") == "delete":
        return False
    try:
        raw = entry.payload_json
        if raw is None or not str(raw).strip():
            return False
        stored = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return False
    if not isinstance(stored, dict):
        return False
    left = _payload_dict_for_compare(stored)
    right = _payload_dict_for_compare(pending)
    return _normalized_payload_digest(left) == _normalized_payload_digest(right)


def _task_payload_matches_configuration_cache(
    entry: ConfigurationConfigEntry | None, pending: dict[str, Any]
) -> bool:
    """True when the pending payload is unchanged from ``configuration_config_entries``."""
    if entry is None:
        return False
    if pending.get("__gc_op") == "delete":
        return False
    try:
        raw = entry.payload_json
        if raw is None or not str(raw).strip():
            return False
        stored = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return False
    if not isinstance(stored, dict):
        return False
    left = _payload_dict_for_compare(stored)
    right = _payload_dict_for_compare(pending)
    return _normalized_payload_digest(left) == _normalized_payload_digest(right)


def _prune_none_values(obj: Any) -> Any:
    """Drop None leaves so XML add payloads omit empty optional elements."""
    if obj is None:
        return None
    if isinstance(obj, dict):
        out: dict[str, Any] = {}
        for k, v in obj.items():
            if v is None:
                continue
            pv = _prune_none_values(v)
            if pv is None:
                continue
            if pv == {}:
                continue
            out[k] = pv
        return out
    if isinstance(obj, list):
        items = [_prune_none_values(x) for x in obj]
        return [x for x in items if x is not None and x != {}]
    return obj


def _submit_ip_host_add(fw: SophosFirewall, update_params: dict[str, Any]) -> dict:
    """Create a new IPHost via Set operation=add (not update)."""
    clean = _prune_none_values(
        {k: v for k, v in update_params.items() if not str(k).startswith("@")}
    )
    if not isinstance(clean, dict):
        clean = {}
    inner = xmltodict.unparse(
        {"IPHost": clean}, pretty=True, full_document=False, encoding="utf-8"
    )
    if isinstance(inner, bytes):
        inner = inner.decode("utf-8")
    return fw.submit_xml(inner.strip(), {}, set_operation="add")


def _submit_lag_add(fw: SophosFirewall, payload: dict[str, Any]) -> dict:
    """Create a new LAG via Set operation=add (XML ``LAG`` tag)."""
    clean = _prune_none_values(
        {
            k: v
            for k, v in payload.items()
            if not str(k).startswith("@") and k != "__gc_op"
        }
    )
    if not isinstance(clean, dict):
        clean = {}
    inner = xmltodict.unparse(
        {"LAG": clean}, pretty=True, full_document=False, encoding="utf-8"
    )
    if isinstance(inner, bytes):
        inner = inner.decode("utf-8")
    return fw.submit_xml(inner.strip(), {}, set_operation="add")


def _submit_bridge_pair_add(fw: SophosFirewall, payload: dict[str, Any]) -> dict:
    """Create a new BridgePair via Set operation=add (update() requires an existing object)."""
    clean = _prune_none_values(
        {
            k: v
            for k, v in payload.items()
            if not str(k).startswith("@") and k != "__gc_op"
        }
    )
    if not isinstance(clean, dict):
        clean = {}
    inner = xmltodict.unparse(
        {"BridgePair": clean}, pretty=True, full_document=False, encoding="utf-8"
    )
    if isinstance(inner, bytes):
        inner = inner.decode("utf-8")
    return fw.submit_xml(inner.strip(), {}, set_operation="add")


def _firewall_has_ips_policy_cache_entry(
    db: Session, *, firewall_id: int, external_name: str
) -> bool:
    row = (
        db.query(FirewallConfigEntry.id)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_IPS_POLICY,
            FirewallConfigEntry.external_name == external_name,
        )
        .first()
    )
    return row is not None


def _submit_ips_policy_add(fw: SophosFirewall, payload: dict[str, Any]) -> dict:
    """Create IPSPolicy via Set operation=add."""
    clean = _prune_none_values(
        {
            k: v
            for k, v in payload.items()
            if not str(k).startswith("@") and k != "__gc_op"
        }
    )
    if not isinstance(clean, dict):
        clean = {}
    inner = xmltodict.unparse(
        {"IPSPolicy": clean}, pretty=True, full_document=False, encoding="utf-8"
    )
    if isinstance(inner, bytes):
        inner = inner.decode("utf-8")
    return fw.submit_xml(inner.strip(), {}, set_operation="add")


def _firewall_has_webfilter_policy_cache_entry(
    db: Session, *, firewall_id: int, external_name: str
) -> bool:
    row = (
        db.query(FirewallConfigEntry.id)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_WEBFILTER_POLICY,
            FirewallConfigEntry.external_name == external_name,
        )
        .first()
    )
    return row is not None


def _submit_webfilter_policy_add(fw: SophosFirewall, payload: dict[str, Any]) -> dict:
    """Create WebFilterPolicy via Set operation=add."""
    clean = _prune_none_values(
        {
            k: v
            for k, v in payload.items()
            if not str(k).startswith("@") and k != "__gc_op"
        }
    )
    if not isinstance(clean, dict):
        clean = {}
    inner = xmltodict.unparse(
        {"WebFilterPolicy": clean}, pretty=True, full_document=False, encoding="utf-8"
    )
    if isinstance(inner, bytes):
        inner = inner.decode("utf-8")
    return fw.submit_xml(inner.strip(), {}, set_operation="add")


def _firewall_has_ips_custom_signature_cache_entry(
    db: Session, *, firewall_id: int, external_name: str
) -> bool:
    row = (
        db.query(FirewallConfigEntry.id)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_IPS_CUSTOM_SIGNATURE,
            FirewallConfigEntry.external_name == external_name,
        )
        .first()
    )
    return row is not None


def _submit_ips_custom_signature_add(fw: SophosFirewall, payload: dict[str, Any]) -> dict:
    """Create IPSCustomSignature via Set operation=add."""
    clean = _prune_none_values(
        {
            k: v
            for k, v in payload.items()
            if not str(k).startswith("@") and k != "__gc_op"
        }
    )
    if not isinstance(clean, dict):
        clean = {}
    inner = xmltodict.unparse(
        {"IPSCustomSignature": clean}, pretty=True, full_document=False, encoding="utf-8"
    )
    if isinstance(inner, bytes):
        inner = inner.decode("utf-8")
    return fw.submit_xml(inner.strip(), {}, set_operation="add")


def _firewall_has_trusted_mac_cache_entry(
    db: Session, *, firewall_id: int, external_name: str
) -> bool:
    row = (
        db.query(FirewallConfigEntry.id)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_TRUSTED_MAC,
            FirewallConfigEntry.external_name == external_name,
        )
        .first()
    )
    return row is not None


def _submit_trusted_mac_add(fw: SophosFirewall, payload: dict[str, Any]) -> dict:
    """Create TrustedMAC via Set operation=add."""
    clean = _prune_none_values(
        {
            k: v
            for k, v in payload.items()
            if not str(k).startswith("@") and k != "__gc_op"
        }
    )
    if not isinstance(clean, dict):
        clean = {}
    inner = xmltodict.unparse(
        {"TrustedMAC": clean}, pretty=True, full_document=False, encoding="utf-8"
    )
    if isinstance(inner, bytes):
        inner = inner.decode("utf-8")
    return fw.submit_xml(inner.strip(), {}, set_operation="add")


def _submit_alias_add(fw: SophosFirewall, payload: dict[str, Any]) -> dict:
    """Create a new Alias via Set operation=add."""
    clean = _prune_none_values(
        {
            k: v
            for k, v in payload.items()
            if not str(k).startswith("@") and k != "__gc_op"
        }
    )
    if not isinstance(clean, dict):
        clean = {}
    inner = xmltodict.unparse(
        {"Alias": clean}, pretty=True, full_document=False, encoding="utf-8"
    )
    if isinstance(inner, bytes):
        inner = inner.decode("utf-8")
    return fw.submit_xml(inner.strip(), {}, set_operation="add")


def _submit_zone_add(fw: SophosFirewall, payload: dict[str, Any]) -> dict:
    """Create a new Zone via Set operation=add."""
    clean = _prune_none_values(
        {
            k: v
            for k, v in payload.items()
            if not str(k).startswith("@") and k != "__gc_op"
        }
    )
    if not isinstance(clean, dict):
        clean = {}
    inner = xmltodict.unparse(
        {"Zone": clean}, pretty=True, full_document=False, encoding="utf-8"
    )
    if isinstance(inner, bytes):
        inner = inner.decode("utf-8")
    return fw.submit_xml(inner.strip(), {}, set_operation="add")


def _firewall_has_profile_entity_cache_row(
    db: Session, *, entity_type: str, firewall_id: int, external_name: str
) -> bool:
    row = (
        db.query(FirewallConfigEntry.id)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == entity_type,
            FirewallConfigEntry.external_name == external_name,
        )
        .first()
    )
    return row is not None


def _submit_profile_entity_add(
    fw: SophosFirewall, xml_root_tag: str, payload: dict[str, Any]
) -> dict:
    clean = _prune_none_values(
        {
            k: v
            for k, v in payload.items()
            if not str(k).startswith("@") and k != "__gc_op"
        }
    )
    if not isinstance(clean, dict):
        clean = {}
    inner = xmltodict.unparse(
        {xml_root_tag: clean}, pretty=True, full_document=False, encoding="utf-8"
    )
    if isinstance(inner, bytes):
        inner = inner.decode("utf-8")
    return fw.submit_xml(inner.strip(), {}, set_operation="add")


def _submit_generic_xml_add(
    fw: SophosFirewall, xml_root_tag: str, payload: dict[str, Any]
) -> dict:
    clean = _prune_none_values(
        {
            k: v
            for k, v in payload.items()
            if not str(k).startswith("@") and k != "__gc_op"
        }
    )
    if not isinstance(clean, dict):
        clean = {}
    inner = xmltodict.unparse(
        {xml_root_tag: clean}, pretty=True, full_document=False, encoding="utf-8"
    )
    if isinstance(inner, bytes):
        inner = inner.decode("utf-8")
    return fw.submit_xml(inner.strip(), {}, set_operation="add")


def _submit_ip_hostgroup_add(
    fw: SophosFirewall, merged: dict[str, Any], external_name: str
) -> dict:
    """Create an empty IP host group (hosts added later, e.g. with the queued IP host)."""
    name = str(merged.get("Name") or external_name).strip()
    if not name:
        raise ValueError("IP host group name is required")
    raw_desc = merged.get("Description")
    desc = "" if raw_desc is None else str(raw_desc).strip()
    return IPHostGroup(fw.client).create(
        name=name,
        host_list=[],
        description=desc,
        debug=False,
    )


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def sync_catalog_ids_for_task_entity(entity_type: str) -> list[str]:
    """Catalog ids for a full pull of the object type affected by a task queue row."""
    if entity_type == ENTITY_INTERFACE:
        return ["interface"]
    if entity_type == ENTITY_VLAN:
        return ["vlan"]
    if entity_type == ENTITY_BRIDGE_PAIR:
        return ["bridge_pair"]
    if entity_type == ENTITY_LAG:
        return ["lag"]
    if entity_type == ENTITY_ALIAS:
        return ["alias"]
    if entity_type == ENTITY_ZONE:
        return ["zone"]
    if entity_type == ENTITY_IP_HOST:
        return ["ip_host"]
    if entity_type == ENTITY_IP_HOSTGROUP:
        return ["ip_hostgroup"]
    if entity_type == ENTITY_IPS_SWITCH:
        return ["ips_switch"]
    if entity_type == ENTITY_IPS_POLICY:
        return ["ips_policy"]
    if entity_type == ENTITY_WEBFILTER_POLICY:
        return ["webfilterpolicy"]
    if entity_type == ENTITY_IPS_CUSTOM_SIGNATURE:
        return ["ips_custom_signature"]
    if entity_type == ENTITY_TRUSTED_MAC:
        return ["trusted_mac"]
    if entity_type == ENTITY_DOS_SETTINGS:
        return ["dos_settings"]
    if entity_type == ENTITY_SPOOF_PREVENTION:
        return ["spoof_prevention"]
    if entity_type == ENTITY_USER:
        return ["user"]
    if entity_type == ENTITY_USER_GROUP:
        return ["user_group"]
    if entity_type == ENTITY_ADMIN_PROFILE:
        return ["admin_profile"]
    if entity_type == ENTITY_SCHEDULE:
        return ["schedule"]
    if entity_type == ENTITY_ACCESS_TIME_POLICY:
        return ["access_time_policy"]
    if entity_type == ENTITY_SURFING_QUOTA_POLICY:
        return ["surfing_quota_policy"]
    if entity_type == ENTITY_DATA_TRANSFER_POLICY:
        return ["data_transfer_policy"]
    if entity_type == ENTITY_DECRYPTION_PROFILE:
        return ["decryption_profile"]
    if entity_type == ENTITY_VPN_PROFILE:
        return ["vpn_profile"]
    sync_map: dict[str, str] = {
        "acl_rule": "acl_rule",
        "admin_authen": "admin_authen",
        "admin_settings": "admin_settings",
        "backup": "backup",
        "dns_forwarders": "dns_forwarders",
        ENTITY_DOS_BYPASS_RULE: ENTITY_DOS_BYPASS_RULE,
        ENTITY_FIREWALL_RULE: ENTITY_FIREWALL_RULE,
        "fqdn_host": "fqdn_host",
        "fqdn_hostgroup": "fqdn_hostgroup",
        ENTITY_IPS_FULL_SIGNATURE_PACK: ENTITY_IPS_FULL_SIGNATURE_PACK,
        "mac_host": "mac_host",
        "notification": "notification",
        "notification_list": "notification_list",
        "reports_retention": "reports_retention",
        ENTITY_FIREWALL_RULE_GROUP: ENTITY_FIREWALL_RULE_GROUP,
        "service": "service",
        "service_group": "service_group",
        "snmpv3_user": "snmpv3_user",
        "syslog_server": "syslog_server",
        "country_group": "country_group",
        "url_group": "url_group",
        "useractivity": "useractivity",
    }
    hit = sync_map.get(entity_type)
    return [hit] if hit else []


def run_post_task_queue_syncs(
    db: Session,
    sdb: Session,
    by_firewall: dict[int, set[str]],
) -> list[dict[str, Any]]:
    """
    After successful queue sends, refresh the local cache for each firewall and
    merged set of entity types (one config-sync run per firewall).
    """
    results: list[dict[str, Any]] = []
    if not by_firewall:
        return results
    fw_ids = sorted(by_firewall.keys())
    test_fw_ids = {
        int(x[0])
        for x in db.query(Firewall.id)
        .filter(Firewall.id.in_(fw_ids), Firewall.is_test.is_(True))
        .all()
    }
    for fw_id in fw_ids:
        if fw_id in test_fw_ids:
            continue
        ents = sorted(by_firewall[fw_id])
        if not ents:
            continue
        r = run_firewall_config_sync(
            db,
            sdb,
            fw_id,
            entities=ents,
            entities_explicit=True,
        )
        results.append({"firewall_id": fw_id, "entities": ents, **r})
    return results


def _task_payload_external_name(task: TaskQueue, merged: dict[str, Any]) -> str:
    et = str(task.entity_type or "").strip()
    if et in _TEST_SINGLETON_ENTITY_TYPES:
        return "__config__"
    if et in {ENTITY_BRIDGE_PAIR, ENTITY_LAG}:
        return str(merged.get("Hardware") or task.external_name or "").strip()
    if et == ENTITY_TRUSTED_MAC:
        return str(merged.get("MACAddress") or task.external_name or "").strip()
    if et == ENTITY_USER:
        return str(merged.get("Username") or task.external_name or "").strip()
    return str(merged.get("Name") or task.external_name or "").strip()


def _task_payload_for_local_cache(merged: dict[str, Any]) -> dict[str, Any]:
    return {
        str(k): v
        for k, v in merged.items()
        if not str(k).startswith("@") and not str(k).startswith("__gc_") and k != "__gc_op"
    }


def _apply_task_payload_to_test_firewall_cache(
    db: Session,
    task: TaskQueue,
    merged: dict[str, Any],
    *,
    commit: bool = True,
) -> None:
    if not isinstance(merged, dict):
        raise ValueError("Invalid task payload.")
    desired_name = _task_payload_external_name(task, merged)
    if not desired_name and task.entity_type not in _TEST_SINGLETON_ENTITY_TYPES:
        raise ValueError("Missing entity name in payload.")
    op = str(merged.get("__gc_op") or "").strip()
    base_q = db.query(FirewallConfigEntry).filter(
        FirewallConfigEntry.firewall_id == task.firewall_id,
        FirewallConfigEntry.entity_type == task.entity_type,
    )
    if op == "delete":
        names_to_delete = {str(task.external_name or "").strip()}
        if desired_name:
            names_to_delete.add(desired_name)
        for name in names_to_delete:
            if not name:
                continue
            base_q.filter(FirewallConfigEntry.external_name == name).delete(
                synchronize_session=False
            )
        if commit:
            db.commit()
        return

    payload = _task_payload_for_local_cache(merged)
    row = base_q.filter(FirewallConfigEntry.external_name == task.external_name).one_or_none()
    if row is None and desired_name:
        row = base_q.filter(FirewallConfigEntry.external_name == desired_name).one_or_none()
    if row is None:
        row = FirewallConfigEntry(
            firewall_id=task.firewall_id,
            entity_type=task.entity_type,
            external_name=desired_name or str(task.external_name or "").strip(),
            payload_json=json.dumps(payload, separators=(",", ":"), default=str),
        )
        db.add(row)
        if commit:
            db.commit()
        return
    row.external_name = desired_name or row.external_name
    row.payload_json = json.dumps(payload, separators=(",", ":"), default=str)
    if commit:
        db.commit()


def _apply_task_payload_to_configuration_cache(
    db: Session,
    task: TaskQueue,
    merged: dict[str, Any],
    *,
    commit: bool = True,
) -> None:
    if task.configuration_id is None:
        raise ValueError("Not a configuration-scoped task.")
    if not isinstance(merged, dict):
        raise ValueError("Invalid task payload.")
    desired_name = _task_payload_external_name(task, merged)
    if not desired_name and task.entity_type not in _TEST_SINGLETON_ENTITY_TYPES:
        raise ValueError("Missing entity name in payload.")
    op = str(merged.get("__gc_op") or "").strip()
    base_q = db.query(ConfigurationConfigEntry).filter(
        ConfigurationConfigEntry.configuration_id == task.configuration_id,
        ConfigurationConfigEntry.entity_type == task.entity_type,
    )
    if op == "delete":
        names_to_delete = {str(task.external_name or "").strip()}
        if desired_name:
            names_to_delete.add(desired_name)
        for name in names_to_delete:
            if not name:
                continue
            base_q.filter(ConfigurationConfigEntry.external_name == name).delete(
                synchronize_session=False
            )
        if commit:
            db.commit()
        return

    payload = _task_payload_for_local_cache(merged)
    row = base_q.filter(
        ConfigurationConfigEntry.external_name == task.external_name
    ).one_or_none()
    if row is None and desired_name:
        row = base_q.filter(
            ConfigurationConfigEntry.external_name == desired_name
        ).one_or_none()
    if row is None:
        row = ConfigurationConfigEntry(
            configuration_id=task.configuration_id,
            entity_type=task.entity_type,
            external_name=desired_name or str(task.external_name or "").strip(),
            payload_json=json.dumps(payload, separators=(",", ":"), default=str),
        )
        db.add(row)
        if commit:
            db.commit()
        return
    row.external_name = desired_name or row.external_name
    row.payload_json = json.dumps(payload, separators=(",", ":"), default=str)
    if commit:
        db.commit()


def enqueue_configuration_merged(
    db: Session,
    *,
    configuration_id: int,
    entity_type: str,
    external_name: str,
    merged: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    """Queue a change to ``configuration_config_entries`` (applied on approval, like test firewalls)."""
    if db.get(Configuration, configuration_id) is None:
        raise ValueError("Configuration not found")
    if str(merged.get("__gc_op") or "").strip() == "delete":
        raise ValueError("Use enqueue_configuration_delete for deletes")
    row = (
        db.query(ConfigurationConfigEntry)
        .filter(
            ConfigurationConfigEntry.configuration_id == configuration_id,
            ConfigurationConfigEntry.entity_type == entity_type,
            ConfigurationConfigEntry.external_name == external_name,
        )
        .one_or_none()
    )
    if _task_payload_matches_configuration_cache(row, merged):
        return None
    task = TaskQueue(
        firewall_id=None,
        configuration_id=configuration_id,
        entity_type=entity_type,
        external_name=external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_configuration_delete(
    db: Session,
    *,
    configuration_id: int,
    entity_type: str,
    external_name: str,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    if db.get(Configuration, configuration_id) is None:
        raise ValueError("Configuration not found")
    task = TaskQueue(
        firewall_id=None,
        configuration_id=configuration_id,
        entity_type=entity_type,
        external_name=external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps({"__gc_op": "delete"}, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


_TASK_QUEUE_SEND_SUPPORTED_ENTITY_TYPES = frozenset(
    {
        "acl_rule",
        "admin_authen",
        "admin_settings",
        ENTITY_INTERFACE,
        ENTITY_VLAN,
        "backup",
        ENTITY_BRIDGE_PAIR,
        ENTITY_LAG,
        ENTITY_ALIAS,
        ENTITY_ZONE,
        "dns_forwarders",
        ENTITY_DOS_BYPASS_RULE,
        ENTITY_IPS_SWITCH,
        ENTITY_DOS_SETTINGS,
        ENTITY_SPOOF_PREVENTION,
        ENTITY_FIREWALL_RULE,
        ENTITY_IPS_FULL_SIGNATURE_PACK,
        ENTITY_IPS_POLICY,
        ENTITY_WEBFILTER_POLICY,
        ENTITY_IPS_CUSTOM_SIGNATURE,
        "notification",
        "notification_list",
        "reports_retention",
        ENTITY_FIREWALL_RULE_GROUP,
        "snmpv3_user",
        "syslog_server",
        ENTITY_TRUSTED_MAC,
        "url_group",
        "useractivity",
        ENTITY_IP_HOST,
        ENTITY_IP_HOSTGROUP,
        ENTITY_USER,
        ENTITY_USER_GROUP,
        ENTITY_ADMIN_PROFILE,
    }
)

_TASK_QUEUE_CREATE_SUPPORTED_ENTITY_TYPES = frozenset(
    {
        "acl_rule",
        "admin_authen",
        "admin_settings",
        ENTITY_BRIDGE_PAIR,
        ENTITY_LAG,
        ENTITY_ALIAS,
        "backup",
        "dns_forwarders",
        ENTITY_DOS_BYPASS_RULE,
        ENTITY_ZONE,
        ENTITY_IPS_SWITCH,
        ENTITY_DOS_SETTINGS,
        ENTITY_SPOOF_PREVENTION,
        ENTITY_FIREWALL_RULE,
        ENTITY_IPS_FULL_SIGNATURE_PACK,
        ENTITY_IPS_POLICY,
        ENTITY_WEBFILTER_POLICY,
        ENTITY_IPS_CUSTOM_SIGNATURE,
        "notification",
        "notification_list",
        "reports_retention",
        ENTITY_FIREWALL_RULE_GROUP,
        "snmpv3_user",
        "syslog_server",
        ENTITY_TRUSTED_MAC,
        "url_group",
        "useractivity",
        ENTITY_IP_HOST,
        ENTITY_IP_HOSTGROUP,
        ENTITY_USER,
        ENTITY_USER_GROUP,
        ENTITY_ADMIN_PROFILE,
    }
)


def _task_entity_supported_for_send(entity_type: str) -> bool:
    et = str(entity_type or "").strip()
    if not et:
        return False
    if et in _TASK_QUEUE_SEND_SUPPORTED_ENTITY_TYPES:
        return True
    if et in HS_XML_TAG:
        return True
    if et in PROFILE_ENTITY_XML:
        return True
    return False


def _task_entity_supports_create(entity_type: str) -> bool:
    et = str(entity_type or "").strip()
    if not et:
        return False
    if et in _TASK_QUEUE_CREATE_SUPPORTED_ENTITY_TYPES:
        return True
    if et in HS_XML_TAG:
        return True
    if et in PROFILE_ENTITY_XML:
        return True
    return False


def enqueue_configuration_apply_to_firewalls(
    db: Session,
    *,
    configuration_id: int,
    firewall_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> dict[str, Any]:
    """
    Queue update/create tasks that apply one configuration's cached objects to many firewalls.

    Compares each ``configuration_config_entries`` item against matching
    ``firewall_config_entries`` rows by ``(entity_type, external_name)`` and only queues
    rows that differ or are missing on the firewall.
    """
    cfg = db.get(Configuration, configuration_id)
    if cfg is None:
        raise ValueError("Configuration not found")

    seen_fw: set[int] = set()
    wanted_fw_ids: list[int] = []
    for raw in firewall_ids:
        try:
            fid = int(raw)
        except (TypeError, ValueError):
            continue
        if fid <= 0 or fid in seen_fw:
            continue
        seen_fw.add(fid)
        wanted_fw_ids.append(fid)
    wanted_fw_ids.sort()
    if not wanted_fw_ids:
        raise ValueError("Select at least one firewall")

    existing_fw_ids = {
        int(x[0])
        for x in db.query(Firewall.id).filter(Firewall.id.in_(wanted_fw_ids)).all()
    }
    if not existing_fw_ids:
        raise ValueError("No selected firewalls were found")

    entries = (
        db.query(ConfigurationConfigEntry)
        .filter(ConfigurationConfigEntry.configuration_id == configuration_id)
        .all()
    )

    firewall_rows = (
        db.query(FirewallConfigEntry)
        .filter(FirewallConfigEntry.firewall_id.in_(sorted(existing_fw_ids)))
        .all()
    )
    by_key: dict[tuple[int, str, str], FirewallConfigEntry] = {}
    for row in firewall_rows:
        by_key[(int(row.firewall_id), str(row.entity_type), str(row.external_name))] = row

    skipped: list[dict[str, Any]] = []
    queued: list[TaskQueue] = []
    unchanged_count = 0
    compared_count = 0

    missing_fw_ids = sorted(set(wanted_fw_ids) - existing_fw_ids)
    for fid in missing_fw_ids:
        skipped.append(
            {
                "firewall_id": fid,
                "reason": "Firewall not found.",
            }
        )

    for src in entries:
        et = str(src.entity_type or "").strip()
        name = str(src.external_name or "").strip()
        if not et or not name:
            skipped.append(
                {
                    "config_entry_id": int(src.id),
                    "entity_type": et or None,
                    "external_name": name or None,
                    "reason": "Configuration cache row is missing entity_type or external_name.",
                }
            )
            continue
        if not _task_entity_supported_for_send(et):
            skipped.append(
                {
                    "config_entry_id": int(src.id),
                    "entity_type": et,
                    "external_name": name,
                    "reason": "This entity type cannot be sent via the task queue.",
                }
            )
            continue
        try:
            merged = json.loads(src.payload_json or "{}")
        except (json.JSONDecodeError, TypeError):
            merged = None
        if not isinstance(merged, dict):
            skipped.append(
                {
                    "config_entry_id": int(src.id),
                    "entity_type": et,
                    "external_name": name,
                    "reason": "Configuration cache payload is not valid JSON.",
                }
            )
            continue
        merged = dict(merged)
        merged.pop("__gc_op", None)
        if not merged:
            skipped.append(
                {
                    "config_entry_id": int(src.id),
                    "entity_type": et,
                    "external_name": name,
                    "reason": "Configuration cache payload is empty.",
                }
            )
            continue
        payload_json = json.dumps(merged, separators=(",", ":"), default=str)
        for fid in sorted(existing_fw_ids):
            compared_count += 1
            existing = by_key.get((fid, et, name))
            if existing is not None and _task_payload_matches_cache(existing, merged):
                unchanged_count += 1
                continue
            if existing is None and not _task_entity_supports_create(et):
                skipped.append(
                    {
                        "config_entry_id": int(src.id),
                        "firewall_id": fid,
                        "entity_type": et,
                        "external_name": name,
                        "reason": "Object is missing on firewall and this entity type does not support create.",
                    }
                )
                continue
            task = TaskQueue(
                firewall_id=fid,
                entity_type=et,
                external_name=name,
                status="pending",
                error_message=None,
                payload_json=payload_json,
                created_by_user_id=created_by_user_id,
                created_by_username=created_by_username,
            )
            db.add(task)
            queued.append(task)
    db.commit()

    return {
        "queued_count": len(queued),
        "task_ids": [int(t.id) for t in queued if t.id is not None],
        "unchanged_count": unchanged_count,
        "compared_count": compared_count,
        "skipped": skipped,
    }


def _firewall_rule_reorder_payload(
    base_payload: dict[str, Any], *, after_rule_name: str | None
) -> dict[str, Any]:
    merged = dict(base_payload)
    after_name = str(after_rule_name or "").strip()
    if after_name:
        merged["Position"] = "After"
        merged["After"] = {"Name": after_name}
    else:
        merged["Position"] = "Top"
        merged.pop("After", None)
    # Reorder intent should be explicit and deterministic.
    merged.pop("Before", None)
    return merged


def enqueue_firewall_rule_reorder_batch(
    db: Session,
    *,
    firewall_id: int,
    ordered_config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
    if db.get(Firewall, firewall_id) is None:
        raise ValueError("Firewall not found")
    seen: set[int] = set()
    ordered_ids: list[int] = []
    for raw in ordered_config_entry_ids:
        try:
            rid = int(raw)
        except (TypeError, ValueError):
            continue
        if rid <= 0 or rid in seen:
            continue
        seen.add(rid)
        ordered_ids.append(rid)
    if not ordered_ids:
        raise ValueError("No firewall rule entries provided")

    rows = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.id.in_(ordered_ids),
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_FIREWALL_RULE,
        )
        .all()
    )
    by_id: dict[int, FirewallConfigEntry] = {
        int(r.id): r for r in rows if r.id is not None
    }
    if len(by_id) != len(ordered_ids):
        raise ValueError("Some firewall rule entries were not found for this firewall")

    tasks: list[TaskQueue] = []
    previous_rule_name = ""
    for rid in ordered_ids:
        entry = by_id[rid]
        try:
            base = json.loads(entry.payload_json or "{}")
        except (json.JSONDecodeError, TypeError):
            base = {}
        if not isinstance(base, dict):
            base = {}
        rule_name = str(base.get("Name") or entry.external_name or "").strip()
        if not rule_name:
            raise ValueError(f"Firewall rule entry {rid} has no rule name")

        merged = _firewall_rule_reorder_payload(
            base, after_rule_name=previous_rule_name or None
        )
        if _task_payload_matches_cache(entry, merged):
            previous_rule_name = rule_name
            continue
        t = TaskQueue(
            firewall_id=firewall_id,
            entity_type=ENTITY_FIREWALL_RULE,
            external_name=entry.external_name,
            status="pending",
            error_message=None,
            payload_json=json.dumps(merged, separators=(",", ":"), default=str),
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
        db.add(t)
        db.flush()
        tasks.append(t)
        previous_rule_name = rule_name
    if tasks:
        db.commit()
        for t in tasks:
            db.refresh(t)
    return tasks


_CONFIG_VIEWER_FW_UNSUPPORTED_DELETE_TYPES = frozenset(
    {
        ENTITY_FIREWALL_RULE,
        ENTITY_FIREWALL_RULE_GROUP,
        "acl_rule",
        "useractivity",
        "url_group",
        "admin_authen",
        "admin_settings",
        "backup",
        "dns_forwarders",
        "notification",
        "notification_list",
        "reports_retention",
        "syslog_server",
        "snmpv3_user",
        "dos_bypass_rule",
    }
)

_CONFIG_VIEWER_FW_SETTINGS_NO_DELETE_TYPES = frozenset(
    {
        ENTITY_IPS_SWITCH,
        ENTITY_DOS_SETTINGS,
        ENTITY_SPOOF_PREVENTION,
        ENTITY_IPS_FULL_SIGNATURE_PACK,
    }
)


def _enqueue_firewall_config_entry_delete(
    db: Session,
    entry: FirewallConfigEntry,
    *,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    """Queue a single cached-object delete for a real firewall (Sophos API on approval)."""
    et = str(entry.entity_type or "").strip()
    if et in _CONFIG_VIEWER_FW_SETTINGS_NO_DELETE_TYPES:
        raise ValueError(
            "This settings object cannot be deleted from the config viewer; edit it in place instead."
        )
    if et == ENTITY_INTERFACE:
        raise ValueError("Physical interfaces cannot be deleted from the config viewer.")
    if et == ENTITY_ZONE:
        raise ValueError(
            "Zone deletes are not supported through the task queue yet."
        )
    if et in _CONFIG_VIEWER_FW_UNSUPPORTED_DELETE_TYPES:
        raise ValueError(
            "Deletes for this object type are not supported through the task queue yet."
        )
    if et in NETWORK_ENTITY_DELETABLE_TYPES:
        return enqueue_network_entity_delete(
            db,
            config_entry_id=int(entry.id),
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
    if et == ENTITY_IP_HOST or et in HS_TASK_ENTITY_TYPES:
        return enqueue_hs_config_delete(
            db,
            config_entry_id=int(entry.id),
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
    if et == ENTITY_IPS_POLICY:
        return enqueue_ips_policy_delete(
            db,
            config_entry_id=int(entry.id),
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
    if et == ENTITY_WEBFILTER_POLICY:
        return enqueue_webfilter_policy_delete(
            db,
            config_entry_id=int(entry.id),
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
    if et == ENTITY_USER:
        return enqueue_auth_user_delete(
            db,
            config_entry_id=int(entry.id),
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
    if et == ENTITY_USER_GROUP:
        return enqueue_auth_user_group_delete(
            db,
            config_entry_id=int(entry.id),
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
    if et == ENTITY_ADMIN_PROFILE:
        return enqueue_admin_profile_delete(
            db,
            config_entry_id=int(entry.id),
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
    if et in PROFILE_ENTITY_XML:
        return enqueue_profile_entity_delete(
            db,
            config_entry_id=int(entry.id),
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
    if et == ENTITY_IPS_CUSTOM_SIGNATURE:
        return enqueue_ips_custom_signature_delete(
            db,
            config_entry_id=int(entry.id),
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
    if et == ENTITY_TRUSTED_MAC:
        return enqueue_ips_trusted_mac_delete(
            db,
            config_entry_id=int(entry.id),
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
    raise ValueError(
        "Deletes for this object type are not supported through the task queue yet."
    )


def enqueue_config_viewer_deletes_for_firewall(
    db: Session,
    *,
    firewall_id: int,
    config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> dict[str, Any]:
    """Queue deletes for many cached rows on one firewall; returns task ids and per-row skips."""
    fw = db.get(Firewall, firewall_id)
    if fw is None:
        raise ValueError("Firewall not found")
    if not bool(fw.is_test):
        raise ValueError("Config viewer delete is only available for test firewalls.")
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
        raise ValueError("No config entry ids provided")
    tasks: list[TaskQueue] = []
    skipped: list[dict[str, Any]] = []
    for eid in ids:
        entry = db.get(FirewallConfigEntry, eid)
        if entry is None or int(entry.firewall_id) != int(firewall_id):
            skipped.append(
                {
                    "config_entry_id": eid,
                    "reason": "Config entry not found for this firewall.",
                }
            )
            continue
        try:
            tasks.append(
                _enqueue_firewall_config_entry_delete(
                    db,
                    entry,
                    created_by_user_id=created_by_user_id,
                    created_by_username=created_by_username,
                )
            )
        except ValueError as exc:
            skipped.append(
                {
                    "config_entry_id": eid,
                    "entity_type": entry.entity_type,
                    "reason": str(exc),
                }
            )
    return {
        "queued_count": len(tasks),
        "task_ids": [t.id for t in tasks],
        "skipped": skipped,
    }


def enqueue_config_viewer_deletes_for_configuration(
    db: Session,
    *,
    configuration_id: int,
    config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> dict[str, Any]:
    """Queue local-cache deletes for configuration rows (applied on task approval)."""
    if db.get(Configuration, configuration_id) is None:
        raise ValueError("Configuration not found")
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
        raise ValueError("No config entry ids provided")
    tasks: list[TaskQueue] = []
    skipped: list[dict[str, Any]] = []
    for eid in ids:
        entry = db.get(ConfigurationConfigEntry, eid)
        if entry is None or int(entry.configuration_id) != int(configuration_id):
            skipped.append(
                {
                    "config_entry_id": eid,
                    "reason": "Config entry not found for this configuration.",
                }
            )
            continue
        try:
            tasks.append(
                enqueue_configuration_delete(
                    db,
                    configuration_id=configuration_id,
                    entity_type=entry.entity_type,
                    external_name=entry.external_name,
                    created_by_user_id=created_by_user_id,
                    created_by_username=created_by_username,
                )
            )
        except ValueError as exc:
            skipped.append(
                {
                    "config_entry_id": eid,
                    "entity_type": entry.entity_type,
                    "reason": str(exc),
                }
            )
    return {
        "queued_count": len(tasks),
        "task_ids": [t.id for t in tasks],
        "skipped": skipped,
    }


def enqueue_ips_switch_update(
    db: Session,
    *,
    config_entry_id: int,
    status: str,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    """Queue Set IPSSwitch (singleton cache row external_name __config__)."""
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_IPS_SWITCH:
        raise ValueError("Not an IPS switch config entry")
    st = str(status or "").strip()
    if st not in ("Enable", "Disable"):
        raise ValueError("status must be Enable or Disable")
    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")
    merged = dict(base)
    merged["Status"] = st
    if _task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_IPS_SWITCH,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_ips_switch_updates_batch(
    db: Session,
    *,
    items: list[tuple[int, str]],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
    """Each item is (config_entry_id, 'Enable'|'Disable')."""
    out: list[TaskQueue] = []
    for config_entry_id, status in items:
        t = enqueue_ips_switch_update(
            db,
            config_entry_id=config_entry_id,
            status=status,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
        if t is not None:
            out.append(t)
    return out


def _firewall_singleton_config_entry(
    db: Session, *, firewall_id: int, entity_type: str
) -> FirewallConfigEntry | None:
    return (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == entity_type,
            FirewallConfigEntry.external_name == "__config__",
        )
        .one_or_none()
    )


def enqueue_dos_settings_update(
    db: Session,
    *,
    firewall_id: int,
    settings_patch: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = _firewall_singleton_config_entry(db, firewall_id=firewall_id, entity_type=ENTITY_DOS_SETTINGS)
    if entry is None:
        raise ValueError(
            "DoS settings are not in the cache for this firewall. Sync DoS settings from Inventory."
        )
    try:
        base = json.loads(entry.payload_json)
    except (json.JSONDecodeError, TypeError):
        base = {}
    if not isinstance(base, dict):
        base = {}
    patch = settings_patch if isinstance(settings_patch, dict) else {}
    merged = merge_dos_settings_payload(base, patch)
    if _task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=firewall_id,
        entity_type=ENTITY_DOS_SETTINGS,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_spoof_prevention_update(
    db: Session,
    *,
    firewall_id: int,
    settings_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = _firewall_singleton_config_entry(
        db, firewall_id=firewall_id, entity_type=ENTITY_SPOOF_PREVENTION
    )
    if entry is None:
        raise ValueError(
            "Spoof prevention is not in the cache for this firewall. "
            "Sync spoof prevention from Inventory."
        )
    try:
        base = json.loads(entry.payload_json)
    except (json.JSONDecodeError, TypeError):
        base = {}
    if not isinstance(base, dict):
        base = {}
    client = settings_client if isinstance(settings_client, dict) else {}
    merged = merge_spoof_prevention_payload(base, client)
    if _task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=firewall_id,
        entity_type=ENTITY_SPOOF_PREVENTION,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_ips_policy_delete(
    db: Session,
    *,
    config_entry_id: int,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_IPS_POLICY:
        raise ValueError("Not an IPS policy config entry")
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_IPS_POLICY,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps({"__gc_op": "delete"}, separators=(",", ":")),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_ips_policy_deletes_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
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
    tasks: list[TaskQueue] = []
    for cid in ids:
        tasks.append(
            enqueue_ips_policy_delete(
                db,
                config_entry_id=cid,
                created_by_user_id=created_by_user_id,
                created_by_username=created_by_username,
            )
        )
    return tasks


def enqueue_ips_policy_create(
    db: Session,
    *,
    firewall_id: int,
    policy_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    if db.get(Firewall, firewall_id) is None:
        raise ValueError("Firewall not found")
    built = policy_from_client_dict(policy_client)
    name = str(built.get("Name") or "").strip()
    if not name:
        raise ValueError("Policy name is required")
    if _firewall_has_ips_policy_cache_entry(
        db, firewall_id=firewall_id, external_name=name
    ):
        raise ValueError(
            "A policy with this name is already in the cache for this firewall."
        )
    merged = dict(built)
    merged["__gc_op"] = "add"
    task = TaskQueue(
        firewall_id=firewall_id,
        entity_type=ENTITY_IPS_POLICY,
        external_name=name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_ips_policy_update(
    db: Session,
    *,
    config_entry_id: int,
    policy_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_IPS_POLICY:
        raise ValueError("Not an IPS policy config entry")
    try:
        base = json.loads(entry.payload_json)
    except (json.JSONDecodeError, TypeError):
        base = {}
    if not isinstance(base, dict):
        base = {}
    merged = task_payload_for_update(base, policy_client)
    if _task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_IPS_POLICY,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_webfilter_policy_delete(
    db: Session,
    *,
    config_entry_id: int,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_WEBFILTER_POLICY:
        raise ValueError("Not a web filter policy config entry")
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_WEBFILTER_POLICY,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps({"__gc_op": "delete"}, separators=(",", ":")),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_webfilter_policy_deletes_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
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
    tasks: list[TaskQueue] = []
    for cid in ids:
        tasks.append(
            enqueue_webfilter_policy_delete(
                db,
                config_entry_id=cid,
                created_by_user_id=created_by_user_id,
                created_by_username=created_by_username,
            )
        )
    return tasks


def enqueue_webfilter_policy_create(
    db: Session,
    *,
    firewall_id: int,
    policy_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    if db.get(Firewall, firewall_id) is None:
        raise ValueError("Firewall not found")
    built = wfp_policy_from_client_dict(policy_client)
    name = str(built.get("Name") or "").strip()
    if not name:
        raise ValueError("Policy name is required")
    if _firewall_has_webfilter_policy_cache_entry(
        db, firewall_id=firewall_id, external_name=name
    ):
        raise ValueError(
            "A web filter policy with this name is already in the cache for this firewall."
        )
    merged = dict(built)
    merged["__gc_op"] = "add"
    task = TaskQueue(
        firewall_id=firewall_id,
        entity_type=ENTITY_WEBFILTER_POLICY,
        external_name=name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_webfilter_policy_update(
    db: Session,
    *,
    config_entry_id: int,
    policy_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_WEBFILTER_POLICY:
        raise ValueError("Not a web filter policy config entry")
    try:
        base = json.loads(entry.payload_json)
    except (json.JSONDecodeError, TypeError):
        base = {}
    if not isinstance(base, dict):
        base = {}
    merged = task_payload_for_wfp_update(base, policy_client)
    if _task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_WEBFILTER_POLICY,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def _scalar_any(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, dict):
        raw = raw.get("#text") if "#text" in raw else raw.get("text")
    return str(raw).strip()


def enqueue_auth_user_delete(
    db: Session,
    *,
    config_entry_id: int,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_USER:
        raise ValueError("Not a user config entry")
    try:
        base = json.loads(entry.payload_json)
    except (json.JSONDecodeError, TypeError):
        base = {}
    if not isinstance(base, dict):
        base = {}
    uname = username_from_user_payload(base, entry.external_name)
    payload = {"__gc_op": "delete", "__gc_username": uname}
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_USER,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(payload, separators=(",", ":")),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_auth_user_deletes_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
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
    tasks: list[TaskQueue] = []
    for cid in ids:
        tasks.append(
            enqueue_auth_user_delete(
                db,
                config_entry_id=cid,
                created_by_user_id=created_by_user_id,
                created_by_username=created_by_username,
            )
        )
    return tasks


def enqueue_auth_user_create(
    db: Session,
    *,
    firewall_id: int,
    user_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    if db.get(Firewall, firewall_id) is None:
        raise ValueError("Firewall not found")
    merged = merge_user_payload({}, user_client)
    merged["__gc_op"] = "add"
    uname = username_from_user_payload(merged, "")
    if not uname:
        raise ValueError("Username is required")
    if firewall_has_user_cache_row(db, firewall_id=firewall_id, external_name=uname):
        raise ValueError("A user with this username is already in the cache for this firewall.")
    task = TaskQueue(
        firewall_id=firewall_id,
        entity_type=ENTITY_USER,
        external_name=uname,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_auth_user_update(
    db: Session,
    *,
    config_entry_id: int,
    user_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_USER:
        raise ValueError("Not a user config entry")
    try:
        base = json.loads(entry.payload_json)
    except (json.JSONDecodeError, TypeError):
        base = {}
    if not isinstance(base, dict):
        base = {}
    merged = merge_user_payload(base, user_client)
    if auth_task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_USER,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_auth_user_group_delete(
    db: Session,
    *,
    config_entry_id: int,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_USER_GROUP:
        raise ValueError("Not a user group config entry")
    try:
        base = json.loads(entry.payload_json)
    except (json.JSONDecodeError, TypeError):
        base = {}
    if not isinstance(base, dict):
        base = {}
    gname = user_group_name_from_merged(base, entry.external_name)
    payload = {"__gc_op": "delete", "__gc_group_name": gname}
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_USER_GROUP,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(payload, separators=(",", ":")),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_auth_user_group_deletes_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
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
    tasks: list[TaskQueue] = []
    for cid in ids:
        tasks.append(
            enqueue_auth_user_group_delete(
                db,
                config_entry_id=cid,
                created_by_user_id=created_by_user_id,
                created_by_username=created_by_username,
            )
        )
    return tasks


def enqueue_auth_user_group_create(
    db: Session,
    *,
    firewall_id: int,
    group_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    if db.get(Firewall, firewall_id) is None:
        raise ValueError("Firewall not found")
    merged = merge_user_group_payload({}, group_client)
    merged["__gc_op"] = "add"
    gname = user_group_name_from_merged(merged, "")
    if not gname:
        raise ValueError("Group name is required")
    if firewall_has_user_group_cache_row(db, firewall_id=firewall_id, external_name=gname):
        raise ValueError(
            "A user group with this name is already in the cache for this firewall."
        )
    task = TaskQueue(
        firewall_id=firewall_id,
        entity_type=ENTITY_USER_GROUP,
        external_name=gname,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_auth_user_group_update(
    db: Session,
    *,
    config_entry_id: int,
    group_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_USER_GROUP:
        raise ValueError("Not a user group config entry")
    try:
        base = json.loads(entry.payload_json)
    except (json.JSONDecodeError, TypeError):
        base = {}
    if not isinstance(base, dict):
        base = {}
    merged = merge_user_group_payload(base, group_client)
    if auth_task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_USER_GROUP,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_admin_profile_delete(
    db: Session,
    *,
    config_entry_id: int,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_ADMIN_PROFILE:
        raise ValueError("Not an administration profile config entry")
    try:
        base = json.loads(entry.payload_json)
    except (json.JSONDecodeError, TypeError):
        base = {}
    if not isinstance(base, dict):
        base = {}
    pname = _scalar_any(base.get("Name")) or entry.external_name
    payload = {"__gc_op": "delete", "__gc_profile_name": pname}
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_ADMIN_PROFILE,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(payload, separators=(",", ":")),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_admin_profile_deletes_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
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
    tasks: list[TaskQueue] = []
    for cid in ids:
        tasks.append(
            enqueue_admin_profile_delete(
                db,
                config_entry_id=cid,
                created_by_user_id=created_by_user_id,
                created_by_username=created_by_username,
            )
        )
    return tasks


def enqueue_admin_profile_create(
    db: Session,
    *,
    firewall_id: int,
    profile_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    if db.get(Firewall, firewall_id) is None:
        raise ValueError("Firewall not found")
    merged = merge_admin_profile_payload({}, profile_client)
    merged["__gc_op"] = "add"
    pname = _scalar_any(merged.get("Name"))
    if not pname:
        raise ValueError("Profile name is required")
    if firewall_has_admin_profile_cache_row(db, firewall_id=firewall_id, external_name=pname):
        raise ValueError(
            "An administration profile with this name is already in the cache for this firewall."
        )
    task = TaskQueue(
        firewall_id=firewall_id,
        entity_type=ENTITY_ADMIN_PROFILE,
        external_name=pname,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_admin_profile_update(
    db: Session,
    *,
    config_entry_id: int,
    profile_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_ADMIN_PROFILE:
        raise ValueError("Not an administration profile config entry")
    try:
        base = json.loads(entry.payload_json)
    except (json.JSONDecodeError, TypeError):
        base = {}
    if not isinstance(base, dict):
        base = {}
    merged = merge_admin_profile_payload(base, profile_client)
    if auth_task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_ADMIN_PROFILE,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_profile_entity_create_batch(
    db: Session,
    *,
    entity_type: str,
    firewall_ids: list[int],
    client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
    if entity_type not in PROFILE_ENTITY_XML:
        raise ValueError("Unsupported profile entity type")
    seen: set[int] = set()
    ids: list[int] = []
    for raw in firewall_ids:
        try:
            n = int(raw)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        ids.append(n)
    if not ids:
        raise ValueError("Select at least one firewall")

    merged = merge_profile_entity_payload({}, client)
    name = str(merged.get("Name") or "").strip()
    if not name:
        raise ValueError("Name is required")
    merged["__gc_op"] = "add"
    payload_json = json.dumps(merged, separators=(",", ":"), default=str)

    tasks: list[TaskQueue] = []
    for fid in ids:
        if db.get(Firewall, fid) is None:
            raise ValueError(f"Firewall not found: {fid}")
        if _firewall_has_profile_entity_cache_row(
            db, entity_type=entity_type, firewall_id=fid, external_name=name
        ):
            raise ValueError(
                f"An object named {name!r} is already in the cache for firewall ID {fid}."
            )
        task = TaskQueue(
            firewall_id=fid,
            entity_type=entity_type,
            external_name=name,
            status="pending",
            error_message=None,
            payload_json=payload_json,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
        db.add(task)
        tasks.append(task)
    db.commit()
    for t in tasks:
        db.refresh(t)
    return tasks


def enqueue_profile_entity_update(
    db: Session,
    *,
    config_entry_id: int,
    client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type not in PROFILE_ENTITY_XML:
        raise ValueError("Not a profile entity config entry")
    try:
        base = json.loads(entry.payload_json)
    except (json.JSONDecodeError, TypeError):
        base = {}
    if not isinstance(base, dict):
        base = {}
    merged = merge_profile_entity_payload(base, client)
    if _task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=entry.entity_type,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_profile_entity_update_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
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
    tasks: list[TaskQueue] = []
    for cid in ids:
        t = enqueue_profile_entity_update(
            db,
            config_entry_id=cid,
            client=client,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
        if t is not None:
            tasks.append(t)
    return tasks


def enqueue_profile_entity_delete(
    db: Session,
    *,
    config_entry_id: int,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type not in PROFILE_ENTITY_XML:
        raise ValueError("Not a profile entity config entry")
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=entry.entity_type,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps({"__gc_op": "delete"}, separators=(",", ":")),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_profile_entity_deletes_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
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
    tasks: list[TaskQueue] = []
    for cid in ids:
        tasks.append(
            enqueue_profile_entity_delete(
                db,
                config_entry_id=cid,
                created_by_user_id=created_by_user_id,
                created_by_username=created_by_username,
            )
        )
    return tasks


def enqueue_ips_custom_signature_delete(
    db: Session,
    *,
    config_entry_id: int,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_IPS_CUSTOM_SIGNATURE:
        raise ValueError("Not an IPS custom signature config entry")
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_IPS_CUSTOM_SIGNATURE,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps({"__gc_op": "delete"}, separators=(",", ":")),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_ips_custom_signature_deletes_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
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
    tasks: list[TaskQueue] = []
    for cid in ids:
        tasks.append(
            enqueue_ips_custom_signature_delete(
                db,
                config_entry_id=cid,
                created_by_user_id=created_by_user_id,
                created_by_username=created_by_username,
            )
        )
    return tasks


def enqueue_ips_custom_signature_create(
    db: Session,
    *,
    firewall_id: int,
    signature_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    if db.get(Firewall, firewall_id) is None:
        raise ValueError("Firewall not found")
    built = validate_and_build_signature_payload(signature_client)
    name = str(built.get("Name") or "").strip()
    if _firewall_has_ips_custom_signature_cache_entry(
        db, firewall_id=firewall_id, external_name=name
    ):
        raise ValueError(
            "A custom signature with this name is already in the cache for this firewall."
        )
    merged = dict(built)
    merged["__gc_op"] = "add"
    task = TaskQueue(
        firewall_id=firewall_id,
        entity_type=ENTITY_IPS_CUSTOM_SIGNATURE,
        external_name=name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_ips_custom_signature_create_batch(
    db: Session,
    *,
    firewall_ids: list[int],
    signature_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
    """Queue the same new IPS custom signature on multiple firewalls (one task each)."""
    seen: set[int] = set()
    ids: list[int] = []
    for raw in firewall_ids:
        try:
            n = int(raw)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        ids.append(n)
    if not ids:
        raise ValueError("Select at least one firewall")

    built = validate_and_build_signature_payload(signature_client)
    name = str(built.get("Name") or "").strip()
    merged = dict(built)
    merged["__gc_op"] = "add"
    payload_json = json.dumps(merged, separators=(",", ":"), default=str)

    tasks: list[TaskQueue] = []
    for fid in ids:
        if db.get(Firewall, fid) is None:
            raise ValueError(f"Firewall not found: {fid}")
        if _firewall_has_ips_custom_signature_cache_entry(
            db, firewall_id=fid, external_name=name
        ):
            raise ValueError(
                f"A custom signature named {name!r} is already in the cache for firewall ID {fid}."
            )
        task = TaskQueue(
            firewall_id=fid,
            entity_type=ENTITY_IPS_CUSTOM_SIGNATURE,
            external_name=name,
            status="pending",
            error_message=None,
            payload_json=payload_json,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
        db.add(task)
        tasks.append(task)
    db.commit()
    for t in tasks:
        db.refresh(t)
    return tasks


def enqueue_ips_trusted_mac_delete(
    db: Session,
    *,
    config_entry_id: int,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_TRUSTED_MAC:
        raise ValueError("Not a Trusted MAC config entry")
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_TRUSTED_MAC,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps({"__gc_op": "delete"}, separators=(",", ":")),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_ips_trusted_mac_deletes_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
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
    tasks: list[TaskQueue] = []
    for cid in ids:
        tasks.append(
            enqueue_ips_trusted_mac_delete(
                db,
                config_entry_id=cid,
                created_by_user_id=created_by_user_id,
                created_by_username=created_by_username,
            )
        )
    return tasks


def enqueue_ips_trusted_mac_create(
    db: Session,
    *,
    firewall_id: int,
    trusted_mac_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    if db.get(Firewall, firewall_id) is None:
        raise ValueError("Firewall not found")
    built = validate_and_build_trusted_mac_payload(trusted_mac_client)
    mac = str(built.get("MACAddress") or "").strip()
    if _firewall_has_trusted_mac_cache_entry(
        db, firewall_id=firewall_id, external_name=mac
    ):
        raise ValueError(
            "A Trusted MAC with this address is already in the cache for this firewall."
        )
    merged = dict(built)
    merged["__gc_op"] = "add"
    task = TaskQueue(
        firewall_id=firewall_id,
        entity_type=ENTITY_TRUSTED_MAC,
        external_name=mac,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_ips_trusted_mac_create_batch(
    db: Session,
    *,
    firewall_ids: list[int],
    trusted_mac_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
    seen: set[int] = set()
    ids: list[int] = []
    for raw in firewall_ids:
        try:
            n = int(raw)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        ids.append(n)
    if not ids:
        raise ValueError("Select at least one firewall")

    built = validate_and_build_trusted_mac_payload(trusted_mac_client)
    mac = str(built.get("MACAddress") or "").strip()
    merged = dict(built)
    merged["__gc_op"] = "add"
    payload_json = json.dumps(merged, separators=(",", ":"), default=str)

    tasks: list[TaskQueue] = []
    for fid in ids:
        if db.get(Firewall, fid) is None:
            raise ValueError(f"Firewall not found: {fid}")
        if _firewall_has_trusted_mac_cache_entry(
            db, firewall_id=fid, external_name=mac
        ):
            raise ValueError(
                f"A Trusted MAC {mac!r} is already in the cache for firewall ID {fid}."
            )
        task = TaskQueue(
            firewall_id=fid,
            entity_type=ENTITY_TRUSTED_MAC,
            external_name=mac,
            status="pending",
            error_message=None,
            payload_json=payload_json,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
        db.add(task)
        tasks.append(task)
    db.commit()
    for t in tasks:
        db.refresh(t)
    return tasks


def enqueue_ips_trusted_mac_update(
    db: Session,
    *,
    config_entry_id: int,
    trusted_mac_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_TRUSTED_MAC:
        raise ValueError("Not a Trusted MAC config entry")
    try:
        base = json.loads(entry.payload_json)
    except (json.JSONDecodeError, TypeError):
        base = {}
    if not isinstance(base, dict):
        base = {}
    merged = task_payload_for_trusted_mac_update(base, trusted_mac_client)
    if _task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_TRUSTED_MAC,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_ips_custom_signature_update(
    db: Session,
    *,
    config_entry_id: int,
    signature_client: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_IPS_CUSTOM_SIGNATURE:
        raise ValueError("Not an IPS custom signature config entry")
    try:
        base = json.loads(entry.payload_json)
    except (json.JSONDecodeError, TypeError):
        base = {}
    if not isinstance(base, dict):
        base = {}
    merged = task_payload_for_signature_update(base, signature_client)
    if _task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_IPS_CUSTOM_SIGNATURE,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_interface_update(
    db: Session,
    *,
    config_entry_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_INTERFACE:
        raise ValueError("Not an interface config entry")

    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")

    merged = merge_interface_flyout_form(base, form)
    if _task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_INTERFACE,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_vlan_update(
    db: Session,
    *,
    config_entry_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_VLAN:
        raise ValueError("Not a VLAN config entry")

    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")

    merged = merge_vlan_flyout_form(base, form)
    if _task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_VLAN,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_lag_update(
    db: Session,
    *,
    config_entry_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_LAG:
        raise ValueError("Not a LAG config entry")

    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")

    merged = merge_lag_flyout_form(base, form)
    if _task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_LAG,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_lag_create(
    db: Session,
    *,
    firewall_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
    force: bool = False,
) -> TaskQueue | None:
    fw_row = db.get(Firewall, firewall_id)
    if fw_row is None:
        raise ValueError("Firewall not found")

    merged = lag_create_merged_payload(form)
    hw = str(merged.get("Hardware") or "").strip()
    _validate_lag_create_against_cache(
        db, firewall_id=firewall_id, merged=merged, force=force
    )

    cache_row = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_LAG,
            FirewallConfigEntry.external_name == hw,
        )
        .one_or_none()
    )
    if _task_payload_matches_cache(cache_row, merged):
        return None

    task = TaskQueue(
        firewall_id=firewall_id,
        entity_type=ENTITY_LAG,
        external_name=hw,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_bridge_pair_update(
    db: Session,
    *,
    config_entry_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_BRIDGE_PAIR:
        raise ValueError("Not a bridge pair config entry")

    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")

    merged = merge_bridge_pair_flyout_form(base, form)
    if _task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_BRIDGE_PAIR,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_bridge_pair_create(
    db: Session,
    *,
    firewall_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
    force: bool = False,
) -> TaskQueue | None:
    """Queue a new bridge pair add. Cache conflicts are validated unless ``force`` is true."""
    fw_row = db.get(Firewall, firewall_id)
    if fw_row is None:
        raise ValueError("Firewall not found")

    merged = bridge_pair_create_merged_payload(form)
    hw = str(merged.get("Hardware") or "").strip()
    _validate_bridge_pair_create_against_cache(
        db, firewall_id=firewall_id, merged=merged, force=force
    )

    cache_row = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_BRIDGE_PAIR,
            FirewallConfigEntry.external_name == hw,
        )
        .one_or_none()
    )
    if _task_payload_matches_cache(cache_row, merged):
        return None

    task = TaskQueue(
        firewall_id=firewall_id,
        entity_type=ENTITY_BRIDGE_PAIR,
        external_name=hw,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_alias_update(
    db: Session,
    *,
    config_entry_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_ALIAS:
        raise ValueError("Not an alias config entry")

    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")

    merged = merge_alias_flyout_form(base, form)
    if _task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_ALIAS,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_alias_create(
    db: Session,
    *,
    firewall_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    fw_row = db.get(Firewall, firewall_id)
    if fw_row is None:
        raise ValueError("Firewall not found")

    merged = alias_create_merged_payload(form)
    ext = str(merged.get("Name") or "").strip()

    exists = (
        db.query(FirewallConfigEntry.id)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_ALIAS,
            FirewallConfigEntry.external_name == ext,
        )
        .first()
    )
    if exists is not None:
        raise ValueError(
            f'Alias "{ext}" is already in the cache for this firewall. Edit that row, or run sync.'
        )

    task = TaskQueue(
        firewall_id=firewall_id,
        entity_type=ENTITY_ALIAS,
        external_name=ext,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_zone_update(
    db: Session,
    *,
    config_entry_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_ZONE:
        raise ValueError("Not a zone config entry")

    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")

    merged = merge_zone_flyout_form(base, form)
    if _task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_ZONE,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_zone_update_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
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
    tasks: list[TaskQueue] = []
    for cid in ids:
        t = enqueue_zone_update(
            db,
            config_entry_id=cid,
            form=form,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
        if t is not None:
            tasks.append(t)
    return tasks


def enqueue_zone_create(
    db: Session,
    *,
    firewall_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    fw_row = db.get(Firewall, firewall_id)
    if fw_row is None:
        raise ValueError("Firewall not found")

    merged = zone_create_merged_payload(form)
    ext = str(merged.get("Name") or "").strip()
    if not ext:
        raise ValueError("Zone name is required")

    exists = (
        db.query(FirewallConfigEntry.id)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_ZONE,
            FirewallConfigEntry.external_name == ext,
        )
        .first()
    )
    if exists is not None:
        raise ValueError(
            f'Zone "{ext}" is already in the cache for this firewall. Edit that row, or run sync.'
        )

    task = TaskQueue(
        firewall_id=firewall_id,
        entity_type=ENTITY_ZONE,
        external_name=ext,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_zone_create_batch(
    db: Session,
    *,
    firewall_ids: list[int],
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
    seen: set[int] = set()
    ids: list[int] = []
    for raw in firewall_ids:
        try:
            n = int(raw)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        ids.append(n)
    if not ids:
        raise ValueError("Select at least one firewall")
    tasks: list[TaskQueue] = []
    for fid in ids:
        t = enqueue_zone_create(
            db,
            firewall_id=fid,
            form=form,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
        if t is not None:
            tasks.append(t)
    return tasks


def enqueue_ip_host_update(
    db: Session,
    *,
    config_entry_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_IP_HOST:
        raise ValueError("Not an IP host config entry")

    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")

    if str(base.get("HostType") or "").strip() == "System Host":
        raise ValueError("System host objects cannot be queued for update")

    merged = merge_ip_host_flyout_form(base, form)
    if _task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_IP_HOST,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_ip_host_delete(
    db: Session,
    *,
    config_entry_id: int,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type != ENTITY_IP_HOST:
        raise ValueError("Not an IP host config entry")
    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")
    if str(base.get("HostType") or "").strip() == "System Host":
        raise ValueError("System host objects cannot be queued for delete")

    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=ENTITY_IP_HOST,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps({"__gc_op": "delete"}, separators=(",", ":")),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_ip_host_delete_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
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
    tasks: list[TaskQueue] = []
    for cid in ids:
        tasks.append(
            enqueue_ip_host_delete(
                db,
                config_entry_id=cid,
                created_by_user_id=created_by_user_id,
                created_by_username=created_by_username,
            )
        )
    return tasks


def enqueue_ip_host_update_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
    """Queue the same IP host flyout update against multiple cached entries (one task each)."""
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
        raise ValueError("Select at least one firewall")
    tasks: list[TaskQueue] = []
    for cid in ids:
        t = enqueue_ip_host_update(
            db,
            config_entry_id=cid,
            form=form,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
        if t is not None:
            tasks.append(t)
    return tasks


def enqueue_ip_host_create(
    db: Session,
    *,
    firewall_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    """Queue a new IP host object (no existing firewall_config_entries row)."""
    fw_row = db.get(Firewall, firewall_id)
    if fw_row is None:
        raise ValueError("Firewall not found")

    base: dict[str, Any] = {}
    merged = merge_ip_host_flyout_form(base, form)
    name = str(merged.get("Name") or "").strip()
    if not name:
        raise ValueError("Name is required")

    existing = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == ENTITY_IP_HOST,
            FirewallConfigEntry.external_name == name,
        )
        .one_or_none()
    )
    if _task_payload_matches_cache(existing, merged):
        return None

    task = TaskQueue(
        firewall_id=firewall_id,
        entity_type=ENTITY_IP_HOST,
        external_name=name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_ip_host_create_many(
    db: Session,
    *,
    firewall_ids: list[int],
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
    """Queue the same new IP host payload on multiple firewalls (one task each)."""
    seen: set[int] = set()
    ids: list[int] = []
    for raw in firewall_ids:
        try:
            n = int(raw)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        ids.append(n)
    if not ids:
        raise ValueError("Select at least one firewall")

    base: dict[str, Any] = {}
    merged = merge_ip_host_flyout_form(base, form)
    name = str(merged.get("Name") or "").strip()
    if not name:
        raise ValueError("Name is required")

    payload_json = json.dumps(merged, separators=(",", ":"), default=str)
    selected_groups: list[str] = []
    raw_hg = form.get("host_groups")
    if isinstance(raw_hg, list):
        for x in raw_hg:
            g = str(x).strip()
            if g and g not in selected_groups:
                selected_groups.append(g)

    tasks: list[TaskQueue] = []
    for fid in ids:
        fw_row = db.get(Firewall, fid)
        if fw_row is None:
            raise ValueError(f"Firewall not found: {fid}")
        for gname in selected_groups:
            if _firewall_has_ip_hostgroup_cache_entry(
                db, firewall_id=fid, external_name=gname
            ):
                continue
            hg_payload = {
                "Name": gname,
                "Description": None,
                "IPFamily": "IPv4",
            }
            hg_task = TaskQueue(
                firewall_id=fid,
                entity_type=ENTITY_IP_HOSTGROUP,
                external_name=gname,
                status="pending",
                error_message=None,
                payload_json=json.dumps(hg_payload, separators=(",", ":"), default=str),
                created_by_user_id=created_by_user_id,
                created_by_username=created_by_username,
            )
            db.add(hg_task)
            tasks.append(hg_task)
        existing_host = (
            db.query(FirewallConfigEntry)
            .filter(
                FirewallConfigEntry.firewall_id == fid,
                FirewallConfigEntry.entity_type == ENTITY_IP_HOST,
                FirewallConfigEntry.external_name == name,
            )
            .one_or_none()
        )
        if not _task_payload_matches_cache(existing_host, merged):
            host_task = TaskQueue(
                firewall_id=fid,
                entity_type=ENTITY_IP_HOST,
                external_name=name,
                status="pending",
                error_message=None,
                payload_json=payload_json,
                created_by_user_id=created_by_user_id,
                created_by_username=created_by_username,
            )
            db.add(host_task)
            tasks.append(host_task)
    db.commit()
    for t in tasks:
        db.refresh(t)
    return tasks


HS_TASK_ENTITY_TYPES = frozenset(
    {
        "ip_hostgroup",
        "mac_host",
        "mac_hostgroup",
        "fqdn_host",
        "fqdn_hostgroup",
        "country_group",
        "service",
        "service_group",
    }
)

NETWORK_ENTITY_DELETABLE_TYPES = frozenset(
    {
        ENTITY_VLAN,
        ENTITY_BRIDGE_PAIR,
        ENTITY_LAG,
        ENTITY_ALIAS,
        ENTITY_ZONE,
    }
)

HS_XML_TAG: dict[str, str] = {
    "fqdn_host": "FQDNHost",
    "fqdn_hostgroup": "FQDNHostGroup",
    "mac_host": "MACHost",
    "mac_hostgroup": "MACHostGroup",
    "service": "Services",
    "service_group": "ServiceGroup",
    "country_group": "CountryGroup",
}


def merge_hs_flyout_form(
    entity_type: str, base: dict[str, Any], form: dict[str, Any]
) -> dict[str, Any]:
    if entity_type == ENTITY_IP_HOST:
        return merge_ip_host_flyout_form(base, form)
    if entity_type == "fqdn_host":
        return merge_fqdn_host_form(base, form)
    if entity_type == "service":
        return merge_service_form(base, form)
    if entity_type == "mac_host":
        return merge_mac_host_form(base, form)
    if entity_type == "ip_hostgroup":
        return merge_ip_hostgroup_form(base, form)
    if entity_type == "fqdn_hostgroup":
        return merge_fqdn_hostgroup_form(base, form)
    if entity_type == "service_group":
        return merge_service_group_form(base, form)
    if entity_type == "country_group":
        return merge_country_group_form(base, form)
    raise ValueError(f"Unsupported hosts/services entity type: {entity_type}")


def _firewall_has_hs_cache_entry(
    db: Session, *, firewall_id: int, entity_type: str, external_name: str
) -> bool:
    row = (
        db.query(FirewallConfigEntry.id)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == entity_type,
            FirewallConfigEntry.external_name == external_name,
        )
        .first()
    )
    return row is not None


def _fqdn_group_names_from_merged(merged: dict[str, Any]) -> list[str]:
    raw = merged.get("FQDNHostGroupList")
    if not isinstance(raw, dict):
        return []
    v = raw.get("FQDNHostGroup")
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if v is not None and str(v).strip():
        return [str(v).strip()]
    return []


def _member_str_list(merged: dict[str, Any], list_key: str, item_key: str) -> list[str]:
    raw = merged.get(list_key)
    if not isinstance(raw, dict):
        return []
    v = raw.get(item_key)
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if v is not None and str(v).strip():
        return [str(v).strip()]
    return []


def _service_list_for_sophos_create(merged: dict[str, Any]) -> list[dict[str, Any]]:
    st = str(merged.get("Type") or "")
    raw_sd = merged.get("ServiceDetails")
    if not isinstance(raw_sd, dict):
        return []
    detail = raw_sd.get("ServiceDetail")
    items: list[Any]
    if detail is None:
        items = []
    elif isinstance(detail, list):
        items = detail
    else:
        items = [detail]
    out: list[dict[str, Any]] = []
    for d in items:
        if not isinstance(d, dict):
            continue
        if st == "TCPorUDP":
            proto = str(d.get("Protocol") or d.get("ProtocolName") or "TCP").strip()
            out.append(
                {
                    "src_port": str(d.get("SourcePort") or "1:65535"),
                    "dst_port": str(d.get("DestinationPort") or ""),
                    "protocol": proto.lower(),
                }
            )
        elif st == "IP":
            pn = d.get("ProtocolName") or d.get("protocol")
            if pn:
                out.append({"protocol": str(pn)})
        elif st == "ICMP":
            out.append(
                {
                    "icmp_type": str(d.get("ICMPType") or ""),
                    "icmp_code": str(d.get("ICMPCode") or "Any Code"),
                }
            )
        elif st == "ICMPv6":
            out.append(
                {
                    "icmp_type": str(
                        d.get("ICMPType") or d.get("ICMPv6Type") or ""
                    ),
                    "icmp_code": str(d.get("ICMPCode") or d.get("ICMPv6Code") or ""),
                }
            )
    return out


def _submit_hs_xml_add(fw: SophosFirewall, root_tag: str, merged: dict[str, Any]) -> None:
    body = {k: v for k, v in merged.items() if not str(k).startswith("@") and k != "__gc_op"}
    clean = _prune_none_values(body)
    if not isinstance(clean, dict):
        clean = {}
    inner = xmltodict.unparse(
        {root_tag: clean}, pretty=True, full_document=False, encoding="utf-8"
    )
    if isinstance(inner, bytes):
        inner = inner.decode("utf-8")
    fw.submit_xml(inner.strip(), {}, set_operation="add")


def _process_hs_create_or_add(
    fw: SophosFirewall,
    db: Session,
    task: TaskQueue,
    merged: dict[str, Any],
    xml_tag: str,
) -> None:
    et = task.entity_type
    name = str(merged.get("Name") or task.external_name or "").strip()
    if et == "fqdn_host":
        fqdn = str(merged.get("FQDN") or name).strip()
        desc = merged.get("Description")
        desc_s = "" if desc is None else str(desc)
        FQDNHost(fw.client).create(
            name,
            fqdn,
            _fqdn_group_names_from_merged(merged),
            desc_s,
            False,
        )
        return
    if et == "service":
        st = str(merged.get("Type") or "")
        sl = _service_list_for_sophos_create(merged)
        if not sl and st == "TCPorUDP":
            sl = [{"src_port": "1:65535", "dst_port": "", "protocol": "tcp"}]
        Service(fw.client).create(name, st, sl, debug=False)
        return
    if et == "fqdn_hostgroup":
        hosts = _member_str_list(merged, "FQDNHostList", "FQDNHost")
        desc = merged.get("Description")
        desc_s = "" if desc is None else str(desc)
        FQDNHostGroup(fw.client).create(name, hosts, desc_s, debug=False)
        return
    if et == "service_group":
        svcs = _member_str_list(merged, "ServiceList", "Service")
        desc = merged.get("Description")
        desc_s = "" if desc is None else str(desc)
        ServiceGroup(fw.client).create(name, svcs, desc_s, debug=False)
        return
    if et == "ip_hostgroup":
        hosts = _member_str_list(merged, "HostList", "Host")
        desc = merged.get("Description")
        desc_s = "" if desc is None else str(desc)
        IPHostGroup(fw.client).create(name, hosts, desc_s, debug=False)
        return
    _submit_hs_xml_add(fw, xml_tag, merged)


def enqueue_hs_entity_update(
    db: Session,
    *,
    config_entry_id: int,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue | None:
    if form.get("__gc_op"):
        raise ValueError("Invalid form payload")
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type == ENTITY_IP_HOST:
        return enqueue_ip_host_update(
            db,
            config_entry_id=config_entry_id,
            form=form,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
    if entry.entity_type not in HS_TASK_ENTITY_TYPES:
        raise ValueError("Unsupported config entry type for hosts/services update")
    base = json.loads(entry.payload_json)
    if not isinstance(base, dict):
        raise ValueError("Invalid cached payload")
    merged = merge_hs_flyout_form(entry.entity_type, base, form)
    if _task_payload_matches_cache(entry, merged):
        return None
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=entry.entity_type,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps(merged, separators=(",", ":"), default=str),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_hs_entity_update_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
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
    tasks: list[TaskQueue] = []
    for cid in ids:
        t = enqueue_hs_entity_update(
            db,
            config_entry_id=cid,
            form=form,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
        if t is not None:
            tasks.append(t)
    return tasks


def enqueue_hs_config_delete(
    db: Session,
    *,
    config_entry_id: int,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type == ENTITY_IP_HOST:
        return enqueue_ip_host_delete(
            db,
            config_entry_id=config_entry_id,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
    if entry.entity_type not in HS_TASK_ENTITY_TYPES:
        raise ValueError("Unsupported entity type for delete")
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=entry.entity_type,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps({"__gc_op": "delete"}, separators=(",", ":")),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_hs_deletes_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
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
    tasks: list[TaskQueue] = []
    for cid in ids:
        tasks.append(
            enqueue_hs_config_delete(
                db,
                config_entry_id=cid,
                created_by_user_id=created_by_user_id,
                created_by_username=created_by_username,
            )
        )
    return tasks


def enqueue_network_entity_delete(
    db: Session,
    *,
    config_entry_id: int,
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> TaskQueue:
    entry = db.get(FirewallConfigEntry, config_entry_id)
    if entry is None:
        raise ValueError("Config entry not found")
    if entry.entity_type == ENTITY_INTERFACE:
        raise ValueError("Physical interfaces cannot be deleted from this table")
    if entry.entity_type not in NETWORK_ENTITY_DELETABLE_TYPES:
        raise ValueError("Unsupported entity type for delete")
    task = TaskQueue(
        firewall_id=entry.firewall_id,
        entity_type=entry.entity_type,
        external_name=entry.external_name,
        status="pending",
        error_message=None,
        payload_json=json.dumps({"__gc_op": "delete"}, separators=(",", ":")),
        created_by_user_id=created_by_user_id,
        created_by_username=created_by_username,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def enqueue_network_entity_deletes_batch(
    db: Session,
    *,
    config_entry_ids: list[int],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
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
    tasks: list[TaskQueue] = []
    for cid in ids:
        tasks.append(
            enqueue_network_entity_delete(
                db,
                config_entry_id=cid,
                created_by_user_id=created_by_user_id,
                created_by_username=created_by_username,
            )
        )
    return tasks


def enqueue_hs_entity_create_many(
    db: Session,
    *,
    firewall_ids: list[int],
    entity_type: str,
    form: dict[str, Any],
    created_by_user_id: str | None = None,
    created_by_username: str | None = None,
) -> list[TaskQueue]:
    if entity_type == ENTITY_IP_HOST:
        return enqueue_ip_host_create_many(
            db,
            firewall_ids=firewall_ids,
            form=form,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
    if entity_type not in HS_TASK_ENTITY_TYPES:
        raise ValueError("Unsupported entity type for create")
    seen: set[int] = set()
    fids: list[int] = []
    for raw in firewall_ids:
        try:
            n = int(raw)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        fids.append(n)
    if not fids:
        raise ValueError("Select at least one firewall")
    base: dict[str, Any] = {}
    merged = merge_hs_flyout_form(entity_type, base, form)
    name = str(merged.get("Name") or "").strip()
    if not name:
        raise ValueError("Name is required")
    payload = {**merged, "__gc_op": "add"}
    payload_json = json.dumps(payload, separators=(",", ":"), default=str)
    tasks: list[TaskQueue] = []
    for fid in fids:
        if db.get(Firewall, fid) is None:
            raise ValueError(f"Firewall not found: {fid}")
        cache_ent = (
            db.query(FirewallConfigEntry)
            .filter(
                FirewallConfigEntry.firewall_id == fid,
                FirewallConfigEntry.entity_type == entity_type,
                FirewallConfigEntry.external_name == name,
            )
            .one_or_none()
        )
        pending_cmp = {**merged, "__gc_op": "add"}
        if _task_payload_matches_cache(cache_ent, pending_cmp):
            continue
        t = TaskQueue(
            firewall_id=fid,
            entity_type=entity_type,
            external_name=name,
            status="pending",
            error_message=None,
            payload_json=payload_json,
            created_by_user_id=created_by_user_id,
            created_by_username=created_by_username,
        )
        db.add(t)
        tasks.append(t)
    db.commit()
    for t in tasks:
        db.refresh(t)
    return tasks


def _is_sophos_duplicate_entity_name_error(exc: BaseException) -> bool:
    """Sophos often returns 502 when Set add collides with an existing object name."""
    if not isinstance(exc, SophosFirewallAPIError):
        return False
    blob = str(exc).lower()
    for a in getattr(exc, "args", ()) or ():
        blob += " " + str(a).lower()
    if "502" not in blob:
        return False
    return "already exists" in blob or "same name" in blob


def _retry_task_queue_send_as_update(
    fw: SophosFirewall,
    task: TaskQueue,
    merged: dict[str, Any],
    update_params: dict[str, Any],
    lookup_name: str,
    xml_tag: str | None,
    lookup_xml_key: str,
    op: Any,
) -> bool:
    """
    After add failed with a duplicate-name style API error, attempt Set update once.
    Returns True only if an update was attempted and returned without raising.
    """
    if op == "delete" or not xml_tag:
        return False
    et = task.entity_type
    try:
        if et == ENTITY_IP_HOST:
            fw.update(
                "IPHost",
                update_params=update_params,
                name=lookup_name,
                lookup_key="Name",
            )
        elif et == ENTITY_IP_HOSTGROUP:
            fw.update(
                "IPHostGroup",
                update_params=update_params,
                name=lookup_name,
                lookup_key="Name",
            )
        elif et in HS_XML_TAG:
            fw.update(
                xml_tag,
                update_params=update_params,
                name=lookup_name,
                lookup_key="Name",
            )
        elif et == ENTITY_LAG:
            fw.update(
                xml_tag,
                update_params=update_params,
                name=lookup_name,
                lookup_key=lookup_xml_key,
            )
        elif et == ENTITY_BRIDGE_PAIR:
            fw.update(
                xml_tag,
                update_params=update_params,
                name=lookup_name,
                lookup_key=lookup_xml_key,
            )
        elif et == ENTITY_ALIAS:
            fw.update(
                xml_tag,
                update_params=update_params,
                name=lookup_name,
                lookup_key=lookup_xml_key,
            )
        elif et == ENTITY_ZONE:
            fw.update(
                xml_tag,
                update_params=update_params,
                name=lookup_name,
                lookup_key=lookup_xml_key,
            )
        elif et == ENTITY_IPS_POLICY:
            fw.update(
                "IPSPolicy",
                update_params=update_params,
                name=lookup_name,
                lookup_key="Name",
            )
        elif et == ENTITY_WEBFILTER_POLICY:
            fw.update(
                "WebFilterPolicy",
                update_params=update_params,
                name=lookup_name,
                lookup_key="Name",
            )
        elif et == ENTITY_IPS_CUSTOM_SIGNATURE:
            fw.update(
                "IPSCustomSignature",
                update_params=update_params,
                name=lookup_name,
                lookup_key="Name",
            )
        elif et == ENTITY_TRUSTED_MAC:
            u = trusted_mac_update_params_for_api(update_params, lookup_mac=lookup_name)
            fw.update(
                "TrustedMAC",
                update_params=u,
                name=lookup_name,
                lookup_key="MACAddress",
            )
        elif et == ENTITY_USER:
            fw.update(
                "User",
                update_params=update_params,
                name=str(merged.get("Username") or lookup_name or "").strip(),
                lookup_key="Username",
            )
        elif et == ENTITY_USER_GROUP:
            fw.update(
                "UserGroup",
                update_params=update_params,
                name=lookup_name,
                lookup_key="Name",
            )
        elif et == ENTITY_ADMIN_PROFILE:
            fw.update(
                "AdministrationProfile",
                update_params=update_params,
                name=lookup_name,
                lookup_key="Name",
            )
        elif et in PROFILE_ENTITY_XML and xml_tag:
            fw.update(
                xml_tag,
                update_params=update_params,
                name=lookup_name,
                lookup_key="Name",
            )
        elif et in GENERIC_SYNC_XML_ENTITY_TAGS and xml_tag:
            if et in GENERIC_SYNC_SINGLETON_ENTITY_TYPES:
                fw.update(xml_tag, update_params=update_params, name=None)
            else:
                fw.update(
                    xml_tag,
                    update_params=update_params,
                    name=lookup_name,
                    lookup_key=GENERIC_SYNC_LOOKUP_XML_KEYS.get(et, "Name"),
                )
        else:
            return False
    except Exception:
        return False
    return True


def process_task(
    db: Session,
    sdb: Session,
    task_id: int,
    *,
    completed_by_user_id: str | None = None,
    completed_by_username: str | None = None,
    defer_post_sync: bool = False,
) -> dict[str, Any]:
    """
    Send one task to the firewall. On success the row is moved to ``task_queue_completed``.
    On failure status becomes 'error' and error_message is set.
    If the row is already in ``error``, it is reset to ``pending`` with error_message cleared
    before the send is attempted again.
    """
    task = db.get(TaskQueue, task_id)
    if task is None:
        return {"ok": False, "error": "Task not found"}

    # Re-approval after a failed send: clear the error and put the row back in the
    # pre-send state, then continue with a normal submit attempt.
    if task.status == "error":
        task.error_message = None
        task.status = "pending"
        task.updated_at = _utc_now()
        db.commit()

    if task.configuration_id is not None:
        try:
            merged_cfg = json.loads(task.payload_json)
        except (json.JSONDecodeError, TypeError):
            merged_cfg = None
        if not isinstance(merged_cfg, dict):
            task.status = "error"
            task.error_message = "Invalid task payload."
            task.updated_at = _utc_now()
            db.commit()
            return {"ok": False, "error": task.error_message}
        if db.get(Configuration, task.configuration_id) is None:
            task.status = "error"
            task.error_message = "Configuration not found."
            task.updated_at = _utc_now()
            db.commit()
            return {"ok": False, "error": task.error_message}
        task.status = "sending"
        task.error_message = None
        task.updated_at = _utc_now()
        try:
            _apply_task_payload_to_configuration_cache(
                db, task, merged_cfg, commit=False
            )
        except Exception as exc:  # noqa: BLE001
            err = str(exc) or "Failed to apply configuration cache payload."
            _fail_task(db, task, err)
            return {"ok": False, "error": err}
        from app.ref_countries import (  # noqa: PLC0415
            is_all_countries_group_name,
            refresh_ref_countries_from_payload,
        )

        if str(task.entity_type) == "country_group":
            op_cg = str(merged_cfg.get("__gc_op") or "").strip()
            if op_cg != "delete":
                en_cg = str(merged_cfg.get("Name") or task.external_name or "").strip()
                if is_all_countries_group_name(en_cg):
                    refresh_ref_countries_from_payload(
                        db, _task_payload_for_local_cache(merged_cfg)
                    )
        done_cfg = TaskQueueCompleted(
            source_task_id=task.id,
            firewall_id=None,
            configuration_id=task.configuration_id,
            entity_type=task.entity_type,
            external_name=task.external_name,
            payload_json=task.payload_json,
            created_at=task.created_at,
            created_by_user_id=task.created_by_user_id,
            created_by_username=task.created_by_username,
            completed_at=_utc_now(),
            completed_by_user_id=completed_by_user_id,
            completed_by_username=completed_by_username,
        )
        db.add(done_cfg)
        db.delete(task)
        db.commit()
        return {"ok": True}

    if task.firewall_id is None:
        task.status = "error"
        task.error_message = "Task has no firewall or configuration target."
        task.updated_at = _utc_now()
        db.commit()
        return {"ok": False, "error": task.error_message}

    fw_row = db.get(Firewall, task.firewall_id)
    if not fw_row:
        task.status = "error"
        task.error_message = "Firewall not found."
        task.updated_at = _utc_now()
        db.commit()
        return {"ok": False, "error": task.error_message}

    if bool(fw_row.is_test):
        try:
            merged = json.loads(task.payload_json)
        except (json.JSONDecodeError, TypeError):
            merged = None
        if not isinstance(merged, dict):
            task.status = "error"
            task.error_message = "Invalid task payload."
            task.updated_at = _utc_now()
            db.commit()
            return {"ok": False, "error": task.error_message}
        task.status = "sending"
        task.error_message = None
        task.updated_at = _utc_now()
        try:
            _apply_task_payload_to_test_firewall_cache(
                db, task, merged, commit=False
            )
        except Exception as exc:
            err = str(exc) or "Failed to apply test-firewall payload."
            _fail_task(db, task, err)
            return {"ok": False, "error": err}
        done = TaskQueueCompleted(
            source_task_id=task.id,
            firewall_id=task.firewall_id,
            entity_type=task.entity_type,
            external_name=task.external_name,
            payload_json=task.payload_json,
            created_at=task.created_at,
            created_by_user_id=task.created_by_user_id,
            created_by_username=task.created_by_username,
            completed_at=_utc_now(),
            completed_by_user_id=completed_by_user_id,
            completed_by_username=completed_by_username,
        )
        db.add(done)
        db.delete(task)
        db.commit()
        return {"ok": True}

    enc = get_firewall_password_encrypted(sdb, task.firewall_id)
    if not enc:
        task.status = "error"
        task.error_message = "No stored credential for this firewall."
        task.updated_at = _utc_now()
        db.commit()
        return {"ok": False, "error": task.error_message}

    try:
        password = crypto.decrypt_secret(enc)
    except ValueError as exc:
        task.status = "error"
        task.error_message = str(exc)
        task.updated_at = _utc_now()
        db.commit()
        return {"ok": False, "error": task.error_message}

    merged = json.loads(task.payload_json)
    if not isinstance(merged, dict):
        task.status = "error"
        task.error_message = "Invalid task payload."
        task.updated_at = _utc_now()
        db.commit()
        return {"ok": False, "error": task.error_message}

    lookup_name = task.external_name
    update_params = {
        k: v
        for k, v in merged.items()
        if not str(k).startswith("@") and k != "__gc_op"
    }

    task.status = "sending"
    task.error_message = None
    task.updated_at = _utc_now()
    db.commit()

    fw = SophosFirewall(
        username=fw_row.username,
        password=password,
        hostname=fw_row.host,
        port=fw_row.port,
        verify=fw_row.verify_ssl,
    )
    patch_sophos_firewall_request_timeout(
        fw, normalize_firewall_api_timeout_seconds(fw_row.api_request_timeout_seconds)
    )
    xml_tag: str | None = None
    lookup_xml_key = "Name"
    if task.entity_type == ENTITY_INTERFACE or task.entity_type == ENTITY_VLAN:
        xml_tag = "Interface"
    elif task.entity_type == ENTITY_BRIDGE_PAIR:
        xml_tag = "BridgePair"
        lookup_xml_key = "Hardware"
    elif task.entity_type == ENTITY_LAG:
        xml_tag = "LAG"
        lookup_xml_key = "Hardware"
    elif task.entity_type == ENTITY_ALIAS:
        xml_tag = "Alias"
    elif task.entity_type == ENTITY_ZONE:
        xml_tag = "Zone"
    elif task.entity_type == ENTITY_IPS_SWITCH:
        xml_tag = "IPSSwitch"
    elif task.entity_type == ENTITY_DOS_SETTINGS:
        xml_tag = "DoSSettings"
    elif task.entity_type == ENTITY_SPOOF_PREVENTION:
        xml_tag = "SpoofPrevention"
    elif task.entity_type == ENTITY_IPS_POLICY:
        xml_tag = "IPSPolicy"
    elif task.entity_type == ENTITY_WEBFILTER_POLICY:
        xml_tag = "WebFilterPolicy"
    elif task.entity_type == ENTITY_IPS_CUSTOM_SIGNATURE:
        xml_tag = "IPSCustomSignature"
    elif task.entity_type == ENTITY_TRUSTED_MAC:
        xml_tag = "TrustedMAC"
        lookup_xml_key = "MACAddress"
    elif task.entity_type == ENTITY_IP_HOST:
        xml_tag = "IPHost"
    elif task.entity_type == ENTITY_IP_HOSTGROUP:
        xml_tag = "IPHostGroup"
    elif task.entity_type == ENTITY_USER:
        xml_tag = "User"
        lookup_xml_key = "Username"
    elif task.entity_type == ENTITY_USER_GROUP:
        xml_tag = "UserGroup"
    elif task.entity_type == ENTITY_ADMIN_PROFILE:
        xml_tag = "AdministrationProfile"
    elif task.entity_type in PROFILE_ENTITY_XML:
        xml_tag = PROFILE_ENTITY_XML[task.entity_type]
    elif task.entity_type in GENERIC_SYNC_XML_ENTITY_TAGS:
        xml_tag = GENERIC_SYNC_XML_ENTITY_TAGS[task.entity_type]
        lookup_xml_key = GENERIC_SYNC_LOOKUP_XML_KEYS.get(task.entity_type, "Name")
    elif task.entity_type in HS_XML_TAG:
        xml_tag = HS_XML_TAG[task.entity_type]
    else:
        task.status = "error"
        task.error_message = f"Unsupported entity type for send: {task.entity_type}"
        task.updated_at = _utc_now()
        db.commit()
        return {"ok": False, "error": task.error_message}

    op = merged.get("__gc_op")

    try:
        if op == "delete" and xml_tag:
            rem_name = lookup_name
            if task.entity_type == ENTITY_USER:
                rem_name = str(merged.get("__gc_username") or lookup_name or "").strip()
            elif task.entity_type == ENTITY_USER_GROUP:
                rem_name = str(merged.get("__gc_group_name") or lookup_name or "").strip()
            elif task.entity_type == ENTITY_ADMIN_PROFILE:
                rem_name = str(merged.get("__gc_profile_name") or lookup_name or "").strip()
            if not rem_name:
                raise ValueError("Missing name for remove operation.")
            fw.remove(xml_tag, rem_name, key=lookup_xml_key)
        elif task.entity_type == ENTITY_IP_HOST and not _firewall_has_ip_host_cache_entry(
            db, firewall_id=task.firewall_id, external_name=lookup_name
        ):
            _submit_ip_host_add(fw, update_params)
        elif task.entity_type == ENTITY_IP_HOST:
            fw.update(
                xml_tag,
                update_params=update_params,
                name=lookup_name,
                lookup_key="Name",
            )
        elif task.entity_type == ENTITY_IP_HOSTGROUP and not _firewall_has_ip_hostgroup_cache_entry(
            db, firewall_id=task.firewall_id, external_name=lookup_name
        ):
            _submit_ip_hostgroup_add(fw, merged, lookup_name)
        elif task.entity_type == ENTITY_IP_HOSTGROUP:
            fw.update(
                xml_tag,
                update_params=update_params,
                name=lookup_name,
                lookup_key="Name",
            )
        elif task.entity_type in HS_XML_TAG:
            has_row = _firewall_has_hs_cache_entry(
                db,
                firewall_id=task.firewall_id,
                entity_type=task.entity_type,
                external_name=lookup_name,
            )
            if op == "add" or not has_row:
                _process_hs_create_or_add(fw, db, task, merged, xml_tag)
            else:
                fw.update(
                    xml_tag,
                    update_params=update_params,
                    name=lookup_name,
                    lookup_key="Name",
                )
        elif task.entity_type == ENTITY_LAG and not _firewall_has_lag_cache_entry(
            db, firewall_id=task.firewall_id, external_name=lookup_name
        ):
            _submit_lag_add(fw, merged)
        elif task.entity_type == ENTITY_LAG:
            fw.update(
                xml_tag,
                update_params=update_params,
                name=lookup_name,
                lookup_key=lookup_xml_key,
            )
        elif task.entity_type == ENTITY_BRIDGE_PAIR and not _firewall_has_bridge_pair_cache_entry(
            db, firewall_id=task.firewall_id, external_name=lookup_name
        ):
            _submit_bridge_pair_add(fw, merged)
        elif task.entity_type == ENTITY_BRIDGE_PAIR:
            fw.update(
                xml_tag,
                update_params=update_params,
                name=lookup_name,
                lookup_key=lookup_xml_key,
            )
        elif task.entity_type == ENTITY_ALIAS and not _firewall_has_alias_cache_entry(
            db, firewall_id=task.firewall_id, external_name=lookup_name
        ):
            _submit_alias_add(fw, merged)
        elif task.entity_type == ENTITY_ALIAS:
            fw.update(
                xml_tag,
                update_params=update_params,
                name=lookup_name,
                lookup_key=lookup_xml_key,
            )
        elif task.entity_type == ENTITY_ZONE and not _firewall_has_zone_cache_entry(
            db, firewall_id=task.firewall_id, external_name=lookup_name
        ):
            _submit_zone_add(fw, merged)
        elif task.entity_type == ENTITY_ZONE:
            fw.update(
                xml_tag,
                update_params=update_params,
                name=lookup_name,
                lookup_key=lookup_xml_key,
            )
        elif task.entity_type == ENTITY_IPS_POLICY:
            if op == "add" or not _firewall_has_ips_policy_cache_entry(
                db, firewall_id=task.firewall_id, external_name=lookup_name
            ):
                _submit_ips_policy_add(fw, merged)
            else:
                fw.update(
                    "IPSPolicy",
                    update_params=update_params,
                    name=lookup_name,
                    lookup_key="Name",
                )
        elif task.entity_type == ENTITY_WEBFILTER_POLICY:
            if op == "add" or not _firewall_has_webfilter_policy_cache_entry(
                db, firewall_id=task.firewall_id, external_name=lookup_name
            ):
                _submit_webfilter_policy_add(fw, merged)
            else:
                fw.update(
                    "WebFilterPolicy",
                    update_params=update_params,
                    name=lookup_name,
                    lookup_key="Name",
                )
        elif task.entity_type == ENTITY_IPS_CUSTOM_SIGNATURE:
            if op == "add" or not _firewall_has_ips_custom_signature_cache_entry(
                db, firewall_id=task.firewall_id, external_name=lookup_name
            ):
                _submit_ips_custom_signature_add(fw, merged)
            else:
                fw.update(
                    "IPSCustomSignature",
                    update_params=update_params,
                    name=lookup_name,
                    lookup_key="Name",
                )
        elif task.entity_type == ENTITY_TRUSTED_MAC:
            if op == "add" or not _firewall_has_trusted_mac_cache_entry(
                db, firewall_id=task.firewall_id, external_name=lookup_name
            ):
                _submit_trusted_mac_add(fw, merged)
            else:
                u = trusted_mac_update_params_for_api(update_params, lookup_mac=lookup_name)
                fw.update(
                    "TrustedMAC",
                    update_params=u,
                    name=lookup_name,
                    lookup_key="MACAddress",
                )
        elif task.entity_type == ENTITY_USER:
            uname = str(merged.get("Username") or lookup_name or "").strip()
            if op == "add" or not firewall_has_user_cache_row(
                db, firewall_id=task.firewall_id, external_name=uname
            ):
                submit_user_create(fw, merged)
            else:
                submit_user_update(fw, merged, lookup_name)
        elif task.entity_type == ENTITY_USER_GROUP:
            gname = user_group_name_from_merged(merged, lookup_name)
            if op == "add" or not firewall_has_user_group_cache_row(
                db, firewall_id=task.firewall_id, external_name=gname
            ):
                submit_user_group_add(fw, merged)
            else:
                submit_user_group_update(fw, merged, gname)
        elif task.entity_type == ENTITY_ADMIN_PROFILE:
            pname = str(merged.get("Name") or lookup_name or "").strip()
            if op == "add" or not firewall_has_admin_profile_cache_row(
                db, firewall_id=task.firewall_id, external_name=pname
            ):
                submit_admin_profile_create(fw, merged)
            else:
                submit_admin_profile_update(fw, merged, pname)
        elif task.entity_type in PROFILE_ENTITY_XML and xml_tag:
            if op == "add" or not _firewall_has_profile_entity_cache_row(
                db,
                entity_type=task.entity_type,
                firewall_id=task.firewall_id,
                external_name=lookup_name,
            ):
                _submit_profile_entity_add(fw, xml_tag, update_params)
            else:
                fw.update(
                    xml_tag,
                    update_params=update_params,
                    name=lookup_name,
                    lookup_key="Name",
                )
        elif task.entity_type in GENERIC_SYNC_XML_ENTITY_TAGS and xml_tag:
            has_row = _firewall_has_hs_cache_entry(
                db,
                firewall_id=task.firewall_id,
                entity_type=task.entity_type,
                external_name=lookup_name,
            )
            if task.entity_type in GENERIC_SYNC_SINGLETON_ENTITY_TYPES:
                fw.update(xml_tag, update_params=update_params, name=None)
            elif op == "add" or not has_row:
                _submit_generic_xml_add(fw, xml_tag, update_params)
            else:
                fw.update(
                    xml_tag,
                    update_params=update_params,
                    name=lookup_name,
                    lookup_key=lookup_xml_key,
                )
        elif task.entity_type == ENTITY_INTERFACE or task.entity_type == ENTITY_VLAN:
            fw.update(
                xml_tag,
                update_params=update_params,
                name=lookup_name,
                lookup_key=lookup_xml_key,
            )
        elif task.entity_type == ENTITY_IPS_SWITCH:
            st = str(
                update_params.get("Status") or merged.get("Status") or ""
            ).strip()
            if st not in ("Enable", "Disable"):
                raise ValueError("IPS switch Status must be Enable or Disable")
            fw.update("IPSSwitch", {"Status": st}, name=None)
        elif task.entity_type == ENTITY_DOS_SETTINGS:
            fw.update("DoSSettings", update_params, name=None)
        elif task.entity_type == ENTITY_SPOOF_PREVENTION:
            fw.update("SpoofPrevention", update_params, name=None)
        else:
            task.status = "error"
            task.error_message = f"Unsupported entity type for send: {task.entity_type}"
            task.updated_at = _utc_now()
            db.commit()
            return {"ok": False, "error": task.error_message}
    except SophosFirewallAuthFailure as exc:
        err = f"Authentication failed: {exc}"
        _fail_task(db, task, err)
        return {"ok": False, "error": err}
    except SophosFirewallZeroRecords as exc:
        err = str(exc)
        _fail_task(db, task, err)
        return {"ok": False, "error": err}
    except SophosFirewallAPIError as exc:
        if _is_sophos_duplicate_entity_name_error(exc) and _retry_task_queue_send_as_update(
            fw,
            task,
            merged,
            update_params,
            lookup_name,
            xml_tag,
            lookup_xml_key,
            op,
        ):
            pass
        else:
            err = str(exc)
            _fail_task(db, task, err)
            return {"ok": False, "error": err}
    except requests.exceptions.SSLError as exc:
        err = f"SSL error: {exc}"
        _fail_task(db, task, err)
        return {"ok": False, "error": err}
    except requests.exceptions.ConnectTimeout:
        err = "Connection timed out."
        _fail_task(db, task, err)
        return {"ok": False, "error": err}
    except requests.exceptions.ConnectionError as exc:
        err = f"Could not connect: {exc}"
        _fail_task(db, task, err)
        return {"ok": False, "error": err}
    except OSError as exc:
        err = str(exc)
        _fail_task(db, task, err)
        return {"ok": False, "error": err}
    except Exception as exc:
        err = str(exc)
        _fail_task(db, task, err)
        return {"ok": False, "error": err}

    t2 = db.get(TaskQueue, task_id)
    post_fw: int | None = None
    post_entities: list[str] = []
    if t2:
        post_fw = int(t2.firewall_id)
        post_entities = sync_catalog_ids_for_task_entity(t2.entity_type)
        done = TaskQueueCompleted(
            source_task_id=t2.id,
            firewall_id=t2.firewall_id,
            entity_type=t2.entity_type,
            external_name=t2.external_name,
            payload_json=t2.payload_json,
            created_at=t2.created_at,
            created_by_user_id=t2.created_by_user_id,
            created_by_username=t2.created_by_username,
            completed_at=_utc_now(),
            completed_by_user_id=completed_by_user_id,
            completed_by_username=completed_by_username,
        )
        db.add(done)
        db.delete(t2)
        db.commit()
    out: dict[str, Any] = {"ok": True}
    if defer_post_sync:
        if post_fw is not None and post_entities:
            out["deferred_sync"] = {
                "firewall_id": post_fw,
                "entity_ids": post_entities,
            }
        return out
    if post_fw is not None and post_entities:
        out["post_sync"] = run_firewall_config_sync(
            db,
            sdb,
            post_fw,
            entities=post_entities,
            entities_explicit=True,
        )
    return out


def _fail_task(db: Session, task: TaskQueue, message: str) -> None:
    t = db.get(TaskQueue, task.id)
    if t:
        t.status = "error"
        t.error_message = message
        t.updated_at = _utc_now()
        db.commit()


def _task_record_action_for_list(db: Session, task: TaskQueue) -> str:
    """Return ``add``, ``edit``, or ``delete`` — aligned with ``send_task_queue`` routing."""
    try:
        merged = json.loads(task.payload_json)
    except (json.JSONDecodeError, TypeError):
        return "edit"
    if not isinstance(merged, dict):
        return "edit"
    op = merged.get("__gc_op")
    if op == "delete":
        return "delete"
    if op == "add":
        return "add"

    fw_id = task.firewall_id
    ext = task.external_name
    et = task.entity_type

    if et == ENTITY_IP_HOST:
        return (
            "add"
            if not _firewall_has_ip_host_cache_entry(
                db, firewall_id=fw_id, external_name=ext
            )
            else "edit"
        )
    if et == ENTITY_IP_HOSTGROUP:
        return (
            "add"
            if not _firewall_has_ip_hostgroup_cache_entry(
                db, firewall_id=fw_id, external_name=ext
            )
            else "edit"
        )
    if et == ENTITY_LAG:
        return (
            "add"
            if not _firewall_has_lag_cache_entry(
                db, firewall_id=fw_id, external_name=ext
            )
            else "edit"
        )
    if et == ENTITY_BRIDGE_PAIR:
        return (
            "add"
            if not _firewall_has_bridge_pair_cache_entry(
                db, firewall_id=fw_id, external_name=ext
            )
            else "edit"
        )
    if et == ENTITY_ALIAS:
        return (
            "add"
            if not _firewall_has_alias_cache_entry(
                db, firewall_id=fw_id, external_name=ext
            )
            else "edit"
        )
    if et == ENTITY_ZONE:
        return (
            "add"
            if not _firewall_has_zone_cache_entry(
                db, firewall_id=fw_id, external_name=ext
            )
            else "edit"
        )
    if et == ENTITY_INTERFACE or et == ENTITY_VLAN:
        return "edit"
    if et == ENTITY_IPS_POLICY:
        return (
            "add"
            if not _firewall_has_ips_policy_cache_entry(
                db, firewall_id=fw_id, external_name=ext
            )
            else "edit"
        )
    if et == ENTITY_WEBFILTER_POLICY:
        return (
            "add"
            if not _firewall_has_webfilter_policy_cache_entry(
                db, firewall_id=fw_id, external_name=ext
            )
            else "edit"
        )
    if et == ENTITY_IPS_CUSTOM_SIGNATURE:
        return (
            "add"
            if not _firewall_has_ips_custom_signature_cache_entry(
                db, firewall_id=fw_id, external_name=ext
            )
            else "edit"
        )
    if et == ENTITY_TRUSTED_MAC:
        return (
            "add"
            if not _firewall_has_trusted_mac_cache_entry(
                db, firewall_id=fw_id, external_name=ext
            )
            else "edit"
        )
    if et == ENTITY_IPS_SWITCH:
        return "edit"
    if et == ENTITY_DOS_SETTINGS or et == ENTITY_SPOOF_PREVENTION:
        return "edit"
    if et in HS_XML_TAG:
        has_row = _firewall_has_hs_cache_entry(
            db, firewall_id=fw_id, entity_type=et, external_name=ext
        )
        return "add" if not has_row else "edit"
    if et in PROFILE_ENTITY_XML:
        return (
            "add"
            if not _firewall_has_profile_entity_cache_row(
                db, entity_type=et, firewall_id=fw_id, external_name=ext
            )
            else "edit"
        )
    return "edit"


_TASK_QUEUE_ENTITY_TYPES_ALWAYS_EDIT = frozenset(
    {
        ENTITY_INTERFACE,
        ENTITY_VLAN,
        ENTITY_IPS_SWITCH,
        ENTITY_DOS_SETTINGS,
        ENTITY_SPOOF_PREVENTION,
        *GENERIC_SYNC_SINGLETON_ENTITY_TYPES,
    }
)

_TASK_QUEUE_ENTITY_TYPES_CACHE_LOOKUP = frozenset(
    {
        ENTITY_IP_HOST,
        ENTITY_IP_HOSTGROUP,
        ENTITY_LAG,
        ENTITY_BRIDGE_PAIR,
        ENTITY_ALIAS,
        ENTITY_ZONE,
        ENTITY_IPS_POLICY,
        ENTITY_WEBFILTER_POLICY,
        ENTITY_IPS_CUSTOM_SIGNATURE,
        ENTITY_TRUSTED_MAC,
        *GENERIC_SYNC_XML_ENTITY_TAGS.keys(),
        *HS_XML_TAG.keys(),
        *PROFILE_ENTITY_XML.keys(),
    }
)


def _task_record_actions_for_rows(
    db: Session, tasks: list[TaskQueue]
) -> dict[int, str]:
    """
    Resolve ``record_action`` for many rows without N+1 cache lookups.
    """
    by_task_id: dict[int, str] = {}
    pending_fw: dict[str, set[tuple[int, str]]] = defaultdict(set)
    pending_cfg: dict[str, set[tuple[int, str]]] = defaultdict(set)

    for t in tasks:
        action = "edit"
        try:
            merged = json.loads(t.payload_json)
        except (json.JSONDecodeError, TypeError):
            merged = None

        if isinstance(merged, dict):
            op = merged.get("__gc_op")
            if op == "delete":
                action = "delete"
            elif op == "add":
                action = "add"

        if action == "edit":
            et = t.entity_type
            if et in _TASK_QUEUE_ENTITY_TYPES_ALWAYS_EDIT:
                action = "edit"
            elif et in _TASK_QUEUE_ENTITY_TYPES_CACHE_LOOKUP:
                if t.firewall_id is not None:
                    pending_fw[et].add((int(t.firewall_id), str(t.external_name)))
                elif t.configuration_id is not None:
                    pending_cfg[et].add((int(t.configuration_id), str(t.external_name)))
            else:
                action = "edit"

        by_task_id[t.id] = action

    for et, wanted in pending_fw.items():
        if not wanted:
            continue
        firewall_ids = sorted({fw_id for fw_id, _ in wanted})
        external_names = sorted({name for _, name in wanted})
        existing_rows = (
            db.query(FirewallConfigEntry.firewall_id, FirewallConfigEntry.external_name)
            .filter(
                FirewallConfigEntry.entity_type == et,
                FirewallConfigEntry.firewall_id.in_(firewall_ids),
                FirewallConfigEntry.external_name.in_(external_names),
            )
            .all()
        )
        existing = {(int(fw_id), str(ext_name)) for fw_id, ext_name in existing_rows}
        for t in tasks:
            if t.entity_type != et or t.firewall_id is None:
                continue
            key = (int(t.firewall_id), str(t.external_name))
            by_task_id[t.id] = "edit" if key in existing else "add"

    for et, wanted in pending_cfg.items():
        if not wanted:
            continue
        configuration_ids = sorted({cid for cid, _ in wanted})
        external_names = sorted({name for _, name in wanted})
        existing_rows = (
            db.query(
                ConfigurationConfigEntry.configuration_id,
                ConfigurationConfigEntry.external_name,
            )
            .filter(
                ConfigurationConfigEntry.entity_type == et,
                ConfigurationConfigEntry.configuration_id.in_(configuration_ids),
                ConfigurationConfigEntry.external_name.in_(external_names),
            )
            .all()
        )
        existing = {(int(cid), str(ext_name)) for cid, ext_name in existing_rows}
        for t in tasks:
            if t.entity_type != et or t.configuration_id is None:
                continue
            key = (int(t.configuration_id), str(t.external_name))
            by_task_id[t.id] = "edit" if key in existing else "add"

    return by_task_id


def _serialize_task_rows_from_tasks(db: Session, tasks: list[TaskQueue]) -> list[dict[str, Any]]:
    actions = _task_record_actions_for_rows(db, tasks)
    wanted_fw: dict[str, set[tuple[int, str]]] = defaultdict(set)
    wanted_cfg: dict[str, set[tuple[int, str]]] = defaultdict(set)
    for t in tasks:
        et = str(t.entity_type)
        if t.firewall_id is not None:
            wanted_fw[et].add((int(t.firewall_id), str(t.external_name)))
        elif t.configuration_id is not None:
            wanted_cfg[et].add((int(t.configuration_id), str(t.external_name)))
    stored_payloads_fw: dict[tuple[int, str, str], str] = {}
    for et, wanted in wanted_fw.items():
        if not wanted:
            continue
        firewall_ids = sorted({fw_id for fw_id, _ in wanted})
        external_names = sorted({name for _, name in wanted})
        existing_rows = (
            db.query(
                FirewallConfigEntry.firewall_id,
                FirewallConfigEntry.external_name,
                FirewallConfigEntry.payload_json,
            )
            .filter(
                FirewallConfigEntry.entity_type == et,
                FirewallConfigEntry.firewall_id.in_(firewall_ids),
                FirewallConfigEntry.external_name.in_(external_names),
            )
            .all()
        )
        for fw_id, ext_name, payload_json in existing_rows:
            stored_payloads_fw[(int(fw_id), et, str(ext_name))] = payload_json or ""
    stored_payloads_cfg: dict[tuple[int, str, str], str] = {}
    for et, wanted in wanted_cfg.items():
        if not wanted:
            continue
        configuration_ids = sorted({cid for cid, _ in wanted})
        external_names = sorted({name for _, name in wanted})
        existing_rows = (
            db.query(
                ConfigurationConfigEntry.configuration_id,
                ConfigurationConfigEntry.external_name,
                ConfigurationConfigEntry.payload_json,
            )
            .filter(
                ConfigurationConfigEntry.entity_type == et,
                ConfigurationConfigEntry.configuration_id.in_(configuration_ids),
                ConfigurationConfigEntry.external_name.in_(external_names),
            )
            .all()
        )
        for cid, ext_name, payload_json in existing_rows:
            stored_payloads_cfg[(int(cid), et, str(ext_name))] = payload_json or ""

    fw_ids = sorted({int(t.firewall_id) for t in tasks if t.firewall_id is not None})
    cfg_ids = sorted({int(t.configuration_id) for t in tasks if t.configuration_id is not None})
    fw_by_id: dict[int, Firewall] = {}
    if fw_ids:
        for fw in db.query(Firewall).filter(Firewall.id.in_(fw_ids)).all():
            fw_by_id[int(fw.id)] = fw
    cfg_by_id: dict[int, Configuration] = {}
    if cfg_ids:
        for cfg in db.query(Configuration).filter(Configuration.id.in_(cfg_ids)).all():
            cfg_by_id[int(cfg.id)] = cfg

    out: list[dict[str, Any]] = []
    for t in tasks:
        et = str(t.entity_type)
        name = str(t.external_name)
        if t.firewall_id is not None:
            fw = fw_by_id.get(int(t.firewall_id))
            label = (
                (fw.name or fw.host or str(fw.id)) if fw else f"Firewall #{t.firewall_id}"
            )
            stored = stored_payloads_fw.get((int(t.firewall_id), et, name), "")
        elif t.configuration_id is not None:
            cfg = cfg_by_id.get(int(t.configuration_id))
            label = (cfg.name or str(cfg.id)) if cfg else f"Configuration #{t.configuration_id}"
            stored = stored_payloads_cfg.get((int(t.configuration_id), et, name), "")
        else:
            label = ""
            stored = ""
        out.append(
            {
                "id": t.id,
                "firewall_id": t.firewall_id,
                "configuration_id": t.configuration_id,
                "firewall_label": label,
                "entity_type": et,
                "external_name": name,
                "record_action": actions.get(t.id, "edit"),
                "status": t.status,
                "error_message": t.error_message or "",
                "created_by_username": t.created_by_username or "",
                "created_at": t.created_at.isoformat() if t.created_at else "",
                "stored_payload_json": stored,
                "pending_payload_json": t.payload_json or "",
            }
        )
    return out


def list_tasks_with_firewall(
    db: Session, firewall_ids: list[int] | None = None
) -> list[dict[str, Any]]:
    q = db.query(TaskQueue).order_by(TaskQueue.created_at.desc())
    if firewall_ids is not None:
        if not firewall_ids:
            return []
        q = q.filter(TaskQueue.firewall_id.in_(firewall_ids))
    rows = q.all()
    return _serialize_task_rows_from_tasks(db, rows)


def list_tasks_with_firewall_page(
    db: Session,
    *,
    firewall_ids: list[int] | None = None,
    limit: int = 200,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], bool]:
    """
    Paged queue rows for lazy-loading clients.

    Returns a tuple of ``(rows, has_more)`` ordered newest-first.
    """
    if limit < 1:
        limit = 1
    if offset < 0:
        offset = 0

    q = db.query(TaskQueue).order_by(TaskQueue.created_at.desc())
    if firewall_ids is not None:
        if not firewall_ids:
            return [], False
        q = q.filter(TaskQueue.firewall_id.in_(firewall_ids))
    rows = q.offset(offset).limit(limit + 1).all()
    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]
    return _serialize_task_rows_from_tasks(db, rows), has_more


def task_queue_history_summary_counts(
    db: Session, firewall_ids: list[int], *, days: int = 7
) -> dict[str, int]:
    """
    Totals for dashboard stat cards from **Task queue history** (``task_queue_completed``),
    scoped to ``firewall_ids``. Same join and rules as ``list_completed_tasks_with_firewall``:

    * **approved** — outcome is not ``TASK_QUEUE_OUTCOME_REMOVED`` (sent to firewall).
    * **denied** — ``TASK_QUEUE_OUTCOME_REMOVED`` (removed without send; “Rejected” in History UI).

    Rolling window uses UTC calendar days ending today; “today” is the current UTC date.
    """
    empty = {
        "approved_7d": 0,
        "denied_7d": 0,
        "approved_today": 0,
        "denied_today": 0,
    }
    if not firewall_ids or days < 1:
        return dict(empty)

    def _naive_utc(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt
        return dt.astimezone(timezone.utc).replace(tzinfo=None)

    now = datetime.now(timezone.utc)
    anchor = now.replace(hour=0, minute=0, second=0, microsecond=0)
    window_start = anchor - timedelta(days=days - 1)
    window_end = anchor + timedelta(days=1)
    ws = _naive_utc(window_start)
    we = _naive_utc(window_end)
    today_start = _naive_utc(anchor)
    today_end = _naive_utc(anchor + timedelta(days=1))

    rows = (
        db.query(TaskQueueCompleted.completed_at, TaskQueueCompleted.outcome)
        .join(Firewall, Firewall.id == TaskQueueCompleted.firewall_id)
        .filter(
            TaskQueueCompleted.firewall_id.in_(firewall_ids),
            TaskQueueCompleted.completed_at >= ws,
            TaskQueueCompleted.completed_at < we,
        )
        .all()
    )
    approved_7d = denied_7d = approved_today = denied_today = 0
    for completed_at, outcome in rows:
        if completed_at is None:
            continue
        na = _naive_utc(completed_at)
        is_denied = (outcome or "").strip() == TASK_QUEUE_OUTCOME_REMOVED
        if is_denied:
            denied_7d += 1
        else:
            approved_7d += 1
        if today_start <= na < today_end:
            if is_denied:
                denied_today += 1
            else:
                approved_today += 1

    return {
        "approved_7d": approved_7d,
        "denied_7d": denied_7d,
        "approved_today": approved_today,
        "denied_today": denied_today,
    }


def _serialize_completed_rows_with_firewall(
    db: Session, rows: list[TaskQueueCompleted]
) -> list[dict[str, Any]]:
    """Serialize ``task_queue_completed`` rows for the History UI table."""
    wanted_fw: dict[str, set[tuple[int, str]]] = defaultdict(set)
    wanted_cfg: dict[str, set[tuple[int, str]]] = defaultdict(set)
    for row in rows:
        et = str(row.entity_type)
        if row.firewall_id is not None:
            wanted_fw[et].add((int(row.firewall_id), str(row.external_name)))
        elif row.configuration_id is not None:
            wanted_cfg[et].add((int(row.configuration_id), str(row.external_name)))
    stored_fw: dict[tuple[int, str, str], str] = {}
    for et, wanted in wanted_fw.items():
        if not wanted:
            continue
        firewall_ids = sorted({fw_id for fw_id, _ in wanted})
        external_names = sorted({name for _, name in wanted})
        existing_rows = (
            db.query(
                FirewallConfigEntry.firewall_id,
                FirewallConfigEntry.external_name,
                FirewallConfigEntry.payload_json,
            )
            .filter(
                FirewallConfigEntry.entity_type == et,
                FirewallConfigEntry.firewall_id.in_(firewall_ids),
                FirewallConfigEntry.external_name.in_(external_names),
            )
            .all()
        )
        for fw_id, ext_name, payload_json in existing_rows:
            stored_fw[(int(fw_id), et, str(ext_name))] = payload_json or ""
    stored_cfg: dict[tuple[int, str, str], str] = {}
    for et, wanted in wanted_cfg.items():
        if not wanted:
            continue
        configuration_ids = sorted({cid for cid, _ in wanted})
        external_names = sorted({name for _, name in wanted})
        existing_rows = (
            db.query(
                ConfigurationConfigEntry.configuration_id,
                ConfigurationConfigEntry.external_name,
                ConfigurationConfigEntry.payload_json,
            )
            .filter(
                ConfigurationConfigEntry.entity_type == et,
                ConfigurationConfigEntry.configuration_id.in_(configuration_ids),
                ConfigurationConfigEntry.external_name.in_(external_names),
            )
            .all()
        )
        for cid, ext_name, payload_json in existing_rows:
            stored_cfg[(int(cid), et, str(ext_name))] = payload_json or ""

    fw_ids = sorted({int(r.firewall_id) for r in rows if r.firewall_id is not None})
    cfg_ids = sorted({int(r.configuration_id) for r in rows if r.configuration_id is not None})
    fw_by_id: dict[int, Firewall] = {}
    if fw_ids:
        for fw in db.query(Firewall).filter(Firewall.id.in_(fw_ids)).all():
            fw_by_id[int(fw.id)] = fw
    cfg_by_id: dict[int, Configuration] = {}
    if cfg_ids:
        for cfg in db.query(Configuration).filter(Configuration.id.in_(cfg_ids)).all():
            cfg_by_id[int(cfg.id)] = cfg

    out: list[dict[str, Any]] = []
    for row in rows:
        fw_online: bool | None = None
        if row.firewall_id is not None:
            fw = fw_by_id.get(int(row.firewall_id))
            fl = (
                (fw.name or fw.host or str(fw.id)) if fw else f"Firewall #{row.firewall_id}"
            )
            fw_online = firewall_is_online(fw) if fw is not None else None
            et = str(row.entity_type)
            name = str(row.external_name)
            stored_payload_json = stored_fw.get((int(row.firewall_id), et, name), "")
        elif row.configuration_id is not None:
            cfg = cfg_by_id.get(int(row.configuration_id))
            fl = (
                (cfg.name or str(cfg.id)) if cfg else f"Configuration #{row.configuration_id}"
            )
            et = str(row.entity_type)
            name = str(row.external_name)
            stored_payload_json = stored_cfg.get((int(row.configuration_id), et, name), "")
        else:
            fl = ""
            et = str(row.entity_type)
            name = str(row.external_name)
            stored_payload_json = ""
        c_at = row.created_at.isoformat() if row.created_at else ""
        d_at = row.completed_at.isoformat() if row.completed_at else ""
        quser = row.created_by_username or ""
        suser = row.completed_by_username or ""
        oc = row.outcome
        pending_payload_json = row.payload_json or ""
        outcome_label = (
            "Rejected"
            if oc == TASK_QUEUE_OUTCOME_REMOVED
            else "Approved"
        )
        out.append(
            {
                "id": row.id,
                "source_task_id": row.source_task_id,
                "firewall_id": row.firewall_id,
                "configuration_id": row.configuration_id,
                "firewall_label": fl,
                "firewall_online": fw_online,
                "entity_type": et,
                "external_name": name,
                "created_by_username": quser,
                "completed_by_username": suser,
                "created_at": c_at,
                "completed_at": d_at,
                "outcome": oc,
                "outcome_label": outcome_label,
                "stored_payload_json": stored_payload_json,
                "pending_payload_json": pending_payload_json,
                "search_blob": " ".join(
                    str(x).lower()
                    for x in [
                        row.id,
                        row.source_task_id,
                        fl,
                        row.entity_type,
                        row.external_name,
                        quser,
                        suser,
                        c_at,
                        d_at,
                        outcome_label,
                        stored_payload_json,
                        pending_payload_json,
                    ]
                    if x is not None
                ),
            }
        )
    return out


def list_completed_tasks_with_firewall(
    db: Session, limit: int = 5000
) -> list[dict[str, Any]]:
    """Rows for Firewalls · History · Task queue history (see also ``task_queue_history_summary_counts``)."""
    rows = (
        db.query(TaskQueueCompleted)
        .order_by(TaskQueueCompleted.completed_at.desc())
        .limit(limit)
        .all()
    )
    return _serialize_completed_rows_with_firewall(db, rows)


def list_completed_tasks_with_firewall_page(
    db: Session,
    *,
    limit: int = 200,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], bool]:
    """
    Paged completed queue rows for History lazy-loading clients.

    Returns a tuple of ``(rows, has_more)`` ordered newest-first.
    """
    if limit < 1:
        limit = 1
    if offset < 0:
        offset = 0
    rows = (
        db.query(TaskQueueCompleted)
        .order_by(TaskQueueCompleted.completed_at.desc())
        .offset(offset)
        .limit(limit + 1)
        .all()
    )
    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]
    return _serialize_completed_rows_with_firewall(db, rows), has_more


def delete_tasks(
    db: Session,
    task_ids: list[int],
    *,
    removed_by_user_id: str | None = None,
    removed_by_username: str | None = None,
) -> int:
    if not task_ids:
        return 0
    ids = list(dict.fromkeys(int(i) for i in task_ids if int(i) > 0))
    if not ids:
        return 0
    tasks = db.query(TaskQueue).filter(TaskQueue.id.in_(ids)).all()
    if not tasks:
        return 0
    now = _utc_now()
    for t in tasks:
        done = TaskQueueCompleted(
            source_task_id=t.id,
            firewall_id=t.firewall_id,
            configuration_id=t.configuration_id,
            entity_type=t.entity_type,
            external_name=t.external_name,
            payload_json=t.payload_json,
            created_at=t.created_at,
            created_by_user_id=t.created_by_user_id,
            created_by_username=t.created_by_username,
            completed_at=now,
            completed_by_user_id=removed_by_user_id,
            completed_by_username=removed_by_username,
            outcome=TASK_QUEUE_OUTCOME_REMOVED,
        )
        db.add(done)
    nid = {t.id for t in tasks}
    n = (
        db.query(TaskQueue)
        .filter(TaskQueue.id.in_(nid))
        .delete(synchronize_session=False)
    )
    db.commit()
    return int(n)


def task_queue_badge_summary(db: Session) -> dict[str, int]:
    """Total queued tasks and how many are in error (for nav badge coloring)."""
    row = (
        db.query(
            func.count(TaskQueue.id).label("total"),
            func.coalesce(
                func.sum(case((TaskQueue.status == "error", 1), else_=0)),
                0,
            ).label("errors"),
        )
        .one()
    )
    return {"count": int(row.total or 0), "error_count": int(row.errors or 0)}


def list_sendable_task_ids(
    db: Session, firewall_ids: list[int] | None = None
) -> list[int]:
    """IDs of tasks that can be sent: pending or error (excludes in-flight ``sending``)."""
    q = (
        db.query(TaskQueue.id)
        .filter(TaskQueue.status.in_(("pending", "error")))
        .order_by(TaskQueue.created_at.asc())
    )
    if firewall_ids is not None:
        if not firewall_ids:
            return []
        q = q.filter(TaskQueue.firewall_id.in_(firewall_ids))
    rows = q.all()
    return [int(r[0]) for r in rows]


def filter_sendable_task_ids_in_order(db: Session, ids: list[int]) -> list[int]:
    """Subset of ``ids`` that exist and are pending or error; order and first occurrence preserved."""
    if not ids:
        return []
    seen: set[int] = set()
    unique_order: list[int] = []
    for raw in ids:
        i = int(raw)
        if i <= 0 or i in seen:
            continue
        seen.add(i)
        unique_order.append(i)
    if not unique_order:
        return []
    rows = (
        db.query(TaskQueue.id)
        .filter(
            TaskQueue.id.in_(unique_order),
            TaskQueue.status.in_(("pending", "error")),
        )
        .all()
    )
    ok = {int(r[0]) for r in rows}
    return [i for i in unique_order if i in ok]


def _json_to_pretty_lines(raw: str) -> list[str]:
    try:
        obj = json.loads(raw)
        pretty = json.dumps(obj, indent=2, sort_keys=True, default=str)
    except (json.JSONDecodeError, TypeError):
        pretty = raw
    return pretty.splitlines()


def build_task_payload_diff_rows(
    stored_payload_json: str | None, pending_payload_json: str
) -> list[dict[str, Any]]:
    """
    Side-by-side line rows for UI: each row has left/right text and highlight classes.
    Classes: eq | del | ins | empty (pad when one side has no line).
    """
    left_lines = _json_to_pretty_lines(stored_payload_json) if stored_payload_json else []
    right_lines = _json_to_pretty_lines(pending_payload_json)
    if not stored_payload_json:
        rows: list[dict[str, Any]] = []
        for line in right_lines:
            rows.append(
                {
                    "left": "",
                    "right": line,
                    "left_class": "empty",
                    "right_class": "ins",
                }
            )
        if not right_lines:
            rows.append(
                {
                    "left": "",
                    "right": "",
                    "left_class": "empty",
                    "right_class": "eq",
                }
            )
        return rows

    sm = difflib.SequenceMatcher(None, left_lines, right_lines)
    rows = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                rows.append(
                    {
                        "left": left_lines[i1 + k],
                        "right": right_lines[j1 + k],
                        "left_class": "eq",
                        "right_class": "eq",
                    }
                )
        elif tag == "delete":
            for i in range(i1, i2):
                rows.append(
                    {
                        "left": left_lines[i],
                        "right": "",
                        "left_class": "del",
                        "right_class": "empty",
                    }
                )
        elif tag == "insert":
            for j in range(j1, j2):
                rows.append(
                    {
                        "left": "",
                        "right": right_lines[j],
                        "left_class": "empty",
                        "right_class": "ins",
                    }
                )
        else:  # replace
            la = left_lines[i1:i2]
            ra = right_lines[j1:j2]
            n = max(len(la), len(ra))
            for k in range(n):
                lv = la[k] if k < len(la) else ""
                rv = ra[k] if k < len(ra) else ""
                rows.append(
                    {
                        "left": lv,
                        "right": rv,
                        "left_class": "del" if lv else "empty",
                        "right_class": "ins" if rv else "empty",
                    }
                )
    return rows


def firewall_sync_run_details_payload(
    db: Session, sync_run_id: str
) -> dict[str, Any] | None:
    """Summarize changelog rows for a config sync run (per firewall, by action)."""
    sid = (sync_run_id or "").strip()
    try:
        uuid.UUID(sid)
    except ValueError:
        return None

    run = db.get(FirewallConfigSyncRun, sid)
    if run is None:
        return None

    def fw_label(fw: Firewall | None, fid: int) -> str:
        if fw is None:
            return str(fid)
        return fw.name or fw.host or str(fw.id)

    run_fw = db.get(Firewall, run.firewall_id)
    started = run.started_at.isoformat() if run.started_at else ""
    finished = run.finished_at.isoformat() if run.finished_at else None

    rows = (
        db.query(FirewallConfigChangelogEntry, Firewall)
        .join(Firewall, Firewall.id == FirewallConfigChangelogEntry.firewall_id)
        .filter(FirewallConfigChangelogEntry.sync_run_id == sid)
        .order_by(
            FirewallConfigChangelogEntry.action,
            FirewallConfigChangelogEntry.firewall_id,
            FirewallConfigChangelogEntry.entity_type,
            FirewallConfigChangelogEntry.external_name,
        )
        .all()
    )

    by_action: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for ch_row, fw in rows:
        item = {
            "changelog_id": ch_row.id,
            "firewall_id": fw.id,
            "firewall_label": fw_label(fw, fw.id),
            "entity_type": ch_row.entity_type,
            "external_name": ch_row.external_name,
        }
        act = ch_row.action if ch_row.action in ("added", "changed", "deleted") else "changed"
        by_action[act].append(item)

    firewalls_map: dict[int, str] = {}
    for ch_row, fw in rows:
        firewalls_map[fw.id] = fw_label(fw, fw.id)
    firewalls_sorted = [{"id": fid, "label": firewalls_map[fid]} for fid in sorted(firewalls_map)]

    return {
        "sync_run_id": sid,
        "run": {
            "firewall_id": run.firewall_id,
            "firewall_label": fw_label(run_fw, run.firewall_id),
            "started_at": started,
            "finished_at": finished,
            "status": run.status,
            "error_message": run.error_message or "",
            "added_count": run.added_count,
            "changed_count": run.changed_count,
            "deleted_count": run.deleted_count,
        },
        "firewalls": firewalls_sorted,
        "by_action": {
            "added": list(by_action["added"]),
            "changed": list(by_action["changed"]),
            "deleted": list(by_action["deleted"]),
        },
    }


def firewall_changelog_compare_payload(
    db: Session, entry_id: int
) -> dict[str, Any] | None:
    """Return old vs new config payload diff for a changelog row, or None if missing."""
    entry = db.get(FirewallConfigChangelogEntry, entry_id)
    if entry is None:
        return None
    old_raw = None
    if entry.old_payload_json and entry.old_payload_json.strip():
        old_raw = entry.old_payload_json.strip()
    new_raw = ""
    if entry.new_payload_json is not None and entry.new_payload_json.strip():
        new_raw = entry.new_payload_json.strip()
    rows = build_task_payload_diff_rows(old_raw, new_raw)
    return {
        "changelog_id": entry.id,
        "firewall_id": entry.firewall_id,
        "sync_run_id": entry.sync_run_id,
        "entity_type": entry.entity_type,
        "external_name": entry.external_name,
        "action": entry.action,
        "left_missing": old_raw is None,
        "right_missing": new_raw == "",
        "rows": rows,
    }


def task_queue_compare_payload(db: Session, task_id: int) -> dict[str, Any] | None:
    """Return stored cache vs pending task payload and diff rows, or None if task missing."""
    task = db.get(TaskQueue, task_id)
    if task is None:
        return None

    entry_fw = entry_cfg = None
    if task.configuration_id is not None:
        entry_cfg = (
            db.query(ConfigurationConfigEntry)
            .filter(
                ConfigurationConfigEntry.configuration_id == task.configuration_id,
                ConfigurationConfigEntry.entity_type == task.entity_type,
                ConfigurationConfigEntry.external_name == task.external_name,
            )
            .one_or_none()
        )
    elif task.firewall_id is not None:
        entry_fw = (
            db.query(FirewallConfigEntry)
            .filter(
                FirewallConfigEntry.firewall_id == task.firewall_id,
                FirewallConfigEntry.entity_type == task.entity_type,
                FirewallConfigEntry.external_name == task.external_name,
            )
            .one_or_none()
        )
    entry = entry_fw or entry_cfg
    stored_raw = entry.payload_json if entry else None
    rows = build_task_payload_diff_rows(stored_raw, task.payload_json)
    return {
        "task_id": task.id,
        "firewall_id": task.firewall_id,
        "configuration_id": task.configuration_id,
        "entity_type": task.entity_type,
        "external_name": task.external_name,
        "status": task.status,
        "error_message": task.error_message or "",
        "stored_missing": entry is None,
        "rows": rows,
    }


def completed_task_compare_payload(db: Session, completed_id: int) -> dict[str, Any] | None:
    """Stored cache vs queued payload for a completed queue row (History · Task queue history)."""
    row = db.get(TaskQueueCompleted, completed_id)
    if row is None:
        return None
    entry_fw = entry_cfg = None
    if row.configuration_id is not None:
        entry_cfg = (
            db.query(ConfigurationConfigEntry)
            .filter(
                ConfigurationConfigEntry.configuration_id == row.configuration_id,
                ConfigurationConfigEntry.entity_type == row.entity_type,
                ConfigurationConfigEntry.external_name == row.external_name,
            )
            .one_or_none()
        )
    elif row.firewall_id is not None:
        entry_fw = (
            db.query(FirewallConfigEntry)
            .filter(
                FirewallConfigEntry.firewall_id == row.firewall_id,
                FirewallConfigEntry.entity_type == row.entity_type,
                FirewallConfigEntry.external_name == row.external_name,
            )
            .one_or_none()
        )
    entry = entry_fw or entry_cfg
    stored_raw = entry.payload_json if entry else None
    diff_rows = build_task_payload_diff_rows(stored_raw, row.payload_json)
    outcome = row.outcome
    return {
        "completed_id": row.id,
        "source_task_id": row.source_task_id,
        "firewall_id": row.firewall_id,
        "configuration_id": row.configuration_id,
        "entity_type": row.entity_type,
        "external_name": row.external_name,
        "stored_missing": entry is None,
        "rows": diff_rows,
        "outcome": outcome,
    }
