"""Registry of named VRFs for Address Management."""

from __future__ import annotations

from typing import Any

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.ipam import vrf_key
from app.models import IpamPrefix, IpamVrf

DEFAULT_IPAM_VRF_NAME = "default"
DEFAULT_IPAM_VRF_DESCRIPTION = (
    "Built-in default VRF. Created automatically for new installs."
)


def ensure_default_ipam_vrf_exists(db: Session) -> None:
    """Ensure a ``default`` VRF row exists (idempotent)."""
    has = (
        db.query(IpamVrf.id)
        .filter(func.lower(IpamVrf.name) == DEFAULT_IPAM_VRF_NAME)
        .first()
    )
    if has is not None:
        return
    row = IpamVrf(
        name=DEFAULT_IPAM_VRF_NAME,
        description=DEFAULT_IPAM_VRF_DESCRIPTION,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()


def normalize_ipam_vrf_name(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        raise ValueError("VRF name is required.")
    if len(s) > 128:
        raise ValueError("VRF name must be at most 128 characters.")
    return s


def list_ipam_vrf_payloads(db: Session) -> list[dict[str, Any]]:
    rows = db.query(IpamVrf).order_by(IpamVrf.name.asc()).all()
    out: list[dict[str, Any]] = []
    for row in rows:
        vk = vrf_key(row.name)
        cnt = (
            db.query(func.count(IpamPrefix.id))
            .filter(IpamPrefix.vrf_bucket == vk)
            .scalar()
        )
        out.append(
            {
                "id": int(row.id),
                "name": row.name,
                "description": (row.description or "").strip(),
                "prefix_count": int(cnt or 0),
            }
        )
    return out


def create_ipam_vrf(
    db: Session, *, name: str, description: str | None
) -> IpamVrf:
    nm = normalize_ipam_vrf_name(name)
    desc = (description or "").strip() or None
    if desc and len(desc) > 500:
        raise ValueError("Description must be at most 500 characters.")
    row = IpamVrf(name=nm, description=desc)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(row)
    return row
