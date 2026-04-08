# UpdateClientlessUser

- Operation: Update Client Less Users
- Description: Update Clientless Users.

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
||||Username with which the User logs in.|
||||Username confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Name|Yes | |Description:|
||||Name of the User.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|IP Address|No | |Description:|
||||IP Address from which the User logs in.|
||||IP Address confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS','IPADDRESS6'.|
||||Maximum characters allowed are 45.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|Group|Yes | |Description:|
||||Group name to which the User belongs.|
||||Group confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Email|Yes | |Description:|
||||Email Address of the User.|
||||Email confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Allowed: Valid Email ID.|
|Web Filter|Yes | |Description:|
||||Web filter policy applied to the User.|
||||Web Filter confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|App Filter|Yes | |Description:|
||||Application filter policy applied to the User.|
||||App Filter confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|QOS|Yes | |Description:|
||||QoS policy applied to the User.|
||||QOS confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Spam Digest|Yes |Disable |Description:|
||||Enable/Disable Spam Digest.|
||||Spam Digest confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update Client Less Users|200|Clientless user "\<DynamicValue>" details have been updated successfully|
|Update Client Less Users|500|User details could not be updated|
|Update Client Less Users|503|Clientless user with the same IP address already exists, choose a different IP address|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
