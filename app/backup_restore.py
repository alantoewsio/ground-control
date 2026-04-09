"""Full application backup (ZIP) and merge restore for Settings · Backup.

Excludes cached firewall/configuration entity payloads (``firewall_config_entries``,
``configuration_config_entries``). Includes databases, persisted TLS/Let's Encrypt files,
retention policy, and crypto key files when present.

Restore merges by primary key: backup rows replace existing rows with the same key; rows only
on the current system are left unchanged. ``app_users`` is a special case: if the backup row’s id
is new but its ``username`` already exists (e.g. default admin on a fresh install), the conflicting
row is removed so the backup user can be inserted.
Main rows that reference a missing ``firewalls`` / ``configurations`` / sync-run parent (orphan
backup data) are skipped or patched (e.g. nullable firewall FKs cleared) so restore does not fail
on PostgreSQL foreign-key enforcement.
"""

from __future__ import annotations

import io
import json
import shutil
import threading
import zipfile
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from importlib import metadata
from pathlib import Path
from typing import Any, Iterable

from sqlalchemy import DateTime as SQLDateTime, inspect as sa_inspect, text
from sqlalchemy.orm import Session

from app import config, data_management, security_settings
from app import letsencrypt_service
from app.backup_crypto import (
    decrypt_backup_archive,
    is_gc_encrypted_backup,
    is_plain_zip_payload,
)
from app.backup_password import get_saved_backup_password
from app.models import (
    AccessSessionLog,
    Configuration,
    Firewall,
    FirewallConfigChangelogEntry,
    FirewallConfigSyncRun,
    IpamPrefix,
    IpamVrf,
    RefCountry,
    TaskQueue,
    TaskQueueCompleted,
)
from app.monitor_models import FirewallConnectivityRollup, FirewallWebadminPing
from app.secrets_models import AppUser, FirewallCredential

BACKUP_FORMAT_VERSION = 1
MANIFEST_NAME = "manifest.json"
MAIN_DB_NAME = "main_db.json"
SECRETS_DB_NAME = "secrets_db.json"
MONITOR_DB_NAME = "monitor_db.json"

# Cached entity snapshots from API sync (excluded).
_EXCLUDED_MAIN_TABLES = frozenset({"firewall_config_entries", "configuration_config_entries"})

# FK-safe merge order for the main database.
_MAIN_MODEL_ORDER: tuple[type, ...] = (
    Firewall,
    Configuration,
    RefCountry,
    IpamVrf,
    IpamPrefix,
    FirewallConfigSyncRun,
    FirewallConfigChangelogEntry,
    TaskQueue,
    TaskQueueCompleted,
    AccessSessionLog,
)

_SECRETS_MODEL_ORDER: tuple[type, ...] = (AppUser, FirewallCredential)
_MONITOR_MODEL_ORDER: tuple[type, ...] = (FirewallWebadminPing, FirewallConnectivityRollup)

# Integer PK tables whose SQLite / Postgres sequences must be bumped after merge.
_MAIN_INT_PK_TABLES: tuple[str, ...] = (
    "firewalls",
    "configurations",
    "ipam_prefixes",
    "ipam_vrfs",
    "firewall_config_changelog",
    "task_queue",
    "task_queue_completed",
    "access_session_logs",
)
_MONITOR_INT_PK_TABLES: tuple[str, ...] = (
    "firewall_webadmin_pings",
    "firewall_connectivity_rollups",
)

_CACHED_BACKUP_SUBDIR = ".gc_backup_cache"
_CACHED_ZIP_NAME = "last-backup.zip"
_CACHED_META_NAME = "last-backup.meta.json"
_backup_cache_io_lock = threading.Lock()


def _backup_cache_dir() -> Path:
    pr = config.persist_root()
    base = pr if pr is not None else config.BASE_DIR
    d = base / _CACHED_BACKUP_SUBDIR
    d.mkdir(parents=True, exist_ok=True)
    return d


def _cached_zip_path() -> Path:
    return _backup_cache_dir() / _CACHED_ZIP_NAME


def _cached_meta_path() -> Path:
    return _backup_cache_dir() / _CACHED_META_NAME


