"""Tests for WebAdmin index.jsp metadata parsing."""

from app.firewall_webadmin_info import parse_sophos_webadmin_index_page

_SAMPLE_INDEX = """
<html><head><title>gw.payg.aws.toews.io</title></head><body>
<script>
Cyberoam.displayModel = 'SF01V';
Cyberoam.displayVersion = 'SFOS 22.0.0 GA-Build411';
Cyberoam.firmwareVersionOrgFormat = '22.0.0.411';
Cyberoam.version = "22.0.0.411";
Cyberoam.applianceGroup = 'AMAZON';
Cyberoam.applianceKey = 'a8972f1EC2B9963';
Cyberoam.isOEMdevice = 'false';
Cyberoam.licenseStatus = 'Active';
Cyberoam.licenseType = 'Base';
var modulesubsctionList=[{"Status":"ACTIVE","Type":"Purchased","Name":"Base Firewall"},{"Status":"ACTIVE","Type":"Trial","Name":"Network Protection"}];
encodedHostname = 'gw.payg.aws.toews.io';
Cyberoam.isCentralLogin = JSON.parse("false");
var ssl_key_password = 'do-not-collect';
</script>
</body></html>
"""


def test_parse_sophos_webadmin_index_page_core_fields() -> None:
    parsed = parse_sophos_webadmin_index_page(_SAMPLE_INDEX)
    assert parsed["device_hostname"] == "gw.payg.aws.toews.io"
    assert parsed["model"] == "SF01V"
    assert parsed["firmware_version"] == "SFOS 22.0.0 GA-Build411"
    # Fallback to applianceKey when explicit serial variable is absent.
    assert parsed["serial_number"] == "a8972f1EC2B9963"
    assert parsed["license_info"] == "licenseType=Base | licenseStatus=Active"
    assert parsed["firewall_subscriptions"] == [
        {"Name": "Base Firewall", "Status": "ACTIVE", "Type": "Purchased"},
        {"Name": "Network Protection", "Status": "ACTIVE", "Type": "Trial"},
    ]


def test_parse_sophos_webadmin_index_page_filters_sensitive_vars() -> None:
    parsed = parse_sophos_webadmin_index_page(_SAMPLE_INDEX)
    extras = parsed["interesting_vars"]
    assert extras["Cyberoam.applianceGroup"] == "AMAZON"
    assert extras["Cyberoam.isCentralLogin"] is False
    assert "ssl_key_password" not in extras
