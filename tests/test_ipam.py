"""Tests for Address Management (IPAM) page and API."""

from __future__ import annotations

import json
import random
import re
import uuid

from app.models import Firewall, FirewallConfigEntry


def test_address_management_requires_session(client):
    r = client.get("/address-management", follow_redirects=False)
    assert r.status_code == 307
    assert r.headers.get("location") == "/"


def test_address_management_redirects_to_pools(authed_client):
    r = authed_client.get("/address-management", follow_redirects=False)
    assert r.status_code == 307
    assert "/address-management/pools" in (r.headers.get("location") or "")


def test_address_management_page_ok(authed_client):
    r = authed_client.get("/address-management/pools")
    assert r.status_code == 200
    assert "Address Management" in r.text
    assert "/address-management/pools" in r.text
    assert "/address-management/assignments" in r.text
    assert "/address-management/hosts" in r.text
    assert "/address-management/vrfs" in r.text
    assert 'data-gc-ipam-page="pools"' in r.text
    assert 'data-gc-ipam-locked-type="pool"' in r.text
    assert "/api/ipam/prefixes" in r.text
    assert "gc-ipam-flyout" in r.text
    assert "gc-ipam-disc-flyout" in r.text
    assert "/api/ipam/accept-discovered" in r.text
    assert "/api/ipam/accept-discovered-batch" in r.text
    assert 'id="gc-ipam-accept-all"' not in r.text
    assert 'id="gc-ipam-quick-conflicts"' in r.text
    assert 'id="gc-ipam-stat-discovered"' in r.text
    assert 'id="gc-ipam-stat-conflicts"' in r.text
    assert 'id="gc-ipam-table"' in r.text
    assert 'id="gc-ipam-filters-aside"' in r.text
    assert "data-table--dense" in r.text
    assert 'id="gc-ipam-quick-nav"' in r.text
    assert "data-gc-ipam-quick" in r.text
    assert 'id="gc-ipam-flyout-parent-pool"' in r.text
    assert 'id="gc-ipam-flyout-parent-assignment"' in r.text
    assert 'id="gc-ipam-nested-pool-flyout"' in r.text
    assert "data-api-next-assignment=" in r.text
    assert "Add pool" in r.text
    assert 'id="gc-ipam-flyout-type"' in r.text
    assert 'id="gc-ipam-flyout-type-display"' in r.text
    assert 'id="gc-ipam-vrf-flyout"' in r.text
    assert "data-api-vrfs=" in r.text
    assert "data-api-vrfs-create=" in r.text
    assert "/api/ipam/vrfs" in r.text
    assert 'id="gc-ipam-flyout-pool-unmanaged-switch"' in r.text
    assert 'id="gc-ipam-flyout-vrf"' in r.text
    assert 'name="vrf"' in r.text
    assert re.search(
        r'<select[^>]*id="gc-ipam-flyout-vrf"[^>]*\brequired\b',
        r.text,
        re.DOTALL,
    )


def test_address_management_assignments_page_has_accept_all(authed_client):
    r = authed_client.get("/address-management/assignments")
    assert r.status_code == 200
    assert 'data-gc-ipam-page="assignments"' in r.text
    assert 'data-gc-ipam-locked-type="assignment"' in r.text
    assert 'id="gc-ipam-accept-all"' in r.text
    assert "Add assignment" in r.text


def test_address_management_vrfs_page(authed_client):
    r = authed_client.get("/address-management/vrfs")
    assert r.status_code == 200
    assert 'data-gc-ipam-page="vrfs"' in r.text
    assert "data-gc-ipam-locked-type" not in r.text
    assert 'id="gc-ipam-vrf-table"' in r.text
    assert 'id="gc-ipam-vrf-add-open"' in r.text
    assert 'id="gc-ipam-table"' not in r.text


def test_ipam_vrfs_list_and_create(authed_client):
    r = authed_client.get("/api/ipam/vrfs")
    assert r.status_code == 200
    initial = r.json()["vrfs"]
    assert any(x.get("name") == "default" for x in initial)

    nm = f"pytest-vrf-{random.randint(10000, 99999)}"
    c = authed_client.post("/api/ipam/vrfs", json={"name": nm, "description": "d1"})
    assert c.status_code == 200
    body = c.json()
    assert body["name"] == nm
    assert body["description"] == "d1"
    assert body["prefix_count"] == 0
    assert "id" in body

    listed = authed_client.get("/api/ipam/vrfs").json()["vrfs"]
    assert any(x["name"] == nm for x in listed)

    dup = authed_client.post("/api/ipam/vrfs", json={"name": nm})
    assert dup.status_code == 409
    assert "already exists" in dup.json()["detail"].lower()


def test_ipam_form_meta_includes_defined_vrf_name(authed_client):
    nm = f"pytest-meta-vrf-{random.randint(10000, 99999)}"
    authed_client.post("/api/ipam/vrfs", json={"name": nm})
    meta = authed_client.get("/api/ipam/prefixes").json()["ipam_form_meta"]
    assert "default" in meta["vrf_names"]
    assert nm in meta["vrf_names"]


