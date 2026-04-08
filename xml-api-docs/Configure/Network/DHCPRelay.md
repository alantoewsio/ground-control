# DHCPRelay

- Operation: Add DHCP Relay Configuration / Edit DHCP Relay Configuration
- Description: To Add/Update DHCP Relay Agent Configuration which enables DHCP Clients to obtain IP Addresses from DHCP Server on remote Subnet.

## Sample Configuration

``` xml
<DHCPRelay>
    <Name>dhcprelayname</Name>
    <IPFamily>IPv4/IPv6</IPFamily>
    <Interface>PortA</Interface>
    <DHCPServerIP>ipaddress</DHCPServerIP>
    <RelaythroughIPSec>Enable/Disable</RelaythroughIPSec>
</DHCPRelay>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify name for DHCP Relay Agent.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|IPFamily|Yes |IPv4 |Description:|
||||Select the type of IP family.|
||||IPFamily confines to:|
||||Type is 'SCALAR'.|
||||Only 'IPv4', 'IPv6' are allowed.|
|Interface|Yes | |Description:|
||||Select the interface on which DHCP Relay Agent is to be configured.|
||||Interface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DHCPServerIP|Yes | |Description:|
||||Specify DHCP Server IP Address.|
||||DHCPServerIP confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'IPADDRESS','IPADDRESS6'.|
||||Maximum characters allowed are 15.|
||||Multiple values are allowed.|
||||Duplicate values will be ignored.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|RelaythroughIPSec|No |Disable |Description:|
||||Click to enable Relay through IPSec.|
||||RelaythroughIPSec confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add DHCP Relay Configuration|200|DHCP relay configuration has been added successfully|
|Add DHCP Relay Configuration|500|DHCP relay configuration could not be added|
|Add DHCP Relay Configuration|502|DHCP relay with the same name already exists. Please choose a different name|
|Add DHCP Relay Configuration|510|Interface IP address could not be configured as DHCP server IP|
|Edit DHCP Relay Configuration|200|DHCP relay configuration has been updated successfully|
|Edit DHCP Relay Configuration|500|DHCP relay configuration could not be updated|
|Edit DHCP Relay Configuration|502|DHCP relay with the same name already exists. Please choose a different name|
|Edit DHCP Relay Configuration|510|Interface IP address could not be configured as DHCP server IP|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
