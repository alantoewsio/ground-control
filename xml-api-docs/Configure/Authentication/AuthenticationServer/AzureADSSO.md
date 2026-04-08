# AzureADSSO

- Operation: Add Azure AD SSO server / Edit Azure AD SSO server
- Description: Add or update Azure AD SSO servers.

## Sample Configuration

``` xml
<AzureADSSO>
    <ServerName>ADSSO</ServerName>
    <ApplicationID>fa7fc787-011e-4398-812f-3152d8843320</ApplicationID>
    <TenantID>10657f8b-d541-41a5-8e25-a8d7cbb9d4dd</TenantID>
    <ClientSecret>12345abcdead</ClientSecret>
    <RedirectURI>FQDN or IP address of SFOS</RedirectURI>
    <DisplayName>upn</DisplayName>
    <EmailAddress>email</EmailAddress>
    <FallbackUserGroup>Open Group</FallbackUserGroup>
    <UserType>Administrator</UserType>
    <RoleMapping>
        <IdentifierTypeAndProfile>
            <identifiertype>roles</identifiertype>
            <identifiervalue>role.admin</identifiervalue>
            <profileid>Administrator</profileid>
        </IdentifierTypeAndProfile>
    </RoleMapping>
</AzureADSSO>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ServerName|Yes | |Description:|
||||Name of the server.|
||||ServerName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|ApplicationID|Yes | |Description:|
||||Application (client) ID. Copy it from Azure portal > App registrations.|
||||ApplicationID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||ADSSOAPPANDTENANTID|
||||Maximum characters allowed are 50.|
|TenantID|Yes | |Description:|
||||Directory (tenant) ID associated with an organizational directory. Copy it from Azure portal > App registrations.|
||||TenantID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||ADSSOAPPANDTENANTID|
||||Maximum characters allowed are 50.|
|ClientSecret|Yes | |Description:|
||||The password used by the firewall to authenticate its SSO server connection with the Azure application. Copy it from Azure portal > App registrations > Certificates & secrets.|
||||ClientSecret confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|RedirectURI|Yes | |Description:|
||||FQDN or IP address of the firewall.|
||||RedirectURI confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 200.|
|DisplayName|Yes | |Description:|
||||Enter "upn". The firewall uses the UserPrincipalName (UPN) to create the user's display name locally.|
||||DisplayName confines to:|
||||Type is 'SCALAR'.|
||||Only 'upn' are allowed.|
|EmailAddress|Yes | |Description:|
||||Enter "email".|
||||EmailAddress confines to:|
||||Type is 'SCALAR'.|
||||Only 'email' are allowed.|
|UserType|Yes | |Description:|
||||Type of user.|
||||UserType confines to:|
||||Type is 'SCALAR'.|
||||Only 'User', 'Administrator' are allowed.|
|identifiertype|Yes | |Description:|
||||For administrators, enter "roles" or "groups".|
||||identifiertype confines to:|
||||Type is 'SCALAR'.|
||||Only '$IDENTITY{IDENTIFIERGROUPS}', '$IDENTITY{IDENTIFIERROLE}' are allowed.|
|identifiervalue|Yes | |Description:|
||||Role configured in the Azure portal under App roles.|
||||identifiervalue confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|profileidentifier|Yes | |Description:|
||||Administrator profile for the matching role or group.|
||||profileidentifier confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|FallbackUserGroup|Yes | |Description:|
||||User group to assign if the firewall doesn't find a matching user group locally.|
||||FallbackUserGroup confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Azure AD SSO server|200|Added the SSO server.|
|Add Azure AD SSO server|500|Couldn't add the SSO server.|
|Add Azure AD SSO server|502|Couldn't add the SSO server. Authentication server already exists|
|Add Azure AD SSO server|503|A server with the same application (client) ID exists. Use another ID|
|Edit Azure AD SSO server|200|Updated the SSO server.|
|Edit Azure AD SSO server|500|Couldn't update the SSO server.|
|Edit Azure AD SSO server|502|Couldn't update the SSO server. Authentication server already exists|
|Edit Azure AD SSO server|503|A server with the same application (client) ID exists. Use another ID|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
