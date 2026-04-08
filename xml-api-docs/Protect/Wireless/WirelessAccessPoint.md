# WirelessAccessPoint

- Operation: Update Access Point
- Description: The page allows one to update Access Points.

## Sample Configuration

``` xml
<WirelessAccessPoint>
    <ID>A40016ADB63B7F1</ID>
    <Label>AP30[A40016ADB63B7F1]</Label>
    <Country>India</Country>
    <Group>No Group/wlgroup</Group>
    <WirelessNetworks>
        <Network>wlnet1</Network>
        <Network>wlnet2</Network>
    </WirelessNetworks>
    <MeshNetwoks>
        <MeshNetwok>
            <MeshID>mesh1</MeshID>
            <Role>RootAccessPoint</Role>
        </MeshNetwok>
        <MeshNetwok>
            <MeshID>mesh2</MeshID>
            <Role>RootAccessPoint</Role>
        </MeshNetwok>
    </MeshNetwoks>
    <Channel2.4GHz>Auto/1/2/3</Channel2.4GHz>
    <DynChan>Enable</DynChan>
    <TimeBasedScan>Enable</TimeBasedScan>
    <ScanTime>
        <Time>All Time on Weekends</Time>
    </ScanTime>
    <TXPower>100%</TXPower>
    <Channel5GHz>Auto/1/2/3</Channel5GHz>
    <DynChan5GHz>Enable</DynChan5GHz>
    <TimeBasedScan5GHz>Enable</TimeBasedScan5GHz>
    <ScanTime5GHz>
        <Time>All Time on Weekends</Time>
    </ScanTime5GHz>
    <TXPower5GHz>100%</TXPower5GHz>
    <STP>Enable/Disable</STP>
    <VLANTagging>Enable</VLANTagging>
    <APVLANID>25</APVLANID>
    <Band>2.4GHz</Band>
    <AllowedChannels>1,2,3,4,5,6,7,8,9,10,11,12,13,36,40,44,48,52,56,60,64,100,104,108,112,116,132,136,140</AllowedChannels>
</WirelessAccessPoint>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ID|Yes||Description:|
||||Displays ID of the Access Point.|
||||ID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Label|Yes||Description:|
||||Specify label.|
||||Label confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 30.|
||||UTF-8 character(s) are allowed.|
|Country|Yes||Description:|
||||Select Country where the Access Point is located.|
||||Country confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Group|No||Description:|
||||Select Access point group for the Access Point.|
||||Group confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Network|No||Description:|
||||Select Wireless Networks for the Access Point.|
||||Network confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Role|No||Description:|
||||Select role for the Access Point.|
||||Role confines to:|
||||Type is 'ARRAY'.|
||||Only 'point', 'portal' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Channel2.4GHz|No||Description:|
||||Select a channel that will be used by the access point.(2.4 GHz)|
||||Channel2.4GHz confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DynChan|No|Disable|Description:|
||||Select this to enable Access Point to scan for channels dynamically.(2.4 GHz)|
||||DynChan confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
||||Note:|
||||Dyn chan export status:|
||||Disabled: Channel is static, DCS is disabled|
||||1: Channel set to auto, DCS is not set|
||||Enabled: Channel set to auto, DCS is set.|
|TimeBasedScan|No|Disable|Description:|
||||Select this to enable Time Based scan for Access Point.(2.4 GHz)|
||||TimeBasedScan confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
||||Note:|
||||Applicable only if Dyn Chan is enabled.|
|APType|No||Description:|
||||Specify 'type'.|
||||APType confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ChannelWidth|No|20MHz|Description:|
||||Specify 'channel_width'.|
||||ChannelWidth confines to:|
||||Type is 'SCALAR'.|
||||Only '20', '40', '80' are allowed.|
||||Note:|
||||Applicable only in 2.4GHz band.|
|Channel5GHz|No||Description:|
||||Select a channel that will be used by the access point.(5 GHz)|
||||Channel5GHz confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DynChan5GHz|No|Disable|Description:|
||||Select this to enable Access Point to scan for channels dynamically.(5 GHz)|
||||DynChan5GHz confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
||||Note:|
||||Dyn chan export status:|
||||Disabled: Channel is static, DCS is disabled|
||||1: Channel set to auto, DCS is not set|
||||Enabled: Channel set to auto, DCS is set.|
|TimeBasedScan5GHz|No|Disable|Description:|
||||Select this to enable Time Based scan for Access Point.(5 GHz)|
||||TimeBasedScan5GHz confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
||||Note:|
||||Applicable only if Dyn Chan is enabled.|
|Time|No||Description:|
||||Select Scan Time for the Access Point.|
||||Time confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Note:|
||||Applicable only if 'Time Based scan' is enabled.|
|TXPower5GHz|No|100%|Description:|
||||Select the transmission power output for 5 GHz band.|
||||TXPower5GHz confines to:|
||||Type is 'SCALAR'.|
||||Only '10%', '25%', '50%', '75%', '100%' are allowed.|
|STP|No|Disable|Description:|
||||Select to use Spanning Tree protocol (STP).|
||||STP confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|VLANTagging|No|Disable|Description:|
||||Select this to enable VLAN tagging and to connect Access Point with an existing VLAN Ethernet Interface.|
||||VLANTagging confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|APVLANID|No|2|Description:|
||||Specify the VLAN ID that will be used by the AP to connect to the appliance.|
||||APVLANID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 4094 is allowed.|
||||Maximum digits allowed are 4.|
||||Note:|
||||Available only when 'VLan Tagging' is selected.|
|Interface|No||Description:|
||||Select the interface on which you want to configure the access point.|
||||Interface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|LanMac|No||Description:|
||||Show the LAN MAC address of the access point.|
||||LanMac confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|WifiMac|No||Description:|
||||Show the Wi-Fi MAC address of the access point.|
||||WifiMac confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AllowedChannels|No||Description:|
||||Allowed channels for the access point.|
||||AllowedChannels confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|MeshID|No||Description:|
||||Select Mesh Networks for the Access Point.|
||||MeshID confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|ChannelWidth11a|No|40MHz|Description:|
||||Specify 'channel_width11a'.|
||||ChannelWidth11a confines to:|
||||Type is 'SCALAR'.|
||||Only '20', '40', '80' are allowed.|
||||Note:|
||||Applicable only in 5GHz band.|
|Band|Yes||Description:|
||||Select the band for the access point.|
||||Band confines to:|
||||Type is 'SCALAR'.|
||||Only '5GHz', '2.4GHz' are allowed.|
||||Note:|
||||Only for APX320 this value could be 2.4Ghz/5GHz. Other APs must use 2.4Ghz.|
|TXPower|No|100%|Description:|
||||Select the transmission power for the Access Point.|
||||TXPower confines to:|
||||Type is 'SCALAR'.|
||||Only '10%', '25%', '50%', '75%', '100%' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update Access Point|200|Access point "\<DynamicValue>" has been updated successfully|
|Update Access Point|500|Access point "\<DynamicValue>" could not be updated|
|Update Access Point|523|Access point "\<DynamicValue>" could not be updated. The group uses more than 8 wireless networks|
|Update Access Point|524|Access point "\<DynamicValue>" could not be updated. A maximum of 8 wireless networks per access point is supported|
|Update Access Point|542|Access point "\<DynamicValue>" could not be updated. The access point may only participate in one mesh network as mesh access point|
|Update Access Point|216|Access point "\<DynamicValue>" has been updated successfully|
|Update Access Point|541|Access point "\<DynamicValue>" could not be updated|
|Update Access Point|543|Access point "\<DynamicValue>" could not be updated|
|Update Access Point|545|Access point "\<DynamicValue>" could not be updated|
|Update Access Point|544|Access point "\<DynamicValue>" could not be updated|
|Update Access Point|547|Access point "\<DynamicValue>" could not be updated, the group and the AP have different VLAN settings. The access point inherits the VLAN settings from the group.|
|Update Access Point|548|Can't assign wireless networks with security mode set to WPA3 to access points.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