def test_ipam_prefix_post_requires_vrf(authed_client):
    r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "No vrf",
            "cidr": "10.199.0.0/24",
            "prefix_type": "pool",
        },
    )
    assert r.status_code == 422


def test_ipam_prefixes_list_shape(authed_client):
    r = authed_client.get("/api/ipam/prefixes")
    assert r.status_code == 200
    body = r.json()
    assert "prefixes" in body
    assert isinstance(body["prefixes"], list)
    assert "discovered" in body
    assert isinstance(body["discovered"], list)
    assert "discovered_hosts" in body
    assert isinstance(body["discovered_hosts"], list)
    assert "ipam_form_meta" in body
    meta = body["ipam_form_meta"]
    assert "vrf_names" in meta and isinstance(meta["vrf_names"], list)
    assert "pools" in meta and isinstance(meta["pools"], list)
    assert "assignments" in meta and isinstance(meta["assignments"], list)

    octet = random.randint(50, 59)
    pool_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Pytest list shape pool",
            "cidr": f"10.{octet}.0.0/16",
            "vrf": "pytest-list-shape",
            "prefix_type": "pool",
        },
    )
    assert pool_r.status_code == 200
    pid = pool_r.json()["id"]
    listed = authed_client.get("/api/ipam/prefixes").json()["prefixes"]
    first = next(p for p in listed if p["id"] == pid)
    assert "cidr" in first
    assert "name" in first
    assert "family" in first
    assert "size_label" in first
    assert "assigned_to_display" in first
    assert "tags" not in first
    assert "delete_eligible" in first
    assert "delete_allowed" in first
    assert "ipam_delete_cascade_count" in first
    assert "vrf_assignment_conflict" in first
    assert isinstance(first["vrf_assignment_conflict"], bool)
    assert first.get("pool_unmanaged") is False


def test_ipam_unmanaged_pool_omitted_from_form_meta_and_discovery(
    authed_client, main_session,
):
    b = random.randint(60, 79)
    pool_cidr = f"10.{b}.0.0/16"
    disc_cidr = f"10.{b}.9.0/24"
    pool_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Unmanaged meta pool",
            "cidr": pool_cidr,
            "vrf": "default",
            "prefix_type": "pool",
            "pool_unmanaged": True,
        },
    )
    assert pool_r.status_code == 200
    pool_id = pool_r.json()["id"]
    assert pool_r.json().get("pool_unmanaged") is True

    meta = authed_client.get("/api/ipam/prefixes").json()["ipam_form_meta"]
    assert not any(p["id"] == pool_id for p in meta["pools"])

    fw = Firewall(
        name="Unmanaged disc FW",
        host="10.0.0.61",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type="interface",
            external_name="u0",
            payload_json=json.dumps(
                {"IPAddress": f"10.{b}.9.1", "Netmask": "255.255.255.0"}
            ),
        )
    )
    main_session.commit()

    disc = authed_client.get("/api/ipam/prefixes").json()["discovered"]
    assert not any(x.get("cidr") == disc_cidr for x in disc)


def test_ipam_assignment_rejects_unmanaged_parent_pool(authed_client):
    b = random.randint(80, 89)
    pool_cidr = f"10.{b}.0.0/16"
    pr = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Unmanaged parent",
            "cidr": pool_cidr,
            "vrf": "default",
            "prefix_type": "pool",
            "pool_unmanaged": True,
        },
    )
    assert pr.status_code == 200
    pool_id = pr.json()["id"]
    ar = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Child",
            "cidr": f"10.{b}.1.0/24",
            "vrf": "default",
            "prefix_type": "assignment",
            "parent_pool_id": pool_id,
        },
    )
    assert ar.status_code == 400
    assert "unmanaged" in ar.json()["detail"].lower()


def test_ipam_next_assignment_rejects_unmanaged_pool(authed_client):
    b = random.randint(110, 119)
    pr = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Unmanaged for next",
            "cidr": f"10.{b}.0.0/16",
            "vrf": "default",
            "prefix_type": "pool",
            "pool_unmanaged": True,
        },
    )
    assert pr.status_code == 200
    pool_id = pr.json()["id"]
    r = authed_client.get(
        "/api/ipam/next-assignment-cidr",
        params={"parent_pool_id": pool_id, "prefix_len": 24},
    )
    assert r.status_code == 400
    assert "unmanaged" in r.json()["detail"].lower()


def test_ipam_prefixes_search(authed_client):
    octet = random.randint(30, 39)
    needle = f"10.{octet}.55"
    cidr = f"{needle}.0/24"
    authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Search target",
            "cidr": cidr,
            "vrf": "pytest-ipam-search",
            "prefix_type": "pool",
        },
    )
    r = authed_client.get("/api/ipam/prefixes", params={"q": needle})
    assert r.status_code == 200
    rows = r.json()["prefixes"]
    assert len(rows) >= 1
    assert all(needle in x["cidr"] for x in rows)


