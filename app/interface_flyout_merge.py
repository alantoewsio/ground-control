"""Merge Network · Interface / VLAN / Bridge pair / Alias flyout forms into cached SFOS XML payloads.

Interface / VLAN: Interface element (IPv4Configuration, GatewayIP, nested MSS with OverrideMSS, …).

Bridge pair: BridgePair element per SFOS docs (RoutingOnBridgePair, IPAssignType, ARPBroadcast,
nested MSS.Override + MSSValue, PermittedVlansList, IPv6Gateway, …).

Alias: Alias element (Name, Interface, IPFamily, IPv4 IPAddress/Netmask or IPv6/Prefix).
"""

from __future__ import annotations

import copy
import re
import secrets
from typing import Any, Mapping

from app.interface_table import collect_lag_member_names_from_payload

_IPV4_MODE_API = {"static": "Static", "dhcp": "DHCP", "pppoe": "PPPoE"}
_IPV6_MODE_API = {"static": "Static", "dhcp": "DHCP", "delegated": "Delegated"}

# SFOS InterfaceSpeed literals (Advanced Settings).
_UI_TO_INTERFACE_SPEED: dict[str, str] = {
    "Auto Negotiate": "Auto Negotiate",
    "10MbpsFD": "10MbpsFD",
    "100MbpsFD": "100MbpsFD",
    "1000MbpsFD": "1000MbpsFD",
    "10000MbpsFD": "10000MbpsFD",
    # Legacy flyout / table labels → SFOS
    "Automatic": "Auto Negotiate",
    "10 Mbps Full Duplex": "10MbpsFD",
    "100 Mbps Full Duplex": "100MbpsFD",
    "1000 Mbps Full Duplex": "1000MbpsFD",
    "10000 Mbps Full Duplex": "10000MbpsFD",
}

# UI / legacy → SFOS FEC (only: Off, Automatic, BaseR-encoding, RS-FEC-encoding)
_UI_TO_FEC: dict[str, str] = {
    "Off": "Off",
    "Automatic": "Automatic",
    "BaseR-encoding": "BaseR-encoding",
    "RS-FEC-encoding": "RS-FEC-encoding",
    "On": "Automatic",
    "RS-FEC": "RS-FEC-encoding",
}

# Keys we must not send on Set update (read-only or wrong name); live GET keeps them.
_READ_ONLY_OR_ALIAS_KEYS: frozenset[str] = frozenset(
    {
        "Status",
        "LinkMode",
        "Gateway",
        "DefaultGateway",
        "IPv6GatewayName",
        "IPv6Gateway",
        "IPv6PrefixLength",
        "MACAddressOverride",
    }
)


def _ipv4_prefix_len_to_dotted(prefix: int) -> str | None:
    if prefix < 0 or prefix > 32:
        return None
    low = 0 if prefix == 32 else (1 << (32 - prefix)) - 1
    mask = (0xFFFFFFFF ^ low) & 0xFFFFFFFF
    return f"{(mask >> 24) & 255}.{(mask >> 16) & 255}.{(mask >> 8) & 255}.{mask & 255}"


def netmask_display_to_api(s: str) -> str:
    """Normalize flyout netmask: '/24 (255.…)', '/24', '24', or dotted quad → dotted decimal for API."""
    s = (s or "").strip()
    if not s:
        return ""
    if "(" in s and ")" in s:
        inner = s[s.index("(") + 1 : s.index(")")]
        return inner.strip()
    m = re.match(r"^/(\d{1,2})\s*$", s)
    if m:
        p = int(m.group(1))
        dotted = _ipv4_prefix_len_to_dotted(p)
        return dotted if dotted else s
    m2 = re.match(r"^(\d{1,2})\s*$", s)
    if m2:
        p = int(m2.group(1))
        if 0 <= p <= 32:
            dotted = _ipv4_prefix_len_to_dotted(p)
            if dotted:
                return dotted
    return s


def _set_textish(target: dict[str, Any], key: str, value: str | int) -> None:
    cur = target.get(key)
    v = str(value) if value is not None else ""
    if isinstance(cur, dict) and "#text" in cur:
        target[key] = {**cur, "#text": v}
    else:
        target[key] = v


def _mss_block(form: Mapping[str, Any], existing: Any) -> dict[str, Any]:
    override = "Enable" if form.get("mss_override") else "Disable"
    mss_val = str(form.get("mss") or "1460").strip() or "1460"
    base: dict[str, Any]
    if isinstance(existing, dict):
        base = {k: v for k, v in existing.items() if not str(k).startswith("@")}
    else:
        base = {}
    base["OverrideMSS"] = override
    base["MSSValue"] = mss_val
    return base


