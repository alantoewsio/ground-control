"""Settings user APIs: role assignment rules for Admin vs SuperAdmin."""

from tests.conftest import AUTHED_CLIENT_TEST_PASSWORD


def test_settings_create_designer_forbidden_for_admin(authed_client) -> None:
    r = authed_client.post(
        "/api/settings/users",
        json={
            "username": "role-test-designer",
            "password": AUTHED_CLIENT_TEST_PASSWORD,
            "role": "Designer",
        },
    )
    assert r.status_code == 403, r.text
    assert "SuperAdmin" in r.json().get("detail", "")


def test_settings_create_superadmin_forbidden_for_admin(authed_client) -> None:
    r = authed_client.post(
        "/api/settings/users",
        json={
            "username": "role-test-sa",
            "password": AUTHED_CLIENT_TEST_PASSWORD,
            "role": "SuperAdmin",
        },
    )
    assert r.status_code == 403, r.text


def test_settings_create_readonly_ok_for_admin(authed_client) -> None:
    r = authed_client.post(
        "/api/settings/users",
        json={
            "username": "role-test-ro",
            "password": AUTHED_CLIENT_TEST_PASSWORD,
            "role": "ReadOnly",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("username") == "role-test-ro"
    assert body.get("role") == "ReadOnly"


def test_settings_create_designer_ok_for_superadmin(superadmin_client) -> None:
    r = superadmin_client.post(
        "/api/settings/users",
        json={
            "username": "role-test-designer-sa",
            "password": AUTHED_CLIENT_TEST_PASSWORD,
            "role": "Designer",
        },
    )
    assert r.status_code == 200, r.text
    assert r.json().get("role") == "Designer"


def test_settings_patch_to_designer_forbidden_for_admin(
    authed_client, secrets_session
) -> None:
    from app.auth import hash_password
    from app.secrets_models import AppUser

    uid = __import__("uuid").uuid4().hex
    secrets_session.add(
        AppUser(
            id=uid,
            username="patch-role-target",
            role="ReadOnly",
            password_hash=hash_password(AUTHED_CLIENT_TEST_PASSWORD),
        )
    )
    secrets_session.commit()

    r = authed_client.patch(
        f"/api/settings/users/{uid}",
        json={"role": "Designer"},
    )
    assert r.status_code == 403, r.text
