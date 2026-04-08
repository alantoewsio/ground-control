# WiFi6Interface

- Operation: WiFi6Interface
- Description: Manage LocalWiFi6 interfaces and view Port wise Network and Zone details.

## Sample Configuration

``` xml
<WiFi6Interface>
    <Name>Descriptive name of Interface</Name>
    <Hardware>interfacename</Hardware>
    <Zone>LAN/WIFI/None</Zone>
    <IPv4Address>ipv4address</IPv4Address>
    <Netmask>IPv4netmask</Netmask>
</WiFi6Interface>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Name of the LocalWiFi6 interface.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 58.|
|Hardware|Yes | |Description:|
||||Hardware name of the LocalWiFi6 interface.|
||||Hardware confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Zone|Yes | |Description:|
||||Zone the interface belongs to.|
||||Zone confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed first characters: Alphanumeric characters (A-Za-z1-9) and not a zero (0). For other characters: (A-Za-z0-9_)|
|IPv4Address|No | |Description:|
||||IPv4 address of the interface.|
||||IPv4Address confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|Netmask|No | |Description:|
||||IPv4 subnet of the interface.|
||||Netmask confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 15.|
||||IPv4 Address should be between: [128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255]|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|WiFi6Interface|200|Updated interface "\<DynamicValue>"|
|WiFi6Interface|500|Interface "\<DynamicValue>" could not be updated|
|WiFi6Interface|502|IP address is assigned to some other interface|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
