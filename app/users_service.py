from __future__ import annotations

import os
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.secrets_database import SecretsSessionLocal
from app.secrets_models import DEFAULT_ADMIN_USERNAME, AppUser

ADMIN_ROLE_KEYS = ("admin", "superadmin", "super admin")


def _role_counts_as_admin(role: str | None) -> bool:
    return str(role or "").strip().casefold() in frozenset(ADMIN_ROLE_KEYS)


_DESIGNER_CAPABLE_ROLE_KEYS_CF = frozenset({"designer", "superadmin", "super admin"})


def _role_counts_as_designer_capable(role: str | None) -> bool:
    return str(role or "").strip().casefold() in _DESIGNER_CAPABLE_ROLE_KEYS_CF


def user_row_public(row: AppUser) -> dict[str, Any]:
    return {
        "id": row.id,
        "username": row.username,
        "role": row.role,
        "full_name": row.full_name,
        "email": row.email,
        "mobile": row.mobile,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def ensure_default_admin_user(db: Session) -> None:
    row = db.scalars(
        select(AppUser).where(
            func.lower(AppUser.username) == DEFAULT_ADMIN_USERNAME.lower()
        )
    ).first()
    if row is None:
        u = AppUser(
            id=str(uuid.uuid4()),
            username=DEFAULT_ADMIN_USERNAME,
            role="admin",
            password_hash=None,
        )
        db.add(u)
        db.commit()
        return
    if os.environ.get("GROUND_CONTROL_UNDER_PYTEST") == "1":
        if not _role_counts_as_admin(row.role) and not _role_counts_as_designer_capable(
            row.role
        ):
            row.role = "admin"
            db.commit()


def password_hash_is_usable(raw: str | None) -> bool:
    if raw is None:
        return False
    return bool(str(raw).strip())


def app_user_has_password(row: AppUser) -> bool:
    return password_hash_is_usable(row.password_hash)


def _count_users_with_nonblank_password(db: Session) -> int:
    """Count users who have a real password (ORM — avoids SQLite trim/null edge cases)."""
    hashes = db.scalars(select(AppUser.password_hash)).all()
    return sum(1 for h in hashes if password_hash_is_usable(h))


def needs_initial_admin_password(db: Session) -> bool:
    ensure_default_admin_user(db)
    if _count_users_with_nonblank_password(db) > 0:
        return False
    total = int(db.scalar(select(func.count()).select_from(AppUser)) or 0)
    if total < 1:
        return False
    n_admin = int(
        db.scalar(
            select(func.count())
            .select_from(AppUser)
            .where(func.lower(AppUser.role).in_(ADMIN_ROLE_KEYS))
        )
        or 0
    )
    return n_admin >= 1


def bootstrap_setup_target_user_id(db: Session) -> str | None:
    if not needs_initial_admin_password(db):
        return None
    row = db.scalars(
        select(AppUser).where(
            func.lower(AppUser.username) == DEFAULT_ADMIN_USERNAME.lower(),
            func.lower(AppUser.role).in_(ADMIN_ROLE_KEYS),
        )
    ).first()
    if row:
        return row.id
    row = db.scalars(
        select(AppUser)
        .where(func.lower(AppUser.role).in_(ADMIN_ROLE_KEYS))
        .order_by(AppUser.created_at.asc())
    ).first()
    return row.id if row else None


def get_app_user_by_id(user_id: str) -> AppUser | None:
    with SecretsSessionLocal() as db:
        return db.get(AppUser, user_id)


def username_for_user_id(user_id: str) -> str:
    if not str(user_id).strip():
        return ""
    row = get_app_user_by_id(user_id)
    return (row.username if row else "") or ""


def get_app_user_by_username_db(db: Session, username: str) -> AppUser | None:
    u = username.strip()
    return db.scalars(
        select(AppUser).where(func.lower(AppUser.username) == func.lower(u))
    ).first()


def list_app_users(db: Session) -> list[dict[str, Any]]:
    ensure_default_admin_user(db)
    rows = db.scalars(
        select(AppUser).order_by(func.lower(AppUser.username))
    ).all()
    return [user_row_public(r) for r in rows]


def count_admins(db: Session) -> int:
    roles = tuple(str(r).casefold() for r in ADMIN_ROLE_KEYS)
    return int(
        db.scalar(
            select(func.count())
            .select_from(AppUser)
            .where(func.lower(AppUser.role).in_(roles))
        )
        or 0
    )


def insert_app_user(
    db: Session,
    *,
    username: str,
    role: str,
    password_hash: str,
    full_name: str | None = None,
    email: str | None = None,
    mobile: str | None = None,
) -> dict[str, Any]:
    ensure_default_admin_user(db)
    uid = str(uuid.uuid4())
    row = AppUser(
        id=uid,
        username=username.strip(),
        role=role,
        password_hash=password_hash,
        full_name=(full_name or "").strip() or None,
        email=(email or "").strip() or None,
        mobile=(mobile or "").strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return user_row_public(row)


def update_app_user_role(db: Session, user_id: str, role: str) -> dict[str, Any] | None:
    row = db.get(AppUser, user_id)
    if not row:
        return None
    row.role = role
    db.commit()
    db.refresh(row)
    return user_row_public(row)


def update_app_user_password_hash(db: Session, user_id: str, password_hash: str) -> bool:
    row = db.get(AppUser, user_id)
    if not row:
        return False
    row.password_hash = password_hash
    db.commit()
    return True


def update_app_user_username(db: Session, user_id: str, username: str) -> dict[str, Any] | None:
    """Rename a user; raises ValueError if username is empty or already taken."""
    row = db.get(AppUser, user_id)
    if not row:
        return None
    u = username.strip()
    if not u:
        raise ValueError("Username cannot be empty.")
    if u.lower() == (row.username or "").lower():
        return user_row_public(row)
    existing = get_app_user_by_username_db(db, u)
    if existing is not None and existing.id != user_id:
        raise ValueError("That username is already taken.")
    row.username = u
    db.commit()
    db.refresh(row)
    return user_row_public(row)


def update_app_user_profile_cols(
    db: Session, user_id: str, updates: dict[str, str | None]
) -> dict[str, Any] | None:
    allowed = frozenset({"full_name", "email", "mobile"})
    if not updates:
        row = db.get(AppUser, user_id)
        return user_row_public(row) if row else None
    bad = set(updates) - allowed
    if bad:
        raise ValueError(f"invalid profile column keys: {sorted(bad)}")
    row = db.get(AppUser, user_id)
    if not row:
        return None
    for k, v in updates.items():
        val = None if v is None else (str(v).strip() or None)
        setattr(row, k, val)
    db.commit()
    db.refresh(row)
    return user_row_public(row)


def delete_app_user(db: Session, user_id: str) -> bool:
    row = db.get(AppUser, user_id)
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True


def total_app_users(db: Session) -> int:
    return int(db.scalar(select(func.count()).select_from(AppUser)) or 0)
