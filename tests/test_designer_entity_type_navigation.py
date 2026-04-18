"""Designer entity type navigation JSON + API."""

import json

import pytest

from app.designer_entity_type_navigation import (
    build_firewalls_v2_object_nav_tree,
    entity_type_nav_icons_map,
    get_navigation_entries,
    list_object_entity_types_for_nav_page,
    list_object_entity_types_for_nav_tab,
    list_settings_entities_for_nav_tab,
    save_navigation_entries,
)


def test_entity_type_nav_icons_map(tmp_path, monkeypatch) -> None:
    from app import designer_entity_type_navigation as mod

    monkeypatch.setattr(mod, "properties_file_path", lambda: tmp_path / "nav.json")
    p = tmp_path / "nav.json"
    p.write_text(
        json.dumps(
            {
                "version": 1,
                "entries": {
                    "zone": {
                        "display_name": "Z",
                        "nav_section": "s",
                        "nav_page": "p",
                        "tab": "t",
                        "nav_icon": "shield",
                    },
                    "bare": {
                        "display_name": "B",
                        "nav_section": "s",
                        "nav_page": "p",
                        "tab": "t2",
                        "nav_icon": "",
                    },
                },
            },
        ),
        encoding="utf-8",
    )
    m = entity_type_nav_icons_map()
    assert m.get("zone") == "shield"
    assert "bare" not in m


def test_get_navigation_entries_filters_invalid_keys(tmp_path, monkeypatch) -> None:
    from app import designer_entity_type_navigation as mod

    monkeypatch.setattr(mod, "properties_file_path", lambda: tmp_path / "nav.json")
    p = tmp_path / "nav.json"
    p.write_text(
        json.dumps(
            {
                "version": 1,
                "entries": {
                    "good_type": {
                        "display_name": " X ",
                        "nav_section": "s",
                        "nav_page": "p",
                        "tab": "t",
                    },
                    "bad space": {"display_name": "nope"},
                    "": {"display_name": "x"},
                },
            },
        ),
        encoding="utf-8",
    )
    got = get_navigation_entries()
    assert "good_type" in got["entries"]
    assert got["entries"]["good_type"]["display_name"] == "X"
    assert got["entries"]["good_type"]["kind"] == "Objects"
    assert "bad space" not in got["entries"]


def test_list_object_entity_types_for_nav_page_filters_kind_and_page() -> None:
    entries = {
        "a": {"kind": "Objects", "nav_section": "S", "nav_page": "P", "tab": "t1"},
        "b": {"kind": "Settings", "nav_section": "S", "nav_page": "P", "tab": "t1"},
        "c": {"kind": "Objects", "nav_section": "S", "nav_page": "Other", "tab": "t1"},
    }
    got = list_object_entity_types_for_nav_page(
        entries=entries, section_key="s", page_key="p"
    )
    assert got == ["a"]


def test_list_object_entity_types_for_nav_tab_filters_tab() -> None:
    entries = {
        "a": {"kind": "Objects", "nav_section": "S", "nav_page": "P", "tab": "Alpha"},
        "b": {"kind": "Objects", "nav_section": "S", "nav_page": "P", "tab": "Beta"},
        "c": {"kind": "Settings", "nav_section": "S", "nav_page": "P", "tab": "Alpha"},
    }
    assert list_object_entity_types_for_nav_tab(
        entries=entries, section_key="s", page_key="p", tab_label="alpha"
    ) == ["a"]
    assert list_object_entity_types_for_nav_tab(
        entries=entries, section_key="s", page_key="p", tab_label="beta"
    ) == ["b"]


def test_list_settings_entities_for_nav_tab() -> None:
    entries = {
        "s1": {
            "kind": "Settings",
            "display_name": "Zed",
            "nav_section": "S",
            "nav_page": "P",
            "tab": "T",
        },
        "s2": {
            "kind": "Settings",
            "display_name": "Alpha",
            "nav_section": "S",
            "nav_page": "P",
            "tab": "T",
        },
    }
    got = list_settings_entities_for_nav_tab(
        entries=entries, section_key="s", page_key="p", tab_label="t"
    )
    assert got == [("s2", "Alpha"), ("s1", "Zed")]


