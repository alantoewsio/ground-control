"""Pytest configuration: isolate DB files and secrets before any ``app`` import."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from cryptography.fernet import Fernet

_tmp_root = Path(tempfile.mkdtemp(prefix="pytest-gc-"))
os.environ["GROUND_CONTROL_DATABASE_URL"] = f"sqlite:///{_tmp_root / 'ground_control.db'}"
os.environ["GROUND_CONTROL_MONITOR_DATABASE_URL"] = f"sqlite:///{_tmp_root / 'monitor.db'}"
os.environ["GROUND_CONTROL_SECRETS_DATABASE_URL"] = f"sqlite:///{_tmp_root / 'secrets.db'}"
os.environ["GROUND_CONTROL_SESSION_SECRET"] = "pytest-session-secret-" + "x" * 32
os.environ["GROUND_CONTROL_FERNET_KEY"] = Fernet.generate_key().decode()
os.environ["GROUND_CONTROL_UNDER_PYTEST"] = "1"


def _noop_scheduler() -> None:
    return None


import app.monitor_scheduler as _monitor_scheduler

_monitor_scheduler.start_monitor_scheduler = _noop_scheduler  # type: ignore[method-assign]
_monitor_scheduler.stop_monitor_scheduler = _noop_scheduler  # type: ignore[method-assign]

import pytest


@pytest.fixture
def client():
    """HTTP client with app lifespan (DB init); scheduler no-ops via module patch."""
    from starlette.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def secrets_session():

    from app.secrets_database import SecretsSessionLocal, init_secrets_db

    init_secrets_db()
    db = SecretsSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def main_session():

    from app.database import SessionLocal, init_db

    init_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def authed_client(client, secrets_session):
    """Browser session + API auth: set known admin password in DB and log in."""
    from app import users_service
    from app.auth import hash_password
    from app.secrets_models import DEFAULT_ADMIN_USERNAME, AppUser

    pw = "x" * 12  # meets validate_new_password
    users_service.ensure_default_admin_user(secrets_session)
    row = secrets_session.query(AppUser).filter_by(username=DEFAULT_ADMIN_USERNAME).one()
    row.password_hash = hash_password(pw)
    secrets_session.commit()
    r = client.post(
        "/api/auth/login",
        json={"username": DEFAULT_ADMIN_USERNAME, "password": pw},
    )
    assert r.status_code == 200, r.text
    return client