def merge_interface_flyout_form(
    base: Mapping[str, Any], form: Mapping[str, Any]
) -> dict[str, Any]:
    """
    Deep-copy cached Interface dict and apply flyout fields per SFOS Interface schema.

    Omits read-only/alias keys from output so ``fw.update`` only overwrites valid
    parameters; other XML leaves from the live GET response are left unchanged.
    """
    out: dict[str, Any] = copy.deepcopy(dict(base))

    name = str(form.get("name") or "").strip()
    if name:
        _set_textish(out, "Name", name)

    z = str(form.get("network_zone") or "").strip()
    if not z or z.lower() == "none":
        z = "None"
    _set_textish(out, "NetworkZone", z)

    v4_on = bool(form.get("ipv4_enabled"))
    mode_v4 = str(form.get("ipv4_mode") or "dhcp").lower()
    api_v4 = _IPV4_MODE_API.get(mode_v4, "DHCP")

    _set_textish(out, "IPv4Configuration", "Enable" if v4_on else "Disable")

    if v4_on:
        _set_textish(out, "IPv4Assignment", api_v4)
        if mode_v4 == "static":
            _set_textish(out, "IPAddress", str(form.get("ipv4_ip") or "").strip())
            _set_textish(
                out,
                "Netmask",
                netmask_display_to_api(str(form.get("ipv4_netmask") or "")),
            )
            _set_textish(out, "GatewayName", str(form.get("ipv4_gateway_name") or "").strip())
            _set_textish(out, "GatewayIP", str(form.get("ipv4_gateway_ip") or "").strip())
        elif mode_v4 in ("dhcp", "pppoe"):
            # Do not blank DHCP/PPPoE fields from empty readonly inputs; gateway optional for WAN
            gn = str(form.get("ipv4_gateway_name") or "").strip()
            gi = str(form.get("ipv4_gateway_ip") or "").strip()
            if gn:
                _set_textish(out, "GatewayName", gn)
            if gi:
                _set_textish(out, "GatewayIP", gi)
    else:
        _set_textish(out, "IPv4Assignment", "Static")
        _set_textish(out, "IPAddress", "")
        _set_textish(out, "Netmask", "")
        _set_textish(out, "GatewayName", "")
        _set_textish(out, "GatewayIP", "")

    v6_on = bool(form.get("ipv6_enabled"))
    mode_v6 = str(form.get("ipv6_mode") or "static").lower()
    api_v6 = _IPV6_MODE_API.get(mode_v6, "Static")

    _set_textish(out, "IPv6Configuration", "Enable" if v6_on else "Disable")

    if v6_on:
        _set_textish(out, "IPv6Assignment", api_v6)
        _set_textish(out, "IPv6Address", str(form.get("ipv6_ip") or "").strip())
        _set_textish(out, "Prefix", str(form.get("ipv6_prefix") or "").strip())
        _set_textish(out, "GatewayNameIpv6", str(form.get("ipv6_gateway_name") or "").strip())
        _set_textish(out, "GatewayIPv6", str(form.get("ipv6_gateway_ip") or "").strip())
    else:
        _set_textish(out, "IPv6Assignment", "Static")
        _set_textish(out, "IPv6Address", "")
        _set_textish(out, "Prefix", "")
        _set_textish(out, "GatewayNameIpv6", "")
        _set_textish(out, "GatewayIPv6", "")

    lm_ui = str(form.get("link_mode") or "").strip() or "Auto Negotiate"
    iface_speed = _UI_TO_INTERFACE_SPEED.get(lm_ui, lm_ui)
    _set_textish(out, "InterfaceSpeed", iface_speed)

    # SFOS: AutoNegotiation is integer 0 or 1 (scalar), not Enable/Disable strings.
    auto_on = bool(form.get("auto_negotiation"))
    _set_textish(out, "AutoNegotiation", "1" if auto_on else "0")

    fec_ui = str(form.get("fec") or "Off").strip()
    fec_api = _UI_TO_FEC.get(fec_ui, fec_ui if fec_ui in _UI_TO_FEC.values() else "Off")
    _set_textish(out, "FEC", fec_api)

    mtu = str(form.get("mtu") or "1500").strip() or "1500"
    _set_textish(out, "MTU", mtu)

    out["MSS"] = _mss_block(form, out.get("MSS"))
    out.pop("OverrideMSS", None)

    mac_mode = str(form.get("mac_mode") or "default").lower()
    if mac_mode == "override":
        mac = str(form.get("mac_override") or "").strip()
        if mac:
            _set_textish(out, "MACAddress", mac)
    else:
        _set_textish(out, "MACAddress", "Default")

    for k in _READ_ONLY_OR_ALIAS_KEYS:
        out.pop(k, None)

    return out


_PHY_KEYS_VLAN_PRESERVE: frozenset[str] = frozenset(
    {
        "InterfaceSpeed",
        "AutoNegotiation",
        "FEC",
        "MTU",
        "MSS",
        "MACAddress",
    }
)


