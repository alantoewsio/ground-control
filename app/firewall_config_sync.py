"""Fetch Sophos firewall objects via sophosfirewall-python and reconcile local cache + changelog."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable

import requests
from sophosfirewall_python.api_client import (
    SophosFirewallAPIError,
    SophosFirewallAuthFailure,
    SophosFirewallZeroRecords,
)
from sophosfirewall_python.firewallapi import SophosFirewall
from sqlalchemy.orm import Session

from app import crypto
from app.docker_firewall_egress import docker_firewall_tcp_host
from app.firewall_api_client import (
    normalize_firewall_api_timeout_seconds,
    patch_sophos_firewall_request_timeout,
)
from app.firewall_connectivity import firewall_is_online
from app.firewall_config_entity_payload_catalog import record_entity_payload_field_rows
from app.models import (
    Firewall,
    FirewallConfigChangelogEntry,
    FirewallConfigEntry,
    FirewallConfigSyncRun,
)
from app.netflow_configuration_merge import netflow_servers_from_payload
from app.ref_countries import refresh_ref_countries_from_country_group_items
from app.secrets_database import get_firewall_password_encrypted

ENTITY_INTERFACE = "interface"
ENTITY_VLAN = "vlan"
ENTITY_BRIDGE_PAIR = "bridge_pair"
ENTITY_LAG = "lag"
ENTITY_ALIAS = "alias"
ENTITY_ZONE = "zone"
ENTITY_DHCP_SERVER = "dhcp_server"
ENTITY_DHCP_SERVER_IPV6 = "dhcp_server_ipv6"
ENTITY_DHCP_RELAY = "dhcp_relay"

# Unified Network · Interfaces tab (interface, VLAN, bridge pair, LAG, alias).
ENTITY_TYPES_INTERFACES_TAB: frozenset[str] = frozenset(
    (ENTITY_INTERFACE, ENTITY_VLAN, ENTITY_BRIDGE_PAIR, ENTITY_LAG, ENTITY_ALIAS)
)
ENTITY_IP_HOST = "ip_host"
ENTITY_IP_HOSTGROUP = "ip_hostgroup"
ENTITY_IPS_SWITCH = "ips_switch"
ENTITY_IPS_CUSTOM_SIGNATURE = "ips_custom_signature"
ENTITY_IPS_POLICY = "ips_policy"
ENTITY_SPOOF_PREVENTION = "spoof_prevention"
ENTITY_TRUSTED_MAC = "trusted_mac"
ENTITY_DOS_SETTINGS = "dos_settings"
ENTITY_DOS_BYPASS_RULE = "dos_bypass_rule"
ENTITY_IPS_FULL_SIGNATURE_PACK = "ips_full_signature_pack"
ENTITY_WEBFILTER_POLICY = "webfilterpolicy"
ENTITY_USER_ACTIVITY = "useractivity"
ENTITY_URL_GROUP = "url_group"
ENTITY_FIREWALL_RULE = "firewall_rule"
ENTITY_FIREWALL_RULE_GROUP = "rule_group"
ENTITY_USER = "user"
ENTITY_USER_GROUP = "user_group"
ENTITY_ADMIN_PROFILE = "admin_profile"
ENTITY_SCHEDULE = "schedule"
ENTITY_ACCESS_TIME_POLICY = "access_time_policy"
ENTITY_SURFING_QUOTA_POLICY = "surfing_quota_policy"
ENTITY_DATA_TRANSFER_POLICY = "data_transfer_policy"
ENTITY_DECRYPTION_PROFILE = "decryption_profile"
ENTITY_VPN_PROFILE = "vpn_profile"
ENTITY_HA_CONFIGURE = "ha_configure"
ENTITY_NETFLOW_CONFIGURATION = "netflow_configuration"
ENTITY_UNICAST_ROUTE = "unicast_route"
ENTITY_GATEWAY = "gateway"
ENTITY_GATEWAY_HOST = "gateway_host"
ENTITY_CLIENTLESS_USER = "clientless_user"
# `acl_rule` is the legacy entity_type string for Local Service ACL (see SyncEntitySpec
# below). Alias kept here for code that wants the friendlier name.
ENTITY_LOCAL_SERVICE_ACL = "acl_rule"

_DEFAULT_SYNC_IDS = (ENTITY_INTERFACE, ENTITY_VLAN, ENTITY_ZONE)

SophosFetch = Callable[[SophosFirewall], Any]


def is_full_firewall_config_sync(
    *,
    entities: list[str] | None,
    entities_explicit: bool,
) -> bool:
    """True when the request selected every entity type in the sync catalog (full cache refresh)."""
    if not entities_explicit or entities is None:
        return False
    catalog_ids = {x["id"] for x in list_sync_entity_catalog()}
    if not catalog_ids:
        return False
    selected = {str(x).strip() for x in entities if str(x).strip()}
    return catalog_ids == selected


@dataclass(frozen=True)
class SyncEntitySpec:
    """One syncable object type from sophosfirewall-python (XML list or singleton snapshot)."""

    id: str
    label: str
    response_key: str
    fetch: SophosFetch
    name_keys: tuple[str, ...] = ("Name",)
    singleton: bool = False
    name_fn: Callable[[dict[str, Any]], str | None] | None = None


def _spec_get(method: str) -> SophosFetch:
    def _run(fw: SophosFirewall) -> Any:
        return getattr(fw, method)()

    return _run


def _spec_tag(xml_tag: str) -> SophosFetch:
    def _run(fw: SophosFirewall) -> Any:
        return fw.client.get_tag(xml_tag)

    return _run


def _spec_gateway_get() -> SophosFetch:
    """
    GET Gateway entries.

    The firewall does not accept ``<Get><Gateway>`` directly (returns
    ``529: Input request module is Invalid``). Gateways are exposed under the
    ``<GatewayConfiguration>`` envelope which also carries
    ``<GatewayFailoverTimeout>``. We unwrap the inner ``<Gateway>`` block and
    re-shape the response so :func:`_normalize_items` can extract gateway rows
    using the standard ``response_key="Gateway"`` path.
    """

    def _run(fw: SophosFirewall) -> Any:
        data = fw.client.get_tag("GatewayConfiguration")
        if not isinstance(data, dict):
            return {"Response": {"Gateway": []}}
        resp = data.get("Response")
        if not isinstance(resp, dict):
            return {"Response": {"Gateway": []}}
        envelope = resp.get("GatewayConfiguration")
        if isinstance(envelope, list):
            envelope = envelope[0] if envelope else None
        if not isinstance(envelope, dict):
            return {"Response": {"Gateway": []}}
        gateways = envelope.get("Gateway")
        if isinstance(gateways, dict):
            gateways = [gateways]
        elif gateways is None:
            gateways = []
        elif not isinstance(gateways, list):
            gateways = []
        return {"Response": {"Gateway": gateways}}

    return _run


def _spec_netflow_configuration_get() -> SophosFetch:
    """
    GET Netflow settings.

    xml-api-docs use ``NetFlowConfiguration``; some firmware builds expect ``NetflowConfiguration``
    in the request/response envelope. Try both so sync is not silently skipped (soft-fail) or empty.
    """

    def _run(fw: SophosFirewall) -> Any:
        last_err: SophosFirewallAPIError | None = None
        for tag in ("NetFlowConfiguration", "NetflowConfiguration"):
            try:
                return fw.client.get_tag(tag)
            except SophosFirewallZeroRecords:
                raise
            except SophosFirewallAPIError as exc:
                last_err = exc
        if last_err is not None:
            raise last_err
        raise SophosFirewallAPIError(
            "NetFlow configuration GET failed for all known XML tag spellings."
        )

    return _run


def _user_group_item_name(item: dict[str, Any]) -> str | None:
    gd = item.get("GroupDetail")
    if isinstance(gd, list):
        gd = gd[0] if gd else None
    if isinstance(gd, dict):
        n = _extract_name_value(gd.get("Name"))
        if n:
            return n
    gm = item.get("GroupMembers")
    if isinstance(gm, dict):
        n = _extract_name_value(gm.get("GroupName"))
        if n:
            return n
    if isinstance(gm, list) and gm:
        first = gm[0]
        if isinstance(first, dict):
            n = _extract_name_value(first.get("GroupName"))
            if n:
                return n
    return _extract_item_name(item, ("Name",))


def _collect_user_group_payload_dicts(node: Any, depth: int = 0) -> list[dict[str, Any]]:
    """Find dicts shaped like a UserGroup (have GroupDetail) under an API Response tree."""
    if depth > 12:
        return []
    out: list[dict[str, Any]] = []
    if isinstance(node, dict):
        keys_l = {str(k).lower() for k in node}
        if "groupdetail" in keys_l:
            out.append(node)
            return out
        for v in node.values():
            out.extend(_collect_user_group_payload_dicts(v, depth + 1))
    elif isinstance(node, list):
        for x in node:
            out.extend(_collect_user_group_payload_dicts(x, depth + 1))
    return out


def _normalize_user_group_response(data: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Parse UserGroup list from get_tag(UserGroup); tolerate alternate Response layouts."""
    items = _normalize_items(data, "UserGroup")
    if items:
        return items
    if not isinstance(data, dict):
        return []
    r = data.get("Response")
    if not isinstance(r, dict):
        return []
    found = _collect_user_group_payload_dicts(r)
    seen: set[int] = set()
    uniq: list[dict[str, Any]] = []
    for d in found:
        i = id(d)
        if i in seen:
            continue
        seen.add(i)
        if _user_group_item_name(d):
            uniq.append(d)
    return uniq


