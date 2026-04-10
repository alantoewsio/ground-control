"""DHCP server table payload from cached DHCPServer XML-shaped dicts."""

from __future__ import annotations

from types import SimpleNamespace

from app.dhcp_server_table import build_dhcp_server_table_rows, iter_static_lease_dicts


def test_iter_static_lease_dicts_list_and_single():
    leases = [{"HostName": "a", "IPAddress": "1.1.1.1", "MACAddress": "m"}]
    d1 = {"StaticLease": {"Lease": leases}}
    assert len(iter_static_lease_dicts(d1)) == 1
    d2 = {"StaticLease": {"Lease": leases[0]}}
    assert len(iter_static_lease_dicts(d2)) == 1


def test_build_dhcp_server_table_rows_basic():
    ent = SimpleNamespace(id=9, external_name="srv")
    fw = SimpleNamespace(id=3, name="FW-A", host="10.0.0.1")
    payload = {
        "Name": "LAN DHCP",
        "Interface": "Port1",
        "IPLease": {"IP": ["192.168.1.10-192.168.1.50"]},
        "StaticLease": {
            "Lease": [{"HostName": "cam", "IPAddress": "192.168.1.20", "MACAddress": "aa:bb"}]
        },
    }
    out = build_dhcp_server_table_rows([(ent, fw, payload)])
    assert "columns" in out and "rows" in out
    assert len(out["rows"]) == 1
    cells = out["rows"][0]["cells"]
    assert cells["__name"] == "LAN DHCP"
    assert "Port1" in cells["__dhcp_interface"]
    assert "192.168.1.10" in cells["__dhcp_ip_lease"]
    assert "cam" in cells["__dhcp_static_leases"] or "192.168.1.20" in cells["__dhcp_static_leases"]
    assert out["rows"][0]["entity_type"] == "dhcp_server"
    assert out["rows"][0]["firewall_id"] == 3
