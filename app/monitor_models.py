from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MonitorBase(DeclarativeBase):
    pass


class FirewallWebadminPing(MonitorBase):
    """One probe of a firewall web admin TCP port (linked by firewall id in the app DB)."""

    __tablename__ = "firewall_webadmin_pings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    firewall_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    checked_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now, nullable=False, index=True
    )
    response_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class FirewallConnectivityRollup(MonitorBase):
    """
    Aggregated connectivity stats for MRTG-style long history.
    resolution: 'hour' — from raw pings; 'day' — from hourly rollups.
    """

    __tablename__ = "firewall_connectivity_rollups"
    __table_args__ = (
        UniqueConstraint(
            "firewall_id",
            "period_start",
            "resolution",
            name="uq_fw_connectivity_roll_period",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    firewall_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    period_start: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    resolution: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False)
    ok_count: Mapped[int] = mapped_column(Integer, nullable=False)
    fail_count: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_response_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_response_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_response_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
