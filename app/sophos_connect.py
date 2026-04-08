"""Connectivity checks using sophosfirewall-python."""

from __future__ import annotations

import requests
from sophosfirewall_python.api_client import (
    SophosFirewallAPIError,
    SophosFirewallAuthFailure,
)
from sophosfirewall_python.firewallapi import SophosFirewall

from app.firewall_api_client import patch_sophos_firewall_request_timeout


def test_connection(
    host: str,
    port: int,
    username: str,
    password: str,
    verify_ssl: bool,
    *,
    request_timeout_seconds: int | None = None,
) -> tuple[bool, str]:
    """
    Returns (success, message). Uses SophosFirewall.login() per library docs.
    """
    fw = SophosFirewall(
        username=username,
        password=password,
        hostname=host,
        port=port,
        verify=verify_ssl,
    )
    if request_timeout_seconds is not None:
        patch_sophos_firewall_request_timeout(fw, request_timeout_seconds)
    try:
        result = fw.login()
    except SophosFirewallAuthFailure:
        return False, "Authentication failed. Check username, password, and API access on the firewall."
    except SophosFirewallAPIError as exc:
        return False, str(exc)
    except requests.exceptions.SSLError as exc:
        return False, f"SSL error: {exc}. Try disabling certificate verification if using a self-signed cert."
    except requests.exceptions.ConnectTimeout:
        return False, "Connection timed out. Check host, port, and network path."
    except requests.exceptions.ConnectionError as exc:
        return False, f"Could not connect: {exc}"

    root = result.get("Response", result)
    login = root.get("Login", {}) if isinstance(root, dict) else {}
    status = login.get("status", "") if isinstance(login, dict) else ""
    if status == "Authentication Successful":
        return True, "Connected and authenticated successfully."
    if login:
        return False, f"Unexpected login response: {login!r}"
    return True, "Connected (login succeeded; response shape differed from expected)."