def test_ipam_prefixes_search_by_name(authed_client):
    tag = random.randint(9000, 9999)
    name = f"User VLAN pytest {tag}"
    octet = random.randint(40, 49)
    authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": name,
            "cidr": f"10.{octet}.0.0/16",
            "vrf": "pytest-name-search",
            "prefix_type": "pool",
        },
    )
    r = authed_client.get("/api/ipam/prefixes", params={"q": "User VLAN pytest"})
    assert r.status_code == 200
    rows = r.json()["prefixes"]
    assert len(rows) >= 1
    assert any(str(tag) in (x.get("name") or "") for x in rows)


def test_ipam_next_assignment_cidr_first_free(authed_client):
    o = random.randint(70, 79)
    pool_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Next free pool",
            "cidr": f"10.{o}.0.0/16",
            "vrf": "pytest-next-free",
            "prefix_type": "pool",
        },
    )
    assert pool_r.status_code == 200
    pid = pool_r.json()["id"]
    r = authed_client.get(
        "/api/ipam/next-assignment-cidr",
        params={"parent_pool_id": pid, "prefix_len": 24},
    )
    assert r.status_code == 200
    assert r.json()["cidr"] == f"10.{o}.0.0/24"


def test_ipam_next_assignment_cidr_skips_used(authed_client):
    o = random.randint(80, 89)
    pool_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Gap pool",
            "cidr": f"10.{o}.0.0/16",
            "vrf": "pytest-next-gap",
            "prefix_type": "pool",
        },
    )
    assert pool_r.status_code == 200
    pid = pool_r.json()["id"]
    a = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "First",
            "cidr": f"10.{o}.0.0/24",
            "vrf": "pytest-next-gap",
            "prefix_type": "assignment",
            "parent_pool_id": pid,
        },
    )
    assert a.status_code == 200
    r = authed_client.get(
        "/api/ipam/next-assignment-cidr",
        params={"parent_pool_id": pid, "prefix_len": 24},
    )
    assert r.status_code == 200
    assert r.json()["cidr"] == f"10.{o}.1.0/24"


def test_ipam_next_assignment_cidr_ipv6_pool_rejected(authed_client):
    pool_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "V6 pool",
            "cidr": "2001:db8:a::/48",
            "vrf": "pytest-next-v6",
            "prefix_type": "pool",
        },
    )
    assert pool_r.status_code == 200
    pid = pool_r.json()["id"]
    r = authed_client.get(
        "/api/ipam/next-assignment-cidr",
        params={"parent_pool_id": pid, "prefix_len": 64},
    )
    assert r.status_code == 400
    assert "ipv4" in r.json()["detail"].lower()


def test_ipam_resolve_interface_pool_ipv4_prefers_existing_for_firewall(
    authed_client, main_session,
):
    o = random.randint(150, 159)
    vrf = f"pytest-resolve-if-{o}"
    pool_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Resolve pool",
            "cidr": f"10.{o}.0.0/16",
            "vrf": vrf,
            "prefix_type": "pool",
        },
    )
    assert pool_r.status_code == 200
    pid = pool_r.json()["id"]
    fw = Firewall(
        name="RPool FW",
        host=f"10.{o}.0.99",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.commit()
    a = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Existing /24",
            "cidr": f"10.{o}.5.0/24",
            "vrf": vrf,
            "prefix_type": "assignment",
            "parent_pool_id": pid,
            "assigned_to_firewall_id": fw.id,
        },
    )
    assert a.status_code == 200
    r = authed_client.get(
        "/api/ipam/resolve-interface-pool-ipv4",
        params={"parent_pool_id": pid, "prefix_len": 24, "firewall_id": fw.id},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["cidr"] == f"10.{o}.5.0/24"
    assert body["source"] == "existing"
    r2 = authed_client.get(
        "/api/ipam/resolve-interface-pool-ipv4",
        params={"parent_pool_id": pid, "prefix_len": 24},
    )
    assert r2.status_code == 200
    assert r2.json()["source"] == "suggested"
    assert r2.json()["cidr"] != body["cidr"]


def test_ipam_interface_pool_commit(authed_client, main_session):
    o = random.randint(160, 169)
    vrf = f"pytest-if-commit-{o}"
    pool_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Commit pool",
            "cidr": f"10.{o}.0.0/16",
            "vrf": vrf,
            "prefix_type": "pool",
        },
    )
    assert pool_r.status_code == 200
    pid = pool_r.json()["id"]
    fw = Firewall(
        name="Commit FW",
        host=f"10.{o}.0.98",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.commit()
    r = authed_client.post(
        "/api/ipam/interface-pool-commit",
        json={
            "firewall_id": fw.id,
            "parent_pool_id": pid,
            "ipv4_ip": f"10.{o}.20.1",
            "ipv4_netmask": "/24",
        },
    )
    assert r.status_code == 200
    assert r.json().get("cidr") == f"10.{o}.20.0/24"


def test_ipam_create_and_duplicate(authed_client):
    octet = random.randint(210, 250)
    pool_cidr = f"10.{octet}.0.0/16"
    cidr = f"10.{octet}.0.0/24"
    pool_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Pytest pool",
            "cidr": pool_cidr,
            "vrf": "pytest",
            "prefix_type": "pool",
        },
    )
    assert pool_r.status_code == 200
    pool_id = pool_r.json()["id"]
    payload = {
        "name": "Pytest prefix",
        "cidr": cidr,
        "vrf": "pytest",
        "prefix_type": "assignment",
        "parent_pool_id": pool_id,
        "description": "unit test",
    }
    r1 = authed_client.post("/api/ipam/prefixes", json=payload)
    assert r1.status_code == 200
    got = r1.json()
    assert got["cidr"] == cidr
    assert got["name"] == "Pytest prefix"
    assert got["vrf"] == "pytest"

    r2 = authed_client.post("/api/ipam/prefixes", json=payload)
    assert r2.status_code == 409
    assert "saved address plan" in (r2.json().get("detail") or "").lower()
    assert "discovered" in (r2.json().get("detail") or "").lower()