def save_generated_backup(result: BackupBuildResult) -> dict[str, Any]:
    """Write ZIP and metadata atomically for download / restore-last."""
    d = _backup_cache_dir()
    zip_final = d / _CACHED_ZIP_NAME
    meta_final = d / _CACHED_META_NAME
    zip_part = d / "last-backup.zip.part"
    meta_part = d / "last-backup.meta.json.part"
    generated_at = _utc_now_iso()
    meta: dict[str, Any] = {
        "download_filename": result.filename,
        "generated_at": generated_at,
        "size_bytes": len(result.data),
        "encrypted": True,
    }
    meta_body = json.dumps(meta, indent=2, sort_keys=True) + "\n"
    with _backup_cache_io_lock:
        zip_part.write_bytes(result.data)
        meta_part.write_text(meta_body, encoding="utf-8")
        if zip_final.is_file():
            zip_final.unlink(missing_ok=True)
        shutil.move(str(zip_part), str(zip_final))
        if meta_final.is_file():
            meta_final.unlink(missing_ok=True)
        shutil.move(str(meta_part), str(meta_final))
    return meta


def load_generated_backup_meta() -> dict[str, Any] | None:
    p = _cached_meta_path()
    with _backup_cache_io_lock:
        if not p.is_file():
            return None
        try:
            raw = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
    return raw if isinstance(raw, dict) else None


def read_generated_backup_bytes() -> bytes | None:
    p = _cached_zip_path()
    with _backup_cache_io_lock:
        if not p.is_file():
            return None
        try:
            return p.read_bytes()
        except OSError:
            return None


def generated_backup_status_payload() -> dict[str, Any]:
    zp = _cached_zip_path()
    if not zp.is_file():
        return {"ready": False}
    meta = load_generated_backup_meta() or {}
    try:
        sz = int(zp.stat().st_size)
    except OSError:
        return {"ready": False}
    return {
        "ready": True,
        "generated_at": meta.get("generated_at"),
        "download_filename": meta.get("download_filename")
        or "ground-control-backup.gcbak",
        "size_bytes": sz,
        "encrypted": bool(meta.get("encrypted", True)),
    }


@dataclass(frozen=True)
class BackupBuildResult:
    filename: str
    data: bytes


def _app_version() -> str:
    try:
        return metadata.version("ground-control")
    except metadata.PackageNotFoundError:
        return "0.0.0"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _serialize_value(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            val = val.replace(tzinfo=timezone.utc)
        return val.astimezone(timezone.utc).isoformat()
    if isinstance(val, date):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, (bytes, memoryview)):
        return None
    return val


def _row_to_dict(model: type, row: Any) -> dict[str, Any]:
    mapper = sa_inspect(model)
    out: dict[str, Any] = {}
    for col in mapper.mapper.column_attrs:
        key = col.key
        out[key] = _serialize_value(getattr(row, key))
    return out


def _coerce_value_for_model(model: type, key: str, val: Any) -> Any:
    if val is None:
        return None
    mapper = sa_inspect(model)
    col = mapper.mapper.columns.get(key)
    if col is None:
        return val
    if isinstance(val, str) and (
        isinstance(col.type, SQLDateTime) or "DateTime" in type(col.type).__name__
    ):
        s = val.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    return val


def _row_dict_to_kwargs(model: type, data: dict[str, Any]) -> dict[str, Any]:
    mapper = sa_inspect(model)
    keys = {c.key for c in mapper.mapper.column_attrs}
    out: dict[str, Any] = {}
    for k in keys:
        if k not in data:
            continue
        out[k] = _coerce_value_for_model(model, k, data[k])
    return out


def _primary_key_value(model: type, data: dict[str, Any]) -> Any:
    mapper = sa_inspect(model)
    pks = list(mapper.mapper.primary_key)
    if len(pks) != 1:
        raise RuntimeError(f"expected single-column PK for {model.__name__}")
    name = pks[0].name
    raw = data.get(name)
    col = mapper.mapper.columns.get(name)
    if col is not None and raw is not None:
        impl = getattr(col.type, "python_type", None)
        if impl is int:
            return int(raw)
    return raw


def _merge_rows(session: Session, model: type, rows: list[dict[str, Any]]) -> int:
    n = 0
    for raw in rows:
        if not isinstance(raw, dict):
            continue
        pk = _primary_key_value(model, raw)
        kwargs = _row_dict_to_kwargs(model, raw)
        inst = session.get(model, pk)
        if inst is None:
            session.add(model(**kwargs))
        else:
            for k, v in kwargs.items():
                setattr(inst, k, v)
        n += 1
    return n


def _session_get_firewall(session: Session, fid: Any) -> Firewall | None:
    if fid is None:
        return None
    try:
        return session.get(Firewall, int(fid))
    except (TypeError, ValueError):
        return None


def _session_get_configuration(session: Session, cid: Any) -> Configuration | None:
    if cid is None:
        return None
    try:
        return session.get(Configuration, int(cid))
    except (TypeError, ValueError):
        return None


