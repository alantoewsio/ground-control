"""ORM models stored only in the secrets database (passwords and credentials)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SecretsBase(DeclarativeBase):
    pass


DEFAULT_ADMIN_USERNAME = "admin"


class AppUser(SecretsBase):
    __tablename__ = "app_users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    username: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    mobile: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now, onupdate=_utc_now
    )


class FirewallCredential(SecretsBase):
    """Encrypted firewall API password; keyed by firewall id in the main database."""

    __tablename__ = "firewall_credentials"

    firewall_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    password_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
