# DefaultCaptivePortal

- Operation: Update default settings of captive portal
- Description: To update the default values of the captive portal.

## Sample Configuration

``` xml
<DefaultCaptivePortal><!-- Values used for 'reset to default' button and uncustomizable fields -->
    <UserDefinedTemplate>HTML input</UserDefinedTemplate>
    <UserPrompt>Sign in to access this network</UserPrompt>
    <UsernameFieldLabel>Username</UsernameFieldLabel>
    <PasswordFieldLabel>Password</PasswordFieldLabel>
    <LoginButtonLabel>Login</LoginButtonLabel>
    <LogoutButtonLabel>Logout</LogoutButtonLabel>
    <UserPortalLinkLabel>Access the User Portal</UserPortalLinkLabel>
    <RegistrationLinkLabel>Register for internet access</RegistrationLinkLabel>
    <LoginPageHeaderHTML>HTML input</LoginPageHeaderHTML>
    <LoginPageFooterHTML>HTML input</LoginPageFooterHTML>
    <DoNotClosePage>Do not close this page</DoNotClosePage>
    <WillBeSignedOut>If you do, you will be signed out</WillBeSignedOut>
    <SigningIn>Signing you in...</SigningIn>
    <EnterUsername>Please enter your username.</EnterUsername>
    <EnterValidUsername>Please enter a valid username.</EnterValidUsername>
    <EnterPassword>Please enter your password.</EnterPassword>
</DefaultCaptivePortal>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|UserDefinedTemplate|No | |Description:|
||||Specify 'user_defined_template'|
||||UserDefinedTemplate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|UserPrompt|No | |Description:|
||||Specify 'loginboxtitle'|
||||UserPrompt confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 64.|
|UsernameFieldLabel|No | |Description:|
||||Specify 'usernamecaption'|
||||UsernameFieldLabel confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 20.|
|PasswordFieldLabel|No | |Description:|
||||Specify 'passwordcaption'|
||||PasswordFieldLabel confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 20.|
|LoginButtonLabel|No | |Description:|
||||Specify 'logincaption'|
||||LoginButtonLabel confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 20.|
|LogoutButtonLabel|No | |Description:|
||||Specify 'logoutcaption'|
||||LogoutButtonLabel confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 20.|
|UserPortalLinkLabel|No | |Description:|
||||Specify 'myaccountcaption'|
||||UserPortalLinkLabel confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|RegistrationLinkLabel|No | |Description:|
||||Specify 'registercaption'|
||||RegistrationLinkLabel confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 70.|
|LoginPageHeaderHTML|No | |Description:|
||||Specify 'loginpagemessage'|
||||LoginPageHeaderHTML confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|LoginPageFooterHTML|No | |Description:|
||||Specify 'loginpagefooter'|
||||LoginPageFooterHTML confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DoNotClosePage|No | |Description:|
||||Specify 'donotclosepage'|
||||DoNotClosePage confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|WillBeSignedOut|No | |Description:|
||||Specify 'willbesignedout'|
||||WillBeSignedOut confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SigningIn|No | |Description:|
||||Specify 'signingin'|
||||SigningIn confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|EnterUsername|No | |Description:|
||||Specify 'enterusername'|
||||EnterUsername confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|EnterValidUsername|No | |Description:|
||||Specify 'entervalidusername'|
||||EnterValidUsername confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|EnterPassword|No | |Description:|
||||Specify 'enterpassword'|
||||EnterPassword confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CredentialLoginButtonLabel|No | |Description:|
||||Specify 'credentialloginbtncaption'|
||||CredentialLoginButtonLabel confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SsoSignedOut|No | |Description:|
||||Specify 'ssosignedout'|
||||SsoSignedOut confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update default settings of captive portal|200|Operation Successful.|
|Update default settings of captive portal|500|Operation Fail.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
