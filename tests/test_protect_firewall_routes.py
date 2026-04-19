"""HTTP smoke tests for the Protect · Firewall routes (firewall + cfg scope).

These exercise the URL wiring added in Installment B: the per-firewall page
gains the seven HS context keys + NAT URLs, and the new cfg-scope page is
served at ``/configurations/protect/firewall``.
"""

from __future__ import annotations


def _assert_html_ok(resp, must_contain):
    assert resp.status_code == 200, f"expected 200, got {resp.status_code}: {resp.text[:200]}"
    body = resp.text
    for needle in must_contain:
        assert needle in body, f"expected {needle!r} in HTML body"


def test_firewalls_protect_firewall_page_renders(authed_client):
    """Per-firewall Protect · Firewall page should still render after Installment B.

    The route handler now also injects NAT URLs + the seven HS context keys,
    but the template only consumes the original Firewall-rules URLs until the
    Installment C tab refactor lands.  This test just confirms the page still
    serves successfully and the existing URLs render.
    """
    r = authed_client.get("/firewalls/protect/firewall")
    _assert_html_ok(
        r,
        must_contain=[
            "/api/firewalls/protect/firewall/firewall-rules-table",
            "/api/task-queue/enqueue-firewall-rule-reorder-batch",
        ],
    )


def test_firewalls_protect_firewall_route_context_includes_nat_and_hs_urls(authed_client):
    """Confirm the route handler builds NAT + HS URLs even before the template uses them.

    We resolve the URLs from the FastAPI app directly rather than scraping the
    HTML body so this test stays valid both before and after the Installment C
    template refactor.
    """
    from app.main import app

    routes_by_name = {r.name: r for r in app.routes if hasattr(r, "name")}
    assert "api_firewalls_nat_rules_table" in routes_by_name
    assert "api_task_queue_enqueue_nat_rule_reorder_batch" in routes_by_name
    assert "api_task_queue_enqueue_hs_creates_batch" in routes_by_name
    assert "api_task_queue_enqueue_hs_updates_batch" in routes_by_name
    assert "api_task_queue_enqueue_hs_deletes_batch" in routes_by_name
    assert "api_firewalls_hosts_services_table" in routes_by_name
    assert "api_hosts_services_cached_names_aggregate" in routes_by_name


def test_configurations_protect_firewall_page_renders(authed_client):
    """Cfg-scope Protect · Firewall page should expose the HS apply endpoints."""
    r = authed_client.get("/configurations/protect/firewall")
    _assert_html_ok(
        r,
        must_contain=[
            "/api/configurations/hosts-services/table",
            "/api/configurations/apply-hs-creates-batch",
            "/api/configurations/apply-hs-updates-batch",
            "/api/configurations/apply-hs-deletes-batch",
            "Firewall rules",
            "NAT rules",
        ],
    )


def test_api_firewalls_nat_rules_table_returns_empty_payload(authed_client):
    r = authed_client.get("/api/firewalls/protect/firewall/nat-rules-table")
    assert r.status_code == 200
    body = r.json()
    assert body["rows"] == []
    assert "__name" in body["columns"]
    assert "__original_src" in body["columns"]
    assert "__translated_src" in body["columns"]


def test_api_enqueue_nat_rule_reorder_batch_validates_firewall(authed_client):
    """Posting an unknown firewall_id should produce a 400 from the service layer."""
    r = authed_client.post(
        "/api/task-queue/enqueue-nat-rule-reorder-batch",
        json={"firewall_id": 999999, "ordered_config_entry_ids": [1]},
    )
    assert r.status_code == 400
    assert "Firewall" in r.text
