"""Settings · Backup download and merge restore API."""

from __future__ import annotations

import io
import json
import uuid
import zipfile

import pytest

from app.backup_crypto import BACKUP_ENVELOPE_MAGIC, decrypt_backup_archive
from app.backup_restore import (
    MAIN_DB_NAME,
    MANIFEST_NAME,
    MONITOR_DB_NAME,
    SECRETS_DB_NAME,
    build_backup_zip,
    restore_backup_merge,
)

_BACKUP_PW = "backuppass12"

@pytest.fixture(autouse=True)
def _backup_test_isolation(tmp_path, monkeypatch):
    """Keep cache and backup password settings under pytest tmp (not repo root)."""
    d = tmp_path / "gc_backup_cache"
    d.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr("app.backup_restore._backup_cache_dir", lambda: d)
    settings_path = tmp_path / ".gc_backup_settings.json"
    monkeypatch.setattr("app.backup_password._state_path", lambda: settings_path)


@pytest.fixture
def configure_backup_password(authed_client):
    r = authed_client.post(
        "/api/settings/backup/password",
        json={
            "password": _BACKUP_PW,
            "password_confirm": _BACKUP_PW,
        },
    )
    assert r.status_code == 200, r.text


def test_api_backup_download_ok(authed_client, configure_backup_password):
    g = authed_client.post("/api/settings/backup/generate")
    assert g.status_code == 200, g.text
    r = authed_client.get("/api/settings/backup/download")
    assert r.status_code == 200
    assert r.headers.get("content-type") == "application/octet-stream"
    assert "attachment" in (r.headers.get("content-disposition") or "").lower()
    assert r.content.startswith(BACKUP_ENVELOPE_MAGIC)
    plain = decrypt_backup_archive(r.content, _BACKUP_PW)
    zf = zipfile.ZipFile(io.BytesIO(plain))
    assert MANIFEST_NAME in zf.namelist()
    assert MAIN_DB_NAME in zf.namelist()


def test_api_backup_download_404_without_generate(authed_client):
    r = authed_client.get("/api/settings/backup/download")
    assert r.status_code == 404


def test_api_backup_generate_requires_password(authed_client):
    r = authed_client.post("/api/settings/backup/generate")
    assert r.status_code == 400
    assert "password" in (r.json().get("detail") or "").lower()


def test_api_backup_status_unreadable_stored_password(authed_client):
    """Blob present but Fernet decrypt fails → not "configured"; UI can prompt to re-save."""
    from app.backup_password import _state_path

    p = _state_path()
    enc_key = "encrypted_backup_" + "password"
    p.write_text(
        json.dumps({enc_key: "not-decryptable-with-current-fernet-key"}),
        encoding="utf-8",
    )
    r = authed_client.get("/api/settings/backup/status")
    assert r.status_code == 200
    body = r.json()
    assert body.get("password_configured") is False
    assert body.get("password_needs_reset") is True


def test_api_backup_password_replace_without_current_password(authed_client, configure_backup_password):
    new_pw = "newpass56789"
    r = authed_client.post(
        "/api/settings/backup/password",
        json={"password": new_pw, "password_confirm": new_pw},
    )
    assert r.status_code == 200, r.text
    assert authed_client.post("/api/settings/backup/generate").status_code == 200
    dl = authed_client.get("/api/settings/backup/download")
    assert dl.status_code == 200
    plain = decrypt_backup_archive(dl.content, new_pw)
    with pytest.raises(ValueError):
        decrypt_backup_archive(dl.content, _BACKUP_PW)
    zf = zipfile.ZipFile(io.BytesIO(plain))
    assert MANIFEST_NAME in zf.namelist()


def test_api_backup_generate_and_status(authed_client, configure_backup_password):
    st0 = authed_client.get("/api/settings/backup/status")
    assert st0.status_code == 200
    body0 = st0.json()
    assert body0.get("ready") is False
    assert body0.get("password_configured") is True

    g = authed_client.post("/api/settings/backup/generate")
    assert g.status_code == 200, g.text
    gen = g.json()
    assert gen.get("ok") is True
    assert gen.get("generated_at")
    assert gen.get("size_bytes", 0) > 0

    st1 = authed_client.get("/api/settings/backup/status")
    assert st1.status_code == 200
    body1 = st1.json()
    assert body1.get("ready") is True
    assert body1.get("size_bytes", 0) > 0


