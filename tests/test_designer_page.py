"""Designer UI reference page."""

import json
from pathlib import Path

import pytest


def test_designer_requires_auth(client):
    r = client.get("/designer", follow_redirects=False)
    assert r.status_code in (302, 303, 307, 401)


def test_canonical_object_edit_dd_runtime_always_wins():
    """Guard against re-introducing the divergence that broke the Designer
    "Show Edit" flyout member-lookup (no checkboxes + wrong status line like
    "291 object(s) from 1 type request(s).") while Firewalls v2 worked fine.

    The inline `partials/gc_designer_controls_scripts.html` carries a legacy copy
    of the dropdown runtime for the Designer canvas sandbox. Both Firewalls v2
    and Designer must end up using the canonical, flyout-aware implementation
    in `static/gc-designer-object-edit-dd-runtime.js`, which requires:

    1. The canonical file must register its bridge unconditionally (no early
       return when a prior `window.__gcDesignerControlsBridge.ddFieldRuntime`
       already exists — the inline partial always sets one first on Designer
       pages, so an early return would leave the legacy, flyout-oblivious
       implementation in place).
    2. It must install the `gcHsOnFlyoutFirewallSelectionChange` chain hook
       every time (not guarded behind `__gcDesignerMlFwHookChained`), so the
       flyout-aware reload wrapper always runs.
    3. It must contain the flyout-aware helper `isFlyoutMemberLookupRoot` and
       use it inside `applyRowsToList` so the member-lookup in the edit flyout
       gets "N objects selected" rather than the raw rowcount status line.
    """
    src = (
        Path(__file__).resolve().parents[1]
        / "static"
        / "gc-designer-object-edit-dd-runtime.js"
    ).read_text(encoding="utf-8")

    assert "isFlyoutMemberLookupRoot" in src
    assert "formatFlyoutMemberLookupStatusLine" in src
    assert "refreshMemberLookupFlyoutStatus" in src
    assert "flyoutMl = isFlyoutMemberLookupRoot(root)" in src
    assert "if (!flyoutMl) {" in src

    assert (
        "if (window.__gcDesignerControlsBridge && window.__gcDesignerControlsBridge.ddFieldRuntime)"
        not in src
    ), (
        "gc-designer-object-edit-dd-runtime.js must NOT early-return when a "
        "ddFieldRuntime bridge already exists — on Designer pages the inline "
        "legacy runtime registers first and the canonical external runtime "
        "must overwrite it, otherwise the member-lookup flyout behaves "
        "differently from Firewalls v2."
    )

    assert "if (!globalThis.__gcDesignerMlFwHookChained)" not in src, (
        "The flyout FW-selection-change chain hook must be installed "
        "unconditionally; the legacy inline runtime sets the chained flag "
        "before this file runs."
    )
    assert "globalThis.__gcDesignerMlFwHookChained = true;" in src
    assert "globalThis.gcHsOnFlyoutFirewallSelectionChange = function" in src

    assert "window.__gcDesignerControlsBridge.ddFieldRuntime = {" in src
    assert "loadMemberLookupFromCache: loadMemberLookupFromCache," in src


def test_designer_forbidden_for_admin_without_designer_role(authed_client):
    r = authed_client.get("/designer", follow_redirects=False)
    assert r.status_code == 303
    assert r.headers.get("location") == "/"


def test_designer_forbidden_redirect_shows_error_banner(authed_client):
    r = authed_client.get("/designer", follow_redirects=True)
    assert r.status_code == 200
    assert "Designer access required" in r.text
    assert "holdMs: 15000" in r.text


def test_designer_top_nav_hidden_for_non_designer(authed_client):
    r = authed_client.get("/")
    assert r.status_code == 200
    assert 'data-top-nav="designer"' not in r.text


def test_designer_top_nav_visible_for_designer(designer_client):
    r = designer_client.get("/")
    assert r.status_code == 200
    assert 'data-top-nav="designer"' in r.text


def test_designer_ok_when_authed(designer_client):
    r = designer_client.get("/designer", follow_redirects=True)
    assert r.status_code == 200
    assert "/designer/navigation" in str(getattr(r, "url", ""))
    assert "gc-designer-entity-nav-tbody" in r.text
    assert "gc-designer" in r.text


def test_designer_content_page_removed(designer_client):
    r = designer_client.get("/designer/content", follow_redirects=False)
    assert r.status_code == 404