def _dos_bypass_rule_cache_key(item: dict[str, Any]) -> str | None:
    """Stable row id for DoS bypass rules (no Name in API; see Sophos DoSBypassRule)."""
    fam = _extract_name_value(item.get("IPFamily"))
    src = _extract_name_value(item.get("SourceIPNetmask"))
    dst = _extract_name_value(item.get("DestinationIPNetmask"))
    proto = _extract_name_value(item.get("Protocol"))
    sp = _extract_name_value(item.get("SourcePort"))
    dp = _extract_name_value(item.get("DestinationPort"))
    if not any((fam, src, dst, proto, sp, dp)):
        return None
    return "|".join(
        (
            fam or "",
            src or "*",
            dst or "*",
            proto or "",
            sp or "",
            dp or "",
        )
    )


# Order: Interfaces, VLAN, Zones first; then remaining getters on SophosFirewall (no get_tag / get_tag_with_filter).
_SYNC_ENTITY_SPECS: tuple[SyncEntitySpec, ...] = (
    SyncEntitySpec(ENTITY_INTERFACE, "Interfaces", "Interface", _spec_get("get_interface")),
    SyncEntitySpec(ENTITY_VLAN, "VLANs", "VLAN", _spec_get("get_vlan")),
    SyncEntitySpec(
        ENTITY_BRIDGE_PAIR,
        "Bridge pairs",
        "BridgePair",
        _spec_tag("BridgePair"),
        ("Hardware", "Name"),
    ),
    SyncEntitySpec(
        ENTITY_LAG,
        "LAG interfaces",
        "LAG",
        _spec_tag("LAG"),
        ("Hardware", "Name"),
    ),
    SyncEntitySpec(ENTITY_ALIAS, "Aliases", "Alias", _spec_tag("Alias")),
    SyncEntitySpec(ENTITY_ZONE, "Zones", "Zone", _spec_get("get_zone")),
    # ``Response/DHCPServer`` per xml-api-docs/Configure/Network/DHCPServer.md
    SyncEntitySpec(
        ENTITY_DHCP_SERVER,
        "DHCP servers (IPv4)",
        "DHCPServer",
        _spec_tag("DHCPServer"),
    ),
    # ``Response/DHCPServerIpv6`` per xml-api-docs/Configure/Network/DHCPServerIpv6.md
    SyncEntitySpec(
        ENTITY_DHCP_SERVER_IPV6,
        "DHCP servers (IPv6)",
        "DHCPServerIpv6",
        _spec_tag("DHCPServerIpv6"),
    ),
    # ``Response/DHCPRelay`` per xml-api-docs/Configure/Network/DHCPRelay.md
    SyncEntitySpec(
        ENTITY_DHCP_RELAY,
        "DHCP relays",
        "DHCPRelay",
        _spec_tag("DHCPRelay"),
    ),
    SyncEntitySpec("acl_rule", "ACL rules", "LocalServiceACL", _spec_get("get_acl_rule"), ("RuleName",)),
    # Routing
    SyncEntitySpec(
        ENTITY_UNICAST_ROUTE,
        "Unicast routes",
        "UnicastRoute",
        _spec_tag("UnicastRoute"),
        ("DestinationIP",),
    ),
    SyncEntitySpec(
        ENTITY_GATEWAY,
        "Gateways",
        "Gateway",
        _spec_gateway_get(),
        ("Name",),
    ),
    SyncEntitySpec(
        ENTITY_GATEWAY_HOST,
        "Custom gateways",
        "GatewayHost",
        _spec_tag("GatewayHost"),
        ("Name",),
    ),
    # Authentication
    SyncEntitySpec(
        ENTITY_CLIENTLESS_USER,
        "Clientless users",
        "ClientlessUser",
        _spec_tag("ClientlessUser"),
        ("Name",),
    ),
    SyncEntitySpec(
        "admin_authen",
        "Admin authentication",
        "AdminAuthentication",
        _spec_get("get_admin_authen"),
        (),
        singleton=True,
    ),
    SyncEntitySpec(
        ENTITY_ADMIN_PROFILE,
        "Administration profiles",
        "AdministrationProfile",
        _spec_get("get_admin_profile"),
    ),
    SyncEntitySpec(
        "admin_settings",
        "Admin settings",
        "AdminSettings",
        _spec_get("get_admin_settings"),
        (),
        singleton=True,
    ),
    SyncEntitySpec("backup", "Backup / restore", "BackupRestore", _spec_get("get_backup")),
    SyncEntitySpec(
        "dns_forwarders",
        "DNS forwarders",
        "DNS",
        _spec_get("get_dns_forwarders"),
        (),
        singleton=True,
    ),
    SyncEntitySpec(ENTITY_FIREWALL_RULE, "Firewall rules", "FirewallRule", _spec_get("get_rule")),
    SyncEntitySpec(
        "fqdn_hostgroup",
        "FQDN host groups",
        "FQDNHostGroup",
        _spec_get("get_fqdn_hostgroup"),
    ),
    SyncEntitySpec("fqdn_host", "FQDN hosts", "FQDNHost", _spec_get("get_fqdn_host")),
    SyncEntitySpec("ip_hostgroup", "IP host groups", "IPHostGroup", _spec_get("get_ip_hostgroup")),
    SyncEntitySpec("ip_host", "IP hosts", "IPHost", _spec_get("get_ip_host")),
    SyncEntitySpec("mac_host", "MAC hosts", "MACHost", _spec_tag("MACHost")),
    SyncEntitySpec(
        "mac_hostgroup",
        "MAC host groups",
        "MACHostGroup",
        _spec_tag("MACHostGroup"),
    ),
    SyncEntitySpec(
        "country_group",
        "Country groups",
        "CountryGroup",
        _spec_tag("CountryGroup"),
    ),
    SyncEntitySpec(
        ENTITY_IPS_POLICY,
        "IPS policies",
        "IPSPolicy",
        _spec_get("get_ips_policy"),
    ),
    SyncEntitySpec(
        ENTITY_IPS_SWITCH,
        "IPS switch",
        "IPSSwitch",
        _spec_tag("IPSSwitch"),
        (),
        singleton=True,
    ),
    SyncEntitySpec(
        ENTITY_IPS_CUSTOM_SIGNATURE,
        "IPS custom signatures",
        "IPSCustomSignature",
        _spec_tag("IPSCustomSignature"),
        ("Name",),
    ),
    SyncEntitySpec(
        ENTITY_SPOOF_PREVENTION,
        "Spoof prevention",
        "SpoofPrevention",
        _spec_tag("SpoofPrevention"),
        (),
        singleton=True,
    ),
    SyncEntitySpec(
        ENTITY_TRUSTED_MAC,
        "Trusted MAC",
        "TrustedMAC",
        _spec_tag("TrustedMAC"),
        ("MACAddress",),
    ),
    SyncEntitySpec(
        ENTITY_DOS_SETTINGS,
        "DoS settings",
        "DoSSettings",
        _spec_tag("DoSSettings"),
        (),
        singleton=True,
    ),
    SyncEntitySpec(
        ENTITY_DOS_BYPASS_RULE,
        "DoS bypass rules",
        "DoSBypassRule",
        _spec_tag("DoSBypassRule"),
        (),
        name_fn=_dos_bypass_rule_cache_key,
    ),
    SyncEntitySpec(
        ENTITY_IPS_FULL_SIGNATURE_PACK,
        "IPS full signature pack",
        "IPSFullSignaturePack",
        _spec_tag("IPSFullSignaturePack"),
        (),
        singleton=True,
    ),
    SyncEntitySpec("notification", "Notifications", "Notification", _spec_get("get_notification")),
    SyncEntitySpec(
        "notification_list",
        "Notification lists",
        "NotificationList",
        _spec_get("get_notification_list"),
    ),
    SyncEntitySpec(
        "reports_retention",
        "Reports retention",
        "DataManagement",
        _spec_get("get_reports_retention"),
    ),
    SyncEntitySpec(
        ENTITY_FIREWALL_RULE_GROUP,
        "Firewall rule groups",
        "FirewallRuleGroup",
        # XML API docs expose FirewallRuleGroup as an object tag; fetch by tag for
        # compatibility across sophosfirewall-python/firmware combinations.
        _spec_tag("FirewallRuleGroup"),
    ),
    SyncEntitySpec("service", "Services", "Services", _spec_get("get_service")),
    SyncEntitySpec("service_group", "Service groups", "ServiceGroup", _spec_get("get_service_group")),
    SyncEntitySpec(
        "snmpv3_user",
        "SNMPv3 users",
        "SNMPv3User",
        _spec_get("get_snmpv3_user"),
        (),
        singleton=True,
    ),
    SyncEntitySpec("syslog_server", "Syslog servers", "SyslogServers", _spec_get("get_syslog_server")),
    SyncEntitySpec(
        "url_group",
        "URL groups",
        "WebFilterURLGroup",
        _spec_get("get_urlgroup"),
    ),
    SyncEntitySpec(
        ENTITY_USER,
        "Users",
        "User",
        _spec_get("get_user"),
        ("Username", "Name"),
    ),
    SyncEntitySpec(
        ENTITY_USER_GROUP,
        "User groups",
        "UserGroup",
        _spec_tag("UserGroup"),
        ("Name",),
        name_fn=_user_group_item_name,
    ),
    # Avoid WebFilterPolicy/UserActivity class __init__ side effects (extra API calls).
    SyncEntitySpec(
        "webfilterpolicy",
        "Web filter policies",
        "WebFilterPolicy",
        _spec_tag("WebFilterPolicy"),
    ),
    SyncEntitySpec(
        "useractivity",
        "User activities",
        "UserActivity",
        _spec_tag("UserActivity"),
    ),
    SyncEntitySpec(
        ENTITY_SCHEDULE,
        "Schedules",
        "Schedule",
        _spec_tag("Schedule"),
    ),
    SyncEntitySpec(
        ENTITY_ACCESS_TIME_POLICY,
        "Access time policies",
        "AccessTimePolicy",
        _spec_tag("AccessTimePolicy"),
    ),
    SyncEntitySpec(
        ENTITY_SURFING_QUOTA_POLICY,
        "Surfing quota policies",
        "SurfingQuotaPolicy",
        _spec_tag("SurfingQuotaPolicy"),
    ),
    SyncEntitySpec(
        ENTITY_DATA_TRANSFER_POLICY,
        "Data transfer policies",
        "DataTransferPolicy",
        _spec_tag("DataTransferPolicy"),
    ),
    SyncEntitySpec(
        ENTITY_DECRYPTION_PROFILE,
        "Decryption profiles",
        "DecryptionProfile",
        _spec_tag("DecryptionProfile"),
    ),
    SyncEntitySpec(
        ENTITY_VPN_PROFILE,
        "VPN (IPsec) profiles",
        "VPNProfile",
        _spec_tag("VPNProfile"),
    ),
    # ``Response/HAConfigure`` per xml-api-docs/Configure/System_Services/HAConfigure.md
    SyncEntitySpec(
        ENTITY_HA_CONFIGURE,
        "HA configuration",
        "HAConfigure",
        _spec_tag("HAConfigure"),
        (),
        singleton=True,
    ),
    # ``Response/NetFlowConfiguration`` per xml-api-docs/System/Administration/NetflowConfiguration.md
    SyncEntitySpec(
        ENTITY_NETFLOW_CONFIGURATION,
        "Netflow configuration",
        "NetFlowConfiguration",
        _spec_netflow_configuration_get(),
        (),
        singleton=True,
    ),
)

