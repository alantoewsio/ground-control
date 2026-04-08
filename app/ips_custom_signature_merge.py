"""Merge IPS custom signature flyout payloads for task queue."""

from __future__ import annotations

from typing import Any

IPS_CUSTOM_SIG_PROTOCOLS = frozenset({"TCP", "UDP", "ICMP", "ALL"})
IPS_CUSTOM_SIG_SEVERITIES = frozenset(
    {"Critical", "Major", "Moderate", "Minor", "Warning"}
)
IPS_CUSTOM_SIG_ACTIONS = frozenset(
    {
        "Allow Packet",
        "Drop Packet",
        "Drop Session",
        "Reset",
        "Bypass Session",
        "3",
    }
)

# Ordered labels for flyout selects (includes API legacy value "3").
IPS_CUSTOM_SIG_PROTOCOL_OPTIONS: tuple[str, ...] = ("TCP", "UDP", "ICMP", "ALL")
IPS_CUSTOM_SIG_SEVERITY_OPTIONS: tuple[str, ...] = (
    "Critical",
    "Major",
    "Moderate",
    "Minor",
    "Warning",
)
IPS_CUSTOM_SIG_ACTION_OPTIONS: tuple[str, ...] = (
    "Allow Packet",
    "Drop Packet",
    "Drop Session",
    "Reset",
    "Bypass Session",
    "3",
)


def _clean_str(v: Any, *, max_len: int | None = None) -> str:
    s = str(v or "").strip()
    if max_len is not None and len(s) > max_len:
        return s[:max_len]
    return s


def validate_and_build_signature_payload(client: dict[str, Any]) -> dict[str, Any]:
    """Return XML-ready dict keys for IPSCustomSignature. Raises ValueError."""
    if not isinstance(client, dict):
        client = {}
    name = _clean_str(client.get("Name"), max_len=15)
    if not name:
        raise ValueError("Name is required (max 15 characters).")
    proto = _clean_str(client.get("Protocol"))
    if proto not in IPS_CUSTOM_SIG_PROTOCOLS:
        raise ValueError("Protocol must be TCP, UDP, ICMP, or ALL.")
    rule = _clean_str(client.get("CustomRule"))
    if not rule:
        raise ValueError("Custom rule is required.")
    sev = _clean_str(client.get("Severity"))
    if sev not in IPS_CUSTOM_SIG_SEVERITIES:
        raise ValueError("Severity must be Critical, Major, Moderate, Minor, or Warning.")
    action = _clean_str(client.get("RecommendedAction")) or "Allow Packet"
    if action not in IPS_CUSTOM_SIG_ACTIONS:
        raise ValueError("Recommended action is not valid for IPS custom signatures.")
    return {
        "Name": name,
        "Protocol": proto,
        "CustomRule": rule,
        "Severity": sev,
        "RecommendedAction": action,
    }


def task_payload_for_signature_update(
    base: dict[str, Any], client: dict[str, Any]
) -> dict[str, Any]:
    """Merge cached base with client edits; Name stays from base (lookup key)."""
    built = validate_and_build_signature_payload({**base, **client})
    name_key = _clean_str(base.get("Name"), max_len=15) or built["Name"]
    out = dict(base)
    out["Name"] = name_key
    out["Protocol"] = built["Protocol"]
    out["CustomRule"] = built["CustomRule"]
    out["Severity"] = built["Severity"]
    out["RecommendedAction"] = built["RecommendedAction"]
    return out
