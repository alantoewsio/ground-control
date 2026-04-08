"""Merge IPS Configure flyout payloads into cached DoSSettings / SpoofPrevention (Sophos XML shape)."""

from __future__ import annotations

import copy
from typing import Any

# SpoofPrevention.xml (xml-api-docs/Protect/Intrusion_Prevention/SpoofPrevention.md)


def _deep_merge_dict(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for k, v in patch.items():
        if str(k).startswith("@"):
            continue
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge_dict(out[k], v)
        else:
            out[k] = v
    return out


def merge_dos_settings_payload(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """Overlay flyout `patch` onto cached DoSSettings dict (Sophos tag structure)."""
    if not isinstance(base, dict):
        base = {}
    if not isinstance(patch, dict):
        patch = {}
    return _deep_merge_dict(copy.deepcopy(base), patch)


def _enable_on_zone_for_zones(zone_names: list[str]) -> dict[str, Any]:
    """Build IPSpoofing/MACFilter/IPMACFilter EnableOnZone block (SpoofPrevention.md)."""
    names = [str(z).strip() for z in zone_names if str(z).strip()]
    if not names:
        return {"EnableOnZone": {"Zone": "Disable"}}
    if len(names) == 1:
        return {"EnableOnZone": {"Zone": names[0]}}
    return {"EnableOnZone": {"Zone": names}}


def merge_spoof_prevention_payload(
    base: dict[str, Any], client: dict[str, Any]
) -> dict[str, Any]:
    """
    Build SpoofPrevention payload from flyout JSON:
    - enabled: bool -> top-level SpoofPrevention Enable/Disable
    - restrict_unknown_ip_trusted_mac: bool -> RestrictUnknownIPOnTrustedMAC
    - zones: [{ zone, wan, ip_spoof, mac_filter, pair_filter }]
    """
    if not isinstance(base, dict):
        base = {}
    if not isinstance(client, dict):
        client = {}
    out = copy.deepcopy(base)
    enabled = bool(client.get("enabled"))
    out["SpoofPrevention"] = "Enable" if enabled else "Disable"
    out["RestrictUnknownIPOnTrustedMAC"] = (
        "Enable" if bool(client.get("restrict_unknown_ip_trusted_mac")) else "Disable"
    )
    if not enabled:
        for k in ("IPSpoofing", "MACFilter", "IPMACFilter"):
            out.pop(k, None)
        return out

    ip_zones: list[str] = []
    mac_zones: list[str] = []
    pair_zones: list[str] = []
    for z in client.get("zones") or []:
        if not isinstance(z, dict):
            continue
        name = str(z.get("zone") or "").strip()
        if not name:
            continue
        wan = bool(z.get("wan"))
        if wan:
            if bool(z.get("mac_filter")):
                mac_zones.append(name)
        else:
            if bool(z.get("ip_spoof")):
                ip_zones.append(name)
            if bool(z.get("mac_filter")):
                mac_zones.append(name)
            if bool(z.get("pair_filter")):
                pair_zones.append(name)
    out["IPSpoofing"] = _enable_on_zone_for_zones(ip_zones)
    out["MACFilter"] = _enable_on_zone_for_zones(mac_zones)
    out["IPMACFilter"] = _enable_on_zone_for_zones(pair_zones)
    return out