_SYNC_BY_ID: dict[str, SyncEntitySpec] = {s.id: s for s in _SYNC_ENTITY_SPECS}

# Tag-based getters may not exist on every firmware; avoid failing the whole sync run.
_SOFT_FAIL_SYNC_IDS: frozenset[str] = frozenset(
    {
        "mac_host",
        "mac_hostgroup",
        "country_group",
        ENTITY_BRIDGE_PAIR,
        ENTITY_LAG,
        ENTITY_ALIAS,
        ENTITY_IPS_CUSTOM_SIGNATURE,
        ENTITY_SPOOF_PREVENTION,
        ENTITY_TRUSTED_MAC,
        ENTITY_DOS_SETTINGS,
        ENTITY_DOS_BYPASS_RULE,
        ENTITY_IPS_FULL_SIGNATURE_PACK,
        ENTITY_FIREWALL_RULE_GROUP,
        ENTITY_SCHEDULE,
        ENTITY_ACCESS_TIME_POLICY,
        ENTITY_SURFING_QUOTA_POLICY,
        ENTITY_DATA_TRANSFER_POLICY,
        ENTITY_DECRYPTION_PROFILE,
        ENTITY_VPN_PROFILE,
        ENTITY_HA_CONFIGURE,
        ENTITY_NETFLOW_CONFIGURATION,
        ENTITY_DHCP_SERVER,
        ENTITY_DHCP_SERVER_IPV6,
        ENTITY_DHCP_RELAY,
    }
)