def test_api_backup_forbidden_for_non_admin(client, secrets_session):
    from app import users_service
    from app.auth import hash_password
    from app.secrets_models import AppUser

    users_service.ensure_default_admin_user(secrets_session)
    uname = f"bu_nonadmin_{uuid.uuid4().hex[:8]}"
    row = AppUser(
        id=str(uuid.uuid4()),
        username=uname,
        role="user",
        password_hash=hash_password("y" * 12),
    )
    secrets_session.add(row)
    secrets_session.commit()
    r_login = client.post("/api/auth/login", json={"username": uname, "password": "y" * 12})
    assert r_login.status_code == 200, r_login.text
    assert client.get("/api/settings/backup/status").status_code == 403
    assert client.post("/api/settings/backup/generate").status_code == 403
    assert (
        client.post(
            "/api/settings/backup/password",
            json={"password": "x" * 12, "password_confirm": "x" * 12},
        ).status_code
        == 403
    )
    r = client.get("/api/settings/backup/download")
    assert r.status_code == 403
    assert client.post("/api/settings/backup/restore-last", json={}).status_code == 403


def test_backup_restore_merge_reverts_field(authed_client, configure_backup_password):
    from app.database import SessionLocal, init_db
    from app.models import Firewall

    init_db()
    db = SessionLocal()
    try:
        f = Firewall(
            host="10.0.0.1",
            port=4444,
            username="apiuser",
            verify_ssl=True,
            name="Original",
        )
        db.add(f)
        db.commit()
        fid = int(f.id)

        assert authed_client.post("/api/settings/backup/generate").status_code == 200
        r0 = authed_client.get("/api/settings/backup/download")
        assert r0.status_code == 200
        enc_bytes = r0.content

        row = db.get(Firewall, fid)
        assert row is not None
        row.name = "Mutated"
        db.commit()

        r1 = authed_client.post(
            "/api/settings/backup/restore",
            files={"file": ("backup.gcbak", enc_bytes, "application/octet-stream")},
            data={"password": ""},
        )
        assert r1.status_code == 200, r1.text
        data = r1.json()
        assert data.get("ok") is True

        db.expire_all()
        again = db.get(Firewall, fid)
        assert again is not None
        assert again.name == "Original"
    finally:
        db.close()


def test_backup_restore_rejects_bad_zip(authed_client):
    r = authed_client.post(
        "/api/settings/backup/restore",
        files={"file": ("bad.zip", b"not a zip", "application/zip")},
        data={"password": ""},
    )
    assert r.status_code == 400
    assert "Unrecognized" in (r.json().get("detail") or "")


def test_restore_merge_keeps_local_only_row(authed_client, configure_backup_password):
    """Row added after backup must remain after restore (not deleted)."""
    from app.database import SessionLocal, init_db
    from app.models import Firewall

    init_db()
    db = SessionLocal()
    try:
        f1 = Firewall(
            host="10.1.0.1",
            port=4444,
            username="u1",
            verify_ssl=True,
            name="One",
        )
        db.add(f1)
        db.commit()
        assert authed_client.post("/api/settings/backup/generate").status_code == 200
        r0 = authed_client.get("/api/settings/backup/download")
        enc_bytes = r0.content

        f2 = Firewall(
            host="10.2.0.2",
            port=4444,
            username="u2",
            verify_ssl=True,
            name="Two",
        )
        db.add(f2)
        db.commit()
        fid2 = int(f2.id)

        r1 = authed_client.post(
            "/api/settings/backup/restore",
            files={"file": ("backup.gcbak", enc_bytes, "application/octet-stream")},
            data={"password": _BACKUP_PW},
        )
        assert r1.status_code == 200, r1.text

        db.expire_all()
        assert db.get(Firewall, fid2) is not None
        assert db.get(Firewall, int(f1.id)) is not None
    finally:
        db.close()


def test_api_backup_restore_last(authed_client, configure_backup_password):
    from app.database import SessionLocal, init_db
    from app.models import Firewall

    init_db()
    db = SessionLocal()
    try:
        f = Firewall(
            host="10.9.0.1",
            port=4444,
            username="u9",
            verify_ssl=True,
            name="Before",
        )
        db.add(f)
        db.commit()
        fid = int(f.id)
        assert authed_client.post("/api/settings/backup/generate").status_code == 200
        row = db.get(Firewall, fid)
        assert row is not None
        row.name = "After"
        db.commit()
        r1 = authed_client.post("/api/settings/backup/restore-last", json={})
        assert r1.status_code == 200, r1.text
        assert r1.json().get("ok") is True
        db.expire_all()
        again = db.get(Firewall, fid)
        assert again is not None
        assert again.name == "Before"
    finally:
        db.close()


