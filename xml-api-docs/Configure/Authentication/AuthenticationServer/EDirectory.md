# EDirectory

- Operation: Add Active Directory server / Edit Active Directory server
- Description: Add or update Active Directory servers.

## Sample Configuration

``` xml
<AuthenticationServer>
    <EDirectory>
        <ServerName>name</ServerName>
        <ServerAddress>ipaddress</ServerAddress>
        <Port>port</Port>
        <TreeName>tree</TreeName>
        <Administrator>username</Administrator>
        <Password>password</Password>
        <ProfileDN>profile DN</ProfileDN>
        <ConnectionSecurity>Simple/SSL/StartTLS</ConnectionSecurity>
        <ValidCertReq>Enable/Disable</ValidCertReq>
        <IntegrationType>LooseIntegration/TightIntegration</IntegrationType>
        <DisplayNameAttribute>Text</DisplayNameAttribute>
        <EmailAddressAttribute>Text</EmailAddressAttribute>
        <Context>context</Context>
        <SearchQueries>
            <Query>Text</Query>
            ...
        </SearchQueries>
    </EDirectory>
</AuthenticationServer>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ServerName|Yes | |Description:|
||||Specify a name for identifying the Server.|
||||ServerName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|ServerIpDomain/ServerAddress|Yes | |Description:|
||||Specify IP Address of the Server.|
||||ServerIpDomain/ServerAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS','IPADDRESS6','DOMAIN'.|
||||Maximum characters allowed are 255.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|Port|Yes |389 |Description:|
||||Specify port number through which the Server communicates.|
||||Port confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Allowed port range: 1 to 65535|
|TreeName|No | |Description:|
||||Specify the tree name.|
|Administrator/Username|Yes | |Description:|
||||Specify admin username to access eDirectory.|
||||Administrator/Username confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 100.|
||||UTF-8 character(s) are allowed.|
|Password|No | |Description:|
||||Specify admin password to access eDirectory.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|ProfileDN|No | |Description:|
||||Specify the profile distinguished name.|
|ConnectionSecurity|Yes | |Description:|
||||Select the type of Connection Security for sending the Username and Password to the external Server from the available options: Simple, SSL or STARTTLS.|
||||ConnectionSecurity confines to:|
||||Type is 'SCALAR'.|
||||Only 'Simple', 'SSL', 'StartTLS' are allowed.|
|ValidCertReq/ValidateServerCertificate|No | |Description:|
||||Select to validate the certificate of the external Server.|
||||ValidCertReq/ValidateServerCertificate confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|IntegrationType|No | |Description:|
||||Select integration type which is used in setting the user group membership from the available options: Loose Integration or Tight Integration.|
||||IntegrationType confines to:|
||||Type is 'SCALAR'.|
||||Only '1' are allowed.|
|DisplayNameAttribute|No | |Description:|
||||Specify the name to be displayed to the user.|
||||DisplayNameAttribute confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 30.|
|EmailAddressAttribute|No |mail |Description:|
||||Specify the name to be displayed to the user for the configured Email Address.|
||||EmailAddressAttribute confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 30.|
|Context|Yes | |Description:|
||||Specify context to which the query is to be added.|
||||Context confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|Query|No | |Description:|
||||Specify Search Query.|
||||Query confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
||||Multiple values are allowed.|
|ServerType|Yes | |Description:|
||||Select Server type from the available options: LDAP Server, Active Directory or eDirectory.|
||||ServerType confines to:|
||||Type is 'SCALAR'.|
||||Only '1' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Active Directory server|200|AD server "\<DynamicValue>" has been added successfully|
|Add Active Directory server|500|AD server "\<DynamicValue>" could not be added|
|Add Active Directory server|502|AD server could not be added. Authentication server with the same name already exists. Choose a different name|
|Add Active Directory server|503|AD server could not be added. AD server with the same domain name or IP already exists|
|Edit Active Directory server|200|AD server "\<DynamicValue>" has been updated successfully|
|Edit Active Directory server|500|AD server "\<DynamicValue>" could not be updated|
|Edit Active Directory server|503|AD server could not be updated. Server with the same name already exists|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
