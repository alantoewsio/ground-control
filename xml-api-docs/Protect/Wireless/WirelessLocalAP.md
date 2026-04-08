# WirelessLocalAP

- Operation: Update Local AP
- Description: The page allows one to update Local AP.

## Sample Configuration

``` xml
<WirelessLocalAP>
    <Id>LocalWifi0/LocalWifi1</Id>
    <Country>In</Country>
    <WirelessNetworks>
        <Network>wlnet1</Network>
        <Network>wlnet2</Network>
    </WirelessNetworks>
    <BridgeToEthernet>Enable</BridgeToEthernet>
    <BridgeToPort>eth1</BridgeToPort>
    <Zone>LAN</Zone>
    <Band>2.4GHz/5GHz</Band>
    <Channel2.4GHz>Auto/1/2/3</Channel2.4GHz>
    <DynChan>Enable</DynChan>
    <TimeBasedScan>Enable</TimeBasedScan>
    <ScanTime>
        <Time>All Time on Weekends</Time>
    </ScanTime>
    <TXPower>100</TXPower>
</WirelessLocalAP>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Id|Yes||Description:|
||||Displays ID of the Access Point.|
||||Id confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Label|No||Description:|
||||Specify label.|
||||Label confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Country|Yes||Description:|
||||Select Country where the Access Point is located.|
||||Country confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Network|No||Description:|
||||Select Wireless Networks for the Access Point.|
||||Network confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|BridgeToEthernet|Yes||Description:|
||||Enable to bridge the wireless networks to Ethernet.|
||||BridgeToEthernet confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
||||Note:|
||||Applicable only for the wireless networks that are of type, Bridge To LAN.|
|DynChan|No|Disable|Description:|
||||Select this to enable Access Point to scan for channels dynamically.(2.4 GHz)|
||||DynChan confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|TimeBasedScan|No|Disable|Description:|
||||Select this to enable Time Based scan for Access Point.(2.4 GHz)|
||||TimeBasedScan confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
||||Note:|
||||Applicable only if Dyn Chan is enabled.|
|Channel|Yes||Description:|
||||Select a channel that will be used by the access point.(2.4 GHz)|
||||Channel confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ChannelWidth|No|20MHz|Description:|
||||Determines the speed and throughput of the frequency band in use.|
||||ChannelWidth confines to:|
||||Type is 'SCALAR'.|
||||Only '20', '40' are allowed.|
||||Note:|
||||Applicable only in 2.4GHz band.|
|Channel5GHz|No||Description:|
||||Channel that access point must use for 5 GHz.|
||||Channel5GHz confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|TimeBasedScan5GHz|No|Disable|Description:|
||||Turns time-based scan on or off for the access point (5 Ghz).|
||||TimeBasedScan5GHz confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
||||Note:|
||||Applicable only if Dyn Chan is enabled.|
|Time|No||Description:|
||||Scan time for access point.|
||||Time confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Note:|
||||Applicable only if 'Time Based scan' is enabled.|
|TXPower5GHz|No|100%|Description:|
||||Transmission power output for 5 GHz band.|
||||TXPower5GHz confines to:|
||||Type is 'SCALAR'.|
||||Only '10%', '25%', '50%', '75%', '100%' are allowed.|
|DynChan5GHz|No|Disable|Description:|
||||Allow or stop access point's dynamic scan for 5 GHz band.|
||||DynChan5GHz confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
||||Note:|
||||Dyn chan export status:|
||||Disabled: Channel is static, DCS is disabled|
||||1: Channel set to auto, DCS is not set|
||||Enabled: Channel set to auto, DCS is set.|
|ChannelWidth11a|No|40MHz|Description:|
||||Determines the speed and throughput of 5 GHz band.|
||||ChannelWidth11a confines to:|
||||Type is 'SCALAR'.|
||||Only '20', '40', '80' are allowed.|
||||Note:|
||||Applicable only in 5GHz band.|
|BridgeToPort|No||Description:|
||||Select Port to create bridge with wireless network.|
||||BridgeToPort confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Note:|
||||The interface must have an IP address and should not belong to the WAN port or any other bridge.|
|Zone|No||Description:|
||||Select Zone for bridge connection.|
||||Zone confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|TXPower|Yes|100%|Description:|
||||Select the transmission power for the Access Point.|
||||TXPower confines to:|
||||Type is 'SCALAR'.|
||||Only '10%', '25%', '50%', '75%', '100%' are allowed.|
|Band|Yes||Description:|
||||Select Local AP band, either 2.4Ghz or 5Ghz.|
||||Band confines to:|
||||Type is 'SCALAR'.|
||||Only '5GHz', '2.4GHz' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update Local AP|200|Access point "\<DynamicValue>" has been updated successfully|
|Update Local AP|500|Access point "\<DynamicValue>" could not be updated|
|Update Local AP|523|Access point "\<DynamicValue>" could not be updated. The group uses more than 8 wireless networks|
|Update Local AP|524|Access point "\<DynamicValue>" could not be updated. A maximum of 8 wireless networks per access point is supported|
|Update Local AP|542|Access point "\<DynamicValue>" could not be updated. The access point may only participate in one mesh network as mesh access point|
|Update Local AP|216|Access point "\<DynamicValue>" has been updated successfully|
|Update Local AP|541|Access point "\<DynamicValue>" could not be updated|
|Update Local AP|543|Access point "\<DynamicValue>" could not be updated|
|Update Local AP|545|Access point "\<DynamicValue>" could not be updated|
|Update Local AP|544|Access point "\<DynamicValue>" could not be updated|
|Update Local AP|547|Access point "\<DynamicValue>" could not be updated, the group and the AP have different VLAN settings. The access point inherits the VLAN settings from the group.|
|Update Local AP|548|Can't assign wireless networks with security mode set to WPA3 to access points.|
|Update Local AP|561|You can only assign wireless networks with security mode set to WPA2 or later to LocalWIFI0.|
|Update Local AP|564|To assign the following wireless networks to LocalWIFI0, you must set their encryption mode to AES: \<DynamicValue>.|
|Update Local AP|565|You can't import LocalWifi0 configuration from Wi-Fi 6 to Wi-Fi 5 devices.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
