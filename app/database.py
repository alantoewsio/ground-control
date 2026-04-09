import json
from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from app import config
from app.db_utils import enable_wal_mode
from app.models import Base

_engine = create_engine(
    config.database_url(),
    connect_args={"check_same_thread": False}
    if config.database_url().startswith("sqlite")
    else {},
)


@event.listens_for(_engine, "connect")
def _sqlite_enable_foreign_keys(dbapi_connection, _connection_record) -> None:
    if _engine.dialect.name == "sqlite":
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


enable_wal_mode(_engine)


SessionLocal = sessionmaker(
    bind=_engine, autocommit=False, autoflush=False, class_=Session
)


def _migrate_sqlite_firewall_columns() -> None:
    url = config.database_url()
    if not url.startswith("sqlite"):
        return
    insp = inspect(_engine)
    if not insp.has_table("firewalls"):
        return
    cols = {c["name"] for c in insp.get_columns("firewalls")}
    stmts: list[str] = []
    if "name" not in cols:
        stmts.append("ALTER TABLE firewalls ADD COLUMN name VARCHAR(255)")
    if "description" not in cols:
        stmts.append("ALTER TABLE firewalls ADD COLUMN description TEXT")
    if "monitor_enabled" not in cols:
        stmts.append(
            "ALTER TABLE firewalls ADD COLUMN monitor_enabled BOOLEAN NOT NULL DEFAULT 1"
        )
    if "monitor_interval_minutes" not in cols:
        stmts.append(
            "ALTER TABLE firewalls ADD COLUMN monitor_interval_minutes INTEGER NOT NULL DEFAULT 5"
        )
    if "tags_json" not in cols:
        stmts.append(
            "ALTER TABLE firewalls ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'"
        )
    if "api_request_timeout_seconds" not in cols:
        stmts.append(
            "ALTER TABLE firewalls ADD COLUMN api_request_timeout_seconds "
            "INTEGER NOT NULL DEFAULT 120"
        )
    if "is_test" not in cols:
        stmts.append(
            "ALTER TABLE firewalls ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT 0"
        )
    if "last_online_at" not in cols:
        stmts.append(
            "ALTER TABLE firewalls ADD COLUMN last_online_at DATETIME"
        )
    if "device_hostname" not in cols:
        stmts.append("ALTER TABLE firewalls ADD COLUMN device_hostname VARCHAR(255)")
    if "serial_number" not in cols:
        stmts.append("ALTER TABLE firewalls ADD COLUMN serial_number VARCHAR(128)")
    if "model" not in cols:
        stmts.append("ALTER TABLE firewalls ADD COLUMN model VARCHAR(128)")
    if "firmware_version" not in cols:
        stmts.append("ALTER TABLE firewalls ADD COLUMN firmware_version VARCHAR(64)")
    if "license_info" not in cols:
        stmts.append("ALTER TABLE firewalls ADD COLUMN license_info VARCHAR(512)")
    if "firewall_subscriptions_json" not in cols:
        stmts.append(
            "ALTER TABLE firewalls ADD COLUMN firewall_subscriptions_json TEXT NOT NULL DEFAULT '[]'"
        )
    if "webadmin_metadata_json" not in cols:
        stmts.append(
            "ALTER TABLE firewalls ADD COLUMN webadmin_metadata_json TEXT NOT NULL DEFAULT '{}'"
        )
    if "webadmin_last_collected_at" not in cols:
        stmts.append("ALTER TABLE firewalls ADD COLUMN webadmin_last_collected_at DATETIME")
    if not stmts:
        return
    with _engine.begin() as conn:
        for stmt in stmts:
            conn.execute(text(stmt))


def _migrate_sqlite_configurations_member_firewall_ids() -> None:
    url = config.database_url()
    if not url.startswith("sqlite"):
        return
    insp = inspect(_engine)
    if not insp.has_table("configurations"):
        return
    cols = {c["name"] for c in insp.get_columns("configurations")}
    if "member_firewall_ids_json" in cols:
        return
    with _engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE configurations ADD COLUMN member_firewall_ids_json TEXT NOT NULL DEFAULT '[]'"
            )
        )


