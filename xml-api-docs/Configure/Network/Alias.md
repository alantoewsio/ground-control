# Alias

- Operation: Add Alias / Edit Alias
- Description: To Add/Update Alias. Alias allows binding multiple IP addresses onto a single Physical interface.

## Sample Configuration

``` xml
<Alias>
    <Name>Name of Alias</Name>
    <Interface>PortA</Interface>
    <IPFamily>IPv4/IPv6</IPFamily>
    <!-- If IPv4 -->
    <IPAddress>1.1.1.1</IPAddress>
    <Netmask>25.0.0.0</Netmask>
    <!-- If IPv6 -->
    <IPv6>ipv4 address</IPv6>
    <Prefix>Number</Prefix>
</Alias>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Name of Interface on which new alias is added.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||UTF-8 character(s) are allowed.|
|IPFamily|No | |Description:|
||||Select IP Family for Alias.|
||||IPFamily confines to:|
||||Type is 'SCALAR'.|
||||Only 'IPv4', 'IPv6' are allowed.|
|IPAddress|Yes | |Description:|
||||Specify IPv4 Address for IPv4 Family.|
||||IPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'NETWORKBROADCAST', 'NETWORKIP' is allowed.|
|Netmask|Yes | |Description:|
||||Specify Network Subnet mask for IPv4 Family.|
||||Netmask confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|IPv6|Yes | |Description:|
||||Specify IPv6 Address for IPv6 Family.|
||||IPv6 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS6'.|
||||Maximum characters allowed are 45.|
||||IP Class other than 'MULTICAST', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL', 'NETWORKBROADCAST', 'NETWORKIP' is allowed.|
|Prefix|Yes | |Description:|
||||Specify Network Subnet mask Prefix for IPv6 Family.|
||||Prefix confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 128 is allowed.|
||||Maximum digits allowed are 3.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Alias|200|Interface alias "\<DynamicValue>" has been added successfully|
|Add Alias|500|Interface alias "\<DynamicValue>" could not be added|
|Add Alias|502|Interface with same IP address already exists, choose a different IP address.|
|Add Alias|507|Alias could not be created. The given IP address is already a part of IP lease range in SSL VPN|
|Add Alias|508|This IP address is assigned to either peer administration port or peer dedicated port of HA cluster|
|Add Alias|522|Alias could not be added for "\<DynamicValue>". Only 64 aliases can be added for an IPv6 interface|
|Add Alias|523|Alias could not be added for "\<DynamicValue>". Only 256 aliases can be added for an IPv4 interface|
|Edit Alias|200|Interface alias "\<DynamicValue>" has been updated successfully|
|Edit Alias|500|Interface alias "\<DynamicValue>" could not be updated|
|Edit Alias|502|Interface with same IP address already exists, choose a different IP address.|
|Edit Alias|507|Alias could not be updated. The given IP address is already a part of IP lease range in SSL VPN|
|Edit Alias|508|This IP address is assigned to either peer administration port or peer dedicated port of HA cluster|
|Edit Alias|510|Interface-based virtual host with the same IP address already exists. Choose a different IP address for the virtual host|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