def test_ipam_same_cidr_allowed_in_different_vrf(authed_client):
    """Uniqueness is (cidr, vrf bucket), not CIDR alone."""
    octet = random.randint(60, 69)
    cidr = f"10.{octet}.0.0/16"
    vrf_a = f"pytest-samecidr-{octet}a"
    vrf_b = f"pytest-samecidr-{octet}b"
    r1 = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Pool A",
            "cidr": cidr,
            "vrf": vrf_a,
            "prefix_type": "pool",
        },
    )
    assert r1.status_code == 200, r1.text
    r2 = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Pool B",
            "cidr": cidr,
            "vrf": vrf_b,
            "prefix_type": "pool",
        },
    )
    assert r2.status_code == 200, r2.text


def test_ipam_nested_pool_parent_pool_id_in_payload(authed_client):
    """Pools strictly inside another pool in the same VRF get parent_pool_id (named sub-pools)."""
    vrf = f"pytest-nested-pool-{random.randint(10000, 99999)}"
    o = random.randint(170, 190)
    parent_cidr = f"10.{o}.0.0/16"
    child_cidr = f"10.{o}.1.0/24"
    pr = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Parent pool",
            "cidr": parent_cidr,
            "vrf": vrf,
            "prefix_type": "pool",
        },
    )
    assert pr.status_code == 200
    parent_id = pr.json()["id"]
    assert pr.json().get("parent_pool_id") is None
    cr = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Child pool",
            "cidr": child_cidr,
            "vrf": vrf,
            "prefix_type": "pool",
        },
    )
    assert cr.status_code == 200
    body = cr.json()
    assert body.get("parent_pool_id") == parent_id
    listed = authed_client.get("/api/ipam/prefixes").json()["prefixes"]
    child = next(p for p in listed if p["id"] == body["id"])
    assert child.get("parent_pool_id") == parent_id


def test_ipam_update(authed_client):
    oa = random.randint(70, 100)
    ob = random.randint(110, 140)
    if ob == oa:
        ob = oa + 1
    pool_a_cidr = f"10.{oa}.0.0/16"
    assign_before = f"10.{oa}.1.0/24"
    pool_b_cidr = f"10.{ob}.0.0/16"
    assign_after = f"10.{ob}.1.0/24"
    pool_a = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Before pool",
            "cidr": pool_a_cidr,
            "vrf": "pytest",
            "prefix_type": "pool",
            "description": "orig",
        },
    )
    assert pool_a.status_code == 200
    pool_a_id = pool_a.json()["id"]
    create = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Before",
            "cidr": assign_before,
            "vrf": "pytest",
            "prefix_type": "assignment",
            "parent_pool_id": pool_a_id,
            "description": "orig",
        },
    )
    assert create.status_code == 200
    pid = create.json()["id"]
    pool_b = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Pool pytest2",
            "cidr": pool_b_cidr,
            "vrf": "pytest2",
            "prefix_type": "pool",
        },
    )
    assert pool_b.status_code == 200
    pool_b_id = pool_b.json()["id"]
    r = authed_client.put(
        f"/api/ipam/prefixes/{pid}",
        json={
            "name": "After",
            "cidr": assign_after,
            "vrf": "pytest2",
            "prefix_type": "assignment",
            "parent_pool_id": pool_b_id,
            "description": "new",
        },
    )
    assert r.status_code == 200
    got = r.json()
    assert got["name"] == "After"
    assert got["vrf"] == "pytest2"
    assert got["prefix_type"] == "assignment"
    assert got["description"] == "new"
    assert got.get("assigned_to_firewall_id") is None
    assert got.get("assigned_to_custom") is None


def test_ipam_assignment_custom(authed_client):
    octet = random.randint(160, 170)
    pool_cidr = f"10.{octet}.0.0/16"
    cidr = f"10.{octet}.0.0/27"
    pool_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Custom pool",
            "cidr": pool_cidr,
            "vrf": "default",
            "prefix_type": "pool",
        },
    )
    assert pool_r.status_code == 200
    pool_id = pool_r.json()["id"]
    r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Owned block",
            "cidr": cidr,
            "vrf": "default",
            "prefix_type": "assignment",
            "parent_pool_id": pool_id,
            "assigned_to_custom": "NetOps queue 42",
            "description": None,
        },
    )
    assert r.status_code == 200
    got = r.json()
    assert got["assigned_to_custom"] == "NetOps queue 42"
    assert got["assigned_to_display"] == "NetOps queue 42"
    assert got["assigned_to_firewall_id"] is None


