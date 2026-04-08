# LDAPServer

- Operation: Add LDAP server / Edit LDAP server
- Description: Add or update LDAP servers.

## Sample Configuration

``` xml
<AuthenticationServer>
    <LDAPServer>
        <!-- For LDAP Server -->
        <ServerName>name</ServerName>
        <ServerAddress>ipaddress</ServerAddress>
        <Port>port</Port>
        <Version>2/3</Version>
        <AnonymousLogin>Enable/Disable</AnonymousLogin>
        <!-- Below two tags will be used when AnonymousLogin is "Disable" -->
        <Administrator>username</Administrator>
        <Password>password</Password>
        <AppendBaseDN>Enable/Disable</AppendBaseDN>
        <ConnectionSecurity>Simple/SSL/STARTTLS</ConnectionSecurity>
        <BaseDN>baseDN</BaseDN>
        <AuthenticationAttribute>uid</AuthenticationAttribute>
        <IntegrationType>LooseIntegration/TightIntegration</IntegrationType>
        <!-- Only For Tight Integration -->
        <DisplayNameAttribute>Text</DisplayNameAttribute>
        <EmailAddressAttribute>Text</EmailAddressAttribute>
        <GroupNameAttribute>attribute</GroupNameAttribute>
        <ExpiryDateAttribute>attribute</ExpiryDateAttribute>
    </LDAPServer>
</AuthenticationServer>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ServerType|No | |Description:|
||||Select Server type from the available options: LDAP Server, Active Directory or RADIUS Server.|
||||ServerType confines to:|
||||Type is 'SCALAR'.|
||||Only '2' are allowed.|
|ServerName|Yes | |Description:|
||||Specify name for the LDAP Server.|
||||ServerName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|ServerAddress|Yes | |Description:|
||||Specify IP Address of the LDAP Server.|
||||ServerAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS','IPADDRESS6','DOMAIN'.|
||||Maximum characters allowed are 255.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|AnonymousLogin|Yes |Enable |Description:|
||||Enable to log on to the LDAP Server as anonymous user where username and password is not to be sent.|
||||AnonymousLogin confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '0' are allowed.|
|Version|Yes | |Description:|
||||Select LDAP Version from the available options: 2 or 3.|
||||Version confines to:|
||||Type is 'SCALAR'.|
||||Only '2', '3' are allowed.|
|Administrator|Yes | |Description:|
||||Username (bind DN) to authenticate the firewall with the LDAP server if you turn off anonymous login.|
||||Administrator confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 100.|
|Password|No | |Description:|
||||Specify Password to logon to the LDAP Server if 'Anonymous Login' is disabled.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|ConnectionSecurity|Yes | |Description:|
||||Select the type of security for sending the user credentials in encrypted format.|
||||ConnectionSecurity confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '2', '3' are allowed.|
|ValidateServerCertificate|No | |Description:|
||||Select to validate the certificate of the LDAP Server.|
||||ValidateServerCertificate confines to:|
||||Type is 'SCALAR'.|
||||Only 'y', 'n' are allowed.|
|Client Certificate|No | |Description:|
||||Select a Client Certificate for secured connection.|
||||Client Certificate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AuthenticationAttribute|Yes | |Description:|
||||Specify Authentication attribute which is used for user search.|
||||AuthenticationAttribute confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 100.|
|IntegrationType|No | |Description:|
||||Select integration type which is used in setting the user group membership from the available options: Loose Integration or Tight Integration.|
||||IntegrationType confines to:|
||||Type is 'SCALAR'.|
||||Only '1' are allowed.|
|DisplayNameAttribute|No | |Description:|
||||Specify the name to be displayed to the user for the configured LDAP Server.|
||||DisplayNameAttribute confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 30.|
|EmailAddressAttribute|No |mail |Description:|
||||Specify name to be displayed to the user for configured Email Address.|
||||EmailAddressAttribute confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 30.|
|GroupNameAttribute|Yes | |Description:|
||||Specify the name to be displayed to the user for configured Group Name.|
||||GroupNameAttribute confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|ExpiryDateAttribute|Yes | |Description:|
||||Specify attribute to be displayed to the user for configured Expiry date.|
||||ExpiryDateAttribute confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|BaseDN|No | |Description:|
||||Specify the base distinguished name (Base DN) of the directory service or Click 'Get Base DN' to retrieve base DN.|
||||BaseDN confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AppendBaseDN|No | |Description:|
||||Enter Enable to append the base DN during the bind operation.|
||||AppendBaseDN confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '0' are allowed.|
|Port|Yes |389 |Description:|
||||Specify the port through which the Server communicates.|
||||Port confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Allowed port range: 1 to 65535|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add LDAP server|200|LDAP server "\<DynamicValue>" has been added successfully|
|Add LDAP server|500|LDAP server could not be added|
|Add LDAP server|502|LDAP server could not be added. Authentication server already exists|
|Add LDAP server|503|LDAP server could not be added. LDAP server with the same name or IP address already exists|
|Edit LDAP server|200|LDAP server "\<DynamicValue>" has been updated successfully|
|Edit LDAP server|500|LDAP server could not be updated|
|Edit LDAP server|503|LDAP server could not be updated. Server already exists|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
