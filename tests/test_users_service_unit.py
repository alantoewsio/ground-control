"""Tests for ``app.users_service``."""

from __future__ import annotations

import pytest

from app import users_service
from app.auth import hash_password
from app.secrets_models import DEFAULT_ADMIN_USERNAME, AppUser


def test_user_row_public_and_helpers(secrets_session):
    import uuid

    users_service.ensure_default_admin_user(secrets_session)
    row = AppUser(
        id=str(uuid.uuid4()),
        username="nopw_user",
        role="user",
        password_hash=None,
    )
    secrets_session.add(row)
    secrets_session.commit()
    pub = users_service.user_row_public(row)
    assert pub["username"] == "nopw_user"
    assert users_service.password_hash_is_usable(None) is False
    assert users_service.password_hash_is_usable("x") is True
    assert users_service.app_user_has_password(row) is False


def test_get_app_user_by_id_and_username(secrets_session):
    users_service.ensure_default_admin_user(secrets_session)
    row = (
        secrets_session.query(AppUser)
        .filter(AppUser.username == DEFAULT_ADMIN_USERNAME)
        .one()
    )
    row.password_hash = hash_password("password12345")
    secrets_session.commit()
    got = users_service.get_app_user_by_id(row.id)
    assert got is not None
    assert users_service.username_for_user_id(row.id) == row.username
    assert users_service.username_for_user_id("") == ""
    by_name = users_service.get_app_user_by_username_db(secrets_session, row.username)
    assert by_name is not None


def test_insert_and_update_and_delete_user(secrets_session):
    users_service.ensure_default_admin_user(secrets_session)
    h = hash_password("password12345")
    pub = users_service.insert_app_user(
        secrets_session,
        username="u2",
        role="user",
        password_hash=h,
        full_name="  N  ",
    )
    uid = pub["id"]
    assert users_service.update_app_user_role(secrets_session, uid, "admin") is not None
    assert users_service.update_app_user_password_hash(secrets_session, uid, h) is True
    assert users_service.update_app_user_profile_cols(secrets_session, uid, {}) is not None
    assert users_service.update_app_user_profile_cols(
        secrets_session, uid, {"email": "a@b.co"}
    ) is not None
    with pytest.raises(ValueError, match="invalid profile"):
        users_service.update_app_user_profile_cols(
            secrets_session, uid, {"bad_col": "x"}
        )
    assert users_service.delete_app_user(secrets_session, uid) is True
    assert users_service.delete_app_user(secrets_session, "missing") is False


def test_count_and_total(secrets_session):
    users_service.ensure_default_admin_user(secrets_session)
    assert users_service.count_admins(secrets_session) >= 1
    assert users_service.total_app_users(secrets_session) >= 1
    assert len(users_service.list_app_users(secrets_session)) >= 1


def test_bootstrap_and_needs_setup(secrets_session):
    users_service.ensure_default_admin_user(secrets_session)
    for u in secrets_session.query(AppUser).all():
        u.password_hash = None
    secrets_session.commit()
    assert users_service.needs_initial_admin_password(secrets_session) is True
    bid = users_service.bootstrap_setup_target_user_id(secrets_session)
    assert bid is not None
    row = secrets_session.get(AppUser, bid)
    assert row is not None
    row.password_hash = hash_password("password12345")
    secrets_session.commit()
    assert users_service.needs_initial_admin_password(secrets_session) is False
    assert users_service.bootstrap_setup_target_user_id(secrets_session) is None
