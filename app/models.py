from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Firewall(Base):
    __tablename__ = "firewalls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    host: Mapped[str] = mapped_column(String(255))
    port: Mapped[int] = mapped_column(Integer, default=4444)
    username: Mapped[str] = mapped_column(String(255))
    api_request_timeout_seconds: Mapped[int] = mapped_column(
        Integer, default=120, nullable=False
    )
    verify_ssl: Mapped[bool] = mapped_column(Boolean, default=True)
    monitor_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    monitor_interval_minutes: Mapped[int] = mapped_column(Integer, default=5)
    device_hostname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    serial_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    firmware_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    license_info: Mapped[str | None] = mapped_column(String(512), nullable=True)
    firewall_subscriptions_json: Mapped[str] = mapped_column(
        Text, default="[]", nullable=False
    )
    webadmin_metadata_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    webadmin_last_collected_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now, onupdate=_utc_now
    )
    tags_json: Mapped[str] = mapped_column(Text, default="[]")
    is_test: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_online_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    def tags_list(self) -> list[str]:
        raw = self.tags_json or "[]"
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return []
        if not isinstance(data, list):
            return []
        out: list[str] = []
        for x in data:
            if isinstance(x, str):
                t = x.strip()
                if t:
                    out.append(t)
            elif isinstance(x, dict):
                n = x.get("name") if isinstance(x.get("name"), str) else None
                if n is None and isinstance(x.get("n"), str):
                    n = x.get("n")
                if isinstance(n, str):
                    t = n.strip()
                    if t:
                        out.append(t)
        return out

    def tags_sorted(self) -> list[str]:
        """Tag names for display, ordered case-insensitively."""
        return sorted(self.tags_list(), key=str.casefold)


