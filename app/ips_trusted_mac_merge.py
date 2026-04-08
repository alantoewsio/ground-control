"""Merge Trusted MAC flyout payloads for task queue (Sophos TrustedMAC XML)."""

from __future__ import annotations

from typing import Any

TRUSTED_MAC_IP_ASSOC = frozenset({"None", "Static", "DHCP"})


def _clean_str(v: Any, *, max_len: int | None = None) -> str:
    s = str(v or "").strip()
    if max_len is not None and len(s) > max_len:
        return s[:max_len]
    return s


def validate_and_build_trusted_mac_payload(client: dict[str, Any]) -> dict[str, Any]:
    """Return XML-ready dict keys for TrustedMAC. Raises ValueError."""
    if not isinstance(client, dict):
        client = {}
    mac = _clean_str(client.get("MACAddress"), max_len=17)
    if not mac:
        raise ValueError("MAC address is required (max 17 characters).")
    v4a = _clean_str(client.get("IPV4Association")) or "None"
    if v4a not in TRUSTED_MAC_IP_ASSOC:
        raise ValueError("IPv4 association must be None, Static, or DHCP.")
    v6a = _clean_str(client.get("IPV6Association")) or "None"
    if v6a not in TRUSTED_MAC_IP_ASSOC:
        raise ValueError("IPv6 association must be None, Static, or DHCP.")
    v4addr = _clean_str(client.get("IPV4Address"))
    v6addr = _clean_str(client.get("IPV6Address"))
    if v4a == "None":
        v4addr = ""
    if v6a == "None":
        v6addr = ""
    out: dict[str, Any] = {
        "MACAddress": mac,
        "IPV4Association": v4a,
        "IPV4Address": v4addr,
        "IPV6Association": v6a,
        "IPV6Address": v6addr,
    }
    ap = _clean_str(client.get("AssociateIP"))
    if ap:
        out["AssociateIP"] = ap
    return out


def task_payload_for_trusted_mac_update(base: dict[str, Any], client: dict[str, Any]) -> dict[str, Any]:
    """Merge cached base with client edits. OldConfiguration is added at send time."""
    if not isinstance(base, dict):
        base = {}
    merged_client = {**base, **client}
    return validate_and_build_trusted_mac_payload(merged_client)


def trusted_mac_update_params_for_api(
    update_params: dict[str, Any], *, lookup_mac: str
) -> dict[str, Any]:
    """Inject OldConfiguration for Set update; lookup_mac is the pre-edit MAC (cache key)."""
    u = dict(update_params)
    u["OldConfiguration"] = {"MACAddress": str(lookup_mac).strip()}
    return u