def _migrate_configuration_member_json_object_format() -> None:
    """Convert legacy ``member_firewall_ids_json`` array to ``{tags, firewall_ids}``."""
    from app.models import Configuration

    db = SessionLocal()
    try:
        changed = False
        for row in db.query(Configuration).all():
            raw = (row.member_firewall_ids_json or "").strip()
            if not raw or raw == "[]":
                row.member_firewall_ids_json = json.dumps({"tags": [], "firewall_ids": []})
                changed = True
                continue
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict):
                continue
            if isinstance(data, list):
                seen: set[int] = set()
                out_ids: list[int] = []
                for x in data:
                    try:
                        n = int(x)
                    except (TypeError, ValueError):
                        continue
                    if n > 0 and n not in seen:
                        seen.add(n)
                        out_ids.append(n)
                out_ids.sort()
                row.member_firewall_ids_json = json.dumps({"tags": [], "firewall_ids": out_ids})
                changed = True
        if changed:
            db.commit()
    finally:
        db.close()


def _migrate_sqlite_configurations_cloned_from_firewall() -> None:
    url = config.database_url()
    if not url.startswith("sqlite"):
        return
    insp = inspect(_engine)
    if not insp.has_table("configurations"):
        return
    cols = {c["name"] for c in insp.get_columns("configurations")}
    if "cloned_from_firewall_id" in cols:
        return
    with _engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE configurations ADD COLUMN cloned_from_firewall_id INTEGER"
            )
        )


def _migrate_sqlite_task_queue_completed_columns() -> None:
    url = config.database_url()
    if not url.startswith("sqlite"):
        return
    insp = inspect(_engine)
    if not insp.has_table("task_queue_completed"):
        return
    cols = {c["name"] for c in insp.get_columns("task_queue_completed")}
    stmts: list[str] = []
    if "outcome" not in cols:
        stmts.append(
            "ALTER TABLE task_queue_completed ADD COLUMN outcome VARCHAR(32)"
        )
    if not stmts:
        return
    with _engine.begin() as conn:
        for stmt in stmts:
            conn.execute(text(stmt))


