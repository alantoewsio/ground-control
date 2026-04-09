"""Settings API: synthetic test firewalls."""

from __future__ import annotations

import ipaddress
import json

import pytest
from sqlalchemy import func

from app import data_management
from app.database import SessionLocal
from app.ipam import vrf_key
from app.main import _TEST_FW_POPULATION_TOP10_COUNTRIES
from app.models import Firewall, FirewallConfigEntry, IpamPrefix, IpamVrf


@pytest.fixture(autouse=True)
def _cleanup_synthetic_test_firewalls(authed_client, main_session):
    """Other modules may leave ``is_test`` firewalls; tests here assume a clean slate."""
    s = SessionLocal()
    try:
        data_management.delete_orphaned_firewall_config_entries(s)
    finally:
        s.close()
    authed_client.delete("/api/settings/test-firewalls")
    main_session.expire_all()
    yield
    s2 = SessionLocal()
    try:
        data_management.delete_orphaned_firewall_config_entries(s2)
    finally:
        s2.close()
    authed_client.delete("/api/settings/test-firewalls")
    main_session.expire_all()


def _expected_lan_from_test_fw_assignment(session, fw_id: int) -> tuple[str, str]:
    r = (
        session.query(IpamPrefix)
        .filter(
            IpamPrefix.assigned_to_firewall_id == fw_id,
            IpamPrefix.prefix_type == "assignment",
        )
        .one()
    )
    net = ipaddress.ip_network(r.cidr, strict=False)
    return str(net.network_address + 16), str(net.netmask)


