# ARP_Add

- Operation: Add Static Neighbour / Edit Static Neighbour
- Description: This json is used to add Static Neighbour This json is used to update Static Neighbour

## Sample Configuration

``` xml
<ARP_Add>
    <IPAddress>192.168.1.100</IPAddress>
    <MACAddress>00:11:22:33:44:55</MACAddress>
    <Interface>Port1</Interface>
    <AddAsATrustedMACAddress>Enable</AddAsATrustedMACAddress>
    <neighname>StaticNeighbour1</neighname>
    <neighid>neigh001</neighid>
    <IPFamily>IPv4</IPFamily>
</ARP_Add>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|IPAddress|Yes | |Description:|
||||Specify 'ipaddress'|
||||IPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|MACAddress|Yes | |Description:|
||||Specify 'macaddress'|
||||MACAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'MACADDRESS'.|
||||Maximum characters allowed are 17.|
|Interface|No | |Description:|
||||Specify 'port'|
||||Interface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AddAsATrustedMACAddress|No | |Description:|
||||Specify 'chkadd'|
||||AddAsATrustedMACAddress confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|
|neighname|Yes | |Description:|
||||Specify 'neighname'|
||||neighname confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||NoComma|
||||Maximum characters allowed are 20.|
|neighid|No | |Description:|
||||Specify 'neighid'|
||||neighid confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||NoComma|
||||Maximum characters allowed are 50.|
|IPFamily|Yes | |Description:|
||||Specify 'ipfamily'|
||||IPFamily confines to:|
||||Type is 'SCALAR'.|
||||Only 'IPv4', 'IPv6' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Static Neighbour|200|Operation Successful.|
|Add Static Neighbour|500|Operation Fail.|
|Edit Static Neighbour|200|Operation Successful.|
|Edit Static Neighbour|500|Operation Fail.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
