"""Merge Hosts & Services flyout forms into cached Sophos JSON payloads (dict)."""

from __future__ import annotations

import copy
import re
from typing import Any, Mapping

_SERVICE_UI_TO_TYPE = {
    "tcpudp": "TCPorUDP",
    "ip": "IP",
    "icmp": "ICMP",
    "icmpv6": "ICMPv6",
}


def _blank_desc(s: str) -> str | None:
    t = (s or "").strip()
    return None if t == "" else t


def _form_str(form: Mapping[str, Any], *keys: str) -> str:
    for k in keys:
        v = form.get(k)
        if v is None:
            continue
        s = str(v).strip()
        if s:
            return s
    return ""


def _overlay_description(out: dict[str, Any], form: Mapping[str, Any]) -> None:
    if "description" in form or "Description" in form:
        raw = form.get("description") if "description" in form else form.get("Description")
        out["Description"] = _blank_desc(str(raw or ""))


_SERVICE_TYPE_TO_UI = {v: k for k, v in _SERVICE_UI_TO_TYPE.items()}

_SVC_FLAT_DETAIL = re.compile(r"^ServiceDetails\.ServiceDetail\.(?:(\d+)\.)?(.+)$")


def _service_detail_rows_from_flat_form(form: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Rebuild flyout-style detail rows from table flatten_payload keys."""
    by_idx: dict[int, dict[str, str]] = {}
    for k, v in form.items():
        if not isinstance(k, str):
            continue
        m = _SVC_FLAT_DETAIL.match(k)
        if not m:
            continue
        idx_s, field = m.group(1), m.group(2)
        if "." in field:
            continue
        idx = int(idx_s) if idx_s is not None else 0
        by_idx.setdefault(idx, {})[field] = str(v) if v is not None else ""
    if not by_idx:
        return []
    rows: list[dict[str, Any]] = []
    for i in sorted(by_idx.keys()):
        d = by_idx[i]
        row: dict[str, Any] = {}
        if "Protocol" in d:
            row["protocol"] = str(d["Protocol"]).strip().lower()
        if "SourcePort" in d:
            row["source_port"] = d["SourcePort"]
        if "DestinationPort" in d:
            row["dest_port"] = d["DestinationPort"]
        if "ProtocolName" in d:
            row["protocol_name"] = d["ProtocolName"]
        if "ICMPType" in d:
            row["icmp_type"] = d["ICMPType"]
        if "ICMPCode" in d:
            row["icmp_code"] = d["ICMPCode"]
        if "ICMPv6Type" in d:
            row["icmp_type"] = d["ICMPv6Type"]
        if "ICMPv6Code" in d:
            row["icmp_code"] = d["ICMPv6Code"]
        rows.append(row)
    return rows


def _split_csv_field(form: Mapping[str, Any], dotted_key: str) -> list[str] | None:
    raw = form.get(dotted_key)
    if raw is None:
        return None
    return [p.strip() for p in str(raw).split(",") if p.strip()]


def merge_fqdn_host_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    if not isinstance(out, dict):
        raise ValueError("Invalid base payload")
    name = _form_str(form, "name", "Name")
    if name:
        out["Name"] = name
    _overlay_description(out, form)
    fqdn = _form_str(form, "fqdn", "FQDN")
    if fqdn:
        out["FQDN"] = fqdn
    raw_g = form.get("fqdn_host_groups")
    if raw_g is None:
        raw_g = _split_csv_field(form, "FQDNHostGroupList.FQDNHostGroup")
    if raw_g is not None:
        if not isinstance(raw_g, list):
            raw_g = []
        cleaned = [str(x).strip() for x in raw_g if str(x).strip()]
        out.pop("FQDNHostGroupList", None)
        if len(cleaned) == 1:
            out["FQDNHostGroupList"] = {"FQDNHostGroup": cleaned[0]}
        elif len(cleaned) > 1:
            out["FQDNHostGroupList"] = {"FQDNHostGroup": cleaned}
        else:
            out["FQDNHostGroupList"] = None
    return out


def _service_detail_from_row(row: Mapping[str, Any]) -> dict[str, Any]:
    d: dict[str, Any] = {}
    proto = str(row.get("protocol") or "").strip().upper()
    if proto in ("TCP", "UDP"):
        d["Protocol"] = proto
        sp = str(row.get("source_port") or "").strip() or "1:65535"
        dp = str(row.get("dest_port") or "").strip()
        d["SourcePort"] = sp
        if dp:
            d["DestinationPort"] = dp
    return d


def _service_detail_ip_icmp(row: Mapping[str, Any], *, icmpv6: bool) -> dict[str, Any]:
    if icmpv6:
        t = str(row.get("icmp_type") or "").strip()
        c = str(row.get("icmp_code") or "").strip()
        d: dict[str, Any] = {}
        if t:
            d["ICMPType"] = t
        if c:
            d["ICMPCode"] = c
        return d
    pn = str(row.get("protocol_name") or "").strip()
    if pn:
        return {"ProtocolName": pn}
    t = str(row.get("icmp_type") or "").strip()
    c = str(row.get("icmp_code") or "").strip()
    d = {}
    if t:
        d["ICMPType"] = t
    if c:
        d["ICMPCode"] = c
    return d


def merge_service_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    if not isinstance(out, dict):
        raise ValueError("Invalid base payload")
    name = _form_str(form, "name", "Name")
    if name:
        out["Name"] = name
    _overlay_description(out, form)
    ui = str(form.get("service_type_ui") or "").strip().lower()
    if not ui:
        st_flat = _form_str(form, "Type")
        ui = _SERVICE_TYPE_TO_UI.get(st_flat, "").lower()
    sophos_type = _SERVICE_UI_TO_TYPE.get(ui)
    if sophos_type:
        out["Type"] = sophos_type
    rows = form.get("service_detail_rows")
    if not isinstance(rows, list):
        rows = []
    if not rows:
        rows = _service_detail_rows_from_flat_form(form)
    st = str(out.get("Type") or "").strip()
    details: list[dict[str, Any]] = []
    if st == "TCPorUDP":
        for r in rows:
            if not isinstance(r, dict):
                continue
            one = _service_detail_from_row(r)
            if one:
                details.append(one)
        if not details:
            details.append(
                {"Protocol": "TCP", "SourcePort": "1:65535", "DestinationPort": ""}
            )
    elif st == "IP":
        for r in rows:
            if not isinstance(r, dict):
                continue
            pn = str(r.get("protocol_name") or "").strip()
            if pn:
                details.append({"ProtocolName": pn})
        if not details:
            details.append({"ProtocolName": ""})
    elif st == "ICMP":
        for r in rows:
            if isinstance(r, dict):
                d = _service_detail_ip_icmp(r, icmpv6=False)
                if d:
                    details.append(d)
        if not details:
            details.append({"ICMPType": "", "ICMPCode": "Any Code"})
    elif st == "ICMPv6":
        for r in rows:
            if isinstance(r, dict):
                d = _service_detail_ip_icmp(r, icmpv6=True)
                if d:
                    details.append(d)
        if not details:
            details.append({"ICMPType": "", "ICMPCode": ""})
    if details:
        if len(details) == 1:
            out["ServiceDetails"] = {"ServiceDetail": details[0]}
        else:
            out["ServiceDetails"] = {"ServiceDetail": details}
    return out


def merge_mac_host_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    if not isinstance(out, dict):
        raise ValueError("Invalid base payload")
    name = _form_str(form, "name", "Name")
    if name:
        out["Name"] = name
    _overlay_description(out, form)
    ui = str(form.get("mac_host_type_ui") or "").strip().lower()
    if not ui:
        mt = _form_str(form, "Type")
        if mt == "MACAddress":
            ui = "macaddress"
        elif mt == "MACList":
            ui = "maclist"
    if ui == "macaddress":
        out["Type"] = "MACAddress"
        out.pop("MACList", None)
        mac = _form_str(form, "mac_address", "MACAddress")
        if mac:
            out["MACAddress"] = mac
        else:
            out.pop("MACAddress", None)
    elif ui == "maclist":
        out["Type"] = "MACList"
        out.pop("MACAddress", None)
        raw = str(form.get("mac_list") or "").replace("\n", ",")
        if not raw.strip():
            csv_m = _split_csv_field(form, "MACList.MAC")
            if csv_m is not None:
                raw = ",".join(csv_m)
        parts = [p.strip() for p in raw.split(",") if p.strip()]
        if parts:
            if len(parts) == 1:
                out["MACList"] = {"MAC": parts[0]}
            else:
                out["MACList"] = {"MAC": parts}
        else:
            out["MACList"] = None
    return out


def merge_ip_hostgroup_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    if not isinstance(out, dict):
        raise ValueError("Invalid base payload")
    name = _form_str(form, "name", "Name")
    if name:
        out["Name"] = name
    _overlay_description(out, form)
    raw_h = form.get("member_hosts")
    if raw_h is None:
        raw_h = _split_csv_field(form, "HostList.Host")
    if raw_h is not None:
        if not isinstance(raw_h, list):
            raw_h = []
        cleaned = [str(x).strip() for x in raw_h if str(x).strip()]
        out.pop("HostList", None)
        if len(cleaned) == 1:
            out["HostList"] = {"Host": cleaned[0]}
        elif len(cleaned) > 1:
            out["HostList"] = {"Host": cleaned}
    return out


def merge_fqdn_hostgroup_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    if not isinstance(out, dict):
        raise ValueError("Invalid base payload")
    name = _form_str(form, "name", "Name")
    if name:
        out["Name"] = name
    _overlay_description(out, form)
    raw_h = form.get("member_hosts")
    if raw_h is None:
        raw_h = _split_csv_field(form, "FQDNHostList.FQDNHost")
    if raw_h is not None:
        if not isinstance(raw_h, list):
            raw_h = []
        cleaned = [str(x).strip() for x in raw_h if str(x).strip()]
        out.pop("FQDNHostList", None)
        if len(cleaned) == 1:
            out["FQDNHostList"] = {"FQDNHost": cleaned[0]}
        elif len(cleaned) > 1:
            out["FQDNHostList"] = {"FQDNHost": cleaned}
    return out


def merge_service_group_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    if not isinstance(out, dict):
        raise ValueError("Invalid base payload")
    name = _form_str(form, "name", "Name")
    if name:
        out["Name"] = name
    _overlay_description(out, form)
    raw_h = form.get("member_services")
    if raw_h is None:
        raw_h = _split_csv_field(form, "ServiceList.Service")
    if raw_h is not None:
        if not isinstance(raw_h, list):
            raw_h = []
        cleaned = [str(x).strip() for x in raw_h if str(x).strip()]
        out.pop("ServiceList", None)
        if len(cleaned) == 1:
            out["ServiceList"] = {"Service": cleaned[0]}
        elif len(cleaned) > 1:
            out["ServiceList"] = {"Service": cleaned}
    return out


def merge_country_group_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    if not isinstance(out, dict):
        raise ValueError("Invalid base payload")
    name = _form_str(form, "name", "Name")
    if name:
        out["Name"] = name
    _overlay_description(out, form)
    raw_c = form.get("countries")
    if raw_c is None:
        raw_c = _split_csv_field(form, "CountryList.Country")
    if raw_c is not None:
        if not isinstance(raw_c, list):
            raw_c = []
        cleaned = [str(x).strip() for x in raw_c if str(x).strip()]
        out.pop("CountryList", None)
        if len(cleaned) == 1:
            out["CountryList"] = {"Country": cleaned[0]}
        elif len(cleaned) > 1:
            out["CountryList"] = {"Country": cleaned}
    return out


# ---------------------------------------------------------------------------
# Helpers shared by the new entity merges (Routing / Authentication / Admin).
# ---------------------------------------------------------------------------


def _overlay_scalar(
    out: dict[str, Any],
    form: Mapping[str, Any],
    *,
    field: str,
    aliases: tuple[str, ...] = (),
    blank_clears: bool = False,
) -> None:
    """Overlay a single scalar value from form into out[field].

    The form may use the schema name (``field``) or any of the given lower-cased
    ``aliases`` (e.g. ``"description"`` for the ``Description`` field).  When
    ``blank_clears`` is True, an empty value writes ``None`` rather than being
    skipped, mirroring how Description is treated by Hosts/Services merges.
    """
    keys: tuple[str, ...] = (field, *aliases)
    present = any(k in form for k in keys)
    if not present:
        return
    raw_value: Any = None
    for k in keys:
        if k in form:
            raw_value = form.get(k)
            break
    if raw_value is None:
        if blank_clears:
            out[field] = None
        return
    s = str(raw_value).strip()
    if not s:
        if blank_clears:
            out[field] = None
        return
    out[field] = s


def _form_list_field(
    form: Mapping[str, Any], primary_key: str, *flat_keys: str
) -> list[str] | None:
    """Pull a list from form[primary_key] or one of the flat ``a.b`` CSV keys.

    Returns ``None`` if no key was present (caller should leave field alone).
    Returns a possibly-empty list of cleaned strings otherwise.
    """
    if primary_key in form:
        raw = form.get(primary_key)
        if raw is None:
            return []
        if isinstance(raw, str):
            parts = [p.strip() for p in raw.split(",") if p.strip()]
            return parts
        if isinstance(raw, list):
            return [str(x).strip() for x in raw if str(x).strip()]
        return []
    for fk in flat_keys:
        v = _split_csv_field(form, fk)
        if v is not None:
            return v
    return None


def _form_repeating_rows(
    form: Mapping[str, Any], primary_key: str
) -> list[dict[str, Any]] | None:
    """Pull a list of dict rows from form[primary_key] (already structured).

    Returns ``None`` when the key was not provided so the caller can keep the
    base value unchanged.  Returns ``[]`` to clear the group.
    """
    if primary_key not in form:
        return None
    raw = form.get(primary_key)
    if raw is None:
        return []
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for row in raw:
        if isinstance(row, dict):
            out.append({str(k): row[k] for k in row})
    return out


def _wrap_repeating(items: list[dict[str, Any]], child_tag: str) -> dict[str, Any] | None:
    """Wrap a list of dicts as ``{child_tag: ...}`` for xmltodict (single vs list)."""
    cleaned = [r for r in items if any(str(v).strip() for v in r.values() if v is not None)]
    if not cleaned:
        return None
    if len(cleaned) == 1:
        return {child_tag: cleaned[0]}
    return {child_tag: cleaned}


# ---------------------------------------------------------------------------
# Routing : Unicast Route  (XML root <UnicastRoute>)
# ---------------------------------------------------------------------------

_UNICAST_ROUTE_SCALARS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("IPFamily", ("ip_family",)),
    ("Status", ("status",)),
    ("DestinationIP", ("destination_ip",)),
    ("Netmask", ("netmask",)),
    ("Gateway", ("gateway",)),
    ("Interface", ("interface",)),
    ("Distance", ("distance",)),
    ("AdministrativeDistance", ("administrative_distance",)),
    ("Blackhole", ("blackhole",)),
)


def merge_unicast_route_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    """Apply Unicast Route flyout edits onto a cached <UnicastRoute> payload."""
    out = copy.deepcopy(base) if isinstance(base, dict) else {}
    for field, aliases in _UNICAST_ROUTE_SCALARS:
        _overlay_scalar(out, form, field=field, aliases=aliases)
    _overlay_description(out, form)
    return out


# ---------------------------------------------------------------------------
# Routing : Gateway  (XML root <Gateway>; pushed inside <GatewayConfiguration>)
# ---------------------------------------------------------------------------

_GATEWAY_SCALARS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Name", ("name",)),
    ("IPFamily", ("ip_family",)),
    ("IPAddress", ("ip_address",)),
    ("Type", ("type",)),
    ("Weight", ("weight",)),
    ("DefaultGateway", ("default_gateway",)),
)

_GATEWAY_FAILOVER_SUBFIELDS: tuple[str, ...] = (
    "Protocol",
    "IPAddress",
    "Port",
    "Condition",
)


def _normalize_gateway_failover_rule(row: Mapping[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for sf in _GATEWAY_FAILOVER_SUBFIELDS:
        if sf in row and row[sf] is not None:
            s = str(row[sf]).strip()
            if s:
                out[sf] = s
    return out


def merge_gateway_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    """Apply Gateway flyout edits onto a cached <Gateway> payload."""
    out = copy.deepcopy(base) if isinstance(base, dict) else {}
    for field, aliases in _GATEWAY_SCALARS:
        _overlay_scalar(out, form, field=field, aliases=aliases)
    rows = _form_repeating_rows(form, "fail_over_rules")
    if rows is None:
        rows = _form_repeating_rows(form, "FailOverRules")
    if rows is not None:
        cleaned = [_normalize_gateway_failover_rule(r) for r in rows]
        wrapped = _wrap_repeating(cleaned, "Rule")
        if wrapped is None:
            out["FailOverRules"] = None
        else:
            out["FailOverRules"] = wrapped
    return out


# ---------------------------------------------------------------------------
# Routing : Custom Gateway / GatewayHost  (XML root <GatewayHost>)
# ---------------------------------------------------------------------------

_GATEWAY_HOST_SCALARS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Name", ("name",)),
    ("IPFamily", ("ip_family",)),
    ("GatewayIP", ("gateway_ip",)),
    ("Interface", ("interface",)),
    ("NetworkZone", ("network_zone",)),
    ("Healthcheck", ("healthcheck",)),
    ("MailNotification", ("mail_notification",)),
    ("Interval", ("interval",)),
    ("FailureRetries", ("failure_retries",)),
    ("Timeout", ("timeout",)),
)

_GATEWAY_HOST_MONITORING_SUBFIELDS: tuple[str, ...] = (
    "Protocol",
    "Port",
    "IPAddress",
    "Condition",
)


def _normalize_gateway_host_rule(row: Mapping[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for sf in _GATEWAY_HOST_MONITORING_SUBFIELDS:
        if sf in row and row[sf] is not None:
            s = str(row[sf]).strip()
            if s:
                out[sf] = s
    return out


def merge_gateway_host_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    """Apply Custom Gateway flyout edits onto a cached <GatewayHost> payload."""
    out = copy.deepcopy(base) if isinstance(base, dict) else {}
    for field, aliases in _GATEWAY_HOST_SCALARS:
        _overlay_scalar(out, form, field=field, aliases=aliases)
    rows = _form_repeating_rows(form, "monitoring_condition")
    if rows is None:
        rows = _form_repeating_rows(form, "MonitoringCondition")
    if rows is not None:
        cleaned = [_normalize_gateway_host_rule(r) for r in rows]
        wrapped = _wrap_repeating(cleaned, "Rule")
        if wrapped is None:
            out["MonitoringCondition"] = None
        else:
            out["MonitoringCondition"] = wrapped
    return out


# ---------------------------------------------------------------------------
# Authentication : Clientless User  (XML root <ClientlessUser>)
# ---------------------------------------------------------------------------

_CLIENTLESS_USER_SCALARS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Name", ("name",)),
    ("UserName", ("user_name", "username")),
    ("IPAddress", ("ip_address",)),
    ("ClientLessGroup", ("client_less_group", "clientless_group")),
    ("Email", ("email",)),
    ("Status", ("status",)),
    ("QuarantineDigest", ("quarantine_digest",)),
    ("QoSPolicy", ("qos_policy",)),
)


def merge_clientless_user_form(
    base: dict[str, Any], form: Mapping[str, Any]
) -> dict[str, Any]:
    """Apply Clientless User flyout edits onto a cached <ClientlessUser> payload."""
    out = copy.deepcopy(base) if isinstance(base, dict) else {}
    for field, aliases in _CLIENTLESS_USER_SCALARS:
        _overlay_scalar(out, form, field=field, aliases=aliases)
    _overlay_description(out, form)
    return out


# ---------------------------------------------------------------------------
# Administration : Local Service ACL  (entity_type ``acl_rule``, XML <LocalServiceACL>)
# ---------------------------------------------------------------------------

_LOCAL_SERVICE_ACL_SCALARS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("RuleName", ("rule_name", "name")),
    ("IPFamily", ("ip_family",)),
    ("SourceZone", ("source_zone",)),
    ("Action", ("action",)),
)


def merge_local_service_acl_form(
    base: dict[str, Any], form: Mapping[str, Any]
) -> dict[str, Any]:
    """Apply Local Service ACL flyout edits onto a cached <LocalServiceACL> payload.

    The form carries three list-style fields that are merged into one ``Hosts``
    block (``Host`` for source, ``DstHost`` for destination) and a ``Services``
    block, matching what xmltodict expects.
    """
    out = copy.deepcopy(base) if isinstance(base, dict) else {}
    for field, aliases in _LOCAL_SERVICE_ACL_SCALARS:
        _overlay_scalar(out, form, field=field, aliases=aliases)
    _overlay_description(out, form)

    src_hosts = _form_list_field(form, "source_hosts", "Hosts.Host")
    dst_hosts = _form_list_field(form, "dst_hosts", "Hosts.DstHost")
    if src_hosts is not None or dst_hosts is not None:
        existing_hosts = out.get("Hosts") if isinstance(out.get("Hosts"), dict) else {}
        if src_hosts is None:
            current = existing_hosts.get("Host") if isinstance(existing_hosts, dict) else None
            src_hosts = (
                [current] if isinstance(current, str) and current.strip() else
                ([str(x).strip() for x in current if str(x).strip()] if isinstance(current, list) else [])
            )
        if dst_hosts is None:
            current = existing_hosts.get("DstHost") if isinstance(existing_hosts, dict) else None
            dst_hosts = (
                [current] if isinstance(current, str) and current.strip() else
                ([str(x).strip() for x in current if str(x).strip()] if isinstance(current, list) else [])
            )
        host_block: dict[str, Any] = {}
        if src_hosts:
            host_block["Host"] = src_hosts[0] if len(src_hosts) == 1 else src_hosts
        if dst_hosts:
            host_block["DstHost"] = dst_hosts[0] if len(dst_hosts) == 1 else dst_hosts
        out["Hosts"] = host_block if host_block else None

    services = _form_list_field(form, "services", "Services.Service")
    if services is not None:
        if not services:
            out["Services"] = None
        elif len(services) == 1:
            out["Services"] = {"Service": services[0]}
        else:
            out["Services"] = {"Service": services}
    return out


# ---------------------------------------------------------------------------
# Network : DHCP Server (IPv4)  (XML root <DHCPServer>)
# Network : DHCP Server (IPv6)  (XML root <DHCPServerIpv6>)
# Network : DHCP Relay          (XML root <DHCPRelay>)
# ---------------------------------------------------------------------------

_DHCP_SERVER_SCALARS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Name", ("name",)),
    ("Interface", ("interface",)),
    ("UseInterfaceIPasGateway", ("use_interface_ip_as_gateway",)),
    ("SubnetMask", ("subnet_mask",)),
    ("DomainName", ("domain_name",)),
    ("Gateway", ("gateway",)),
    ("DefaultLeaseTime", ("default_lease_time",)),
    ("MaxLeaseTime", ("max_lease_time",)),
    ("ConflictDetection", ("conflict_detection",)),
    ("UseApplianceDNSSettings", ("use_appliance_dns_settings",)),
    ("PrimaryDNSServer", ("primary_dns_server",)),
    ("SecondaryDNSServer", ("secondary_dns_server",)),
    ("PrimaryWINSServer", ("primary_wins_server",)),
    ("SecondaryWINSServer", ("secondary_wins_server",)),
    ("BootServer", ("boot_server",)),
    ("BootFile", ("boot_file",)),
    ("LeaseForRelay", ("lease_for_relay",)),
)

_DHCP_STATIC_LEASE_V4_SUBFIELDS: tuple[str, ...] = ("HostName", "MACAddress", "IPAddress")
_DHCP_STATIC_LEASE_V6_SUBFIELDS: tuple[str, ...] = ("HostName", "DUID", "IPAddress")
_DHCP_OPTION_SUBFIELDS: tuple[str, ...] = (
    "OptionName",
    "OptionType",
    "OptionCode",
    "OptionValue",
)


def _normalize_keyed_row(
    row: Mapping[str, Any], subfields: tuple[str, ...]
) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for sf in subfields:
        if sf in row and row[sf] is not None:
            s = str(row[sf]).strip()
            if s:
                out[sf] = s
    return out


def _apply_iplease_block(out: dict[str, Any], form: Mapping[str, Any]) -> None:
    """Overlay the ``<IPLease>`` block (list of ``<IP>start-end</IP>`` ranges)."""
    ranges = _form_list_field(form, "ip_lease", "IPLease.IP")
    if ranges is None:
        return
    if not ranges:
        out["IPLease"] = None
        return
    if len(ranges) == 1:
        out["IPLease"] = {"IP": ranges[0]}
    else:
        out["IPLease"] = {"IP": ranges}


def _apply_static_lease_block(
    out: dict[str, Any], form: Mapping[str, Any], *, subfields: tuple[str, ...]
) -> None:
    """Overlay ``<StaticLease><Lease>...</Lease>...</StaticLease>``."""
    rows = _form_repeating_rows(form, "static_lease")
    if rows is None:
        rows = _form_repeating_rows(form, "StaticLease")
    if rows is None:
        return
    cleaned = [_normalize_keyed_row(r, subfields) for r in rows]
    cleaned = [r for r in cleaned if r]
    if not cleaned:
        out["StaticLease"] = None
        return
    out["StaticLease"] = {"Lease": cleaned[0] if len(cleaned) == 1 else cleaned}


def _apply_dhcp_options_block(out: dict[str, Any], form: Mapping[str, Any]) -> None:
    """Overlay ``<DHCPOption><Options>...</Options>...</DHCPOption>``."""
    rows = _form_repeating_rows(form, "dhcp_options")
    if rows is None:
        rows = _form_repeating_rows(form, "DHCPOption")
    if rows is None:
        return
    cleaned = [_normalize_keyed_row(r, _DHCP_OPTION_SUBFIELDS) for r in rows]
    cleaned = [r for r in cleaned if r]
    if not cleaned:
        out["DHCPOption"] = None
        return
    out["DHCPOption"] = {"Options": cleaned[0] if len(cleaned) == 1 else cleaned}


def merge_dhcp_server_form(
    base: dict[str, Any], form: Mapping[str, Any]
) -> dict[str, Any]:
    """Apply IPv4 DHCP Server flyout edits onto a cached <DHCPServer> payload."""
    out = copy.deepcopy(base) if isinstance(base, dict) else {}
    for field, aliases in _DHCP_SERVER_SCALARS:
        _overlay_scalar(out, form, field=field, aliases=aliases)
    _apply_iplease_block(out, form)
    _apply_static_lease_block(out, form, subfields=_DHCP_STATIC_LEASE_V4_SUBFIELDS)
    _apply_dhcp_options_block(out, form)
    return out


_DHCP_SERVER_IPV6_SCALARS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Name", ("name",)),
    ("Interface", ("interface",)),
    ("PreferredTime", ("preferred_time", "preferredtime")),
    ("ValidTime", ("valid_time", "validtime")),
    ("UseApplianceDNSSettings", ("use_appliance_dns_settings",)),
    ("primarydnsv6", ("primary_dns_v6", "primarydnsv6")),
    ("secondarydnsv6", ("secondary_dns_v6", "secondarydnsv6")),
    ("LeaseForRelay", ("lease_for_relay",)),
)


def merge_dhcp_server_ipv6_form(
    base: dict[str, Any], form: Mapping[str, Any]
) -> dict[str, Any]:
    """Apply IPv6 DHCP Server flyout edits onto a cached <DHCPServerIpv6> payload."""
    out = copy.deepcopy(base) if isinstance(base, dict) else {}
    for field, aliases in _DHCP_SERVER_IPV6_SCALARS:
        _overlay_scalar(out, form, field=field, aliases=aliases)
    _apply_iplease_block(out, form)
    _apply_static_lease_block(out, form, subfields=_DHCP_STATIC_LEASE_V6_SUBFIELDS)
    _apply_dhcp_options_block(out, form)
    return out


_DHCP_RELAY_SCALARS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Name", ("name",)),
    ("IPFamily", ("ip_family",)),
    ("Interface", ("interface",)),
    ("RelaythroughIPSec", ("relay_through_ipsec",)),
)


def merge_dhcp_relay_form(
    base: dict[str, Any], form: Mapping[str, Any]
) -> dict[str, Any]:
    """Apply DHCP Relay flyout edits onto a cached <DHCPRelay> payload.

    ``DHCPServerIP`` is a repeating top-level child (not wrapped in a parent
    block), so we overlay it as a list directly.
    """
    out = copy.deepcopy(base) if isinstance(base, dict) else {}
    for field, aliases in _DHCP_RELAY_SCALARS:
        _overlay_scalar(out, form, field=field, aliases=aliases)
    server_ips = _form_list_field(form, "dhcp_server_ip", "DHCPServerIP")
    if server_ips is not None:
        if not server_ips:
            out["DHCPServerIP"] = None
        elif len(server_ips) == 1:
            out["DHCPServerIP"] = server_ips[0]
        else:
            out["DHCPServerIP"] = server_ips
    return out


# ---------------------------------------------------------------------------
# Protect · Firewall : Firewall rule  (XML root <FirewallRule>)
#
# Spec: xml-api-docs/Protect/Firewall/FirewallRule.md.  Three policy variants
# under <PolicyType>:
#   - User       -> body lives inside <UserPolicy>
#   - Network    -> body lives inside <NetworkPolicy>
#   - HTTPBased  -> Web Application Firewall (WAF).  Round-tripping the full
#                   WAF body via this flyout is unsafe; we preserve the raw
#                   <HTTPBasedPolicy> block from base verbatim and allow only
#                   top-level Status / IPFamily / Position / Description /
#                   Section edits, mirroring the firewall-config-viewer's
#                   ``disableEdit: PolicyType === 'HTTPBased'`` precedent.
# Reorder semantics (Position + After/Before) are honoured here AS WELL AS by
# the bespoke ``enqueue_firewall_rule_reorder_batch`` task path.  Edits that
# only change the rule's neighbour go through the bespoke reorder path; full
# add/edit/delete with body changes go through the HS pipeline that calls
# this merger.
# ---------------------------------------------------------------------------

_FW_RULE_TOP_SCALARS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Name", ("name",)),
    ("Status", ("status",)),
    ("IPFamily", ("ip_family",)),
    ("PolicyType", ("policy_type",)),
    ("Section", ("section",)),
)

# Scalar fields that live inside the active <UserPolicy> / <NetworkPolicy>
# block.  Form keys may use the schema name verbatim or a snake_case alias.
_FW_POLICY_SCALARS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Action", ("action",)),
    ("LogTraffic", ("log_traffic",)),
    ("SkipLocalDestined", ("skip_local_destined",)),
    ("Schedule", ("schedule",)),
    ("MatchIdentity", ("match_identity",)),
    ("ShowCaptivePortal", ("show_captive_portal",)),
    ("DataAccounting", ("data_accounting",)),
    ("WebFilter", ("web_filter",)),
    ("WebCategoryBaseQoSPolicy", ("web_category_base_qos_policy",)),
    ("BlockQuickQuic", ("block_quick_quic",)),
    ("ScanVirus", ("scan_virus",)),
    ("ZeroDayProtection", ("zero_day_protection",)),
    ("ScanFTP", ("scan_ftp",)),
    ("ProxyMode", ("proxy_mode",)),
    ("DecryptHTTPS", ("decrypt_https",)),
    ("ApplicationControl", ("application_control",)),
    ("ApplicationBaseQoSPolicy", ("application_base_qos_policy",)),
    ("IntrusionPrevention", ("intrusion_prevention",)),
    ("NDRActiveThreatIntelligence", ("ndr_active_threat_intelligence",)),
    ("TrafficShappingPolicy", ("traffic_shapping_policy", "traffic_shaping_policy")),
    ("DSCPMarking", ("dscp_marking",)),
    ("ScanSMTP", ("scan_smtp",)),
    ("ScanSMTPS", ("scan_smtps",)),
    ("ScanIMAP", ("scan_imap",)),
    ("ScanIMAPS", ("scan_imaps",)),
    ("ScanPOP3", ("scan_pop3",)),
    ("ScanPOP3S", ("scan_pop3s",)),
    ("SourceSecurityHeartbeat", ("source_security_heartbeat",)),
    ("MinimumSourceHBPermitted", ("minimum_source_hb_permitted",)),
    ("DestSecurityHeartbeat", ("dest_security_heartbeat",)),
    ("MinimumDestinationHBPermitted", ("minimum_destination_hb_permitted",)),
    ("RewriteSourceAddress", ("rewrite_source_address",)),
    ("PrimaryGateway", ("primary_gateway",)),
    ("BackupGateway", ("backup_gateway",)),
)

# Repeating list-of-strings members under each policy block.  Each tuple is
# (form_key, snake_alias, container_tag, child_tag).
_FW_POLICY_LISTS: tuple[tuple[str, str, str, str], ...] = (
    ("source_zones", "SourceZones", "SourceZones", "Zone"),
    ("destination_zones", "DestinationZones", "DestinationZones", "Zone"),
    ("source_networks", "SourceNetworks", "SourceNetworks", "Network"),
    ("destination_networks", "DestinationNetworks", "DestinationNetworks", "Network"),
    ("services", "Services", "Services", "Service"),
    ("identity", "Identity", "Identity", "Member"),
)


def _wrap_string_list(values: list[str], child_tag: str) -> dict[str, Any] | None:
    cleaned = [str(v).strip() for v in values if str(v).strip()]
    if not cleaned:
        return None
    if len(cleaned) == 1:
        return {child_tag: cleaned[0]}
    return {child_tag: cleaned}


def _apply_position_overlay(out: dict[str, Any], form: Mapping[str, Any]) -> None:
    """Translate form's ``InsertPosition`` / ``InsertAfterRule`` / ``InsertBeforeRule``
    to the canonical XML shape (``Position`` + optional ``After`` / ``Before`` blocks).

    The bulk-add CSV uses ``Position`` directly with values like ``Top`` /
    ``Bottom`` / ``After:<RuleName>`` (matching the firewall-config-viewer
    schema); the flyout uses ``InsertPosition`` (``Top`` / ``Bottom`` /
    ``After`` / ``Before``) plus a separate target-name field.  Both shapes
    land in the same canonical XML.
    """
    insert_pos_keys = ("InsertPosition", "insert_position", "Position", "position")
    if not any(k in form for k in insert_pos_keys):
        return
    raw = ""
    for k in insert_pos_keys:
        if k in form and form.get(k) is not None:
            raw = str(form.get(k)).strip()
            break
    if not raw:
        return
    target = ""
    after_keys = ("InsertAfterRule", "insert_after_rule", "AfterName", "after_name")
    before_keys = ("InsertBeforeRule", "insert_before_rule", "BeforeName", "before_name")
    if raw.lower().startswith("after:"):
        target = raw[6:].strip()
        raw = "After"
    elif raw.lower().startswith("before:"):
        target = raw[7:].strip()
        raw = "Before"
    else:
        for k in after_keys:
            if k in form and form.get(k) is not None:
                if str(form.get(k)).strip():
                    target = str(form.get(k)).strip()
                break
        if not target:
            for k in before_keys:
                if k in form and form.get(k) is not None:
                    if str(form.get(k)).strip():
                        target = str(form.get(k)).strip()
                    break
    canonical = raw.capitalize()
    if canonical not in ("Top", "Bottom", "After", "Before"):
        return
    out["Position"] = canonical
    if canonical == "After" and target:
        out["After"] = {"Name": target}
        out.pop("Before", None)
    elif canonical == "Before" and target:
        out["Before"] = {"Name": target}
        out.pop("After", None)
    else:
        out.pop("After", None)
        out.pop("Before", None)


def _apply_policy_block(
    out: dict[str, Any], form: Mapping[str, Any], *, policy_tag: str
) -> None:
    """Overlay scalars + list members into out[policy_tag], leaving the block
    unchanged when no relevant form keys are present.

    The base payload may already contain a different policy block (e.g. user
    flipped from Network to User); in that case we move whatever fields the
    form provides into the new block but preserve the *other* block as-is so
    a future edit can flip back without losing data.
    """
    block_existing = out.get(policy_tag)
    if isinstance(block_existing, list) and block_existing:
        block_existing = block_existing[0]
    if not isinstance(block_existing, dict):
        block_existing = {}
    block = copy.deepcopy(block_existing)

    touched = False
    for field, aliases in _FW_POLICY_SCALARS:
        keys = (field, *aliases)
        if any(k in form for k in keys):
            touched = True
            _overlay_scalar(block, form, field=field, aliases=aliases, blank_clears=False)

    if "description" in form or "Description" in form:
        raw = form.get("description") if "description" in form else form.get("Description")
        block["Description"] = _blank_desc(str(raw or ""))
        touched = True

    for primary, snake, container, child in _FW_POLICY_LISTS:
        values = _form_list_field(form, primary, f"{snake}.{child}")
        if values is None and snake != primary:
            values = _form_list_field(form, snake, f"{snake}.{child}")
        if values is None:
            continue
        touched = True
        wrapped = _wrap_string_list(values, child)
        if wrapped is None:
            block[container] = None
        else:
            block[container] = wrapped

    if touched:
        out[policy_tag] = block


def merge_firewall_rule_form(
    base: dict[str, Any], form: Mapping[str, Any]
) -> dict[str, Any]:
    """Apply Firewall Rule flyout edits onto a cached <FirewallRule> payload.

    The merger is policy-type aware:
    - For User / Network rules it overlays scalars + list members into the
      correct <UserPolicy> or <NetworkPolicy> block.
    - For HTTPBased (WAF) rules it preserves the <HTTPBasedPolicy> block
      verbatim from base and only allows top-level Status / Position /
      Description / Section / IPFamily edits.  This mirrors the
      firewall-config-viewer's editor disableEdit precedent because WAF
      payloads are not safely round-trippable through a generic flyout.

    Position changes (Top / Bottom / After / Before) are translated to the
    canonical <Position> + optional <After><Name> / <Before><Name> shape.

    The returned dict is a **deep copy** of base with the overlay applied —
    no in-place mutation of the cached payload.
    """
    out = copy.deepcopy(base) if isinstance(base, dict) else {}
    for field, aliases in _FW_RULE_TOP_SCALARS:
        _overlay_scalar(out, form, field=field, aliases=aliases)
    if "description" in form or "Description" in form:
        # Top-level Description is preserved on FirewallRule even though some
        # firmware also accepts it inside the policy block; xml-api-docs shows
        # it at the top level so we mirror that.
        raw = form.get("description") if "description" in form else form.get("Description")
        out["Description"] = _blank_desc(str(raw or ""))

    _apply_position_overlay(out, form)

    policy_type = str(out.get("PolicyType") or "").strip()
    if not policy_type:
        # Infer from form when base lacks a value.
        policy_type = str(
            form.get("PolicyType") or form.get("policy_type") or "Network"
        ).strip() or "Network"
        out["PolicyType"] = policy_type

    if policy_type == "HTTPBased":
        # WAF payloads stay opaque — we deliberately do not call
        # ``_apply_policy_block`` so the cached <HTTPBasedPolicy> body survives.
        return out

    policy_tag = "UserPolicy" if policy_type == "User" else "NetworkPolicy"
    _apply_policy_block(out, form, policy_tag=policy_tag)
    return out


# ---------------------------------------------------------------------------
# Protect · Firewall : NAT rule  (XML root <NATRule>)
#
# Spec: xml-api-docs/Protect/Firewall/NatRule.md.  All fields live at the top
# level; there are no policy variants.  ``InterfaceNATPolicyList`` is a
# repeating block of <Override> rows used when ``OverrideInterfaceNATPolicy``
# is Enable.
# ---------------------------------------------------------------------------

_NAT_RULE_SCALARS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Name", ("name",)),
    ("Status", ("status",)),
    ("IPFamily", ("ip_family",)),
    ("LinkedFirewallrule", ("linked_firewall_rule", "LinkedFirewallRule")),
    ("TranslatedSource", ("translated_source",)),
    ("TranslatedDestination", ("translated_destination",)),
    ("TranslatedService", ("translated_service",)),
    ("OverrideInterfaceNATPolicy", ("override_interface_nat_policy",)),
    ("LoopbackRule", ("loopback_rule",)),
    ("ReflexiveRule", ("reflexive_rule",)),
)

_NAT_RULE_LIST_MEMBERS: tuple[tuple[str, str, str, str], ...] = (
    ("original_source_networks", "OriginalSourceNetworks", "OriginalSourceNetworks", "Network"),
    (
        "original_destination_networks",
        "OriginalDestinationNetworks",
        "OriginalDestinationNetworks",
        "Network",
    ),
    ("original_services", "OriginalServices", "OriginalServices", "Service"),
    ("inbound_interfaces", "InboundInterfaces", "InboundInterfaces", "Interface"),
    ("outbound_interfaces", "OutboundInterfaces", "OutboundInterfaces", "Interface"),
)

# Subfields per <Override> row inside <InterfaceNATPolicyList>.  Sophos uses
# lower_snake_case subtags here (per xml-api-docs/Protect/Firewall/NatRule.md
# sample) — preserve them verbatim so xmltodict round-trips correctly.
_NAT_RULE_OVERRIDE_SUBFIELDS: tuple[str, ...] = (
    "specific_interface",
    "specific_translatedsourceid",
)


def _normalize_nat_override_row(row: Mapping[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for sf in _NAT_RULE_OVERRIDE_SUBFIELDS:
        if sf in row and row[sf] is not None:
            s = str(row[sf]).strip()
            if s:
                out[sf] = s
    # Tolerate camelCase form input (the JS flyout may post either case).
    camel_aliases = {
        "specificInterface": "specific_interface",
        "specificTranslatedsourceid": "specific_translatedsourceid",
        "SpecificInterface": "specific_interface",
        "SpecificTranslatedSourceId": "specific_translatedsourceid",
    }
    for camel, snake in camel_aliases.items():
        if snake in out:
            continue
        if camel in row and row[camel] is not None:
            s = str(row[camel]).strip()
            if s:
                out[snake] = s
    return out


def _apply_interface_nat_policy_list(out: dict[str, Any], form: Mapping[str, Any]) -> None:
    rows = _form_repeating_rows(form, "interface_nat_policy_overrides")
    if rows is None:
        rows = _form_repeating_rows(form, "InterfaceNATPolicyList")
    if rows is None:
        return
    cleaned = [_normalize_nat_override_row(r) for r in rows]
    cleaned = [r for r in cleaned if r]
    if not cleaned:
        out["InterfaceNATPolicyList"] = None
        return
    if len(cleaned) == 1:
        out["InterfaceNATPolicyList"] = {"Override": cleaned[0]}
    else:
        out["InterfaceNATPolicyList"] = {"Override": cleaned}


def merge_nat_rule_form(
    base: dict[str, Any], form: Mapping[str, Any]
) -> dict[str, Any]:
    """Apply NAT Rule flyout edits onto a cached <NATRule> payload.

    Honours scalar overlay, the five list-of-strings blocks (original src /
    dst networks, original services, inbound / outbound interfaces) and the
    <InterfaceNATPolicyList> repeating <Override> block.  Position semantics
    match merge_firewall_rule_form (Top / Bottom / After / Before).

    Returns a deep copy of base with the overlay applied.
    """
    out = copy.deepcopy(base) if isinstance(base, dict) else {}
    for field, aliases in _NAT_RULE_SCALARS:
        _overlay_scalar(out, form, field=field, aliases=aliases)
    _overlay_description(out, form)
    _apply_position_overlay(out, form)

    for primary, snake, container, child in _NAT_RULE_LIST_MEMBERS:
        values = _form_list_field(form, primary, f"{snake}.{child}")
        if values is None and snake != primary:
            values = _form_list_field(form, snake, f"{snake}.{child}")
        if values is None:
            continue
        wrapped = _wrap_string_list(values, child)
        if wrapped is None:
            out[container] = None
        else:
            out[container] = wrapped

    _apply_interface_nat_policy_list(out, form)
    return out