def _migrate_sqlite_task_queue_scope_target() -> None:
    """Allow task rows for virtual configurations (nullable firewall_id, configuration_id FK)."""
    url = config.database_url()
    if not url.startswith("sqlite"):
        return
    insp = inspect(_engine)
    if not insp.has_table("task_queue"):
        return
    cols_tq = {c["name"] for c in insp.get_columns("task_queue")}
    if "configuration_id" not in cols_tq:
        stmts = [
        """
        CREATE TABLE task_queue__new (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            firewall_id INTEGER,
            configuration_id INTEGER,
            entity_type VARCHAR(32) NOT NULL,
            external_name VARCHAR(512) NOT NULL,
            status VARCHAR(32) NOT NULL,
            error_message TEXT,
            payload_json TEXT NOT NULL,
            created_by_user_id VARCHAR(36),
            created_by_username VARCHAR(200),
            created_at DATETIME,
            updated_at DATETIME,
            CONSTRAINT fk_tq_fw FOREIGN KEY (firewall_id) REFERENCES firewalls (id) ON DELETE CASCADE,
            CONSTRAINT fk_tq_cfg FOREIGN KEY (configuration_id) REFERENCES configurations (id) ON DELETE CASCADE
        )
        """,
        """
        INSERT INTO task_queue__new (
            id, firewall_id, configuration_id, entity_type, external_name,
            status, error_message, payload_json, created_by_user_id, created_by_username,
            created_at, updated_at
        )
        SELECT
            id, firewall_id, NULL, entity_type, external_name,
            status, error_message, payload_json, created_by_user_id, created_by_username,
            created_at, updated_at
        FROM task_queue
        """,
        "DROP TABLE task_queue",
        "ALTER TABLE task_queue__new RENAME TO task_queue",
        "CREATE INDEX IF NOT EXISTS ix_task_queue_firewall_id ON task_queue (firewall_id)",
        "CREATE INDEX IF NOT EXISTS ix_task_queue_configuration_id ON task_queue (configuration_id)",
        ]
        with _engine.begin() as conn:
            for stmt in stmts:
                conn.execute(text(stmt.strip()))

    insp = inspect(_engine)
    if not insp.has_table("task_queue_completed"):
        return
    cols_tqc = {c["name"] for c in insp.get_columns("task_queue_completed")}
    if "configuration_id" in cols_tqc:
        return

    stmts_c = [
        """
        CREATE TABLE task_queue_completed__new (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            source_task_id INTEGER,
            firewall_id INTEGER,
            configuration_id INTEGER,
            entity_type VARCHAR(32) NOT NULL,
            external_name VARCHAR(512) NOT NULL,
            payload_json TEXT NOT NULL,
            created_by_user_id VARCHAR(36),
            created_by_username VARCHAR(200),
            created_at DATETIME NOT NULL,
            completed_at DATETIME NOT NULL,
            completed_by_user_id VARCHAR(36),
            completed_by_username VARCHAR(200),
            outcome VARCHAR(32),
            CONSTRAINT fk_tqc_fw FOREIGN KEY (firewall_id) REFERENCES firewalls (id) ON DELETE CASCADE,
            CONSTRAINT fk_tqc_cfg FOREIGN KEY (configuration_id) REFERENCES configurations (id) ON DELETE CASCADE
        )
        """,
        """
        INSERT INTO task_queue_completed__new (
            id, source_task_id, firewall_id, configuration_id, entity_type, external_name,
            payload_json, created_by_user_id, created_by_username,
            created_at, completed_at, completed_by_user_id, completed_by_username, outcome
        )
        SELECT
            id, source_task_id, firewall_id, NULL, entity_type, external_name,
            payload_json, created_by_user_id, created_by_username,
            created_at, completed_at, completed_by_user_id, completed_by_username, outcome
        FROM task_queue_completed
        """,
        "DROP TABLE task_queue_completed",
        "ALTER TABLE task_queue_completed__new RENAME TO task_queue_completed",
        "CREATE INDEX IF NOT EXISTS ix_task_queue_completed_firewall_id ON task_queue_completed (firewall_id)",
        "CREATE INDEX IF NOT EXISTS ix_task_queue_completed_configuration_id ON task_queue_completed (configuration_id)",
        "CREATE INDEX IF NOT EXISTS ix_task_queue_completed_source_task_id ON task_queue_completed (source_task_id)",
        "CREATE INDEX IF NOT EXISTS ix_task_queue_completed_outcome ON task_queue_completed (outcome)",
    ]
    with _engine.begin() as conn:
        for stmt in stmts_c:
            conn.execute(text(stmt.strip()))


def _migrate_postgres_task_queue_scope_target() -> None:
    url = config.database_url()
    if url.startswith("sqlite"):
        return
    insp = inspect(_engine)
    if not insp.has_table("task_queue"):
        return
    cols_tq = {c["name"] for c in insp.get_columns("task_queue")}
    stmts: list[str] = []
    if "configuration_id" not in cols_tq:
        stmts.append(
            "ALTER TABLE task_queue ADD COLUMN configuration_id INTEGER "
            "REFERENCES configurations(id) ON DELETE CASCADE"
        )
    if stmts:
        with _engine.begin() as conn:
            for stmt in stmts:
                conn.execute(text(stmt))
    # Nullable firewall_id (best-effort for Postgres).
    try:
        with _engine.begin() as conn:
            conn.execute(text("ALTER TABLE task_queue ALTER COLUMN firewall_id DROP NOT NULL"))
    except Exception:
        pass

    if not insp.has_table("task_queue_completed"):
        return
    cols_c = {c["name"] for c in insp.get_columns("task_queue_completed")}
    stmts_c: list[str] = []
    if "configuration_id" not in cols_c:
        stmts_c.append(
            "ALTER TABLE task_queue_completed ADD COLUMN configuration_id INTEGER "
            "REFERENCES configurations(id) ON DELETE CASCADE"
        )
    if stmts_c:
        with _engine.begin() as conn:
            for stmt in stmts_c:
                conn.execute(text(stmt))
    try:
        with _engine.begin() as conn:
            conn.execute(
                text("ALTER TABLE task_queue_completed ALTER COLUMN firewall_id DROP NOT NULL")
            )
    except Exception:
        pass


