"""Netflow Sophos XML apply path (tag casing + submit_xml)."""

from __future__ import annotations

from unittest.mock import MagicMock

from app.netflow_sophos_update import apply_netflow_configuration_set


def test_apply_netflow_uses_response_key_casing_for_set_body():
    fw = MagicMock()
    fw.get_tag.return_value = {
        "Response": {
            "Login": {"status": "Authentication Successful"},
            "NetflowConfiguration": {
                "@status": "200",
                "Server": [{"ServerName": "old", "NetflowServer": "10.0.0.1", "NetflowServerPort": "2055"}],
            },
        }
    }
    fw.submit_xml.return_value = {"Response": {}}

    apply_netflow_configuration_set(
        fw,
        {
            "Server": [
                {"ServerName": "n1", "NetflowServer": "192.0.2.1", "NetflowServerPort": "2055"},
            ],
        },
    )

    assert fw.get_tag.call_count >= 1
    body = fw.submit_xml.call_args[0][0]
    assert "NetflowConfiguration" in body
    assert "192.0.2.1" in body
    assert fw.submit_xml.call_args[1].get("set_operation") == "update"


def test_apply_netflow_first_tag_zero_second_succeeds():
    from sophosfirewall_python.api_client import SophosFirewallZeroRecords

    fw = MagicMock()
    fw.get_tag.side_effect = [
        SophosFirewallZeroRecords("Number of records Zero."),
        {"Response": {"NetflowConfiguration": {"Server": []}}},
    ]
    fw.submit_xml.return_value = {"Response": {}}

    apply_netflow_configuration_set(
        fw,
        {"Server": [{"ServerName": "a", "NetflowServer": "1.1.1.1", "NetflowServerPort": "2055"}]},
    )

    assert fw.get_tag.call_count == 2
    assert fw.submit_xml.called
    assert "1.1.1.1" in fw.submit_xml.call_args[0][0]


def test_apply_netflow_zero_records_on_both_tags_submits_empty():
    from sophosfirewall_python.api_client import SophosFirewallZeroRecords

    fw = MagicMock()
    fw.get_tag.side_effect = [
        SophosFirewallZeroRecords("z"),
        SophosFirewallZeroRecords("z"),
    ]
    fw.submit_xml.return_value = {"Response": {}}

    apply_netflow_configuration_set(fw, {"Server": []})

    assert fw.get_tag.call_count == 2
    body = fw.submit_xml.call_args[0][0]
    assert "NetflowConfiguration" in body
