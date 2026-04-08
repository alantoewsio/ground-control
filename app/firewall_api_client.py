"""Per-firewall Sophos XML API HTTP timeout helpers."""

from __future__ import annotations

import types

from sophosfirewall_python.firewallapi import SophosFirewall

DEFAULT_FIREWALL_API_TIMEOUT_SECONDS = 120
MIN_FIREWALL_API_TIMEOUT_SECONDS = 5
MAX_FIREWALL_API_TIMEOUT_SECONDS = 600


def normalize_firewall_api_timeout_seconds(raw: int | None) -> int:
    """Clamp stored firewall timeout to a safe range; default 120s."""
    if raw is None:
        return DEFAULT_FIREWALL_API_TIMEOUT_SECONDS
    try:
        v = int(raw)
    except (TypeError, ValueError):
        return DEFAULT_FIREWALL_API_TIMEOUT_SECONDS
    return max(
        MIN_FIREWALL_API_TIMEOUT_SECONDS,
        min(MAX_FIREWALL_API_TIMEOUT_SECONDS, v),
    )


def patch_sophos_firewall_request_timeout(fw: SophosFirewall, seconds: int) -> None:
    """
    Force this client's HTTP POSTs to use ``seconds`` as the requests timeout.

    The Sophos library passes explicit ``timeout=30`` in many places; wrapping ``_post``
    ensures the firewall-specific value is used for all API calls on this instance.
    """
    client = fw.client
    orig_post = client._post

    def _post(self, xmldata: str, timeout: int = 30):  # noqa: ARG002
        return orig_post(xmldata, timeout=seconds)

    client._post = types.MethodType(_post, client)