def _coerce_main_backup_row(
    session: Session, model: type, raw: dict[str, Any]
) -> dict[str, Any] | None:
    """Return row dict to merge, or None to skip (orphan FK / invalid parent)."""
    if model is Configuration:
        r = dict(raw)
        cf = r.get("cloned_from_firewall_id")
        if cf is not None and _session_get_firewall(session, cf) is None:
            r["cloned_from_firewall_id"] = None
        return r

    if model is IpamPrefix:
        r = dict(raw)
        af = r.get("assigned_to_firewall_id")
        if af is not None and _session_get_firewall(session, af) is None:
            r["assigned_to_firewall_id"] = None
        return r

    if model is FirewallConfigSyncRun:
        if _session_get_firewall(session, raw.get("firewall_id")) is None:
            return None
        return raw

    if model is FirewallConfigChangelogEntry:
        if _session_get_firewall(session, raw.get("firewall_id")) is None:
            return None
        sid = raw.get("sync_run_id")
        if sid is not None and session.get(FirewallConfigSyncRun, sid) is None:
            return None
        return raw

    if model in (TaskQueue, TaskQueueCompleted):
        if raw.get("firewall_id") is not None and _session_get_firewall(
            session, raw.get("firewall_id")
        ) is None:
            return None
        if raw.get("configuration_id") is not None and _session_get_configuration(
            session, raw.get("configuration_id")
        ) is None:
            return None
        return raw

    if model is AccessSessionLog:
        if raw.get("firewall_id") is not None and _session_get_firewall(
            session, raw.get("firewall_id")
        ) is None:
            return None
        return raw

    return raw


def _merge_main_model_rows(session: Session, model: type, rows: list[dict[str, Any]]) -> int:
    coerced: list[dict[str, Any]] = []
    for raw in rows:
        if not isinstance(raw, dict):
            continue
        row = _coerce_main_backup_row(session, model, raw)
        if row is not None:
            coerced.append(row)
    return _merge_rows(session, model, coerced) if coerced else 0


def _merge_app_users(session: Session, rows: list[dict[str, Any]]) -> int:
    """Like ``_merge_rows`` but resolves ``username`` unique conflicts (e.g. default admin on a new install)."""
    n = 0
    for raw in rows:
        if not isinstance(raw, dict):
            continue
        pk = _primary_key_value(AppUser, raw)
        kwargs = _row_dict_to_kwargs(AppUser, raw)
        inst = session.get(AppUser, pk)
        if inst is None:
            un = kwargs.get("username")
            if isinstance(un, str):
                un = un.strip()
                if un:
                    conflicting = (
                        session.query(AppUser)
                        .filter(AppUser.username == un)
                        .first()
                    )
                    if conflicting is not None:
                        session.delete(conflicting)
                        session.flush()
            session.add(AppUser(**kwargs))
        else:
            for k, v in kwargs.items():
                setattr(inst, k, v)
        n += 1
    return n


def _export_main_rows(session: Session) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {}
    for model in _MAIN_MODEL_ORDER:
        name = model.__tablename__
        if name in _EXCLUDED_MAIN_TABLES:
            continue
        rows = session.query(model).all()
        out[name] = [_row_to_dict(model, r) for r in rows]
    return out


def _export_secrets_rows(session: Session) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {}
    for model in _SECRETS_MODEL_ORDER:
        rows = session.query(model).all()
        out[model.__tablename__] = [_row_to_dict(model, r) for r in rows]
    return out


def _export_monitor_rows(session: Session) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {}
    for model in _MONITOR_MODEL_ORDER:
        rows = session.query(model).all()
        out[model.__tablename__] = [_row_to_dict(model, r) for r in rows]
    return out


