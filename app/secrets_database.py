"""Separate SQLite (or other) database for app user password hashes and firewall credentials."""

from __future__ import annotations

from collections.abc import Generator
from datetime import datetime

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from app import config
from app.db_utils import enable_wal_mode
from app.secrets_models import AppUser, FirewallCredential, SecretsBase

_secrets_engine = create_engine(
    config.secrets_database_url(),
    connect_args={"check_same_thread": False}
    if config.secrets_database_url().startswith("sqlite")
    else {},
)
enable_wal_mode(_secrets_engine)


@event.listens_for(_secrets_engine, "connect")
def _secrets_sqlite_enable_foreign_keys(dbapi_connection, _connection_record) -> None:
    if _secrets_engine.dialect.name == "sqlite":
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SecretsSessionLocal = sessionmaker(
    bind=_secrets_engine, autocommit=False, autoflush=False, class_=Session
)


def get_firewall_password_encrypted(sdb: Session, firewall_id: int) -> str | None:
    row = sdb.get(FirewallCredential, firewall_id)
    return row.password_encrypted if row else None


def upsert_firewall_password_encrypted(sdb: Session, firewall_id: int, encrypted: str) -> None:
    row = sdb.get(FirewallCredential, firewall_id)
    if row:
        row.password_encrypted = encrypted
    else:
        sdb.add(FirewallCredential(firewall_id=firewall_id, password_encrypted=encrypted))


def delete_firewall_credential(sdb: Session, firewall_id: int) -> None:
    row = sdb.get(FirewallCredential, firewall_id)
    if row:
        sdb.delete(row)


def _coerce_datetime(value: object) -> datetime:
    if isinstance(value, datetime):
        return value
    if value is None:
        return datetime.now()
    if isinstance(value, str):
        s = value.strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            pass
    return datetime.now()


def _migrate_legacy_from_main_sqlite() -> None:
    """One-time move of app_users and firewall passwords from pre-split ground_control.db."""
    main_url = config.database_url()
    if not main_url.startswith("sqlite") or not config.secrets_database_url().startswith(
        "sqlite"
    ):
        return

    from app.database import _engine as main_engine

    main_insp = inspect(main_engine)
    if not main_insp.has_table("firewalls"):
        return

    fw_cols = {c["name"] for c in main_insp.get_columns("firewalls")}
    had_app_users_on_main = main_insp.has_table("app_users")

    with SecretsSessionLocal() as sdb:
        secrets_user_count = int(
            sdb.execute(text("SELECT COUNT(*) FROM app_users")).scalar() or 0
        )

        if had_app_users_on_main and secrets_user_count == 0:
            with main_engine.connect() as conn:
                rows = conn.execute(text("SELECT * FROM app_users")).mappings().all()
            for r in rows:
                m = dict(r)
                sdb.add(
                    AppUser(
                        id=str(m["id"]),
                        username=str(m["username"]),
                        role=str(m["role"]),
                        password_hash=m.get("password_hash"),
                        full_name=m.get("full_name"),
                        email=m.get("email"),
                        mobile=m.get("mobile"),
                        created_at=_coerce_datetime(m.get("created_at")),
                        updated_at=_coerce_datetime(m.get("updated_at")),
                    )
                )
            sdb.commit()
            with main_engine.begin() as conn:
                conn.execute(text("DROP TABLE app_users"))

        if "password_encrypted" in fw_cols:
            with main_engine.connect() as conn:
                rows = conn.execute(
                    text("SELECT id, password_encrypted FROM firewalls")
                ).all()
            for fid, enc in rows:
                if enc is None or not str(enc).strip():
                    continue
                upsert_firewall_password_encrypted(sdb, int(fid), str(enc))
            sdb.commit()

            with main_engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE firewalls DROP COLUMN password_encrypted")
                )


def init_secrets_db() -> None:
    SecretsBase.metadata.create_all(bind=_secrets_engine)
    _migrate_legacy_from_main_sqlite()
    from app.users_service import ensure_default_admin_user

    with SecretsSessionLocal() as db:
        ensure_default_admin_user(db)


def get_secrets_db() -> Generator[Session, None, None]:
    db = SecretsSessionLocal()
    try:
        yield db
    finally:
        db.close()
