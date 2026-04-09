"""Connectivity checks using sophosfirewall-python."""

from __future__ import annotations

import requests
from sophosfirewall_python.api_client import (
    SophosFirewallAPIError,
    SophosFirewallAuthFailure,
)
from sophosfirewall_python.firewallapi import SophosFirewall

from app.docker_firewall_egress import docker_firewall_tcp_host
from app.firewall_api_client import patch_sophos_firewall_request_timeout


def _test_connection_inner(
    host: str,
    port: int,
    username: str,
    password: str,
    verify_ssl: bool,
    *,
    request_timeout_seconds: int | None = None,
) -> tuple[bool, str, bool]:
    """
    Returns (success, message, run_tcp_monitor_probe).

    ``run_tcp_monitor_probe`` is True when the API endpoint was reached and responded
    with successful authentication or explicit credential rejection (same host:port as
    inventory TCP monitor probes).
    """
    connect_host = docker_firewall_tcp_host(host)
    fw = SophosFirewall(
        username=username,
        password=password,
        hostname=connect_host,
        port=port,
        verify=verify_ssl,
    )
    if request_timeout_seconds is not None:
        patch_sophos_firewall_request_timeout(fw, request_timeout_seconds)
    try:
        result = fw.login()
    except SophosFirewallAuthFailure:
        return (
            False,
            "Authentication failed. Check username, password, and API access on the firewall.",
            True,
        )
    except SophosFirewallAPIError as exc:
        return False, str(exc), False
    except requests.exceptions.SSLError as exc:
        return (
            False,
            f"SSL error: {exc}. Try disabling certificate verification if using a self-signed cert.",
            False,
        )
    except requests.exceptions.ConnectTimeout:
        return (
            False,
            "Connection timed out. Check host, port, and network path.",
            False,
        )
    except requests.exceptions.ConnectionError as exc:
        return False, f"Could not connect: {exc}", False

    root = result.get("Response", result)
    login = root.get("Login", {}) if isinstance(root, dict) else {}
    status = login.get("status", "") if isinstance(login, dict) else ""
    if status == "Authentication Successful":
        return True, "Connected and authenticated successfully.", True
    if login:
        return False, f"Unexpected login response: {login!r}", False
    return True, "Connected (login succeeded; response shape differed from expected).", True


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
    ok, msg, _ = _test_connection_inner(
        host,
        port,
        username,
        password,
        verify_ssl,
        request_timeout_seconds=request_timeout_seconds,
    )
    return ok, msg


def test_connection_with_monitor_probe_hint(
    host: str,
    port: int,
    username: str,
    password: str,
    verify_ssl: bool,
    *,
    request_timeout_seconds: int | None = None,
) -> tuple[bool, str, bool]:
    """Like :func:`test_connection` but also returns whether to run an immediate TCP monitor probe."""
    return _test_connection_inner(
        host,
        port,
        username,
        password,
        verify_ssl,
        request_timeout_seconds=request_timeout_seconds,
    )