def test_restore_merge_replaces_conflicting_admin_user():
    """Fresh install default admin (new id, same username) must not make restore 500."""
    from datetime import datetime, timezone

    from app.auth import hash_password
    from app.database import SessionLocal, init_db
    from app.monitor_database import MonitorSessionLocal, init_monitor_db
    from app.secrets_database import SecretsSessionLocal, init_secrets_db
    from app.secrets_models import DEFAULT_ADMIN_USERNAME, AppUser

    init_db()
    init_secrets_db()
    init_monitor_db()
    main = SessionLocal()
    sec = SecretsSessionLocal()
    mon = MonitorSessionLocal()
    try:
        backup_uid = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        sec.query(AppUser).delete()
        sec.add(
            AppUser(
                id=backup_uid,
                username=DEFAULT_ADMIN_USERNAME,
                role="admin",
                password_hash=hash_password("backup-pw-12345"),
                created_at=now,
                updated_at=now,
            ),
        )
        sec.commit()

        built = build_backup_zip(main, sec, mon)
        plain_zip = built.data

        sec.query(AppUser).delete()
        fresh_uid = str(uuid.uuid4())
        sec.add(
            AppUser(
                id=fresh_uid,
                username=DEFAULT_ADMIN_USERNAME,
                role="admin",
                password_hash=hash_password("fresh-pw-12345"),
                created_at=now,
                updated_at=now,
            ),
        )
        sec.commit()

        out = restore_backup_merge(plain_zip, main, sec, mon, backup_password=None)
        assert out.get("ok") is True

        sec.expire_all()
        row = sec.get(AppUser, backup_uid)
        assert row is not None
        assert row.username == DEFAULT_ADMIN_USERNAME
        assert sec.query(AppUser).count() == 1
    finally:
        main.close()
        sec.close()
        mon.close()


def test_restore_skips_orphan_access_session_logs():
    """Logs pointing at a firewall id not present in the backup must not break restore (Postgres FK)."""
    from app.backup_restore import _MAIN_MODEL_ORDER
    from app.database import SessionLocal, init_db
    from app.models import AccessSessionLog
    from app.monitor_database import MonitorSessionLocal, init_monitor_db
    from app.secrets_database import SecretsSessionLocal, init_secrets_db

    init_db()
    init_secrets_db()
    init_monitor_db()
    main = SessionLocal()
    sec = SecretsSessionLocal()
    mon = MonitorSessionLocal()
    try:
        for model in reversed(_MAIN_MODEL_ORDER):
            main.query(model).delete()
        main.commit()

        main_payload = {
            "firewalls": [],
            "access_session_logs": [
                {
                    "id": 1,
                    "session_id": str(uuid.uuid4()),
                    "firewall_id": 105,
                    "access_type": "webadmin",
                    "event_kind": "start",
                    "connected_successfully": True,
                    "initiated_by_user_id": str(uuid.uuid4()),
                    "initiated_by_username": "admin",
                    "client_ip": "127.0.0.1",
                    "details": "x",
                    "created_at": "2026-01-01T00:00:00+00:00",
                }
            ],
        }
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr(MANIFEST_NAME, '{"format_version": 1}')
            zf.writestr(MAIN_DB_NAME, json.dumps(main_payload))
            zf.writestr(SECRETS_DB_NAME, "{}")
            zf.writestr(MONITOR_DB_NAME, "{}")
        out = restore_backup_merge(buf.getvalue(), main, sec, mon)
        assert out.get("ok") is True
        assert main.query(AccessSessionLog).count() == 0
    finally:
        main.close()
        sec.close()
        mon.close()


def test_restore_backup_merge_unit_handles_version():
    from app.database import SessionLocal, init_db
    from app.monitor_database import MonitorSessionLocal, init_monitor_db
    from app.secrets_database import SecretsSessionLocal, init_secrets_db

    init_db()
    init_secrets_db()
    init_monitor_db()
    main = SessionLocal()
    sec = SecretsSessionLocal()
    mon = MonitorSessionLocal()
    try:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr(MANIFEST_NAME, '{"format_version": 999}')
            zf.writestr(MAIN_DB_NAME, "{}")
            zf.writestr(SECRETS_DB_NAME, "{}")
            zf.writestr(MONITOR_DB_NAME, "{}")
        with pytest.raises(ValueError, match="format_version"):
            restore_backup_merge(buf.getvalue(), main, sec, mon)
    finally:
        main.close()
        sec.close()
        mon.close()
