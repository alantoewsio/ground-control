"""Synthetic Interface cache rows for test firewalls (unified Interfaces tab)."""

from __future__ import annotations

import json
import random
from dataclasses import dataclass
from typing import Any, Literal

Kind = Literal["copper", "fiber", "mgmt", "vm"]


@dataclass(frozen=True)
class SyntheticFwPortLayout:
    """Port counts for one test firewall. VM-only when vm > 0 and copper+fiber+mgmt == 0."""

    copper: int = 0
    fiber: int = 0
    mgmt: int = 0
    vm: int = 0


def random_port_layout() -> SyntheticFwPortLayout:
    r = random.randint(0, 3)
    if r == 0:
        return SyntheticFwPortLayout(copper=8, fiber=2, mgmt=1)
    if r == 1:
        return SyntheticFwPortLayout(copper=12, fiber=2)
    if r == 2:
        return SyntheticFwPortLayout(copper=8, fiber=16, mgmt=1)
    return SyntheticFwPortLayout(vm=random.randint(3, 8))


def ordered_ports(layout: SyntheticFwPortLayout) -> list[tuple[str, str, Kind]]:
    """(Name, Hardware, kind) in table order: copper, fiber, MGMT, VM."""
    if layout.vm > 0 and layout.copper + layout.fiber + layout.mgmt == 0:
        letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        out: list[tuple[str, str, Kind]] = []
        for i in range(layout.vm):
            n = f"Port{letters[i]}"
            out.append((n, n, "vm"))
        return out
    out = []
    for i in range(1, layout.copper + 1):
        n = f"Port{i}"
        out.append((n, n, "copper"))
    for i in range(1, layout.fiber + 1):
        n = f"PortF{i}"
        out.append((n, n, "fiber"))
    for _ in range(layout.mgmt):
        out.append(("PortMGMT", "PortMGMT", "mgmt"))
    return out


def _roles_for_ports(ports: list[tuple[str, str, Kind]]) -> list[str]:
    """default | first_lan | wan_dhcp per port index."""
    roles = ["default"] * len(ports)
    first_lan_idx = next(
        (i for i, (_, _, k) in enumerate(ports) if k in ("copper", "vm")), None
    )
    if first_lan_idx is not None:
        roles[first_lan_idx] = "first_lan"
    copper_idx = [i for i, (_, _, k) in enumerate(ports) if k == "copper"]
    if len(copper_idx) >= 2:
        roles[copper_idx[1]] = "wan_dhcp"
    return roles


def _iface_payload(
    name: str,
    hardware: str,
    role: str,
    *,
    lan_host_ipv4: str,
    lan_netmask: str,
) -> dict[str, Any]:
    base: dict[str, Any] = {
        "Name": name,
        "Hardware": hardware,
        "NetworkZone": "None",
        "IPv4Configuration": "Disable",
        "IPv4Assignment": "Static",
        "IPAddress": "",
        "Netmask": "",
        "GatewayName": "",
        "GatewayIP": "",
        "IPv6Configuration": "Disable",
        "IPv6Assignment": "Static",
        "InterfaceSpeed": "Auto Negotiate",
        "AutoNegotiation": "1",
        "FEC": "Off",
        "MTU": "1500",
    }
    if role == "first_lan":
        base["NetworkZone"] = "LAN"
        base["IPv4Configuration"] = "Enable"
        base["IPv4Assignment"] = "Static"
        base["IPAddress"] = lan_host_ipv4
        base["Netmask"] = lan_netmask
    elif role == "wan_dhcp":
        base["NetworkZone"] = "WAN"
        base["IPv4Configuration"] = "Enable"
        base["IPv4Assignment"] = "DHCP"
        base["GatewayName"] = "DHCP_GW"
    return base


def synthetic_interface_entries_payloads(
    layout: SyntheticFwPortLayout,
    *,
    lan_host_ipv4: str,
    lan_netmask: str,
) -> list[dict[str, Any]]:
    ports = ordered_ports(layout)
    roles = _roles_for_ports(ports)
    return [
        _iface_payload(
            name, hw, role, lan_host_ipv4=lan_host_ipv4, lan_netmask=lan_netmask
        )
        for (name, hw, _k), role in zip(ports, roles, strict=True)
    ]


def synthetic_interface_config_entry_tuples(
    layout: SyntheticFwPortLayout,
    *,
    lan_host_ipv4: str,
    lan_netmask: str,
) -> list[tuple[str, str]]:
    """(external_name, payload_json) for entity_type interface."""
    out: list[tuple[str, str]] = []
    for payload in synthetic_interface_entries_payloads(
        layout, lan_host_ipv4=lan_host_ipv4, lan_netmask=lan_netmask
    ):
        name = str(payload.get("Name") or "")
        out.append((name, json.dumps(payload, separators=(",", ":"))))
    return out