def test_save_navigation_entries_rejects_bad_entity_key() -> None:
    with pytest.raises(ValueError, match="Invalid entity_type"):
        save_navigation_entries(
            {
                "entries": {
                    "9bad": {
                        "kind": "Objects",
                        "display_name": "x",
                        "nav_section": "",
                        "nav_page": "",
                        "tab": "",
                    }
                }
            },
        )


def test_save_navigation_entries_orders_keys_by_nav_section_page_tab(
    tmp_path, monkeypatch
) -> None:
    from app import designer_entity_type_navigation as mod

    monkeypatch.setattr(mod, "properties_file_path", lambda: tmp_path / "nav_order.json")
    out = save_navigation_entries(
        {
            "entries": {
                "zebra": {
                    "kind": "Objects",
                    "display_name": "",
                    "nav_section": "B",
                    "nav_order": "1",
                    "nav_page": "p1",
                    "tab": "",
                },
                "alpha": {
                    "kind": "Objects",
                    "display_name": "",
                    "nav_section": "A",
                    "nav_order": "1",
                    "nav_page": "p1",
                    "tab": "",
                },
                "mid": {
                    "kind": "Objects",
                    "display_name": "",
                    "nav_section": "A",
                    "nav_order": "2",
                    "nav_page": "p1",
                    "tab": "",
                },
            }
        }
    )
    assert list(out["entries"].keys()) == ["alpha", "mid", "zebra"]


def test_save_navigation_entries_normalizes_kind(tmp_path, monkeypatch) -> None:
    from app import designer_entity_type_navigation as mod

    monkeypatch.setattr(mod, "properties_file_path", lambda: tmp_path / "k.json")
    out = save_navigation_entries(
        {
            "entries": {
                "zone": {
                    "kind": "settings",
                    "display_name": "",
                    "nav_section": "",
                    "nav_order": "",
                    "nav_page": "",
                    "tab": "",
                }
            }
        }
    )
    assert out["entries"]["zone"]["kind"] == "Settings"


def test_api_designer_entity_type_navigation_forbidden(authed_client, secrets_session) -> None:
    from app.secrets_models import DEFAULT_ADMIN_USERNAME, AppUser

    row = secrets_session.query(AppUser).filter_by(username=DEFAULT_ADMIN_USERNAME).one()
    row.role = "admin"
    secrets_session.commit()
    r = authed_client.get("/api/designer/entity-type-navigation")
    assert r.status_code == 403


def test_api_designer_entity_type_navigation_get_put(designer_client, tmp_path, monkeypatch) -> None:
    from app import designer_entity_type_navigation as mod

    monkeypatch.setattr(mod, "properties_file_path", lambda: tmp_path / "designer_entity_type_navigation.json")

    r = designer_client.get("/api/designer/entity-type-navigation")
    assert r.status_code == 200
    j = r.json()
    assert j.get("ok") is True
    assert j.get("version") == 1
    assert j.get("entries") == {}
    assert "facet_orders" in j
    assert j["facet_orders"].get("sections") == []
    assert j["facet_orders"].get("pagesBySection") == {}
    assert j["facet_orders"].get("tabsBySectionPage") == {}
    assert j.get("page_icons") == {}

    r2 = designer_client.put(
        "/api/designer/entity-type-navigation",
        json={
            "entries": {
                "ip_host": {
                    "kind": "Objects",
                    "display_name": " IP Host ",
                    "nav_section": "Network",
                    "nav_order": "0",
                    "nav_page": "Hosts & Services",
                    "tab": "IP Hosts",
                    "nav_icon": "dns",
                }
            },
            "page_icons": {
                "network|hosts & services": {
                    "nav_section": "Network",
                    "nav_page": "Hosts & Services",
                    "icon": "shield",
                    "hidden": True,
                }
            },
        },
    )
    assert r2.status_code == 200
    b2 = r2.json()
    assert b2.get("ok") is True
    assert b2["entries"]["ip_host"]["display_name"] == "IP Host"
    assert b2["entries"]["ip_host"]["nav_order"] == "0"
    assert b2["entries"]["ip_host"]["kind"] == "Objects"
    assert b2["entries"]["ip_host"]["nav_icon"] == "dns"
    assert b2["page_icons"]["network|hosts & services"]["icon"] == "shield"
    assert b2["page_icons"]["network|hosts & services"]["hidden"] is True

    r3 = designer_client.get("/api/designer/entity-type-navigation")
    j3 = r3.json()
    assert j3["entries"]["ip_host"]["nav_page"] == "Hosts & Services"
    assert "facet_orders" in j3
    assert isinstance(j3["facet_orders"].get("sections"), list)
    assert j3["page_icons"]["network|hosts & services"]["icon"] == "shield"
    assert j3["page_icons"]["network|hosts & services"]["hidden"] is True


