# UnicastRoute

- Operation: Add Unicast Route / Update Unicast Route
- Description: To Add/Update Unicast Route. A Route provides the appliance with the information it needs to forward a packet to a particular destination.

## Sample Configuration

``` xml
<UnicastRoute>
    <IPFamily>IPv4/IPv6</IPFamily>
    <DestinationIP>ipaddress</DestinationIP>
    <Netmask>0.0.0.0</Netmask>
    <Gateway>ipaddress</Gateway>
    <Interface>{interface}/Blackhole</Interface>
    <Distance>0</Distance>
    <AdministrativeDistance>1</AdministrativeDistance>
    <Blackhole>Enable/Disable</Blackhole>
    <Status>ON/OFF</Status>
    <Description />
    <OldConfiguration>
        <DestinationIP>ipaddress</DestinationIP>
        <Netmask>0.0.0.0</Netmask>
        <Gateway>ipaddress</Gateway>
        <Interface>{interface}/Blackhole</Interface>
        <Distance>0</Distance>
        <AdministrativeDistance>1</AdministrativeDistance>
        <Blackhole>Enable/Disable</Blackhole>
        <Status>ON/OFF</Status>
        <Description />
    </OldConfiguration>
</UnicastRoute>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|DestinationIP|Yes | |Description:|
||||Specify destination IPv4/IPv6 address.|
||||DestinationIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS6'.|
||||Maximum characters allowed are 45.|
||||IP Class other than 'MULTICAST', 'LOCALHOST' is allowed.|
|Netmask|Yes | |Description:|
||||Select Network Subnet mask prefix from the available options.|
||||Netmask confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 128 is allowed.|
|Gateway|No | |Description:|
||||Specify Gateway IPv4 address.|
||||Gateway confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS','IPADDRESS6'.|
||||Maximum characters allowed are 45.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|Interface|No | |Description:|
||||Select interface from the options available.|
||||Interface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Distance|No |0 |Description:|
||||Specify metric for routing.|
||||Distance confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 255 is allowed.|
||||Maximum digits allowed are 3.|
|IPFamily|No |IPv4 |Description:|
||||Specify 'ipfamily'|
||||IPFamily confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|AdministrativeDistance|No |1 |Description:|
||||Specify administrative distance for routing.|
||||AdministrativeDistance confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 255 is allowed.|
||||Maximum digits allowed are 3.|
|Blackhole|No | |Description:|
||||Creates or removes a blackhole route.|
||||Blackhole confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Status|No |ON |Description:|
||||To turn the static route on or off.|
||||Status confines to:|
||||Type is 'SCALAR'.|
||||Only 'ON', 'OFF' are allowed.|
|Description|No | |Description:|
||||Description for the static route.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Unicast Route|200|Added the following unicast route: "\<DynamicValue>"|
|Add Unicast Route|500|Couldn't add the following unicast route: "\<DynamicValue>"|
|Add Unicast Route|502|Unicast route "\<DynamicValue>" already exists|
|Add Unicast Route|510|Gateway and prefix not in range|
|Add Unicast Route|511|Couldn't apply the unicast route|
|Add Unicast Route|527|Can't use this gateway IP address. It's assigned to a local firewall interface|
|Add Unicast Route|528|A destination IP address can't have more than 16 ECMP routes|
|Add Unicast Route|541|Invalid gateway IP address. It must be in the interface IP address range|
|Update Unicast Route|200|Updated the following unicast route: "\<DynamicValue>"|
|Update Unicast Route|500|Couldn't update the following unicast route: "\<DynamicValue>"|
|Update Unicast Route|502|Unicast route "\<DynamicValue>" already exists|
|Update Unicast Route|510|Gateway and prefix not in range|
|Update Unicast Route|511|Couldn't apply the unicast route|
|Update Unicast Route|526|Record doesn't exist for the unicast route|
|Update Unicast Route|527|Can't use this gateway IP address. It's assigned to a local firewall interface|
|Update Unicast Route|528|A destination IP address can't have more than 16 ECMP routes|
|Update Unicast Route|541|Invalid gateway IP address. It must be in the interface IP address range|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
