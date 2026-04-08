"""IPAM verification / conflict hints for Network · Interfaces table rows."""

from __future__ import annotations

import ipaddress
from typing import Any

from sqlalchemy.orm import Session

from app.interface_table import list_network_cidrs_from_flat
from app.ipam_conflicts import vrf_assignment_conflict_maps
from app.models import IpamPrefix


def _normalize_row_cidrs(flat: dict[str, str], entity_type: str) -> list[str]:
    out: list[str] = []
    for raw in list_network_cidrs_from_flat(flat, entity_type=entity_type):
        try:
            out.append(str(ipaddress.ip_network(raw.strip(), strict=False)))
        except ValueError:
            continue
    return out


def _truthy_enable(val: str) -> bool:
    return str(val or "").strip().lower() in ("enable", "1", "true", "yes")


def interface_network_defined_for_ipam(
    flat: dict[str, str], entity_type: str, norm_cidrs: list[str]
) -> bool:
    """
    True when the row represents a configured static (or alias) network address,
    not merely an empty or DHCP placeholder in cache.
    """
    if not norm_cidrs:
        return False
    et = (entity_type or "").strip().lower()
    if et == "alias":
        return True

    v4_conf = str(flat.get("IPv4Configuration") or "").strip()
    v6_conf = str(flat.get("IPv6Configuration") or "").strip()
    v4_assign = str(flat.get("IPv4Assignment") or flat.get("IPAssignment") or "").strip().lower()
    v6_assign = str(flat.get("IPv6Assignment") or "").strip().lower()

    def is_v6_cidr(c: str) -> bool:
        try:
            return ipaddress.ip_network(c, strict=False).version == 6
        except ValueError:
            return False

    has_v4 = any(not is_v6_cidr(c) for c in norm_cidrs)
    has_v6 = any(is_v6_cidr(c) for c in norm_cidrs)

    meta_present = bool(v4_conf or v6_conf or v4_assign or v6_assign)
    if not meta_present:
        return True

    v4_static = v4_assign == "static" and has_v4
    v6_static = v6_assign == "static" and has_v6

    v4_ok = v4_static and (not v4_conf or _truthy_enable(v4_conf))
    v6_ok = v6_static and (not v6_conf or _truthy_enable(v6_conf))
    return v4_ok or v6_ok


def _ipam_cell_for_scope(
    fw_id: int,
    flat: dict[str, str],
    et: str,
    *,
    ipam_conflict_ids: set[int],
    disc_conflict_keys: set[str],
    fw_cidr_to_pid: dict[tuple[int, str], int],
) -> str | None:
    norm_cidrs = _normalize_row_cidrs(flat, et)
    defined = interface_network_defined_for_ipam(flat, et, norm_cidrs)
    conflict = False
    verified = False
    for c in norm_cidrs:
        dkey = f"{fw_id}:{c}"
        if dkey in disc_conflict_keys:
            conflict = True
        pid = fw_cidr_to_pid.get((fw_id, c))
        if pid is not None:
            if pid in ipam_conflict_ids:
                conflict = True
            else:
                verified = True
    if conflict:
        return "conflict"
    if defined and verified:
        return "verified"
    return None


def attach_ipam_hints_to_interface_rows(db: Session, rows: list[dict[str, Any]]) -> None:
    """
    Sets ``ipam_cidr_cell`` on each row: ``\"verified\"``, ``\"conflict\"``, or omitted (no icon).

    - ``conflict``: any row CIDR is flagged by :func:`vrf_assignment_conflict_maps` (IPAM prefix
      or discovered same-VRF overlap).
    - ``verified``: a defined static/alias network is present and its CIDR exactly matches an
      IPAM assignment or host prefix assigned to the same firewall, and that prefix is not in
      conflict.
    """
    if not rows:
        return
    fw_ids: set[int] = set()
    for r in rows:
        if r.get("interfaces_row_combined"):
            for s0 in r.get("if_combine_sources") or []:
                if not isinstance(s0, dict):
                    continue
                fw = s0.get("firewall_id")
                if fw is not None:
                    fw_ids.add(int(fw))
        elif r.get("firewall_id") is not None:
            fw_ids.add(int(r["firewall_id"]))
    if not fw_ids:
        for r in rows:
            r.pop("ipam_cidr_cell", None)
        return

    ipam_conflict_ids, disc_conflict_keys = vrf_assignment_conflict_maps(db)

    assigned: list[IpamPrefix] = (
        db.query(IpamPrefix).filter(IpamPrefix.assigned_to_firewall_id.in_(fw_ids)).all()
    )
    fw_cidr_to_pid: dict[tuple[int, str], int] = {}
    for row in assigned:
        pt = (row.prefix_type or "").strip().casefold()
        if pt not in ("assignment", "host"):
            continue
        afw = row.assigned_to_firewall_id
        if afw is None:
            continue
        try:
            norm = str(ipaddress.ip_network(str(row.cidr).strip(), strict=False))
        except ValueError:
            continue
        fw_cidr_to_pid[(int(afw), norm)] = int(row.id)

    maps_kw = {
        "ipam_conflict_ids": ipam_conflict_ids,
        "disc_conflict_keys": disc_conflict_keys,
        "fw_cidr_to_pid": fw_cidr_to_pid,
    }

    for r in rows:
        if r.get("interfaces_row_combined"):
            srcs = r.get("if_combine_sources")
            if not isinstance(srcs, list) or not srcs:
                r.pop("ipam_cidr_cell", None)
                continue
            states: list[tuple[str | None, bool]] = []
            for s0 in srcs:
                if not isinstance(s0, dict):
                    continue
                fw = s0.get("firewall_id")
                if fw is None:
                    continue
                flat = s0.get("flat")
                if not isinstance(flat, dict):
                    flat = {}
                et = str(s0.get("entity_type") or "")
                norm_cidrs = _normalize_row_cidrs(flat, et)
                defined = interface_network_defined_for_ipam(flat, et, norm_cidrs)
                cell = _ipam_cell_for_scope(int(fw), flat, et, **maps_kw)
                states.append((cell, defined))
            if not states:
                r.pop("ipam_cidr_cell", None)
                continue
            if any(x[0] == "conflict" for x in states):
                r["ipam_cidr_cell"] = "conflict"
            elif any(x[1] for x in states) and all(
                x[0] == "verified" for x in states if x[1]
            ):
                r["ipam_cidr_cell"] = "verified"
            else:
                r.pop("ipam_cidr_cell", None)
            continue

        fw_id = r.get("firewall_id")
        if fw_id is None:
            r.pop("ipam_cidr_cell", None)
            continue
        flat = r.get("flat")
        if not isinstance(flat, dict):
            flat = {}
        et = str(r.get("entity_type") or "")
        cell = _ipam_cell_for_scope(int(fw_id), flat, et, **maps_kw)
        if cell:
            r["ipam_cidr_cell"] = cell
        else:
            r.pop("ipam_cidr_cell", None)
