# AddClientlessUser

- Operation: Add Clientless Users
- Description: Create Clientless Users who can bypass Client login and access the internet.

## Sample Configuration

``` xml
<ClientlessUser>
    <UserName>Username</UserName>
    <IPAddress>ipaddress</IPAddress>
    <ClientLessGroup>group</ClientLessGroup>
    <Name>name</Name>
    <Email>email</Email>
    <Description>Text</Description>
    <QuarantineDigest>ApplyGroupSettings/Enable/Disable</QuarantineDigest>
    <!--only for Edit -->
    <QoSPolicy>None</QoSPolicy>
    <Status>Active/Inactive</Status>
</ClientlessUser>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Username|Yes | |Description:|
||||Specify Username which uniquely identifies the user.|
||||Username confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|IP Address|No | |Description:|
||||Specify IPv4/IPv6 address for the Clientless user.|
||||IP Address confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'IPADDRESS','IPADDRESS6'.|
||||Maximum characters allowed are 45.|
||||Multiple values are allowed.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|Group|Yes | |Description:|
||||Select the group in which user is to added.|
||||Group confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Name|Yes | |Description:|
||||Specify name of the user.|
||||Name confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Email|Yes | |Description:|
||||Specify Email Address.|
||||Email confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Allowed: Valid Email ID.|
|Spam Digest|No | |Description:|
||||Select option for sending Quarantine Digest to the user.|
||||Spam Digest confines to:|
||||Type is 'ARRAY'.|
||||Only 'ApplyGroupSettings', 'Disable', 'Enable' are allowed.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Clientless Users|200|One or more clientless users have been registered successfully|
|Add Clientless Users|500|Some of the clientless users could not be registered|
|Add Clientless Users|502|User could not be registered. User or user group with the same name already exists, choose a different name|
|Add Clientless Users|503|Clientless user with the same IP address already exists, choose a different IP address|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