class FirewallConfigEntry(Base):
    """Cached Interface / VLAN / Zone payload from a firewall API sync."""

    __tablename__ = "firewall_config_entries"
    __table_args__ = (
        UniqueConstraint(
            "firewall_id",
            "entity_type",
            "external_name",
            name="uq_fw_cfg_entity_name",
        ),
        Index("idx_fwce_type_fw", "entity_type", "firewall_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    firewall_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("firewalls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    external_name: Mapped[str] = mapped_column(String(512), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now, onupdate=_utc_now
    )


class FirewallConfigEntityPayloadField(Base):
    """
    One row per (entity_type, top-level payload_json key) discovered during firewall cache sync.

    ``json_value_kind`` is inferred from JSON values (``mixed`` when the same key appears with
    different kinds across appliances). ``dependent_on``, ``data_entry_type``,
    ``data_entry_properties``, ``show_as``, ``display_order``, and ``help_text`` are manual / UI
    metadata and stay unset by sync (except ``display_order`` on generated cache rows, which may be
    set to append).
    """

    __tablename__ = "firewall_config_entity_payload_fields"
    __table_args__ = (
        UniqueConstraint(
            "entity_type",
            "property_name",
            name="uq_fw_cfg_entity_payload_prop",
        ),
        Index("idx_fwcepf_entity_type", "entity_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    property_name: Mapped[str] = mapped_column(String(512), nullable=False)
    json_value_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    dependent_on: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_entry_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_entry_properties: Mapped[str | None] = mapped_column(Text, nullable=True)
    show_as: Mapped[str | None] = mapped_column(String(512), nullable=True)
    display_order: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    help_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    allowed_options: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: JSON array of cached ``entity_type`` strings (object-selector data sources for the field).
    data_source_entity_types: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now, onupdate=_utc_now
    )


class FirewallConfigSyncRun(Base):
    """One row per sync attempt (success or failure)."""

    __tablename__ = "firewall_config_sync_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    firewall_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("firewalls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    added_count: Mapped[int] = mapped_column(Integer, default=0)
    changed_count: Mapped[int] = mapped_column(Integer, default=0)
    deleted_count: Mapped[int] = mapped_column(Integer, default=0)


class TaskQueue(Base):
    """Pending outbound firewall configuration changes (applied via Sophos XML API)."""

    __tablename__ = "task_queue"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    firewall_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("firewalls.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    configuration_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("configurations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    external_name: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_by_username: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now, onupdate=_utc_now
    )


class TaskQueueCompleted(Base):
    """Task queue rows successfully pushed to a firewall (audit trail)."""

    __tablename__ = "task_queue_completed"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_task_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    firewall_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("firewalls.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    configuration_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("configurations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    external_name: Mapped[str] = mapped_column(String(512), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_by_username: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    completed_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    completed_by_username: Mapped[str | None] = mapped_column(String(200), nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)


class RefCountry(Base):
    """Country codes allowed in Country group flyouts (seeded from ``All Countries`` on sync)."""

    __tablename__ = "ref_countries"

    # Sophos payloads can exceed ISO alpha-2; merge restore must not fail on PostgreSQL varchar limits.
    code: Mapped[str] = mapped_column(String(64), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, onupdate=_utc_now)


class Configuration(Base):
    """Virtual firewall: editable local config cache (no device); changes can use the task queue."""

    __tablename__ = "configurations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now, onupdate=_utc_now
    )
    tags_json: Mapped[str] = mapped_column(Text, default="[]")
    member_firewall_ids_json: Mapped[str] = mapped_column(
        Text, default='{"tags":[],"firewall_ids":[]}'
    )
    cloned_from_firewall_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("firewalls.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    cloned_from_firewall: Mapped[Firewall | None] = relationship(
        foreign_keys=[cloned_from_firewall_id],
    )

    def tags_list(self) -> list[str]:
        raw = self.tags_json or "[]"
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return []
        if not isinstance(data, list):
            return []
        out: list[str] = []
        for x in data:
            if isinstance(x, str):
                t = x.strip()
                if t:
                    out.append(t)
        return out

    def member_assignment_tags_and_firewall_ids(self) -> tuple[list[str], list[int]]:
        """Explicit tag names and individual firewall ids (no tag expansion)."""
        raw = (self.member_firewall_ids_json or "").strip()
        if not raw:
            return [], []
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return [], []
        if isinstance(data, list):
            return [], self._parse_member_id_list(data)
        if isinstance(data, dict):
            tags_out: list[str] = []
            seen_t: set[str] = set()
            tags_raw = data.get("tags")
            if isinstance(tags_raw, list):
                for x in tags_raw:
                    if not isinstance(x, str):
                        continue
                    t = x.strip()
                    if not t:
                        continue
                    k = t.casefold()
                    if k in seen_t:
                        continue
                    seen_t.add(k)
                    tags_out.append(t)
            tags_out.sort(key=str.casefold)
            ids_raw = data.get("firewall_ids")
            if ids_raw is None:
                ids_raw = data.get("firewallIds")
            if not isinstance(ids_raw, list):
                ids_raw = []
            return tags_out, self._parse_member_id_list(ids_raw)
        return [], []

    @staticmethod
    def _parse_member_id_list(items: list[object]) -> list[int]:
        seen: set[int] = set()
        out: list[int] = []
        for x in items:
            try:
                n = int(x)
            except (TypeError, ValueError):
                continue
            if n > 0 and n not in seen:
                seen.add(n)
                out.append(n)
        out.sort()
        return out

    def member_firewall_ids_list(self) -> list[int]:
        """Individual firewall ids only (legacy JSON array = same; object uses ``firewall_ids``)."""
        return self.member_assignment_tags_and_firewall_ids()[1]

    def effective_member_firewall_ids(self, firewalls: Sequence[Firewall]) -> list[int]:
        """Union of individually selected firewalls and all firewalls matching selected tags."""
        tag_sel, id_sel = self.member_assignment_tags_and_firewall_ids()
        tag_want = {t.casefold() for t in tag_sel}
        fw_id_set = {int(fw.id) for fw in firewalls}
        seen: set[int] = set()
        out: list[int] = []
        for fid in id_sel:
            if fid in fw_id_set and fid not in seen:
                seen.add(fid)
                out.append(fid)
        for fw in firewalls:
            fid = int(fw.id)
            if fid in seen:
                continue
            for t in fw.tags_list():
                if t.casefold() in tag_want:
                    seen.add(fid)
                    out.append(fid)
                    break
        out.sort()
        return out


class ConfigurationConfigEntry(Base):
    """Cached entity payload for a Configuration (same shape as firewall_config_entries)."""

    __tablename__ = "configuration_config_entries"
    __table_args__ = (
        UniqueConstraint(
            "configuration_id",
            "entity_type",
            "external_name",
            name="uq_cfg_entity_name",
        ),
        Index("idx_cce_type_cfg", "entity_type", "configuration_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    configuration_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("configurations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    external_name: Mapped[str] = mapped_column(String(512), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now, onupdate=_utc_now
    )


class IpamPrefix(Base):
    """Local IP address plan (NIPAP-style prefixes); not synced from firewalls."""

    __tablename__ = "ipam_prefixes"
    __table_args__ = (
        UniqueConstraint("cidr", "vrf_bucket", name="uq_ipam_prefix_cidr_vrf"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    cidr: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    family: Mapped[int] = mapped_column(Integer, nullable=False)
    vrf: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    #: Canonical VRF bucket for uniqueness (matches app.ipam.vrf_key); not exposed in API payloads.
    vrf_bucket: Mapped[str] = mapped_column(
        String(128), nullable=False, default="default", index=True
    )
    prefix_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="assignment"
    )
    assigned_to_firewall_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("firewalls.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_to_custom: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Optional DHCP / DNS hostname for ``prefix_type`` host (Sophos static lease HostName).
    lease_hostname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    #: Optional MAC for ``prefix_type`` host (Sophos static lease MACAddress).
    mac_address: Mapped[str | None] = mapped_column(String(32), nullable=True)
    #: When ``prefix_type`` is pool: exclude from assignment/host parent pickers, discovery, and VRF conflicts.
    pool_unmanaged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now, onupdate=_utc_now
    )


class IpamVrf(Base):
    """Named VRFs for the address plan (suggested when creating prefixes)."""

    __tablename__ = "ipam_vrfs"
    __table_args__ = (UniqueConstraint("name", name="uq_ipam_vrf_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now, onupdate=_utc_now
    )


class FirewallConfigChangelogEntry(Base):
    """Per-object add/change/delete during a single sync run."""

    __tablename__ = "firewall_config_changelog"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sync_run_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("firewall_config_sync_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    firewall_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("firewalls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    external_name: Mapped[str] = mapped_column(String(512), nullable=False)
    action: Mapped[str] = mapped_column(String(16), nullable=False)
    old_payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)


class AccessSessionLog(Base):
    """Audit log for SSH/WebAdmin access session lifecycle events."""

    __tablename__ = "access_session_logs"
    __table_args__ = (
        Index("ix_access_session_logs_created_at", "created_at"),
        Index("ix_access_session_logs_firewall_created", "firewall_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    firewall_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("firewalls.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    access_type: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    event_kind: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    connected_successfully: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    initiated_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    initiated_by_username: Mapped[str | None] = mapped_column(String(200), nullable=True)
    client_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)
