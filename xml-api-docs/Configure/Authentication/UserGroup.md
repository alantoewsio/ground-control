# UserGroup

- Operation: Add Groups / Edit Groups
- Description: To Create/Edit Groups. Group is a collection of policies that can be applied to the users by simply assigning the appropriate group to the users.

## Sample Configuration

``` xml
<UserGroup>
    <GroupDetail>
        <Name>Name</Name>
        <After><Name>Name</Name></After>
        <GroupType>Normal/Clienless</GroupType>
        <!-- For Normal Group Type Configuration Parameters are as below -->
        <SurfingQuotaPolicy>SurfingQuota</SurfingQuotaPolicy>
        <AccessTimePolicy>AccessTime</AccessTimePolicy>
        <DataTransferPolicy>None</DataTransferPolicy>
        <QoSPolicy>None</QoSPolicy>
        <SSLVPNPolicy>No Policy Applied</SSLVPNPolicy>
        <ClientlessPolicy>No Policy Applied</ClientlessPolicy>
        <QuarantineDigest>Enable/Disable</QuarantineDigest>
        <MACBinding>Enable/Disable</MACBinding>
        <L2TP>Enable/Disable</L2TP>
        <PPTP>Enable/Disable</PPTP>
        <SophosConnectClient>Enable/Disable</SophosConnectClient>
        <LoginRestriction>AnyNode/SelectedNodes/NodeRange</LoginRestriction>
        <!-- For SelectedNodes -->
        <NodeList>
            <IPAddress>IPAddress</IPAddress>
            :
        </NodeList>
        <!-- For Node Range -->
        <FromIP>ip</FromIP>
        <ToIP>ip</ToIP>
        <!-- For Normal Group Type Configuration Parameters ends -->
        <!-- For Clientless Group Type Configuration Parameters are as below -->
        <QoSPolicy>None</QoSPolicy>
        <!-- For Clientless Group Type Configuration Parameters ends -->
    </GroupDetail>
    <GroupMembers>
        <GroupName>Name</GroupName>
        <UserName>admin</UserName>
        :
        :
    </GroupMembers>
</UserGroup>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name to identify the group.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 256.|
|GroupType|No | |Description:|
||||Select Group type from the available options: Normal or Clientless.|
||||GroupType confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|SurfingQuotaPolicy|No | |Description:|
||||Select the Surfing Quota policy from the list.|
||||SurfingQuotaPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AccessTimePolicy|No | |Description:|
||||Select the Access Time policy from the list.|
||||AccessTimePolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DataTransferPolicy|No | |Description:|
||||Select the Data Transfer policy from the list.|
||||DataTransferPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|QoSPolicy|Yes | |Description:|
||||Select the QoS policy from the list.|
||||QoSPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SSLVPNPolicy|No | |Description:|
||||Select SSL VPN policy from the list.|
||||SSLVPNPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ClientlessPolicy|No | |Description:|
||||Select Clientless policy from the list.|
||||ClientlessPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|QuarantineDigest|No |Disable |Description:|
||||Enable to send Quarantine digest daily to the user which is an email containing a list of quarantined spam messages filtered by the appliance.|
||||QuarantineDigest confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|MACBinding|No |Disable |Description:|
||||Enable to bind user with a group of MAC Addresses.|
||||MACBinding confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|L2TP|No |Disable |Description:|
||||Enable if group users can get access through L2TP connection.|
||||L2TP confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|PPTP|No |Disable |Description:|
||||Enable if group users can get access through PPTP connection.|
||||PPTP confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|SophosConnectClient|No |Disable |Description:|
||||Allows user groups to connect through Sophos Connect client.|
||||SophosConnectClient confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|LoginRestriction|Yes |Any Node |Description:|
||||Select appropriate option for user login restriction.|
||||LoginRestriction confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|IPAddress|No | |Description:|
||||Specify the IPv4 Addresses of nodes from where the users will be allowed to login.|
||||IPAddress confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|FromIP|Yes | |Description:|
||||If Node Range option is selected for Login Restriction, Specify the starting IPv4 Address for the range between which the users will be allowed to login.|
||||FromIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
|ToIP|Yes | |Description:|
||||If Node Range option is selected for Login Restriction, Specify the ending IPv4 Address for the range between which the users will be allowed to login.|
||||ToIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
|After.Name|No | |Description:|
||||Specify 'moveto'|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Groups|200|User group "\<DynamicValue>" has been created successfully|
|Add Groups|500|Group could not be created|
|Add Groups|502|Group could not be created. User or group with the same name already exists, choose a different name|
|Add Groups|503|Duplicate IP in login restriction|
|Edit Groups|200|User group "\<DynamicValue>" has been updated successfully|
|Edit Groups|500|Group details could not be updated|
|Edit Groups|502|Group could not be created. User or group with the same name already exists, choose a different name|
|Edit Groups|503|Duplicate IP in login restriction|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
