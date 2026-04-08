"""Tests for ``app.firewall_api_client``."""

from __future__ import annotations

from unittest.mock import MagicMock

from app.firewall_api_client import (
    MAX_FIREWALL_API_TIMEOUT_SECONDS,
    MIN_FIREWALL_API_TIMEOUT_SECONDS,
    normalize_firewall_api_timeout_seconds,
    patch_sophos_firewall_request_timeout,
)


def test_normalize_timeout_defaults_and_clamp():
    assert normalize_firewall_api_timeout_seconds(None) == 120
    assert normalize_firewall_api_timeout_seconds(3) == MIN_FIREWALL_API_TIMEOUT_SECONDS
    assert normalize_firewall_api_timeout_seconds(30) == 30
    assert normalize_firewall_api_timeout_seconds(9999) == MAX_FIREWALL_API_TIMEOUT_SECONDS
    assert normalize_firewall_api_timeout_seconds("bad") == 120  # type: ignore[arg-type]


def test_patch_sophos_firewall_request_timeout():
    fw = MagicMock()
    orig_post = MagicMock(return_value={"ok": True})
    fw.client._post = orig_post
    patch_sophos_firewall_request_timeout(fw, 99)
    fw.client._post("xml", timeout=30)
    orig_post.assert_called_once_with("xml", timeout=99)
