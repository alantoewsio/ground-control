"""Tests for ``app.sophos_connect``."""

from __future__ import annotations

from unittest.mock import patch

import requests
from sophosfirewall_python.api_client import (
    SophosFirewallAPIError,
    SophosFirewallAuthFailure,
)

from app import sophos_connect


def test_test_connection_auth_failure():
    with patch("app.sophos_connect.SophosFirewall") as SF:
        inst = SF.return_value
        inst.login.side_effect = SophosFirewallAuthFailure("bad")
        ok, msg = sophos_connect.test_connection(
            "h", 4444, "u", "p", True, request_timeout_seconds=30
        )
        assert ok is False
        assert "Authentication" in msg


def test_test_connection_api_error():
    with patch("app.sophos_connect.SophosFirewall") as SF:
        inst = SF.return_value
        inst.login.side_effect = SophosFirewallAPIError("e")
        ok, msg = sophos_connect.test_connection("h", 4444, "u", "p", False)
        assert ok is False


def test_test_connection_ssl_error():
    with patch("app.sophos_connect.SophosFirewall") as SF:
        inst = SF.return_value
        inst.login.side_effect = requests.exceptions.SSLError("x")
        ok, msg = sophos_connect.test_connection("h", 4444, "u", "p", False)
        assert ok is False and "SSL" in msg


def test_test_connection_timeout():
    with patch("app.sophos_connect.SophosFirewall") as SF:
        inst = SF.return_value
        inst.login.side_effect = requests.exceptions.ConnectTimeout()
        ok, msg = sophos_connect.test_connection("h", 4444, "u", "p", False)
        assert ok is False and "timed out" in msg.lower()


def test_test_connection_conn_error():
    with patch("app.sophos_connect.SophosFirewall") as SF:
        inst = SF.return_value
        inst.login.side_effect = requests.exceptions.ConnectionError("nope")
        ok, msg = sophos_connect.test_connection("h", 4444, "u", "p", False)
        assert ok is False


def test_test_connection_success_shapes():
    with patch("app.sophos_connect.SophosFirewall") as SF:
        inst = SF.return_value
        inst.login.return_value = {
            "Response": {"Login": {"status": "Authentication Successful"}}
        }
        ok, msg = sophos_connect.test_connection("h", 4444, "u", "p", False)
        assert ok is True
    with patch("app.sophos_connect.SophosFirewall") as SF:
        inst = SF.return_value
        inst.login.return_value = {"Response": {"Login": {"other": 1}}}
        ok, msg = sophos_connect.test_connection("h", 4444, "u", "p", False)
        assert ok is False
    with patch("app.sophos_connect.SophosFirewall") as SF:
        inst = SF.return_value
        inst.login.return_value = {"Response": {}}
        ok, msg = sophos_connect.test_connection("h", 4444, "u", "p", False)
        assert ok is True