def test_generate_test_firewalls_copies_cache(authed_client, main_session):
    src = Firewall(
        name="Source FW",
        host="src.example.local",
        port=4444,
        username="admin",
        verify_ssl=False,
        is_test=False,
    )
    main_session.add(src)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=src.id,
            entity_type="zone",
            external_name="LAN",
            payload_json='{"Name": "LAN"}',
        )
    )
    main_session.commit()

    r = authed_client.post(
        "/api/settings/test-firewalls/generate",
        json={
            "count": 2,
            "source_firewall_id": src.id,
            "synthetic_layout_token": "copper8_fiber2_mgmt1",
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["created"] == 2

    test_rows = main_session.query(Firewall).filter(Firewall.is_test.is_(True)).all()
    assert len(test_rows) == 2
    vrf_row = main_session.query(IpamVrf).filter(func.lower(IpamVrf.name) == "testing").one()
    pool = (
        main_session.query(IpamPrefix)
        .filter(
            IpamPrefix.cidr == "172.16.0.0/12",
            IpamPrefix.vrf_bucket == vrf_key(vrf_row.name),
            IpamPrefix.prefix_type == "pool",
        )
        .one()
    )
    assert pool.name
    for tw in test_rows:
        tags = tw.tags_list()
        assert "Test-Firewall" in tags
        assert len(tags) == 2
        countries = [t for t in tags if t != "Test-Firewall"]
        assert len(countries) == 1
        assert countries[0] in _TEST_FW_POPULATION_TOP10_COUNTRIES
        ents = (
            main_session.query(FirewallConfigEntry)
            .filter(FirewallConfigEntry.firewall_id == tw.id)
            .all()
        )
        assert len(ents) == 12
        zones = [e for e in ents if e.entity_type == "zone"]
        ifaces = [e for e in ents if e.entity_type == "interface"]
        assert len(zones) == 1
        assert zones[0].external_name == "LAN"
        assert zones[0].payload_json == '{"Name": "LAN"}'
        assert len(ifaces) == 11
        by_name = {e.external_name: json.loads(e.payload_json) for e in ifaces}
        exp_ip, exp_nm = _expected_lan_from_test_fw_assignment(main_session, tw.id)
        assert by_name["Port1"]["NetworkZone"] == "LAN"
        assert by_name["Port1"]["IPAddress"] == exp_ip
        assert by_name["Port1"]["Netmask"] == exp_nm
        assert by_name["Port2"]["NetworkZone"] == "WAN"
        assert by_name["Port2"]["IPv4Assignment"] == "DHCP"
        assert by_name["Port2"]["GatewayName"] == "DHCP_GW"
        assert by_name["Port3"]["NetworkZone"] == "None"
        assert by_name["PortF1"]["Name"] == by_name["PortF1"]["Hardware"] == "PortF1"
        assert by_name["PortMGMT"]["NetworkZone"] == "None"

    authed_client.delete("/api/settings/test-firewalls")


def test_generate_test_firewalls_skips_interfaces_tab_entities(
    authed_client, main_session,
):
    """Cloned cache must not include unified Interfaces tab rows (interface, VLAN, etc.)."""
    src = Firewall(
        name="Src Iface",
        host="iface-src.example.local",
        port=4444,
        username="admin",
        verify_ssl=False,
        is_test=False,
    )
    main_session.add(src)
    main_session.flush()
    for et, name, payload in (
        ("interface", "Port1", '{"Name": "Port1"}'),
        ("vlan", "VLAN99", '{"Name": "VLAN99"}'),
        ("zone", "LAN", '{"Name": "LAN"}'),
    ):
        main_session.add(
            FirewallConfigEntry(
                firewall_id=src.id,
                entity_type=et,
                external_name=name,
                payload_json=payload,
            )
        )
    main_session.commit()

    r = authed_client.post(
        "/api/settings/test-firewalls/generate",
        json={
            "count": 1,
            "source_firewall_id": src.id,
            "synthetic_layout_token": "copper8_fiber2_mgmt1",
        },
    )
    assert r.status_code == 200, r.text
    tw = main_session.query(Firewall).filter(Firewall.is_test.is_(True)).one()
    rows = (
        main_session.query(FirewallConfigEntry)
        .filter(FirewallConfigEntry.firewall_id == tw.id)
        .all()
    )
    types = {e.entity_type for e in rows}
    assert types == {"zone", "interface"}
    assert not any(e.external_name == "VLAN99" for e in rows)
    assert any(e.entity_type == "zone" and e.external_name == "LAN" for e in rows)
    by_name = {
        e.external_name: json.loads(e.payload_json)
        for e in rows
        if e.entity_type == "interface"
    }
    assert by_name["Port1"]["NetworkZone"] == "LAN"
    exp_ip, exp_nm = _expected_lan_from_test_fw_assignment(main_session, tw.id)
    assert by_name["Port1"]["IPAddress"] == exp_ip
    assert by_name["Port1"]["Netmask"] == exp_nm
    assert "PortF1" in by_name
    authed_client.delete("/api/settings/test-firewalls")


def test_generate_test_firewalls_vm_only_ports(authed_client, main_session):
    r = authed_client.post(
        "/api/settings/test-firewalls/generate",
        json={"count": 1, "synthetic_layout_token": "vm4"},
    )
    assert r.status_code == 200, r.text
    tw = main_session.query(Firewall).filter(Firewall.is_test.is_(True)).one()
    ifaces = (
        main_session.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.firewall_id == tw.id,
            FirewallConfigEntry.entity_type == "interface",
        )
        .all()
    )
    assert len(ifaces) == 4
    by_name = {e.external_name: json.loads(e.payload_json) for e in ifaces}
    assert set(by_name) == {"PortA", "PortB", "PortC", "PortD"}
    exp_ip, exp_nm = _expected_lan_from_test_fw_assignment(main_session, tw.id)
    assert by_name["PortA"]["NetworkZone"] == "LAN"
    assert by_name["PortA"]["IPAddress"] == exp_ip
    assert by_name["PortA"]["Netmask"] == exp_nm
    assert by_name["PortB"]["NetworkZone"] == "None"
    authed_client.delete("/api/settings/test-firewalls")


def test_generate_test_firewalls_rejects_non_aggregate_pool(authed_client, main_session):
    r = authed_client.post(
        "/api/settings/test-firewalls/generate",
        json={"count": 1, "test_lan_pool_cidr": "10.0.0.0/24"},
    )
    assert r.status_code == 400
    n = main_session.query(Firewall).filter(Firewall.is_test.is_(True)).count()
    assert n == 0


def test_generate_test_firewalls_rejects_ipv6_pool(authed_client, main_session):
    r = authed_client.post(
        "/api/settings/test-firewalls/generate",
        json={"count": 1, "test_lan_pool_cidr": "2001:db8::/32"},
    )
    assert r.status_code == 400


def test_generate_test_firewalls_unknown_source(authed_client, main_session):
    max_id = main_session.query(Firewall.id).order_by(Firewall.id.desc()).limit(1).scalar()
    missing = (max_id or 0) + 9999
    r = authed_client.post(
        "/api/settings/test-firewalls/generate",
        json={"count": 1, "source_firewall_id": missing},
    )
    assert r.status_code == 404