def list_sync_entity_catalog() -> list[dict[str, str]]:
    """Stable list for Inventory UI toggles (id + label)."""
    return [{"id": s.id, "label": s.label} for s in _SYNC_ENTITY_SPECS]


def _resolve_specs(entity_ids: list[str] | None) -> list[SyncEntitySpec]:
    if entity_ids is None:
        return [_SYNC_BY_ID[i] for i in _DEFAULT_SYNC_IDS]
    out: list[SyncEntitySpec] = []
    seen: set[str] = set()
    for raw in entity_ids:
        sid = str(raw).strip()
        if not sid or sid in seen:
            continue
        spec = _SYNC_BY_ID.get(sid)
        if spec:
            seen.add(sid)
            out.append(spec)
    return out


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _extract_name_value(raw: Any) -> str | None:
    if raw is None:
        return None
    if isinstance(raw, dict):
        raw = raw.get("#text") if "#text" in raw else raw.get("text")
    if not isinstance(raw, str):
        raw = str(raw)
    s = raw.strip()
    return s or None


def _extract_item_name(item: dict[str, Any], name_keys: tuple[str, ...]) -> str | None:
    for key in name_keys:
        n = _extract_name_value(item.get(key))
        if n:
            return n
    return None


def _canonical_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def _netflow_sync_item_has_collectors(item: dict[str, Any]) -> bool:
    """True when the parsed Netflow payload includes at least one non-empty collector (name or host)."""
    for row in netflow_servers_from_payload(item):
        if (row.get("ServerName") or "").strip() or (row.get("NetflowServer") or "").strip():
            return True
    return False


