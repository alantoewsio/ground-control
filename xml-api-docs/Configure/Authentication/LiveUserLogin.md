# LiveUserLogin

- Operation: API User Login
- Description: User can logged-in using API

## Sample Configuration

``` xml
<LiveUserLogin>
    <Admin>
        <UserName>adminName</UserName>
        <Password>adminPass</Password>
    </Admin>
    <UserName>{Guest Usename}</UserName>
    <IPAddress>{IPv4Address}</IPAddress>
    <MacAddress>{MAC Address}</MacAddress>
    <GroupName>{Group Name}</GroupName>
    <DeviceType>iOS/Android/iPhone/iPad</DeviceType>
</LiveUserLogin>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Admin.UserName|No | |Description:|
||||Specify 'adminusername'|
||||UserName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Admin.Password|No | |Description:|
||||Specify 'adminpassword'|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|UserName|Yes | |Description:|
||||Specify 'username'|
||||UserName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|IPAddress|Yes | |Description:|
||||Specify 'ipaddress'|
||||IPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS','IPADDRESS6'.|
||||Maximum characters allowed are 45.|
|MacAddress|No | |Description:|
||||Specify 'macaddress'|
||||MacAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'MACADDRESS'.|
||||Maximum characters allowed are 17.|
|GroupName|No | |Description:|
||||Specify 'groupname'|
||||GroupName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DeviceType|No | |Description:|
||||Specify 'devicetype'|
||||DeviceType confines to:|
||||Type is 'SCALAR'.|
||||Only 'iOS', 'Android' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|API User Login|200|User login successful|
|API User Login|500|User login failed|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