def test_designer_data_controls_page(designer_client):
    r = designer_client.get("/designer/data-controls")
    assert r.status_code == 200
    assert "Data Controls" in r.text
    assert "Field catalog" in r.text
    assert "Layout plans" in r.text
    assert "gc-designer-data-controls-tab-layout" in r.text

    assert "gc-designer-object-edit-dd-runtime.js" in r.text
    idx_inline = r.text.find("partials/gc_designer_controls_scripts.html")
    idx_flyout_bundle = r.text.find("gc-designer-object-edit-dd-runtime.js")
    idx_inline_marker = r.text.find(
        'window.__gcDesignerControlsBridge.ddFieldRuntime = {\n'
        '    loadDesignerDdFromCache: loadDesignerDdFromCache'
    )
    if idx_inline_marker >= 0:
        assert idx_flyout_bundle > idx_inline_marker, (
            "gc-designer-object-edit-dd-runtime.js must be loaded AFTER the inline "
            "dd runtime in gc_designer_controls_scripts.html so the canonical "
            "flyout-aware implementation wins the ddFieldRuntime bridge."
        )
    del idx_inline, idx_flyout_bundle, idx_inline_marker
    assert "gc-designer-data-controls-layout-controls" in r.text
    assert "gc-designer-data-controls-layout-logic" in r.text
    assert "gc-designer-data-controls-layout.js" in r.text
    assert "gc-designer-data-controls-layout-reset" in r.text
    assert "gc-designer-data-controls-layout-add-and" in r.text
    assert "gc-designer-data-controls-layout-add-or" in r.text
    assert "gc-designer-data-controls-layout-add-not" in r.text
    assert "gc-designer-data-controls-layout-add-if-value" in r.text
    assert "gc-designer-data-controls-type" in r.text
    assert 'data-gc-designer-object-selector="object-selector-list-single"' in r.text
    assert "gc-designer-data-controls-entity-nav.js" in r.text
    assert "api/designer/entity-payload-fields" in r.text
    assert "gc-designer-data-controls-field-catalog.js" in r.text
    assert "entity-payload-fields/generate-missing" in r.text
    assert "config-ui/data-controls-layout-locks" in r.text
    assert "gc-designer-data-controls-generate-layout" in r.text
    assert "gc-designer-data-controls-save" in r.text
    assert "gc-designer-data-controls-entry-types" in r.text
    assert "hosts-services/table" in r.text
    assert "gc-designer-flyout-object-edit-modal" in r.text
    assert r.text.count('id="gc-designer-flyout-object-edit-modal"') == 1
    assert "gc-designer-stack-flyout-runtime.js" in r.text
    assert "gc-data-controls-object-edit-layout.js" in r.text
    assert 'href="/designer/navigation"' in r.text
    assert "Hidden" in r.text
    assert "text-single" in r.text
    assert "ip-list" in r.text
    assert "Updated (UTC)" not in r.text

    assert "window.GC_ENTITY_TYPE_NAV_ICONS" in r.text, (
        "Designer · Data Controls must expose the same entity-type → Material-Symbol "
        "map that Firewalls v2 pages expose, so the flyout member-lookup dropdown "
        "renders per-object-type icons (e.g. globe for fqdn_host) identically in "
        "both places. If this fails, gc_object_edit_flyout_scripts.html is no longer "
        "seeding window.GC_ENTITY_TYPE_NAV_ICONS, or _designer_template_context "
        "stopped providing entity_type_nav_icons."
    )


