# AuthCTA

- Operation: Update STAS
- Description: To set up STAS.

## Sample Configuration

``` xml
<AuthCTA>
    <EnableDisable>
        <ACTION>Enable/Disable</ACTION>
    </EnableDisable>
    <Collector>
        <CollectorPort>2323</CollectorPort>
        <CollectorIp>1.2.3.4</CollectorIp>
        <CollectorGroup>1</CollectorGroup>
    </Collector>
    <Settings>
        <IdentityProbeTimeout>44</IdentityProbeTimeout>
        <RestrictClientTraffic>Yes</RestrictClientTraffic>
        <UserInactivity>Enable</UserInactivity>
        <InactivityTimer>3</InactivityTimer>
        <DataTransferThreshold>100</DataTransferThreshold>
    </Settings>
    <VpnZone>
        <VPNSourceIP>1.2.3.5</VPNSourceIP>
        <VPNSourceMask>255.255.255.0</VPNSourceMask>
    </VpnZone>
</AuthCTA>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|CollectorIp|No | |Description:|
||||Collector IP address|
||||CollectorIp confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
|CollectorPort|No | |Description:|
||||Collector port|
||||CollectorPort confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Allowed port range: 1 to 65535|
|CollectorGroup|No | |Description:|
||||Collector group|
||||CollectorGroup confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|IdentityProbeTimeout|No | |Description:|
||||Identity probe time-out.|
||||IdentityProbeTimeout confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 120 is allowed.|
|RestrictClientTraffic|No | |Description:|
||||Restrict client traffic during identity probe.|
||||RestrictClientTraffic confines to:|
||||Type is 'SCALAR'.|
||||Only 'Yes', 'No' are allowed.|
|UserInactivity|No | |Description:|
||||Turn on user inactivity checks.|
||||UserInactivity confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|InactivityTimer|No | |Description:|
||||Signs out users after the specified period of inactivity.|
||||InactivityTimer confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 3 to 1440 is allowed.|
|DataTransferThreshold|No | |Description:|
||||Minimum data that users must transfer during the specified period to be considered active.|
||||DataTransferThreshold confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 4294967295 is allowed.|
|VPNSourceIP|No | |Description:|
||||Source IP address of VPN.|
||||VPNSourceIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|VPNSourceMask|No | |Description:|
||||Netmask of VPN source.|
||||VPNSourceMask confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 15.|
||||IPv4 Address should be between: [128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255]|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update STAS|200| |
|Update STAS|502| |
|Update STAS|543| |
|Update STAS|544|Collector IP/port is missing|
|Update STAS|545|VPN IP is missing|
|Update STAS|546| |
|Update STAS|547| |
|Update STAS|548|Collector IP/port is missing|
|Update STAS|549| |
|Update STAS|550| |
|Update STAS|500| |

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
