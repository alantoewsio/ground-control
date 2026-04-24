"""Service cache payloads: single ``ServiceDetail`` object flattens without a list index."""

from __future__ import annotations

from app.interface_table import flatten_payload


def test_single_service_detail_flattens_without_numeric_segment() -> None:
    """Sophos often stores one row as an object; arrays appear only for multi-detail services."""
    data = {
        "Name": "HTTP",
        "Type": "TCPorUDP",
        "ServiceDetails": {
            "ServiceDetail": {
                "Protocol": "TCP",
                "SourcePort": "1:65535",
                "DestinationPort": "80",
            }
        },
    }
    flat = flatten_payload(data)
    assert flat.get("ServiceDetails.ServiceDetail.Protocol") == "TCP"
    assert flat.get("ServiceDetails.ServiceDetail.DestinationPort") == "80"
    assert flat.get("ServiceDetails.ServiceDetail.SourcePort") == "1:65535"
    assert "ServiceDetails.ServiceDetail.0.DestinationPort" not in flat


def test_multiple_service_details_flattens_with_index() -> None:
    data = {
        "Name": "Multi",
        "Type": "TCPorUDP",
        "ServiceDetails": {
            "ServiceDetail": [
                {"Protocol": "TCP", "DestinationPort": "80"},
                {"Protocol": "TCP", "DestinationPort": "443"},
            ]
        },
    }
    flat = flatten_payload(data)
    assert flat.get("ServiceDetails.ServiceDetail.0.DestinationPort") == "80"
    assert flat.get("ServiceDetails.ServiceDetail.1.DestinationPort") == "443"
