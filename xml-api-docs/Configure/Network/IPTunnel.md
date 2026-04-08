# IPTunnel

- Operation: Add IP Tunnel / Edit IP Tunnel
- Description: To Add/Edit IP Tunnel. IP Tunnel is an Internet Protocol network communications path between two networks.

## Sample Configuration

``` xml
<IPTunnel>
    <Name>displayname</Name>
    <Hardware>interfacename</Hardware>
    <TunnelType>6in4/6to4/6rd/4in6</TunnelType>
    <Zone>zonename</Zone>
    <LocalEndPoint>ipaddress</LocalEndPoint>
    <RemoteEndPoint>ipaddress</RemoteEndPoint>
    <TTL>Number</TTL>
    <TOS>Number</TOS>
    <Prefix>Text</Prefix>
</IPTunnel>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|No | |Description:|
||||Specify a descriptive name for the tunnel.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 58.|
|TunnelType|Yes | |Description:|
||||Select the type of tunnel from the available options: 6in4, 6to4, 6rd or 4in6.|
||||TunnelType confines to:|
||||Type is 'SCALAR'.|
||||Only '6in4', '6to4', '6rd', '4in6' are allowed.|
|Zone|Yes | |Description:|
||||Select the Zone from the available options: LAN, WAN or DMZ.|
||||Zone confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|LocalEndPoint|Yes | |Description:|
||||Specify IP Address of the Local End Point of the tunnel.|
||||LocalEndPoint confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|RemoteEndPoint|Yes | |Description:|
||||Specify IP Address of the Remote End Point of the tunnel.|
||||RemoteEndPoint confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|TTL|No |0 |Description:|
||||Specify the life time of data.|
||||TTL confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 255 is allowed.|
|TOS|No |0 |Description:|
||||Specify the priority of data.|
||||TOS confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 99 is allowed.|
|Prefix|No | |Description:|
||||Specify Prefix if selected tunnel type is '6rd'.|
||||Prefix confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Hardware|No | |Description:|
||||Specify a name for the tunnel.|
||||Hardware confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed first characters: (A-Za-z). For other characters: (A-Za-z0-9_)|
||||Maximum characters allowed are 10.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add IP Tunnel|200|IP tunnel "\<DynamicValue>" has been created successfully|
|Add IP Tunnel|500|IP tunnel "\<DynamicValue>" could not be created|
|Add IP Tunnel|502|Hardware name "\<DynamicValue>" exists as a specified or system-reserved name. Specify a different name.|
|Add IP Tunnel|503|IP tunnel could not be created. A tunnel with the same endpoint(s) already exists|
|Add IP Tunnel|505|Interface name exists.|
|Edit IP Tunnel|200|IP tunnel "\<DynamicValue>" has been updated successfully|
|Edit IP Tunnel|500|IP tunnel "\<DynamicValue>" could not be updated|
|Edit IP Tunnel|503|IP tunnel could not be updated. A tunnel with the same endpoint(s) already exists|
|Edit IP Tunnel|505|Interface name exists.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