def _migrate_sqlite_task_queue_columns() -> None:
    url = config.database_url()
    if not url.startswith("sqlite"):
        return
    insp = inspect(_engine)
    if not insp.has_table("task_queue"):
        return
    cols = {c["name"] for c in insp.get_columns("task_queue")}
    stmts: list[str] = []
    if "created_by_user_id" not in cols:
        stmts.append("ALTER TABLE task_queue ADD COLUMN created_by_user_id VARCHAR(36)")
    if "created_by_username" not in cols:
        stmts.append("ALTER TABLE task_queue ADD COLUMN created_by_username VARCHAR(200)")
    if not stmts:
        return
    with _engine.begin() as conn:
        for stmt in stmts:
            conn.execute(text(stmt))


def _ensure_composite_indexes() -> None:
    """Create composite indexes if they don't already exist (safe to re-run)."""
    if not config.database_url().startswith("sqlite"):
        return
    insp = inspect(_engine)
    indexes_to_create = [
        ("firewall_config_entries", "idx_fwce_type_fw", ["entity_type", "firewall_id"]),
        ("configuration_config_entries", "idx_cce_type_cfg", ["entity_type", "configuration_id"]),
    ]
    for table_name, idx_name, columns in indexes_to_create:
        if not insp.has_table(table_name):
            continue
        existing = {idx["name"] for idx in insp.get_indexes(table_name)}
        if idx_name in existing:
            continue
        cols = ", ".join(columns)
        with _engine.begin() as conn:
            conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table_name} ({cols})"))


def _migrate_sqlite_ipam_assigned_columns() -> None:
    url = config.database_url()
    if not url.startswith("sqlite"):
        return
    insp = inspect(_engine)
    if not insp.has_table("ipam_prefixes"):
        return
    cols = {c["name"] for c in insp.get_columns("ipam_prefixes")}
    stmts: list[str] = []
    if "assigned_to_firewall_id" not in cols:
        stmts.append(
            "ALTER TABLE ipam_prefixes ADD COLUMN assigned_to_firewall_id INTEGER "
            "REFERENCES firewalls(id) ON DELETE SET NULL"
        )
    if "assigned_to_custom" not in cols:
        stmts.append(
            "ALTER TABLE ipam_prefixes ADD COLUMN assigned_to_custom VARCHAR(255)"
        )
    if not stmts:
        return
    with _engine.begin() as conn:
        for stmt in stmts:
            conn.execute(text(stmt))


