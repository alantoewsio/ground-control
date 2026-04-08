# HealthCheckProfile

- Operation: Add health check profile / Update the health check profile
- Description: Health check to determine if the object is active.

## Sample Configuration

``` xml
<HealthCheckProfile>
    <Name>{HealthCheckProfileName}</Name>
    <IPFamily>{IPv4/IPv6}</IPFamily>
    <ProbeInterval />
    <ResponseTimeout />
    <ProbesResponseFailure />
    <ProbeResponseSuccess />
    <ProbeTargets>
        <ProbeTarget>
            <monitormethod />
            <monitorip />
            <port />
            <operator />
        </ProbeTarget>
        <ProbeTarget>
            <monitormethod />
            <monitorip />
            <port />
            <operator />
        </ProbeTarget>
    </ProbeTargets>
    <Status />
</HealthCheckProfile>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|IPFamily|No |IPv4 |Description:|
||||Specify IPv4 or IPv6.|
||||IPFamily confines to:|
||||Type is 'SCALAR'.|
||||Maximum characters allowed are 1.|
||||Only 'IPv4', 'IPv6' are allowed.|
|ProbeInterval|No |60 |Description:|
||||Interval between health check probes.|
||||ProbeInterval confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 65535 is allowed.|
|ProbesResponseFailure|No |1 |Description:|
||||Number of consecutive responses required to activate the object.|
||||ProbesResponseFailure confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 10 is allowed.|
|ProbeResponseSuccess|No |3 |Description:|
||||Number of consecutive probes without a response before deactivating the object.|
||||ProbeResponseSuccess confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 10 is allowed.|
|monitormethod|Yes | |Description:|
||||Protocol used in health check probes.|
||||monitormethod confines to:|
||||Type is 'SCALAR'.|
||||Only 'TCP', 'PING' are allowed.|
|monitorip|No | |Description:|
||||IP address to monitor.|
||||monitorip confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS','IPADDRESS6','DOMAINNAMELOOKUP'.|
||||Maximum characters allowed are 45.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST' is allowed.|
|port|No | |Description:|
||||Port to monitor.|
||||port confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 65535 is allowed.|
||||Maximum digits allowed are 5.|
|operator|No || |Description:|
||||Allows you to add a list of objects.|
||||operator confines to:|
||||Type is 'SCALAR'.|
||||Only '&', '|' are allowed.|
|ProbeTargets|No | |Description:|
||||Specify 'monitorDetails'|
||||ProbeTargets confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'OBJECT'.|
||||monitorDetails|
||||Multiple values are allowed.|
|ResponseTimeout|No |2 |Description:|
||||Time in which the object must respond to indicate its status.|
||||ResponseTimeout confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 10 is allowed.|
|Name|Yes | |Description:|
||||Name of the health check profile.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 125.|
||||UTF-8 character(s) are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add health check profile|200|Created SD-WAN profile "\<DynamicValue>"|
|Add health check profile|500|Couldn't create SD-WAN profile "\<DynamicValue>"|
|Add health check profile|502|Couldn't create the profile. SD-WAN profile with the name "\<DynamicValue>" exists|
|Update the health check profile|200|Updated the SD-WAN profile "\<DynamicValue>"|
|Update the health check profile|500|Couldn't update SD-WAN profile "\<DynamicValue>"|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