def merge_vlan_flyout_form(
    base: Mapping[str, Any], form: Mapping[str, Any]
) -> dict[str, Any]:
    """
    Like merge_interface_flyout_form for VLAN rows, but keep link/MAC/MTU/MSS/FEC from the
    cached base (flyout does not expose Advanced settings for VLAN).
    Optional add-form keys: vlan_id, interface_parent, hardware.
    """
    out = merge_interface_flyout_form(base, form)
    bdict = dict(base)
    for k in _PHY_KEYS_VLAN_PRESERVE:
        if k in bdict:
            out[k] = copy.deepcopy(bdict[k])

    vid = str(form.get("vlan_id") or "").strip()
    if vid:
        _set_textish(out, "VLANID", vid)

    parent = str(form.get("interface_parent") or "").strip()
    if parent:
        _set_textish(out, "Interface", parent)

    hw = str(form.get("hardware") or "").strip()
    if hw:
        _set_textish(out, "Hardware", hw)

    return out


# Bridge pair: UI / legacy keys from gc-net-bridge-pair-flyout.js → SFOS XML API.
# Canonical schema: xml-api-docs / bridge-pair api docs (RoutingOnBridgePair, IPAssignType,
# ARPBroadcast, nested MSS.Override + MSSValue, PermittedVlansList, IPv6Gateway, etc.).
_BRIDGE_FLYOUT_DISCARD: frozenset[str] = frozenset(
    {
        "EnableRoutingOnBridge",
        "RoutingOnBridge",
        "EnableBridgeRouting",
        "BridgeRouting",
        "RoutingEnabled",
        "PermitArpBroadcast",
        "EnableSTP",
        "STPEnabled",
        "SpanningTree",
        "STPMaxAge",
        "STPMaxAgeSeconds",
        "FilterVLANs",
        "PermittedVLANIDs",
        "PermittedVLANId",
        "VLANPermitted",
        "IPv4Assignment",
        "OverrideMSS",
        "MSSOverride",
        "ForwardedEthernetFrameTypes",
        "EthernetFrameTypes",
        "GatewayNameIpv6",
        "GatewayIPv6",
        "IPv6Enabled",
    }
)

# When the flyout leaves IPv6 off, restore these from sync cache (do not inject Static / empty strings).
_BRIDGE_IPV6_RESTORE_FROM_BASE: frozenset[str] = frozenset(
    {
        "IPv6Assignment",
        "IPv6Address",
        "Prefix",
        "IPv6Gateway",
        "Mode",
        "DhcpOnly",
        "AcceptOtherConfigfromDHCP",
        "PrefixDelegation",
        "PrefixPreference",
        "PreferredPrefixAddress",
        "PreferredPrefixLength",
        "DHCPRapidCommit",
        "UpstreamInterface",
        "SubnetAndInterfaceIDs",
        "EnableRA",
        "EnableDHCPv6Server",
        "DADAttempts",
        "AllowedRAServers",
    }
)


def _form_bool(v: Any, default: bool = False) -> bool:
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    if s in ("true", "1", "yes", "on", "enable", "enabled"):
        return True
    if s in ("false", "0", "no", "off", "disable", "disabled"):
        return False
    return default


def _enable_disable_from_bool(on: bool) -> str:
    return "Enable" if on else "Disable"


def _as_enable_disable(v: Any) -> str:
    """Interpret cached API value as Enable/Disable string."""
    if isinstance(v, bool):
        return _enable_disable_from_bool(v)
    s = str(v or "").strip().lower()
    if s in ("enable", "enabled", "true", "1", "yes", "on"):
        return "Enable"
    return "Disable"


def _bridge_routing_canonical_key(base: Mapping[str, Any]) -> str:
    if "RoutingOnBridgePair" in base:
        return "RoutingOnBridgePair"
    for k in (
        "EnableRoutingOnBridge",
        "RoutingOnBridge",
        "EnableBridgeRouting",
        "BridgeRouting",
        "RoutingEnabled",
    ):
        if k in base:
            return k
    return "RoutingOnBridgePair"


def _routing_bool_from_form(form: Mapping[str, Any], base: Mapping[str, Any]) -> bool:
    for fk in (
        "EnableRoutingOnBridge",
        "RoutingOnBridge",
        "EnableBridgeRouting",
        "BridgeRouting",
        "RoutingEnabled",
        "RoutingOnBridgePair",
    ):
        if fk in form:
            return _form_bool(form.get(fk))
    rk = _bridge_routing_canonical_key(base)
    return _as_enable_disable(base.get(rk)) == "Enable"


def _strip_alternate_routing_keys(out: dict[str, Any], keep: str) -> None:
    for k in (
        "RoutingOnBridgePair",
        "EnableRoutingOnBridge",
        "RoutingOnBridge",
        "EnableBridgeRouting",
        "BridgeRouting",
        "RoutingEnabled",
    ):
        if k != keep:
            out.pop(k, None)