def _migrate_sqlite_ipam_cidr_vrf_unique() -> None:
    """Replace global CIDR uniqueness with (cidr, vrf_bucket) matching app.ipam.vrf_key."""
    url = config.database_url()
    if not url.startswith("sqlite"):
        return
    from app.ipam import vrf_key

    insp = inspect(_engine)
    if not insp.has_table("ipam_prefixes"):
        return
    cols = {c["name"] for c in insp.get_columns("ipam_prefixes")}
    idx_meta = insp.get_indexes("ipam_prefixes")
    has_composite = False
    for idx in idx_meta:
        if not idx.get("unique"):
            continue
        icols = tuple(idx.get("column_names") or ())
        if icols == ("cidr", "vrf_bucket"):
            has_composite = True
            break
    if "vrf_bucket" in cols and has_composite:
        return

    has_vb_col = "vrf_bucket" in cols
    q = (
        "SELECT id, name, cidr, family, vrf, prefix_type, assigned_to_firewall_id, "
        "assigned_to_custom, description, created_at, updated_at"
        + (", vrf_bucket" if has_vb_col else "")
        + " FROM ipam_prefixes"
    )
    with _engine.connect() as conn:
        rows = list(conn.execute(text(q)).mappings())

    with _engine.begin() as conn:
        conn.execute(text("DROP TABLE ipam_prefixes"))
        conn.execute(
            text(
                """
                CREATE TABLE ipam_prefixes (
                    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(255) NOT NULL DEFAULT '',
                    cidr VARCHAR(128) NOT NULL,
                    family INTEGER NOT NULL,
                    vrf VARCHAR(128),
                    vrf_bucket VARCHAR(128) NOT NULL DEFAULT 'default',
                    prefix_type VARCHAR(32) NOT NULL DEFAULT 'assignment',
                    assigned_to_firewall_id INTEGER REFERENCES firewalls(id) ON DELETE SET NULL,
                    assigned_to_custom VARCHAR(255),
                    description TEXT,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL,
                    CONSTRAINT uq_ipam_prefix_cidr_vrf UNIQUE (cidr, vrf_bucket)
                )
                """
            )
        )
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_ipam_prefixes_cidr ON ipam_prefixes (cidr)")
        )
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_ipam_prefixes_vrf ON ipam_prefixes (vrf)")
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_ipam_prefixes_vrf_bucket ON ipam_prefixes (vrf_bucket)"
            )
        )
        for r in rows:
            vb = ""
            if has_vb_col and r.get("vrf_bucket") is not None:
                vb = str(r["vrf_bucket"]).strip()
            if not vb:
                vb = vrf_key(r["vrf"])
            conn.execute(
                text(
                    """
                    INSERT INTO ipam_prefixes (
                        id, name, cidr, family, vrf, vrf_bucket, prefix_type,
                        assigned_to_firewall_id, assigned_to_custom, description, created_at, updated_at
                    ) VALUES (
                        :id, :name, :cidr, :family, :vrf, :vrf_bucket, :prefix_type,
                        :afw, :acu, :desc, :ca, :ua
                    )
                    """
                ),
                {
                    "id": r["id"],
                    "name": r["name"],
                    "cidr": r["cidr"],
                    "family": r["family"],
                    "vrf": r["vrf"],
                    "vrf_bucket": vb,
                    "prefix_type": r["prefix_type"],
                    "afw": r["assigned_to_firewall_id"],
                    "acu": r["assigned_to_custom"],
                    "desc": r["description"],
                    "ca": r["created_at"],
                    "ua": r["updated_at"],
                },
            )
        conn.execute(text("DELETE FROM sqlite_sequence WHERE name = 'ipam_prefixes'"))
        mx = conn.execute(text("SELECT MAX(id) FROM ipam_prefixes")).scalar()
        if mx is not None:
            conn.execute(
                text("INSERT INTO sqlite_sequence (name, seq) VALUES ('ipam_prefixes', :m)"),
                {"m": int(mx)},
            )


def _migrate_postgres_ipam_cidr_vrf_unique() -> None:
    if config.database_url().startswith("sqlite"):
        return
    insp = inspect(_engine)
    if not insp.has_table("ipam_prefixes"):
        return
    cols = {c["name"] for c in insp.get_columns("ipam_prefixes")}
    with _engine.begin() as conn:
        if "vrf_bucket" not in cols:
            conn.execute(text("ALTER TABLE ipam_prefixes ADD COLUMN vrf_bucket VARCHAR(128)"))
            conn.execute(
                text(
                    "UPDATE ipam_prefixes SET vrf_bucket = COALESCE(NULLIF(TRIM(vrf), ''), 'default')"
                )
            )
            conn.execute(text("ALTER TABLE ipam_prefixes ALTER COLUMN vrf_bucket SET NOT NULL"))
            conn.execute(
                text("ALTER TABLE ipam_prefixes ALTER COLUMN vrf_bucket SET DEFAULT 'default'")
            )
    insp = inspect(_engine)
    uqs = insp.get_unique_constraints("ipam_prefixes")
    if any(tuple(uq.get("column_names") or ()) == ("cidr", "vrf_bucket") for uq in uqs):
        return
    with _engine.begin() as conn:
        for uq in uqs:
            ucols = tuple(uq.get("column_names") or ())
            if len(ucols) == 1 and ucols[0] == "cidr":
                conn.execute(
                    text(f'ALTER TABLE ipam_prefixes DROP CONSTRAINT "{uq["name"]}"')
                )
        conn.execute(
            text(
                "ALTER TABLE ipam_prefixes ADD CONSTRAINT uq_ipam_prefix_cidr_vrf "
                "UNIQUE (cidr, vrf_bucket)"
            )
        )