def test_ipam_assignment_unknown_firewall(authed_client):
    octet = random.randint(140, 150)
    pool_cidr = f"10.{octet}.0.0/16"
    cidr = f"10.{octet}.0.0/27"
    pool_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Fw pool",
            "cidr": pool_cidr,
            "vrf": "default",
            "prefix_type": "pool",
        },
    )
    assert pool_r.status_code == 200
    pool_id = pool_r.json()["id"]
    r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Bad fw",
            "cidr": cidr,
            "vrf": "default",
            "prefix_type": "assignment",
            "parent_pool_id": pool_id,
            "assigned_to_firewall_id": 999_999_999,
        },
    )
    assert r.status_code == 400


def test_ipam_pool_clears_assignment(authed_client):
    octet = random.randint(130, 135)
    pool_cidr = f"10.{octet}.0.0/16"
    cidr = f"10.{octet}.0.0/28"
    pool_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Outer",
            "cidr": pool_cidr,
            "vrf": "default",
            "prefix_type": "pool",
        },
    )
    assert pool_r.status_code == 200
    pool_id = pool_r.json()["id"]
    create = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Temp",
            "cidr": cidr,
            "vrf": "default",
            "prefix_type": "assignment",
            "parent_pool_id": pool_id,
            "assigned_to_custom": "Team",
        },
    )
    assert create.status_code == 200
    pid = create.json()["id"]
    r = authed_client.put(
        f"/api/ipam/prefixes/{pid}",
        json={
            "name": "Temp",
            "cidr": cidr,
            "vrf": "default",
            "prefix_type": "pool",
            "assigned_to_firewall_id": None,
            "assigned_to_custom": "ignored",
            "description": None,
        },
    )
    assert r.status_code == 200
    got = r.json()
    assert got["prefix_type"] == "pool"
    assert got["assigned_to_firewall_id"] is None
    assert got["assigned_to_custom"] is None
    assert got["assigned_to_display"] is None


def test_ipam_update_not_found(authed_client):
    r = authed_client.put(
        "/api/ipam/prefixes/999999999",
        json={
            "name": "X",
            "cidr": "10.0.0.0/32",
            "vrf": "default",
            "prefix_type": "host",
            "description": None,
        },
    )
    assert r.status_code == 404


def test_ipam_discovered_omitted_when_assignment_prefix_type_mixed_case(
    authed_client, main_session,
):
    """already_in_ipam must match assignment/host regardless of prefix_type casing."""
    cidr = "172.41.7.0/24"
    fw = Firewall(
        name="Case FW",
        host="10.0.0.199",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type="interface",
            external_name="lan0",
            payload_json=json.dumps(
                {"IPAddress": "172.41.7.1", "Netmask": "255.255.255.0"}
            ),
        )
    )
    main_session.commit()
    pool_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Case pool",
            "cidr": "172.41.0.0/16",
            "vrf": "default",
            "prefix_type": "pool",
        },
    )
    assert pool_r.status_code == 200
    pool_id = pool_r.json()["id"]
    c = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Mixed case type row",
            "cidr": cidr,
            "vrf": "default",
            "prefix_type": "Assignment",
            "parent_pool_id": pool_id,
        },
    )
    assert c.status_code == 200
    body = authed_client.get("/api/ipam/prefixes").json()
    assert not any(x.get("cidr") == cidr for x in body["discovered"])


def test_ipam_discovered_from_sync_cache(authed_client, main_session):
    fw = Firewall(
        name="Sync Lab",
        host="10.0.0.50",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type="interface",
            external_name="Port1",
            payload_json=json.dumps(
                {"IPAddress": "172.20.5.1", "Netmask": "255.255.255.0"}
            ),
        )
    )
    main_session.commit()

    r = authed_client.get("/api/ipam/prefixes")
    assert r.status_code == 200
    disc = r.json()["discovered"]
    match = [x for x in disc if x["cidr"] == "172.20.5.0/24" and x["firewall_id"] == fw.id]
    assert len(match) == 1
    row = match[0]
    assert row["row_kind"] == "discovered"
    assert row["has_encompassing_pool"] is False
    assert row["accept_allowed"] is True
    assert "vrf_assignment_conflict" in row
    assert row["vrf_assignment_conflict"] is False


def test_ipam_vrf_assignment_no_conflict_for_hierarchical_assignments(authed_client):
    """Larger assignment contains a smaller one — not a same-VRF conflict."""
    b = random.randint(91, 109)
    pool_cidr = f"10.{b}.0.0/16"
    c_super = f"10.{b}.0.0/24"
    c_sub = f"10.{b}.0.128/25"
    pr = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "VRF hier pool",
            "cidr": pool_cidr,
            "vrf": "pytest-vrf-hier",
            "prefix_type": "pool",
        },
    )
    assert pr.status_code == 200
    pool_id = pr.json()["id"]
    r1 = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "VRF super",
            "cidr": c_super,
            "vrf": "pytest-vrf-hier",
            "prefix_type": "assignment",
            "parent_pool_id": pool_id,
        },
    )
    assert r1.status_code == 200
    r2 = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "VRF sub",
            "cidr": c_sub,
            "vrf": "pytest-vrf-hier",
            "prefix_type": "assignment",
            "parent_pool_id": pool_id,
        },
    )
    assert r2.status_code == 200
    listed = authed_client.get("/api/ipam/prefixes").json()["prefixes"]
    hit = [x for x in listed if x["cidr"] in (c_super, c_sub)]
    assert len(hit) == 2
    assert all(x.get("vrf_assignment_conflict") is False for x in hit)


