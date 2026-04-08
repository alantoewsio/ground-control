"""Task queue helpers for Users, User groups, and Administration profiles (Sophos XML API)."""

from __future__ import annotations

import json
from typing import Any

import xmltodict
from sophosfirewall_python.firewallapi import SophosFirewall
from sqlalchemy.orm import Session

from app.firewall_config_sync import (
    ENTITY_ADMIN_PROFILE,
    ENTITY_USER,
    ENTITY_USER_GROUP,
)
from app.models import FirewallConfigEntry


def _scalar(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, dict):
        raw = raw.get("#text") if "#text" in raw else raw.get("text")
    return str(raw).strip()


def strip_gc_keys(d: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in d.items() if not str(k).startswith("__gc")}


def username_from_user_payload(data: dict[str, Any], fallback: str) -> str:
    u = _scalar(data.get("Username"))
    return u or str(fallback or "").strip()


def user_group_name_from_merged(merged: dict[str, Any], fallback: str) -> str:
    root = merged.get("UserGroup") if isinstance(merged.get("UserGroup"), dict) else merged
    gd = root.get("GroupDetail") if isinstance(root, dict) else None
    if isinstance(gd, list) and gd:
        gd = gd[0]
    if isinstance(gd, dict):
        n = _scalar(gd.get("Name"))
        if n:
            return n
    return str(fallback or "").strip()


def _firewall_has_cache_row(
    db: Session, *, firewall_id: int, entity_type: str, external_name: str
) -> bool:
    q = (
        db.query(FirewallConfigEntry.id)
        .filter(
            FirewallConfigEntry.firewall_id == firewall_id,
            FirewallConfigEntry.entity_type == entity_type,
            FirewallConfigEntry.external_name == external_name,
        )
        .first()
    )
    return q is not None


def firewall_has_user_cache_row(
    db: Session, *, firewall_id: int, external_name: str
) -> bool:
    return _firewall_has_cache_row(
        db, firewall_id=firewall_id, entity_type=ENTITY_USER, external_name=external_name
    )


def firewall_has_user_group_cache_row(
    db: Session, *, firewall_id: int, external_name: str
) -> bool:
    return _firewall_has_cache_row(
        db, firewall_id=firewall_id, entity_type=ENTITY_USER_GROUP, external_name=external_name
    )


def firewall_has_admin_profile_cache_row(
    db: Session, *, firewall_id: int, external_name: str
) -> bool:
    return _firewall_has_cache_row(
        db, firewall_id=firewall_id, entity_type=ENTITY_ADMIN_PROFILE, external_name=external_name
    )


def user_create_kwargs_from_merged(merged: dict[str, Any]) -> dict[str, Any]:
    email = ""
    el = merged.get("EmailList")
    if isinstance(el, dict):
        eid = el.get("EmailID")
        if isinstance(eid, list) and eid:
            email = _scalar(eid[0])
        else:
            email = _scalar(eid)
    return {
        "user": _scalar(merged.get("Username")),
        "name": _scalar(merged.get("Name")),
        "description": _scalar(merged.get("Description")),
        "user_password": _scalar(merged.get("Password")) or "ChangeMe123!",
        "user_type": _scalar(merged.get("UserType")) or "User",
        "profile": _scalar(merged.get("Profile")),
        "group": _scalar(merged.get("Group")),
        "email": email,
        "access_time_policy": _scalar(merged.get("AccessTimePolicy")) or "Allowed all the time",
        "sslvpn_policy": _scalar(merged.get("SSLVPNPolicy")) or "No Policy Applied",
        "clientless_policy": _scalar(merged.get("ClientlessPolicy")) or "No Policy Applied",
        "l2tp": _scalar(merged.get("L2TP")) or "Disable",
        "pptp": _scalar(merged.get("PPTP")) or "Disable",
        "cisco": _scalar(merged.get("CISCO")) or "Disable",
        "quarantine_digest": _scalar(merged.get("QuarantineDigest")) or "Disable",
        "mac_binding": _scalar(merged.get("MACBinding")) or "Disable",
        "login_restriction": _scalar(merged.get("LoginRestriction")) or "UserGroupNode",
        "isencryptcert": _scalar(merged.get("IsEncryptCert")) or "Disable",
        "surfingquota_policy": _scalar(merged.get("SurfingQuotaPolicy"))
        or "Unlimited Internet Access",
        "applianceaccess_schedule": _scalar(merged.get("ScheduleForApplianceAccess"))
        or "All The Time",
    }


def submit_user_create(fw: SophosFirewall, merged: dict[str, Any]) -> None:
    kw = user_create_kwargs_from_merged(merged)
    if not kw.get("user"):
        raise ValueError("Username is required")
    if not kw.get("name"):
        raise ValueError("Name is required")
    fw.create_user(debug=False, **kw)


