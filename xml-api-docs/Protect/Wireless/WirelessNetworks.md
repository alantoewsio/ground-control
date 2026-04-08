# WirelessNetworks

- Operation: Add Wireless Network / Update Wireless Network
- Description: Add Wireless Network and Update Wireless Network.

## Sample Configuration

``` xml
<WirelessNetworks>
    <Name>Descriptive name of network</Name>
    <Hardware>wlnet1</Hardware>
    <SSID>wlnet123</SSID>
    <SecurityMode>WPA2Personal</SecurityMode>
    <Key>123456789</Key>
    <ClientTraffic>SeparateZone</ClientTraffic>
    <Zone>LAN</Zone>
    <IPAddress>12.12.12.12</IPAddress>
    <Netmask>255.255.255.0</Netmask>
    <BridgetoVLANid>15</BridgetoVLANid>
    <Description>test wlnet</Description>
    <Encryption>TKIP(only abg)</Encryption>
    <FrequencyBand>2.4and5GHz</FrequencyBand>
    <ClientIsolation>Enable</ClientIsolation>
    <HideSSID>Enable</HideSSID>
</WirelessNetworks>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Enter a name for the network.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 58.|
|Hardware|Yes||Description:|
||||Enter a hardware name for the network.|
||||Hardware confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 10.|
|Description|No||Description:|
||||Enter a description for the wireless network that helps you to identify it.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SSID|Yes||Description:|
||||Enter the Service Set Identifier (SSID) for the network to identify the wireless network.|
||||SSID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Characters not allowed: (^;'"\)|
||||Maximum characters allowed are 32.|
|SecurityMode|Yes|WPA2Personal|Description:|
||||Select a security mode.|
||||SecurityMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'NoEncryption', 'WEPOpen', 'WPAPersonal', 'WPA2Personal', 'WPA2/WPAPersonal', 'WPAEnterprise', 'WPA2Enterprise', 'WPA2/WPAEnterprise' are allowed.|
|Key|No||Description:|
||||Enter the passphrase to protect the wireless network from unauthorized access.|
||||Key confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Note:|
||||Applicable only if Security Mode is selected as 'WPA Personal', 'WPA2Personal' or 'WPA2/WPA Personal'.|
|ClientTraffic|Yes|SeparateZone|Description:|
||||Select a method to integrate wireless network into local network.|
||||ClientTraffic confines to:|
||||Type is 'SCALAR'.|
||||Only 'SeparateZone', 'BridgetoAPLAN', 'BridgetoVLAN' are allowed.|
|Zone|No||Description:|
||||Specify Zone.|
||||Zone confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ClientVlanId|No||Description:|
||||Specify Client VLAN ID.|
||||ClientVlanId confines to:|
||||Type is 'SCALAR'.|
||||Only 'Static', 'RadiusAndStatic' are allowed.|
|Encryption|No|TKIP(only abg)|Description:|
||||Select an encryption algorithm.|
||||Encryption confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Note:|
||||Not Applicable if Security Mode is selected as 'No Encryption' or 'WEP Open'.|
|TimeBasedAccess|No|Disable|Description:|
||||Enable or Disable the wireless network according to a time schedule.|
||||TimeBasedAccess confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Time|No||Description:|
||||Select a schedule definition which determines when the wireless network is enabled.|
||||Time confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Note:|
||||Applicable only if 'Time-based Access' is Enabled.|
|ClientIsolation|Yes|Disable|Description:|
||||Enable or disable to deny or allow clients within a network to communicate with one another.|
||||ClientIsolation confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|HideSSID|No|Disable|Description:|
||||Enable or disable to hide or display wireless network's SSID.|
||||HideSSID confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|FastTransition|No||Description:|
||||Specify Enable or Disable.|
||||FastTransition confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|MACFiltering|Yes|None|Description:|
||||Select the required approach to filter the MAC addresses that can be connected to this wireless network.|
||||MACFiltering confines to:|
||||Type is 'SCALAR'.|
||||Only 'None', 'Allowlist', 'Blocklist' are allowed.|
|MACList|No||Description:|
||||With Blacklist, all MAC addresses are allowed except those listed on the MAC List. With Whitelist, all MAC addresses are prohibited except those listed on the MAC List.|
||||MACList confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Note:|
||||Applicable only when MAC Filtering is selected as 'Whitelist' or 'Blacklist'.|
|FrequencyBand|Yes|2.4and5GHz|Description:|
||||Select the frequency band at which the assigned access points of the wireless network should transmit.|
||||FrequencyBand confines to:|
||||Type is 'SCALAR'.|
||||Only '5GHz', '2.4GHz', '2.4and5GHz' are allowed.|
|Netmask|No|255.255.255.0|Description:|
||||Select a subnet mask for the IP address.|
||||Netmask confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 15.|
||||IPv4 Address should be between: [128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255]|
||||Note:|
||||Applicable only if Client Traffic is selected as 'Separate Zone'.|
|BridgetoVLANid|No||Description:|
||||Enter the VLAN ID of the network that the wireless clients should be part of.|
||||BridgetoVLANid confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 4095 is allowed.|
||||Note:|
||||Applicable only if Client Traffic is selected as 'Bridge to VLAN'.|
|IPAddress|No||Description:|
||||Assign an IP address to the wireless network.|
||||IPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Note:|
||||Applicable only if Client Traffic is selected as 'Separate Zone'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Wireless Network|200|Created wireless network "\<DynamicValue>"|
|Add Wireless Network|500|Couldn't add wireless network "\<DynamicValue>"|
|Add Wireless Network|502|Wireless/mesh network "\<DynamicValue>" could not be created. Wireless/mesh network with the same name already exists|
|Add Wireless Network|503|Wireless network "\<DynamicValue>" could not be created. Interface with the same name already exists|
|Add Wireless Network|541|Couldn't add wireless network "\<DynamicValue>"|
|Add Wireless Network|542|Wireless network "\<DynamicValue>" could not be created. IP address is already assigned to another interface|
|Add Wireless Network|544|This IP address is assigned to either peer administration port or peer dedicated port of HA cluster|
|Add Wireless Network|545|Couldn't add wireless network "\<DynamicValue>"|
|Add Wireless Network|548|This is a system-reserved interface name. Specify a different name|
|Add Wireless Network|560|IP address lies within the leased IP range configured in the DHCP server|
|Update Wireless Network|200|Updated wireless network "\<DynamicValue>"|
|Update Wireless Network|500|Couldn't update wireless network "\<DynamicValue>"|
|Update Wireless Network|503|Wireless network "\<DynamicValue>" could not be updated. Interface with the same name already exists|
|Update Wireless Network|541|Couldn't update wireless network "\<DynamicValue>"|
|Update Wireless Network|542|Wireless network "\<DynamicValue>" could not be updated. IP address is already assigned to another interface|
|Update Wireless Network|543|Couldn't update wireless network "\<DynamicValue>"|
|Update Wireless Network|544|This IP address is assigned to either peer administration port or peer dedicated port of HA cluster|
|Update Wireless Network|545|Couldn't update wireless network "\<DynamicValue>"|
|Update Wireless Network|546|Wireless network "\<DynamicValue>" could not be updated. The client traffic type is bound to local AP|
|Update Wireless Network|547|Wireless network "\<DynamicValue>" is bound to access point "LocalWifi0", access point does not support frequency band of wireless network|
|Update Wireless Network|548|This is a system-reserved interface name. Specify a different name|
|Update Wireless Network|549|Couldn't update wireless network "\<DynamicValue>"|
|Update Wireless Network|560|IP address lies within the leased IP range configured in the DHCP server|
|Update Wireless Network|561|You must set the security mode to WPA2 or later for wireless networks assigned to LocalWIFI0|
|Update Wireless Network|562|Can't set the security mode to WPA3 when the wireless network is assigned to an access point|
|Update Wireless Network|563|You can't apply TKIP encryption to wireless networks assigned to LocalWiFI0|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
