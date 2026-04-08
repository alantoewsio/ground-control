# WebAuthenticationSettings

- Operation: Web Authentication Settings
- Description: Web Authentication Settings

## Sample Configuration

``` xml
<WebAuthentication>
    <WebAuthenticationSettings>
        <UseKerberosForADSSO>Enable/Disable</UseKerberosForADSSO>
        <DisplayCaptivePortalLink>Enable/Disable</DisplayCaptivePortalLink>
        <UseHTTPS>Enable/Disable</UseHTTPS>
        <LogOutUserSetting>Portal closed/User inactive/Never</LogOutUserSetting>
        <DisplayUserPortalLink>Enable/Disable</DisplayUserPortalLink>
        <DisplayWebpageAfterLogin>Enable/Disable</DisplayWebpageAfterLogin>
        <OpenWebpageInNewWindow>Enable/Disable</OpenWebpageInNewWindow>
        <WebpageToDisplay>User requested URL/Custom URL</WebpageToDisplay>
        <CustomURL>http://www.example.com</CustomURL>
        <BytesRequired>100</BytesRequired>
        <MinutesRequired>10</MinutesRequired>
    </WebAuthenticationSettings>
</WebAuthentication>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|UseKerberosForADSSO|No|Enable|Description:|
||||Select 'Enable' to use Kerberos for AD SSO authentication along with NTLM. Select 'Disable' to only use NTLM.|
||||UseKerberosForADSSO confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|DisplayCaptivePortalLink|No|Enable|Description:|
||||Select 'Enable' to redirect unauthenticated user to the Captive Portal. Select 'Disable' to display 'Access Denied' message to the user.|
||||DisplayCaptivePortalLink confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|UseHTTPS|No|Enable|Description:|
||||Use HTTPS for secure access to Captive Portal page.|
||||UseHTTPS confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|LogOutUserSetting|No|Portal closed|Description:|
||||Setting to determine when user should be logged out.|
||||LogOutUserSetting confines to:|
||||Type is 'SCALAR'.|
||||Only 'Portal closed', 'User inactive', 'Never' are allowed.|
|DisplayUserPortalLink|No|Enable|Description:|
||||Enable to show user portal link on the Captive Portal page.|
||||DisplayUserPortalLink confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|DisplayWebpageAfterLogin|No|Enable|Description:|
||||Select 'Enable' to display a webpage to the user after logging in to the Captive Portal page.|
||||DisplayWebpageAfterLogin confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|OpenWebpageInNewWindow|No|Enable|Description:|
||||Select 'Enable' to open the webpage in a new window. Select 'Disable' to open the webpage in the Captive Portal window.|
||||OpenWebpageInNewWindow confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|WebpageToDisplay|No|User requested URL|Description:|
||||Specify whether the user should be directed to a custom URL or the URL they originally requested after logging into the Captive Portal page.|
||||WebpageToDisplay confines to:|
||||Type is 'SCALAR'.|
||||Only 'User requested URL', 'Custom URL' are allowed.|
|CustomURL|No| |Description:|
||||Specify the custom URL that the user should be redirected to after logging in to the Captive Portal page.|
|BytesRequired|No|100|Description:|
||||Specify threshold value in bytes used to determine whether user is active.|
||||BytesRequired confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Maximum digits allowed are 10.|
|MinutesRequired|No| |Description:|
||||Specify value in minutes used to determine whether user is active.|
||||MinutesRequired confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 3 to 1440 is allowed.|
||||Maximum digits allowed are 4.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Web Authentication Settings|200|Updated captive portal behavior settings.|
|Web Authentication Settings|500|Couldn't update captive portal settings.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