def _xml_repeatable_child(parent_tag: str, child_tag: str, values: list[str]) -> dict[str, Any]:
    if not values:
        return {parent_tag: {}}
    if len(values) == 1:
        return {parent_tag: {child_tag: values[0]}}
    return {parent_tag: {child_tag: values}}


def _permitted_vlans_block(form: Mapping[str, Any]) -> dict[str, Any] | None:
    raw = str(form.get("PermittedVLANIDs") or "").strip()
    if not raw:
        return None
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    if not parts:
        return None
    return _xml_repeatable_child("PermittedVlansList", "PermittedVLAN", parts)


def _ether_type_block(eth_raw: str) -> dict[str, Any] | None:
    raw = (eth_raw or "").strip()
    if not raw:
        return None
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    if not parts:
        return None
    return _xml_repeatable_child("EtherTypeList", "EtherType", parts)


def _xml_scalar(node: Any) -> str:
    """Unwrap xmltodict-style ``{\"#text\": \"...\"}`` scalars."""
    if node is None:
        return ""
    if isinstance(node, dict) and "#text" in node:
        return str(node["#text"]).strip()
    return str(node).strip()


def _bridge_mss_existing_dict(existing: Any) -> dict[str, Any]:
    if not isinstance(existing, dict):
        return {}
    return {k: v for k, v in existing.items() if not str(k).startswith("@")}


def _parse_mss_value_int(s: str) -> int | None:
    t = (s or "").strip()
    if not t.isdigit():
        return None
    n = int(t)
    if 536 <= n <= 8960:
        return n
    return None


def _bridge_mss_from_form(form: Mapping[str, Any], existing: Any) -> dict[str, Any]:
    """BridgePair MSS uses Override + MSSValue (not Interface-style OverrideMSS)."""
    ex = _bridge_mss_existing_dict(existing)
    if "OverrideMSS" in form:
        override = "Enable" if _form_bool(form.get("OverrideMSS")) else "Disable"
    else:
        o_raw = ex.get("Override")
        o_str = _xml_scalar(o_raw)
        ol = o_str.lower()
        if ol in ("enable", "enabled"):
            override = "Enable"
        elif ol in ("disable", "disabled", ""):
            override = "Disable"
        else:
            override = "Disable"
    parsed: int | None = None
    if "MSS" in form:
        parsed = _parse_mss_value_int(str(form.get("MSS") or ""))
    if parsed is None:
        parsed = _parse_mss_value_int(_xml_scalar(ex.get("MSSValue")))
    if parsed is None:
        parsed = 1460
    return {"Override": override, "MSSValue": str(parsed)}


