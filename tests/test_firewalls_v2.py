"""Firewalls v2 shell (Designer / SuperAdmin) and object navigator pages."""

import pytest


def test_firewalls_v2_inventory_forbidden_for_non_designer(authed_client, secrets_session) -> None:
    from app.secrets_models import DEFAULT_ADMIN_USERNAME, AppUser

    row = secrets_session.query(AppUser).filter_by(username=DEFAULT_ADMIN_USERNAME).one()
    row.role = "admin"
    secrets_session.commit()
    r = authed_client.get(
        "/firewalls-v2",
        follow_redirects=False,
        headers={"x-gc-navigation-preflight": "1"},
    )
    assert r.status_code == 403


def test_firewalls_v2_inventory_ok_for_designer(designer_client) -> None:
    r = designer_client.get("/firewalls-v2", follow_redirects=False)
    assert r.status_code == 200
    assert b"Firewalls v2" in r.content
    assert b"gc-fw-inv-main-tablist" in r.content


def test_firewalls_v2_inventory_ok_for_superadmin(superadmin_client) -> None:
    r = superadmin_client.get("/firewalls-v2", follow_redirects=False)
    assert r.status_code == 200
    assert b"Firewalls v2" in r.content


def test_firewalls_v2_object_page_ok(designer_client) -> None:
    r = designer_client.get("/firewalls-v2/o/protect/firewall", follow_redirects=False)
    assert r.status_code == 200
    assert b"gc-fw-v2-object-data-table.js" in r.content
    assert b"GC_FW_V2_TABLE_INSTANCE_ID" in r.content
    assert b"fw_v2_o_protect_firewall_firewall-rules" in r.content
    assert b"gc-fw-v2-obj-table-title" in r.content
    assert b"gc-fw-v2-object-page-tabs" in r.content
    assert b"?tab=firewall-rules" in r.content
    assert b"gc-fw-v2-obj-combine" in r.content
    assert b"gc-fw-v2-obj-opt-combine-view" in r.content
    assert b'id="gc-fw-v2-obj-add"' in r.content
    assert b'id="gc-fw-v2-obj-delete-selected"' in r.content
    assert b'id="gc-fw-v2-obj-opt-add-btn"' in r.content
    assert b'id="gc-fw-v2-obj-opt-delete-btn"' in r.content
    assert b"gc-designer-flyout-object-edit-modal" in r.content
    assert b"gc-designer-stack-flyout-runtime.js" in r.content
    assert b"gc-designer-object-edit-catalog.js" in r.content
    assert b"gc-data-controls-object-edit-layout.js" in r.content


def test_api_firewalls_config_ui_entity_payload_fields_ok(authed_client) -> None:
    r = authed_client.get("/api/firewalls/config-ui/entity-payload-fields/zone")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert isinstance(body.get("fields"), list)


def test_api_firewalls_config_ui_data_controls_layout_ok(authed_client) -> None:
    r = authed_client.get("/api/firewalls/config-ui/data-controls-layout/ip_host")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert isinstance(body.get("layout"), dict)


def test_api_firewalls_config_ui_requires_auth(client) -> None:
    r = client.get("/api/firewalls/config-ui/entity-payload-fields/zone")
    assert r.status_code == 401


def test_firewalls_v2_object_page_ok_for_superadmin(superadmin_client) -> None:
    r = superadmin_client.get("/firewalls-v2/o/protect/firewall", follow_redirects=False)
    assert r.status_code == 200
    assert b"gc-fw-v2-object-data-table.js" in r.content


def test_firewalls_v2_allows_legacy_super_admin_spaced_role(secrets_session, client) -> None:
    """role_key() treats spaced spelling like normalize_app_user_role."""
    from app import users_service
    from app.auth import hash_password
    from app.secrets_models import AppUser

    pw = "y" * 12
    users_service.ensure_default_admin_user(secrets_session)
    row = secrets_session.query(AppUser).filter_by(username="legacy-sa").first()
    if row:
        secrets_session.delete(row)
        secrets_session.commit()
    uid = __import__("uuid").uuid4().hex
    secrets_session.add(
        AppUser(
            id=uid,
            username="legacy-sa",
            role="Super Admin",
            password_hash=hash_password(pw),
        )
    )
    secrets_session.commit()
    r = client.post("/api/auth/login", json={"username": "legacy-sa", "password": pw})
    assert r.status_code == 200
    r2 = client.get(
        "/firewalls-v2",
        follow_redirects=False,
        headers={"x-gc-navigation-preflight": "1"},
    )
    assert r2.status_code == 200


def test_firewalls_v2_object_page_settings_tab_no_table_script(designer_client) -> None:
    r = designer_client.get(
        "/firewalls-v2/o/protect/intrusion-prevention?tab=configure",
        follow_redirects=False,
    )
    assert r.status_code == 200
    assert b"gc-fw-v2-object-data-table.js" not in r.content
    assert b"gc-designer-flyout-object-edit-modal" not in r.content
    assert b"gc-fw-v2-object-settings" in r.content
    assert b"dos_settings" in r.content


def test_firewalls_v2_object_page_tab_selects_entity_scope(designer_client) -> None:
    r = designer_client.get(
        "/firewalls-v2/o/protect/intrusion-prevention?tab=policies",
        follow_redirects=False,
    )
    assert r.status_code == 200
    assert b"fw_v2_o_protect_intrusion-prevention_policies" in r.content
    assert b'"ips_policy"' in r.content


def test_firewalls_v2_object_page_unknown_404(designer_client) -> None:
    r = designer_client.get("/firewalls-v2/o/missing/page", follow_redirects=False)
    assert r.status_code == 404


def test_build_firewalls_v2_object_nav_tree_has_sections() -> None:
    from app.designer_entity_type_navigation import build_firewalls_v2_object_nav_tree

    tree = build_firewalls_v2_object_nav_tree()
    assert isinstance(tree, list)
    assert len(tree) >= 1
    sec = tree[0]
    assert "label" in sec and "slug" in sec and "pages" in sec
