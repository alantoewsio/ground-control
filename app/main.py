from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
import os
import zipfile
import random
import secrets
import signal
import sys
import threading
import time
import tomllib
import traceback
import uuid
from contextlib import asynccontextmanager, contextmanager
from types import FrameType
from typing import Annotated, Any, Callable, Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import uvicorn
from fastapi import (
    BackgroundTasks,
    Body,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    WebSocket,
)
from fastapi.exception_handlers import (
    http_exception_handler,
    request_validation_exception_handler,
)
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, tuple_
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import Session, joinedload
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.requests import HTTPConnection
from starlette.responses import PlainTextResponse, Response

from app import (
    background_activity,
    config,
    crypto,
    data_management,
    security_settings,
    users_service,
)
from app.history_retention import run_history_retention_sweep
from app.backup_crypto import encrypt_backup_archive
from app.backup_password import (
    backup_password_is_configured,
    backup_password_status_payload,
    get_saved_backup_password,
    set_backup_password,
)
from app.backup_restore import (
    BackupBuildResult,
    build_backup_zip,
    generated_backup_status_payload,
    read_generated_backup_bytes,
    restore_backup_merge,
    save_generated_backup,
)
from app.access_history import (
    create_access_log,
    get_or_create_webadmin_session_id,
    has_webadmin_session_id,
    pop_webadmin_session_id,
    request_actor,
    request_client_ip,
)
from app.access_launch_tokens import (
    TOKEN_QUERY_PARAM,
    issue_launch_token,
    validate_and_consume_launch_token,
)
from app.auth import (
    SESSION_USER_ID_KEY,
    evaluate_session_idle,
    get_session_secret,
    hash_password,
    list_active_admin_sessions,
    register_authenticated_session,
    require_admin_user_id,
    require_authenticated_user_id,
    require_browser_json_session,
    session_idle_timeout_seconds,
    session_user_id,
    touch_session_activity,
    unregister_authenticated_session,
    validate_new_password,
    verify_password,
)
from app.auth_identity_table import (
    build_admin_profile_options_payload,
    build_auth_user_group_table_payload,
    build_auth_user_table_payload,
    build_user_group_options_payload,
)
from app.browser_ws_echo import browser_ws_echo_handler, get_browser_ws_echo_snapshot
from app.config_viewer_tree import build_config_viewer_tree
from app.configuration_config_apply import (
    apply_configuration_alias_create,
    apply_configuration_alias_update,
    apply_configuration_bridge_pair_create,
    apply_configuration_bridge_pair_update,
    apply_configuration_hs_deletes_batch,
    apply_configuration_hs_entity_create_many,
    apply_configuration_hs_entity_update_batch,
    apply_configuration_interface_update,
    apply_configuration_ip_host_create,
    apply_configuration_ip_host_create_many,
    apply_configuration_ip_host_delete_batch,
    apply_configuration_ip_host_update,
    apply_configuration_ip_host_update_batch,
    apply_configuration_lag_create,
    apply_configuration_lag_update,
    apply_configuration_network_entity_deletes_batch,
    apply_configuration_vlan_create,
    apply_configuration_vlan_update,
    apply_configuration_zone_create_batch,
    apply_configuration_zone_update,
    apply_configuration_zone_update_batch,
)
from app.configuration_payload import (
    configuration_hosts_services_table_payload,
    configuration_network_table_payload,
    configuration_unified_interfaces_payload,
)
from app.dashboard_metrics import (
    build_dashboard_payload,
    parse_firewall_ids_query,
)
from app.database import SessionLocal, get_db, init_db
from app.db_utils import chunked_in_query
from app.firewall_api_client import normalize_firewall_api_timeout_seconds
from app.firewall_config_sync import (
    ENTITY_ALIAS,
    ENTITY_BRIDGE_PAIR,
    ENTITY_INTERFACE,
    ENTITY_LAG,
    ENTITY_TYPES_INTERFACES_TAB,
    ENTITY_VLAN,
    ENTITY_ZONE,
    list_sync_entity_catalog,
    run_firewall_config_sync,
)
from app.firewall_connectivity import firewall_is_online
from app.firewall_rule_table import build_firewall_rule_table_payload
from app.firewall_ssh import (
    build_firewall_ssh_diagnostics,
    firewall_ssh_terminal_ws,
    get_firewall_ssh_ws_snapshot,
    refresh_firewall_ssh_device_info,
)
from app.hosts_services_table import (
    aggregate_ip_hostgroups_for_configurations,
    aggregate_ip_hostgroups_for_firewalls,
    aggregate_named_entities_for_configurations,
    aggregate_named_entities_for_firewalls,
    build_hosts_services_table_rows,
    build_hs_table_rows_combined,
    build_ip_host_table_rows_combined,
    list_fqdn_hostgroups_for_configuration,
    list_fqdn_hostgroups_for_firewall,
    list_ip_hostgroups_for_configuration,
    list_ip_hostgroups_for_firewall,
)
from app.interface_combine_ipam import enrich_interface_payload_combine_sources_ipam
from app.interface_ipam_hints import attach_ipam_hints_to_interface_rows
from app.interface_table import (
    build_interface_table_rows,
    build_unified_interfaces_tab_rows,
    build_unified_interfaces_tab_rows_combined,
    build_zone_network_table_rows,
    build_zone_network_table_rows_flat,
    interface_payload_is_lag_master,
    lag_hardware_name_from_payload,
    merge_zone_combined_payloads_cross_scope,
)
from app.ipam import (
    IpamDuplicateCidrError,
    build_ipam_form_meta,
    create_ipam_prefix,
    delete_ipam_prefix,
    ipam_prefix_row_payload,
    list_ipam_prefix_payloads,
    suggest_next_assignment_cidr,
    update_ipam_prefix,
)
from app.ipam_conflicts import (
    accept_all_eligible_discoveries,
    vrf_assignment_conflict_maps,
)
from app.ipam_discovered import (
    accept_discovered_assignment,
    list_discovered_assignment_payloads,
)
from app.ipam_interface_pool import (
    commit_interface_static_to_ipam_pool,
    resolve_ipv4_pool_address_for_interface,
)
from app.ipam_vrf import create_ipam_vrf, list_ipam_vrf_payloads
from app.ips_custom_signature_merge import (
    IPS_CUSTOM_SIG_ACTION_OPTIONS,
    IPS_CUSTOM_SIG_PROTOCOL_OPTIONS,
    IPS_CUSTOM_SIG_SEVERITY_OPTIONS,
)
from app.ips_custom_signature_table import build_ips_custom_signature_table_payload
from app.ips_policy_constants import (
    IPS_POLICY_ACTIONS,
    IPS_POLICY_CATEGORIES,
    IPS_POLICY_PLATFORMS,
    IPS_POLICY_RULE_TYPES,
    IPS_POLICY_SEVERITIES,
    IPS_POLICY_SIGNATURE_SELECTION,
    IPS_POLICY_TARGETS,
)
from app.ips_policy_table import build_ips_policy_table_payload
from app.ips_switch import build_ips_switch_table_payload
from app.ips_trusted_mac_table import build_ips_trusted_mac_table_payload
from app.models import (
    AccessSessionLog,
    Configuration,
    ConfigurationConfigEntry,
    Firewall,
    FirewallConfigChangelogEntry,
    FirewallConfigEntry,
    FirewallConfigSyncRun,
    RefCountry,
    TaskQueue,
)
from app.monitor_database import get_monitor_db, init_monitor_db
from app.monitor_scheduler import start_monitor_scheduler, stop_monitor_scheduler
from app.monitor_series import get_connectivity_series
from app.profiles_entities_table import (
    build_access_time_policy_table_payload,
    build_admin_profile_table_payload,
    build_data_transfer_policy_table_payload,
    build_schedule_table_payload,
    build_surfing_quota_policy_table_payload,
    build_vpn_profile_table_payload,
)
from app.ref_countries import (
    list_ref_country_codes_payload,
    try_seed_ref_countries_from_cache,
)
from app.secrets_database import (
    SecretsSessionLocal,
    delete_firewall_credential,
    get_firewall_password_encrypted,
    get_secrets_db,
    init_secrets_db,
    upsert_firewall_password_encrypted,
)
from app.secrets_models import DEFAULT_ADMIN_USERNAME, AppUser
from app.sophos_connect import test_connection
from app.task_queue_service import (
    BridgePairCreateCacheConflictError,
    LagCreateCacheConflictError,
    completed_task_compare_payload,
    delete_tasks,
    enqueue_admin_profile_create,
    enqueue_admin_profile_deletes_batch,
    enqueue_admin_profile_update,
    enqueue_alias_create,
    enqueue_alias_update,
    enqueue_auth_user_create,
    enqueue_auth_user_deletes_batch,
    enqueue_auth_user_group_create,
    enqueue_auth_user_group_deletes_batch,
    enqueue_auth_user_group_update,
    enqueue_auth_user_update,
    enqueue_bridge_pair_create,
    enqueue_bridge_pair_update,
    enqueue_config_viewer_deletes_for_configuration,
    enqueue_config_viewer_deletes_for_firewall,
    enqueue_configuration_apply_to_firewalls,
    enqueue_dos_settings_update,
    enqueue_firewall_rule_reorder_batch,
    enqueue_hs_deletes_batch,
    enqueue_hs_entity_create_many,
    enqueue_hs_entity_update_batch,
    enqueue_interface_update,
    enqueue_ip_host_create,
    enqueue_ip_host_create_many,
    enqueue_ip_host_delete_batch,
    enqueue_ip_host_update,
    enqueue_ip_host_update_batch,
    enqueue_ips_custom_signature_create,
    enqueue_ips_custom_signature_create_batch,
    enqueue_ips_custom_signature_deletes_batch,
    enqueue_ips_custom_signature_update,
    enqueue_ips_policy_create,
    enqueue_ips_policy_deletes_batch,
    enqueue_ips_policy_update,
    enqueue_ips_switch_updates_batch,
    enqueue_ips_trusted_mac_create_batch,
    enqueue_ips_trusted_mac_deletes_batch,
    enqueue_ips_trusted_mac_update,
    enqueue_lag_create,
    enqueue_lag_update,
    enqueue_network_entity_deletes_batch,
    enqueue_profile_entity_create_batch,
    enqueue_profile_entity_deletes_batch,
    enqueue_profile_entity_update_batch,
    enqueue_spoof_prevention_update,
    enqueue_vlan_update,
    enqueue_webfilter_policy_create,
    enqueue_webfilter_policy_deletes_batch,
    enqueue_webfilter_policy_update,
    enqueue_zone_create_batch,
    enqueue_zone_update,
    enqueue_zone_update_batch,
    filter_sendable_task_ids_in_order,
    firewall_changelog_compare_payload,
    firewall_sync_run_details_payload,
    list_completed_tasks_with_firewall_page,
    list_sendable_task_ids,
    list_tasks_with_firewall,
    list_tasks_with_firewall_page,
    process_task,
    run_post_task_queue_syncs,
    TASK_QUEUE_BATCH_IDS_MAX,
    task_queue_badge_summary,
    task_queue_compare_payload,
)
from app.test_firewall_interface_seed import (
    SyntheticFwPortLayout,
    random_port_layout,
    synthetic_interface_config_entry_tuples,
)
from app.test_firewall_ipam import (
    allocate_test_firewall_lan_assignment,
    ensure_test_fw_lan_pool,
)
from app.url_helpers import (
    https_admin_url_for_firewall,
    is_same_origin_value,
    request_is_https_session,
    webadmin_entry_url,
)
from app.web_protect_cache_table import (
    build_url_group_table_payload,
    build_user_activity_table_payload,
)
from app.webadmin_leak_redirect import WebadminLeakedPathRedirectMiddleware
from app.webadmin_proxy import stream_firewall_webadmin, try_auto_login_webadmin
from app.webfilter_policy_table import build_webfilter_policy_table_payload


def _load_app_about() -> dict[str, str]:
    path = config.BASE_DIR / "pyproject.toml"
    version = "0.3.0"
    description = ""
    project_name = ""
    try:
        with path.open("rb") as f:
            data = tomllib.load(f)
        proj = data.get("project") or {}
        if proj.get("name"):
            project_name = str(proj["name"]).strip()
        if proj.get("description"):
            description = str(proj["description"]).strip()
        if proj.get("version"):
            version = str(proj["version"]).strip()
    except OSError:
        pass
    return {
        "app_name": "Ground Control",
        "project_name": project_name,
        "description": description,
        "app_version": version,
        "license": "See the project repository for licensing information.",
    }


APP_ABOUT = _load_app_about()

_gc_bg_log = logging.getLogger("ground_control")
_GC_BG_ASYNC_MSG = "Running in the background. You can keep navigating; refresh lists when it finishes."


def _bg_firewall_config_sync(
    firewall_id: int,
    entities: list[str] | None,
    entities_explicit: bool,
    user_id: str,
) -> None:
    db = None
    sdb = None
    try:
        db = SessionLocal()
        sdb = SecretsSessionLocal()
        run_firewall_config_sync(
            db,
            sdb,
            firewall_id,
            entities=entities,
            entities_explicit=entities_explicit,
        )
    except Exception:
        _gc_bg_log.exception(
            "Background firewall config-sync failed (firewall_id=%s)", firewall_id
        )
    finally:
        if sdb is not None:
            sdb.close()
        if db is not None:
            db.close()
        background_activity.unregister(user_id)


def _bg_task_queue_send(task_id: int, user_id: str, username: str) -> None:
    db = None
    sdb = None
    try:
        db = SessionLocal()
        sdb = SecretsSessionLocal()
        process_task(
            db,
            sdb,
            task_id,
            completed_by_user_id=user_id,
            completed_by_username=username,
        )
    except Exception:
        _gc_bg_log.exception("Background task-queue send failed (task_id=%s)", task_id)
    finally:
        if sdb is not None:
            sdb.close()
        if db is not None:
            db.close()
        background_activity.unregister(user_id)


def _bg_task_queue_send_batch(task_ids: list[int], user_id: str, username: str) -> None:
    db = None
    sdb = None
    try:
        db = SessionLocal()
        sdb = SecretsSessionLocal()
        by_fw: dict[int, set[str]] = {}
        for tid in task_ids:
            result = process_task(
                db,
                sdb,
                tid,
                completed_by_user_id=user_id,
                completed_by_username=username,
                defer_post_sync=True,
            )
            if result.get("ok"):
                ds = result.get("deferred_sync")
                if isinstance(ds, dict):
                    fid = ds.get("firewall_id")
                    if fid is not None:
                        for eid in ds.get("entity_ids") or []:
                            by_fw.setdefault(int(fid), set()).add(str(eid))
        run_post_task_queue_syncs(db, sdb, by_fw)
    except Exception:
        _gc_bg_log.exception("Background task-queue batch failed")
    finally:
        if sdb is not None:
            sdb.close()
        if db is not None:
            db.close()
        background_activity.unregister(user_id)


def auth_client_state(request: Request, db: Session) -> dict[str, Any]:
    """Browser/client auth snapshot (same shape as GET /api/auth/status). Used for first paint and API."""
    users_service.ensure_default_admin_user(db)
    need_setup = users_service.needs_initial_admin_password(db)
    uid = session_user_id(request)
    if uid:
        idle_sec = session_idle_timeout_seconds()
        idle_state, _ = evaluate_session_idle(request, idle_sec)
        if idle_state == "expired":
            uid = None
        else:
            touch_session_activity(request)
            row = db.get(AppUser, uid)
            if row and users_service.app_user_has_password(row):
                return {
                    "authenticated": True,
                    "needs_admin_password_setup": False,
                    "user": users_service.user_row_public(row),
                    "session_idle_timeout_minutes": config.session_idle_timeout_minutes(),
                }
        unregister_authenticated_session(request)
        request.session.pop(SESSION_USER_ID_KEY, None)
    return {
        "authenticated": False,
        "needs_admin_password_setup": need_setup,
        "default_admin_username": DEFAULT_ADMIN_USERNAME if need_setup else None,
        "user": None,
        "session_idle_timeout_minutes": config.session_idle_timeout_minutes(),
    }


def nav_firewalls_multiselect_json(
    db: Session, request: Request | None = None
) -> list[dict[str, Any]]:
    """Payload for the top-bar firewall/tag multiselect and GET /api/firewalls/nav-multiselect."""
    rows = (
        db.query(Firewall)
        .order_by(Firewall.name.asc().nulls_last(), Firewall.host.asc())
        .all()
    )
    out: list[dict[str, Any]] = []
    for f in rows:
        online = firewall_is_online(f)
        desc = (f.description or "").strip()
        entry: dict[str, Any] = {
            "id": f.id,
            "label": (f.name or f.host or str(f.id)).strip(),
            "tags": f.tags_list(),
            "description": desc if desc else None,
            "online": online,
        }
        if request is not None:
            entry["urls"] = {
                "webadmin": webadmin_entry_url(
                    request, firewall_id=f.id, host=f.host, port=f.port
                ),
                "ssh": str(
                    request.url_for("firewall_ssh_terminal_page", firewall_id=f.id)
                ),
                "monitor": str(
                    request.url_for("firewall_monitor_page", firewall_id=f.id)
                ),
                "sync": str(
                    request.url_for("api_firewall_config_sync", firewall_id=f.id)
                ),
                "test": str(request.url_for("gc_test_firewall", firewall_id=f.id)),
            }
        out.append(entry)
    return out


def nav_configurations_multiselect_json(db: Session) -> list[dict[str, Any]]:
    """Payload for the top-bar configuration multiselect and GET /api/configurations/nav-multiselect."""
    rows = (
        db.query(Configuration)
        .order_by(Configuration.name.asc().nulls_last(), Configuration.id.asc())
        .all()
    )
    return [
        {
            "id": c.id,
            "label": (c.name or str(c.id)).strip(),
            "tags": c.tags_list(),
        }
        for c in rows
    ]


def template_nav_firewall_context(
    request: Request,
    sdb: Session,
    db: Session | None,
    *,
    skip_global_fw_table_filter: bool = False,
    nav_firewall_rows: list[Firewall] | None = None,
) -> dict[str, Any]:
    """Top-bar firewall multiselect context (embedded JSON + optional ORM rows).

    ``nav_firewalls_add_json`` is embedded in ``base.html`` so the selector works
    on first paint without a race on async fetch.  Pass ``nav_firewall_rows`` only
    on pages that render a server-side firewall dropdown (e.g. inventory import);
    otherwise ``nav_firewalls`` is left empty to avoid loading every firewall row
    on every page.
    """
    ac = auth_client_state(request, sdb)
    out: dict[str, Any] = {
        "nav_firewalls": [],
        "nav_firewalls_add_json": [],
        "nav_configurations_add_json": [],
        "network_fw_selection_user_id": None,
        "skip_global_fw_table_filter": skip_global_fw_table_filter,
    }
    uid = session_user_id(request)
    if not ac.get("authenticated") or not uid or db is None:
        return out
    out["network_fw_selection_user_id"] = uid
    out["nav_firewalls_add_json"] = nav_firewalls_multiselect_json(db, request)
    out["nav_configurations_add_json"] = nav_configurations_multiselect_json(db)
    if nav_firewall_rows is not None:
        out["nav_firewalls"] = nav_firewall_rows
    return out


_MONITOR_RANGES = frozenset({"24h", "48h", "7d", "30d", "365d"})


def _firewall_cached_sync_entity_map(
    db: Session, firewall_ids: list[int]
) -> dict[int, list[str]]:
    """Distinct entity_type values per firewall from config cache (for Inventory UI)."""
    if not firewall_ids:
        return {}
    rows = chunked_in_query(
        lambda chunk: (
            db.query(FirewallConfigEntry.firewall_id, FirewallConfigEntry.entity_type)
            .filter(FirewallConfigEntry.firewall_id.in_(chunk))
            .distinct()
            .all()
        ),
        firewall_ids,
    )
    buckets: dict[int, set[str]] = {fid: set() for fid in firewall_ids}
    for fid, et in rows:
        if fid in buckets and et:
            buckets[fid].add(et)
    return {fid: sorted(types) for fid, types in buckets.items()}


def _distinct_firewall_tag_suggestions(firewalls: list[Firewall]) -> list[str]:
    """Unique tags used on any firewall, sorted case-insensitively (first spelling kept)."""
    seen: set[str] = set()
    out: list[str] = []
    for fw in firewalls:
        for t in fw.tags_list():
            k = t.casefold()
            if k in seen:
                continue
            seen.add(k)
            out.append(t)
    out.sort(key=str.casefold)
    return out


class IpamPrefixWriteBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    cidr: str = Field(..., min_length=1, max_length=128)
    vrf: str = Field(..., min_length=1, max_length=128)
    prefix_type: str = Field(default="assignment", max_length=32)
    parent_pool_id: int | None = None
    parent_assignment_id: int | None = None
    assigned_to_firewall_id: int | None = Field(default=None, gt=0)
    assigned_to_custom: str | None = Field(default=None, max_length=255)
    description: str | None = None
    pool_unmanaged: bool = False

    @field_validator("vrf", mode="before")
    @classmethod
    def vrf_required_strip(cls, v: object) -> str:
        if v is None:
            raise ValueError("VRF is required.")
        s = str(v).strip()
        if not s:
            raise ValueError("VRF is required.")
        return s


class IpamVrfWriteBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=500)


class IpamAcceptDiscoveredBody(BaseModel):
    firewall_id: int = Field(..., gt=0)
    cidr: str = Field(..., min_length=1, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)
    assigned_to_firewall_id: int | None = Field(default=None, gt=0)
    assigned_to_custom: str | None = Field(default=None, max_length=255)
    pool_cidr: str | None = Field(default=None, max_length=128)
    pool_name: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=500)


class IpamInterfacePoolCommitBody(BaseModel):
    firewall_id: int = Field(..., gt=0)
    parent_pool_id: int = Field(..., gt=0)
    ipv4_ip: str = Field(..., min_length=1, max_length=64)
    ipv4_netmask: str = Field(..., min_length=1, max_length=64)
    description: str | None = Field(default=None, max_length=500)


class IpsSwitchEnqueueItem(BaseModel):
    config_entry_id: int = Field(..., gt=0)
    status: Literal["Enable", "Disable"]