def merge_bridge_pair_flyout_form(
    base: Mapping[str, Any], form: Mapping[str, Any]
) -> dict[str, Any]:
    """
    Merge flyout edits into a cached BridgePair payload (Sophos primary key: Hardware).

    Normalizes UI field names and booleans to SFOS strings (Enable/Disable), nested MSS,
    PermittedVlansList / EtherTypeList, IPv6Gateway, and IPAssignType so task queue / API
    updates do not send duplicate or invalid parameters.
    """
    out: dict[str, Any] = copy.deepcopy(dict(base))

    if "Name" in form:
        _set_textish(out, "Name", str(form.get("Name") or "").strip())
    if "Hardware" in form:
        _set_textish(out, "Hardware", str(form.get("Hardware") or "").strip())
    if "Description" in form:
        d = form.get("Description")
        if d is None or str(d).strip() == "":
            out["Description"] = None
        else:
            out["Description"] = str(d).strip()

    rk = _bridge_routing_canonical_key(base)
    out[rk] = _enable_disable_from_bool(_routing_bool_from_form(form, base))
    _strip_alternate_routing_keys(out, rk)

    if "BridgeMembers" in form:
        out["BridgeMembers"] = copy.deepcopy(form["BridgeMembers"])
        out.pop("Interface", None)

    if "IPv4Assignment" in form:
        _set_textish(out, "IPv4Configuration", "Enable")
        mode = str(form.get("IPv4Assignment") or "").strip().upper()
        _set_textish(out, "IPAssignType", "DHCP" if mode == "DHCP" else "Static")
        _set_textish(out, "IPAddress", str(form.get("IPAddress") or "").strip())
        _set_textish(out, "Netmask", netmask_display_to_api(str(form.get("Netmask") or "")))

    if "IPv6Enabled" in form:
        v6_on = _form_bool(form.get("IPv6Enabled"))
        _set_textish(out, "IPv6Configuration", "Enable" if v6_on else "Disable")
        if v6_on:
            raw_mode = str(form.get("IPv6Assignment") or "Static").strip()
            amap = {"static": "Static", "dhcp": "DHCP", "delegated": "Delegated"}
            v6_api = amap.get(raw_mode.lower(), raw_mode)
            if v6_api not in ("Static", "DHCP", "Delegated"):
                v6_api = "Static"
            _set_textish(out, "IPv6Assignment", v6_api)
            _set_textish(out, "IPv6Address", str(form.get("IPv6Address") or "").strip())
            _set_textish(out, "Prefix", str(form.get("Prefix") or "").strip())
            gn = str(form.get("GatewayNameIpv6") or "").strip()
            gi = str(form.get("GatewayIPv6") or "").strip()
            if gn or gi:
                out["IPv6Gateway"] = {
                    "IPv6GatewayName": gn,
                    "IPv6GatewayIPAddress": gi,
                }
            else:
                out.pop("IPv6Gateway", None)
        else:
            for k in _BRIDGE_IPV6_RESTORE_FROM_BASE:
                if k in base:
                    out[k] = copy.deepcopy(base[k])
                else:
                    out.pop(k, None)

    if "FilterVLANs" in form:
        filt_on = _form_bool(form.get("FilterVLANs"))
        _set_textish(out, "VLANFilteringOnBridge", "Enable" if filt_on else "Disable")
        pv = _permitted_vlans_block(form)
        if pv is not None:
            out["PermittedVlansList"] = pv["PermittedVlansList"]
        elif not filt_on:
            out.pop("PermittedVlansList", None)

    if "PermitArpBroadcast" in form:
        _set_textish(
            out,
            "ARPBroadcast",
            _enable_disable_from_bool(_form_bool(form.get("PermitArpBroadcast"))),
        )
    if "EnableSTP" in form:
        _set_textish(
            out,
            "STP",
            _enable_disable_from_bool(_form_bool(form.get("EnableSTP"))),
        )
    if "STPMaxAge" in form:
        sa = str(form.get("STPMaxAge") or "").strip()
        if sa:
            _set_textish(out, "MAXAge", sa)
    if "MACAging" in form:
        ma = str(form.get("MACAging") or "").strip()
        if ma:
            _set_textish(out, "MACAging", ma)
    if "MTU" in form:
        mtu = str(form.get("MTU") or "").strip()
        if mtu:
            _set_textish(out, "MTU", mtu)

    if "OverrideMSS" in form or "MSS" in form:
        out["MSS"] = _bridge_mss_from_form(form, out.get("MSS"))
    elif not isinstance(out.get("MSS"), dict):
        out["MSS"] = {"Override": "Disable", "MSSValue": "1460"}

    if "FilterEthernetFrames" in form:
        fe_on = _form_bool(form.get("FilterEthernetFrames"))
        _set_textish(out, "FilterEthernetFrames", "Enable" if fe_on else "Disable")
        eth_raw = str(form.get("ForwardedEthernetFrameTypes") or "").strip()
        blk = _ether_type_block(eth_raw)
        if fe_on and blk is not None:
            out["EtherTypeList"] = blk["EtherTypeList"]
        elif not fe_on:
            out.pop("EtherTypeList", None)

    for k in _BRIDGE_FLYOUT_DISCARD:
        out.pop(k, None)

    return out


def bridge_pair_member_iface_set_from_payload(
    payload: Mapping[str, Any],
) -> frozenset[str]:
    """Interface names used as bridge members in a cached or merged BridgePair dict."""
    bm = payload.get("BridgeMembers")
    if not isinstance(bm, dict):
        return frozenset()
    raw = bm.get("Member")
    if raw is None:
        return frozenset()
    if isinstance(raw, dict):
        raw = [raw]
    if not isinstance(raw, list):
        return frozenset()
    out: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        iface_raw = item.get("Interface")
        if isinstance(iface_raw, dict):
            iface_raw = iface_raw.get("#text") if "#text" in iface_raw else iface_raw.get("text")
        iface = str(iface_raw or "").strip()
        if iface:
            out.add(iface)
    return frozenset(out)


def _bridge_pair_member_rows_from_form(form: Mapping[str, Any]) -> list[dict[str, str]]:
    bm = form.get("BridgeMembers")
    if not isinstance(bm, dict):
        return []
    raw = bm.get("Member")
    if raw is None:
        return []
    if isinstance(raw, dict):
        raw = [raw]
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        iface = str(item.get("Interface") or "").strip()
        zone = str(item.get("Zone") or "").strip()
        if iface and zone:
            out.append({"Interface": iface, "Zone": zone})
    return out


def lag_member_iface_set_from_payload(payload: Mapping[str, Any]) -> frozenset[str]:
    """Physical interface names used as LAG members."""
    return frozenset(collect_lag_member_names_from_payload(dict(payload)))


