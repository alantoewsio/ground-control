# ReverseAuthentication

- Operation: Add Authentication Policy / Edit Authentication Policy
- Description: To Add/Edit Authentication Policy.

## Sample Configuration

``` xml
<ReverseAuthentication>
    <Name>Text</Name>
    <Description>Text</Description>
    <VirtualWebserverMode>Basic/Form</VirtualWebserverMode>
    <!--VirtualWebserverMode is Basic-->
    <BasicPrompt>Text</BasicPrompt>
    <!--VirtualWebserverMode is Form-->
    <FormTemplate>name of form template</FormTemplate>
    <UserGroupList>
        <UserGroup />
        :
    </UserGroupList>
    <RealWebserverMode>Basic/None</RealWebserverMode>
    <!--RealWebserverMode is basic-->
    <UsernameAffix>None/Prefix/Suffix/PrefixAndSuffix</UsernameAffix>
    <Prefix>Text</Prefix>
    <Suffix>Text</Suffix>
    <!--RealWebserverMode is None-->
    <RemoveBasicHeader>Enable/Disable</RemoveBasicHeader>
    <SessionTimeout>Enable/Disable</SessionTimeout>
    <SessionTimeoutLimit>Integer</SessionTimeoutLimit>
    <SessionTimeoutScope>Hours/Minutes/Days</SessionTimeoutScope>
    <SessionLifetime>Enable/Disable</SessionLifetime>
    <SessionLifetimeLimit>Integer</SessionLifetimeLimit>
    <SessionLifetimeScope>Hours/Minutes/Days</SessionLifetimeScope>
</ReverseAuthentication>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Enter a descriptive name for the Authentication Policy.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
|Description|No||Description:|
||||Enter a description or other information.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|VirtualWebserverMode|Yes|Basic|Description:|
||||Select how the users should authenticate at the Web Application Firewall.|
||||VirtualWebserverMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'Basic', 'Form' are allowed.|
|BasicPrompt|No||Description:|
||||The realm is a unique string that provides additional information on the login page and is used for user orientation.|
||||BasicPrompt confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
||||Note:|
||||Applicable only if Mode is selected as 'Basic'.|
|FormTemplate|No||Description:|
||||Select the form template that will be presented to the users for authentication.|
||||FormTemplate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Note:|
||||Applicable only if Mode is selected as 'Form'.|
|SessionTimeout|No|Disable|Description:|
||||Enable to set a timeout for the user session, which will confirm user credentials by having them log in again if they do not perform any action.|
||||SessionTimeout confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|SessionTimeoutLimit|No||Description:|
||||Set a value for the session timeout.|
||||SessionTimeoutLimit confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 9999 is allowed.|
||||Note:|
||||Applicable only if 'Session Timeout' is enabled.|
|SessionTimeoutScope|No|Minutes|Description:|
||||User Session timeout scope (Hours, Minutes, Days).|
||||SessionTimeoutScope confines to:|
||||Type is 'SCALAR'.|
||||Only 'Days', 'Hours', 'Minutes' are allowed.|
|SessionLifetime|No|Enable|Description:|
||||Enable to set a hard limit for how long users may remain logged in, regardless of activity in the meantime.|
||||SessionLifetime confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|SessionLifetimeLimit|No||Description:|
||||Set a value for the session lifetime.|
||||SessionLifetimeLimit confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 9999 is allowed.|
||||Note:|
||||Applicable only if 'Session Lifetime' is enabled.|
|SessionLifetimeScope|No|Hours|Description:|
||||User Session lifetime scope (Hours, Minutes, Days).|
||||SessionLifetimeScope confines to:|
||||Type is 'SCALAR'.|
||||Only 'Days', 'Hours', 'Minutes' are allowed.|
|RealWebserverMode|Yes|Basic|Description:|
||||Select how the Web Application Firewall authenticates against the web servers.|
||||RealWebserverMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'Basic', 'None' are allowed.|
|UsernameAffix|Yes|None|Description:|
||||Select an affix for the username and enter it into the concerning field.|
||||UsernameAffix confines to:|
||||Type is 'SCALAR'.|
||||Only 'None', 'Prefix', 'Suffix', 'PrefixAndSuffix' are allowed.|
||||Note:|
||||Applicable only if Authentication Forwarding Mode is selected as 'Basic'.|
|RemoveBasicHeader|No|Enable|Description:|
||||Enable to not send the basic header from Sophos Firewall OS to the web server.|
||||RemoveBasicHeader confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
||||Note:|
||||Applicable only if Authentication Forwarding Mode is selected as 'None'.|
|Prefix|No||Description:|
||||Enter Prefix. Prefix will be added automatically if the user enters their username.|
||||Prefix confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
||||Note:|
||||Applicable only if Username affix is selected as 'Prefix' or 'PrefixAndSuffix'.|
|Suffix|No||Description:|
||||Enter Suffix. Suffix will be added automatically if the user enters their username.|
||||Suffix confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
||||Note:|
||||Applicable only if Username affix is selected as 'Suffix' or 'PrefixAndSuffix'.|
|UserGroup|No||Description:|
||||Select the users or user groups that should be assigned to this Authentication Policy or create a new one.|
||||UserGroup confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Authentication Policy|200|Authentication policy has been added successfully|
|Add Authentication Policy|500|Authentication policy could not be added|
|Add Authentication Policy|502|Authentication policy with the same name already exists. Please choose a different name|
|Edit Authentication Policy|200|Authentication policy has been updated successfully|
|Edit Authentication Policy|500|Authentication policy could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