def submit_user_update(
    fw: SophosFirewall, merged: dict[str, Any], lookup_username: str
) -> None:
    uname = _scalar(merged.get("Username")) or str(lookup_username or "").strip()
    if not uname:
        raise ValueError("Username is required")
    params = strip_gc_keys(dict(merged))
    params.pop("PasswordHash", None)
    params.pop("Status", None)
    if not _scalar(params.get("Password")):
        params.pop("Password", None)
    fw.update("User", params, name=uname, lookup_key="Username")


def submit_user_group_add(fw: SophosFirewall, merged: dict[str, Any]) -> None:
    body = strip_gc_keys(dict(merged))
    if "UserGroup" not in body:
        body = {"UserGroup": body}
    inner = xmltodict.unparse(body, pretty=True).strip()
    if inner.startswith("<?xml"):
        inner = inner.split(">", 1)[-1].strip()
    fw.submit_xml(inner, template_vars={}, set_operation="add")


def submit_user_group_update(
    fw: SophosFirewall, merged: dict[str, Any], group_name: str
) -> None:
    params = strip_gc_keys(dict(merged))
    if "UserGroup" in params and isinstance(params["UserGroup"], dict):
        params = params["UserGroup"]
    fw.update("UserGroup", params, name=group_name, lookup_key="Name")


def _nested_scalar(d: dict[str, Any], *path: str) -> str:
    cur: Any = d
    for p in path:
        if not isinstance(cur, dict):
            return ""
        cur = cur.get(p)
    return _scalar(cur)


def admin_profile_create_kwargs_from_payload(m: dict[str, Any]) -> dict[str, Any]:
    """Map AdministrationProfile-shaped dict (from API) to create_admin_profile kwargs."""
    sys_b = m.get("System") if isinstance(m.get("System"), dict) else {}
    id_b = m.get("Identity") if isinstance(m.get("Identity"), dict) else {}
    vpn_b = m.get("VPN") if isinstance(m.get("VPN"), dict) else {}
    waf_b = m.get("WAF") if isinstance(m.get("WAF"), dict) else {}
    lr_b = m.get("LogsReports") if isinstance(m.get("LogsReports"), dict) else {}
    wp_b = m.get("WirelessProtection") if isinstance(m.get("WirelessProtection"), dict) else {}

    pairs: list[tuple[str, str]] = [
        ("dashboard", _scalar(m.get("Dashboard"))),
        ("wizard", _scalar(m.get("Wizard"))),
        ("set_system_profile", _nested_scalar(sys_b, "SetSystemProfile")),
        ("profile", _nested_scalar(sys_b, "Profile")),
        ("system_password", _nested_scalar(sys_b, "Password")),
        ("central_management", _nested_scalar(sys_b, "CentralManagement")),
        ("backup", _nested_scalar(sys_b, "Backup")),
        ("restore", _nested_scalar(sys_b, "Restore")),
        ("firmware", _nested_scalar(sys_b, "Firmware")),
        ("licensing", _nested_scalar(sys_b, "Licensing")),
        ("services", _nested_scalar(sys_b, "Services")),
        ("updates", _nested_scalar(sys_b, "Updates")),
        ("reboot_shutdown", _nested_scalar(sys_b, "RebootShutdown")),
        ("ha", _nested_scalar(sys_b, "HA")),
        ("download_certificates", _nested_scalar(sys_b, "DownloadCertificates")),
        (
            "other_certificate_configuration",
            _nested_scalar(sys_b, "OtherCertificateConfiguration"),
        ),
        ("diagnostics", _nested_scalar(sys_b, "Diagnostics")),
        ("other_system_configuration", _nested_scalar(sys_b, "OtherSystemConfiguration")),
        ("set_wireless_protection", _nested_scalar(wp_b, "SetWirelessProtection")),
        ("wireless_protection_overview", _nested_scalar(wp_b, "WirelessProtectionOverview")),
        ("wireless_protection_settings", _nested_scalar(wp_b, "WirelessProtectionSettings")),
        (
            "wireless_protection_network",
            _nested_scalar(wp_b, "WirelessProtectionNetworkNetwork"),
        ),
        (
            "wireless_protection_access_point",
            _nested_scalar(wp_b, "WirelessProtectionAccessPoint"),
        ),
        ("wireless_protection_mesh", _nested_scalar(wp_b, "WirelessProtectionMesh")),
        ("objects", _scalar(m.get("Objects"))),
        ("network", _scalar(m.get("Network"))),
        ("set_identity_profile", _nested_scalar(id_b, "SetIdentityProfile")),
        ("authentication", _nested_scalar(id_b, "Authentication")),
        ("groups", _nested_scalar(id_b, "Groups")),
        ("guest_users_management", _nested_scalar(id_b, "GuestUsersManagement")),
        ("other_guest_user_settings", _nested_scalar(id_b, "OtherGuestUserSettings")),
        ("policy", _nested_scalar(id_b, "Policy")),
        (
            "test_external_server_connectivity",
            _nested_scalar(id_b, "TestExternalServerConnectivity"),
        ),
        ("disconnect_live_user", _nested_scalar(id_b, "DisconnectLiveUser")),
        ("firewall", _scalar(m.get("Firewall"))),
        ("set_vpn_profile", _nested_scalar(vpn_b, "SetVPNProfile")),
        ("connect_tunnel", _nested_scalar(vpn_b, "ConnectTunnel")),
        ("other_vpn_configurations", _nested_scalar(vpn_b, "OtherVPNConfigurations")),
        ("ips", _scalar(m.get("IPS"))),
        ("web_filter", _scalar(m.get("WebFilter"))),
        ("cloud_application_dashboard", _scalar(m.get("CloudApplicationDashboard"))),
        ("zero_day_protection", _scalar(m.get("ZeroDayProtection"))),
        ("application_filter", _scalar(m.get("ApplicationFilter"))),
        ("set_waf_profile", _nested_scalar(waf_b, "SetWAFProfile")),
        ("alerts", _nested_scalar(waf_b, "Alerts")),
        ("other_waf_configuration", _nested_scalar(waf_b, "OtherWAFConfiguration")),
        ("qos", _scalar(m.get("QoS"))),
        ("email_protection", _scalar(m.get("EmailProtection"))),
        ("traffic_discovery", _scalar(m.get("TrafficDiscovery"))),
        ("set_logs_reports_profile", _nested_scalar(lr_b, "SetLogsReportsProfile")),
        ("configuration", _nested_scalar(lr_b, "Configuration")),
        ("log_viewer", _nested_scalar(lr_b, "LogViewer")),
        ("reports_access", _nested_scalar(lr_b, "ReportsAccess")),
        (
            "four_eye_authentication_settings",
            _nested_scalar(lr_b, "Four-EyeAuthenticationSettings"),
        ),
        ("de_anonymization", _nested_scalar(lr_b, "De-Anonymization")),
    ]
    return {k: v for k, v in pairs if v}