def _iter_files_for_backup() -> Iterable[tuple[str, Path]]:
    """Yield (archive_path, absolute_file_path) for persisted files."""
    seen: set[Path] = set()
    pr = config.persist_root()
    pr_res = pr.resolve() if pr is not None else None
    base_res = config.BASE_DIR.resolve()

    def arc_for(p: Path) -> str:
        p = p.resolve()
        if pr_res is not None:
            try:
                rel = p.relative_to(pr_res)
                return f"files/persist/{rel.as_posix()}"
            except ValueError:
                pass
        rel = p.relative_to(base_res)
        return f"files/base/{rel.as_posix()}"

    def emit(p: Path) -> Iterable[tuple[str, Path]]:
        p = p.resolve()
        if not p.is_file() or p in seen:
            return
        seen.add(p)
        yield arc_for(p), p

    # Security UI + TLS (persist or base)
    yield from emit(security_settings._state_path())
    tls = security_settings.tls_directory()
    if tls.is_dir():
        for f in sorted(tls.rglob("*")):
            if f.is_file():
                yield from emit(f)

    # Let's Encrypt settings + material (skip heavy work/logs)
    yield from emit(letsencrypt_service._state_path())
    le_root = letsencrypt_service.letsencrypt_data_dir()
    if le_root.is_dir():
        skip_parts = {"work", "logs"}
        for f in sorted(le_root.rglob("*")):
            if not f.is_file():
                continue
            try:
                rel = f.relative_to(le_root)
            except ValueError:
                continue
            if any(part in skip_parts for part in rel.parts):
                continue
            yield from emit(f)

    # Data management limits (module uses BASE_DIR)
    yield from emit(data_management._state_path())

    # Optional key material (often under BASE_DIR; also persist if duplicated)
    fk = config.fernet_key_file().resolve()
    yield from emit(fk)
    sk = config.session_secret_file().resolve()
    yield from emit(sk)
    if pr is not None:
        for name in (".fernet_key", ".session_secret"):
            alt = (pr / name).resolve()
            if alt != fk and alt != sk:
                yield from emit(alt)


def build_backup_zip(
    main_session: Session,
    secrets_session: Session,
    monitor_session: Session,
) -> BackupBuildResult:
    manifest = {
        "format_version": BACKUP_FORMAT_VERSION,
        "created_at": _utc_now_iso(),
        "app_version": _app_version(),
        "excludes_note": "Omits firewall_config_entries and configuration_config_entries (cached API snapshots).",
    }
    main_payload = _export_main_rows(main_session)
    secrets_payload = _export_secrets_rows(secrets_session)
    monitor_payload = _export_monitor_rows(monitor_session)

    buf = io.BytesIO()
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    filename = f"ground-control-backup-{ts}.zip"
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(MANIFEST_NAME, json.dumps(manifest, indent=2) + "\n")
        zf.writestr(MAIN_DB_NAME, json.dumps(main_payload) + "\n")
        zf.writestr(SECRETS_DB_NAME, json.dumps(secrets_payload) + "\n")
        zf.writestr(MONITOR_DB_NAME, json.dumps(monitor_payload) + "\n")
        for arc, path in _iter_files_for_backup():
            zf.write(path, arcname=arc)
    return BackupBuildResult(filename=filename, data=buf.getvalue())


def _dest_path_for_archive_member(arcname: str) -> Path | None:
    if not arcname.startswith("files/"):
        return None
    if arcname.startswith("files/persist/"):
        rel = arcname[len("files/persist/") :].lstrip("/")
        if not rel or ".." in Path(rel).parts:
            return None
        root = config.persist_root() or config.BASE_DIR
        return (root / rel).resolve()
    if arcname.startswith("files/base/"):
        rel = arcname[len("files/base/") :].lstrip("/")
        if not rel or ".." in Path(rel).parts:
            return None
        return (config.BASE_DIR / rel).resolve()
    return None


def _restore_files_from_zip(zf: zipfile.ZipFile) -> int:
    n = 0
    safe_roots: list[Path] = [config.BASE_DIR.resolve()]
    pr = config.persist_root()
    if pr is not None:
        safe_roots.append(pr.resolve())
    for info in zf.infolist():
        if info.is_dir():
            continue
        dest = _dest_path_for_archive_member(info.filename)
        if dest is None:
            continue
        dest = dest.resolve()
        allowed = False
        for root in safe_roots:
            try:
                dest.relative_to(root)
                allowed = True
                break
            except ValueError:
                continue
        if not allowed:
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(zf.read(info.filename))
        n += 1
    return n


def _load_table_payload(
    payload: dict[str, Any], name: str
) -> list[dict[str, Any]]:
    raw = payload.get(name)
    if raw is None:
        return []
    if not isinstance(raw, list):
        return []
    return [x for x in raw if isinstance(x, dict)]


def _sync_sqlite_sequences(conn: Any, tables: tuple[str, ...]) -> None:
    for table in tables:
        mx = conn.execute(text(f"SELECT MAX(id) FROM {table}")).scalar()
        if mx is None:
            continue
        m = int(mx)
        if m < 1:
            continue
        try:
            conn.execute(
                text("DELETE FROM sqlite_sequence WHERE name = :n"), {"n": table}
            )
            conn.execute(
                text("INSERT INTO sqlite_sequence (name, seq) VALUES (:n, :s)"),
                {"n": table, "s": m},
            )
        except Exception:
            pass


