"""Hierarchical summary of cached config entries (firewall or configuration), aligned with Firewalls sidebar."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from app.firewall_config_sync import list_sync_entity_catalog
from app.models import ConfigurationConfigEntry, Firewall, FirewallConfigEntry

# entity_type -> (section_id, section_label, group_id, group_label, tab_id, tab_label)
_ENTITY_TAB: dict[str, tuple[str, str, str, str, str, str]] = {
    # Protect · Firewall
    "firewall_rule": (
        "protect",
        "Protect",
        "firewall",
        "Firewall",
        "rules",
        "Firewall rules",
    ),
    "rule_group": (
        "protect",
        "Protect",
        "firewall",
        "Firewall",
        "rule_groups",
        "Rule groups",
    ),
    "acl_rule": (
        "protect",
        "Protect",
        "firewall",
        "Firewall",
        "acl_rules",
        "ACL rules",
    ),
    # Protect · Intrusion Prevention
    "ips_switch": (
        "protect",
        "Protect",
        "intrusion_prevention",
        "Intrusion Prevention",
        "configure",
        "Configure",
    ),
    "spoof_prevention": (
        "protect",
        "Protect",
        "intrusion_prevention",
        "Intrusion Prevention",
        "configure",
        "Configure",
    ),
    "dos_settings": (
        "protect",
        "Protect",
        "intrusion_prevention",
        "Intrusion Prevention",
        "configure",
        "Configure",
    ),
    "dos_bypass_rule": (
        "protect",
        "Protect",
        "intrusion_prevention",
        "Intrusion Prevention",
        "configure",
        "Configure",
    ),
    "ips_full_signature_pack": (
        "protect",
        "Protect",
        "intrusion_prevention",
        "Intrusion Prevention",
        "configure",
        "Configure",
    ),
    "ips_policy": (
        "protect",
        "Protect",
        "intrusion_prevention",
        "Intrusion Prevention",
        "policy",
        "Policy",
    ),
    "ips_custom_signature": (
        "protect",
        "Protect",
        "intrusion_prevention",
        "Intrusion Prevention",
        "signatures",
        "Custom signatures",
    ),
    "trusted_mac": (
        "protect",
        "Protect",
        "intrusion_prevention",
        "Intrusion Prevention",
        "trusted_mac",
        "Trusted MAC",
    ),
    # Protect · Web
    "webfilterpolicy": (
        "protect",
        "Protect",
        "web",
        "Web",
        "web_filter_policy",
        "Web Filter Policy",
    ),
    "useractivity": (
        "protect",
        "Protect",
        "web",
        "Web",
        "user_activities",
        "User Activities",
    ),
    "url_group": (
        "protect",
        "Protect",
        "web",
        "Web",
        "url_groups",
        "URL Groups",
    ),
    # Configure · Network
    "interface": (
        "configure",
        "Configure",
        "network",
        "Network",
        "interfaces",
        "Interfaces",
    ),
    "bridge_pair": (
        "configure",
        "Configure",
        "network",
        "Network",
        "interfaces",
        "Interfaces",
    ),
    "lag": ("configure", "Configure", "network", "Network", "interfaces", "Interfaces"),
    "alias": ("configure", "Configure", "network", "Network", "interfaces", "Interfaces"),
    "vlan": ("configure", "Configure", "network", "Network", "vlan", "VLAN"),
    "zone": ("configure", "Configure", "network", "Network", "zones", "Zones"),
    # Configure · Authentication
    "user": (
        "configure",
        "Configure",
        "authentication",
        "Authentication",
        "users",
        "Users",
    ),
    "user_group": (
        "configure",
        "Configure",
        "authentication",
        "Authentication",
        "groups",
        "Groups",
    ),
    # Configure · System Services
    "ha_configure": (
        "configure",
        "Configure",
        "system_services",
        "System Services",
        "ha",
        "HA",
    ),
    # System · Profiles (tabs match Profiles page + decryption cache)
    "schedule": (
        "system",
        "System",
        "profiles",
        "Profiles",
        "schedule",
        "Schedule",
    ),
    "access_time_policy": (
        "system",
        "System",
        "profiles",
        "Profiles",
        "access_time",
        "Access time",
    ),
    "surfing_quota_policy": (
        "system",
        "System",
        "profiles",
        "Profiles",
        "surfing_quota",
        "Surfing quota",
    ),
    "data_transfer_policy": (
        "system",
        "System",
        "profiles",
        "Profiles",
        "network_traffic_quota",
        "Network traffic quota",
    ),
    "vpn_profile": (
        "system",
        "System",
        "profiles",
        "Profiles",
        "ipsec_profiles",
        "IPsec profiles",
    ),
    "admin_profile": (
        "system",
        "System",
        "profiles",
        "Profiles",
        "device_access",
        "Device Access",
    ),
    "decryption_profile": (
        "system",
        "System",
        "profiles",
        "Profiles",
        "decryption",
        "Decryption profiles",
    ),
    # System · Hosts & Services
    "ip_host": (
        "system",
        "System",
        "hosts_services",
        "Hosts & Services",
        "ip_host",
        "IP host",
    ),
    "ip_hostgroup": (
        "system",
        "System",
        "hosts_services",
        "Hosts & Services",
        "ip_hostgroup",
        "IP host group",
    ),
    "mac_host": (
        "system",
        "System",
        "hosts_services",
        "Hosts & Services",
        "mac_host",
        "MAC host",
    ),
    "mac_hostgroup": (
        "system",
        "System",
        "hosts_services",
        "Hosts & Services",
        "mac_hostgroup",
        "MAC host group",
    ),
    "fqdn_host": (
        "system",
        "System",
        "hosts_services",
        "Hosts & Services",
        "fqdn_host",
        "FQDN host",
    ),
    "fqdn_hostgroup": (
        "system",
        "System",
        "hosts_services",
        "Hosts & Services",
        "fqdn_hostgroup",
        "FQDN host group",
    ),
    "country_group": (
        "system",
        "System",
        "hosts_services",
        "Hosts & Services",
        "country_group",
        "Country group",
    ),
    "service": (
        "system",
        "System",
        "hosts_services",
        "Hosts & Services",
        "service",
        "Services",
    ),
    "service_group": (
        "system",
        "System",
        "hosts_services",
        "Hosts & Services",
        "service_group",
        "Service group",
    ),
    # System · Administration (Netflow UI at /firewalls/system/administration; other tabs config-cache only)
    "admin_authen": (
        "system",
        "System",
        "administration",
        "Administration",
        "admin_authen",
        "Admin authentication",
    ),
    "admin_settings": (
        "system",
        "System",
        "administration",
        "Administration",
        "admin_settings",
        "Admin settings",
    ),
    "backup": (
        "system",
        "System",
        "administration",
        "Administration",
        "backup",
        "Backup / restore",
    ),
    "dns_forwarders": (
        "system",
        "System",
        "administration",
        "Administration",
        "dns_forwarders",
        "DNS forwarders",
    ),
    "notification": (
        "system",
        "System",
        "administration",
        "Administration",
        "notification",
        "Notifications",
    ),
    "notification_list": (
        "system",
        "System",
        "administration",
        "Administration",
        "notification_list",
        "Notification lists",
    ),
    "reports_retention": (
        "system",
        "System",
        "administration",
        "Administration",
        "reports_retention",
        "Reports retention",
    ),
    "syslog_server": (
        "system",
        "System",
        "administration",
        "Administration",
        "syslog_server",
        "Syslog servers",
    ),
    "snmpv3_user": (
        "system",
        "System",
        "administration",
        "Administration",
        "snmpv3_user",
        "SNMPv3 user",
    ),
    "netflow_configuration": (
        "system",
        "System",
        "administration",
        "Administration",
        "netflow",
        "Netflow",
    ),
}

_SECTION_ORDER = ["monitor", "protect", "configure", "system"]

_GROUP_ORDER: dict[str, list[str]] = {
    "monitor": [],
    "protect": ["firewall", "intrusion_prevention", "web"],
    "configure": ["network", "authentication", "system_services"],
    "system": ["profiles", "hosts_services", "administration"],
}

_TAB_ORDER: dict[str, dict[str, list[str]]] = {
    "protect": {
        "firewall": ["rules", "rule_groups", "acl_rules"],
        "intrusion_prevention": ["configure", "policy", "signatures", "trusted_mac"],
        "web": ["web_filter_policy", "user_activities", "url_groups"],
    },
    "configure": {
        "network": ["interfaces", "vlan", "zones"],
        "authentication": ["users", "groups"],
        "system_services": ["ha"],
    },
    "system": {
        "profiles": [
            "schedule",
            "access_time",
            "surfing_quota",
            "network_traffic_quota",
            "ipsec_profiles",
            "device_access",
            "decryption",
        ],
        "hosts_services": [
            "ip_host",
            "ip_hostgroup",
            "mac_host",
            "mac_hostgroup",
            "fqdn_host",
            "fqdn_hostgroup",
            "country_group",
            "service",
            "service_group",
        ],
        "administration": [
            "admin_authen",
            "admin_settings",
            "backup",
            "dns_forwarders",
            "netflow_configuration",
            "notification",
            "notification_list",
            "reports_retention",
            "syslog_server",
            "snmpv3_user",
        ],
    },
}


def _sync_labels() -> dict[str, str]:
    return {x["id"]: x["label"] for x in list_sync_entity_catalog()}


def _sort_tabs(section_id: str, group_id: str, tabs: list[dict[str, Any]]) -> None:
    order = _TAB_ORDER.get(section_id, {}).get(group_id)
    if not order:
        tabs.sort(key=lambda t: (t["label"] or "").casefold())
        return
    rank = {tid: i for i, tid in enumerate(order)}

    def _key(t: dict[str, Any]) -> tuple[int, str]:
        tid = t.get("id") or ""
        return (rank.get(tid, 999), (t.get("label") or "").casefold())

    tabs.sort(key=_key)


def _sort_groups(section_id: str, groups: list[dict[str, Any]]) -> None:
    order = _GROUP_ORDER.get(section_id, [])
    if not order:
        groups.sort(key=lambda g: (g["label"] or "").casefold())
        return
    rank = {gid: i for i, gid in enumerate(order)}

    def _key(g: dict[str, Any]) -> tuple[int, str]:
        gid = g.get("id") or ""
        return (rank.get(gid, 999), (g.get("label") or "").casefold())

    groups.sort(key=_key)


def build_config_viewer_tree(
    db: Session,
    *,
    firewall_id: int | None = None,
    configuration_id: int | None = None,
) -> dict[str, Any]:
    """Return nested sections → groups → tabs → items for API JSON."""
    if (firewall_id is None) == (configuration_id is None):
        raise ValueError("Exactly one of firewall_id or configuration_id must be set")

    if firewall_id is not None:
        q = (
            db.query(
                FirewallConfigEntry.id,
                FirewallConfigEntry.entity_type,
                FirewallConfigEntry.external_name,
            )
            .filter(FirewallConfigEntry.firewall_id == firewall_id)
            .order_by(
                FirewallConfigEntry.entity_type.asc(),
                FirewallConfigEntry.external_name.asc(),
            )
        )
        fw_row = db.get(Firewall, firewall_id)
        scope = {
            "kind": "firewall",
            "id": firewall_id,
            "allow_delete": bool(fw_row.is_test) if fw_row is not None else False,
        }
    else:
        cid = configuration_id if configuration_id is not None else 0
        q = (
            db.query(
                ConfigurationConfigEntry.id,
                ConfigurationConfigEntry.entity_type,
                ConfigurationConfigEntry.external_name,
            )
            .filter(ConfigurationConfigEntry.configuration_id == cid)
            .order_by(
                ConfigurationConfigEntry.entity_type.asc(),
                ConfigurationConfigEntry.external_name.asc(),
            )
        )
        scope = {"kind": "configuration", "id": cid, "allow_delete": True}

    rows = q.all()
    labels = _sync_labels()

    # section_id -> group_id -> tab_id -> list of items
    bucket: dict[str, dict[str, dict[str, list[dict[str, Any]]]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(list))
    )
    section_meta: dict[str, str] = {}
    group_meta: dict[tuple[str, str], str] = {}
    tab_meta: dict[tuple[str, str, str], str] = {}
    for sid, sl, gid, gl, tid, tl in _ENTITY_TAB.values():
        section_meta.setdefault(sid, sl)
        group_meta.setdefault((sid, gid), gl)
        tab_meta.setdefault((sid, gid, tid), tl)
    unmapped_by_type: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for entry_id, entity_type, external_name in rows:
        et = (entity_type or "").strip()
        name = external_name or ""
        item = {"entry_id": int(entry_id), "name": name, "entity_type": et}
        slot = _ENTITY_TAB.get(et)
        if not slot:
            unmapped_by_type[et].append(item)
            continue
        sid, sl, gid, gl, tid, tl = slot
        section_meta[sid] = sl
        group_meta[(sid, gid)] = gl
        tab_meta[(sid, gid, tid)] = tl
        bucket[sid][gid][tid].append(item)

    sections_out: list[dict[str, Any]] = []
    section_ids: list[str] = list(_SECTION_ORDER)
    section_ids.extend(sorted((sid for sid in bucket if sid not in _SECTION_ORDER), key=str.casefold))
    for sid in section_ids:
        groups_raw = bucket.get(sid, {})
        known_group_ids = _GROUP_ORDER.get(sid, [])
        group_ids: list[str] = list(known_group_ids)
        group_ids.extend(
            sorted((gid for gid in groups_raw if gid not in known_group_ids), key=str.casefold)
        )
        groups_out: list[dict[str, Any]] = []
        for gid in group_ids:
            tabs_raw = groups_raw.get(gid, {})
            known_tab_ids = _TAB_ORDER.get(sid, {}).get(gid, [])
            tab_ids: list[str] = list(known_tab_ids)
            tab_ids.extend(sorted((tid for tid in tabs_raw if tid not in known_tab_ids), key=str.casefold))
            tabs_out: list[dict[str, Any]] = []
            for tid in tab_ids:
                items = tabs_raw.get(tid, [])
                items_sorted = sorted(items, key=lambda x: (x["name"] or "").casefold())
                tabs_out.append(
                    {
                        "id": tid,
                        "label": tab_meta.get((sid, gid, tid), tid),
                        "count": len(items_sorted),
                        "items": items_sorted,
                    }
                )
            _sort_tabs(sid, gid, tabs_out)
            g_count = sum(t["count"] for t in tabs_out)
            groups_out.append(
                {
                    "id": gid,
                    "label": group_meta.get((sid, gid), gid),
                    "count": g_count,
                    "tabs": tabs_out,
                }
            )
        _sort_groups(sid, groups_out)
        s_count = sum(g["count"] for g in groups_out)
        sections_out.append(
            {
                "id": sid,
                "label": section_meta.get(sid, sid),
                "count": s_count,
                "groups": groups_out,
            }
        )

    unmapped_tabs: list[dict[str, Any]] = []
    for et, items in sorted(unmapped_by_type.items(), key=lambda x: x[0].casefold()):
        items_sorted = sorted(items, key=lambda x: (x["name"] or "").casefold())
        unmapped_tabs.append(
            {
                "id": et,
                "label": labels.get(et, et.replace("_", " ").title()),
                "entity_type": et,
                "count": len(items_sorted),
                "items": items_sorted,
            }
        )

    unmapped_block: dict[str, Any] | None = None
    if unmapped_tabs:
        uc = sum(t["count"] for t in unmapped_tabs)
        unmapped_block = {
            "id": "other",
            "label": "Other cached objects",
            "count": uc,
            "tabs": unmapped_tabs,
        }

    total = sum(s["count"] for s in sections_out)
    if unmapped_block:
        total += unmapped_block["count"]

    return {
        "scope": scope,
        "total_count": total,
        "sections": sections_out,
        "unmapped": unmapped_block,
    }