def merge_lag_flyout_form(
    base: Mapping[str, Any], form: Mapping[str, Any]
) -> dict[str, Any]:
    """
    Merge LAG flyout fields into cached LAG XML payload (primary key: ``Hardware``).

    Uses ``IPv4Address`` / ``Netmask`` (LAG schema), top-level ``IPAssignment`` Static/DHCP,
    ``Mode`` ActiveBackup / 802.3ad(LACP), ``MemberInterface``, and Interface-style IPv6 / PHY fields.
    """
    out: dict[str, Any] = copy.deepcopy(dict(base))

    name = str(form.get("name") or "").strip()
    if name:
        _set_textish(out, "Name", name)

    hw_in = form.get("hardware")
    if hw_in is not None:
        hw = str(hw_in).strip()
        if hw:
            _set_textish(out, "Hardware", hw)

    z = str(form.get("network_zone") or "").strip()
    if not z or z.lower() == "none":
        z = "None"
    _set_textish(out, "NetworkZone", z)

    lag_mode = str(form.get("lag_mode") or "active_backup").lower()
    if lag_mode == "lacp":
        _set_textish(out, "Mode", "802.3ad(LACP)")
        xh = str(form.get("lag_xmit_hash") or "Layer2").strip()
        if xh in ("Layer2", "Layer2+3", "Layer3+4"):
            _set_textish(out, "XmitHashPolicy", xh)
    else:
        _set_textish(out, "Mode", "ActiveBackup")
        out.pop("XmitHashPolicy", None)

    members = form.get("lag_members")
    if isinstance(members, list):
        names = [str(x).strip() for x in members if str(x).strip()]
        if names:
            if len(names) == 1:
                out["MemberInterface"] = {"Interface": names[0]}
            else:
                out["MemberInterface"] = {"Interface": names}

    prim = str(form.get("lag_primary") or "").strip()
    if lag_mode != "lacp" and prim:
        _set_textish(out, "PrimaryInterface", prim)
    else:
        out["PrimaryInterface"] = ""

    v4_on = bool(form.get("ipv4_enabled"))
    mode_v4 = str(form.get("ipv4_mode") or "dhcp").lower()
    if mode_v4 == "pppoe":
        mode_v4 = "dhcp"
    api_v4 = "Static" if mode_v4 == "static" else "DHCP"

    _set_textish(out, "IPv4Configuration", "Enable" if v4_on else "Disable")
    _set_textish(out, "IPAssignment", api_v4 if v4_on else "Static")

    if v4_on:
        if mode_v4 == "static":
            _set_textish(out, "IPv4Address", str(form.get("ipv4_ip") or "").strip())
            _set_textish(
                out,
                "Netmask",
                netmask_display_to_api(str(form.get("ipv4_netmask") or "")),
            )
            _set_textish(out, "GatewayName", str(form.get("ipv4_gateway_name") or "").strip())
            _set_textish(out, "GatewayIP", str(form.get("ipv4_gateway_ip") or "").strip())
        else:
            gn = str(form.get("ipv4_gateway_name") or "").strip()
            gi = str(form.get("ipv4_gateway_ip") or "").strip()
            if gn:
                _set_textish(out, "GatewayName", gn)
            if gi:
                _set_textish(out, "GatewayIP", gi)
            _set_textish(out, "IPv4Address", "")
            _set_textish(out, "Netmask", "")
    else:
        _set_textish(out, "IPv4Address", "")
        _set_textish(out, "Netmask", "")
        _set_textish(out, "GatewayName", "")
        _set_textish(out, "GatewayIP", "")

    out.pop("IPAddress", None)

    v6_on = bool(form.get("ipv6_enabled"))
    mode_v6 = str(form.get("ipv6_mode") or "static").lower()
    api_v6 = _IPV6_MODE_API.get(mode_v6, "Static")

    _set_textish(out, "IPv6Configuration", "Enable" if v6_on else "Disable")

    if v6_on:
        _set_textish(out, "IPv6Assignment", api_v6)
        _set_textish(out, "IPv6Address", str(form.get("ipv6_ip") or "").strip())
        _set_textish(out, "Prefix", str(form.get("ipv6_prefix") or "").strip())
        _set_textish(out, "GatewayNameIpv6", str(form.get("ipv6_gateway_name") or "").strip())
        _set_textish(out, "GatewayIPv6", str(form.get("ipv6_gateway_ip") or "").strip())
    else:
        _set_textish(out, "IPv6Assignment", "Static")
        _set_textish(out, "IPv6Address", "")
        _set_textish(out, "Prefix", "")
        _set_textish(out, "GatewayNameIpv6", "")
        _set_textish(out, "GatewayIPv6", "")

    lm_ui = str(form.get("link_mode") or "").strip() or "Auto Negotiate"
    iface_speed = _UI_TO_INTERFACE_SPEED.get(lm_ui, lm_ui)
    _set_textish(out, "InterfaceSpeed", iface_speed)

    auto_on = bool(form.get("auto_negotiation"))
    _set_textish(out, "AutoNegotiation", "1" if auto_on else "0")

    fec_ui = str(form.get("fec") or "Off").strip()
    fec_api = _UI_TO_FEC.get(fec_ui, fec_ui if fec_ui in _UI_TO_FEC.values() else "Off")
    _set_textish(out, "FEC", fec_api)

    mtu = str(form.get("mtu") or "1500").strip() or "1500"
    _set_textish(out, "MTU", mtu)

    out["MSS"] = _mss_block(form, out.get("MSS"))
    out.pop("OverrideMSS", None)

    mac_mode = str(form.get("mac_mode") or "default").lower()
    if mac_mode == "override":
        mac = str(form.get("mac_override") or "").strip()
        if mac:
            _set_textish(out, "MACAddress", mac)
    else:
        _set_textish(out, "MACAddress", "Default")

    istat = str(form.get("interface_status") or "on").lower()
    _set_textish(out, "InterfaceStatus", "ON" if istat != "off" else "OFF")

    for k in _READ_ONLY_OR_ALIAS_KEYS:
        out.pop(k, None)

    return out