def test_ipam_discovered_duplicate_cidr_same_vrf_conflict_rejects_accept(
    authed_client, main_session
):
    cidr = "172.30.44.0/24"
    fws = []
    for label in ("Dup A", "Dup B"):
        fw = Firewall(
            name=label,
            host=f"10.0.0.{200 + len(fws)}",
            port=4444,
            username="admin",
            verify_ssl=False,
        )
        main_session.add(fw)
        main_session.flush()
        fws.append(fw)
        main_session.add(
            FirewallConfigEntry(
                firewall_id=fw.id,
                entity_type="interface",
                external_name="eth0",
                payload_json=json.dumps(
                    {"IPAddress": "172.30.44.1", "Netmask": "255.255.255.0"}
                ),
            )
        )
    main_session.commit()

    listed = authed_client.get("/api/ipam/prefixes").json()
    disc = [x for x in listed["discovered"] if x["cidr"] == cidr]
    assert len(disc) == 2
    assert all(x["vrf_assignment_conflict"] is True for x in disc)

    r = authed_client.post(
        "/api/ipam/accept-discovered",
        json={
            "firewall_id": fws[0].id,
            "cidr": cidr,
            "name": "Dup try",
            "assigned_to_firewall_id": fws[0].id,
            "pool_cidr": "172.30.0.0/16",
            "pool_name": "Dup pool",
        },
    )
    assert r.status_code == 400
    assert "same vrf" in r.json()["detail"].lower()


def test_ipam_accept_discovered_batch(authed_client, main_session):
    b = random.randint(40, 58)
    pool_cidr = f"172.{b}.0.0/16"
    assign_cidr = f"172.{b}.7.0/24"
    fw = Firewall(
        name="Batch FW",
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
            entity_type="interface",
            external_name="inside",
            payload_json=json.dumps(
                {
                    "IPAddress": f"172.{b}.7.1",
                    "Netmask": "255.255.255.0",
                }
            ),
        )
    )
    main_session.commit()

    p = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Batch pool",
            "cidr": pool_cidr,
            "vrf": "default",
            "prefix_type": "pool",
        },
    )
    assert p.status_code == 200

    r = authed_client.post("/api/ipam/accept-discovered-batch", json={})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("accepted_count", 0) >= 1
    assert any(x.get("cidr") == assign_cidr for x in body.get("accepted", []))


def test_ipam_accept_discovered_pool_required(authed_client, main_session):
    fw = Firewall(
        name="PoolReq FW",
        host="10.0.0.51",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type="interface",
            external_name="Eth0",
            payload_json=json.dumps(
                {"IPAddress": "172.21.1.1", "Netmask": "255.255.255.0"}
            ),
        )
    )
    main_session.commit()

    r = authed_client.post(
        "/api/ipam/accept-discovered",
        json={
            "firewall_id": fw.id,
            "cidr": "172.21.1.0/24",
            "name": "Eth0 LAN",
            "assigned_to_firewall_id": fw.id,
        },
    )
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "pool_required"


def test_ipam_accept_discovered_creates_pool_and_assignment(authed_client, main_session):
    fw = Firewall(
        name="Accept FW",
        host="10.0.0.52",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type="vlan",
            external_name="VLAN 99",
            payload_json=json.dumps(
                {"IPAddress": "172.22.9.1", "Netmask": "255.255.255.0"}
            ),
        )
    )
    main_session.commit()

    r = authed_client.post(
        "/api/ipam/accept-discovered",
        json={
            "firewall_id": fw.id,
            "cidr": "172.22.9.0/24",
            "name": "VLAN 99 block",
            "assigned_to_firewall_id": fw.id,
            "pool_cidr": "172.22.0.0/16",
            "pool_name": "Site 22 supernet",
        },
    )
    assert r.status_code == 200, r.text
    got = r.json()
    assert got["cidr"] == "172.22.9.0/24"
    assert got["prefix_type"] == "assignment"

    listed_full = authed_client.get("/api/ipam/prefixes").json()
    assert not any(x["cidr"] == "172.22.9.0/24" for x in listed_full["discovered"])

    listed = listed_full["prefixes"]
    pools = [x for x in listed if x["cidr"] == "172.22.0.0/16" and x["prefix_type"] == "pool"]
    assert len(pools) == 1