def test_api_designer_entity_payload_fields_generate_missing(designer_client, main_session):
    from app.models import Firewall, FirewallConfigEntry, FirewallConfigEntityPayloadField

    main_session.query(FirewallConfigEntityPayloadField).filter(
        FirewallConfigEntityPayloadField.entity_type == "payload_backfill_t"
    ).delete(synchronize_session=False)
    main_session.commit()

    fw = Firewall(
        name="BackfillLab",
        host="10.0.0.88",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type="payload_backfill_t",
            external_name="one",
            payload_json=json.dumps(
                {
                    "Name": "n",
                    "Description": "d",
                    "Alpha": 1,
                    "Beta": [],
                    "Gamma": {"Delta": True, "Epsilon": {"Zeta": "z"}},
                }
            ),
        )
    )
    main_session.commit()

    r = designer_client.post(
        "/api/designer/entity-payload-fields/generate-missing",
        json={
            "include_firewall_cache": True,
            "include_configuration_cache": False,
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert body.get("entries_scanned") >= 1
    assert body.get("rows_inserted") >= 8
    assert isinstance(body.get("data_entry_types_inferred"), int)

    rows = (
        main_session.query(FirewallConfigEntityPayloadField)
        .filter(FirewallConfigEntityPayloadField.entity_type == "payload_backfill_t")
        .all()
    )
    props = {r.property_name: r.json_value_kind for r in rows}
    dets = {r.property_name: r.data_entry_type for r in rows}
    assert props.get("Alpha") == "integer"
    assert props.get("Beta") == "array"
    assert props.get("Gamma") == "object"
    assert props.get("Gamma.Delta") == "boolean"
    assert props.get("Gamma.Epsilon") == "object"
    assert props.get("Gamma.Epsilon.Zeta") == "string"
    assert dets.get("Name") == "text-single"
    assert dets.get("Description") == "text-multiline"
    assert dets.get("Alpha") is None
    assert dets.get("Beta") == "member-lookup"
    assert dets.get("Gamma") is None
    by_prop = {r.property_name: r for r in rows}
    assert by_prop["Beta"].data_entry_properties is not None
    assert json.loads(by_prop["Beta"].data_entry_properties).get("multi") is True


def test_api_designer_data_controls_layout_roundtrip(
    designer_client, monkeypatch, tmp_path
):
    from app import designer_data_controls_layout as layout_store

    d = tmp_path / "dc_layout_dir"
    monkeypatch.setattr(layout_store, "layout_dir", lambda: d)
    monkeypatch.setattr(
        layout_store, "layout_file_path", lambda: tmp_path / "dc_layout_legacy.json"
    )
    et = "zone"
    r0 = designer_client.get(f"/api/designer/data-controls-layout/{et}")
    assert r0.status_code == 200, r0.text
    j0 = r0.json()
    assert j0.get("ok") is True
    assert j0.get("layout", {}).get("connections") == []
    assert j0.get("layout", {}).get("control_add_only") == {}
    assert j0.get("layout", {}).get("member_lookup_data_source") == {}
    assert j0.get("layout", {}).get("member_lookup_multi") == {}
    assert j0.get("layout", {}).get("layout_locked") is False

    payload = {
        "layout": {
            "node_positions": {
                "field:1": {"x": 33, "y": 44},
                "ctrl:1": {"x": 410, "y": 100},
            },
            "connections": [
                {
                    "source_node_id": "field:1",
                    "source_handle": "address",
                    "target_node_id": "ctrl:1",
                    "target_handle": "address",
                }
            ],
            "logic_nodes": [
                {"id": "logic:and_1", "kind": "gate", "op": "and"},
                {"id": "logic:not_1", "kind": "gate", "op": "not"},
                {
                    "id": "logic:if_1",
                    "kind": "if_value",
                    "op": "and",
                    "true_value": "enabled",
                    "false_value": "disabled",
                },
            ],
            "control_add_only": {"ctrl:1": True, "ctrl:2": False},
            "member_lookup_data_source": {"ctrl:1": "zone", "ctrl:bad": "9bad", "field:1": "x"},
            "member_lookup_multi": {"ctrl:1": "true", "ctrl:2": 0, "field:1": 1},
        }
    }
    r1 = designer_client.put(f"/api/designer/data-controls-layout/{et}", json=payload)
    assert r1.status_code == 200, r1.text
    j1 = r1.json()
    assert j1.get("ok") is True
    assert j1["layout"]["node_positions"]["field:1"]["x"] == 33
    assert len(j1["layout"]["connections"]) == 1
    assert j1["layout"]["logic_nodes"][0]["id"] == "logic:and_1"
    assert j1["layout"]["logic_nodes"][1]["op"] == "not"
    assert j1["layout"]["logic_nodes"][2]["kind"] == "if_value"
    assert j1["layout"]["logic_nodes"][2]["true_value"] == "enabled"
    assert j1["layout"]["control_add_only"]["ctrl:1"] is True
    assert j1["layout"]["control_add_only"]["ctrl:2"] is False
    assert j1["layout"]["member_lookup_data_source"] == {"ctrl:1": "zone"}
    assert j1["layout"]["member_lookup_multi"] == {"ctrl:1": True, "ctrl:2": False}

    r2 = designer_client.get(f"/api/designer/data-controls-layout/{et}")
    assert r2.status_code == 200, r2.text
    j2 = r2.json()
    assert j2["layout"]["node_positions"]["ctrl:1"]["x"] == 410
    assert j2["layout"]["connections"][0]["target_handle"] == "address"
    assert j2["layout"]["logic_nodes"][0]["op"] == "and"
    assert j2["layout"]["logic_nodes"][1]["op"] == "not"
    assert j2["layout"]["logic_nodes"][2]["false_value"] == "disabled"
    assert j2["layout"]["control_add_only"]["ctrl:1"] is True
    assert j2["layout"]["member_lookup_data_source"] == {"ctrl:1": "zone"}
    assert j2["layout"]["member_lookup_multi"] == {"ctrl:1": True, "ctrl:2": False}


def test_api_designer_data_controls_layout_keeps_distinct_edges_same_tuple(
    designer_client, monkeypatch, tmp_path,
):
    """Multiple wires with the same endpoints must not collapse when edge_id differs."""
    from app import designer_data_controls_layout as layout_store

    d = tmp_path / "dc_layout_dup_edges_dir"
    monkeypatch.setattr(layout_store, "layout_dir", lambda: d)
    monkeypatch.setattr(
        layout_store, "layout_file_path", lambda: tmp_path / "dc_layout_dup_legacy.json"
    )
    et = "zone"
    payload = {
        "layout": {
            "connections": [
                {
                    "source_node_id": "field:1",
                    "source_handle": "loaded_value",
                    "target_node_id": "ctrl:1",
                    "target_handle": "selected",
                    "edge_id": "dup_a",
                },
                {
                    "source_node_id": "field:1",
                    "source_handle": "loaded_value",
                    "target_node_id": "ctrl:1",
                    "target_handle": "selected",
                    "edge_id": "dup_b",
                },
            ],
        }
    }
    r1 = designer_client.put(f"/api/designer/data-controls-layout/{et}", json=payload)
    assert r1.status_code == 200, r1.text
    j1 = r1.json()
    assert j1.get("ok") is True
    con = j1["layout"]["connections"]
    assert len(con) == 2
    assert {c.get("edge_id") for c in con} == {"dup_a", "dup_b"}

    r2 = designer_client.get(f"/api/designer/data-controls-layout/{et}")
    assert r2.status_code == 200
    j2 = r2.json()
    assert len(j2["layout"]["connections"]) == 2


def test_api_designer_data_controls_layout_bad_type(designer_client):
    r = designer_client.get("/api/designer/data-controls-layout/9bad")
    assert r.status_code == 400


def test_api_designer_data_controls_layout_locked_put_blocked_and_patch_unlock(
    designer_client, monkeypatch, tmp_path
):
    from app import designer_data_controls_layout as layout_store

    d = tmp_path / "dc_layout_lock_dir"
    monkeypatch.setattr(layout_store, "layout_dir", lambda: d)
    monkeypatch.setattr(
        layout_store, "layout_file_path", lambda: tmp_path / "dc_layout_lock_legacy.json"
    )
    et = "svcgrp"
    r_put0 = designer_client.put(
        f"/api/designer/data-controls-layout/{et}",
        json={"layout": {"node_positions": {"field:1": {"x": 1, "y": 2}}}},
    )
    assert r_put0.status_code == 200, r_put0.text
    r_patch = designer_client.patch(
        f"/api/designer/data-controls-layout/{et}/layout-locked",
        json={"layout_locked": True},
    )
    assert r_patch.status_code == 200, r_patch.text
    assert r_patch.json().get("layout", {}).get("layout_locked") is True
    r_put1 = designer_client.put(
        f"/api/designer/data-controls-layout/{et}",
        json={"layout": {"node_positions": {"field:1": {"x": 9, "y": 9}}}},
    )
    assert r_put1.status_code == 409
    r_patch2 = designer_client.patch(
        f"/api/designer/data-controls-layout/{et}/layout-locked",
        json={"layout_locked": False},
    )
    assert r_patch2.status_code == 200
    r_put2 = designer_client.put(
        f"/api/designer/data-controls-layout/{et}",
        json={"layout": {"node_positions": {"field:1": {"x": 9, "y": 9}}}},
    )
    assert r_put2.status_code == 200
    assert r_put2.json()["layout"]["node_positions"]["field:1"]["x"] == 9


def test_import_legacy_monolith_overwrites_existing_per_entity_layout(monkeypatch, tmp_path):
    """``import_legacy_monolith_to_per_entity_layout_files`` must replace files for keys in the monolith."""
    from app import designer_data_controls_layout as layout_store

    out_dir = tmp_path / "layout_out"
    legacy = tmp_path / "monolith.json"
    monkeypatch.setattr(layout_store, "layout_dir", lambda: out_dir)
    monkeypatch.setattr(layout_store, "layout_file_path", lambda: legacy)
    out_dir.mkdir()
    stale = layout_store.normalize_layout(
        {"node_positions": {"field:1": {"x": 1, "y": 2}}, "connections": []}
    )
    (out_dir / "zone.json").write_text(json.dumps(stale) + "\n", encoding="utf-8")
    monolith = {
        "version": 1,
        "entity_types": {
            "zone": {
                "node_positions": {"field:99": {"x": 9, "y": 9}},
                "connections": [],
            }
        },
    }
    legacy.write_text(json.dumps(monolith), encoding="utf-8")
    r = layout_store.import_legacy_monolith_to_per_entity_layout_files(
        legacy, delete_legacy=True
    )
    assert r.get("ok") is True
    assert "zone" in r["written"]
    z = json.loads((out_dir / "zone.json").read_text(encoding="utf-8"))
    assert z["node_positions"]["field:99"]["x"] == 9
    assert "field:1" not in z.get("node_positions", {})


def test_api_designer_entity_payload_fields_generate_missing_infers_unset_existing(
    designer_client, main_session,
):
    from app.models import FirewallConfigEntityPayloadField

    et = "payload_infer_unset_t"
    main_session.query(FirewallConfigEntityPayloadField).filter(
        FirewallConfigEntityPayloadField.entity_type == et,
    ).delete(synchronize_session=False)
    main_session.commit()
    main_session.add(
        FirewallConfigEntityPayloadField(
            entity_type=et,
            property_name="Name",
            json_value_kind="string",
            data_entry_type=None,
        )
    )
    main_session.commit()

    r = designer_client.post(
        "/api/designer/entity-payload-fields/generate-missing",
        json={"include_firewall_cache": True, "include_configuration_cache": False},
    )
    assert r.status_code == 200, r.text
    assert r.json().get("data_entry_types_inferred", 0) >= 1
    row = (
        main_session.query(FirewallConfigEntityPayloadField)
        .filter(
            FirewallConfigEntityPayloadField.entity_type == et,
            FirewallConfigEntityPayloadField.property_name == "Name",
        )
        .one()
    )
    assert row.data_entry_type == "text-single"


def test_api_designer_entity_payload_fields_generate_missing_does_not_update_existing(
    designer_client, main_session,
):
    from app.models import Firewall, FirewallConfigEntry, FirewallConfigEntityPayloadField

    main_session.query(FirewallConfigEntityPayloadField).filter(
        FirewallConfigEntityPayloadField.entity_type == "payload_keep_kind_t"
    ).delete(synchronize_session=False)
    main_session.commit()

    main_session.add(
        FirewallConfigEntityPayloadField(
            entity_type="payload_keep_kind_t",
            property_name="X",
            json_value_kind="string",
        )
    )
    fw = Firewall(
        name="KeepKindLab",
        host="10.0.0.89",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type="payload_keep_kind_t",
            external_name="e1",
            payload_json=json.dumps({"X": 99}),
        )
    )
    main_session.commit()

    r = designer_client.post(
        "/api/designer/entity-payload-fields/generate-missing",
        json={"include_firewall_cache": True, "include_configuration_cache": False},
    )
    assert r.status_code == 200, r.text
    row = (
        main_session.query(FirewallConfigEntityPayloadField)
        .filter(
            FirewallConfigEntityPayloadField.entity_type == "payload_keep_kind_t",
            FirewallConfigEntityPayloadField.property_name == "X",
        )
        .one()
    )
    assert row.json_value_kind == "string"


def test_api_designer_entity_payload_fields_generate_missing_forbidden(
    authed_client, secrets_session,
):
    from app.secrets_models import DEFAULT_ADMIN_USERNAME, AppUser

    row = secrets_session.query(AppUser).filter_by(username=DEFAULT_ADMIN_USERNAME).one()
    row.role = "admin"
    secrets_session.commit()
    r = authed_client.post(
        "/api/designer/entity-payload-fields/generate-missing",
        json={},
    )
    assert r.status_code == 403


def test_api_designer_entity_payload_fields_generate_missing_no_sources(designer_client):
    r = designer_client.post(
        "/api/designer/entity-payload-fields/generate-missing",
        json={
            "include_firewall_cache": False,
            "include_configuration_cache": False,
        },
    )
    assert r.status_code == 400


def test_api_designer_entity_payload_fields(designer_client, main_session):
    from app.models import FirewallConfigEntityPayloadField

    exists = (
        main_session.query(FirewallConfigEntityPayloadField)
        .filter(
            FirewallConfigEntityPayloadField.entity_type == "zone",
            FirewallConfigEntityPayloadField.property_name == "Name",
        )
        .one_or_none()
    )
    if exists is None:
        main_session.add(
            FirewallConfigEntityPayloadField(
                entity_type="zone",
                property_name="Name",
                json_value_kind="string",
            )
        )
        main_session.commit()
    r = designer_client.get("/api/designer/entity-payload-fields/zone")
    assert r.status_code == 200
    j = r.json()
    assert j.get("ok") is True
    assert j.get("entity_type") == "zone"
    names = [f["property_name"] for f in j.get("fields", [])]
    assert "Name" in names
    row_payload = next(x for x in j["fields"] if x["property_name"] == "Name")
    assert row_payload.get("allowed_options") is None


def test_api_designer_entity_payload_fields_hidden_rows_sort_last(
    designer_client, main_session,
):
    from app.models import FirewallConfigEntityPayloadField

    et = "sort_hidden_t"
    main_session.query(FirewallConfigEntityPayloadField).filter(
        FirewallConfigEntityPayloadField.entity_type == et,
    ).delete(synchronize_session=False)
    main_session.commit()
    main_session.add_all(
        [
            FirewallConfigEntityPayloadField(
                entity_type=et,
                property_name="ZHiddenLowOrder",
                json_value_kind="string",
                data_entry_type="hidden",
                display_order=1,
            ),
            FirewallConfigEntityPayloadField(
                entity_type=et,
                property_name="AVisible",
                json_value_kind="string",
                data_entry_type="text-single",
                display_order=3,
            ),
            FirewallConfigEntityPayloadField(
                entity_type=et,
                property_name="BVisible",
                json_value_kind="string",
                data_entry_type=None,
                display_order=2,
            ),
            FirewallConfigEntityPayloadField(
                entity_type=et,
                property_name="YHiddenUpperCase",
                json_value_kind="string",
                data_entry_type="Hidden",
                display_order=2,
            ),
        ]
    )
    main_session.commit()

    r = designer_client.get(f"/api/designer/entity-payload-fields/{et}")
    assert r.status_code == 200
    names = [f["property_name"] for f in r.json()["fields"]]
    assert names == [
        "BVisible",
        "AVisible",
        "ZHiddenLowOrder",
        "YHiddenUpperCase",
    ]


def test_api_designer_entity_payload_fields_data_source_roundtrip(
    designer_client, main_session,
):
    from app.models import FirewallConfigEntityPayloadField

    et = "ds_src_t"
    main_session.query(FirewallConfigEntityPayloadField).filter(
        FirewallConfigEntityPayloadField.entity_type == et,
    ).delete(synchronize_session=False)
    main_session.commit()
    row = FirewallConfigEntityPayloadField(
        entity_type=et,
        property_name="Ref",
        json_value_kind="string",
        data_source_entity_types='["service","ip_host"]',
    )
    main_session.add(row)
    main_session.commit()
    rid = row.id

    r = designer_client.get(f"/api/designer/entity-payload-fields/{et}")
    assert r.status_code == 200
    f0 = next(x for x in r.json()["fields"] if x["property_name"] == "Ref")
    assert f0.get("data_source_entity_types") == ["service", "ip_host"]

    r2 = designer_client.put(
        f"/api/designer/entity-payload-fields/{et}",
        json={"updates": [{"id": rid, "data_source_entity_types": ["zone", "vlan"]}]},
    )
    assert r2.status_code == 200, r2.text
    main_session.refresh(row)
    assert json.loads(row.data_source_entity_types) == ["zone", "vlan"]

    r3 = designer_client.put(
        f"/api/designer/entity-payload-fields/{et}",
        json={"updates": [{"id": rid, "data_source_entity_types": None}]},
    )
    assert r3.status_code == 200, r3.text
    main_session.refresh(row)
    assert row.data_source_entity_types is None


def test_api_designer_config_cache_cached_object_names(designer_client, main_session):
    from app.models import Firewall, FirewallConfigEntry

    fw = Firewall(
        name="Lab",
        host="10.0.0.1",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.flush()
    main_session.add_all(
        [
            FirewallConfigEntry(
                firewall_id=fw.id,
                entity_type="zone",
                external_name="Zebra",
                payload_json="{}",
            ),
            FirewallConfigEntry(
                firewall_id=fw.id,
                entity_type="zone",
                external_name="Alpha",
                payload_json="{}",
            ),
        ]
    )
    main_session.commit()

    r = designer_client.post(
        "/api/designer/config-cache/cached-object-names",
        json={"firewall_ids": [fw.id], "entity_types": ["zone"]},
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("ok") is True
    assert j["names_by_type"]["zone"] == ["Alpha", "Zebra"]


def test_api_designer_entity_payload_fields_allowed_options_roundtrip(
    designer_client, main_session,
):
    from app.models import FirewallConfigEntityPayloadField

    et = "sel_opts_t"
    main_session.query(FirewallConfigEntityPayloadField).filter(
        FirewallConfigEntityPayloadField.entity_type == et,
    ).delete(synchronize_session=False)
    main_session.commit()
    row = FirewallConfigEntityPayloadField(
        entity_type=et,
        property_name="Mode",
        json_value_kind="string",
        data_entry_type="selector",
        allowed_options='["Low","High"]',
    )
    main_session.add(row)
    main_session.commit()
    rid = row.id

    r = designer_client.get(f"/api/designer/entity-payload-fields/{et}")
    assert r.status_code == 200
    j = r.json()
    f0 = next(x for x in j["fields"] if x["property_name"] == "Mode")
    assert f0.get("allowed_options") == ["Low", "High"]

    r2 = designer_client.put(
        f"/api/designer/entity-payload-fields/{et}",
        json={"updates": [{"id": rid, "allowed_options": ["A", "B", "C"]}]},
    )
    assert r2.status_code == 200, r2.text
    main_session.refresh(row)
    assert json.loads(row.allowed_options) == ["A", "B", "C"]

    r3 = designer_client.put(
        f"/api/designer/entity-payload-fields/{et}",
        json={"updates": [{"id": rid, "allowed_options": None}]},
    )
    assert r3.status_code == 200, r3.text
    main_session.refresh(row)
    assert row.allowed_options is None


def test_api_designer_entity_payload_fields_forbidden(authed_client, secrets_session):
    from app.secrets_models import DEFAULT_ADMIN_USERNAME, AppUser

    row = secrets_session.query(AppUser).filter_by(username=DEFAULT_ADMIN_USERNAME).one()
    row.role = "admin"
    secrets_session.commit()
    r = authed_client.get("/api/designer/entity-payload-fields/zone")
    assert r.status_code == 403


def test_api_designer_entity_payload_fields_bad_type(designer_client):
    r = designer_client.get("/api/designer/entity-payload-fields/9bad")
    assert r.status_code == 400


def test_api_designer_named_control_ids(designer_client):
    r = designer_client.get("/api/designer/named-control-ids")
    assert r.status_code == 200
    j = r.json()
    assert j.get("ok") is True
    ids = j.get("control_ids")
    assert isinstance(ids, list)
    assert "text-single" in ids
    assert "dropdown-multi" in ids
    assert "ip-address" in ids
    assert "ip-list" in ids
    assert "toggle-onoff" in ids
    assert "toggle-checkbox" in ids
    assert "ip-ipv4" not in ids
    assert "ip-ipv6" not in ids
    assert ids == sorted(ids)


def test_api_designer_entity_payload_fields_bulk_update(designer_client, main_session):
    from app.models import FirewallConfigEntityPayloadField

    et = "bulk_save_t"
    main_session.query(FirewallConfigEntityPayloadField).filter(
        FirewallConfigEntityPayloadField.entity_type == et,
    ).delete(synchronize_session=False)
    main_session.commit()
    row = FirewallConfigEntityPayloadField(
        entity_type=et,
        property_name="SaveMe",
        json_value_kind="string",
    )
    main_session.add(row)
    main_session.commit()
    rid = row.id

    r = designer_client.put(
        f"/api/designer/entity-payload-fields/{et}",
        json={
            "updates": [
                {
                    "id": rid,
                    "dependent_on": "Other",
                    "data_entry_type": "text-single",
                    "data_entry_properties": '{"a": 1}',
                    "show_as": "Label",
                    "help_text": "Line one\nLine two",
                    "display_order": 2,
                }
            ]
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert body.get("updated") == 1
    main_session.refresh(row)
    assert row.dependent_on == "Other"
    assert row.data_entry_type == "text-single"
    assert row.data_entry_properties == '{"a": 1}'
    assert row.show_as == "Label"
    assert row.display_order == 2
    assert row.help_text == "Line one\nLine two"


def test_api_designer_entity_payload_fields_bulk_update_hidden_type(
    designer_client, main_session,
):
    from app.models import FirewallConfigEntityPayloadField

    et = "bulk_hidden_t"
    main_session.query(FirewallConfigEntityPayloadField).filter(
        FirewallConfigEntityPayloadField.entity_type == et,
    ).delete(synchronize_session=False)
    main_session.commit()
    row = FirewallConfigEntityPayloadField(
        entity_type=et,
        property_name="H",
        json_value_kind="string",
    )
    main_session.add(row)
    main_session.commit()
    rid = row.id

    r = designer_client.put(
        f"/api/designer/entity-payload-fields/{et}",
        json={"updates": [{"id": rid, "data_entry_type": "Hidden"}]},
    )
    assert r.status_code == 200, r.text
    main_session.refresh(row)
    assert row.data_entry_type == "Hidden"


def test_api_designer_entity_payload_fields_bulk_update_clears_fields(
    designer_client, main_session,
):
    from app.models import FirewallConfigEntityPayloadField

    et = "bulk_clear_t"
    main_session.query(FirewallConfigEntityPayloadField).filter(
        FirewallConfigEntityPayloadField.entity_type == et,
    ).delete(synchronize_session=False)
    main_session.commit()
    row = FirewallConfigEntityPayloadField(
        entity_type=et,
        property_name="ClearMe",
        json_value_kind="string",
        dependent_on="X",
        data_entry_type="text-single",
        data_entry_properties="{}",
    )
    main_session.add(row)
    main_session.commit()
    rid = row.id

    r = designer_client.put(
        f"/api/designer/entity-payload-fields/{et}",
        json={
            "updates": [
                {
                    "id": rid,
                    "dependent_on": None,
                    "data_entry_type": None,
                    "data_entry_properties": None,
                }
            ]
        },
    )
    assert r.status_code == 200, r.text
    main_session.refresh(row)
    assert row.dependent_on is None
    assert row.data_entry_type is None
    assert row.data_entry_properties is None


def test_api_designer_entity_payload_fields_bulk_update_bad_entry_type(
    designer_client, main_session,
):
    from app.models import FirewallConfigEntityPayloadField

    et = "bulk_bad_t"
    main_session.query(FirewallConfigEntityPayloadField).filter(
        FirewallConfigEntityPayloadField.entity_type == et,
    ).delete(synchronize_session=False)
    main_session.commit()
    row = FirewallConfigEntityPayloadField(
        entity_type=et,
        property_name="BadDet",
        json_value_kind="string",
    )
    main_session.add(row)
    main_session.commit()
    rid = row.id

    r = designer_client.put(
        f"/api/designer/entity-payload-fields/{et}",
        json={
            "updates": [
                {
                    "id": rid,
                    "data_entry_type": "not-a-real-control",
                }
            ]
        },
    )
    assert r.status_code == 400


def test_api_designer_entity_payload_fields_bulk_update_wrong_entity_type(
    designer_client, main_session,
):
    from app.models import FirewallConfigEntityPayloadField

    et = "bulk_scope_t"
    main_session.query(FirewallConfigEntityPayloadField).filter(
        FirewallConfigEntityPayloadField.entity_type == et,
    ).delete(synchronize_session=False)
    main_session.commit()
    row = FirewallConfigEntityPayloadField(
        entity_type=et,
        property_name="ZOnly",
        json_value_kind="string",
    )
    main_session.add(row)
    main_session.commit()
    rid = row.id

    r = designer_client.put(
        "/api/designer/entity-payload-fields/interface",
        json={"updates": [{"id": rid, "data_entry_type": "text-single"}]},
    )
    assert r.status_code == 404


def test_api_designer_entity_payload_fields_bulk_update_empty(designer_client):
    r = designer_client.put("/api/designer/entity-payload-fields/zone", json={"updates": []})
    assert r.status_code == 200
    assert r.json().get("updated") == 0


def test_designer_navigation_page(designer_client):
    r = designer_client.get("/designer/navigation")
    assert r.status_code == 200
    assert 'href="/designer/content"' not in r.text
    assert r.text.find('href="/designer/data-controls"') < r.text.find('href="/designer/modals"')
    assert "Navigation" in r.text
    assert "Object Navigation" in r.text
    assert "gc-designer-entity-nav-tbody" in r.text
    assert "gc-designer-data-controls-entity-nav.js" in r.text
    assert "designer_entity_type_navigation.json" in r.text
    assert "Object selector" in r.text
    assert 'id="gc-designer-entity-nav-object-selector"' in r.text
    assert 'id="gc-designer-entity-nav-object-selector-list"' in r.text
    assert 'data-gc-designer-object-selector="object-selector"' in r.text
    assert 'data-gc-designer-object-selector="object-selector-list"' in r.text
    assert "data-gc-no-sort>Type</th>" in r.text


def test_designer_controls_page(designer_client):
    r = designer_client.get("/designer/controls")
    assert r.status_code == 200
    assert "Controls" in r.text
    assert "gc-designer-controls-ipv4" in r.text
    assert "gc-designer-controls-ipv6" in r.text
    assert 'data-gc-designer-control-id="ip-address"' in r.text
    assert 'data-gc-designer-control-id="ip-list"' in r.text
    assert "gc-designer-ip-family" in r.text
    assert "gc-designer-ip-constraint-panel" in r.text
    assert "data-gc-ip-within-cidr" in r.text
    assert "data-gc-ip-cidr-prefix-min" in r.text
    assert "data-gc-ip-require-value-cidr" in r.text
    assert "data-gc-ip-network-address" in r.text
    assert "gc-ip-field__mask-pill" in r.text
    assert "gc-ip-field" in r.text
    assert "gc-designer-ipv4-constraints" in r.text
    assert "gc-ip-correct-preview" in r.text
    assert "dotted IPv4 address" in r.text
    assert "valid IPv6 address" in r.text
    assert "Must be CIDR Network" in r.text
    assert "Interface Address" in r.text
    assert "gc-designer-text-panel" in r.text
    assert "gc-designer-text-single" in r.text
    assert "gc-designer-text-multi" in r.text
    assert "gc-designer-text-charset" in r.text
    assert "data-gc-text-charset" in r.text
    assert 'data-gc-designer-control-id="toggle-onoff"' in r.text
    assert 'data-gc-designer-control-id="toggle-checkbox"' in r.text
    assert 'id="gc-designer-toggle-onoff"' in r.text
    assert 'id="gc-designer-toggle-checkbox"' in r.text
    assert "gc-designer-dd-show-search" in r.text
    assert "gc-designer-dd-single-search" in r.text
    assert "gc-designer-dd-multi-search" in r.text
    assert "gc-designer-dd-single-panel" in r.text
    assert "gc-designer-dd-multi-panel" in r.text
    assert "data-gc-dd-scope" in r.text
    assert "data-gc-dd-entity-type" in r.text
    assert "data-gc-dd-list-col" in r.text
    assert "gc-designer-dd-single-refresh" in r.text
    assert "gc-designer-dd-multi-refresh" in r.text
    assert "/api/firewalls/hosts-services/table" in r.text
    assert "gc-designer-tag-editor" in r.text
    assert "gc-designer-tag-editor-b" in r.text
    assert "gc-designer-tags-save" in r.text
    assert "gc-designer-tags__hidden" in r.text
    assert "gc-designer-tags-hidden-b" in r.text
    assert "gc-designer-tags__suggest" in r.text
    assert "gc-designer-tags-input-a" in r.text
    assert "gc-designer-tags-input-b" in r.text
    assert "gc-designer__control-id" in r.text
    assert "data-gc-designer-control-id" in r.text
    assert "ip-constraint" in r.text
    assert "dropdown-single" in r.text
    assert "member-lookup" in r.text
    assert "gc-designer-member-lookup-props-flyout" in r.text
    assert "gcOpenMemberLookupPropertiesFlyout" in r.text
    assert r.text.count('data-gc-designer-control-id="tag-editor"') == 2
    assert "gc-option-selector" in r.text
    assert "data-gc-option-selector" in r.text
    assert "data-gc-designer-selector-items" in r.text
    assert "gc-designer-selector-props-flyout" in r.text
    assert "gc-designer-selector-control-label" in r.text
    assert r.text.count('data-gc-designer-control-id="selector"') == 1


def test_designer_modals_page(designer_client):
    r = designer_client.get("/designer/modals")
    assert r.status_code == 200
    assert "Modals" in r.text
    assert "Dialogs" in r.text
    assert "gc-designer-dialog-modal" in r.text
    assert "view-flyout" in r.text
    assert "gc-designer-modals-prop-view-flyout-title" in r.text
    assert "gc-designer-modals-prop-edit-flyout-title" in r.text
    assert "object-edit-flyout" in r.text
    assert "gc-designer-flyout-object-edit-modal" in r.text
    assert "data-fw-inventory-scope" in r.text
    assert "global-selected" in r.text
    assert "gc-hs-ip-host-flyout__fw-search" in r.text
    assert "gc-designer-object-edit-catalog-fields" in r.text
    assert "gc-data-controls-object-edit-layout.js" in r.text
    assert "gc-designer-object-edit-catalog.js" in r.text
    assert "gcDesignerHydrateObjectEditCatalogFields" in r.text
    assert "gcDesignerCatalogNotifyFlyoutSave" in r.text
    assert "gc-hosts-services-flyout.js" in r.text
    assert "api/designer/modal-properties" in r.text
    assert "persistent-banner" in r.text
    assert "Banners" in r.text
    assert "gc-designer-demo-banner-host" in r.text
    assert "gc-designer-banner-more-popover" in r.text
    assert "gc-designer-demo-banner-persistent-progress" in r.text
    assert "gc-designer-demo-banner-finish-persistent" in r.text
    assert "gc-designer-flyout-edit-secondary" in r.text
    assert "gc-designer-flyout-edit-primary-skeleton" in r.text
    assert "gc-designer-modals-option-selector" in r.text
    assert "gc-designer-modals-selector-props-flyout" in r.text
    assert "gc-designer-modals-selector-control-label" in r.text
    assert "data-gc-designer-selector-items" in r.text


def test_designer_tables_page(designer_client):
    r = designer_client.get("/designer/tables")
    assert r.status_code == 200
    assert "Tables" in r.text
    assert "gc-designer-tables" in r.text
    assert "Cached object types" in r.text
    assert "Secondary filters" in r.text
    assert "gc-designer-tables-secondary-filters-tbody" in r.text
    assert "Add filter row" in r.text
    assert "Preview table options" in r.text
    assert "gc-designer-tables-opt-row-selectors" in r.text
    assert "data-gc-designer-design-mode-eligible" in r.text
    assert "gc-designer-tables-head-end" in r.text
    assert "Column order" in r.text
    assert "Column name overrides" in r.text
    assert "Hide columns" in r.text
    assert "config-cache/distinct-entity-types" in r.text
    assert "gcCreateNetworkEntityTable" in r.text
    assert "getTablePropertiesJson" in r.text
    assert "setTablePropertiesJson" in r.text
    assert 'data-gc-designer-control-id="data-table"' in r.text
    assert "fetchTablePayload" in r.text
    assert "gc-designer-tables-props-flyout" in r.text
    assert "gc-designer-tables-props-flyout-open-section" in r.text
    assert "gc-designer-tables-props-flyout-save" in r.text
    assert "gc-designer-tables-props-flyout-cancel" in r.text
    assert "GC_DESIGNER_TABLE_INSTANCE_ID" in r.text
    assert "gc-designer-tables-prop-title" in r.text
    assert "gc-designer-tables-table-title" in r.text
    assert "api/designer/table-properties" in r.text
    assert "gc-designer-tables-leave-guard" in r.text