def submit_admin_profile_create(fw: SophosFirewall, merged: dict[str, Any]) -> None:
    params = strip_gc_keys(dict(merged))
    name = _scalar(params.get("Name"))
    if not name:
        raise ValueError("Profile name is required")
    kw = admin_profile_create_kwargs_from_payload(params)
    kw = {k: v for k, v in kw.items() if v is not None}
    if not kw.get("set_wireless_protection"):
        kw["set_wireless_protection"] = "None"
    fw.create_admin_profile(name, default_permission="None", debug=False, **kw)


def submit_admin_profile_update(
    fw: SophosFirewall, merged: dict[str, Any], profile_name: str
) -> None:
    params = strip_gc_keys(dict(merged))
    params.pop("Name", None)
    if not profile_name:
        raise ValueError("Profile name is required")
    fw.update("AdministrationProfile", params, name=profile_name, lookup_key="Name")


def merge_user_payload(base: dict[str, Any], client: dict[str, Any]) -> dict[str, Any]:
    out = dict(base) if isinstance(base, dict) else {}
    for k, v in client.items():
        if str(k).startswith("__"):
            continue
        out[k] = v
    return out


def merge_user_group_payload(base: dict[str, Any], client: dict[str, Any]) -> dict[str, Any]:
    out = json.loads(json.dumps(base)) if isinstance(base, dict) else {}
    if not isinstance(out, dict):
        out = {}

    def deep_merge(dst: dict[str, Any], src: dict[str, Any]) -> None:
        for k, v in src.items():
            if str(k).startswith("__"):
                continue
            if isinstance(v, dict) and isinstance(dst.get(k), dict):
                deep_merge(dst[k], v)
            else:
                dst[k] = v

    if isinstance(client, dict):
        deep_merge(out, client)
    return out


def merge_admin_profile_payload(base: dict[str, Any], client: dict[str, Any]) -> dict[str, Any]:
    out = json.loads(json.dumps(base)) if isinstance(base, dict) else {}
    if not isinstance(out, dict):
        out = {}

    def deep_merge(dst: dict[str, Any], src: dict[str, Any]) -> None:
        for k, v in src.items():
            if str(k).startswith("__"):
                continue
            if isinstance(v, dict) and isinstance(dst.get(k), dict):
                deep_merge(dst[k], v)
            else:
                dst[k] = v

    if isinstance(client, dict):
        deep_merge(out, client)
    return out


def task_payload_matches_cache(entry: FirewallConfigEntry, merged: dict[str, Any]) -> bool:
    try:
        cur = json.loads(entry.payload_json)
    except (json.JSONDecodeError, TypeError):
        cur = {}
    if not isinstance(cur, dict):
        cur = {}
    a = json.dumps(cur, sort_keys=True, separators=(",", ":"), default=str)
    b = json.dumps(merged, sort_keys=True, separators=(",", ":"), default=str)
    return a == b