def lag_create_merged_payload(form: Mapping[str, Any]) -> dict[str, Any]:
    hw = str(form.get("hardware") or "").strip()
    if not hw:
        raise ValueError("Hardware is required")
    if len(hw) > 10:
        raise ValueError("Hardware must be at most 10 characters")
    if not re.match(r"^[A-Za-z][A-Za-z0-9_]*$", hw):
        raise ValueError(
            "Hardware must start with a letter and contain only letters, digits, and underscores"
        )
    raw_m = form.get("lag_members")
    if not isinstance(raw_m, list):
        raise ValueError("Member interfaces are required")
    members = [str(x).strip() for x in raw_m if str(x).strip()]
    if len(members) < 2:
        raise ValueError("At least two member interfaces are required")
    if len(members) > 4:
        raise ValueError("At most four member interfaces are allowed")

    name = str(form.get("name") or "").strip()
    if len(name) > 58:
        raise ValueError("Name must be at most 58 characters")

    merged = merge_lag_flyout_form(
        {},
        {**dict(form), "hardware": hw, "lag_members": members},
    )
    merged["Hardware"] = hw
    merged.setdefault("InterfaceStatus", "ON")
    return merged


def bridge_pair_create_merged_payload(form: Mapping[str, Any]) -> dict[str, Any]:
    """Validate Add-bridge-pair flyout form and return merged SFOS-shaped ``BridgePair`` dict."""
    hw = str(form.get("Hardware") or "").strip()
    if not hw:
        raise ValueError("Hardware is required")
    if len(hw) > 10:
        raise ValueError("Hardware must be at most 10 characters")
    if not re.match(r"^[A-Za-z][A-Za-z0-9_]*$", hw):
        raise ValueError(
            "Hardware must start with a letter and contain only letters, digits, and underscores"
        )

    members = _bridge_pair_member_rows_from_form(form)
    if len(members) < 2:
        raise ValueError("At least two member interfaces with zones are required")

    name = str(form.get("Name") or "").strip()
    if len(name) > 58:
        raise ValueError("Name must be at most 58 characters")

    desc = form.get("Description")
    if desc is not None and len(str(desc).strip()) > 100:
        raise ValueError("Description must be at most 100 characters")

    base: dict[str, Any] = {}
    merged = merge_bridge_pair_flyout_form(base, form)
    merged["Hardware"] = hw
    if "IPv4Configuration" not in merged:
        merged["IPv4Configuration"] = "Disable"
    if "IPv6Configuration" not in merged:
        merged["IPv6Configuration"] = "Disable"
    merged.setdefault("InterfaceStatus", "ON")
    return merged


def merge_alias_flyout_form(
    base: Mapping[str, Any], form: Mapping[str, Any]
) -> dict[str, Any]:
    """Merge Alias add/edit flyout form keys into an SFOS-shaped Alias dict."""
    out: dict[str, Any] = copy.deepcopy(dict(base)) if base else {}

    name = str(form.get("name") or form.get("Name") or out.get("Name") or "").strip()
    if name:
        out["Name"] = name

    iface = str(
        form.get("interface_parent")
        or form.get("Interface")
        or out.get("Interface")
        or ""
    ).strip()
    if iface:
        out["Interface"] = iface

    fam_raw = str(
        form.get("ip_family") or form.get("IPFamily") or out.get("IPFamily") or "IPv4"
    ).strip()
    fam = "IPv6" if fam_raw.casefold() in ("ipv6", "6") else "IPv4"
    out["IPFamily"] = fam

    if fam == "IPv6":
        out["IPv6"] = str(
            form.get("ipv6") or form.get("IPv6") or out.get("IPv6") or ""
        ).strip()
        pfx_src = form.get("prefix") if "prefix" in form else form.get("Prefix")
        if pfx_src is None:
            pfx_src = out.get("Prefix")
        out["Prefix"] = str(pfx_src or "").strip()
        out.pop("IPAddress", None)
        out.pop("Netmask", None)
    else:
        out["IPAddress"] = str(
            form.get("ipv4_ip") or form.get("IPAddress") or out.get("IPAddress") or ""
        ).strip()
        out["Netmask"] = str(
            form.get("ipv4_netmask")
            or form.get("Netmask")
            or out.get("Netmask")
            or ""
        ).strip()
        out.pop("IPv6", None)
        out.pop("Prefix", None)

    return out