def test_ipam_accept_discovered_overlap_rejected(authed_client, main_session):
    fw = Firewall(
        name="Overlap FW",
        host="10.0.0.53",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type="interface",
            external_name="x0",
            payload_json=json.dumps(
                {"IPAddress": "172.23.10.1", "Netmask": "255.255.255.0"}
            ),
        )
    )
    main_session.commit()

    pool_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Overlap pool",
            "cidr": "172.23.0.0/16",
            "vrf": "default",
            "prefix_type": "pool",
        },
    )
    assert pool_r.status_code == 200
    pool_id = pool_r.json()["id"]
    c1 = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Existing /25",
            "cidr": "172.23.10.0/25",
            "vrf": "default",
            "prefix_type": "assignment",
            "parent_pool_id": pool_id,
        },
    )
    assert c1.status_code == 200

    r = authed_client.post(
        "/api/ipam/accept-discovered",
        json={
            "firewall_id": fw.id,
            "cidr": "172.23.10.0/24",
            "name": "Wide block",
            "pool_cidr": "172.23.0.0/16",
            "pool_name": "Cover",
        },
    )
    assert r.status_code == 400
    assert "overlap" in r.json()["detail"].lower()


def test_ipam_accept_discovered_with_existing_pool(authed_client, main_session):
    fw = Firewall(
        name="PoolCover FW",
        host="10.0.0.54",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.flush()
    b = random.randint(26, 90)
    pool_cidr = f"172.{b}.0.0/16"
    assign_cidr = f"172.{b}.5.0/24"
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type="interface",
            external_name="inside",
            payload_json=json.dumps(
                {
                    "IPAddress": f"172.{b}.5.1",
                    "Netmask": "255.255.255.0",
                }
            ),
        )
    )
    main_session.commit()

    p = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Temp supernet",
            "cidr": pool_cidr,
            "vrf": "default",
            "prefix_type": "pool",
        },
    )
    assert p.status_code == 200

    r = authed_client.post(
        "/api/ipam/accept-discovered",
        json={
            "firewall_id": fw.id,
            "cidr": assign_cidr,
            "name": "Inside LAN",
            "assigned_to_firewall_id": fw.id,
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["cidr"] == assign_cidr
    listed_after = authed_client.get("/api/ipam/prefixes").json()
    assert not any(x["cidr"] == assign_cidr for x in listed_after["discovered"])


def test_ipam_delete_assignment_ok(authed_client):
    ub = uuid.uuid4().bytes
    pool_cidr = f"10.{ub[0]}.{ub[1]}.0/16"
    cidr = f"10.{ub[0]}.{ub[1]}.0/28"
    pool_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Del pool",
            "cidr": pool_cidr,
            "vrf": "default",
            "prefix_type": "pool",
        },
    )
    assert pool_r.status_code == 200
    pool_id = pool_r.json()["id"]
    c = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Deletable",
            "cidr": cidr,
            "vrf": "default",
            "prefix_type": "assignment",
            "parent_pool_id": pool_id,
            "assigned_to_custom": "custom only",
        },
    )
    assert c.status_code == 200
    pid = c.json()["id"]
    d = authed_client.delete(f"/api/ipam/prefixes/{pid}")
    assert d.status_code == 200
    assert d.json()["ok"] is True
    listed = authed_client.get("/api/ipam/prefixes").json()["prefixes"]
    assert all(x["id"] != pid for x in listed)


def test_ipam_delete_assignment_blocked_with_managed_firewall(authed_client, main_session):
    fw = Firewall(
        name="IPAM del FW",
        host="10.0.0.60",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.commit()
    ub = uuid.uuid4().bytes
    pool_cidr = f"10.{ub[0]}.{ub[1]}.0/16"
    cidr = f"10.{ub[0]}.{ub[1]}.0/28"
    pool_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Lock pool",
            "cidr": pool_cidr,
            "vrf": "default",
            "prefix_type": "pool",
        },
    )
    assert pool_r.status_code == 200
    pool_id = pool_r.json()["id"]
    c = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Locked",
            "cidr": cidr,
            "vrf": "default",
            "prefix_type": "assignment",
            "parent_pool_id": pool_id,
            "assigned_to_firewall_id": fw.id,
        },
    )
    assert c.status_code == 200
    pid = c.json()["id"]
    d = authed_client.delete(f"/api/ipam/prefixes/{pid}")
    assert d.status_code == 400
    assert "managed firewall" in d.json()["detail"].lower()


def test_ipam_delete_pool_cascades(authed_client):
    ub = uuid.uuid4().bytes
    a = ub[0]
    pool_cidr = f"10.{a}.0.0/16"
    child_cidr = f"10.{a}.1.0/24"
    vrf = f"pytest-cascade-{uuid.uuid4().hex[:16]}"
    p = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Cascade pool",
            "cidr": pool_cidr,
            "vrf": vrf,
            "prefix_type": "pool",
        },
    )
    assert p.status_code == 200
    pool_id = p.json()["id"]
    ch = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Child assign",
            "cidr": child_cidr,
            "vrf": vrf,
            "prefix_type": "assignment",
            "parent_pool_id": pool_id,
        },
    )
    assert ch.status_code == 200
    child_id = ch.json()["id"]
    d = authed_client.delete(f"/api/ipam/prefixes/{pool_id}")
    assert d.status_code == 200
    listed = authed_client.get("/api/ipam/prefixes").json()["prefixes"]
    ids = {x["id"] for x in listed}
    assert pool_id not in ids
    assert child_id not in ids