def _coalesce_netflow_configuration_sync_items(
    items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Normalize Netflow GET results so an empty appliance becomes one explicit ``{"Server": []}`` row.

    After all collectors are removed, the API may raise "zero records", omit ``Server``, or return
    placeholder ``Server`` rows with blank name/host. Any of those would otherwise fail to match the
    cached non-empty JSON, leaving stale rows in ``firewall_config_entries``.
    """
    if not items:
        return [{"Server": []}]
    if len(items) == 1 and isinstance(items[0], dict):
        if not _netflow_sync_item_has_collectors(items[0]):
            return [{"Server": []}]
    return items


def _normalize_items(data: dict[str, Any] | None, response_key: str) -> list[dict[str, Any]]:
    if not isinstance(data, dict):
        return []
    r = data.get("Response")
    if not isinstance(r, dict):
        return []
    block = r.get(response_key)
    if block is None:
        for k, v in r.items():
            if isinstance(k, str) and k.lower() == response_key.lower():
                block = v
                break
    if block is None:
        return []
    if isinstance(block, list):
        return [x for x in block if isinstance(x, dict)]
    if isinstance(block, dict):
        return [block]
    return []


def _safe_fetch_items(
    fw: SophosFirewall, spec: SyncEntitySpec
) -> list[dict[str, Any]] | None:
    """
    Returns None when the fetch is skipped (optional entity not supported on device).
    Returns [] for zero records. Otherwise a list of item dicts.
    """
    try:
        data = spec.fetch(fw)
    except SophosFirewallZeroRecords:
        if spec.id == ENTITY_NETFLOW_CONFIGURATION:
            return _coalesce_netflow_configuration_sync_items([])
        return []
    except SophosFirewallAPIError:
        if spec.id in _SOFT_FAIL_SYNC_IDS:
            return None
        raise
    if spec.id == ENTITY_USER_GROUP:
        return _normalize_user_group_response(
            data if isinstance(data, dict) else None
        )
    items = _normalize_items(data, spec.response_key)
    if spec.id == ENTITY_NETFLOW_CONFIGURATION:
        items = _coalesce_netflow_configuration_sync_items(items)
    return items


def _fetch_remote_payloads(
    host: str,
    port: int,
    username: str,
    password: str,
    verify_ssl: bool,
    specs: list[SyncEntitySpec],
    *,
    request_timeout_seconds: int | None = None,
) -> tuple[dict[str, list[dict[str, Any]]] | None, str | None]:
    fw = SophosFirewall(
        username=username,
        password=password,
        hostname=docker_firewall_tcp_host(host),
        port=port,
        verify=verify_ssl,
    )
    if request_timeout_seconds is not None:
        patch_sophos_firewall_request_timeout(fw, request_timeout_seconds)
    try:
        out: dict[str, list[dict[str, Any]]] = {}
        for spec in specs:
            items = _safe_fetch_items(fw, spec)
            if items is None:
                continue
            out[spec.id] = items
    except SophosFirewallAuthFailure as exc:
        return None, f"Authentication failed: {exc}"
    except SophosFirewallAPIError as exc:
        return None, str(exc)
    except requests.exceptions.SSLError as exc:
        return None, f"SSL error: {exc}"
    except requests.exceptions.ConnectTimeout:
        return None, "Connection timed out."
    except requests.exceptions.ConnectionError as exc:
        return None, f"Could not connect: {exc}"
    except OSError as exc:
        return None, str(exc)
    return out, None


def _sync_entity_type(
    db: Session,
    *,
    sync_run_id: str,
    firewall_id: int,
    entity_type: str,
    name_keys: tuple[str, ...],
    singleton: bool,
    name_fn: Callable[[dict[str, Any]], str | None] | None,
    items: list[dict[str, Any]],
    counts: dict[str, int],
) -> None:
    seen: set[str] = set()
    for item in items:
        if isinstance(item, dict):
            record_entity_payload_field_rows(db, entity_type, item)
            # Session uses ``autoflush=False``; without this flush, a subsequent
            # iteration's lookup in ``record_entity_payload_field_rows`` cannot
            # see rows we just added, so the same ``(entity_type, property_name)``
            # would be inserted twice and trip the UNIQUE constraint on commit.
            db.flush()
        name = name_fn(item) if name_fn else _extract_item_name(item, name_keys)
        if not name:
            if singleton and len(items) == 1:
                name = "__config__"
            else:
                continue
        seen.add(name)
        payload = _canonical_json(item)
        existing = (
            db.query(FirewallConfigEntry)
            .filter(
                FirewallConfigEntry.firewall_id == firewall_id,
                FirewallConfigEntry.entity_type == entity_type,
                FirewallConfigEntry.external_name == name,
            )
            .one_or_none()
        )
        if existing is None:
            db.add(
                FirewallConfigEntry(
                    firewall_id=firewall_id,
                    entity_type=entity_type,
                    external_name=name,
                    payload_json=payload,
                )
            )
            db.add(
                FirewallConfigChangelogEntry(
                    sync_run_id=sync_run_id,
                    firewall_id=firewall_id,
                    entity_type=entity_type,
                    external_name=name,
                    action="added",
                    old_payload_json=None,
                    new_payload_json=payload,
                )
            )
            counts["added"] += 1
        elif existing.payload_json != payload:
            old = existing.payload_json
            existing.payload_json = payload
            existing.updated_at = _utc_now()
            db.add(
                FirewallConfigChangelogEntry(
                    sync_run_id=sync_run_id,
                    firewall_id=firewall_id,
                    entity_type=entity_type,
                    external_name=name,
                    action="changed",
                    old_payload_json=old,
                    new_payload_json=payload,
                )
            )
            counts["changed"] += 1

    q = db.query(FirewallConfigEntry).filter(
        FirewallConfigEntry.firewall_id == firewall_id,
        FirewallConfigEntry.entity_type == entity_type,
    )
    if seen:
        q = q.filter(~FirewallConfigEntry.external_name.in_(seen))
    for row in q.all():
        db.add(
            FirewallConfigChangelogEntry(
                sync_run_id=sync_run_id,
                firewall_id=firewall_id,
                entity_type=entity_type,
                external_name=row.external_name,
                action="deleted",
                old_payload_json=row.payload_json,
                new_payload_json=None,
            )
        )
        db.delete(row)
        counts["deleted"] += 1


def run_firewall_config_sync(
    db: Session,
    sdb: Session,
    firewall_id: int,
    *,
    entities: list[str] | None = None,
    entities_explicit: bool = False,
) -> dict[str, Any]:
    """
    Pull selected object types from the firewall API, upsert local rows,
    remove stale rows for those types, and append changelog rows for this run.

    If entities_explicit is False and entities is None: sync interface, vlan, zone only (legacy).
    If entities_explicit is True and entities is empty: no-op success (nothing selected).
    If entities_explicit is True and entities is non-empty: sync only those catalog ids.
    """
    row = db.get(Firewall, firewall_id)
    if not row:
        return {"ok": False, "firewall_id": firewall_id, "error": "Firewall not found"}

    if entities_explicit:
        specs = _resolve_specs(entities)
        if not specs:
            return {
                "ok": True,
                "firewall_id": firewall_id,
                "skipped": True,
                "message": "No entity types selected.",
                "added": 0,
                "changed": 0,
                "deleted": 0,
            }
    else:
        specs = _resolve_specs(None)

    if row.monitor_enabled and not firewall_is_online(row):
        return {
            "ok": True,
            "firewall_id": firewall_id,
            "skipped": True,
            "message": "Firewall appears offline; sync skipped.",
            "added": 0,
            "changed": 0,
            "deleted": 0,
        }

    enc = get_firewall_password_encrypted(sdb, firewall_id)
    if not enc:
        return {"ok": False, "firewall_id": firewall_id, "error": "No stored credential for this firewall."}
    try:
        password = crypto.decrypt_secret(enc)
    except ValueError as exc:
        return {"ok": False, "firewall_id": firewall_id, "error": str(exc)}

    api_to = normalize_firewall_api_timeout_seconds(row.api_request_timeout_seconds)

    payloads, err = _fetch_remote_payloads(
        row.host,
        row.port,
        row.username,
        password,
        row.verify_ssl,
        specs,
        request_timeout_seconds=api_to,
    )
    if err is not None:
        sync_id = str(uuid.uuid4())
        db.add(
            FirewallConfigSyncRun(
                id=sync_id,
                firewall_id=firewall_id,
                started_at=_utc_now(),
                finished_at=_utc_now(),
                status="error",
                error_message=err,
            )
        )
        db.commit()
        return {"ok": False, "firewall_id": firewall_id, "sync_run_id": sync_id, "error": err}

    assert payloads is not None
    sync_id = str(uuid.uuid4())
    started = _utc_now()
    counts = {"added": 0, "changed": 0, "deleted": 0}

    db.add(
        FirewallConfigSyncRun(
            id=sync_id,
            firewall_id=firewall_id,
            started_at=started,
            finished_at=None,
            status="running",
            error_message=None,
        )
    )
    db.flush()

    try:
        for spec in specs:
            if spec.id not in payloads:
                continue
            _sync_entity_type(
                db,
                sync_run_id=sync_id,
                firewall_id=firewall_id,
                entity_type=spec.id,
                name_keys=spec.name_keys,
                singleton=spec.singleton,
                name_fn=spec.name_fn,
                items=payloads[spec.id],
                counts=counts,
            )
        if "country_group" in payloads:
            refresh_ref_countries_from_country_group_items(
                db, payloads["country_group"]
            )
        run_row = db.get(FirewallConfigSyncRun, sync_id)
        if run_row:
            run_row.status = "success"
            run_row.finished_at = _utc_now()
            run_row.added_count = counts["added"]
            run_row.changed_count = counts["changed"]
            run_row.deleted_count = counts["deleted"]
        db.commit()
        if is_full_firewall_config_sync(
            entities=entities,
            entities_explicit=entities_explicit,
        ):
            from app.firewall_ssh import apply_firewall_ssh_device_info_after_full_sync

            apply_firewall_ssh_device_info_after_full_sync(db, sdb, firewall_id)
    except Exception as exc:
        db.rollback()
        db.add(
            FirewallConfigSyncRun(
                id=str(uuid.uuid4()),
                firewall_id=firewall_id,
                started_at=_utc_now(),
                finished_at=_utc_now(),
                status="error",
                error_message=f"Failed to save sync results: {exc}",
            )
        )
        db.commit()
        return {
            "ok": False,
            "firewall_id": firewall_id,
            "error": "Failed to save sync results",
            "detail": str(exc),
        }

    return {
        "ok": True,
        "firewall_id": firewall_id,
        "sync_run_id": sync_id,
        "added": counts["added"],
        "changed": counts["changed"],
        "deleted": counts["deleted"],
        "synced_entity_ids": [s.id for s in specs if s.id in payloads],
    }
