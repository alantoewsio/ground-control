# User

- Operation: Add User / Add Admin User / Update Admin User / Update User
- Description: To Add/Update Users.

## Sample Configuration

``` xml
<User>
    <Username>username</Username>
    <Name>name</Name>
    <Password>password</Password>
    <PasswordHash>$2a$10$Y358hQyvWzsGVHEs6xevAurMhs6IuJinkTdMJpoTQkyvaAQz834mi</PasswordHash>
    <UserType>Administrator/User</UserType>
    <!-- For adminstrator Type -->
    <Profile>profile</Profile>
    <EmailList>
        <EmailID>email</EmailID>
    </EmailList>
    <Group>select</Group>
    <Description>Text</Description>
    <!-- Below policy if not defined fetch from group -->
    <SurfingQuotaPolicy>SurfingQuota</SurfingQuotaPolicy>
    <AccessTimePolicy>AccessTime</AccessTimePolicy>
    <DataTransferPolicy>DataTransfer</DataTransferPolicy>
    <QoSPolicy>Bandwidth</QoSPolicy>
    <SSLVPNPolicy>SSLVPN</SSLVPNPolicy>
    <SSLVPNIPv4Address>192.168.0.1</SSLVPNIPv4Address>
    <SSLVPNIPv6Address>abcd::dead</SSLVPNIPv6Address>
    <ClientlessPolicy>ClientlessPolicy</ClientlessPolicy>
    <L2TP>Enable/Disable</L2TP>
    <L2TPIp>ip address</L2TPIp>
    <PPTP>Enable/Disable</PPTP>
    <PPTPIp>ip address</PPTPIp>
    <IsEncryptCert>Enable/Disable</IsEncryptCert><!-- this tag is only applicable when PerUserCertificate is Enable in SSLTunnelAccessSettings -->
    <CISCO>Enable/Disable</CISCO>
    <CISCOIP>ipaddress</CISCOIP>
    <QuarantineDigest>Enable/Disable</QuarantineDigest>
    <SimultaneousLoginsGlobal>Enable/Disable</SimultaneousLoginsGlobal>
    <SimultaneousLogins>Unlimited/{count}</SimultaneousLogins>
    <MACBinding>Enable/Disable</MACBinding>
    <MACAddressList>
        <MACAddress>MACAddress</MACAddress>
        <MACAddress>MACAddress</MACAddress>
        <MACAddress>MACAddress</MACAddress>
    </MACAddressList>
    <LoginRestriction>AnyNode/UserGroupNode/SelectedNodes/NodeRange</LoginRestriction>
    <!-- For SelectedNodes -->
    <NodeList>
        <IPAddress>IPAddress</IPAddress>
        :
    </NodeList>
    <!-- For Node Range -->
    <FromIP>ip</FromIP>
    <ToIP>ip</ToIP>
    <ScheduleForApplianceAccess>All The Time</ScheduleForApplianceAccess>
    <LoginRestrictionForAppliance>AnyNode/</LoginRestrictionForAppliance>
    <AdminAccessNodeList>
        <IPAddress>IPAddress</IPAddress>
        :
    </AdminAccessNodeList>
    <!-- For Node Range -->
    <AdminAccessFromIP>ip</AdminAccessFromIP>
    <AdminAccessToIP>ip</AdminAccessToIP>
    <Status>active or deactive</Status><!-- this tag is only read purpose -->
</User>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Username|Yes | |Description:|
||||Specify Username to uniquely identify the user.|
||||Username confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|Name|Yes | |Description:|
||||Specify the name of the user.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|Password|No | |Description:|
||||Specify Password.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|UserType|No |User |Description:|
||||Select the type of user from the available options: User or Administrator.|
||||UserType confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Profile|Yes | |Description:|
||||Select Profile.|
||||Profile confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Note: This option is available only 'Administrator' User Type.|
|EmailID|No | |Description:|
||||Specify Email Address of the user.|
||||EmailID confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'EMAIL'.|
||||Multiple values are allowed.|
|Group|No | |Description:|
||||Select group to which the user is to be added.|
||||Group confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SurfingQuotaPolicy|No | |Description:|
||||Select the Surfing Quota Policy from the list.|
||||SurfingQuotaPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AccessTimePolicy|No | |Description:|
||||Select the Access Time Policy from the list.|
||||AccessTimePolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DataTransferPolicy|No | |Description:|
||||Select the Data Transfer Policy from the list.|
||||DataTransferPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|QoSPolicy|No | |Description:|
||||Select the QoS Policy from the list.|
||||QoSPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SSLVPNPolicy|No | |Description:|
||||Select SSL VPN policy from the list.|
||||SSLVPNPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SSLVPNIPv4Address|No | |Description:|
||||Enter an address from the reserved static IP address range shown on SSL VPN global settings.|
||||SSLVPNIPv4Address confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|SSLVPNIPv6Address|No | |Description:|
||||Enter an address from the reserved static IP address range shown on SSL VPN global settings.|
||||SSLVPNIPv6Address confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS6'.|
||||Maximum characters allowed are 45.|
|ClientlessPolicy|No | |Description:|
||||Select clientlesspolicy policy from the list.|
||||ClientlessPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|L2TP|No |Enable |Description:|
||||Enable to allow user to get access through L2TP connection.|
||||L2TP confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|L2TPIp|No | |Description:|
||||Specify the IP Address to be leased to the user for L2TP access.|
||||L2TPIp confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|PPTP|No |Disable |Description:|
||||Enable to allow user to get access through PPTP connection.|
||||PPTP confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|PPTPIp|No | |Description:|
||||Specify the IP Address to be leased to the user for PPTP access.|
||||PPTPIp confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|CISCO|No |Disable |Description:|
||||Enable to allow user to get access through CISCO connection.|
||||CISCO confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|CISCOIP|No | |Description:|
||||Specify the IP Address to be leased to the user for CISCO access.|
||||CISCOIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|QuarantineDigest|No |Enable |Description:|
||||Enable to send Quarantine digest daily to the user which is an email containing a list of quarantined spam messages filtered by the appliance.|
||||QuarantineDigest confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|MACBinding|No |Disable |Description:|
||||Enable to bind user with a group of MAC Addresses.|
||||MACBinding confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|MACAddress|No | |Description:|
||||Specify MAC Addresses for MAC binding which will allow users to login only from the specified MAC Addresses.|
||||MACAddress confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'MACADDRESS'.|
||||Multiple values are allowed.|
|LoginRestriction|No | |Description:|
||||Select appropriate option for user login restriction.|
||||LoginRestriction confines to:|
||||Type is 'SCALAR'.|
||||Only 'AnyNode', 'UserGroupNode', 'SelectedNodes', 'NodeRange' are allowed.|
|IPAddress|No | |Description:|
||||Specify the IPv4 Addresses of nodes from where the user will be allowed to login.|
||||IPAddress confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|FromIP|Yes | |Description:|
||||If Node Range option is selected for Login Restriction, specify the starting IPv4 Address for the range between which the users will be allowed to login.|
||||FromIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
|ToIP|Yes | |Description:|
||||If Node Range option is selected for Login Restriction, specify the ending IPv4 Address for the range between which the users will be allowed to login.|
||||ToIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
|ScheduleForApplianceAccess|Yes | |Description:|
||||Select Schedule for appliance access.|
||||ScheduleForApplianceAccess confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Note: This option is available only for Administrators.|
|LoginRestrictionForAppliance|Yes |AnyNode |Description:|
||||Select appropriate option for administrator login restriction.|
||||LoginRestrictionForAppliance confines to:|
||||Type is 'SCALAR'.|
||||Only 'AnyNode', 'SelectedNodes', 'NodeRange' are allowed.|
|AdminAccessFromIP|Yes | |Description:|
||||Specify the starting IPv4 Address for the range between which the administrator will be allowed to login.|
||||AdminAccessFromIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
|AdminAccessToIP|Yes | |Description:|
||||Specify the ending IPv4 Address for the range between which the administrator will be allowed to login.|
||||AdminAccessToIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add User|200|User "\<DynamicValue>" has been registered successfully|
|Add User|500|User could not be registered|
|Add User|502|User could not be registered. User or user group with the same name already exists, choose a different name|
|Add User|503|User could not be created. A user with same L2TP/PPTP IP address already exists|
|Add User|510|Invalid password. Password does not match with the complexity criteria|
|Add Admin User|200|User "\<DynamicValue>" has been registered successfully|
|Add Admin User|500|User could not be registered|
|Add Admin User|502|User could not be registered. User or user group with the same name already exists, choose a different name|
|Add Admin User|503|User could not be created. A user with same L2TP/PPTP IP address already exists|
|Add Admin User|510|Invalid password. Password does not match with the complexity criteria|
|Update User|200|User "\<DynamicValue>" has been updated successfully|
|Update User|500|User details could not updated|
|Update User|502|User could not be registered. User or user group with the same name already exists, choose a different name|
|Update User|503|User could not be updated. A user with same L2TP/PPTP IP address already exists|
|Update User|510|Invalid password. Password does not match with the complexity criteria|
|Update User|541|There must be at least one user as "Administrator"|
|Update User|542|There must be at least one user with "Administrator" profile|
|Update Admin User|200|User "\<DynamicValue>" has been updated successfully|
|Update Admin User|500|User details could not updated|
|Update Admin User|502|User could not be registered. User or user group with the same name already exists, choose a different name|
|Update Admin User|503|User could not be updated. A user with same L2TP/PPTP IP address already exists|
|Update Admin User|510|Invalid password. Password does not match with the complexity criteria|
|Update Admin User|541|There must be at least one user as "Administrator"|
|Update Admin User|542|There must be at least one user with "Administrator" profile|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