def _migrate_sqlite_ipam_pool_unmanaged() -> None:
    url = config.database_url()
    if not url.startswith("sqlite"):
        return
    insp = inspect(_engine)
    if not insp.has_table("ipam_prefixes"):
        return
    cols = {c["name"] for c in insp.get_columns("ipam_prefixes")}
    if "pool_unmanaged" in cols:
        return
    with _engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE ipam_prefixes ADD COLUMN pool_unmanaged BOOLEAN NOT NULL DEFAULT 0"
            )
        )


def _migrate_postgres_ipam_pool_unmanaged() -> None:
    if config.database_url().startswith("sqlite"):
        return
    insp = inspect(_engine)
    if not insp.has_table("ipam_prefixes"):
        return
    cols = {c["name"] for c in insp.get_columns("ipam_prefixes")}
    if "pool_unmanaged" in cols:
        return
    with _engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE ipam_prefixes ADD COLUMN pool_unmanaged BOOLEAN NOT NULL DEFAULT false"
            )
        )


def _migrate_postgres_ref_countries_code_width() -> None:
    """Widen PK: backups from Sophos can contain country identifiers longer than varchar(8)."""
    if config.database_url().startswith("sqlite"):
        return
    insp = inspect(_engine)
    if not insp.has_table("ref_countries"):
        return
    with _engine.begin() as conn:
        cur = conn.execute(
            text(
                "SELECT character_maximum_length FROM information_schema.columns "
                "WHERE table_schema = current_schema() AND table_name = 'ref_countries' "
                "AND column_name = 'code'"
            )
        ).scalar()
        if cur is None:
            return
        try:
            n = int(cur)
        except (TypeError, ValueError):
            return
        if n >= 64:
            return
        conn.execute(text("ALTER TABLE ref_countries ALTER COLUMN code TYPE VARCHAR(64)"))


def _migrate_sqlite_ipam_prefix_name() -> None:
    url = config.database_url()
    if not url.startswith("sqlite"):
        return
    insp = inspect(_engine)
    if not insp.has_table("ipam_prefixes"):
        return
    cols = {c["name"] for c in insp.get_columns("ipam_prefixes")}
    if "name" in cols:
        return
    with _engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE ipam_prefixes ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT ''"
            )
        )


def init_db() -> None:
    Base.metadata.create_all(bind=_engine)
    _migrate_sqlite_firewall_columns()
    _migrate_sqlite_task_queue_columns()
    _migrate_sqlite_task_queue_completed_columns()
    _migrate_sqlite_task_queue_scope_target()
    _migrate_postgres_task_queue_scope_target()
    _migrate_sqlite_configurations_cloned_from_firewall()
    _migrate_sqlite_configurations_member_firewall_ids()
    _migrate_configuration_member_json_object_format()
    _ensure_composite_indexes()
    _migrate_sqlite_ipam_prefix_name()
    _migrate_sqlite_ipam_assigned_columns()
    _migrate_sqlite_ipam_cidr_vrf_unique()
    _migrate_postgres_ipam_cidr_vrf_unique()
    _migrate_sqlite_ipam_pool_unmanaged()
    _migrate_postgres_ipam_pool_unmanaged()
    _migrate_postgres_ref_countries_code_width()
    _seed_default_ipam_vrf()


def _seed_default_ipam_vrf() -> None:
    from app.ipam_vrf import ensure_default_ipam_vrf_exists

    db = SessionLocal()
    try:
        ensure_default_ipam_vrf_exists(db)
    finally:
        db.close()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
