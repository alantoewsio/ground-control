"""IPAM pool and /24 assignments for synthetic test firewalls (Testing VRF)."""

from __future__ import annotations

import ipaddress

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ipam import (
    _normalize_cidr,
    create_ipam_prefix,
    suggest_next_assignment_cidr,
    vrf_key,
)
from app.ipam_vrf import create_ipam_vrf
from app.models import IpamPrefix, IpamVrf

_TEST_FW_VRF_PREFERRED_NAME = "Testing"


def _ptype_cf(row: IpamPrefix) -> str:
    return (row.prefix_type or "").strip().casefold()


def testing_vrf_label(db: Session) -> str:
    """Return the stored VRF name for the Testing VRF (any casing), creating it if missing."""
    row = (
        db.query(IpamVrf)
        .filter(func.lower(IpamVrf.name) == _TEST_FW_VRF_PREFERRED_NAME.lower())
        .first()
    )
    if row is not None:
        return row.name
    created = create_ipam_vrf(
        db,
        name=_TEST_FW_VRF_PREFERRED_NAME,
        description="VRF for synthetic test firewall LAN pools and /24 assignments.",
    )
    return created.name


def validate_test_lan_pool_cidr(cidr: str) -> tuple[str, int]:
    """Normalize IPv4 pool CIDR; raises ValueError if unusable for nested /24 assignments."""
    norm, fam = _normalize_cidr(cidr)
    if fam != 4:
        raise ValueError("Test LAN pool must be an IPv4 CIDR.")
    net = ipaddress.ip_network(norm, strict=False)
    if net.prefixlen >= 24:
        raise ValueError(
            "Test LAN pool must be shorter than /24 so at least one /24 can be allocated inside it."
        )
    return norm, fam


def ensure_test_fw_lan_pool(db: Session, pool_cidr: str) -> IpamPrefix:
    """Ensure the Testing VRF exists and a pool with *pool_cidr* exists; return that pool."""
    vrf_name = testing_vrf_label(db)
    norm, _fam = validate_test_lan_pool_cidr(pool_cidr)
    vk = vrf_key(vrf_name)
    row = (
        db.query(IpamPrefix)
        .filter(IpamPrefix.cidr == norm, IpamPrefix.vrf_bucket == vk)
        .first()
    )
    if row is not None:
        if _ptype_cf(row) != "pool":
            raise ValueError(
                f"The address plan already has a non-pool prefix at {norm} in this VRF; "
                "remove or change it before using the test LAN pool."
            )
        return row
    label = norm if len(norm) <= 200 else f"{norm[:197]}..."
    return create_ipam_prefix(
        db,
        name=f"Test LAN {label}"[:255],
        cidr=norm,
        vrf=vrf_name,
        prefix_type="pool",
        assigned_to_firewall_id=None,
        assigned_to_custom=None,
        description="Pool for automatic /24 assignments when adding test firewalls.",
        parent_pool_id=None,
        parent_assignment_id=None,
    )


def allocate_test_firewall_lan_assignment(
    db: Session,
    *,
    pool: IpamPrefix,
    firewall_id: int,
    firewall_name: str,
) -> tuple[str, str, str]:
    """
    Allocate the next free /24 under *pool*, assign it to *firewall_id*.

    Returns ``(assignment_cidr, lan_host_ipv4, netmask)`` for the synthetic LAN interface
    (host address at network + 16 within the /24).
    """
    next_cidr = suggest_next_assignment_cidr(
        db, parent_pool_id=int(pool.id), prefix_len=24
    )
    net = ipaddress.ip_network(next_cidr, strict=False)
    host_ip = str(net.network_address + 16)
    display_name = (firewall_name or "").strip() or f"Test FW #{firewall_id}"
    create_ipam_prefix(
        db,
        name=display_name[:255],
        cidr=next_cidr,
        vrf=pool.vrf,
        prefix_type="assignment",
        assigned_to_firewall_id=int(firewall_id),
        assigned_to_custom=None,
        description="Synthetic test firewall LAN /24.",
        parent_pool_id=int(pool.id),
        parent_assignment_id=None,
    )
    return next_cidr, host_ip, str(net.netmask)
