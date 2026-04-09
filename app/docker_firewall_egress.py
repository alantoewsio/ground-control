"""Remap loopback firewall inventory hosts when Ground Control runs inside Docker."""

from __future__ import annotations

import ipaddress
import os

from app import config


def _egress_substitution_host() -> str | None:
    raw = (os.environ.get("GROUND_CONTROL_DOCKER_EGRESS_HOST") or "").strip()
    return raw or None


def _is_loopback_inventory_host(host: str) -> bool:
    h = (host or "").strip()
    if not h:
        return False
    if h.startswith("[") and h.endswith("]"):
        h = h[1:-1].strip()
    low = h.lower()
    if low in ("localhost", "127.0.0.1", "::1"):
        return True
    try:
        return bool(ipaddress.ip_address(h).is_loopback)
    except ValueError:
        return False


def docker_firewall_tcp_host(inventory_host: str) -> str:
    """
    TCP/HTTPS client target for a firewall inventory host when running in Docker.

    Set ``GROUND_CONTROL_DOCKER_EGRESS_HOST`` (for example ``host.docker.internal`` on Docker
    Desktop, or the gateway from ``extra_hosts`` on Linux) so inventory addresses like
    ``127.0.0.1`` or ``localhost`` reach services on the Docker host instead of the container
    loopback. Other addresses are unchanged.

    If TLS verification fails after substitution, disable certificate verification for that
    firewall in inventory or use a hostname the appliance certificate matches.
    """
    inv = (inventory_host or "").strip()
    if not inv:
        return inv
    if not config.in_docker_deployment():
        return inv
    sub = _egress_substitution_host()
    if not sub:
        return inv
    if not _is_loopback_inventory_host(inv):
        return inv
    return sub