# Zone (Network · Zones): Name, Type, Description, nested ApplianceAccess.* Enable/Disable flags.
_ZONE_ACCESS_SECTIONS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("AdminServices", ("HTTPS", "SSH")),
    (
        "AuthenticationServices",
        (
            "ClientAuthentication",
            "CaptivePortal",
            "ADSSO",
            "RadiusSSO",
            "ChromebookSSO",
        ),
    ),
    ("NetworkServices", ("DNS", "Ping")),
    ("VPNServices", ("IPsec", "RED", "SSLVPN", "VPNPortal")),
    (
        "OtherServices",
        (
            "WebProxy",
            "WirelessProtection",
            "UserPortal",
            "DynamicRouting",
            "SMTPRelay",
            "SNMP",
        ),
    ),
)


def _zone_normalize_type(raw: str) -> str | None:
    s = (raw or "").strip().upper()
    if not s:
        return None
    if s == "DISCOVER":
        return "Discover"
    if s in ("LAN", "DMZ", "WAN", "LOCAL", "VPN"):
        return s
    return None


def _zone_ensure_appliance_access(out: dict[str, Any]) -> dict[str, Any]:
    aa = out.get("ApplianceAccess")
    if not isinstance(aa, dict):
        aa = {}
        out["ApplianceAccess"] = aa
    for group, leaves in _ZONE_ACCESS_SECTIONS:
        blk = aa.get(group)
        if not isinstance(blk, dict):
            blk = {}
            aa[group] = blk
        for leaf in leaves:
            if leaf not in blk:
                blk[leaf] = "Disable"
    return aa


def merge_zone_flyout_form(
    base: Mapping[str, Any], form: Mapping[str, Any]
) -> dict[str, Any]:
    """Deep-copy cached Zone dict and apply flyout fields (Sophos Zone XML schema)."""
    out = copy.deepcopy(dict(base))
    name = str(form.get("name") or form.get("Name") or "").strip()
    if name:
        _set_textish(out, "Name", name)
    desc = str(form.get("description") or form.get("Description") or "").strip()
    _set_textish(out, "Description", desc)
    zt = _zone_normalize_type(
        str(form.get("type") or form.get("zone_type") or form.get("Type") or "")
    )
    if zt:
        _set_textish(out, "Type", zt)

    acc = form.get("access")
    if isinstance(acc, dict):
        aa = _zone_ensure_appliance_access(out)
        for group, leaves in _ZONE_ACCESS_SECTIONS:
            blk = aa[group]
            if not isinstance(blk, dict):
                continue
            for leaf in leaves:
                if leaf not in acc:
                    continue
                val = _enable_disable_from_bool(_form_bool(acc.get(leaf)))
                _set_textish(blk, leaf, val)
    return out


def zone_create_merged_payload(form: Mapping[str, Any]) -> dict[str, Any]:
    base: dict[str, Any] = {
        "Name": "",
        "Type": "LAN",
        "Description": "",
    }
    _zone_ensure_appliance_access(base)
    return merge_zone_flyout_form(base, form)


def alias_create_merged_payload(form: Mapping[str, Any]) -> dict[str, Any]:
    name = str(form.get("name") or form.get("Name") or "").strip()
    if not name:
        name = f"alias_{secrets.token_hex(6)}"
    if "," in name:
        raise ValueError("Alias name cannot contain a comma")
    iface = str(form.get("interface_parent") or form.get("Interface") or "").strip()
    if not iface:
        raise ValueError("Physical interface is required")
    base: dict[str, Any] = {"Name": name, "Interface": iface}
    merged = merge_alias_flyout_form(base, form)
    if merged.get("IPFamily") == "IPv6":
        if not str(merged.get("IPv6") or "").strip():
            raise ValueError("IPv6 address is required")
        if not str(merged.get("Prefix") or "").strip():
            raise ValueError("IPv6 prefix length is required")
    else:
        if not str(merged.get("IPAddress") or "").strip():
            raise ValueError("IPv4 address is required")
        if not str(merged.get("Netmask") or "").strip():
            raise ValueError("Netmask is required")
    return merged