def _sync_postgres_sequences(conn: Any, tables: tuple[str, ...]) -> None:
    for table in tables:
        try:
            seq = conn.execute(
                text("SELECT pg_get_serial_sequence(CAST(:tbl AS regclass), 'id')"),
                {"tbl": table},
            ).scalar()
            if not seq:
                continue
            mx = conn.execute(text(f"SELECT MAX(id) FROM {table}")).scalar()
            if mx is None:
                continue
            m = int(mx)
            if m < 1:
                continue
            conn.execute(text("SELECT setval(:seq, :val, true)"), {"seq": seq, "val": m})
        except Exception:
            pass


def _bump_autoincrement_after_merge(engine: Any, tables: tuple[str, ...]) -> None:
    dialect = engine.dialect.name
    with engine.begin() as conn:
        if dialect == "sqlite":
            _sync_sqlite_sequences(conn, tables)
        elif dialect == "postgresql":
            _sync_postgres_sequences(conn, tables)


def _unwrap_backup_payload(
    raw: bytes, backup_password: str | None
) -> bytes:
    """Decrypt Ground Control encrypted backups; pass through legacy plain ZIP."""
    if is_gc_encrypted_backup(raw):
        explicit = (backup_password or "").strip()
        effective = explicit or get_saved_backup_password()
        if not effective:
            raise ValueError(
                "This backup is password-protected. Enter the restore password, "
                "or save a backup password in settings to use when the field is blank."
            )
        return decrypt_backup_archive(raw, effective)
    if is_plain_zip_payload(raw):
        return raw
    raise ValueError(
        "Unrecognized backup file. Use a Ground Control backup (.gcbak) or a legacy plain .zip."
    )


def restore_backup_merge(
    zip_bytes: bytes,
    main_session: Session,
    secrets_session: Session,
    monitor_session: Session,
    *,
    backup_password: str | None = None,
) -> dict[str, Any]:
    payload = _unwrap_backup_payload(zip_bytes, backup_password)
    with zipfile.ZipFile(io.BytesIO(payload)) as zf:
        try:
            manifest = json.loads(zf.read(MANIFEST_NAME).decode("utf-8"))
        except KeyError as e:
            raise ValueError("backup zip missing manifest.json") from e
        fv = manifest.get("format_version")
        if fv != BACKUP_FORMAT_VERSION:
            raise ValueError(f"unsupported backup format_version: {fv!r}")

        main_payload = json.loads(zf.read(MAIN_DB_NAME).decode("utf-8"))
        secrets_payload = json.loads(zf.read(SECRETS_DB_NAME).decode("utf-8"))
        monitor_payload = json.loads(zf.read(MONITOR_DB_NAME).decode("utf-8"))

        if not isinstance(main_payload, dict):
            raise ValueError("invalid main_db.json")
        if not isinstance(secrets_payload, dict):
            raise ValueError("invalid secrets_db.json")
        if not isinstance(monitor_payload, dict):
            raise ValueError("invalid monitor_db.json")

        counts: dict[str, int] = {}

        for model in _MAIN_MODEL_ORDER:
            name = model.__tablename__
            rows = _load_table_payload(main_payload, name)
            if not rows:
                counts[f"main.{name}"] = 0
                continue
            counts[f"main.{name}"] = _merge_main_model_rows(main_session, model, rows)
        main_session.commit()

        for model in _SECRETS_MODEL_ORDER:
            name = model.__tablename__
            rows = _load_table_payload(secrets_payload, name)
            if not rows:
                counts[f"secrets.{name}"] = 0
            elif model is AppUser:
                counts[f"secrets.{name}"] = _merge_app_users(secrets_session, rows)
            else:
                counts[f"secrets.{name}"] = _merge_rows(
                    secrets_session, model, rows
                )
        secrets_session.commit()

        for model in _MONITOR_MODEL_ORDER:
            name = model.__tablename__
            rows = _load_table_payload(monitor_payload, name)
            counts[f"monitor.{name}"] = (
                _merge_rows(monitor_session, model, rows) if rows else 0
            )
        monitor_session.commit()

        main_eng = main_session.get_bind()
        mon_eng = monitor_session.get_bind()
        _bump_autoincrement_after_merge(main_eng, _MAIN_INT_PK_TABLES)
        _bump_autoincrement_after_merge(mon_eng, _MONITOR_INT_PK_TABLES)

        files_written = _restore_files_from_zip(zf)

    data_management.clear_data_management_policy_cache()

    return {
        "ok": True,
        "rows_merged": counts,
        "files_restored": files_written,
        "format_version": BACKUP_FORMAT_VERSION,
    }