def test_ipam_delete_pool_blocked_when_child_has_managed_firewall(authed_client, main_session):
    fw = Firewall(
        name="Pool child FW",
        host="10.0.0.61",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.commit()
    b = random.randint(161, 180)
    pool_cidr = f"10.{b}.0.0/16"
    child_cidr = f"10.{b}.2.0/24"
    vrf = "pytest-delete-pool-fw-block"
    p = authed_client.post(
        "/api/ipam/prefixes",
        json={"name": "Outer", "cidr": pool_cidr, "vrf": vrf, "prefix_type": "pool"},
    )
    assert p.status_code == 200
    pool_id = p.json()["id"]
    ch = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Child fw",
            "cidr": child_cidr,
            "vrf": vrf,
            "prefix_type": "assignment",
            "parent_pool_id": pool_id,
            "assigned_to_firewall_id": fw.id,
        },
    )
    assert ch.status_code == 200
    d = authed_client.delete(f"/api/ipam/prefixes/{pool_id}")
    assert d.status_code == 400
    assert "inside this pool" in d.json()["detail"].lower()


def test_ipam_delete_host_rejected(authed_client):
    octet = random.randint(181, 190)
    pool_cidr = f"10.{octet}.0.0/16"
    asn_cidr = f"10.{octet}.0.0/24"
    cidr = f"10.{octet}.0.1/32"
    p = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Host pool",
            "cidr": pool_cidr,
            "vrf": "default",
            "prefix_type": "pool",
        },
    )
    assert p.status_code == 200
    pool_id = p.json()["id"]
    asn = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Host parent asn",
            "cidr": asn_cidr,
            "vrf": "default",
            "prefix_type": "assignment",
            "parent_pool_id": pool_id,
        },
    )
    assert asn.status_code == 200
    asn_id = asn.json()["id"]
    c = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "Host row",
            "cidr": cidr,
            "vrf": "default",
            "prefix_type": "host",
            "parent_assignment_id": asn_id,
        },
    )
    assert c.status_code == 200
    pid = c.json()["id"]
    d = authed_client.delete(f"/api/ipam/prefixes/{pid}")
    assert d.status_code == 400
    assert "only pool and assignment" in d.json()["detail"].lower()


def test_unified_interfaces_ipam_cidr_verified_hint(authed_client, main_session):
    b = random.randint(191, 220)
    cidr = f"10.{b}.44.0/24"
    ip = f"10.{b}.44.1"
    fw = Firewall(
        name="IF IPAM verify FW",
        host=f"10.0.0.{b}",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type="interface",
            external_name="Port1",
            payload_json=json.dumps(
                {
                    "IPv4Configuration": "Enable",
                    "IPv4Assignment": "Static",
                    "IPAddress": ip,
                    "Netmask": "255.255.255.0",
                }
            ),
        )
    )
    main_session.commit()

    pool_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "IF hint pool",
            "cidr": f"10.{b}.0.0/16",
            "vrf": "default",
            "prefix_type": "pool",
        },
    )
    assert pool_r.status_code == 200
    pool_id = pool_r.json()["id"]
    asn_r = authed_client.post(
        "/api/ipam/prefixes",
        json={
            "name": "IF hint assignment",
            "cidr": cidr,
            "vrf": "default",
            "prefix_type": "assignment",
            "parent_pool_id": pool_id,
            "assigned_to_firewall_id": fw.id,
        },
    )
    assert asn_r.status_code == 200

    r = authed_client.get(
        "/api/firewalls/network/interfaces",
        params={"firewall_ids": str(fw.id)},
    )
    assert r.status_code == 200
    rows = r.json()["rows"]
    hit = [x for x in rows if ip in (x.get("cells") or {}).get("__address_cidr", "")]
    assert len(hit) == 1
    assert hit[0].get("ipam_cidr_cell") == "verified"


def test_unified_interfaces_ipam_cidr_conflict_hint(authed_client, main_session):
    """Same pattern as discovered duplicate CIDR: IPAM conflict on interface row."""
    fws = []
    for label in ("IF conflict A", "IF conflict B"):
        fw = Firewall(
            name=label,
            host=f"10.0.0.{240 + len(fws)}",
            port=4444,
            username="admin",
            verify_ssl=False,
        )
        main_session.add(fw)
        main_session.flush()
        fws.append(fw)
        main_session.add(
            FirewallConfigEntry(
                firewall_id=fw.id,
                entity_type="interface",
                external_name="eth0",
                payload_json=json.dumps(
                    {
                        "IPv4Configuration": "Enable",
                        "IPv4Assignment": "Static",
                        "IPAddress": "172.31.88.1",
                        "Netmask": "255.255.255.0",
                    }
                ),
            )
        )
    main_session.commit()

    r = authed_client.get(
        "/api/firewalls/network/interfaces",
        params={"firewall_ids": ",".join(str(f.id) for f in fws)},
    )
    assert r.status_code == 200
    rows = r.json()["rows"]
    for x in rows:
        if "172.31.88" in (x.get("cells") or {}).get("__address_cidr", ""):
            assert x.get("ipam_cidr_cell") == "conflict"
