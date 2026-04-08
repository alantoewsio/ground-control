# CaptivePortalAppearance

- Operation: Captive Portal Appearance
- Description: Customize the appearance of the Captive Portal page.

## Sample Configuration

``` xml
<WebAuthentication>
    <CaptivePortalAppearance>
        <UseCustomLayout>Enable/Disable</UseCustomLayout>
        <DefaultLayout>
            <Logo>Default/Custom</Logo>
            <LogoImage>Path of file</LogoImage><!-- for custom logo -->
            <LogoLink>http://www.example.com.com</LogoLink>
            <UserPrompt>Sign in to access this network</UserPrompt>
            <LoginPageHeaderHTML>HTML</LoginPageHeaderHTML><!-- HTML Input supported in this field-->
            <LoginPageFooterHTML>HTML</LoginPageFooterHTML><!-- HTML Input supported in this field-->
            <UsernameFieldLabel>Username</UsernameFieldLabel>
            <PasswordFieldLabel>Password</PasswordFieldLabel>
            <LoginButtonLabel>Sign in</LoginButtonLabel>
            <LogoutButtonLabel>Sign out</LogoutButtonLabel>
            <UserPortalLinkLabel>Access the User Portal</UserPortalLinkLabel>
            <RegistrationLinkLabel>Register for internet access</RegistrationLinkLabel>
            <BackgroundColor>FAFAFA</BackgroundColor>
            <PageTitleBackgroundColor>055BB5</PageTitleBackgroundColor>
            <UserPortalLinkFontColor>1987CB</UserPortalLinkFontColor>
            <UserPromptFontColor>055BB5</UserPromptFontColor>
            <HeaderFooterFontColor>5C5C5C</HeaderFooterFontColor>
        </DefaultLayout>
        <CustomLayout>
            <UserDefinedTemplate>HTML</UserDefinedTemplate>
            <SystemGeneratedHtml>HTML</SystemGeneratedHtml>
        </CustomLayout>
    </CaptivePortalAppearance>
</WebAuthentication>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|RegistrationLinkLabel|No |Register for internet access |Description:|
||||Specify the label to be displayed for the registration link.|
||||RegistrationLinkLabel confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 70.|
|LoginPageFooterHTML|No | |Description:|
||||Specify the HTML content to be displayed as the footer.|
|LogoImage|No | |Description:|
||||Specify the logo image to be displayed.|
||||LogoImage confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||File formats 'jpg', 'gif', 'bmp', 'png', 'jpeg', 'jpe', 'jfif', 'dib', 'tif', 'tiff', 'JPG', 'GIF', 'BMP', 'PNG', 'JPEG', 'JPE', 'JFIF', 'DIB', 'TIF', 'TIFF' are allowed.|
|Logo|No |Default |Description:|
||||Select 'Custom' if custom logo is to be uploaded. Select 'Default' to use the default logo.|
||||Logo confines to:|
||||Type is 'SCALAR'.|
||||Only 'Custom', 'Default' are allowed.|
|LoginPageHeaderHTML|No | |Description:|
||||Specify the HTML content to be displayed as the header.|
|UsernameFieldLabel|No |Username |Description:|
||||Specify the label for the 'Username' textbox.|
||||UsernameFieldLabel confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 20.|
|PageTitleBackgroundColor|No |055BB5 |Description:|
||||Specify hexadecimal color code to be used for the page title background.|
||||PageTitleBackgroundColor confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 6.|
|UserPromptFontColor|No |055BB5 |Description:|
||||Specify hexadecimal color code to be used for the user prompt.|
||||UserPromptFontColor confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 6.|
|LogoLink|No | |Description:|
||||Specify URL to be used when clicking on the logo.|
||||LogoLink confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||The URL should start with ftp/http/https or the IP Address should be an IPv4 Address.|
|UserPrompt|No |Sign in to access this network |Description:|
||||Specify the user prompt for the Captive Portal Page.|
||||UserPrompt confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 64.|
|UseCustomLayout|No |Disable |Description:|
||||Select 'Enable' to use a custom HTML layout for the Captive Portal page. Select 'Disable' to use the default layout.|
||||UseCustomLayout confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|HeaderFooterFontColor|No | |Description:|
||||Specify hexadecimal color code to be used for the header and footer text.|
||||HeaderFooterFontColor confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 13.|
|LogoutButtonLabel|No |Sign out |Description:|
||||Specify the label for the Logout button.|
||||LogoutButtonLabel confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 20.|
|BackgroundColor|No |FAFAFA |Description:|
||||Specify hexadecimal color code to be used for the background.|
||||BackgroundColor confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 6.|
|LoginButtonLabel|No |Sign in |Description:|
||||Specify the label for the Login button.|
||||LoginButtonLabel confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 20.|
|UserPortalLinkLabel|No |Access the User Portal |Description:|
||||Specify label to be displayed for user portal link.|
||||UserPortalLinkLabel confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|SsoButtonLabel|No |Single sign-on |Description:|
||||Specify the label for the 'ssocaption' textbox.|
||||SsoButtonLabel confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 20.|
|UserPortalLinkFontColor|No |1987CB |Description:|
||||Specify hexadecimal color code to be used for the user portal link label.|
||||UserPortalLinkFontColor confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 6.|
|PasswordFieldLabel|No |Password |Description:|
||||Specify the label for the 'Password' textbox.|
||||PasswordFieldLabel confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 20.|
|UserDefinedTemplate|No | |Description:|
||||Custom HTML text for the Captive Portal page when custom layout is selected.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Captive Portal Appearance|200|Updated captive portal appearance settings.|
|Captive Portal Appearance|500|Web client portal could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
