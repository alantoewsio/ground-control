# LiveUserLogout

- Operation: API User Logout
- Description: User can logged out using API

## Sample Configuration

``` xml
<LiveUserLogout>
    <Admin>
        <UserName>adminName</UserName>
        <Password>adminPass</Password>
    </Admin>
    <UserName>{Guest Username}</UserName>
    <IPAddress>{Ipv4 Address}</IPAddress>
</LiveUserLogout>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Admin.UserName|Yes | |Description:|
||||Specify 'adminusername'|
||||UserName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Admin.Password|Yes | |Description:|
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

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|API User Logout|200|User logout successful|
|API User Logout|500|User logout failed|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