class EnqueueIpsSwitchBatchBody(BaseModel):
    items: list[IpsSwitchEnqueueItem] = Field(
        ..., min_length=1, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


class EnqueueIpsPolicyDeleteBatchBody(BaseModel):
    config_entry_ids: list[int] = Field(
        ..., min_length=1, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


class EnqueueIpsPolicyCreateBody(BaseModel):
    firewall_id: int = Field(..., gt=0)
    policy: dict[str, Any] = Field(default_factory=dict)


class EnqueueIpsPolicyUpdateBody(BaseModel):
    config_entry_id: int = Field(..., gt=0)
    policy: dict[str, Any] = Field(default_factory=dict)


class EnqueueWebfilterPolicyDeleteBatchBody(BaseModel):
    config_entry_ids: list[int] = Field(
        ..., min_length=1, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


class EnqueueWebfilterPolicyCreateBody(BaseModel):
    firewall_id: int = Field(..., gt=0)
    policy: dict[str, Any] = Field(default_factory=dict)


class EnqueueWebfilterPolicyUpdateBody(BaseModel):
    config_entry_id: int = Field(..., gt=0)
    policy: dict[str, Any] = Field(default_factory=dict)


class EnqueueAuthUserDeleteBatchBody(BaseModel):
    config_entry_ids: list[int] = Field(
        ..., min_length=1, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


class EnqueueAuthUserCreateBody(BaseModel):
    firewall_id: int = Field(..., gt=0)
    user: dict[str, Any] = Field(default_factory=dict)


class EnqueueAuthUserUpdateBody(BaseModel):
    config_entry_id: int = Field(..., gt=0)
    user: dict[str, Any] = Field(default_factory=dict)


class EnqueueAuthUserGroupDeleteBatchBody(BaseModel):
    config_entry_ids: list[int] = Field(
        ..., min_length=1, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


class EnqueueAuthUserGroupCreateBody(BaseModel):
    firewall_id: int = Field(..., gt=0)
    group: dict[str, Any] = Field(default_factory=dict)


class EnqueueAuthUserGroupUpdateBody(BaseModel):
    config_entry_id: int = Field(..., gt=0)
    group: dict[str, Any] = Field(default_factory=dict)


class EnqueueAdminProfileDeleteBatchBody(BaseModel):
    config_entry_ids: list[int] = Field(
        ..., min_length=1, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


class EnqueueAdminProfileCreateBody(BaseModel):
    firewall_id: int = Field(..., gt=0)
    profile: dict[str, Any] = Field(default_factory=dict)


class EnqueueAdminProfileUpdateBody(BaseModel):
    config_entry_id: int = Field(..., gt=0)
    profile: dict[str, Any] = Field(default_factory=dict)


class EnqueueProfileEntityCreateBatchBody(BaseModel):
    entity_type: str = Field(..., min_length=1)
    firewall_ids: list[int] = Field(
        ..., min_length=1, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )
    payload: dict[str, Any] = Field(default_factory=dict)


class EnqueueProfileEntityUpdateBatchBody(BaseModel):
    config_entry_ids: list[int] = Field(
        ..., min_length=1, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )
    payload: dict[str, Any] = Field(default_factory=dict)


class EnqueueProfileEntityDeletesBatchBody(BaseModel):
    config_entry_ids: list[int] = Field(
        ..., min_length=1, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


class EnqueueIpsCustomSignatureDeleteBatchBody(BaseModel):
    config_entry_ids: list[int] = Field(
        ..., min_length=1, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


class EnqueueIpsCustomSignatureCreateBody(BaseModel):
    firewall_id: int = Field(..., gt=0)
    signature: dict[str, Any] = Field(default_factory=dict)


class EnqueueIpsCustomSignatureCreateBatchBody(BaseModel):
    firewall_ids: list[int] = Field(
        ..., min_length=1, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )
    signature: dict[str, Any] = Field(default_factory=dict)


class EnqueueIpsCustomSignatureUpdateBody(BaseModel):
    config_entry_id: int = Field(..., gt=0)
    signature: dict[str, Any] = Field(default_factory=dict)


class EnqueueIpsTrustedMacDeleteBatchBody(BaseModel):
    config_entry_ids: list[int] = Field(
        ..., min_length=1, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


class EnqueueIpsTrustedMacCreateBatchBody(BaseModel):
    firewall_ids: list[int] = Field(
        ..., min_length=1, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )
    trusted_mac: dict[str, Any] = Field(default_factory=dict)


class EnqueueIpsTrustedMacUpdateBody(BaseModel):
    config_entry_id: int = Field(..., gt=0)
    trusted_mac: dict[str, Any] = Field(default_factory=dict)


class EnqueueDosSettingsUpdateBody(BaseModel):
    firewall_id: int = Field(..., gt=0)
    settings: dict[str, Any] = Field(default_factory=dict)


class EnqueueSpoofPreventionUpdateBody(BaseModel):
    firewall_id: int = Field(..., gt=0)
    settings: dict[str, Any] = Field(default_factory=dict)


class EnqueueInterfaceUpdateBody(BaseModel):
    config_entry_id: int = Field(..., gt=0)
    form: dict[str, Any] = Field(default_factory=dict)


class VlanCreateConfigurationBody(BaseModel):
    configuration_id: int = Field(..., gt=0)
    form: dict[str, Any] = Field(default_factory=dict)


class BridgePairCreateConfigurationBody(BaseModel):
    configuration_id: int = Field(..., gt=0)
    form: dict[str, Any] = Field(default_factory=dict)


class LagCreateConfigurationBody(BaseModel):
    configuration_id: int = Field(..., gt=0)
    form: dict[str, Any] = Field(default_factory=dict)
    force: bool = False


class AliasCreateConfigurationBody(BaseModel):
    configuration_id: int = Field(..., gt=0)
    form: dict[str, Any] = Field(default_factory=dict)


class EnqueueBridgePairCreateBody(BaseModel):
    firewall_id: int = Field(..., gt=0)
    form: dict[str, Any] = Field(default_factory=dict)
    force: bool = False


class EnqueueLagCreateBody(BaseModel):
    firewall_id: int = Field(..., gt=0)
    form: dict[str, Any] = Field(default_factory=dict)
    force: bool = False


class EnqueueAliasCreateBody(BaseModel):
    firewall_id: int = Field(..., gt=0)
    form: dict[str, Any] = Field(default_factory=dict)


class EnqueueIpHostUpdateBody(BaseModel):
    config_entry_id: int = Field(..., gt=0)
    form: dict[str, Any] = Field(default_factory=dict)


class EnqueueIpHostUpdateBatchBody(BaseModel):
    config_entry_ids: list[int] = Field(
        default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )
    form: dict[str, Any] = Field(default_factory=dict)


class EnqueueIpHostDeleteBatchBody(BaseModel):
    config_entry_ids: list[int] = Field(
        default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


class EnqueueIpHostCreateBody(BaseModel):
    firewall_id: int = Field(..., gt=0)
    form: dict[str, Any] = Field(default_factory=dict)


class EnqueueIpHostCreateBatchBody(BaseModel):
    firewall_ids: list[int] = Field(
        default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )
    form: dict[str, Any] = Field(default_factory=dict)


class ZoneUpdateBatchBody(BaseModel):
    config_entry_ids: list[int] = Field(
        default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )
    form: dict[str, Any] = Field(default_factory=dict)


class ZoneCreateBatchBody(BaseModel):
    firewall_ids: list[int] = Field(
        default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )
    form: dict[str, Any] = Field(default_factory=dict)


class ZoneCreateConfigurationBatchBody(BaseModel):
    configuration_ids: list[int] = Field(
        default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )
    form: dict[str, Any] = Field(default_factory=dict)


class IpHostgroupAggregateBody(BaseModel):
    firewall_ids: list[int] = Field(
        default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


class HsCachedNamesAggregateBody(BaseModel):
    firewall_ids: list[int] = Field(
        default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )
    entity_type: str = Field(
        ...,
        description="Member entity type for multiselect sources: ip_host, fqdn_host, mac_host, service",
    )


class HsCachedNamesConfigurationAggregateBody(BaseModel):
    configuration_ids: list[int] = Field(
        default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )
    entity_type: str = Field(
        ...,
        description="Member entity type for multiselect sources: ip_host, fqdn_host, mac_host, service",
    )


class EnqueueHsDeleteBatchBody(BaseModel):
    config_entry_ids: list[int] = Field(
        default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


class ConfigViewerQueueDeletesBody(BaseModel):
    config_entry_ids: list[int] = Field(
        ..., min_length=1, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


class ApplyConfigurationsToFirewallsBody(BaseModel):
    configuration_ids: list[int] = Field(
        ..., min_length=1, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )
    firewall_ids: list[int] = Field(
        ..., min_length=1, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


class EnqueueHsUpdateBatchBody(BaseModel):
    config_entry_ids: list[int] = Field(
        default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )
    form: dict[str, Any] = Field(default_factory=dict)


class EnqueueHsCreateBatchBody(BaseModel):
    firewall_ids: list[int] = Field(
        default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )
    entity_type: str = Field(...)
    form: dict[str, Any] = Field(default_factory=dict)


class EnqueueFirewallRuleReorderBatchBody(BaseModel):
    firewall_id: int = Field(...)
    ordered_config_entry_ids: list[int] = Field(
        default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


class TaskQueueDeleteBody(BaseModel):
    ids: list[int] = Field(default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX)


class TaskQueueSendSelectedBody(BaseModel):
    ids: list[int] = Field(default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX)


class TaskQueueSendAllBody(BaseModel):
    firewall_ids: list[int] | None = Field(
        default=None, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


_lifespan_lock = threading.Lock()
_lifespan_active = 0


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run full startup/shutdown once when multiple uvicorn servers share this app (HTTP + HTTPS)."""
    global _lifespan_active
    do_start = False
    with _lifespan_lock:
        _lifespan_active += 1
        if _lifespan_active == 1:
            do_start = True
    if do_start:
        config.ensure_local_fernet_key()
        security_settings.ensure_tls_certificate_if_https_enabled()
        init_secrets_db()
        init_db()
        init_monitor_db()
        start_monitor_scheduler()
    try:
        yield
    finally:
        do_stop = False
        with _lifespan_lock:
            _lifespan_active -= 1
            if _lifespan_active == 0:
                do_stop = True
        if do_stop:
            stop_monitor_scheduler()


BASE_DIR = config.BASE_DIR
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
templates.env.globals["https_admin_url_for_firewall"] = https_admin_url_for_firewall
templates.env.globals["request_is_https_session"] = request_is_https_session


def _template_webadmin_browser_url(request: Request, fw: Firewall) -> str:
    return str(request.url_for("firewall_webadmin_launch", firewall_id=fw.id))


def _template_ssh_browser_url(request: Request, fw: Firewall) -> str:
    return str(request.url_for("firewall_ssh_launch", firewall_id=fw.id))


def _url_add_query_param(url: str, key: str, value: str) -> str:
    parts = urlsplit(str(url))
    q = parse_qsl(parts.query, keep_blank_values=True)
    q.append((key, value))
    query = urlencode(q, doseq=True)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment))


templates.env.globals["webadmin_browser_url"] = _template_webadmin_browser_url
templates.env.globals["ssh_browser_url"] = _template_ssh_browser_url
templates.env.globals["http_listen_port"] = config.http_listen_port
templates.env.globals["https_listen_port"] = config.https_listen_port
templates.env.globals["gc_running_in_docker"] = config.in_docker_deployment()

_GC_OPENAPI_COMMON_ERRORS: dict[int, dict[str, str]] = {
    400: {"description": "Bad request — invalid input or business rule failure."},
    401: {"description": "Authentication required."},
    403: {"description": "Forbidden."},
    404: {"description": "Resource not found."},
    409: {"description": "Conflict."},
    413: {"description": "Payload too large."},
    422: {"description": "Request validation error."},
    500: {"description": "Internal server error."},
    502: {"description": "Bad gateway / upstream error."},
}

app = FastAPI(
    title="Ground Control",
    lifespan=lifespan,
    redirect_slashes=False,
    responses=_GC_OPENAPI_COMMON_ERRORS,
)


@app.middleware("http")
async def _gc_redirect_http_to_https(request: Request, call_next):
    target = security_settings.https_redirect_url_if_applicable(request)
    if target:
        return RedirectResponse(url=target, status_code=307)
    return await call_next(request)


def _parse_allowed_ip_networks(raw: str) -> list[ipaddress._BaseNetwork]:
    out: list[ipaddress._BaseNetwork] = []
    for chunk in str(raw or "").replace("\n", ",").split(","):
        item = chunk.strip()
        if not item:
            continue
        try:
            out.append(ipaddress.ip_network(item, strict=False))
        except ValueError:
            continue
    return out


def _request_client_ip_object(request: HTTPConnection) -> ipaddress._BaseAddress | None:
    host = getattr(getattr(request, "client", None), "host", None)
    txt = str(host or "").strip()
    if not txt:
        return None
    try:
        return ipaddress.ip_address(txt)
    except ValueError:
        return None


def _request_allowed_by_ranges(request: HTTPConnection) -> bool:
    st = security_settings.load_security_ui_state()
    ranges = _parse_allowed_ip_networks(st.allowed_ranges)
    if not ranges:
        return True
    ip = _request_client_ip_object(request)
    if ip is None:
        return False
    return any(ip in n for n in ranges)


@app.middleware("http")
async def _gc_allowed_ranges_guard(request: Request, call_next):
    if not _request_allowed_by_ranges(request):
        return PlainTextResponse(
            "Forbidden: client IP is not allowed.", status_code=403
        )
    return await call_next(request)


@app.middleware("http")
async def _gc_hsts_header(request: Request, call_next):
    response = await call_next(request)
    if request_is_https_session(request):
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )
    return response


_GC_NAV_PREFLIGHT_HEADER = "x-gc-navigation-preflight"


def _json_detail_payload(detail: Any) -> dict[str, Any]:
    if isinstance(detail, (str, int, float, bool)) or detail is None:
        return {"detail": detail}
    if isinstance(detail, (list, dict)):
        return {"detail": detail}
    return {"detail": str(detail)}


@app.exception_handler(StarletteHTTPException)
async def _gc_starlette_http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse | RedirectResponse | HTMLResponse:
    if request.headers.get(_GC_NAV_PREFLIGHT_HEADER) == "1":
        hdrs = dict(exc.headers) if exc.headers else {}
        if hdrs:
            return JSONResponse(
                _json_detail_payload(exc.detail),
                status_code=exc.status_code,
                headers=hdrs,
            )
        return JSONResponse(
            _json_detail_payload(exc.detail),
            status_code=exc.status_code,
        )
    return await http_exception_handler(request, exc)


@app.exception_handler(RequestValidationError)
async def _gc_request_validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse | HTMLResponse:
    if request.headers.get(_GC_NAV_PREFLIGHT_HEADER) == "1":
        return JSONResponse({"detail": exc.errors()}, status_code=422)
    return await request_validation_exception_handler(request, exc)


@app.exception_handler(Exception)
async def _gc_unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse | PlainTextResponse:
    log = logging.getLogger("ground_control")
    if request.headers.get(_GC_NAV_PREFLIGHT_HEADER) == "1":
        log.exception("Unhandled error during navigation preflight")
        msg = str(exc) if str(exc) else "Internal server error"
        return JSONResponse(status_code=500, content={"detail": msg})
    log.exception("Unhandled error")
    if getattr(request.app, "debug", False):
        return PlainTextResponse(
            "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
            status_code=500,
        )
    return PlainTextResponse("Internal Server Error", status_code=500)


class ProtectApiMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method.upper()
        if not path.startswith("/api/"):
            return await call_next(request)
        public = (
            (method, path) == ("GET", "/api/health")
            or (method, path) == ("GET", "/api/auth/status")
            or (method, path) == ("POST", "/api/auth/login")
            or (method, path) == ("POST", "/api/auth/setup-admin-password")
            or (method, path) == ("POST", "/api/auth/logout")
        )
        if public:
            return await call_next(request)
        uid = session_user_id(request)
        if not uid:
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)
        row = users_service.get_app_user_by_id(uid)
        if not row or not users_service.app_user_has_password(row):
            unregister_authenticated_session(request)
            request.session.clear()
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)
        idle_sec = session_idle_timeout_seconds()
        idle_state, _ = evaluate_session_idle(request, idle_sec)
        if idle_state == "expired":
            return JSONResponse(
                {"detail": "Session expired due to inactivity."},
                status_code=401,
            )
        touch_session_activity(request)
        return await call_next(request)


app.add_middleware(WebadminLeakedPathRedirectMiddleware)
app.add_middleware(ProtectApiMiddleware)
app.add_middleware(
    SessionMiddleware,
    secret_key=get_session_secret(),
    max_age=60 * 60 * 24 * 14,
    same_site="lax",
    https_only=config.secure_session_cookie_enabled(),
)


def require_browser_session(request: Request) -> None:
    uid = session_user_id(request)
    if not uid:
        raise HTTPException(status_code=307, headers={"Location": "/"})
    row = users_service.get_app_user_by_id(uid)
    if not row or not users_service.app_user_has_password(row):
        unregister_authenticated_session(request)
        request.session.clear()
        raise HTTPException(status_code=307, headers={"Location": "/"})
    idle_sec = session_idle_timeout_seconds()
    idle_state, _ = evaluate_session_idle(request, idle_sec)
    if idle_state == "expired":
        raise HTTPException(status_code=307, headers={"Location": "/"})
    touch_session_activity(request)


def current_user_id_dep(request: Request) -> str:
    return require_authenticated_user_id(request)


def admin_user_id_dep(request: Request) -> str:
    return require_admin_user_id(request)


@app.get("/api/health")
def health():
    return {"ok": True}


class LoginBody(BaseModel):
    username: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=1, max_length=512)


class SetupAdminPasswordBody(BaseModel):
    password: str = Field(min_length=10, max_length=256)
    password_confirm: str = Field(min_length=10, max_length=256)


class CreateAppUserBody(BaseModel):
    username: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=10, max_length=256)
    role: str = Field(pattern="^(admin|user)$")
    full_name: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    mobile: str | None = Field(default=None, max_length=80)


class PatchAppUserBody(BaseModel):
    role: str | None = Field(None, pattern="^(admin|user)$")
    password: str | None = Field(None, min_length=10, max_length=256)
    full_name: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    mobile: str | None = Field(default=None, max_length=80)


class SecuritySettingsBody(BaseModel):
    http_enabled: bool
    https_enabled: bool
    redirect_http_to_https: bool
    http_port: int = Field(ge=1, le=65535)
    https_port: int | None = Field(default=None, ge=1, le=65535)
    listen_interface: str = Field(default="0.0.0.0", max_length=64)
    allowed_ranges: str = Field(default="", max_length=32000)
    tls_hostnames: str = Field(default="", max_length=32000)
    cert_source: str = Field(default="self_signed", pattern="^(self_signed|letsencrypt)$")


class GenerateSelfSignedTlsBody(BaseModel):
    hostname: str | None = Field(default=None, max_length=253)
    hostnames: list[str] | None = None


class DataManagementPatchBody(BaseModel):
    limits: dict[str, dict[str, Any]]


TEST_FIREWALL_GENERATE_COUNT_MAX = 1000


class TestFirewallGenerateBody(BaseModel):
    count: int = Field(default=10, ge=1, le=TEST_FIREWALL_GENERATE_COUNT_MAX)
    source_firewall_id: int | None = Field(default=None, gt=0)
    test_lan_pool_cidr: str = Field(
        default="172.16.0.0/12", min_length=1, max_length=128
    )
    # Honored only when ``GROUND_CONTROL_UNDER_PYTEST`` (deterministic tests).
    synthetic_layout_token: str | None = Field(default=None, max_length=40)

    @field_validator("test_lan_pool_cidr", mode="before")
    @classmethod
    def strip_test_lan_pool_cidr(cls, v: object) -> str:
        if v is None:
            return "172.16.0.0/12"
        s = str(v).strip()
        return s if s else "172.16.0.0/12"


class BackupPasswordSetBody(BaseModel):
    password: str = Field(min_length=1, max_length=256)
    password_confirm: str = Field(min_length=1, max_length=256)


class BackupRestorePasswordBody(BaseModel):
    password: str | None = Field(default=None, max_length=256)


_MAX_BACKUP_UPLOAD_BYTES = 512 * 1024 * 1024


def _security_ports_held_by_this_process() -> set[int]:
    return security_settings.active_listen_ports_for_process()


def _app_user_profile_updates_from_body(
    body: BaseModel, *, keys: frozenset[str] | None = None
) -> dict[str, str | None]:
    raw = body.model_dump(exclude_unset=True)
    want = keys if keys is not None else frozenset({"full_name", "email", "mobile"})
    out: dict[str, str | None] = {}
    for key in want:
        if key not in raw:
            continue
        v = raw[key]
        if v is None:
            out[key] = None
        else:
            t = str(v).strip()
            out[key] = t if t else None
    return out


@app.get("/api/auth/status")
def api_auth_status(request: Request, db: Annotated[Session, Depends(get_secrets_db)]):
    return JSONResponse(
        auth_client_state(request, db),
        headers={"Cache-Control": "no-store, must-revalidate"},
    )


@app.post("/api/auth/login")
def api_auth_login(
    request: Request, body: LoginBody, db: Annotated[Session, Depends(get_secrets_db)]
):
    users_service.ensure_default_admin_user(db)
    if users_service.needs_initial_admin_password(db):
        raise HTTPException(
            status_code=400,
            detail="Set the administrator password first (initial setup).",
        )
    row = users_service.get_app_user_by_username_db(db, body.username)
    if not row or not verify_password(body.password, row.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    request.session[SESSION_USER_ID_KEY] = row.id
    register_authenticated_session(
        request,
        user_id=row.id,
        username=row.username,
        full_name=row.full_name,
        role=row.role,
    )
    touch_session_activity(request)
    row2 = db.get(type(row), row.id)
    return {
        "ok": True,
        "user": users_service.user_row_public(row2)
        if row2
        else users_service.user_row_public(row),
    }


@app.post("/api/auth/setup-admin-password")
def api_auth_setup_admin_password(
    request: Request,
    body: SetupAdminPasswordBody,
    db: Annotated[Session, Depends(get_secrets_db)],
):
    if body.password != body.password_confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match.")
    validate_new_password(body.password)
    if not users_service.needs_initial_admin_password(db):
        raise HTTPException(
            status_code=400,
            detail="Initial administrator password is already configured.",
        )
    uid = users_service.bootstrap_setup_target_user_id(db)
    if not uid:
        raise HTTPException(status_code=500, detail="No bootstrap user found.")
    ph = hash_password(body.password)
    if not users_service.update_app_user_password_hash(db, uid, ph):
        raise HTTPException(status_code=500, detail="Could not save password.")
    request.session[SESSION_USER_ID_KEY] = uid
    row2 = db.get(AppUser, uid)
    if row2:
        register_authenticated_session(
            request,
            user_id=row2.id,
            username=row2.username,
            full_name=row2.full_name,
            role=row2.role,
        )
    else:
        register_authenticated_session(request, user_id=uid)
    touch_session_activity(request)
    return {"ok": True, "user": users_service.user_row_public(row2) if row2 else None}


@app.post("/api/auth/activity")
def api_auth_activity():
    return {"ok": True}


@app.post("/api/auth/logout")
def api_auth_logout(request: Request):
    unregister_authenticated_session(request)
    request.session.clear()
    return {"ok": True}


@app.get("/api/auth/active-admin-sessions")
def api_auth_active_admin_sessions(_: Annotated[str, Depends(current_user_id_dep)]):
    admins = list_active_admin_sessions()
    return {"count": len(admins), "admins": admins}


@app.get("/api/settings/users")
def api_settings_users_list(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_secrets_db)],
):
    return users_service.list_app_users(db)


@app.post("/api/settings/users")
def api_settings_users_create(
    body: CreateAppUserBody,
    _: Annotated[str, Depends(admin_user_id_dep)],
    db: Annotated[Session, Depends(get_secrets_db)],
):
    validate_new_password(body.password)
    uname = body.username.strip()
    if users_service.get_app_user_by_username_db(db, uname):
        raise HTTPException(status_code=400, detail="That username is already taken.")
    ph = hash_password(body.password)
    return users_service.insert_app_user(
        db,
        username=uname,
        role=body.role,
        password_hash=ph,
        full_name=body.full_name,
        email=body.email,
        mobile=body.mobile,
    )


@app.patch("/api/settings/users/{user_id}")
def api_settings_users_patch(
    user_id: str,
    body: PatchAppUserBody,
    _: Annotated[str, Depends(admin_user_id_dep)],
    db: Annotated[Session, Depends(get_secrets_db)],
):
    profile_updates = _app_user_profile_updates_from_body(body)
    if body.role is None and body.password is None and not profile_updates:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    row = db.get(AppUser, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="User not found.")
    if body.role is not None and body.role != row.role:
        if (
            row.role == "admin"
            and body.role == "user"
            and users_service.count_admins(db) <= 1
        ):
            raise HTTPException(
                status_code=400,
                detail="Cannot remove the last administrator.",
            )
        out = users_service.update_app_user_role(db, user_id, body.role)
        if out is None:
            raise HTTPException(status_code=404, detail="User not found.")
    if body.password is not None:
        validate_new_password(body.password)
        if not users_service.update_app_user_password_hash(
            db, user_id, hash_password(body.password)
        ):
            raise HTTPException(status_code=404, detail="User not found.")
    if profile_updates:
        try:
            updated = users_service.update_app_user_profile_cols(
                db, user_id, profile_updates
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        if updated is None:
            raise HTTPException(status_code=404, detail="User not found.")
    row2 = db.get(AppUser, user_id)
    return users_service.user_row_public(row2) if row2 else None


@app.delete("/api/settings/users/{user_id}")
def api_settings_users_delete(
    user_id: str,
    _: Annotated[str, Depends(admin_user_id_dep)],
    db: Annotated[Session, Depends(get_secrets_db)],
):
    total = users_service.total_app_users(db)
    if total <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the only user.")
    row = db.get(AppUser, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="User not found.")
    if row.role == "admin" and users_service.count_admins(db) <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the last administrator.",
        )
    if not users_service.delete_app_user(db, user_id):
        raise HTTPException(status_code=404, detail="User not found.")
    return {"ok": True}


def _security_state_from_body(
    body: SecuritySettingsBody,
) -> security_settings.SecurityUiState:
    return security_settings.SecurityUiState(
        http_enabled=body.http_enabled,
        https_enabled=body.https_enabled,
        redirect_http_to_https=body.redirect_http_to_https,
        http_port=body.http_port,
        https_port=body.https_port,
        listen_interface=body.listen_interface.strip() or "0.0.0.0",
        allowed_ranges=body.allowed_ranges,
        tls_hostnames=body.tls_hostnames.strip(),
        cert_source=body.cert_source,
    )


@app.get("/api/settings/security")
def api_settings_security_get(_: Annotated[str, Depends(admin_user_id_dep)]):
    return security_settings.security_settings_payload()


@app.post("/api/settings/security/validate")
def api_settings_security_validate(
    body: SecuritySettingsBody, _: Annotated[str, Depends(admin_user_id_dep)]
):
    state = _security_state_from_body(body)
    errs = security_settings.validate_security_apply(
        state, ports_held_by_this_process=_security_ports_held_by_this_process()
    )
    return {"ok": len(errs) == 0, "errors": errs}


@app.post("/api/settings/security")
def api_settings_security_apply(
    body: SecuritySettingsBody, _: Annotated[str, Depends(admin_user_id_dep)]
):
    state = _security_state_from_body(body)
    errs = security_settings.validate_security_apply(
        state, ports_held_by_this_process=_security_ports_held_by_this_process()
    )
    if errs:
        raise HTTPException(status_code=400, detail={"errors": errs})
    security_settings.save_security_ui_state(state)
    return {
        "ok": True,
        "errors": [],
        "restart_required": True,
        "message": (
            "Settings saved. Restart the application for new listen ports and environment "
            "variables to take effect."
        ),
        "certificate": security_settings.load_https_certificate_summary(),
    }


@app.post("/api/settings/security/generate-self-signed")
def api_settings_security_generate_self_signed(
    body: GenerateSelfSignedTlsBody, _: Annotated[str, Depends(admin_user_id_dep)]
):
    names: list[str] = []
    if body.hostnames:
        names = [str(h).strip() for h in body.hostnames if str(h).strip()]
    elif body.hostname and str(body.hostname).strip():
        names = [str(body.hostname).strip()]
    if not names:
        raise HTTPException(
            status_code=400, detail="At least one hostname is required."
        )
    try:
        security_settings.generate_self_signed_certificate(names)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {
        "ok": True,
        **security_settings.security_certificate_api_fields(),
    }


@app.get("/api/settings/security/tls-public-certificate.pem")
def api_settings_security_download_tls_public_pem(
    _: Annotated[str, Depends(admin_user_id_dep)],
):
    """Download the public TLS certificate (PEM). For self-signed certs, import this as a trusted root in the OS or browser."""
    summ = security_settings.load_https_certificate_summary()
    if not summ["present"]:
        raise HTTPException(status_code=404, detail="No TLS certificate is configured.")
    pem = security_settings.read_tls_certificate_pem_bytes()
    if not pem:
        raise HTTPException(status_code=404, detail="Certificate file is missing.")
    return Response(
        content=pem,
        media_type="application/x-pem-file",
        headers={
            "Content-Disposition": 'attachment; filename="ground-control-tls-public.pem"',
            "Cache-Control": "no-store",
        },
    )


@app.get("/api/settings/security/tls-certificate-chain.pem")
def api_settings_security_download_tls_chain_pem(
    source: Annotated[str, Query()],
    _: Annotated[str, Depends(admin_user_id_dep)],
):
    pem = security_settings.read_tls_certificate_chain_pem_bytes(source)
    if not pem:
        raise HTTPException(
            status_code=404, detail="Certificate chain is not available."
        )
    return Response(
        content=pem,
        media_type="application/x-pem-file",
        headers={
            "Content-Disposition": 'attachment; filename="ground-control-tls-chain.pem"',
            "Cache-Control": "no-store",
        },
    )


@app.get("/api/settings/data-management")
def api_settings_data_management_get(
    _: Annotated[str, Depends(admin_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    return data_management.data_management_get_payload(db)


@app.patch("/api/settings/data-management")
def api_settings_data_management_patch(
    body: DataManagementPatchBody,
    _: Annotated[str, Depends(admin_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    merged, errs = data_management.validate_limits_patch(body.limits)
    if errs:
        raise HTTPException(status_code=422, detail={"errors": errs})
    data_management.save_data_management_limits(merged)
    return data_management.data_management_get_payload(db)


@app.post("/api/settings/data-management/run-history-retention")
def api_settings_data_management_run_history_retention(
    _: Annotated[str, Depends(admin_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    purged = run_history_retention_sweep(db)
    payload = data_management.data_management_get_payload(db)
    return {"ok": True, "purged": purged, **payload}


@app.post("/api/settings/data-management/cleanup-orphaned-firewall-cache")
def api_settings_data_management_cleanup_orphaned_firewall_cache(
    _: Annotated[str, Depends(admin_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    deleted = data_management.delete_orphaned_firewall_config_entries(db)
    payload = data_management.data_management_get_payload(db)
    return {"deleted": deleted, **payload}


@app.get("/api/settings/test-firewalls")
def api_settings_test_firewalls_summary(
    _: Annotated[str, Depends(admin_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    count = db.query(Firewall.id).filter(Firewall.is_test.is_(True)).count()
    return {"count": int(count)}


@app.post("/api/settings/test-firewalls/generate")
def api_settings_test_firewalls_generate(
    body: TestFirewallGenerateBody,
    _: Annotated[str, Depends(admin_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
):
    src_id = body.source_firewall_id
    if src_id is not None and db.get(Firewall, int(src_id)) is None:
        raise HTTPException(status_code=404, detail="Source firewall not found")
    tok = body.synthetic_layout_token
    if tok and str(tok).strip() and os.environ.get("GROUND_CONTROL_UNDER_PYTEST") != "1":
        raise HTTPException(status_code=400, detail="Invalid request.")
    try:
        created = _create_test_firewalls(
            db,
            sdb,
            count=int(body.count),
            source_firewall_id=src_id,
            test_lan_pool_cidr=body.test_lan_pool_cidr,
            synthetic_layout_token=tok,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    total = db.query(Firewall.id).filter(Firewall.is_test.is_(True)).count()
    return {
        "ok": True,
        "created": len(created),
        "total_test_firewalls": int(total),
    }


@app.delete("/api/settings/test-firewalls")
def api_settings_test_firewalls_cleanup(
    _: Annotated[str, Depends(admin_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
):
    deleted = _delete_all_test_firewalls(db, sdb)
    return {"ok": True, "deleted": int(deleted), "total_test_firewalls": 0}


_GC_BACKUP_RESTORE_DATA_TOO_LONG = (
    "Restore failed: a value from the backup is too long for this server's database "
    "(for example a country reference code). Restart the app after upgrading so "
    "migrations can widen columns, then try again."
)


@app.get("/api/settings/backup/status")
def api_settings_backup_status(_: Annotated[str, Depends(admin_user_id_dep)]):
    return {**generated_backup_status_payload(), **backup_password_status_payload()}


@app.post("/api/settings/backup/password")
def api_settings_backup_set_password(
    body: BackupPasswordSetBody,
    _: Annotated[str, Depends(admin_user_id_dep)],
):
    if body.password != body.password_confirm:
        raise HTTPException(
            status_code=400,
            detail="New password and confirmation do not match.",
        )
    try:
        set_backup_password(body.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, **backup_password_status_payload()}


@app.post("/api/settings/backup/generate")
def api_settings_backup_generate(
    _: Annotated[str, Depends(admin_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    mdb: Annotated[Session, Depends(get_monitor_db)],
):
    if not backup_password_is_configured():
        raise HTTPException(
            status_code=400,
            detail="Set a backup password before creating a backup.",
        )
    pw = get_saved_backup_password()
    if not pw:
        raise HTTPException(
            status_code=400,
            detail="Could not read saved backup password. Set it again.",
        )
    built = build_backup_zip(db, sdb, mdb)
    enc_bytes = encrypt_backup_archive(built.data, pw)
    dl_name = built.filename
    if not str(dl_name).lower().endswith(".gcbak"):
        dl_name = f"{dl_name}.gcbak"
    result = BackupBuildResult(filename=str(dl_name), data=enc_bytes)
    meta = save_generated_backup(result)
    return {"ok": True, **meta}


@app.get("/api/settings/backup/download")
def api_settings_backup_download(_: Annotated[str, Depends(admin_user_id_dep)]):
    raw = read_generated_backup_bytes()
    if raw is None:
        raise HTTPException(
            status_code=404,
            detail="No backup has been generated yet. Use Create backup first.",
        )
    st = generated_backup_status_payload()
    fn = (st.get("download_filename") if isinstance(st, dict) else None) or (
        "ground-control-backup.gcbak"
    )
    safe_fn = os.path.basename(str(fn)).strip() or "ground-control-backup.gcbak"
    return Response(
        content=raw,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_fn}"',
            "Cache-Control": "no-store",
        },
    )


@app.post("/api/settings/backup/restore-last")
def api_settings_backup_restore_last(
    _: Annotated[str, Depends(admin_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    mdb: Annotated[Session, Depends(get_monitor_db)],
    body: BackupRestorePasswordBody = Body(default_factory=BackupRestorePasswordBody),
):
    raw = read_generated_backup_bytes()
    if raw is None:
        raise HTTPException(
            status_code=404,
            detail="No generated backup on the server. Create a backup first.",
        )
    try:
        return restore_backup_merge(
            raw,
            db,
            sdb,
            mdb,
            backup_password=body.password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except DataError as exc:
        raise HTTPException(status_code=400, detail=_GC_BACKUP_RESTORE_DATA_TOO_LONG) from exc
    except IntegrityError as exc:
        raise HTTPException(
            status_code=400,
            detail="Restore failed due to a database constraint (inconsistent backup or merge conflict).",
        ) from exc
    except zipfile.BadZipFile as exc:
        raise HTTPException(
            status_code=400, detail="Backup payload is not a valid zip after decrypt.",
        ) from exc


@app.post("/api/settings/backup/restore")
async def api_settings_backup_restore(
    _: Annotated[str, Depends(admin_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    mdb: Annotated[Session, Depends(get_monitor_db)],
    file: UploadFile = File(...),
    password: Annotated[str, Form()] = "",
):
    raw = await file.read()
    if len(raw) > _MAX_BACKUP_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Backup file is too large (max 512 MiB).",
        )
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file.")
    pw = password.strip() or None
    try:
        out = restore_backup_merge(raw, db, sdb, mdb, backup_password=pw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except DataError as exc:
        raise HTTPException(status_code=400, detail=_GC_BACKUP_RESTORE_DATA_TOO_LONG) from exc
    except IntegrityError as exc:
        raise HTTPException(
            status_code=400,
            detail="Restore failed due to a database constraint (inconsistent backup or merge conflict).",
        ) from exc
    except zipfile.BadZipFile as exc:
        raise HTTPException(
            status_code=400, detail="Backup payload is not a valid zip after decrypt.",
        ) from exc
    return out


@app.get("/", response_class=HTMLResponse)
def dashboard(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
):
    return templates.TemplateResponse(
        request,
        "dashboard.html",
        {
            "app_about": APP_ABOUT,
            "auth_client_state": auth_client_state(request, sdb),
            **template_nav_firewall_context(request, sdb, db),
        },
    )


def _address_management_template_context(
    request: Request, sdb, db, ipam_page: str
) -> dict:
    return {
        "app_about": APP_ABOUT,
        "auth_client_state": auth_client_state(request, sdb),
        **template_nav_firewall_context(request, sdb, db),
        "top_nav_active": "address_management",
        "ipam_page": ipam_page,
        "ipam_subnav_active": ipam_page,
        "url_api_ipam_prefixes": str(request.url_for("api_ipam_prefixes")),
        "url_api_ipam_prefixes_create": str(
            request.url_for("api_ipam_prefixes_create")
        ),
        "url_api_ipam_accept_discovered": str(
            request.url_for("api_ipam_accept_discovered")
        ),
        "url_api_ipam_accept_discovered_batch": str(
            request.url_for("api_ipam_accept_discovered_batch")
        ),
        "url_api_ipam_next_assignment_cidr": str(
            request.url_for("api_ipam_next_assignment_cidr")
        ),
        "url_api_ipam_vrfs": str(request.url_for("api_ipam_vrfs")),
        "url_api_ipam_vrfs_create": str(request.url_for("api_ipam_vrfs_create")),
    }


@app.get("/address-management", name="address_management_index")
def address_management_index(
    request: Request,
    _: Annotated[None, Depends(require_browser_session)],
):
    return RedirectResponse(
        url=str(request.url_for("address_management_pools")),
        status_code=307,
    )


@app.get(
    "/address-management/pools",
    response_class=HTMLResponse,
    name="address_management_pools",
)
def address_management_pools(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    return templates.TemplateResponse(
        request,
        "address_management.html",
        _address_management_template_context(request, sdb, db, "pools"),
    )


@app.get(
    "/address-management/assignments",
    response_class=HTMLResponse,
    name="address_management_assignments",
)
def address_management_assignments(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    return templates.TemplateResponse(
        request,
        "address_management.html",
        _address_management_template_context(request, sdb, db, "assignments"),
    )


@app.get(
    "/address-management/hosts",
    response_class=HTMLResponse,
    name="address_management_hosts",
)
def address_management_hosts(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    return templates.TemplateResponse(
        request,
        "address_management.html",
        _address_management_template_context(request, sdb, db, "hosts"),
    )


@app.get(
    "/address-management/vrfs",
    response_class=HTMLResponse,
    name="address_management_vrfs",
)
def address_management_vrfs(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    return templates.TemplateResponse(
        request,
        "address_management.html",
        _address_management_template_context(request, sdb, db, "vrfs"),
    )


def _parse_optional_firewall_ids_csv(raw: str) -> list[int] | None:
    s = (raw or "").strip()
    if not s:
        return None
    ids: list[int] = []
    for part in s.split(","):
        p = part.strip()
        if not p:
            continue
        try:
            n = int(p)
        except ValueError:
            continue
        if n > 0:
            ids.append(n)
    return ids if ids else None


@app.get("/api/ipam/prefixes", name="api_ipam_prefixes")
def api_ipam_prefixes(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[str, Depends(require_browser_json_session)],
    q: str = "",
    firewall_ids: str = "",
) -> dict[str, Any]:
    fw_filter = _parse_optional_firewall_ids_csv(firewall_ids)
    ipam_conflict_ids, disc_conflict_keys = vrf_assignment_conflict_maps(db)
    prefixes = list_ipam_prefix_payloads(db, q)
    for p in prefixes:
        p["vrf_assignment_conflict"] = int(p["id"]) in ipam_conflict_ids
    discovered = list_discovered_assignment_payloads(db, q=q, firewall_ids=fw_filter)
    for d in discovered:
        d["vrf_assignment_conflict"] = d["key"] in disc_conflict_keys
    return {
        "prefixes": prefixes,
        "discovered": discovered,
        "ipam_form_meta": build_ipam_form_meta(db),
    }


@app.get("/api/ipam/vrfs", name="api_ipam_vrfs")
def api_ipam_vrfs(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[str, Depends(require_browser_json_session)],
) -> dict[str, Any]:
    return {"vrfs": list_ipam_vrf_payloads(db)}


@app.post("/api/ipam/vrfs", name="api_ipam_vrfs_create")
def api_ipam_vrfs_create(
    body: IpamVrfWriteBody,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[str, Depends(require_browser_json_session)],
) -> dict[str, Any]:
    try:
        row = create_ipam_vrf(db, name=body.name, description=body.description)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except IntegrityError as exc:
        raise HTTPException(
            status_code=409,
            detail="A VRF with this name already exists.",
        ) from exc
    return {
        "id": int(row.id),
        "name": row.name,
        "description": (row.description or "").strip(),
        "prefix_count": 0,
    }


@app.get("/api/ipam/next-assignment-cidr", name="api_ipam_next_assignment_cidr")
def api_ipam_next_assignment_cidr(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[str, Depends(require_browser_json_session)],
    parent_pool_id: Annotated[int, Query(..., gt=0)],
    prefix_len: Annotated[int, Query(..., ge=1, le=128)],
) -> dict[str, str]:
    try:
        cidr = suggest_next_assignment_cidr(
            db, parent_pool_id=parent_pool_id, prefix_len=prefix_len
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"cidr": cidr}


@app.get(
    "/api/ipam/resolve-interface-pool-ipv4",
    name="api_ipam_resolve_interface_pool_ipv4",
)
def api_ipam_resolve_interface_pool_ipv4(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[str, Depends(require_browser_json_session)],
    parent_pool_id: Annotated[int, Query(..., gt=0)],
    prefix_len: Annotated[int, Query(..., ge=1, le=32)],
    firewall_id: Annotated[int | None, Query()] = None,
) -> dict[str, Any]:
    fw: int | None = None
    if firewall_id is not None:
        if int(firewall_id) <= 0:
            raise HTTPException(status_code=400, detail="Invalid firewall id.")
        fw = int(firewall_id)
    try:
        return resolve_ipv4_pool_address_for_interface(
            db,
            parent_pool_id=parent_pool_id,
            prefix_len=prefix_len,
            firewall_id=fw,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/ipam/interface-pool-commit", name="api_ipam_interface_pool_commit")
def api_ipam_interface_pool_commit(
    body: IpamInterfacePoolCommitBody,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[str, Depends(require_browser_json_session)],
) -> dict[str, Any]:
    try:
        return commit_interface_static_to_ipam_pool(
            db,
            firewall_id=body.firewall_id,
            parent_pool_id=body.parent_pool_id,
            ipv4_ip=body.ipv4_ip.strip(),
            ipv4_netmask=body.ipv4_netmask.strip(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/ipam/prefixes", name="api_ipam_prefixes_create")
def api_ipam_prefixes_create(
    body: IpamPrefixWriteBody,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[str, Depends(require_browser_json_session)],
) -> dict[str, Any]:
    try:
        row = create_ipam_prefix(
            db,
            name=body.name,
            cidr=body.cidr,
            vrf=body.vrf,
            prefix_type=body.prefix_type,
            assigned_to_firewall_id=body.assigned_to_firewall_id,
            assigned_to_custom=body.assigned_to_custom,
            description=body.description,
            parent_pool_id=body.parent_pool_id,
            parent_assignment_id=body.parent_assignment_id,
            pool_unmanaged=body.pool_unmanaged,
        )
    except IpamDuplicateCidrError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except IntegrityError as exc:
        raise HTTPException(
            status_code=409,
            detail="That CIDR already exists in this VRF (address space).",
        ) from exc
    return ipam_prefix_row_payload(db, row)


@app.put("/api/ipam/prefixes/{prefix_id}", name="api_ipam_prefixes_update")
def api_ipam_prefixes_update(
    prefix_id: int,
    body: IpamPrefixWriteBody,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[str, Depends(require_browser_json_session)],
) -> dict[str, Any]:
    try:
        row = update_ipam_prefix(
            db,
            prefix_id,
            name=body.name,
            cidr=body.cidr,
            vrf=body.vrf,
            prefix_type=body.prefix_type,
            assigned_to_firewall_id=body.assigned_to_firewall_id,
            assigned_to_custom=body.assigned_to_custom,
            description=body.description,
            parent_pool_id=body.parent_pool_id,
            parent_assignment_id=body.parent_assignment_id,
            pool_unmanaged=body.pool_unmanaged,
        )
    except IpamDuplicateCidrError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except IntegrityError as exc:
        raise HTTPException(
            status_code=409,
            detail="That CIDR is already used in this VRF by another prefix.",
        ) from exc
    if row is None:
        raise HTTPException(status_code=404, detail="Prefix not found.")
    return ipam_prefix_row_payload(db, row)


@app.delete("/api/ipam/prefixes/{prefix_id}", name="api_ipam_prefixes_delete")
def api_ipam_prefixes_delete(
    prefix_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[str, Depends(require_browser_json_session)],
) -> dict[str, Any]:
    try:
        ok = delete_ipam_prefix(db, prefix_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not ok:
        raise HTTPException(status_code=404, detail="Prefix not found.")
    return {"ok": True}


@app.post("/api/ipam/accept-discovered", name="api_ipam_accept_discovered")
def api_ipam_accept_discovered(
    body: IpamAcceptDiscoveredBody,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[str, Depends(require_browser_json_session)],
) -> dict[str, Any]:
    try:
        row = accept_discovered_assignment(
            db,
            firewall_id=body.firewall_id,
            cidr=body.cidr,
            name=body.name,
            assigned_to_firewall_id=body.assigned_to_firewall_id,
            assigned_to_custom=body.assigned_to_custom,
            pool_cidr=body.pool_cidr,
            pool_name=body.pool_name,
            description=body.description,
        )
    except IpamDuplicateCidrError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        msg = str(exc)
        if msg.startswith("POOL_REQUIRED"):
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "pool_required",
                    "message": msg.split(":", 1)[-1].strip(),
                },
            ) from exc
        raise HTTPException(status_code=400, detail=msg) from exc
    except IntegrityError as exc:
        raise HTTPException(
            status_code=409, detail="That prefix already exists."
        ) from exc
    return ipam_prefix_row_payload(db, row)


@app.post("/api/ipam/accept-discovered-batch", name="api_ipam_accept_discovered_batch")
def api_ipam_accept_discovered_batch(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[str, Depends(require_browser_json_session)],
    firewall_ids: str = "",
) -> dict[str, Any]:
    fw_filter = _parse_optional_firewall_ids_csv(firewall_ids)
    return accept_all_eligible_discoveries(db, firewall_ids=fw_filter)


def _configuration_cache_entry_counts_by_id(db: Session) -> dict[int, int]:
    """Row counts in ``configuration_config_entries`` per configuration id."""
    rows = (
        db.query(
            ConfigurationConfigEntry.configuration_id,
            func.count(ConfigurationConfigEntry.id),
        )
        .group_by(ConfigurationConfigEntry.configuration_id)
        .all()
    )
    return {int(cid): int(n) for cid, n in rows}


@app.get("/firewalls", response_class=HTMLResponse, name="firewalls_inventory_page")
def firewalls_page(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
    tab: str = "",
):
    firewalls = db.query(Firewall).order_by(Firewall.id.desc()).all()
    fw_ids = [f.id for f in firewalls]
    fw_online_map = {int(f.id): firewall_is_online(f) for f in firewalls}
    fw_cached_sync_entities = _firewall_cached_sync_entity_map(db, fw_ids)
    tab_norm = (tab or "").strip().lower()
    inventory_tab = "configurations" if tab_norm == "configurations" else "firewalls"
    configurations = (
        db.query(Configuration)
        .options(joinedload(Configuration.cloned_from_firewall))
        .order_by(Configuration.id.desc())
        .all()
    )
    cfg_cache_entry_counts = _configuration_cache_entry_counts_by_id(db)
    nav_fw_sorted = sorted(
        firewalls,
        key=lambda f: (
            0 if f.name else 1,
            (f.name or "").casefold(),
            (f.host or "").casefold(),
        ),
    )
    return templates.TemplateResponse(
        request,
        "firewalls.html",
        {
            "firewalls": firewalls,
            "fw_online_map": fw_online_map,
            "fw_cached_sync_entities": fw_cached_sync_entities,
            "inventory_tab": inventory_tab,
            "top_nav_active": "firewalls",
            "configurations": configurations,
            "cfg_cache_entry_counts": cfg_cache_entry_counts,
            "app_about": APP_ABOUT,
            "auth_client_state": auth_client_state(request, sdb),
            **template_nav_firewall_context(
                request,
                sdb,
                db,
                skip_global_fw_table_filter=True,
                nav_firewall_rows=nav_fw_sorted,
            ),
            "url_firewall_update": str(request.url_for("gc_update_firewall")),
            "url_firewall_delete_batch": str(
                request.url_for("gc_firewalls_delete_batch")
            ),
            "url_firewall_create": str(request.url_for("gc_create_firewall")),
            "url_configuration_update": str(request.url_for("gc_update_configuration")),
            "url_configuration_delete_batch": str(
                request.url_for("gc_configurations_delete_batch")
            ),
            "url_api_configurations_apply_to_firewalls_batch": str(
                request.url_for("api_configurations_apply_to_firewalls_batch")
            ),
            "url_api_configurations_status_summary": str(
                request.url_for("api_configurations_status_summary")
            ),
            "url_api_configuration_apply_to_member_firewalls_template": str(
                request.url_for(
                    "api_configuration_apply_to_member_firewalls", configuration_id=0
                )
            ).replace("/0/", "/__CONFIG_ID__/"),
            "url_configuration_create": str(request.url_for("gc_create_configuration")),
            "firewall_label_by_id": {
                int(f.id): ((f.name or f.host or str(f.id)).strip())
                for f in nav_fw_sorted
            },
            "sync_entity_catalog": list_sync_entity_catalog(),
            "firewall_tag_suggestions": _distinct_firewall_tag_suggestions(firewalls),
        },
    )


_INVENTORY_DEFAULT_PAGE_SIZE = 100

_CFG_STATUS_CACHE_TTL_SECONDS = 60
_cfg_status_cache_lock = threading.Lock()
_cfg_status_cache: dict[tuple[int, ...], tuple[float, dict[int, dict[str, int]]]] = {}
_cfg_member_drift_cache_lock = threading.Lock()
_cfg_member_drift_cache: dict[int, tuple[float, dict[str, Any]]] = {}


def _payload_dict_for_status_compare(raw_json: str) -> dict[str, Any]:
    try:
        data = json.loads(raw_json or "{}")
    except (json.JSONDecodeError, TypeError):
        return {}
    if not isinstance(data, dict):
        return {}
    return {
        str(k): v
        for k, v in data.items()
        if not str(k).startswith("@")
        and not str(k).startswith("__gc_")
        and k != "__gc_op"
    }


def _payload_digest_for_status_compare(raw_json: str) -> str:
    cleaned = _payload_dict_for_status_compare(raw_json)
    return json.dumps(cleaned, sort_keys=True, separators=(",", ":"), default=str)


def _compute_configuration_status_summary(
    db: Session, configuration_ids: list[int]
) -> dict[int, dict[str, int]]:
    cfg_ids = sorted({int(x) for x in configuration_ids if int(x) > 0})
    if not cfg_ids:
        return {}
    cfg_rows = db.query(Configuration).filter(Configuration.id.in_(cfg_ids)).all()
    cfg_by_id = {int(c.id): c for c in cfg_rows}
    all_firewalls = db.query(Firewall).all()
    member_fw_ids_by_cfg: dict[int, list[int]] = {}
    for cid in cfg_ids:
        cfg = cfg_by_id.get(cid)
        if cfg is None:
            member_fw_ids_by_cfg[cid] = []
            continue
        member_fw_ids_by_cfg[cid] = cfg.effective_member_firewall_ids(all_firewalls)

    cfg_entries = (
        db.query(
            ConfigurationConfigEntry.configuration_id,
            ConfigurationConfigEntry.entity_type,
            ConfigurationConfigEntry.external_name,
            ConfigurationConfigEntry.payload_json,
        )
        .filter(ConfigurationConfigEntry.configuration_id.in_(cfg_ids))
        .all()
    )
    entries_by_cfg: dict[int, list[tuple[str, str, str]]] = {cid: [] for cid in cfg_ids}
    key_pairs: set[tuple[str, str]] = set()
    for row in cfg_entries:
        cid = int(row.configuration_id)
        et = str(row.entity_type or "").strip()
        name = str(row.external_name or "").strip()
        if not et or not name:
            continue
        dig = _payload_digest_for_status_compare(str(row.payload_json or ""))
        entries_by_cfg.setdefault(cid, []).append((et, name, dig))
        key_pairs.add((et, name))

    wanted_fw_ids = sorted(
        {
            int(fid)
            for ids in member_fw_ids_by_cfg.values()
            for fid in ids
            if int(fid) > 0
        }
    )
    fw_payload_by_key: dict[tuple[int, str, str], str] = {}
    if wanted_fw_ids and key_pairs:
        fw_rows = (
            db.query(
                FirewallConfigEntry.firewall_id,
                FirewallConfigEntry.entity_type,
                FirewallConfigEntry.external_name,
                FirewallConfigEntry.payload_json,
            )
            .filter(
                FirewallConfigEntry.firewall_id.in_(wanted_fw_ids),
                tuple_(
                    FirewallConfigEntry.entity_type,
                    FirewallConfigEntry.external_name,
                ).in_(sorted(key_pairs)),
            )
            .all()
        )
        for row in fw_rows:
            fw_payload_by_key[
                (int(row.firewall_id), str(row.entity_type), str(row.external_name))
            ] = str(row.payload_json or "")

    fw_digest_cache: dict[str, str] = {}
    out: dict[int, dict[str, int]] = {}
    for cid in cfg_ids:
        member_fw_ids = member_fw_ids_by_cfg.get(cid, [])
        cfg_items = entries_by_cfg.get(cid, [])
        out_of_sync = 0
        if cfg_items:
            for fid in member_fw_ids:
                mismatch = False
                for et, name, cfg_dig in cfg_items:
                    raw_fw = fw_payload_by_key.get((int(fid), et, name))
                    if raw_fw is None:
                        mismatch = True
                        break
                    fw_dig = fw_digest_cache.get(raw_fw)
                    if fw_dig is None:
                        fw_dig = _payload_digest_for_status_compare(raw_fw)
                        fw_digest_cache[raw_fw] = fw_dig
                    if fw_dig != cfg_dig:
                        mismatch = True
                        break
                if mismatch:
                    out_of_sync += 1
        out[cid] = {
            "assigned_firewalls": len(member_fw_ids),
            "out_of_sync_firewalls": out_of_sync,
        }
    return out


def _compute_configuration_member_firewall_drift(
    db: Session, configuration_id: int
) -> dict[str, Any]:
    cfg = db.get(Configuration, configuration_id)
    if cfg is None:
        raise ValueError("Configuration not found")
    all_firewalls = db.query(Firewall).all()
    member_ids = cfg.effective_member_firewall_ids(all_firewalls)
    fw_by_id = {int(f.id): f for f in all_firewalls}
    cfg_rows = (
        db.query(
            ConfigurationConfigEntry.entity_type,
            ConfigurationConfigEntry.external_name,
            ConfigurationConfigEntry.payload_json,
        )
        .filter(ConfigurationConfigEntry.configuration_id == configuration_id)
        .all()
    )
    cfg_items: dict[tuple[str, str], str] = {}
    key_pairs: set[tuple[str, str]] = set()
    for row in cfg_rows:
        et = str(row.entity_type or "").strip()
        name = str(row.external_name or "").strip()
        if not et or not name:
            continue
        dig = _payload_digest_for_status_compare(str(row.payload_json or ""))
        cfg_items[(et, name)] = dig
        key_pairs.add((et, name))

    fw_payload_by_key: dict[tuple[int, str, str], str] = {}
    if member_ids and key_pairs:
        fw_rows = (
            db.query(
                FirewallConfigEntry.firewall_id,
                FirewallConfigEntry.entity_type,
                FirewallConfigEntry.external_name,
                FirewallConfigEntry.payload_json,
            )
            .filter(
                FirewallConfigEntry.firewall_id.in_(member_ids),
                tuple_(
                    FirewallConfigEntry.entity_type,
                    FirewallConfigEntry.external_name,
                ).in_(sorted(key_pairs)),
            )
            .all()
        )
        for row in fw_rows:
            fw_payload_by_key[
                (int(row.firewall_id), str(row.entity_type), str(row.external_name))
            ] = str(row.payload_json or "")

    fw_digest_cache: dict[str, str] = {}
    firewalls_out: list[dict[str, Any]] = []
    details_by_fw: dict[str, dict[str, Any]] = {}
    for fid in member_ids:
        missing: list[dict[str, str]] = []
        different: list[dict[str, str]] = []
        for (et, name), cfg_dig in cfg_items.items():
            raw_fw = fw_payload_by_key.get((int(fid), et, name))
            if raw_fw is None:
                missing.append({"entity_type": et, "external_name": name})
                continue
            fw_dig = fw_digest_cache.get(raw_fw)
            if fw_dig is None:
                fw_dig = _payload_digest_for_status_compare(raw_fw)
                fw_digest_cache[raw_fw] = fw_dig
            if fw_dig != cfg_dig:
                different.append({"entity_type": et, "external_name": name})
        fw_row = fw_by_id.get(int(fid))
        label = (
            (fw_row.name or fw_row.host or str(fid)).strip()
            if fw_row is not None
            else f"#{fid}"
        )
        online = bool(firewall_is_online(fw_row)) if fw_row is not None else False
        missing_count = len(missing)
        different_count = len(different)
        in_sync = missing_count == 0 and different_count == 0
        firewalls_out.append(
            {
                "firewall_id": int(fid),
                "label": label,
                "online": online,
                "state": "in_sync" if in_sync else "out_of_sync",
                "missing_count": missing_count,
                "different_count": different_count,
            }
        )
        details_by_fw[str(int(fid))] = {
            "missing_count": missing_count,
            "different_count": different_count,
            "missing": missing,
            "different": different,
        }
    firewalls_out.sort(key=lambda x: str(x.get("label") or "").casefold())
    return {
        "configuration_id": int(configuration_id),
        "total_config_items": len(cfg_items),
        "firewalls": firewalls_out,
        "details_by_firewall": details_by_fw,
    }


@app.get("/api/firewalls/inventory", name="api_firewalls_inventory")
def api_firewalls_inventory(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    q: Annotated[str, Query(description="Search filter (name, host, tags)")] = "",
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=500)] = _INVENTORY_DEFAULT_PAGE_SIZE,
):
    """Paginated + searchable firewalls inventory for the /firewalls table."""
    query = db.query(Firewall)

    search = q.strip().lower()
    if search:
        query = query.filter(
            Firewall.name.ilike(f"%{search}%")
            | Firewall.host.ilike(f"%{search}%")
            | Firewall.description.ilike(f"%{search}%")
            | Firewall.tags_json.ilike(f"%{search}%")
        )

    total = query.count()
    rows = (
        query.order_by(Firewall.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page + 1)
        .all()
    )
    has_more = len(rows) > per_page
    rows = rows[:per_page]

    fw_ids = [f.id for f in rows]
    sync_map = _firewall_cached_sync_entity_map(db, fw_ids)

    firewalls_out = []
    for f in rows:
        firewalls_out.append(
            {
                "id": f.id,
                "name": f.name,
                "description": f.description,
                "host": f.host,
                "port": f.port,
                "username": f.username,
                "device_hostname": f.device_hostname,
                "serial_number": f.serial_number,
                "model": f.model,
                "firmware_version": f.firmware_version,
                "license_info": f.license_info,
                "firewall_subscriptions_json": f.firewall_subscriptions_json,
                "webadmin_metadata_json": f.webadmin_metadata_json,
                "webadmin_last_collected_at": f.webadmin_last_collected_at.isoformat()
                if f.webadmin_last_collected_at
                else None,
                "verify_ssl": f.verify_ssl,
                "monitor_enabled": f.monitor_enabled,
                "monitor_interval_minutes": f.monitor_interval_minutes,
                "tags": f.tags_list(),
                "is_test": f.is_test,
                "online": firewall_is_online(f),
                "sync_entity_types": sync_map.get(f.id, []),
            }
        )

    return {
        "firewalls": firewalls_out,
        "page": page,
        "per_page": per_page,
        "total": total,
        "has_more": has_more,
    }


@app.get(
    "/api/configurations/status-summary",
    name="api_configurations_status_summary",
)
def api_configurations_status_summary(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    configuration_ids: Annotated[
        str, Query(description="Comma-separated configuration IDs")
    ] = "",
):
    cfg_ids = _parse_configuration_ids_query(configuration_ids)
    if not cfg_ids:
        return {"by_configuration_id": {}}
    cache_key = tuple(cfg_ids)
    now = time.time()
    with _cfg_status_cache_lock:
        hit = _cfg_status_cache.get(cache_key)
        if hit and now - hit[0] < _CFG_STATUS_CACHE_TTL_SECONDS:
            return {"by_configuration_id": hit[1], "cached_seconds": int(now - hit[0])}
    summary = _compute_configuration_status_summary(db, cfg_ids)
    with _cfg_status_cache_lock:
        _cfg_status_cache[cache_key] = (now, summary)
    return {"by_configuration_id": summary, "cached_seconds": 0}


@app.get(
    "/api/configurations/{configuration_id}/member-firewall-drift-summary",
    name="api_configuration_member_firewall_drift_summary",
)
def api_configuration_member_firewall_drift_summary(
    configuration_id: int,
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    now = time.time()
    with _cfg_member_drift_cache_lock:
        hit = _cfg_member_drift_cache.get(int(configuration_id))
        if hit and now - hit[0] < _CFG_STATUS_CACHE_TTL_SECONDS:
            payload = hit[1]
            return {
                "configuration_id": int(configuration_id),
                "total_config_items": int(payload.get("total_config_items") or 0),
                "firewalls": payload.get("firewalls", []),
                "cached_seconds": int(now - hit[0]),
            }
    try:
        payload = _compute_configuration_member_firewall_drift(
            db, int(configuration_id)
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    with _cfg_member_drift_cache_lock:
        _cfg_member_drift_cache[int(configuration_id)] = (now, payload)
    return {
        "configuration_id": int(configuration_id),
        "total_config_items": int(payload.get("total_config_items") or 0),
        "firewalls": payload.get("firewalls", []),
        "cached_seconds": 0,
    }


@app.get(
    "/api/configurations/{configuration_id}/member-firewalls/{firewall_id}/drift-items",
    name="api_configuration_member_firewall_drift_items",
)
def api_configuration_member_firewall_drift_items(
    configuration_id: int,
    firewall_id: int,
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    now = time.time()
    payload: dict[str, Any] | None = None
    with _cfg_member_drift_cache_lock:
        hit = _cfg_member_drift_cache.get(int(configuration_id))
        if hit and now - hit[0] < _CFG_STATUS_CACHE_TTL_SECONDS:
            payload = hit[1]
    if payload is None:
        try:
            payload = _compute_configuration_member_firewall_drift(
                db, int(configuration_id)
            )
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        with _cfg_member_drift_cache_lock:
            _cfg_member_drift_cache[int(configuration_id)] = (now, payload)
    details = (payload.get("details_by_firewall") or {}).get(str(int(firewall_id)))
    if details is None:
        raise HTTPException(
            status_code=404,
            detail="Firewall is not an effective member of this configuration.",
        )
    fw_label = f"#{firewall_id}"
    for row in payload.get("firewalls", []):
        if int(row.get("firewall_id") or 0) == int(firewall_id):
            fw_label = str(row.get("label") or fw_label)
            break
    return {
        "configuration_id": int(configuration_id),
        "firewall_id": int(firewall_id),
        "firewall_label": fw_label,
        "missing_count": int(details.get("missing_count") or 0),
        "different_count": int(details.get("different_count") or 0),
        "missing": details.get("missing", []),
        "different": details.get("different", []),
    }


def _parse_configuration_ids_query(raw: str) -> list[int]:
    return _parse_firewall_ids_query(raw)


@app.get("/configurations/network", response_class=HTMLResponse)
def configurations_network_page(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    return templates.TemplateResponse(
        request,
        "configurations_network.html",
        {
            "app_about": APP_ABOUT,
            "auth_client_state": auth_client_state(request, sdb),
            **template_nav_firewall_context(request, sdb, db),
            "top_nav_active": "firewalls",
            "url_api_configuration_network_interfaces": str(
                request.url_for("api_configurations_network_interfaces")
            ),
            "url_api_configuration_network_vlans": str(
                request.url_for("api_configurations_network_vlans")
            ),
            "url_api_configuration_network_zones": str(
                request.url_for("api_configurations_network_zones")
            ),
            "url_api_configurations_apply_interface": str(
                request.url_for("api_configurations_apply_interface")
            ),
            "url_api_configurations_apply_vlan": str(
                request.url_for("api_configurations_apply_vlan")
            ),
            "url_api_configurations_apply_vlan_create": str(
                request.url_for("api_configurations_apply_vlan_create")
            ),
            "url_api_configurations_apply_bridge_pair": str(
                request.url_for("api_configurations_apply_bridge_pair")
            ),
            "url_api_configurations_apply_bridge_pair_create": str(
                request.url_for("api_configurations_apply_bridge_pair_create")
            ),
            "url_api_configurations_apply_lag": str(
                request.url_for("api_configurations_apply_lag")
            ),
            "url_api_configurations_apply_lag_create": str(
                request.url_for("api_configurations_apply_lag_create")
            ),
            "url_api_configurations_apply_alias": str(
                request.url_for("api_configurations_apply_alias")
            ),
            "url_api_configurations_apply_alias_create": str(
                request.url_for("api_configurations_apply_alias_create")
            ),
            "url_api_configurations_apply_zone": str(
                request.url_for("api_configurations_apply_zone")
            ),
            "url_api_configurations_apply_zone_updates_batch": str(
                request.url_for("api_configurations_apply_zone_updates_batch")
            ),
            "url_api_configurations_apply_zone_create_batch": str(
                request.url_for("api_configurations_apply_zone_create_batch")
            ),
            "url_api_configurations_apply_network_entity_deletes_batch": str(
                request.url_for("api_configurations_apply_network_entity_deletes_batch")
            ),
            "url_api_ipam_next_assignment_cidr": str(
                request.url_for("api_ipam_next_assignment_cidr")
            ),
            "url_api_ipam_prefixes": str(request.url_for("api_ipam_prefixes")),
            "url_api_ipam_resolve_interface_pool_ipv4": str(
                request.url_for("api_ipam_resolve_interface_pool_ipv4")
            ),
            "url_api_ipam_interface_pool_commit": str(
                request.url_for("api_ipam_interface_pool_commit")
            ),
        },
    )


@app.get("/configurations/hosts-services", response_class=HTMLResponse)
def configurations_hosts_services_page(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    nav_ctx = template_nav_firewall_context(request, sdb, db)
    return templates.TemplateResponse(
        request,
        "configurations_hosts_services.html",
        {
            "app_about": APP_ABOUT,
            "auth_client_state": auth_client_state(request, sdb),
            **nav_ctx,
            "top_nav_active": "firewalls",
            "url_api_configurations_hosts_services_table": str(
                request.url_for("api_configurations_hosts_services_table")
            ),
            "url_api_configurations_apply_ip_host": str(
                request.url_for("api_configurations_apply_ip_host")
            ),
            "url_api_configurations_apply_ip_host_updates_batch": str(
                request.url_for("api_configurations_apply_ip_host_updates_batch")
            ),
            "url_api_configurations_apply_ip_host_deletes_batch": str(
                request.url_for("api_configurations_apply_ip_host_deletes_batch")
            ),
            "url_api_configurations_apply_ip_host_create": str(
                request.url_for("api_configurations_apply_ip_host_create")
            ),
            "url_api_configurations_apply_ip_host_create_batch": str(
                request.url_for("api_configurations_apply_ip_host_create_batch")
            ),
            "url_api_configurations_hosts_services_ip_hostgroup_names": str(
                request.url_for("api_configurations_hosts_services_ip_hostgroup_names")
            ),
            "url_api_configurations_hosts_services_ip_hostgroup_aggregate": str(
                request.url_for(
                    "api_configurations_hosts_services_ip_hostgroup_aggregate"
                )
            ),
            "url_api_configurations_hosts_services_fqdn_hostgroup_names": str(
                request.url_for(
                    "api_configurations_hosts_services_fqdn_hostgroup_names"
                )
            ),
            "url_api_configurations_hosts_services_cached_names_aggregate": str(
                request.url_for(
                    "api_configurations_hosts_services_cached_names_aggregate"
                )
            ),
            "url_api_reference_countries": str(
                request.url_for("api_reference_countries")
            ),
            "url_api_configurations_apply_hs_deletes_batch": str(
                request.url_for("api_configurations_apply_hs_deletes_batch")
            ),
            "url_api_configurations_apply_hs_updates_batch": str(
                request.url_for("api_configurations_apply_hs_updates_batch")
            ),
            "url_api_configurations_apply_hs_creates_batch": str(
                request.url_for("api_configurations_apply_hs_creates_batch")
            ),
        },
    )


@app.get(
    "/api/configurations/nav-multiselect",
    name="api_configurations_nav_multiselect",
)
def api_configurations_nav_multiselect(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    return nav_configurations_multiselect_json(db)


@app.get(
    "/api/configurations/network/interfaces",
    name="api_configurations_network_interfaces",
)
def api_configurations_network_interfaces(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    configuration_ids: Annotated[
        str, Query(description="Comma-separated configuration IDs")
    ] = "",
    combine: Annotated[
        bool,
        Query(
            description="Merge rows with the same name and type across selected configurations",
        ),
    ] = True,
):
    ids = _parse_configuration_ids_query(configuration_ids)
    pl = configuration_unified_interfaces_payload(db, ids, combine=combine)
    _finalize_interfaces_tab_payload(db, pl)
    return pl


@app.get(
    "/api/configurations/network/vlans",
    name="api_configurations_network_vlans",
)
def api_configurations_network_vlans(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    configuration_ids: Annotated[
        str, Query(description="Comma-separated configuration IDs")
    ] = "",
):
    ids = _parse_configuration_ids_query(configuration_ids)
    return configuration_network_table_payload(db, ids, ENTITY_VLAN, zones_combine=True)


@app.get(
    "/api/configurations/network/zones",
    name="api_configurations_network_zones",
)
def api_configurations_network_zones(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    configuration_ids: Annotated[
        str, Query(description="Comma-separated configuration IDs")
    ] = "",
    combine: Annotated[
        bool,
        Query(
            description="Merge rows by zone name; when false, one row per zone per configuration.",
        ),
    ] = True,
):
    ids = _parse_configuration_ids_query(configuration_ids)
    return configuration_network_table_payload(
        db, ids, ENTITY_ZONE, zones_combine=combine
    )


@app.get(
    "/api/configurations/hosts-services/table",
    name="api_configurations_hosts_services_table",
)
def api_configurations_hosts_services_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    entity_type: Annotated[
        str,
        Query(
            ...,
            description="Cache entity id: ip_host, ip_hostgroup, mac_host, …",
        ),
    ],
    configuration_ids: Annotated[
        str, Query(description="Comma-separated configuration IDs")
    ] = "",
    combine: Annotated[
        bool,
        Query(
            description="Merge rows with the same identity across selected configurations.",
        ),
    ] = True,
):
    et = (entity_type or "").strip()
    if et not in HOSTS_SERVICES_ENTITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown entity_type. Allowed: {', '.join(sorted(HOSTS_SERVICES_ENTITY_TYPES))}.",
        )
    ids = _parse_configuration_ids_query(configuration_ids)
    return configuration_hosts_services_table_payload(db, ids, et, combine=combine)


class ConfigurationIdsBody(BaseModel):
    configuration_ids: list[int] = Field(
        default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )


@app.post(
    "/api/configurations/hosts-services/ip-hostgroup-aggregate",
    name="api_configurations_hosts_services_ip_hostgroup_aggregate",
)
def api_configurations_hosts_services_ip_hostgroup_aggregate(
    body: ConfigurationIdsBody,
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    return aggregate_ip_hostgroups_for_configurations(db, body.configuration_ids)


@app.post(
    "/api/configurations/hosts-services/cached-names-aggregate",
    name="api_configurations_hosts_services_cached_names_aggregate",
)
def api_configurations_hosts_services_cached_names_aggregate(
    body: HsCachedNamesConfigurationAggregateBody,
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    et = (body.entity_type or "").strip()
    if et not in HS_CACHED_MEMBER_ENTITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unknown entity_type. Allowed: "
                f"{', '.join(sorted(HS_CACHED_MEMBER_ENTITY_TYPES))}."
            ),
        )
    return aggregate_named_entities_for_configurations(db, body.configuration_ids, et)


@app.get(
    "/api/reference/countries",
    name="api_reference_countries",
)
def api_reference_countries(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Country codes for Country group flyouts, seeded from the ``All Countries`` group
    when that object is synced or edited.
    """
    if db.query(RefCountry).count() == 0:
        if try_seed_ref_countries_from_cache(db):
            db.commit()
    return {"countries": list_ref_country_codes_payload(db)}


@app.get(
    "/api/configurations/hosts-services/ip-hostgroup-names",
    name="api_configurations_hosts_services_ip_hostgroup_names",
)
def api_configurations_hosts_services_ip_hostgroup_names(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    configuration_id: Annotated[int, Query(..., ge=1, description="Configuration id")],
):
    return {"groups": list_ip_hostgroups_for_configuration(db, configuration_id)}


@app.get(
    "/api/configurations/hosts-services/fqdn-hostgroup-names",
    name="api_configurations_hosts_services_fqdn_hostgroup_names",
)
def api_configurations_hosts_services_fqdn_hostgroup_names(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    configuration_id: Annotated[int, Query(..., ge=1, description="Configuration id")],
):
    return {"groups": list_fqdn_hostgroups_for_configuration(db, configuration_id)}


def _optional_import_firewall_id_form(raw: str | None) -> int | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        v = int(s)
    except ValueError:
        return None
    return v if v > 0 else None


@app.post("/configurations", name="gc_create_configuration")
def create_configuration(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_browser_session)],
    name: Annotated[str | None, Form()] = None,
    description: Annotated[str | None, Form()] = None,
    member_firewall_ids_json: Annotated[str | None, Form()] = None,
    import_firewall_id: Annotated[str | None, Form()] = None,
):
    name_clean = name.strip() if name else None
    if name_clean == "":
        name_clean = None
    desc_clean = description.strip() if description else None
    if desc_clean == "":
        desc_clean = None
    row = Configuration(
        name=name_clean,
        description=desc_clean,
        member_firewall_ids_json=_canonical_member_firewall_ids_json(
            member_firewall_ids_json, db=db
        ),
    )
    db.add(row)
    db.flush()
    fw_import_id = _optional_import_firewall_id_form(import_firewall_id)
    if fw_import_id is not None and db.get(Firewall, fw_import_id) is not None:
        row.cloned_from_firewall_id = fw_import_id
        for src in (
            db.query(FirewallConfigEntry)
            .filter(FirewallConfigEntry.firewall_id == fw_import_id)
            .all()
        ):
            db.add(
                ConfigurationConfigEntry(
                    configuration_id=row.id,
                    entity_type=src.entity_type,
                    external_name=src.external_name,
                    payload_json=src.payload_json,
                )
            )
    db.commit()
    return RedirectResponse(url="/firewalls?tab=configurations", status_code=303)


class ConfigurationBatchDeleteBody(BaseModel):
    ids: list[int] = Field(default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX)


@app.post("/configurations/delete-batch", name="gc_configurations_delete_batch")
def delete_configurations_batch(
    body: ConfigurationBatchDeleteBody,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    ids = sorted(set(i for i in body.ids if isinstance(i, int)))
    for cid in ids:
        row = db.get(Configuration, cid)
        if row:
            db.delete(row)
    db.commit()
    return {"ok": True, "deleted": len(ids)}


@app.post("/internal/configurations/update", name="gc_update_configuration")
def update_configuration(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_browser_session)],
    configuration_id: Annotated[int, Form(...)],
    name: Annotated[str | None, Form()] = None,
    description: Annotated[str | None, Form()] = None,
    member_firewall_ids_json: Annotated[str | None, Form()] = None,
):
    row = (
        db.query(Configuration)
        .filter(Configuration.id == configuration_id)
        .one_or_none()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Configuration not found")
    name_clean = name.strip() if name else None
    if name_clean == "":
        name_clean = None
    desc_clean = description.strip() if description else None
    if desc_clean == "":
        desc_clean = None
    row.name = name_clean
    row.description = desc_clean
    row.member_firewall_ids_json = _canonical_member_firewall_ids_json(
        member_firewall_ids_json, db=db
    )
    db.commit()
    return JSONResponse({"ok": True})


@app.post(
    "/api/configurations/apply-interface", name="api_configurations_apply_interface"
)
def api_configurations_apply_interface(
    body: EnqueueInterfaceUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_interface_update(
            db,
            config_entry_id=body.config_entry_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post("/api/configurations/apply-vlan", name="api_configurations_apply_vlan")
def api_configurations_apply_vlan(
    body: EnqueueInterfaceUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_vlan_update(
            db,
            config_entry_id=body.config_entry_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post(
    "/api/configurations/apply-vlan-create", name="api_configurations_apply_vlan_create"
)
def api_configurations_apply_vlan_create_route(
    body: VlanCreateConfigurationBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_vlan_create(
            db,
            configuration_id=body.configuration_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post(
    "/api/configurations/apply-bridge-pair", name="api_configurations_apply_bridge_pair"
)
def api_configurations_apply_bridge_pair(
    body: EnqueueInterfaceUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_bridge_pair_update(
            db,
            config_entry_id=body.config_entry_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post(
    "/api/configurations/apply-bridge-pair-create",
    name="api_configurations_apply_bridge_pair_create",
)
def api_configurations_apply_bridge_pair_create_route(
    body: BridgePairCreateConfigurationBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_bridge_pair_create(
            db,
            configuration_id=body.configuration_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post("/api/configurations/apply-alias", name="api_configurations_apply_alias")
def api_configurations_apply_alias(
    body: EnqueueInterfaceUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_alias_update(
            db,
            config_entry_id=body.config_entry_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post(
    "/api/configurations/apply-alias-create",
    name="api_configurations_apply_alias_create",
)
def api_configurations_apply_alias_create_route(
    body: AliasCreateConfigurationBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_alias_create(
            db,
            configuration_id=body.configuration_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post("/api/configurations/apply-zone", name="api_configurations_apply_zone")
def api_configurations_apply_zone(
    body: EnqueueInterfaceUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_zone_update(
            db,
            config_entry_id=body.config_entry_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post(
    "/api/configurations/apply-zone-updates-batch",
    name="api_configurations_apply_zone_updates_batch",
)
def api_configurations_apply_zone_updates_batch(
    body: ZoneUpdateBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_zone_update_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post(
    "/api/configurations/apply-zone-create-batch",
    name="api_configurations_apply_zone_create_batch",
)
def api_configurations_apply_zone_create_batch_route(
    body: ZoneCreateConfigurationBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_zone_create_batch(
            db,
            configuration_ids=body.configuration_ids,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post("/api/configurations/apply-lag", name="api_configurations_apply_lag")
def api_configurations_apply_lag(
    body: EnqueueInterfaceUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_lag_update(
            db,
            config_entry_id=body.config_entry_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post(
    "/api/configurations/apply-lag-create",
    name="api_configurations_apply_lag_create",
)
def api_configurations_apply_lag_create_route(
    body: LagCreateConfigurationBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_lag_create(
            db,
            configuration_id=body.configuration_id,
            form=body.form,
            force=body.force,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except LagCreateCacheConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "message": str(exc),
                "code": "lag_cache_conflict",
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post("/api/configurations/apply-ip-host", name="api_configurations_apply_ip_host")
def api_configurations_apply_ip_host(
    body: EnqueueIpHostUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_ip_host_update(
            db,
            config_entry_id=body.config_entry_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post(
    "/api/configurations/apply-ip-host-updates-batch",
    name="api_configurations_apply_ip_host_updates_batch",
)
def api_configurations_apply_ip_host_updates_batch(
    body: EnqueueIpHostUpdateBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_ip_host_update_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post(
    "/api/configurations/apply-ip-host-deletes-batch",
    name="api_configurations_apply_ip_host_deletes_batch",
)
def api_configurations_apply_ip_host_deletes_batch(
    body: EnqueueIpHostDeleteBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_ip_host_delete_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


class IpHostCreateConfigurationBody(BaseModel):
    configuration_id: int = Field(..., gt=0)
    form: dict[str, Any] = Field(default_factory=dict)


@app.post(
    "/api/configurations/apply-ip-host-create",
    name="api_configurations_apply_ip_host_create",
)
def api_configurations_apply_ip_host_create(
    body: IpHostCreateConfigurationBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_ip_host_create(
            db,
            configuration_id=body.configuration_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


class IpHostCreateConfigurationBatchBody(BaseModel):
    configuration_ids: list[int] = Field(
        default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )
    form: dict[str, Any] = Field(default_factory=dict)


@app.post(
    "/api/configurations/apply-ip-host-create-batch",
    name="api_configurations_apply_ip_host_create_batch",
)
def api_configurations_apply_ip_host_create_batch(
    body: IpHostCreateConfigurationBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_ip_host_create_many(
            db,
            configuration_ids=body.configuration_ids,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "count": len(body.configuration_ids)}


@app.post(
    "/api/configurations/apply-hs-deletes-batch",
    name="api_configurations_apply_hs_deletes_batch",
)
def api_configurations_apply_hs_deletes_batch(
    body: EnqueueHsDeleteBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_hs_deletes_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post(
    "/api/configurations/apply-network-entity-deletes-batch",
    name="api_configurations_apply_network_entity_deletes_batch",
)
def api_configurations_apply_network_entity_deletes_batch(
    body: EnqueueHsDeleteBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_network_entity_deletes_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.post(
    "/api/configurations/apply-hs-updates-batch",
    name="api_configurations_apply_hs_updates_batch",
)
def api_configurations_apply_hs_updates_batch(
    body: EnqueueHsUpdateBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        apply_configuration_hs_entity_update_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


class HsCreateConfigurationBatchBody(BaseModel):
    configuration_ids: list[int] = Field(
        default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX
    )
    entity_type: str = Field(...)
    form: dict[str, Any] = Field(default_factory=dict)


@app.post(
    "/api/configurations/apply-hs-creates-batch",
    name="api_configurations_apply_hs_creates_batch",
)
def api_configurations_apply_hs_creates_batch(
    body: HsCreateConfigurationBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    et = (body.entity_type or "").strip()
    if et not in HOSTS_SERVICES_ENTITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown entity_type. Allowed: {', '.join(sorted(HOSTS_SERVICES_ENTITY_TYPES))}.",
        )
    try:
        apply_configuration_hs_entity_create_many(
            db,
            configuration_ids=body.configuration_ids,
            entity_type=et,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "count": len(body.configuration_ids)}


# Hosts & Services tab entity_type values (firewall_config_entries.entity_type).
HOSTS_SERVICES_ENTITY_TYPES: frozenset[str] = frozenset(
    {
        "ip_host",
        "ip_hostgroup",
        "mac_host",
        "fqdn_host",
        "fqdn_hostgroup",
        "country_group",
        "service",
        "service_group",
    }
)

HS_CACHED_MEMBER_ENTITY_TYPES: frozenset[str] = frozenset(
    {
        "ip_host",
        "fqdn_host",
        "mac_host",
        "service",
        "fqdn_hostgroup",
        "ip_hostgroup",
        "service_group",
    }
)


def _parse_firewall_ids_query(raw: str) -> list[int]:
    out: list[int] = []
    if not raw or not str(raw).strip():
        return out
    for part in str(raw).split(","):
        part = part.strip()
        if part.isdigit():
            n = int(part)
            if n > 0:
                out.append(n)
    return list(dict.fromkeys(out))


def _parse_configuration_ids_query(raw: str) -> list[int]:
    return _parse_firewall_ids_query(raw)


def _merge_vertical_table_payloads(
    a: dict[str, Any], b: dict[str, Any]
) -> dict[str, Any]:
    """Concatenate two table payloads (union columns). Used when both firewalls and configurations are in scope."""
    if not a.get("rows"):
        return b
    if not b.get("rows"):
        return a
    cols_a = list(a.get("columns") or [])
    cols_b = list(b.get("columns") or [])
    col_union = list(dict.fromkeys(cols_a + [c for c in cols_b if c not in cols_a]))
    cl_a = dict(a.get("column_labels") or {})
    cl_b = dict(b.get("column_labels") or {})
    column_labels = {**cl_b, **cl_a}
    for c in col_union:
        column_labels.setdefault(c, str(c))

    def expand_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out_r: list[dict[str, Any]] = []
        for r in rows:
            cells = dict(r.get("cells") or {})
            for c in col_union:
                cells.setdefault(c, "")
            nr = dict(r)
            nr["cells"] = cells
            out_r.append(nr)
        return out_r

    ra = expand_rows(a.get("rows") or [])
    rb = expand_rows(b.get("rows") or [])
    vis_a = list(a.get("columns_visible_by_default") or [])
    vis_b = list(b.get("columns_visible_by_default") or [])
    vis = list(dict.fromkeys(vis_a + [x for x in vis_b if x not in vis_a]))
    merged: dict[str, Any] = {
        "columns": col_union,
        "column_labels": column_labels,
        "columns_visible_by_default": vis,
        "rows": ra + rb,
    }
    for extra_key in (
        "zones_combined",
        "zones_combine_conflicts",
        "hs_combined",
        "hs_combine_conflicts",
        "ip_hosts_combined",
        "ip_hosts_combine_conflicts",
        "interfaces_combined",
        "interfaces_combine_conflicts",
    ):
        if extra_key in a or extra_key in b:
            va = a.get(extra_key)
            vb = b.get(extra_key)
            if isinstance(va, bool) and isinstance(vb, bool):
                merged[extra_key] = va and vb
            else:
                merged[extra_key] = vb if va is None else va
    return merged


def _finalize_interfaces_tab_payload(db: Session, payload: dict[str, Any]) -> None:
    enrich_interface_payload_combine_sources_ipam(db, payload)
    rows = payload.get("rows")
    if isinstance(rows, list):
        attach_ipam_hints_to_interface_rows(db, rows)


def _merged_unified_interfaces_payload(
    db: Session,
    firewall_ids: list[int],
    configuration_ids: list[int],
    *,
    combine: bool = True,
) -> dict[str, Any]:
    fw_pl = (
        _firewall_config_unified_interfaces_payload(db, firewall_ids, combine=combine)
        if firewall_ids
        else {}
    )
    cfg_pl = (
        configuration_unified_interfaces_payload(db, configuration_ids, combine=combine)
        if configuration_ids
        else {}
    )
    if firewall_ids and not configuration_ids:
        _finalize_interfaces_tab_payload(db, fw_pl)
        return fw_pl
    if configuration_ids and not firewall_ids:
        _finalize_interfaces_tab_payload(db, cfg_pl)
        return cfg_pl
    if not firewall_ids and not configuration_ids:
        return {
            "columns": [],
            "column_labels": {},
            "columns_visible_by_default": [],
            "rows": [],
            "interfaces_combined": combine,
            "interfaces_combine_conflicts": False,
        }
    merged = _merge_vertical_table_payloads(fw_pl, cfg_pl)
    cl = dict(merged.get("column_labels") or {})
    if cl.get("firewall") in ("Firewall", "Configuration"):
        cl["firewall"] = "Scope"
    merged["column_labels"] = cl
    mrows = merged.get("rows")
    merged["interfaces_combined"] = combine
    merged["interfaces_combine_conflicts"] = bool(combine) and any(
        bool(r.get("if_combine_conflict")) for r in (mrows or []) if isinstance(r, dict)
    )
    _finalize_interfaces_tab_payload(db, merged)
    return merged


@app.get("/firewalls/network", response_class=HTMLResponse)
def firewalls_network_page(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    return templates.TemplateResponse(
        request,
        "firewalls_network.html",
        {
            "app_about": APP_ABOUT,
            "auth_client_state": auth_client_state(request, sdb),
            **template_nav_firewall_context(request, sdb, db),
            "url_api_network_interfaces": str(
                request.url_for("api_firewalls_network_interfaces")
            ),
            "url_api_network_zones": str(
                request.url_for("api_firewalls_network_zones")
            ),
            "url_api_task_queue_enqueue_interface": str(
                request.url_for("api_task_queue_enqueue_interface")
            ),
            "url_api_task_queue_enqueue_vlan": str(
                request.url_for("api_task_queue_enqueue_vlan")
            ),
            "url_api_task_queue_enqueue_bridge_pair": str(
                request.url_for("api_task_queue_enqueue_bridge_pair")
            ),
            "url_api_task_queue_enqueue_bridge_pair_create": str(
                request.url_for("api_task_queue_enqueue_bridge_pair_create")
            ),
            "url_api_task_queue_enqueue_lag": str(
                request.url_for("api_task_queue_enqueue_lag")
            ),
            "url_api_task_queue_enqueue_lag_create": str(
                request.url_for("api_task_queue_enqueue_lag_create")
            ),
            "url_api_task_queue_enqueue_alias": str(
                request.url_for("api_task_queue_enqueue_alias")
            ),
            "url_api_task_queue_enqueue_alias_create": str(
                request.url_for("api_task_queue_enqueue_alias_create")
            ),
            "url_api_task_queue_enqueue_zone": str(
                request.url_for("api_task_queue_enqueue_zone")
            ),
            "url_api_task_queue_enqueue_zone_updates_batch": str(
                request.url_for("api_task_queue_enqueue_zone_updates_batch")
            ),
            "url_api_task_queue_enqueue_zone_create_batch": str(
                request.url_for("api_task_queue_enqueue_zone_create_batch")
            ),
            "url_api_task_queue_enqueue_network_entity_deletes_batch": str(
                request.url_for("api_task_queue_enqueue_network_entity_deletes_batch")
            ),
            "url_api_configurations_apply_interface": str(
                request.url_for("api_configurations_apply_interface")
            ),
            "url_api_configurations_apply_vlan": str(
                request.url_for("api_configurations_apply_vlan")
            ),
            "url_api_configurations_apply_vlan_create": str(
                request.url_for("api_configurations_apply_vlan_create")
            ),
            "url_api_configurations_apply_bridge_pair": str(
                request.url_for("api_configurations_apply_bridge_pair")
            ),
            "url_api_configurations_apply_bridge_pair_create": str(
                request.url_for("api_configurations_apply_bridge_pair_create")
            ),
            "url_api_configurations_apply_lag": str(
                request.url_for("api_configurations_apply_lag")
            ),
            "url_api_configurations_apply_lag_create": str(
                request.url_for("api_configurations_apply_lag_create")
            ),
            "url_api_configurations_apply_alias": str(
                request.url_for("api_configurations_apply_alias")
            ),
            "url_api_configurations_apply_alias_create": str(
                request.url_for("api_configurations_apply_alias_create")
            ),
            "url_api_configurations_apply_zone_create_batch": str(
                request.url_for("api_configurations_apply_zone_create_batch")
            ),
            "url_api_ipam_next_assignment_cidr": str(
                request.url_for("api_ipam_next_assignment_cidr")
            ),
            "url_api_ipam_prefixes": str(request.url_for("api_ipam_prefixes")),
            "url_api_ipam_resolve_interface_pool_ipv4": str(
                request.url_for("api_ipam_resolve_interface_pool_ipv4")
            ),
            "url_api_ipam_interface_pool_commit": str(
                request.url_for("api_ipam_interface_pool_commit")
            ),
        },
    )


@app.get("/firewalls/intrusion-prevention/configure", response_class=HTMLResponse)
def firewalls_intrusion_prevention_configure_redirect():
    return RedirectResponse(
        url="/firewalls/intrusion-prevention",
        status_code=302,
    )


@app.get("/firewalls/intrusion-prevention", response_class=HTMLResponse)
def firewalls_intrusion_prevention_page(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    ips_policy_dropdowns = {
        "categories": IPS_POLICY_CATEGORIES,
        "severities": IPS_POLICY_SEVERITIES,
        "platforms": IPS_POLICY_PLATFORMS,
        "targets": IPS_POLICY_TARGETS,
        "rule_types": list(IPS_POLICY_RULE_TYPES),
        "signature_selection": list(IPS_POLICY_SIGNATURE_SELECTION),
        "actions": list(IPS_POLICY_ACTIONS),
    }
    ips_custom_signature_dropdowns = {
        "protocols": list(IPS_CUSTOM_SIG_PROTOCOL_OPTIONS),
        "severities": list(IPS_CUSTOM_SIG_SEVERITY_OPTIONS),
        "recommended_actions": list(IPS_CUSTOM_SIG_ACTION_OPTIONS),
    }
    return templates.TemplateResponse(
        request,
        "firewalls_intrusion_prevention.html",
        {
            "app_about": APP_ABOUT,
            "auth_client_state": auth_client_state(request, sdb),
            **template_nav_firewall_context(request, sdb, db),
            "url_api_ips_switch_table": str(
                request.url_for("api_firewalls_ips_switch_table")
            ),
            "url_api_task_queue_enqueue_ips_switch_batch": str(
                request.url_for("api_task_queue_enqueue_ips_switch_batch")
            ),
            "url_api_ips_policy_table": str(
                request.url_for("api_firewalls_ips_policy_table")
            ),
            "url_api_task_queue_enqueue_ips_policy_create": str(
                request.url_for("api_task_queue_enqueue_ips_policy_create")
            ),
            "url_api_task_queue_enqueue_ips_policy_update": str(
                request.url_for("api_task_queue_enqueue_ips_policy_update")
            ),
            "url_api_task_queue_enqueue_ips_policy_deletes_batch": str(
                request.url_for("api_task_queue_enqueue_ips_policy_deletes_batch")
            ),
            "ips_policy_dropdowns": ips_policy_dropdowns,
            "url_api_ips_custom_signature_table": str(
                request.url_for("api_firewalls_ips_custom_signature_table")
            ),
            "url_api_task_queue_enqueue_ips_custom_signature_create": str(
                request.url_for("api_task_queue_enqueue_ips_custom_signature_create")
            ),
            "url_api_task_queue_enqueue_ips_custom_signature_create_batch": str(
                request.url_for(
                    "api_task_queue_enqueue_ips_custom_signature_create_batch"
                )
            ),
            "url_api_task_queue_enqueue_ips_custom_signature_update": str(
                request.url_for("api_task_queue_enqueue_ips_custom_signature_update")
            ),
            "url_api_task_queue_enqueue_ips_custom_signature_deletes_batch": str(
                request.url_for(
                    "api_task_queue_enqueue_ips_custom_signature_deletes_batch"
                )
            ),
            "ips_custom_signature_dropdowns": ips_custom_signature_dropdowns,
            "url_api_ips_trusted_mac_table": str(
                request.url_for("api_firewalls_ips_trusted_mac_table")
            ),
            "url_api_task_queue_enqueue_ips_trusted_mac_create_batch": str(
                request.url_for("api_task_queue_enqueue_ips_trusted_mac_create_batch")
            ),
            "url_api_task_queue_enqueue_ips_trusted_mac_update": str(
                request.url_for("api_task_queue_enqueue_ips_trusted_mac_update")
            ),
            "url_api_task_queue_enqueue_ips_trusted_mac_deletes_batch": str(
                request.url_for("api_task_queue_enqueue_ips_trusted_mac_deletes_batch")
            ),
            "url_api_network_zones": str(
                request.url_for("api_firewalls_network_zones")
            ),
            "url_api_task_queue_enqueue_dos_settings_update": str(
                request.url_for("api_task_queue_enqueue_dos_settings_update")
            ),
            "url_api_task_queue_enqueue_spoof_prevention_update": str(
                request.url_for("api_task_queue_enqueue_spoof_prevention_update")
            ),
        },
    )


@app.get("/firewalls/protect/firewall", response_class=HTMLResponse)
def firewalls_protect_firewall_page(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    return templates.TemplateResponse(
        request,
        "firewalls_protect_firewall.html",
        {
            "app_about": APP_ABOUT,
            "auth_client_state": auth_client_state(request, sdb),
            **template_nav_firewall_context(request, sdb, db),
            "url_api_firewall_rules_table": str(
                request.url_for("api_firewalls_firewall_rules_table")
            ),
            "url_api_task_queue_enqueue_firewall_rule_reorder_batch": str(
                request.url_for("api_task_queue_enqueue_firewall_rule_reorder_batch")
            ),
        },
    )


@app.get("/firewalls/protect/web", response_class=HTMLResponse)
def firewalls_protect_web_page(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    return templates.TemplateResponse(
        request,
        "firewalls_protect_web.html",
        {
            "app_about": APP_ABOUT,
            "auth_client_state": auth_client_state(request, sdb),
            **template_nav_firewall_context(request, sdb, db),
            "url_api_webfilter_policy_table": str(
                request.url_for("api_firewalls_webfilter_policy_table")
            ),
            "url_api_task_queue_enqueue_webfilter_policy_create": str(
                request.url_for("api_task_queue_enqueue_webfilter_policy_create")
            ),
            "url_api_task_queue_enqueue_webfilter_policy_update": str(
                request.url_for("api_task_queue_enqueue_webfilter_policy_update")
            ),
            "url_api_task_queue_enqueue_webfilter_policy_deletes_batch": str(
                request.url_for("api_task_queue_enqueue_webfilter_policy_deletes_batch")
            ),
            "url_api_user_activity_table": str(
                request.url_for("api_firewalls_user_activity_table")
            ),
            "url_api_url_group_table": str(
                request.url_for("api_firewalls_url_group_table")
            ),
        },
    )


@app.get("/firewalls/configure/authentication", response_class=HTMLResponse)
def firewalls_configure_authentication_page(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    return templates.TemplateResponse(
        request,
        "firewalls_authentication.html",
        {
            "app_about": APP_ABOUT,
            "auth_client_state": auth_client_state(request, sdb),
            **template_nav_firewall_context(request, sdb, db),
            "url_api_auth_user_table": str(
                request.url_for("api_firewalls_auth_user_table")
            ),
            "url_api_auth_user_group_table": str(
                request.url_for("api_firewalls_auth_user_group_table")
            ),
            "url_api_task_queue_enqueue_auth_user_create": str(
                request.url_for("api_task_queue_enqueue_auth_user_create")
            ),
            "url_api_task_queue_enqueue_auth_user_update": str(
                request.url_for("api_task_queue_enqueue_auth_user_update")
            ),
            "url_api_task_queue_enqueue_auth_user_deletes_batch": str(
                request.url_for("api_task_queue_enqueue_auth_user_deletes_batch")
            ),
            "url_api_task_queue_enqueue_auth_user_group_create": str(
                request.url_for("api_task_queue_enqueue_auth_user_group_create")
            ),
            "url_api_task_queue_enqueue_auth_user_group_update": str(
                request.url_for("api_task_queue_enqueue_auth_user_group_update")
            ),
            "url_api_task_queue_enqueue_auth_user_group_deletes_batch": str(
                request.url_for("api_task_queue_enqueue_auth_user_group_deletes_batch")
            ),
            "url_api_auth_admin_profile_options": str(
                request.url_for("api_firewalls_auth_admin_profile_options")
            ),
            "url_api_auth_user_group_options": str(
                request.url_for("api_firewalls_auth_user_group_options")
            ),
        },
    )


@app.get("/firewalls/system/profiles", response_class=HTMLResponse)
def firewalls_system_profiles_page(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    return templates.TemplateResponse(
        request,
        "firewalls_profiles.html",
        {
            "app_about": APP_ABOUT,
            "auth_client_state": auth_client_state(request, sdb),
            **template_nav_firewall_context(request, sdb, db),
            "url_api_admin_profile_table": str(
                request.url_for("api_firewalls_admin_profile_table")
            ),
            "url_api_task_queue_enqueue_admin_profile_create": str(
                request.url_for("api_task_queue_enqueue_admin_profile_create")
            ),
            "url_api_task_queue_enqueue_admin_profile_update": str(
                request.url_for("api_task_queue_enqueue_admin_profile_update")
            ),
            "url_api_task_queue_enqueue_admin_profile_deletes_batch": str(
                request.url_for("api_task_queue_enqueue_admin_profile_deletes_batch")
            ),
            "url_api_profile_schedule_table": str(
                request.url_for("api_firewalls_profile_schedule_table")
            ),
            "url_api_profile_access_time_table": str(
                request.url_for("api_firewalls_profile_access_time_table")
            ),
            "url_api_profile_surfing_quota_table": str(
                request.url_for("api_firewalls_profile_surfing_quota_table")
            ),
            "url_api_profile_data_transfer_table": str(
                request.url_for("api_firewalls_profile_data_transfer_table")
            ),
            "url_api_profile_vpn_profile_table": str(
                request.url_for("api_firewalls_profile_vpn_profile_table")
            ),
            "url_api_task_queue_enqueue_profile_entity_create_batch": str(
                request.url_for("api_task_queue_enqueue_profile_entity_create_batch")
            ),
            "url_api_task_queue_enqueue_profile_entity_update_batch": str(
                request.url_for("api_task_queue_enqueue_profile_entity_update_batch")
            ),
            "url_api_task_queue_enqueue_profile_entity_deletes_batch": str(
                request.url_for("api_task_queue_enqueue_profile_entity_deletes_batch")
            ),
        },
    )


@app.get("/firewalls/hosts-services", response_class=HTMLResponse)
def firewalls_hosts_services_page(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    nav_ctx = template_nav_firewall_context(request, sdb, db)
    return templates.TemplateResponse(
        request,
        "firewalls_hosts_services.html",
        {
            "app_about": APP_ABOUT,
            "auth_client_state": auth_client_state(request, sdb),
            **nav_ctx,
            "url_api_hosts_services_table": str(
                request.url_for("api_firewalls_hosts_services_table")
            ),
            "url_api_task_queue_enqueue_ip_host": str(
                request.url_for("api_task_queue_enqueue_ip_host")
            ),
            "url_api_task_queue_enqueue_ip_host_updates_batch": str(
                request.url_for("api_task_queue_enqueue_ip_host_updates_batch")
            ),
            "url_api_task_queue_enqueue_ip_host_deletes_batch": str(
                request.url_for("api_task_queue_enqueue_ip_host_deletes_batch")
            ),
            "url_api_task_queue_enqueue_ip_host_create": str(
                request.url_for("api_task_queue_enqueue_ip_host_create")
            ),
            "url_api_task_queue_enqueue_ip_host_create_batch": str(
                request.url_for("api_task_queue_enqueue_ip_host_create_batch")
            ),
            "url_api_hosts_services_ip_hostgroup_names": str(
                request.url_for("api_hosts_services_ip_hostgroup_names")
            ),
            "url_api_hosts_services_ip_hostgroup_aggregate": str(
                request.url_for("api_hosts_services_ip_hostgroup_aggregate")
            ),
            "url_api_hosts_services_fqdn_hostgroup_names": str(
                request.url_for("api_hosts_services_fqdn_hostgroup_names")
            ),
            "url_api_hosts_services_cached_names_aggregate": str(
                request.url_for("api_hosts_services_cached_names_aggregate")
            ),
            "url_api_reference_countries": str(
                request.url_for("api_reference_countries")
            ),
            "url_api_task_queue_enqueue_hs_deletes_batch": str(
                request.url_for("api_task_queue_enqueue_hs_deletes_batch")
            ),
            "url_api_task_queue_enqueue_hs_updates_batch": str(
                request.url_for("api_task_queue_enqueue_hs_updates_batch")
            ),
            "url_api_task_queue_enqueue_hs_creates_batch": str(
                request.url_for("api_task_queue_enqueue_hs_creates_batch")
            ),
        },
    )


_HISTORY_UI_ROW_LIMIT = 5000
_HISTORY_UI_OUTGOING_PAGE_SIZE = 200


def _history_json_preview(raw: str | None, max_len: int = 120) -> str:
    if not raw:
        return "—"
    s = " ".join(str(raw).split())
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def _history_title_attr(raw: str | None, max_len: int = 2000) -> str:
    if not raw:
        return ""
    s = " ".join(str(raw).split())
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def _is_webadmin_connected_response(
    *,
    method: str,
    full_path: str,
    status_code: int,
) -> bool:
    if method.upper() != "GET":
        return False
    if status_code >= 400:
        return False
    p = "/" + (full_path or "").lstrip("/")
    lp = p.lower()
    if "login.jsp" in lp or "logout.jsp" in lp:
        return False
    return "index.jsp" in lp


def _is_webadmin_logout_request(*, method: str, full_path: str) -> bool:
    if method.upper() != "GET":
        return False
    lp = ("/" + (full_path or "").lstrip("/")).lower()
    return "logout.jsp" in lp


def _is_webadmin_entry_path(full_path: str) -> bool:
    p = "/" + (full_path or "").lstrip("/")
    return p == "/" or p == ""


def _is_same_origin_browser_request(request: Request) -> bool:
    origin = (request.headers.get("origin") or "").strip()
    referer = (request.headers.get("referer") or "").strip()
    if origin:
        return is_same_origin_value(request, origin)
    if referer:
        return is_same_origin_value(request, referer)
    # Some same-origin browser form posts omit both headers.
    return True


@app.get(
    "/firewalls/history", response_class=HTMLResponse, name="firewalls_history_page"
)
def firewalls_history_page(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    outgoing_rows, outgoing_has_more = list_completed_tasks_with_firewall_page(
        db,
        limit=_HISTORY_UI_OUTGOING_PAGE_SIZE,
        offset=0,
    )

    def fw_label(fw: Firewall) -> str:
        return fw.name or fw.host or str(fw.id)

    ch_q = (
        db.query(FirewallConfigChangelogEntry, Firewall)
        .join(Firewall, Firewall.id == FirewallConfigChangelogEntry.firewall_id)
        .order_by(FirewallConfigChangelogEntry.created_at.desc())
        .limit(_HISTORY_UI_ROW_LIMIT)
        .all()
    )
    changelog_rows: list[dict[str, Any]] = []
    for row, fw in ch_q:
        created = row.created_at
        created_iso = created.isoformat() if created else ""
        fl = fw_label(fw)
        fw_online = firewall_is_online(fw)
        changelog_rows.append(
            {
                "id": row.id,
                "firewall_id": fw.id,
                "sync_run_id": row.sync_run_id,
                "firewall_label": fl,
                "firewall_online": fw_online,
                "entity_type": row.entity_type,
                "external_name": row.external_name,
                "action": row.action,
                "old_payload_json": row.old_payload_json,
                "new_payload_json": row.new_payload_json,
                "old_payload_preview": _history_json_preview(row.old_payload_json),
                "new_payload_preview": _history_json_preview(row.new_payload_json),
                "old_payload_title": _history_title_attr(row.old_payload_json),
                "new_payload_title": _history_title_attr(row.new_payload_json),
                "created_at": created_iso,
                "search_blob": " ".join(
                    str(x).lower()
                    for x in [
                        row.id,
                        row.sync_run_id,
                        fl,
                        row.entity_type,
                        row.external_name,
                        row.action,
                        row.old_payload_json,
                        row.new_payload_json,
                        created_iso,
                    ]
                    if x is not None
                ),
            }
        )

    sync_q = (
        db.query(FirewallConfigSyncRun, Firewall)
        .join(Firewall, Firewall.id == FirewallConfigSyncRun.firewall_id)
        .order_by(FirewallConfigSyncRun.started_at.desc())
        .limit(_HISTORY_UI_ROW_LIMIT)
        .all()
    )
    sync_rows: list[dict[str, Any]] = []
    for run, fw in sync_q:
        st = run.started_at
        fin = run.finished_at
        fl = fw_label(fw)
        fw_online = firewall_is_online(fw)
        sync_rows.append(
            {
                "id": run.id,
                "firewall_id": fw.id,
                "firewall_label": fl,
                "firewall_online": fw_online,
                "started_at": st.isoformat() if st else "",
                "finished_at": fin.isoformat() if fin else "",
                "status": run.status,
                "error_message": run.error_message or "",
                "added_count": run.added_count,
                "changed_count": run.changed_count,
                "deleted_count": run.deleted_count,
                "search_blob": " ".join(
                    str(x).lower()
                    for x in [
                        run.id,
                        fl,
                        st.isoformat() if st else "",
                        fin.isoformat() if fin else "",
                        run.status,
                        run.error_message or "",
                        run.added_count,
                        run.changed_count,
                        run.deleted_count,
                    ]
                    if x is not None
                ),
            }
        )

    access_q = (
        db.query(AccessSessionLog, Firewall)
        .outerjoin(Firewall, Firewall.id == AccessSessionLog.firewall_id)
        .order_by(AccessSessionLog.created_at.desc())
        .limit(_HISTORY_UI_ROW_LIMIT)
        .all()
    )
    access_rows: list[dict[str, Any]] = []
    for entry, fw in access_q:
        created = entry.created_at
        created_iso = created.isoformat() if created else ""
        fl = fw_label(fw) if fw is not None else "—"
        fw_online = firewall_is_online(fw) if fw is not None else None
        outcome_label = "Yes" if entry.connected_successfully else "No"
        event_label = "Started" if entry.event_kind == "start" else "Ended"
        access_rows.append(
            {
                "id": entry.id,
                "session_id": entry.session_id,
                "firewall_id": entry.firewall_id
                if entry.firewall_id is not None
                else "",
                "firewall_label": fl,
                "access_type": (entry.access_type or "").upper(),
                "access_type_key": (entry.access_type or "").strip().lower(),
                "firewall_online": fw_online,
                "event_kind": entry.event_kind,
                "event_label": event_label,
                "connected_successfully": entry.connected_successfully,
                "connected_label": outcome_label,
                "initiated_by_username": entry.initiated_by_username or "—",
                "client_ip": entry.client_ip or "—",
                "details": entry.details or "",
                "created_at": created_iso,
                "search_blob": " ".join(
                    str(x).lower()
                    for x in [
                        entry.id,
                        entry.session_id,
                        entry.firewall_id,
                        fl,
                        entry.access_type,
                        entry.event_kind,
                        outcome_label,
                        entry.initiated_by_username or "",
                        entry.client_ip or "",
                        entry.details or "",
                        created_iso,
                    ]
                    if x is not None
                ),
            }
        )

    return templates.TemplateResponse(
        request,
        "firewalls_history.html",
        {
            "app_about": APP_ABOUT,
            "auth_client_state": auth_client_state(request, sdb),
            **template_nav_firewall_context(request, sdb, db),
            "changelog_rows": changelog_rows,
            "outgoing_rows": outgoing_rows,
            "outgoing_has_more": outgoing_has_more,
            "outgoing_page_size": _HISTORY_UI_OUTGOING_PAGE_SIZE,
            "sync_rows": sync_rows,
            "access_rows": access_rows,
        },
    )


@app.get("/task-queue", response_class=HTMLResponse, name="task_queue_page")
def task_queue_page(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    return templates.TemplateResponse(
        request,
        "task_queue.html",
        {
            "app_about": APP_ABOUT,
            "auth_client_state": auth_client_state(request, sdb),
            **template_nav_firewall_context(request, sdb, db),
            "top_nav_active": "task_queue",
            "url_api_task_queue_list": str(request.url_for("api_task_queue_list")),
            "url_api_task_queue_delete": str(request.url_for("api_task_queue_delete")),
            "url_api_task_queue_send_all": str(
                request.url_for("api_task_queue_send_all")
            ),
            "url_api_task_queue_send_selected": str(
                request.url_for("api_task_queue_send_selected")
            ),
        },
    )


@app.get("/task-queue/embed", response_class=HTMLResponse, name="task_queue_embed")
def task_queue_embed(
    request: Request,
    _: Annotated[None, Depends(require_browser_session)],
):
    """Minimal task queue document for the Firewalls sidebar bottom dock (iframe)."""
    return templates.TemplateResponse(
        request,
        "task_queue_embed.html",
        {
            "url_api_task_queue_list": str(request.url_for("api_task_queue_list")),
            "url_api_task_queue_delete": str(request.url_for("api_task_queue_delete")),
            "url_api_task_queue_send_all": str(
                request.url_for("api_task_queue_send_all")
            ),
            "url_api_task_queue_send_selected": str(
                request.url_for("api_task_queue_send_selected")
            ),
        },
    )


@app.get("/api/task-queue", name="api_task_queue_list")
def api_task_queue_list(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str | None,
        Query(
            description="Comma-separated firewall IDs; omit for all tasks; empty filters to none",
        ),
    ] = None,
    limit: Annotated[
        int | None,
        Query(
            ge=1,
            le=500,
            description="Max rows to return for paged/lazy loading.",
        ),
    ] = None,
    offset: Annotated[
        int,
        Query(
            ge=0,
            description="Row offset for paged/lazy loading.",
        ),
    ] = 0,
):
    ids = None
    if firewall_ids is not None:
        ids = _parse_firewall_ids_query(firewall_ids)

    if limit is not None:
        tasks, has_more = list_tasks_with_firewall_page(
            db,
            firewall_ids=ids,
            limit=limit,
            offset=offset,
        )
        return {
            "tasks": tasks,
            "total": None,
            "limit": limit,
            "offset": offset,
            "has_more": has_more,
        }

    if firewall_ids is None:
        tasks = list_tasks_with_firewall(db)
    else:
        tasks = list_tasks_with_firewall(db, ids)
    total = len(tasks)
    return {
        "tasks": tasks,
        "total": total,
        "offset": 0,
        "limit": total,
        "has_more": False,
    }


@app.get("/api/task-queue/count", name="api_task_queue_count")
def api_task_queue_count(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    s = task_queue_badge_summary(db)
    return {"count": s["count"], "error_count": s["error_count"]}


@app.get("/api/task-queue/completed", name="api_task_queue_completed_list")
def api_task_queue_completed_list(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[
        int,
        Query(
            ge=1,
            le=500,
            description="Max completed rows to return for paged/lazy loading.",
        ),
    ] = 200,
    offset: Annotated[
        int,
        Query(
            ge=0,
            description="Row offset for paged/lazy loading.",
        ),
    ] = 0,
):
    rows, has_more = list_completed_tasks_with_firewall_page(
        db,
        limit=limit,
        offset=offset,
    )
    return {
        "rows": rows,
        "offset": offset,
        "limit": limit,
        "has_more": has_more,
    }


@app.post("/api/task-queue/enqueue-interface", name="api_task_queue_enqueue_interface")
def api_task_queue_enqueue_interface(
    body: EnqueueInterfaceUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_interface_update(
            db,
            config_entry_id=body.config_entry_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post("/api/task-queue/enqueue-vlan", name="api_task_queue_enqueue_vlan")
def api_task_queue_enqueue_vlan(
    body: EnqueueInterfaceUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_vlan_update(
            db,
            config_entry_id=body.config_entry_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post("/api/task-queue/enqueue-lag", name="api_task_queue_enqueue_lag")
def api_task_queue_enqueue_lag(
    body: EnqueueInterfaceUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_lag_update(
            db,
            config_entry_id=body.config_entry_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post(
    "/api/task-queue/enqueue-lag-create",
    name="api_task_queue_enqueue_lag_create",
)
def api_task_queue_enqueue_lag_create(
    body: EnqueueLagCreateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_lag_create(
            db,
            firewall_id=body.firewall_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
            force=body.force,
        )
    except LagCreateCacheConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "message": str(exc),
                "code": "lag_cache_conflict",
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post("/api/task-queue/enqueue-zone", name="api_task_queue_enqueue_zone")
def api_task_queue_enqueue_zone(
    body: EnqueueInterfaceUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_zone_update(
            db,
            config_entry_id=body.config_entry_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post(
    "/api/task-queue/enqueue-zone-updates-batch",
    name="api_task_queue_enqueue_zone_updates_batch",
)
def api_task_queue_enqueue_zone_updates_batch(
    body: ZoneUpdateBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_zone_update_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-zone-create-batch",
    name="api_task_queue_enqueue_zone_create_batch",
)
def api_task_queue_enqueue_zone_create_batch(
    body: ZoneCreateBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_zone_create_batch(
            db,
            firewall_ids=body.firewall_ids,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-bridge-pair", name="api_task_queue_enqueue_bridge_pair"
)
def api_task_queue_enqueue_bridge_pair(
    body: EnqueueInterfaceUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_bridge_pair_update(
            db,
            config_entry_id=body.config_entry_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post("/api/task-queue/enqueue-alias", name="api_task_queue_enqueue_alias")
def api_task_queue_enqueue_alias(
    body: EnqueueInterfaceUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_alias_update(
            db,
            config_entry_id=body.config_entry_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post(
    "/api/task-queue/enqueue-alias-create",
    name="api_task_queue_enqueue_alias_create",
)
def api_task_queue_enqueue_alias_create(
    body: EnqueueAliasCreateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_alias_create(
            db,
            firewall_id=body.firewall_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post(
    "/api/task-queue/enqueue-bridge-pair-create",
    name="api_task_queue_enqueue_bridge_pair_create",
)
def api_task_queue_enqueue_bridge_pair_create(
    body: EnqueueBridgePairCreateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_bridge_pair_create(
            db,
            firewall_id=body.firewall_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
            force=body.force,
        )
    except BridgePairCreateCacheConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "message": str(exc),
                "code": "bridge_pair_cache_conflict",
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post("/api/task-queue/enqueue-ip-host", name="api_task_queue_enqueue_ip_host")
def api_task_queue_enqueue_ip_host(
    body: EnqueueIpHostUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_ip_host_update(
            db,
            config_entry_id=body.config_entry_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post(
    "/api/task-queue/enqueue-ip-host-updates-batch",
    name="api_task_queue_enqueue_ip_host_updates_batch",
)
def api_task_queue_enqueue_ip_host_updates_batch(
    body: EnqueueIpHostUpdateBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    """Apply the same IP host flyout payload to multiple cached host rows (e.g. combined table)."""
    try:
        tasks = enqueue_ip_host_update_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks]}


@app.post(
    "/api/task-queue/enqueue-ip-host-deletes-batch",
    name="api_task_queue_enqueue_ip_host_deletes_batch",
)
def api_task_queue_enqueue_ip_host_deletes_batch(
    body: EnqueueIpHostDeleteBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    """Queue removal of cached IP host objects on their firewalls (Sophos remove by name)."""
    try:
        tasks = enqueue_ip_host_delete_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks]}


@app.post(
    "/api/task-queue/enqueue-ip-host-create",
    name="api_task_queue_enqueue_ip_host_create",
)
def api_task_queue_enqueue_ip_host_create(
    body: EnqueueIpHostCreateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_ip_host_create(
            db,
            firewall_id=body.firewall_id,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post(
    "/api/task-queue/enqueue-ip-host-create-batch",
    name="api_task_queue_enqueue_ip_host_create_batch",
)
def api_task_queue_enqueue_ip_host_create_batch(
    body: EnqueueIpHostCreateBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_ip_host_create_many(
            db,
            firewall_ids=body.firewall_ids,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-hs-deletes-batch",
    name="api_task_queue_enqueue_hs_deletes_batch",
)
def api_task_queue_enqueue_hs_deletes_batch(
    body: EnqueueHsDeleteBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    """Queue deletes for any Hosts & Services cached object (including IP host)."""
    try:
        tasks = enqueue_hs_deletes_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-network-entity-deletes-batch",
    name="api_task_queue_enqueue_network_entity_deletes_batch",
)
def api_task_queue_enqueue_network_entity_deletes_batch(
    body: EnqueueHsDeleteBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    """Queue removal of VLAN, bridge pair, LAG, alias, or zone objects (not physical interfaces)."""
    try:
        tasks = enqueue_network_entity_deletes_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-ips-switch-batch",
    name="api_task_queue_enqueue_ips_switch_batch",
)
def api_task_queue_enqueue_ips_switch_batch(
    body: EnqueueIpsSwitchBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    """Queue IPS switch Enable/Disable per cached config entry (Protect · IPSSwitch)."""
    try:
        pairs = [(it.config_entry_id, it.status) for it in body.items]
        tasks = enqueue_ips_switch_updates_batch(
            db,
            items=pairs,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-dos-settings-update",
    name="api_task_queue_enqueue_dos_settings_update",
)
def api_task_queue_enqueue_dos_settings_update(
    body: EnqueueDosSettingsUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    """Queue Set DoSSettings (singleton cache row ``__config__``)."""
    try:
        task = enqueue_dos_settings_update(
            db,
            firewall_id=body.firewall_id,
            settings_patch=body.settings,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post(
    "/api/task-queue/enqueue-spoof-prevention-update",
    name="api_task_queue_enqueue_spoof_prevention_update",
)
def api_task_queue_enqueue_spoof_prevention_update(
    body: EnqueueSpoofPreventionUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    """Queue Set SpoofPrevention (singleton cache row ``__config__``)."""
    try:
        task = enqueue_spoof_prevention_update(
            db,
            firewall_id=body.firewall_id,
            settings_client=body.settings,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post(
    "/api/task-queue/enqueue-hs-updates-batch",
    name="api_task_queue_enqueue_hs_updates_batch",
)
def api_task_queue_enqueue_hs_updates_batch(
    body: EnqueueHsUpdateBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_hs_entity_update_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-firewall-rule-reorder-batch",
    name="api_task_queue_enqueue_firewall_rule_reorder_batch",
)
def api_task_queue_enqueue_firewall_rule_reorder_batch(
    body: EnqueueFirewallRuleReorderBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_firewall_rule_reorder_batch(
            db,
            firewall_id=int(body.firewall_id),
            ordered_config_entry_ids=body.ordered_config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [int(t.id) for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-hs-creates-batch",
    name="api_task_queue_enqueue_hs_creates_batch",
)
def api_task_queue_enqueue_hs_creates_batch(
    body: EnqueueHsCreateBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    et = (body.entity_type or "").strip()
    if et not in HOSTS_SERVICES_ENTITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown entity_type. Allowed: {', '.join(sorted(HOSTS_SERVICES_ENTITY_TYPES))}.",
        )
    try:
        tasks = enqueue_hs_entity_create_many(
            db,
            firewall_ids=body.firewall_ids,
            entity_type=et,
            form=body.form,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post("/api/task-queue/delete", name="api_task_queue_delete")
def api_task_queue_delete(
    body: TaskQueueDeleteBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    n = delete_tasks(
        db,
        [i for i in body.ids if i > 0],
        removed_by_user_id=uid,
        removed_by_username=users_service.username_for_user_id(uid),
    )
    return {"ok": True, "deleted": n}


@app.get("/api/task-queue/{task_id}/compare", name="api_task_queue_compare")
def api_task_queue_compare(
    task_id: int,
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    if task_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid task id")
    data = task_queue_compare_payload(db, task_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return data


@app.get(
    "/api/task-queue/completed/{completed_id}/compare",
    name="api_task_queue_completed_compare",
)
def api_task_queue_completed_compare(
    completed_id: int,
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    if completed_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid completed task id")
    data = completed_task_compare_payload(db, completed_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Completed task not found")
    return data


@app.get(
    "/api/firewalls/changelog/{entry_id}/compare",
    name="api_firewall_changelog_compare",
)
def api_firewall_changelog_compare(
    entry_id: int,
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    if entry_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid changelog id")
    data = firewall_changelog_compare_payload(db, entry_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Changelog entry not found")
    return data


@app.get(
    "/api/firewalls/sync-runs/{sync_run_id}/details",
    name="api_firewall_sync_run_details",
)
def api_firewall_sync_run_details(
    sync_run_id: str,
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    sid = (sync_run_id or "").strip()
    try:
        uuid.UUID(sid)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid sync run id")
    data = firewall_sync_run_details_payload(db, sid)
    if data is None:
        raise HTTPException(status_code=404, detail="Sync run not found")
    return data


@app.post("/api/task-queue/{task_id}/send", name="api_task_queue_send")
def api_task_queue_send(
    task_id: int,
    background_tasks: BackgroundTasks,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    if task_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid task id")
    if db.get(TaskQueue, task_id) is None:
        raise HTTPException(status_code=404, detail="Task not found")
    cuname = users_service.username_for_user_id(uid)
    background_activity.register(uid, background_activity.MSG_TASK_QUEUE)
    background_tasks.add_task(_bg_task_queue_send, task_id, uid, cuname)
    return JSONResponse(
        status_code=202,
        content={
            "ok": True,
            "accepted": True,
            "task_id": task_id,
            "message": _GC_BG_ASYNC_MSG,
        },
    )


@app.post(
    "/api/task-queue/send-all",
    name="api_task_queue_send_all",
    response_model=None,
)
def api_task_queue_send_all(
    background_tasks: BackgroundTasks,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    body: Annotated[TaskQueueSendAllBody | None, Body()] = None,
) -> dict[str, Any] | JSONResponse:
    # Empty list must mean "no filter": the UI sends firewall_ids whenever
    # gcGetSelectedFirewallIds exists, which returns [] when the multiselect
    # is absent or nothing is checked — same as omitting the field.
    if body is None or body.firewall_ids is None or not body.firewall_ids:
        ids = list_sendable_task_ids(db)
    else:
        fids = [i for i in body.firewall_ids if i > 0]
        fids = list(dict.fromkeys(fids))
        ids = list_sendable_task_ids(db, fids)
    if not ids:
        post_sync = run_post_task_queue_syncs(db, sdb, {})
        return {
            "ok": True,
            "processed": 0,
            "succeeded": 0,
            "failed": 0,
            "errors": [],
            "post_sync": post_sync,
        }
    cuname = users_service.username_for_user_id(uid)
    background_activity.register(uid, background_activity.MSG_TASK_QUEUE)
    background_tasks.add_task(_bg_task_queue_send_batch, list(ids), uid, cuname)
    return JSONResponse(
        status_code=202,
        content={
            "ok": True,
            "accepted": True,
            "queued": len(ids),
            "message": _GC_BG_ASYNC_MSG,
        },
    )


@app.post(
    "/api/task-queue/send-selected",
    name="api_task_queue_send_selected",
    response_model=None,
)
def api_task_queue_send_selected(
    background_tasks: BackgroundTasks,
    body: TaskQueueSendSelectedBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
) -> dict[str, Any] | JSONResponse:
    ids = filter_sendable_task_ids_in_order(db, body.ids)
    if not ids:
        post_sync = run_post_task_queue_syncs(db, sdb, {})
        return {
            "ok": True,
            "processed": 0,
            "succeeded": 0,
            "failed": 0,
            "errors": [],
            "post_sync": post_sync,
        }
    cuname = users_service.username_for_user_id(uid)
    background_activity.register(uid, background_activity.MSG_TASK_QUEUE)
    background_tasks.add_task(_bg_task_queue_send_batch, list(ids), uid, cuname)
    return JSONResponse(
        status_code=202,
        content={
            "ok": True,
            "accepted": True,
            "queued": len(ids),
            "message": _GC_BG_ASYNC_MSG,
        },
    )


@app.get("/api/background-sync-status", name="api_background_sync_status")
def api_background_sync_status(
    uid: Annotated[str, Depends(current_user_id_dep)],
) -> dict[str, Any]:
    """Whether this user has firewall/task-queue background work still running (for banner restore)."""
    return dict(background_activity.snapshot(uid))


def _firewall_config_table_payload(
    db: Session,
    ids: list[int],
    entity_type: str,
    *,
    zones_combine: bool = True,
) -> dict[str, Any]:
    rows_db = chunked_in_query(
        lambda chunk: (
            db.query(FirewallConfigEntry, Firewall)
            .join(Firewall, Firewall.id == FirewallConfigEntry.firewall_id)
            .filter(
                FirewallConfigEntry.entity_type == entity_type,
                FirewallConfigEntry.firewall_id.in_(chunk),
            )
            .order_by(
                Firewall.name.asc().nulls_last(),
                Firewall.host.asc(),
                FirewallConfigEntry.external_name.asc(),
            )
            .all()
        ),
        ids,
    )
    rows_db.sort(
        key=lambda r: (
            (r[1].name or "").casefold(),
            (r[1].host or "").casefold(),
            r[0].external_name.casefold(),
        )
    )

    parsed: list[tuple[FirewallConfigEntry, Firewall, dict[str, Any]]] = []
    for ent, fw in rows_db:
        try:
            data = json.loads(ent.payload_json)
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        parsed.append((ent, fw, data))

    if entity_type == ENTITY_ZONE:
        if zones_combine:
            return build_zone_network_table_rows(parsed)
        return build_zone_network_table_rows_flat(parsed)
    return build_interface_table_rows(parsed)


def _firewall_config_unified_interfaces_payload(
    db: Session, ids: list[int], *, combine: bool = True
) -> dict[str, Any]:
    """Interfaces tab: interface + VLAN + bridge-pair + LAG + alias rows."""
    if not ids:
        return {
            "columns": [],
            "column_labels": {},
            "columns_visible_by_default": [],
            "rows": [],
            "interfaces_combined": combine,
            "interfaces_combine_conflicts": False,
        }
    lag_hw_by_fw: dict[int, set[str]] = {}
    lag_rows = (
        db.query(FirewallConfigEntry, Firewall)
        .join(Firewall, Firewall.id == FirewallConfigEntry.firewall_id)
        .filter(
            FirewallConfigEntry.entity_type == ENTITY_LAG,
            FirewallConfigEntry.firewall_id.in_(ids),
        )
        .all()
    )
    for ent, fw in lag_rows:
        lag_hw_by_fw.setdefault(fw.id, set()).add(ent.external_name)

    tagged: list[tuple[Any, Any, dict[str, Any], str]] = []
    for et in (
        ENTITY_INTERFACE,
        ENTITY_VLAN,
        ENTITY_BRIDGE_PAIR,
        ENTITY_LAG,
        ENTITY_ALIAS,
    ):
        rows_db = (
            db.query(FirewallConfigEntry, Firewall)
            .join(Firewall, Firewall.id == FirewallConfigEntry.firewall_id)
            .filter(
                FirewallConfigEntry.entity_type == et,
                FirewallConfigEntry.firewall_id.in_(ids),
            )
            .order_by(
                Firewall.name.asc().nulls_last(),
                Firewall.host.asc(),
                FirewallConfigEntry.external_name.asc(),
            )
            .all()
        )
        for ent, fw in rows_db:
            try:
                data = json.loads(ent.payload_json)
            except json.JSONDecodeError:
                data = {}
            if not isinstance(data, dict):
                data = {}
            if et == ENTITY_INTERFACE:
                if interface_payload_is_lag_master(data):
                    hw_lag = lag_hardware_name_from_payload(data)
                    if hw_lag and hw_lag in lag_hw_by_fw.get(fw.id, set()):
                        continue
            tagged.append((ent, fw, data, et))
    tagged.sort(
        key=lambda t: (
            (t[1].name or "").lower(),
            (t[1].host or "").lower(),
            t[0].external_name.lower(),
        )
    )
    if combine:
        return build_unified_interfaces_tab_rows_combined(tagged)
    return build_unified_interfaces_tab_rows(tagged)


def _compute_facets(
    rows: list[dict[str, Any]], columns: list[str]
) -> dict[str, dict[str, int]]:
    """Compute facet value counts for each column across all rows."""
    facets: dict[str, dict[str, int]] = {}
    for col in columns:
        counts: dict[str, int] = {}
        for row in rows:
            val = row.get(col)
            if val is None:
                val = ""
            key = str(val)
            counts[key] = counts.get(key, 0) + 1
        facets[col] = counts
    return facets


def _paginate_table_payload(
    payload: dict[str, Any],
    *,
    q: str = "",
    limit: int | None = None,
    offset: int = 0,
) -> dict[str, Any]:
    """Apply optional server-side search and pagination to a builder result.

    Search matches against the ``data-search``-like concatenation of all string
    values in each row dict.  Facet counts are computed from the *full*
    (pre-pagination) filtered set.
    """
    rows = payload.get("rows", [])
    columns = payload.get("columns", [])
    search = q.strip().lower()
    if search:
        filtered = []
        for row in rows:
            text_parts = []
            for v in row.values():
                if isinstance(v, str):
                    text_parts.append(v.lower())
            haystack = " ".join(text_parts)
            if search in haystack:
                filtered.append(row)
        rows = filtered

    total_filtered = len(rows)

    facets = _compute_facets(rows, columns) if columns else {}

    if limit is not None:
        has_more = (offset + limit) < total_filtered
        rows = rows[offset : offset + limit]
    else:
        has_more = False

    payload = dict(payload)
    payload["rows"] = rows
    payload["total_rows"] = total_filtered
    payload["facets"] = facets
    if limit is not None:
        payload["limit"] = limit
        payload["offset"] = offset
        payload["has_more"] = has_more
    return payload


def _api_hosts_services_entities(
    firewall_ids: str,
    configuration_ids: str,
    entity_type: str,
    db: Session,
    *,
    combine: bool = True,
    q: str = "",
    limit: int | None = None,
    offset: int = 0,
) -> dict[str, Any]:
    fids = _parse_firewall_ids_query(firewall_ids)
    cids = _parse_configuration_ids_query(configuration_ids)
    both_scopes = bool(fids) and bool(cids)
    combine_eff = False if both_scopes else combine

    def _empty_hs() -> dict[str, Any]:
        empty: dict[str, Any] = {
            "columns": [],
            "column_labels": {},
            "columns_visible_by_default": [],
            "rows": [],
            "hs_combined": combine,
            "hs_combine_conflicts": False,
        }
        if entity_type == "ip_host":
            empty["ip_hosts_combine_conflicts"] = False
            empty["ip_hosts_combined"] = combine
        return empty

    if not fids and not cids:
        return _empty_hs()

    fw_result: dict[str, Any] | None = None
    if fids:
        rows_db = chunked_in_query(
            lambda chunk: (
                db.query(FirewallConfigEntry, Firewall)
                .join(Firewall, Firewall.id == FirewallConfigEntry.firewall_id)
                .filter(
                    FirewallConfigEntry.entity_type == entity_type,
                    FirewallConfigEntry.firewall_id.in_(chunk),
                )
                .order_by(
                    Firewall.name.asc().nulls_last(),
                    Firewall.host.asc(),
                    FirewallConfigEntry.external_name.asc(),
                )
                .all()
            ),
            fids,
        )
        rows_db.sort(
            key=lambda r: (
                (r[1].name or "").casefold(),
                (r[1].host or "").casefold(),
                r[0].external_name.casefold(),
            )
        )
        parsed: list[tuple[FirewallConfigEntry, Firewall, dict[str, Any]]] = []
        for ent, fw in rows_db:
            try:
                data = json.loads(ent.payload_json)
            except json.JSONDecodeError:
                data = {}
            if not isinstance(data, dict):
                data = {}
            parsed.append((ent, fw, data))
        if combine_eff:
            if entity_type == "ip_host":
                fw_result = build_ip_host_table_rows_combined(parsed)
            else:
                fw_result = build_hs_table_rows_combined(
                    parsed, entity_type=entity_type
                )
        else:
            fw_result = build_hosts_services_table_rows(parsed, entity_type=entity_type)

    cfg_result: dict[str, Any] | None = None
    if cids:
        cfg_result = configuration_hosts_services_table_payload(
            db, cids, entity_type, combine=combine_eff
        )

    if cfg_result is None:
        assert fw_result is not None
        return _paginate_table_payload(fw_result, q=q, limit=limit, offset=offset)
    if fw_result is None:
        return _paginate_table_payload(cfg_result, q=q, limit=limit, offset=offset)
    merged_hs = _merge_vertical_table_payloads(fw_result, cfg_result)
    cl_hs = merged_hs.get("column_labels")
    if isinstance(cl_hs, dict) and cl_hs.get("firewall") in (
        "Firewall",
        "Configuration",
    ):
        cl_hs = dict(cl_hs)
        cl_hs["firewall"] = "Scope"
        merged_hs["column_labels"] = cl_hs
    return _paginate_table_payload(merged_hs, q=q, limit=limit, offset=offset)


def _api_firewalls_network_entities(
    firewall_ids: str,
    entity_type: str,
    db: Session,
    *,
    configuration_ids: str = "",
    zones_combine: bool = True,
    q: str = "",
    limit: int | None = None,
    offset: int = 0,
) -> dict[str, Any]:
    fids = _parse_firewall_ids_query(firewall_ids)
    cids = _parse_configuration_ids_query(configuration_ids)

    empty: dict[str, Any] = {
        "columns": [],
        "column_labels": {},
        "columns_visible_by_default": [],
        "rows": [],
    }
    if entity_type == ENTITY_ZONE:
        empty["zones_combine_conflicts"] = False
        empty["zones_combined"] = zones_combine

    if not fids and not cids:
        return empty

    fw_result: dict[str, Any] | None = None
    if fids:
        fw_result = _firewall_config_table_payload(
            db, fids, entity_type, zones_combine=zones_combine
        )
    cfg_result: dict[str, Any] | None = None
    if cids:
        cfg_result = configuration_network_table_payload(
            db, cids, entity_type, zones_combine=zones_combine
        )

    if fw_result is None:
        assert cfg_result is not None
        result = cfg_result
    elif cfg_result is None:
        result = fw_result
    else:
        if entity_type == ENTITY_ZONE and zones_combine:
            result = merge_zone_combined_payloads_cross_scope(fw_result, cfg_result)
        else:
            result = _merge_vertical_table_payloads(fw_result, cfg_result)
        if entity_type == ENTITY_ZONE:
            cl_z = result.get("column_labels")
            if isinstance(cl_z, dict) and cl_z.get("firewall") in (
                "Firewall",
                "Configuration",
            ):
                cl_z = dict(cl_z)
                cl_z["firewall"] = "Scope"
                result["column_labels"] = cl_z
    return _paginate_table_payload(result, q=q, limit=limit, offset=offset)


@app.get(
    "/api/firewalls/nav-multiselect",
    name="api_firewalls_nav_multiselect",
)
def api_firewalls_nav_multiselect(
    request: Request,
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    """Firewall id, label, tags, description, and action URLs for the global top-bar selector."""
    return nav_firewalls_multiselect_json(db, request)


@app.get(
    "/api/firewalls/network/interfaces",
    name="api_firewalls_network_interfaces",
)
def api_firewalls_network_interfaces(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
    configuration_ids: Annotated[
        str, Query(description="Comma-separated virtual configuration IDs")
    ] = "",
    combine: Annotated[
        bool,
        Query(
            description="Merge rows with the same name and type across selected scopes",
        ),
    ] = True,
):
    """
    Network interface tab rows: physical interfaces, VLANs, and bridge pairs for selected firewalls.
    Columns include Type (Interface / VLAN / Bridge pair), Name, Zone, Status, Address (CIDR), etc.
    """
    ids = _parse_firewall_ids_query(firewall_ids)
    cids = _parse_configuration_ids_query(configuration_ids)
    return _merged_unified_interfaces_payload(db, ids, cids, combine=combine)


@app.get(
    "/api/firewalls/network/vlans",
    name="api_firewalls_network_vlans",
)
def api_firewalls_network_vlans(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
    configuration_ids: Annotated[
        str, Query(description="Comma-separated virtual configuration IDs")
    ] = "",
):
    """VLAN config rows (same column layout as interfaces)."""
    return _api_firewalls_network_entities(
        firewall_ids, ENTITY_VLAN, db, configuration_ids=configuration_ids
    )


@app.get(
    "/api/firewalls/hosts-services/table",
    name="api_firewalls_hosts_services_table",
)
def api_firewalls_hosts_services_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    entity_type: Annotated[
        str,
        Query(
            ...,
            description="Cache entity id: ip_host, ip_hostgroup, mac_host, …",
        ),
    ],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
    configuration_ids: Annotated[
        str, Query(description="Comma-separated virtual configuration IDs")
    ] = "",
    combine: Annotated[
        bool,
        Query(
            description="Merge rows with the same identity across selected firewalls (per tab).",
        ),
    ] = True,
    q: Annotated[str, Query(description="Server-side text search filter.")] = "",
    limit: Annotated[
        int | None, Query(ge=1, le=5000, description="Max rows to return.")
    ] = None,
    offset: Annotated[int, Query(ge=0, description="Row offset for paging.")] = 0,
):
    """Flattened rows from firewall_config_entries for Hosts & Services tabs."""
    et = (entity_type or "").strip()
    if et not in HOSTS_SERVICES_ENTITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown entity_type. Allowed: {', '.join(sorted(HOSTS_SERVICES_ENTITY_TYPES))}.",
        )
    return _api_hosts_services_entities(
        firewall_ids,
        configuration_ids,
        et,
        db,
        combine=combine,
        q=q,
        limit=limit,
        offset=offset,
    )


@app.get(
    "/api/firewalls/hosts-services/ip-hostgroup-names",
    name="api_hosts_services_ip_hostgroup_names",
)
def api_hosts_services_ip_hostgroup_names(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_id: Annotated[
        int, Query(..., ge=1, description="Firewall id for the IP host row")
    ],
):
    """Cached IP host groups for the firewall: ``{ groups: [{ name, description }, ...] }`` for the flyout picker."""
    return {"groups": list_ip_hostgroups_for_firewall(db, firewall_id)}


@app.post(
    "/api/firewalls/hosts-services/ip-hostgroup-aggregate",
    name="api_hosts_services_ip_hostgroup_aggregate",
)
def api_hosts_services_ip_hostgroup_aggregate(
    body: IpHostgroupAggregateBody,
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Union of IP host group names across firewalls, with ``on_all_firewalls`` for the add-host flyout.
    """
    return aggregate_ip_hostgroups_for_firewalls(db, body.firewall_ids)


@app.get(
    "/api/firewalls/hosts-services/fqdn-hostgroup-names",
    name="api_hosts_services_fqdn_hostgroup_names",
)
def api_hosts_services_fqdn_hostgroup_names(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_id: Annotated[int, Query(..., ge=1, description="Firewall id")],
):
    return {"groups": list_fqdn_hostgroups_for_firewall(db, firewall_id)}


@app.post(
    "/api/firewalls/hosts-services/cached-names-aggregate",
    name="api_hosts_services_cached_names_aggregate",
)
def api_hosts_services_cached_names_aggregate(
    body: HsCachedNamesAggregateBody,
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    et = (body.entity_type or "").strip()
    if et not in HS_CACHED_MEMBER_ENTITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unknown entity_type. Allowed: "
                f"{', '.join(sorted(HS_CACHED_MEMBER_ENTITY_TYPES))}."
            ),
        )
    return aggregate_named_entities_for_firewalls(db, body.firewall_ids, et)


@app.get(
    "/api/firewalls/network/zones",
    name="api_firewalls_network_zones",
)
def api_firewalls_network_zones(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
    configuration_ids: Annotated[
        str, Query(description="Comma-separated virtual configuration IDs")
    ] = "",
    combine: Annotated[
        bool,
        Query(
            description="Merge rows by zone name; when false, one row per zone per firewall.",
        ),
    ] = True,
    q: Annotated[str, Query(description="Server-side text search filter.")] = "",
    limit: Annotated[
        int | None, Query(ge=1, le=5000, description="Max rows to return.")
    ] = None,
    offset: Annotated[int, Query(ge=0, description="Row offset for paging.")] = 0,
):
    """
    Zone rows: with combine=true, unique zone names with a Firewalls column; with
    combine=false, one row per cached zone entry per firewall.
    """
    return _api_firewalls_network_entities(
        firewall_ids,
        ENTITY_ZONE,
        db,
        configuration_ids=configuration_ids,
        zones_combine=combine,
        q=q,
        limit=limit,
        offset=offset,
    )


@app.get(
    "/api/firewalls/intrusion-prevention/ips-switch-table",
    name="api_firewalls_ips_switch_table",
)
def api_firewalls_ips_switch_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
):
    """One row per selected firewall: cached IPS switch status (sync ips_switch to populate)."""
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_ips_switch_table_payload(db, ids)


@app.get(
    "/api/firewalls/intrusion-prevention/ips-policy-table",
    name="api_firewalls_ips_policy_table",
)
def api_firewalls_ips_policy_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
    combine: Annotated[
        bool,
        Query(
            description="When true, merge policies with the same name across firewalls.",
        ),
    ] = True,
):
    """Cached IPS policies (sync ``ips_policy`` from Inventory)."""
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_ips_policy_table_payload(db, ids, combine=combine)


@app.post(
    "/api/task-queue/enqueue-ips-policy-create",
    name="api_task_queue_enqueue_ips_policy_create",
)
def api_task_queue_enqueue_ips_policy_create(
    body: EnqueueIpsPolicyCreateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_ips_policy_create(
            db,
            firewall_id=body.firewall_id,
            policy_client=body.policy,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id}


@app.post(
    "/api/task-queue/enqueue-ips-policy-update",
    name="api_task_queue_enqueue_ips_policy_update",
)
def api_task_queue_enqueue_ips_policy_update(
    body: EnqueueIpsPolicyUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_ips_policy_update(
            db,
            config_entry_id=body.config_entry_id,
            policy_client=body.policy,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post(
    "/api/task-queue/enqueue-ips-policy-deletes-batch",
    name="api_task_queue_enqueue_ips_policy_deletes_batch",
)
def api_task_queue_enqueue_ips_policy_deletes_batch(
    body: EnqueueIpsPolicyDeleteBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_ips_policy_deletes_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.get(
    "/api/firewalls/intrusion-prevention/ips-custom-signature-table",
    name="api_firewalls_ips_custom_signature_table",
)
def api_firewalls_ips_custom_signature_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
    combine: Annotated[
        bool,
        Query(
            description="When true, merge signatures with the same name across firewalls.",
        ),
    ] = True,
):
    """Cached IPS custom signatures (sync ``ips_custom_signature`` from Inventory)."""
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_ips_custom_signature_table_payload(db, ids, combine=combine)


@app.get(
    "/api/firewalls/intrusion-prevention/ips-trusted-mac-table",
    name="api_firewalls_ips_trusted_mac_table",
)
def api_firewalls_ips_trusted_mac_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
    combine: Annotated[
        bool,
        Query(
            description="When true, merge entries with the same MAC across firewalls.",
        ),
    ] = True,
):
    """Cached Trusted MAC list (sync ``trusted_mac`` from Inventory)."""
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_ips_trusted_mac_table_payload(db, ids, combine=combine)


@app.get(
    "/api/firewalls/protect/web/webfilter-policy-table",
    name="api_firewalls_webfilter_policy_table",
)
def api_firewalls_webfilter_policy_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
    combine: Annotated[
        bool,
        Query(
            description="When true, merge policies with the same name across firewalls.",
        ),
    ] = True,
):
    """Cached web filter policies (sync ``webfilterpolicy`` from Inventory)."""
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_webfilter_policy_table_payload(db, ids, combine=combine)


@app.post(
    "/api/task-queue/enqueue-webfilter-policy-create",
    name="api_task_queue_enqueue_webfilter_policy_create",
)
def api_task_queue_enqueue_webfilter_policy_create(
    body: EnqueueWebfilterPolicyCreateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_webfilter_policy_create(
            db,
            firewall_id=body.firewall_id,
            policy_client=body.policy,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id}


@app.post(
    "/api/task-queue/enqueue-webfilter-policy-update",
    name="api_task_queue_enqueue_webfilter_policy_update",
)
def api_task_queue_enqueue_webfilter_policy_update(
    body: EnqueueWebfilterPolicyUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_webfilter_policy_update(
            db,
            config_entry_id=body.config_entry_id,
            policy_client=body.policy,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post(
    "/api/task-queue/enqueue-webfilter-policy-deletes-batch",
    name="api_task_queue_enqueue_webfilter_policy_deletes_batch",
)
def api_task_queue_enqueue_webfilter_policy_deletes_batch(
    body: EnqueueWebfilterPolicyDeleteBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_webfilter_policy_deletes_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.get(
    "/api/firewalls/protect/web/user-activity-table",
    name="api_firewalls_user_activity_table",
)
def api_firewalls_user_activity_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
):
    """Cached user activities (sync ``useractivity`` from Inventory)."""
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_user_activity_table_payload(db, ids)


@app.get(
    "/api/firewalls/protect/web/url-group-table",
    name="api_firewalls_url_group_table",
)
def api_firewalls_url_group_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
):
    """Cached URL groups (sync ``url_group`` from Inventory)."""
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_url_group_table_payload(db, ids)


@app.get(
    "/api/firewalls/protect/firewall/firewall-rules-table",
    name="api_firewalls_firewall_rules_table",
)
def api_firewalls_firewall_rules_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
):
    """Cached firewall rules (sync ``firewall_rule`` from Inventory)."""
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_firewall_rule_table_payload(db, ids)


@app.get(
    "/api/firewalls/configure/authentication/users-table",
    name="api_firewalls_auth_user_table",
)
def api_firewalls_auth_user_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
):
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_auth_user_table_payload(db, ids)


@app.get(
    "/api/firewalls/configure/authentication/groups-table",
    name="api_firewalls_auth_user_group_table",
)
def api_firewalls_auth_user_group_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
):
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_auth_user_group_table_payload(db, ids)


@app.get(
    "/api/firewalls/configure/authentication/admin-profile-options",
    name="api_firewalls_auth_admin_profile_options",
)
def api_firewalls_auth_admin_profile_options(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
):
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_admin_profile_options_payload(db, ids)


@app.get(
    "/api/firewalls/configure/authentication/user-group-options",
    name="api_firewalls_auth_user_group_options",
)
def api_firewalls_auth_user_group_options(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
):
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_user_group_options_payload(db, ids)


@app.get(
    "/api/firewalls/system/profiles/device-access-table",
    name="api_firewalls_admin_profile_table",
)
def api_firewalls_admin_profile_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
    combine: Annotated[bool, Query()] = True,
):
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_admin_profile_table_payload(db, ids, combine=combine)


@app.get(
    "/api/firewalls/system/profiles/schedule-table",
    name="api_firewalls_profile_schedule_table",
)
def api_firewalls_profile_schedule_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
    combine: Annotated[bool, Query()] = True,
):
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_schedule_table_payload(db, ids, combine=combine)


@app.get(
    "/api/firewalls/system/profiles/access-time-table",
    name="api_firewalls_profile_access_time_table",
)
def api_firewalls_profile_access_time_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
    combine: Annotated[bool, Query()] = True,
):
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_access_time_policy_table_payload(db, ids, combine=combine)


@app.get(
    "/api/firewalls/system/profiles/surfing-quota-table",
    name="api_firewalls_profile_surfing_quota_table",
)
def api_firewalls_profile_surfing_quota_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
    combine: Annotated[bool, Query()] = True,
):
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_surfing_quota_policy_table_payload(db, ids, combine=combine)


@app.get(
    "/api/firewalls/system/profiles/data-transfer-table",
    name="api_firewalls_profile_data_transfer_table",
)
def api_firewalls_profile_data_transfer_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
    combine: Annotated[bool, Query()] = True,
):
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_data_transfer_policy_table_payload(db, ids, combine=combine)


@app.get(
    "/api/firewalls/system/profiles/vpn-profile-table",
    name="api_firewalls_profile_vpn_profile_table",
)
def api_firewalls_profile_vpn_profile_table(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
    combine: Annotated[bool, Query()] = True,
):
    ids = _parse_firewall_ids_query(firewall_ids)
    return build_vpn_profile_table_payload(db, ids, combine=combine)


@app.post(
    "/api/task-queue/enqueue-auth-user-create",
    name="api_task_queue_enqueue_auth_user_create",
)
def api_task_queue_enqueue_auth_user_create(
    body: EnqueueAuthUserCreateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_auth_user_create(
            db,
            firewall_id=body.firewall_id,
            user_client=body.user,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id}


@app.post(
    "/api/task-queue/enqueue-auth-user-update",
    name="api_task_queue_enqueue_auth_user_update",
)
def api_task_queue_enqueue_auth_user_update(
    body: EnqueueAuthUserUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_auth_user_update(
            db,
            config_entry_id=body.config_entry_id,
            user_client=body.user,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None, "skipped": task is None}


@app.post(
    "/api/task-queue/enqueue-auth-user-deletes-batch",
    name="api_task_queue_enqueue_auth_user_deletes_batch",
)
def api_task_queue_enqueue_auth_user_deletes_batch(
    body: EnqueueAuthUserDeleteBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_auth_user_deletes_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-auth-user-group-create",
    name="api_task_queue_enqueue_auth_user_group_create",
)
def api_task_queue_enqueue_auth_user_group_create(
    body: EnqueueAuthUserGroupCreateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_auth_user_group_create(
            db,
            firewall_id=body.firewall_id,
            group_client=body.group,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id}


@app.post(
    "/api/task-queue/enqueue-auth-user-group-update",
    name="api_task_queue_enqueue_auth_user_group_update",
)
def api_task_queue_enqueue_auth_user_group_update(
    body: EnqueueAuthUserGroupUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_auth_user_group_update(
            db,
            config_entry_id=body.config_entry_id,
            group_client=body.group,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None, "skipped": task is None}


@app.post(
    "/api/task-queue/enqueue-auth-user-group-deletes-batch",
    name="api_task_queue_enqueue_auth_user_group_deletes_batch",
)
def api_task_queue_enqueue_auth_user_group_deletes_batch(
    body: EnqueueAuthUserGroupDeleteBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_auth_user_group_deletes_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-admin-profile-create",
    name="api_task_queue_enqueue_admin_profile_create",
)
def api_task_queue_enqueue_admin_profile_create(
    body: EnqueueAdminProfileCreateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_admin_profile_create(
            db,
            firewall_id=body.firewall_id,
            profile_client=body.profile,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id}


@app.post(
    "/api/task-queue/enqueue-admin-profile-update",
    name="api_task_queue_enqueue_admin_profile_update",
)
def api_task_queue_enqueue_admin_profile_update(
    body: EnqueueAdminProfileUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_admin_profile_update(
            db,
            config_entry_id=body.config_entry_id,
            profile_client=body.profile,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None, "skipped": task is None}


@app.post(
    "/api/task-queue/enqueue-admin-profile-deletes-batch",
    name="api_task_queue_enqueue_admin_profile_deletes_batch",
)
def api_task_queue_enqueue_admin_profile_deletes_batch(
    body: EnqueueAdminProfileDeleteBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_admin_profile_deletes_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-profile-entity-create-batch",
    name="api_task_queue_enqueue_profile_entity_create_batch",
)
def api_task_queue_enqueue_profile_entity_create_batch(
    body: EnqueueProfileEntityCreateBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_profile_entity_create_batch(
            db,
            entity_type=body.entity_type,
            firewall_ids=body.firewall_ids,
            client=body.payload,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-profile-entity-update-batch",
    name="api_task_queue_enqueue_profile_entity_update_batch",
)
def api_task_queue_enqueue_profile_entity_update_batch(
    body: EnqueueProfileEntityUpdateBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_profile_entity_update_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            client=body.payload,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-profile-entity-deletes-batch",
    name="api_task_queue_enqueue_profile_entity_deletes_batch",
)
def api_task_queue_enqueue_profile_entity_deletes_batch(
    body: EnqueueProfileEntityDeletesBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_profile_entity_deletes_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-ips-custom-signature-create",
    name="api_task_queue_enqueue_ips_custom_signature_create",
)
def api_task_queue_enqueue_ips_custom_signature_create(
    body: EnqueueIpsCustomSignatureCreateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_ips_custom_signature_create(
            db,
            firewall_id=body.firewall_id,
            signature_client=body.signature,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id}


@app.post(
    "/api/task-queue/enqueue-ips-custom-signature-create-batch",
    name="api_task_queue_enqueue_ips_custom_signature_create_batch",
)
def api_task_queue_enqueue_ips_custom_signature_create_batch(
    body: EnqueueIpsCustomSignatureCreateBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_ips_custom_signature_create_batch(
            db,
            firewall_ids=body.firewall_ids,
            signature_client=body.signature,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-ips-custom-signature-update",
    name="api_task_queue_enqueue_ips_custom_signature_update",
)
def api_task_queue_enqueue_ips_custom_signature_update(
    body: EnqueueIpsCustomSignatureUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_ips_custom_signature_update(
            db,
            config_entry_id=body.config_entry_id,
            signature_client=body.signature,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post(
    "/api/task-queue/enqueue-ips-custom-signature-deletes-batch",
    name="api_task_queue_enqueue_ips_custom_signature_deletes_batch",
)
def api_task_queue_enqueue_ips_custom_signature_deletes_batch(
    body: EnqueueIpsCustomSignatureDeleteBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_ips_custom_signature_deletes_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-ips-trusted-mac-create-batch",
    name="api_task_queue_enqueue_ips_trusted_mac_create_batch",
)
def api_task_queue_enqueue_ips_trusted_mac_create_batch(
    body: EnqueueIpsTrustedMacCreateBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_ips_trusted_mac_create_batch(
            db,
            firewall_ids=body.firewall_ids,
            trusted_mac_client=body.trusted_mac,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


@app.post(
    "/api/task-queue/enqueue-ips-trusted-mac-update",
    name="api_task_queue_enqueue_ips_trusted_mac_update",
)
def api_task_queue_enqueue_ips_trusted_mac_update(
    body: EnqueueIpsTrustedMacUpdateBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        task = enqueue_ips_trusted_mac_update(
            db,
            config_entry_id=body.config_entry_id,
            trusted_mac_client=body.trusted_mac,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_id": task.id if task else None}


@app.post(
    "/api/task-queue/enqueue-ips-trusted-mac-deletes-batch",
    name="api_task_queue_enqueue_ips_trusted_mac_deletes_batch",
)
def api_task_queue_enqueue_ips_trusted_mac_deletes_batch(
    body: EnqueueIpsTrustedMacDeleteBatchBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        tasks = enqueue_ips_trusted_mac_deletes_batch(
            db,
            config_entry_ids=body.config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "task_ids": [t.id for t in tasks], "count": len(tasks)}


_FW_TAG_MAX_LEN = 64
_FW_TAG_VALUE_MAX_LEN = 512
_FW_TAGS_MAX_COUNT = 50

_DEFAULT_MONITOR_INTERVAL_MINUTES = 5
_MIN_MONITOR_INTERVAL_MINUTES = 1
_MAX_MONITOR_INTERVAL_MINUTES = 1440


def _parse_monitor_interval_minutes(value: str | None) -> int:
    if value is None or not str(value).strip():
        return _DEFAULT_MONITOR_INTERVAL_MINUTES
    try:
        n = int(str(value).strip(), 10)
    except ValueError:
        return _DEFAULT_MONITOR_INTERVAL_MINUTES
    return max(
        _MIN_MONITOR_INTERVAL_MINUTES,
        min(_MAX_MONITOR_INTERVAL_MINUTES, n),
    )


def _parse_api_request_timeout_seconds(value: str | None) -> int:
    if value is None or not str(value).strip():
        return normalize_firewall_api_timeout_seconds(None)
    try:
        n = int(str(value).strip(), 10)
    except ValueError:
        return normalize_firewall_api_timeout_seconds(None)
    return normalize_firewall_api_timeout_seconds(n)


def _firewall_tag_entry_from_form_item(
    x: Any,
) -> tuple[str, str] | None:
    """Parse one tags_json list element into (name, value). Value may be empty."""
    if isinstance(x, str):
        name = x.strip()
        if not name:
            return None
        return (name[:_FW_TAG_MAX_LEN], "")
    if isinstance(x, dict):
        raw_n = x.get("name")
        if not isinstance(raw_n, str):
            raw_n = x.get("n")
        if not isinstance(raw_n, str):
            return None
        name = raw_n.strip()
        if not name:
            return None
        raw_v = x.get("value")
        if not isinstance(raw_v, str):
            raw_v = x.get("v")
        val = ""
        if isinstance(raw_v, str):
            val = raw_v.strip()[:_FW_TAG_VALUE_MAX_LEN]
        return (name[:_FW_TAG_MAX_LEN], val)
    return None


def _canonical_firewall_tags_json(raw: str | None) -> str:
    if not raw or not str(raw).strip():
        return "[]"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return "[]"
    if not isinstance(data, list):
        return "[]"
    seen_lower: set[str] = set()
    out_items: list[str | dict[str, str]] = []
    for x in data:
        parsed = _firewall_tag_entry_from_form_item(x)
        if parsed is None:
            continue
        name, val = parsed
        k = name.casefold()
        if k in seen_lower:
            continue
        seen_lower.add(k)
        if val:
            out_items.append({"name": name, "value": val})
        else:
            out_items.append(name)
        if len(out_items) >= _FW_TAGS_MAX_COUNT:
            break
    return json.dumps(out_items)


def _canonical_member_firewall_ids_json(raw: str | None, *, db: Session) -> str:
    """Store ``{"tags": [...], "firewall_ids": [...]}`` (explicit selections only)."""
    if not raw or not str(raw).strip():
        return json.dumps({"tags": [], "firewall_ids": []})
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return json.dumps({"tags": [], "firewall_ids": []})

    tags_in: list[object] = []
    ids_in: list[object]
    if isinstance(data, list):
        tags_in = []
        ids_in = data
    elif isinstance(data, dict):
        tr = data.get("tags")
        tags_in = tr if isinstance(tr, list) else []
        ids_raw = data.get("firewall_ids")
        if ids_raw is None:
            ids_raw = data.get("firewallIds")
        ids_in = ids_raw if isinstance(ids_raw, list) else []
    else:
        return json.dumps({"tags": [], "firewall_ids": []})

    seen_t: set[str] = set()
    tags_out: list[str] = []
    for x in tags_in:
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

    seen: set[int] = set()
    ids_out: list[int] = []
    for x in ids_in:
        try:
            n = int(x)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        if db.get(Firewall, n) is None:
            continue
        seen.add(n)
        ids_out.append(n)
    ids_out.sort()
    return json.dumps({"tags": tags_out, "firewall_ids": ids_out})


_TEST_FW_SITES = (
    "HQ",
    "Branch",
    "Datacenter",
    "Campus",
    "Remote",
    "Edge",
    "Core",
    "Warehouse",
)
_TEST_FW_ROLES = ("Gateway", "Perimeter", "Transit", "North-South", "East-West")
_TEST_FW_SERIES = ("XGS", "XG", "SG", "PA", "FG", "SRX", "ASA")
_TEST_FW_REGIONS = ("NA", "EMEA", "APAC", "LATAM")
# Approx. UN / World Bank population ranking (largest first); one tag chosen at random per test FW.
_TEST_FW_POPULATION_TOP10_COUNTRIES = (
    "India",
    "China",
    "United States",
    "Indonesia",
    "Pakistan",
    "Nigeria",
    "Brazil",
    "Bangladesh",
    "Russia",
    "Mexico",
)

def _layout_for_new_test_firewall(
    synthetic_layout_token: str | None,
) -> SyntheticFwPortLayout:
    if (
        os.environ.get("GROUND_CONTROL_UNDER_PYTEST") == "1"
        and synthetic_layout_token
    ):
        tok = synthetic_layout_token.strip()
        if tok == "vm4":
            return SyntheticFwPortLayout(vm=4)
        if tok == "copper8_fiber2_mgmt1":
            return SyntheticFwPortLayout(copper=8, fiber=2, mgmt=1)
    return random_port_layout()


def _generate_test_firewall_name() -> str:
    site = random.choice(_TEST_FW_SITES)
    role = random.choice(_TEST_FW_ROLES)
    series = random.choice(_TEST_FW_SERIES)
    region = random.choice(_TEST_FW_REGIONS)
    suffix = random.randint(1, 9999)
    return f"{site} {role} {series}-{suffix:04d} ({region})"


def _create_test_firewalls(
    db: Session,
    sdb: Session,
    *,
    count: int,
    source_firewall_id: int | None = None,
    test_lan_pool_cidr: str = "172.16.0.0/12",
    synthetic_layout_token: str | None = None,
) -> list[Firewall]:
    template_entries: list[FirewallConfigEntry] = []
    if source_firewall_id is not None:
        tab_types = tuple(ENTITY_TYPES_INTERFACES_TAB)
        if not tab_types:
            raise RuntimeError("ENTITY_TYPES_INTERFACES_TAB must not be empty")
        tab_lower = tuple({str(x).casefold() for x in tab_types})
        template_entries = (
            db.query(FirewallConfigEntry)
            .filter(
                FirewallConfigEntry.firewall_id == int(source_firewall_id),
                func.lower(FirewallConfigEntry.entity_type).not_in(tab_lower),
            )
            .all()
        )
    pool = ensure_test_fw_lan_pool(db, test_lan_pool_cidr)
    out: list[Firewall] = []
    bounded = min(max(int(count), 0), TEST_FIREWALL_GENERATE_COUNT_MAX)
    for _ in range(bounded):
        fw = Firewall(
            name=_generate_test_firewall_name(),
            description="Synthetic test firewall",
            host=f"test-fw-{secrets.token_hex(4)}.lab.local",
            port=4444,
            username="admin",
            api_request_timeout_seconds=normalize_firewall_api_timeout_seconds(None),
            verify_ssl=False,
            monitor_enabled=True,
            monitor_interval_minutes=_DEFAULT_MONITOR_INTERVAL_MINUTES,
            tags_json=json.dumps(
                [
                    "Test-Firewall",
                    random.choice(_TEST_FW_POPULATION_TOP10_COUNTRIES),
                ],
                separators=(",", ":"),
            ),
            is_test=True,
        )
        db.add(fw)
        db.flush()
        upsert_firewall_password_encrypted(
            sdb, fw.id, crypto.encrypt_secret(secrets.token_urlsafe(24))
        )
        _, lan_host_ip, lan_netmask = allocate_test_firewall_lan_assignment(
            db,
            pool=pool,
            firewall_id=int(fw.id),
            firewall_name=fw.name or "",
        )
        layout = _layout_for_new_test_firewall(synthetic_layout_token)
        synth_tuples = synthetic_interface_config_entry_tuples(
            layout,
            lan_host_ipv4=lan_host_ip,
            lan_netmask=lan_netmask,
        )
        synth_iface_names = {name for name, _ in synth_tuples}
        for src in template_entries:
            if (
                src.entity_type == ENTITY_INTERFACE
                and src.external_name in synth_iface_names
            ):
                continue
            db.add(
                FirewallConfigEntry(
                    firewall_id=fw.id,
                    entity_type=src.entity_type,
                    external_name=src.external_name,
                    payload_json=src.payload_json,
                )
            )
        for external_name, payload_json in synth_tuples:
            db.add(
                FirewallConfigEntry(
                    firewall_id=fw.id,
                    entity_type=ENTITY_INTERFACE,
                    external_name=external_name,
                    payload_json=payload_json,
                )
            )
        out.append(fw)
    db.commit()
    sdb.commit()
    for fw in out:
        db.refresh(fw)
    return out


def _delete_all_test_firewalls(db: Session, sdb: Session) -> int:
    rows = db.query(Firewall.id).filter(Firewall.is_test.is_(True)).all()
    ids = [int(r[0]) for r in rows]
    for fid in ids:
        delete_firewall_credential(sdb, fid)
    if ids:
        db.query(Firewall).filter(Firewall.id.in_(ids)).delete(
            synchronize_session=False
        )
    sdb.commit()
    db.commit()
    return len(ids)


@app.post("/firewalls", name="gc_create_firewall")
def create_firewall(
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
    host: Annotated[str, Form(...)],
    username: Annotated[str, Form(...)],
    password: Annotated[str, Form(...)],
    port: Annotated[int, Form()] = 4444,
    verify_ssl: Annotated[str | None, Form()] = None,
    monitor_enabled: Annotated[str | None, Form()] = None,
    monitor_interval_minutes: Annotated[str | None, Form()] = None,
    api_request_timeout_seconds: Annotated[str | None, Form()] = None,
    name: Annotated[str | None, Form()] = None,
    description: Annotated[str | None, Form()] = None,
    tags_json: Annotated[str | None, Form()] = None,
):
    host = host.strip()
    if not host:
        raise HTTPException(status_code=400, detail="Host is required")
    if port < 1 or port > 65535:
        raise HTTPException(status_code=400, detail="Port must be between 1 and 65535")
    verify = verify_ssl == "on"
    mon = monitor_enabled == "on"
    mon_interval = _parse_monitor_interval_minutes(monitor_interval_minutes)
    api_timeout = _parse_api_request_timeout_seconds(api_request_timeout_seconds)
    encrypted = crypto.encrypt_secret(password)
    name_clean = name.strip() if name else None
    if name_clean == "":
        name_clean = None
    desc_clean = description.strip() if description else None
    if desc_clean == "":
        desc_clean = None
    row = Firewall(
        name=name_clean,
        description=desc_clean,
        host=host,
        port=port,
        username=username.strip(),
        api_request_timeout_seconds=api_timeout,
        verify_ssl=verify,
        monitor_enabled=mon,
        monitor_interval_minutes=mon_interval,
        tags_json=_canonical_firewall_tags_json(tags_json),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    try:
        upsert_firewall_password_encrypted(sdb, row.id, encrypted)
        sdb.commit()
    except Exception:
        db.delete(row)
        db.commit()
        raise
    return RedirectResponse(url="/firewalls", status_code=303)


class FirewallBatchDeleteBody(BaseModel):
    ids: list[int] = Field(default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX)


class FirewallBatchSetTagsBody(BaseModel):
    ids: list[int] = Field(default_factory=list, max_length=TASK_QUEUE_BATCH_IDS_MAX)
    tags: list[str] = Field(default_factory=list)


@app.post("/firewalls/delete-batch", name="gc_firewalls_delete_batch")
def delete_firewalls_batch(
    body: FirewallBatchDeleteBody,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    ids = sorted(set(i for i in body.ids if isinstance(i, int)))
    for fid in ids:
        row = db.get(Firewall, fid)
        if row:
            delete_firewall_credential(sdb, fid)
            db.delete(row)
    sdb.commit()
    db.commit()
    return {"ok": True, "deleted": len(ids)}


@app.post("/firewalls/set-tags-batch", name="gc_firewalls_set_tags_batch")
def set_firewalls_tags_batch(
    body: FirewallBatchSetTagsBody,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    ids = sorted(set(i for i in body.ids if isinstance(i, int) and i > 0))
    if not ids:
        raise HTTPException(status_code=400, detail="Select at least one firewall.")
    clean_tags: list[str] = []
    seen: set[str] = set()
    for raw in body.tags:
        t = str(raw or "").strip()[:_FW_TAG_MAX_LEN]
        if not t:
            continue
        k = t.casefold()
        if k in seen:
            continue
        seen.add(k)
        clean_tags.append(t)
        if len(clean_tags) >= _FW_TAGS_MAX_COUNT:
            break
    if not clean_tags:
        raise HTTPException(status_code=400, detail="Provide at least one tag.")
    rows = db.query(Firewall).filter(Firewall.id.in_(ids)).all()
    for row in rows:
        existing_items: list[Any] = []
        try:
            parsed = json.loads(row.tags_json or "[]")
        except json.JSONDecodeError:
            parsed = []
        if isinstance(parsed, list):
            existing_items = parsed
        merged = existing_items + clean_tags
        row.tags_json = _canonical_firewall_tags_json(json.dumps(merged))
    db.commit()
    return {"ok": True, "updated": len(rows)}


@app.post("/internal/firewalls/update", name="gc_update_firewall")
def update_firewall(
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
    firewall_id: Annotated[int, Form(...)],
    host: Annotated[str, Form(...)],
    username: Annotated[str, Form(...)],
    port: Annotated[int, Form()] = 4444,
    password: Annotated[str | None, Form()] = None,
    verify_ssl: Annotated[str | None, Form()] = None,
    monitor_enabled: Annotated[str | None, Form()] = None,
    monitor_interval_minutes: Annotated[str | None, Form()] = None,
    api_request_timeout_seconds: Annotated[str | None, Form()] = None,
    name: Annotated[str | None, Form()] = None,
    description: Annotated[str | None, Form()] = None,
    tags_json: Annotated[str | None, Form()] = None,
):
    row = db.query(Firewall).filter(Firewall.id == firewall_id).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Firewall not found")
    host = host.strip()
    if not host:
        raise HTTPException(status_code=400, detail="Host is required")
    if port < 1 or port > 65535:
        raise HTTPException(status_code=400, detail="Port must be between 1 and 65535")
    verify = verify_ssl == "on"
    mon = monitor_enabled == "on"
    mon_interval = _parse_monitor_interval_minutes(monitor_interval_minutes)
    api_timeout = _parse_api_request_timeout_seconds(api_request_timeout_seconds)
    name_clean = name.strip() if name else None
    if name_clean == "":
        name_clean = None
    desc_clean = description.strip() if description else None
    if desc_clean == "":
        desc_clean = None

    row.name = name_clean
    row.description = desc_clean
    row.host = host
    row.port = port
    row.username = username.strip()
    row.api_request_timeout_seconds = api_timeout
    row.verify_ssl = verify
    row.monitor_enabled = mon
    row.monitor_interval_minutes = mon_interval
    row.tags_json = _canonical_firewall_tags_json(tags_json)
    pwd = (password or "").strip()
    if pwd:
        upsert_firewall_password_encrypted(sdb, firewall_id, crypto.encrypt_secret(pwd))
    sdb.commit()
    db.commit()
    return JSONResponse({"ok": True})


@app.get(
    "/firewalls/{firewall_id}/monitor",
    name="firewall_monitor_page",
    response_class=HTMLResponse,
)
def firewall_monitor_page(
    request: Request,
    firewall_id: int,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    row = db.get(Firewall, firewall_id)
    if not row:
        raise HTTPException(status_code=404, detail="Firewall not found")
    return templates.TemplateResponse(
        request,
        "firewall_monitor.html",
        {
            "fw": row,
            "app_about": APP_ABOUT,
            "auth_client_state": auth_client_state(request, sdb),
            **template_nav_firewall_context(request, sdb, db),
            "api_series_url": str(
                request.url_for(
                    "api_firewall_connectivity_series",
                    firewall_id=row.id,
                )
            ),
        },
    )


@app.get(
    "/firewalls/{firewall_id}/webadmin/launch",
    name="firewall_webadmin_launch",
    include_in_schema=False,
)
def firewall_webadmin_launch(
    request: Request,
    firewall_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    row = db.get(Firewall, firewall_id)
    if not row:
        raise HTTPException(status_code=404, detail="Firewall not found")
    base = webadmin_entry_url(request, firewall_id=row.id, host=row.host, port=row.port)
    # Non-HTTPS browser sessions cannot use the GC proxy; preserve existing direct behavior.
    if not request_is_https_session(request):
        return RedirectResponse(url=base, status_code=302)
    try:
        tok = issue_launch_token(request, firewall_id=row.id, access_type="webadmin")
    except ValueError:
        raise HTTPException(
            status_code=403, detail="Missing authenticated launch context."
        )
    target = _url_add_query_param(base, TOKEN_QUERY_PARAM, tok)
    return RedirectResponse(url=target, status_code=302)


@app.get(
    "/firewalls/{firewall_id}/ssh/launch",
    name="firewall_ssh_launch",
    include_in_schema=False,
)
def firewall_ssh_launch(
    request: Request,
    firewall_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    row = db.get(Firewall, firewall_id)
    if not row:
        raise HTTPException(status_code=404, detail="Firewall not found")
    try:
        tok = issue_launch_token(request, firewall_id=row.id, access_type="ssh_page")
    except ValueError:
        raise HTTPException(
            status_code=403, detail="Missing authenticated launch context."
        )
    target = _url_add_query_param(
        str(request.url_for("firewall_ssh_terminal_page", firewall_id=row.id)),
        TOKEN_QUERY_PARAM,
        tok,
    )
    return RedirectResponse(url=target, status_code=302)


@app.get(
    "/firewalls/{firewall_id}/webadmin",
    include_in_schema=False,
)
def firewall_webadmin_trailing_slash_redirect(
    request: Request,
    firewall_id: int,
    _: Annotated[None, Depends(require_browser_session)],
):
    """Canonicalize to .../webadmin/ so relative asset URLs resolve under the proxy prefix."""
    p = request.url.path
    if p.endswith("/"):
        raise HTTPException(status_code=404)
    return RedirectResponse(
        url=str(request.url.replace(path=p + "/")),
        status_code=307,
    )


@app.api_route(
    "/firewalls/{firewall_id}/webadmin/{full_path:path}",
    name="firewall_webadmin_proxy",
    methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=False,
)
async def firewall_webadmin_proxy(
    request: Request,
    firewall_id: int,
    full_path: str,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    row = db.get(Firewall, firewall_id)
    if not row:
        raise HTTPException(status_code=404, detail="Firewall not found")
    if not request_is_https_session(request):
        return RedirectResponse(
            url=https_admin_url_for_firewall(row.host, row.port),
            status_code=302,
        )
    if request.method.upper() in {"POST", "PUT", "PATCH", "DELETE"}:
        if not _is_same_origin_browser_request(request):
            raise HTTPException(
                status_code=403, detail="Blocked cross-origin proxy request."
            )
    if not has_webadmin_session_id(request, firewall_id):
        if not (request.method.upper() == "GET" and _is_webadmin_entry_path(full_path)):
            raise HTTPException(
                status_code=403,
                detail="Launch WebAdmin from the Firewalls page.",
            )
        ok, err = validate_and_consume_launch_token(
            request,
            token=request.query_params.get(TOKEN_QUERY_PARAM) or "",
            firewall_id=firewall_id,
            access_type="webadmin",
        )
        if not ok:
            raise HTTPException(status_code=403, detail=err or "Invalid launch token.")
    # On entry route, attempt server-side login with stored credentials so users
    # land directly on the dashboard without the WebAdmin login form.
    if request.method.upper() == "GET" and _is_webadmin_entry_path(full_path):
        enc = get_firewall_password_encrypted(sdb, firewall_id)
        if enc:
            try:
                dec = crypto.decrypt_secret(enc)
            except Exception:
                dec = None
            if dec:
                auto = await try_auto_login_webadmin(
                    request,
                    row,
                    username=row.username,
                    password=dec,
                )
                if auto is not None:
                    if not has_webadmin_session_id(request, firewall_id):
                        sid = get_or_create_webadmin_session_id(request, firewall_id)
                        uid, uname = request_actor(request)
                        create_access_log(
                            db,
                            session_id=sid,
                            firewall_id=row.id,
                            access_type="webadmin",
                            event_kind="start",
                            connected_successfully=True,
                            initiated_by_user_id=uid,
                            initiated_by_username=uname,
                            client_ip=request_client_ip(request),
                            details="auto-login",
                        )
                    return auto
    proxied = await stream_firewall_webadmin(request, row, full_path)

    if not has_webadmin_session_id(
        request, firewall_id
    ) and _is_webadmin_connected_response(
        method=request.method,
        full_path=full_path,
        status_code=int(proxied.status_code or 0),
    ):
        sid = get_or_create_webadmin_session_id(request, firewall_id)
        uid, uname = request_actor(request)
        create_access_log(
            db,
            session_id=sid,
            firewall_id=row.id,
            access_type="webadmin",
            event_kind="start",
            connected_successfully=True,
            initiated_by_user_id=uid,
            initiated_by_username=uname,
            client_ip=request_client_ip(request),
            details="proxied-login",
        )

    if _is_webadmin_logout_request(method=request.method, full_path=full_path):
        sid_end = pop_webadmin_session_id(request, firewall_id)
        if sid_end:
            uid, uname = request_actor(request)
            create_access_log(
                db,
                session_id=sid_end,
                firewall_id=row.id,
                access_type="webadmin",
                event_kind="end",
                connected_successfully=True,
                initiated_by_user_id=uid,
                initiated_by_username=uname,
                client_ip=request_client_ip(request),
                details="logout",
            )
    return proxied


@app.get(
    "/firewalls/{firewall_id}/ssh",
    name="firewall_ssh_terminal_page",
    response_class=HTMLResponse,
)
def firewall_ssh_terminal_page(
    request: Request,
    firewall_id: int,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    row = db.get(Firewall, firewall_id)
    if not row:
        raise HTTPException(status_code=404, detail="Firewall not found")
    ok, err = validate_and_consume_launch_token(
        request,
        token=request.query_params.get(TOKEN_QUERY_PARAM) or "",
        firewall_id=firewall_id,
        access_type="ssh_page",
    )
    if not ok:
        raise HTTPException(status_code=403, detail=err or "Invalid launch token.")
    try:
        ws_tok = issue_launch_token(request, firewall_id=row.id, access_type="ssh_ws")
    except ValueError as exc:
        raise HTTPException(
            status_code=403,
            detail=str(exc) or "Cannot issue SSH WebSocket token.",
        ) from exc
    ssh_ws_path = _url_add_query_param(
        str(request.url_for("firewall_ssh_ws", firewall_id=row.id).path),
        TOKEN_QUERY_PARAM,
        ws_tok,
    )
    return templates.TemplateResponse(
        request,
        "firewall_ssh.html",
        {
            "fw": row,
            "app_about": APP_ABOUT,
            "auth_client_state": auth_client_state(request, sdb),
            **template_nav_firewall_context(request, sdb, db),
            "hide_app_chrome": True,
            # Path only: url_for() is a full ws(s):// URL; the page builds ws(s)://location.host + path.
            "ssh_ws_path": ssh_ws_path,
            "ssh_ws_launch_url": str(
                request.url_for("api_firewall_ssh_ws_launch", firewall_id=row.id)
            ),
            "ssh_diagnostics_url": str(
                request.url_for("api_firewall_ssh_diagnostics", firewall_id=row.id)
            ),
            "browser_ws_echo_path": str(request.url_for("api_browser_ws_echo_ws").path),
        },
    )


@app.websocket("/api/browser-ws-echo/ws", name="api_browser_ws_echo_ws")
async def api_browser_ws_echo_ws(websocket: WebSocket) -> None:
    """Authenticated echo WebSocket (no SSH) for browser ↔ GC diagnostics."""
    if not _request_allowed_by_ranges(HTTPConnection(websocket.scope)):
        try:
            await websocket.close(code=4403)
        except Exception:
            pass
        return
    await browser_ws_echo_handler(websocket)


@app.post(
    "/api/firewalls/{firewall_id}/ssh/ws-launch",
    name="api_firewall_ssh_ws_launch",
)
def api_firewall_ssh_ws_launch(
    request: Request,
    firewall_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[str, Depends(require_browser_json_session)],
) -> dict[str, str]:
    row = db.get(Firewall, firewall_id)
    if not row:
        raise HTTPException(status_code=404, detail="Firewall not found")
    if not _is_same_origin_browser_request(request):
        raise HTTPException(status_code=403, detail="Blocked cross-origin request.")
    try:
        tok = issue_launch_token(request, firewall_id=firewall_id, access_type="ssh_ws")
    except ValueError as exc:
        raise HTTPException(
            status_code=403,
            detail=str(exc) or "Cannot issue SSH WebSocket token.",
        ) from exc
    path = _url_add_query_param(
        str(request.url_for("firewall_ssh_ws", firewall_id=firewall_id).path),
        TOKEN_QUERY_PARAM,
        tok,
    )
    return {"websocket_path": path}


@app.get(
    "/api/firewalls/{firewall_id}/ssh/diagnostics",
    name="api_firewall_ssh_diagnostics",
)
async def api_firewall_ssh_diagnostics(
    request: Request,
    firewall_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[str, Depends(require_browser_json_session)],
) -> dict[str, Any]:
    """Runs from the Ground Control server: DNS + TCP:22 to inventory host (not full SSH)."""
    row = db.get(Firewall, firewall_id)
    if not row:
        raise HTTPException(status_code=404, detail="Firewall not found")
    diag = await build_firewall_ssh_diagnostics(row.host)
    ws_echo = get_browser_ws_echo_snapshot()
    ws_ssh = get_firewall_ssh_ws_snapshot()
    return {
        "firewall_id": firewall_id,
        "firewall_name": row.name,
        "websocket_path": str(
            request.url_for("firewall_ssh_ws", firewall_id=firewall_id).path
        ),
        "browser_ws_echo_snapshot": ws_echo,
        "firewall_ssh_ws_snapshot": ws_ssh,
        "ws_observation": (
            "No WebSocket attempt reached the app yet."
            if not ws_echo.get("last_accept_ts") and not ws_ssh.get("last_accept_ts")
            else "At least one WebSocket connection reached the app."
        ),
        **diag,
        "note": (
            "TCP test runs on the Ground Control server, not in your browser. "
            "WebSocket path is relative to the page origin (same TLS as this page)."
        ),
    }


@app.post(
    "/api/firewalls/{firewall_id}/ssh/collect-device-info",
    name="api_firewall_ssh_collect_device_info",
)
async def api_firewall_ssh_collect_device_info(
    firewall_id: int,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[str, Depends(require_browser_json_session)],
) -> dict[str, Any]:
    """
    SSH from the Ground Control server (non-interactive): read the SFOS main menu
    banner and store firmware_version, model, and device_hostname on the firewall row.
    """
    return await refresh_firewall_ssh_device_info(db, sdb, firewall_id)


@app.websocket("/firewalls/{firewall_id}/ssh/ws", name="firewall_ssh_ws")
async def firewall_ssh_ws(websocket: WebSocket, firewall_id: int) -> None:
    if not _request_allowed_by_ranges(HTTPConnection(websocket.scope)):
        try:
            await websocket.close(code=4403)
        except Exception:
            pass
        return
    ok, _err = validate_and_consume_launch_token(
        websocket,
        token=websocket.query_params.get(TOKEN_QUERY_PARAM) or "",
        firewall_id=firewall_id,
        access_type="ssh_ws",
        require_session_match=False,
    )
    if not ok:
        try:
            await websocket.close(code=4403)
        except Exception:
            pass
        return
    await firewall_ssh_terminal_ws(websocket, firewall_id)


@app.get(
    "/api/firewalls/cached-sync-entity-types",
    name="api_firewalls_cached_sync_entity_types",
)
def api_firewalls_cached_sync_entity_types(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str, Query(description="Comma-separated firewall IDs")
    ] = "",
):
    """Distinct config-cache entity_type values per firewall (Inventory sync column / search)."""
    ids: list[int] = []
    for part in (firewall_ids or "").split(","):
        p = part.strip()
        if p.isdigit():
            ids.append(int(p))
    ids = sorted(set(ids))
    if not ids:
        return {}
    m = _firewall_cached_sync_entity_map(db, ids)
    return {str(k): v for k, v in m.items()}


@app.get(
    "/api/firewalls/{firewall_id}/config-viewer-tree",
    name="api_firewall_config_viewer_tree",
)
def api_firewall_config_viewer_tree(
    request: Request,
    firewall_id: int,
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    """Hierarchical counts and item names for cached objects (Inventory config viewer)."""
    fw = db.get(Firewall, firewall_id)
    if fw is None:
        raise HTTPException(status_code=404, detail="Firewall not found")
    data = build_config_viewer_tree(db, firewall_id=firewall_id)
    if not bool(fw.is_test):
        data.setdefault("scope", {})["config_sync_url"] = str(
            request.url_for("api_firewall_config_sync", firewall_id=firewall_id)
        )
    return data


@app.get(
    "/api/firewalls/{firewall_id}/config-entries/{entry_id}",
    name="api_firewall_config_entry_detail",
)
def api_firewall_config_entry_detail(
    firewall_id: int,
    entry_id: int,
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    row = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.id == entry_id,
            FirewallConfigEntry.firewall_id == firewall_id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Config entry not found")
    try:
        payload = json.loads(row.payload_json or "{}")
    except json.JSONDecodeError:
        payload = None
    return {
        "entry_id": row.id,
        "firewall_id": row.firewall_id,
        "entity_type": row.entity_type,
        "external_name": row.external_name,
        "payload": payload,
        "payload_raw": row.payload_json if payload is None else None,
    }


@app.get(
    "/api/configurations/{configuration_id}/config-viewer-tree",
    name="api_configuration_config_viewer_tree",
)
def api_configuration_config_viewer_tree(
    configuration_id: int,
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    if db.get(Configuration, configuration_id) is None:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return build_config_viewer_tree(db, configuration_id=configuration_id)


@app.get(
    "/api/configurations/{configuration_id}/config-entries/{entry_id}",
    name="api_configuration_config_entry_detail",
)
def api_configuration_config_entry_detail(
    configuration_id: int,
    entry_id: int,
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    row = (
        db.query(ConfigurationConfigEntry)
        .filter(
            ConfigurationConfigEntry.id == entry_id,
            ConfigurationConfigEntry.configuration_id == configuration_id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Config entry not found")
    try:
        payload = json.loads(row.payload_json or "{}")
    except json.JSONDecodeError:
        payload = None
    return {
        "entry_id": row.id,
        "configuration_id": row.configuration_id,
        "entity_type": row.entity_type,
        "external_name": row.external_name,
        "payload": payload,
        "payload_raw": row.payload_json if payload is None else None,
    }


@app.post(
    "/api/firewalls/{firewall_id}/config-viewer/queue-deletes",
    name="api_firewall_config_viewer_queue_deletes",
)
def api_firewall_config_viewer_queue_deletes(
    firewall_id: int,
    body: ConfigViewerQueueDeletesBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    """Queue task-queue delete tasks for cached objects (per type routing)."""
    fw = db.get(Firewall, firewall_id)
    if fw is None:
        raise HTTPException(status_code=404, detail="Firewall not found")
    if not bool(fw.is_test):
        raise HTTPException(
            status_code=403,
            detail="Config viewer delete is only available for test firewalls.",
        )
    try:
        result = enqueue_config_viewer_deletes_for_firewall(
            db,
            firewall_id=firewall_id,
            config_entry_ids=body.config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, **result}


@app.post(
    "/api/configurations/{configuration_id}/config-viewer/queue-deletes",
    name="api_configuration_config_viewer_queue_deletes",
)
def api_configuration_config_viewer_queue_deletes(
    configuration_id: int,
    body: ConfigViewerQueueDeletesBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        result = enqueue_config_viewer_deletes_for_configuration(
            db,
            configuration_id=configuration_id,
            config_entry_ids=body.config_entry_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, **result}


@app.post(
    "/api/configurations/apply-to-firewalls-batch",
    name="api_configurations_apply_to_firewalls_batch",
)
def api_configurations_apply_to_firewalls_batch(
    body: ApplyConfigurationsToFirewallsBody,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    config_ids = sorted({int(x) for x in body.configuration_ids if int(x) > 0})
    if not config_ids:
        raise HTTPException(
            status_code=400, detail="Select at least one configuration."
        )
    fw_ids = sorted({int(x) for x in body.firewall_ids if int(x) > 0})
    if not fw_ids:
        raise HTTPException(status_code=400, detail="Select at least one firewall.")

    queued_count = 0
    unchanged_count = 0
    compared_count = 0
    task_ids: list[int] = []
    skipped: list[dict[str, Any]] = []
    for cfg_id in config_ids:
        try:
            result = enqueue_configuration_apply_to_firewalls(
                db,
                configuration_id=cfg_id,
                firewall_ids=fw_ids,
                created_by_user_id=uid,
                created_by_username=users_service.username_for_user_id(uid),
            )
        except ValueError as exc:
            skipped.append({"configuration_id": cfg_id, "reason": str(exc)})
            continue
        queued_count += int(result.get("queued_count") or 0)
        unchanged_count += int(result.get("unchanged_count") or 0)
        compared_count += int(result.get("compared_count") or 0)
        task_ids.extend([int(x) for x in result.get("task_ids", []) if int(x) > 0])
        for row in result.get("skipped", []):
            if not isinstance(row, dict):
                continue
            row_copy = dict(row)
            row_copy["configuration_id"] = cfg_id
            skipped.append(row_copy)
    return {
        "ok": True,
        "queued_count": queued_count,
        "task_ids": sorted({int(x) for x in task_ids if int(x) > 0}),
        "unchanged_count": unchanged_count,
        "compared_count": compared_count,
        "skipped": skipped,
    }


@app.post(
    "/api/configurations/{configuration_id}/apply-to-member-firewalls",
    name="api_configuration_apply_to_member_firewalls",
)
def api_configuration_apply_to_member_firewalls(
    configuration_id: int,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
):
    cfg = db.get(Configuration, configuration_id)
    if cfg is None:
        raise HTTPException(status_code=404, detail="Configuration not found")
    firewalls = db.query(Firewall).all()
    member_fw_ids = cfg.effective_member_firewall_ids(firewalls)
    if not member_fw_ids:
        raise HTTPException(
            status_code=400,
            detail="This configuration has no member firewalls in scope.",
        )
    try:
        result = enqueue_configuration_apply_to_firewalls(
            db,
            configuration_id=configuration_id,
            firewall_ids=member_fw_ids,
            created_by_user_id=uid,
            created_by_username=users_service.username_for_user_id(uid),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "ok": True,
        "configuration_id": configuration_id,
        "member_firewall_ids": member_fw_ids,
        **result,
    }


@app.post("/api/firewalls/{firewall_id}/config-sync", name="api_firewall_config_sync")
async def api_firewall_config_sync(
    firewall_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    uid: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
):
    entities_explicit = False
    entity_list: list[str] | None = None
    raw_body = await request.body()
    if raw_body.strip():
        try:
            data = json.loads(raw_body)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Invalid JSON body") from exc
        if not isinstance(data, dict):
            raise HTTPException(status_code=400, detail="JSON body must be an object")
        if "entities" in data:
            entities_explicit = True
            ent = data["entities"]
            if ent is None:
                entity_list = []
            elif isinstance(ent, list):
                entity_list = [str(x).strip() for x in ent if str(x).strip()]
            else:
                raise HTTPException(
                    status_code=400, detail="entities must be a list or null"
                )

    if db.get(Firewall, firewall_id) is None:
        raise HTTPException(status_code=404, detail="Firewall not found")

    if entities_explicit and entity_list is not None and len(entity_list) == 0:
        result = run_firewall_config_sync(
            db,
            sdb,
            firewall_id,
            entities=[],
            entities_explicit=True,
        )
        return result

    background_activity.register(uid, background_activity.MSG_CONFIG_SYNC)
    background_tasks.add_task(
        _bg_firewall_config_sync,
        firewall_id,
        entity_list if entities_explicit else None,
        entities_explicit,
        uid,
    )
    return JSONResponse(
        status_code=202,
        content={
            "ok": True,
            "accepted": True,
            "firewall_id": firewall_id,
            "message": _GC_BG_ASYNC_MSG,
        },
    )


@app.get(
    "/api/firewalls/{firewall_id}/connectivity-series",
    name="api_firewall_connectivity_series",
)
def api_firewall_connectivity_series(
    firewall_id: int,
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    time_range: Annotated[str, Query(alias="range")] = "24h",
):
    row = db.get(Firewall, firewall_id)
    if not row:
        raise HTTPException(status_code=404, detail="Firewall not found")
    rk = (time_range or "24h").strip().lower()
    if rk not in _MONITOR_RANGES:
        rk = "24h"
    gran, points = get_connectivity_series(firewall_id, rk)
    return {
        "firewall_id": firewall_id,
        "name": row.name,
        "host": row.host,
        "port": row.port,
        "range": rk,
        "granularity": gran,
        "points": points,
    }


@app.get("/api/dashboard", name="api_dashboard")
def api_dashboard(
    _: Annotated[str, Depends(current_user_id_dep)],
    db: Annotated[Session, Depends(get_db)],
    firewall_ids: Annotated[
        str | None, Query(description="Comma-separated firewall ids")
    ] = None,
    browser_timezone: Annotated[
        str | None,
        Query(
            alias="timezone",
            description="IANA timezone (e.g. from Intl) for connected-chart hour buckets",
        ),
    ] = None,
):
    """Aggregates dashboard metrics for the global firewall multiselect scope."""
    ids = parse_firewall_ids_query(firewall_ids)
    return build_dashboard_payload(db, ids, chart_timezone=browser_timezone)


@app.post("/firewalls/{firewall_id}/test", name="gc_test_firewall")
def test_firewall(
    firewall_id: int,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    row = db.get(Firewall, firewall_id)
    if not row:
        raise HTTPException(status_code=404, detail="Firewall not found")
    if bool(row.is_test):
        if random.random() < 0.2:
            return {
                "ok": False,
                "message": "Simulated connection failure (test firewall).",
            }
        latency = random.randint(20, 200)
        return {"ok": True, "message": f"Connected (simulated) in {latency} ms."}
    enc = get_firewall_password_encrypted(sdb, firewall_id)
    if not enc:
        return JSONResponse(
            status_code=500,
            content={"ok": False, "message": "No stored credential for this firewall."},
        )
    try:
        password = crypto.decrypt_secret(enc)
    except ValueError as exc:
        return JSONResponse(
            status_code=500,
            content={"ok": False, "message": str(exc)},
        )
    api_to = normalize_firewall_api_timeout_seconds(row.api_request_timeout_seconds)
    ok, message = test_connection(
        host=row.host,
        port=row.port,
        username=row.username,
        password=password,
        verify_ssl=row.verify_ssl,
        request_timeout_seconds=api_to,
    )
    return {"ok": ok, "message": message}


@app.delete("/firewalls/{firewall_id}")
def delete_firewall(
    firewall_id: int,
    db: Annotated[Session, Depends(get_db)],
    sdb: Annotated[Session, Depends(get_secrets_db)],
    _: Annotated[None, Depends(require_browser_session)],
):
    row = db.get(Firewall, firewall_id)
    if not row:
        raise HTTPException(status_code=404, detail="Firewall not found")
    delete_firewall_credential(sdb, firewall_id)
    sdb.commit()
    db.delete(row)
    db.commit()
    return {"ok": True}


app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")


_HANDLED_UVICORN_EXIT_SIGNALS: tuple[int, ...] = (
    signal.SIGINT,
    signal.SIGTERM,
)
if sys.platform == "win32":  # pragma: no cover
    _HANDLED_UVICORN_EXIT_SIGNALS += (signal.SIGBREAK,)


class _UvicornServerWithoutOsSignals(uvicorn.Server):
    """Concurrent ``Server.serve()`` calls each register SIGINT; the last one wins and the other listener never exits."""

    @contextmanager
    def capture_signals(self):
        yield


def _install_gc_uvicorn_signal_handlers(
    servers: list[uvicorn.Server],
) -> list[tuple[int, Callable[..., Any]]]:
    """One process-wide handler so HTTP + HTTPS (or any multi-listener setup) shut down together."""

    def _handle(sig: int, frame: FrameType | None) -> None:
        repeat = any(s.should_exit for s in servers)
        for s in servers:
            if repeat:
                s.force_exit = True
            else:
                s.should_exit = True

    prior: list[tuple[int, Callable[..., Any]]] = []
    for sig in _HANDLED_UVICORN_EXIT_SIGNALS:
        prior.append((sig, signal.signal(sig, _handle)))
    return prior


def main() -> None:
    log = logging.getLogger("uvicorn.error")
    st = security_settings.load_security_ui_state()
    if not st.http_enabled and not st.https_enabled:
        log.warning(
            "HTTP and HTTPS are both disabled in security settings; restoring defaults."
        )
        st = security_settings.default_security_ui_state()

    bind_host = config.bind_listen_host() or st.listen_interface
    host = security_settings.listen_interface_to_bind_host(bind_host)
    cert_path = security_settings.tls_cert_path()
    key_path = security_settings.tls_key_path()

    security_settings.ensure_tls_certificate_if_https_enabled()

    async def _serve() -> None:
        servers: list[uvicorn.Server] = []
        if st.http_enabled:
            servers.append(
                _UvicornServerWithoutOsSignals(
                    uvicorn.Config(
                        app,
                        host=host,
                        port=st.http_port,
                        log_level="info",
                    )
                )
            )
        if st.https_enabled:
            summ = security_settings.load_https_certificate_summary()
            if not summ["present"]:
                log.error(
                    "HTTPS is enabled but no TLS certificate is available after auto-generation. "
                    "Fix certificate files or disable HTTPS in Settings → Security."
                )
            elif st.https_port is None:
                log.error("HTTPS is enabled but https_port is not set.")
            else:
                servers.append(
                    _UvicornServerWithoutOsSignals(
                        uvicorn.Config(
                            app,
                            host=host,
                            port=st.https_port,
                            ssl_certfile=str(cert_path),
                            ssl_keyfile=str(key_path),
                            log_level="info",
                        )
                    )
                )
        if not servers:
            raise SystemExit(
                "No listeners to start (enable HTTP and/or HTTPS in Settings → Security)."
            )
        prior_handlers = _install_gc_uvicorn_signal_handlers(servers)
        try:
            await asyncio.gather(*(s.serve() for s in servers))
        finally:
            for sig, previous in prior_handlers:
                signal.signal(sig, previous)

    asyncio.run(_serve())