def test_build_firewalls_v2_object_nav_tree_includes_page_icon(tmp_path, monkeypatch) -> None:
    from app import designer_entity_type_navigation as mod

    monkeypatch.setattr(mod, "properties_file_path", lambda: tmp_path / "nav_icon_tree.json")
    save_navigation_entries(
        {
            "entries": {
                "zone": {
                    "kind": "Objects",
                    "display_name": "Zone",
                    "nav_section": "Protect",
                    "nav_order": "1",
                    "nav_page": "Firewall",
                    "tab": "Rules",
                }
            },
            "page_icons": {
                "protect|firewall": {
                    "nav_section": "Protect",
                    "nav_page": "Firewall",
                    "icon": "shield",
                }
            },
        }
    )

    tree = build_firewalls_v2_object_nav_tree()
    assert tree
    first_page = tree[0]["pages"][0]
    assert first_page["icon"] == "shield"


def test_build_firewalls_v2_object_nav_tree_skips_hidden_page(tmp_path, monkeypatch) -> None:
    from app import designer_entity_type_navigation as mod

    monkeypatch.setattr(mod, "properties_file_path", lambda: tmp_path / "nav_hidden_tree.json")
    save_navigation_entries(
        {
            "entries": {
                "zone": {
                    "kind": "Objects",
                    "display_name": "Zone",
                    "nav_section": "Protect",
                    "nav_order": "1",
                    "nav_page": "Firewall",
                    "tab": "Rules",
                },
                "addr": {
                    "kind": "Objects",
                    "display_name": "Address",
                    "nav_section": "Protect",
                    "nav_order": "2",
                    "nav_page": "Address",
                    "tab": "Objects",
                },
            },
            "page_icons": {
                "protect|firewall": {
                    "nav_section": "Protect",
                    "nav_page": "Firewall",
                    "icon": "shield",
                    "hidden": True,
                },
                "protect|address": {
                    "nav_section": "Protect",
                    "nav_page": "Address",
                    "icon": "dns",
                    "hidden": False,
                },
            },
        }
    )

    tree = build_firewalls_v2_object_nav_tree()
    assert tree
    pages = tree[0]["pages"]
    page_labels = [p["label"] for p in pages]
    assert "Firewall" not in page_labels
    assert "Address" in page_labels


def test_real_navigation_data_includes_new_entity_types() -> None:
    """The shipped designer navigation JSON must register all five new entities."""
    from app import designer_entity_type_navigation as mod

    p = mod.properties_file_path()
    assert p.exists(), f"Missing designer navigation file: {p}"
    raw = json.loads(p.read_text(encoding="utf-8"))
    entries = raw.get("entries") or {}

    expected = {
        "unicast_route": ("CONFIGURE", "Routing", "Unicast Routes"),
        "gateway": ("CONFIGURE", "Routing", "Gateways"),
        "gateway_host": ("CONFIGURE", "Routing", "Custom Gateways"),
        "clientless_user": ("CONFIGURE", "Authentication", "Clientless Users"),
        "acl_rule": ("SYSTEM", "Administration", "Local Service ACL"),
    }
    for et, (section, page, tab) in expected.items():
        assert et in entries, f"Navigation entry missing for {et}"
        e = entries[et]
        assert e.get("nav_section") == section
        assert e.get("nav_page") == page
        assert e.get("tab") == tab
        assert (e.get("display_name") or "").strip()
        assert (e.get("nav_icon") or "").strip()


def test_api_designer_entity_type_navigation_put_invalid_entries_type(designer_client) -> None:
    r = designer_client.put(
        "/api/designer/entity-type-navigation",
        json={"entries": "not-an-object"},
    )
    assert r.status_code == 400
