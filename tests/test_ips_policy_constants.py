"""Smoke tests for ``app.ips_policy_constants``."""

from __future__ import annotations

from app import ips_policy_constants as ipc


def test_option_lists_non_empty():
    assert ipc.IPS_POLICY_CATEGORIES
    assert ipc.IPS_POLICY_ACTIONS
    assert ipc.IPS_POLICY_PLATFORMS
    assert ipc.IPS_POLICY_RULE_TYPES
    assert ipc.IPS_POLICY_SIGNATURE_SELECTION
    assert ipc.IPS_POLICY_SEVERITIES
    assert ipc.IPS_POLICY_TARGETS
