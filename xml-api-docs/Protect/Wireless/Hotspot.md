# Hotspot

- Operation: Add Hotspot / Update Hotspot
- Description: To Add/Update Hotspot.

## Sample Configuration

``` xml
<Hotspot>
    <Name>text</Name>
    <Description>description</Description>
    <AutoFirewallRule>Enable/Disable</AutoFirewallRule>
    <Interfaces>
        <Interface>interface name</Interface>
        :
    </Interfaces>
    <Users>
        <User>user name</User>
        :
    </Users>
    <ApplicationFilterPolicy>app filter policy names</ApplicationFilterPolicy>
    <WebFilterPolicy>web filter policy names</WebFilterPolicy>
    <IPSPolicy>ips policy names</IPSPolicy>
    <QoSPolicy>qos policy names</QoSPolicy>
    <RedirectHTTPS>Enable/Disable</RedirectHTTPS>
    <HostnameType>None (IP Address)/Custom hostname</HostnameType>
    <!-- If HostnameType is Custom hostname -->
    <Hostname>text</Hostname>
    <HotspotType>TermsOfUseAcceptance/PasswordofTheDay/Voucher</HotspotType>
    <!-- If HotspotType is TermsOfUseAcceptance -->
    <SessionExpiry>After2hours/After6hours/After12hours/After24hours/After1week</SessionExpiry>
    <TermsOfUse>text</TermsOfUse>
    <!-- If HotspotType is PasswordofTheDay -->
    <PasswordCreationTime>time in dropdown</PasswordCreationTime>
    <Email>email id</Email>
    <SynchronizePSK>Enable/Disable</SynchronizePSK>
    <!-- If HotspotType is Voucher -->
    <Vouchers>
        <Voucher>voucher name</Voucher>
        :
    </Vouchers>
    <DevicePerVoucher>unlimited/1/2/3/4/5</DevicePerVoucher>
    <!-- If HotspotType is PasswordofTheDay or Voucher -->
    <TermsAcceptance>Enable/Disable</TermsAcceptance>
    <!-- If TermsAcceptance is Enabled -->
    <TermsOfUse>text</TermsOfUse>
    <RedirectURL>Enable/Disable</RedirectURL>
    <!-- If RedirectURL is Enabled -->
    <URL>url</URL>
    <RestoreDefault>Enable/Disable</RestoreDefault>
    <!-- If RestoreDefault is Enabled -->
    <CustomizationType>Basic/Full</CustomizationType>
    <!-- If CustomizationType is Basic -->
    <Logo>logo filename</Logo>
    <ScaleLogo>Enable/Disable</ScaleLogo>
    <Title />
    <CustomText />
    <!-- If CustomizationType is Full -->
    <LoginPageTemplate>login filename</LoginPageTemplate>
    <ImagesStylesheet>image filename</ImagesStylesheet>
    <!-- If RestoreDefault is Enabled AND HotspotType is Voucher -->
    <VoucherTemplate>voucher filename</VoucherTemplate>
</Hotspot>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Enter a descriptive name for hotspot.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 40.|
|Description|No||Description:|
||||Enter a description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Interface|Yes||Description:|
||||Select or add the interfaces which are to be restricted by the hotspot.|
||||Interface confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|ApplicationFilterPolicy|No||Description:|
||||Select or add an application filter policy for the hotspot.|
||||ApplicationFilterPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|WebFilterPolicy|No||Description:|
||||Select or add a web filter policy for the hotspot.|
||||WebFilterPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|IPSPolicy|No||Description:|
||||Select or add IPS policies for the hotspot.|
||||IPSPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|QoSPolicy|No||Description:|
||||Select or add a traffic shaping policy for the hotspot.|
||||QoSPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|RedirectHTTPS|No||Description:|
||||Enable to redirect users to HTTPS.|
||||RedirectHTTPS confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|HostnameType|No||Description:|
||||Select the hostname type for the hotspot.|
||||HostnameType confines to:|
||||Type is 'SCALAR'.|
||||Only 'None (IP Address)', 'Custom hostname' are allowed.|
|Hostname|No||Description:|
||||Enter a hostname.|
||||Hostname confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|HotspotType|Yes||Description:|
||||Select a hotspot type for the selected interfaces.|
||||HotspotType confines to:|
||||Type is 'SCALAR'.|
||||Only 'TermsOfUseAcceptance', 'PasswordofTheDay', 'Voucher' are allowed.|
|SessionExpiry|Yes||Description:|
||||Select the time span after which the access will expire.|
||||SessionExpiry confines to:|
||||Type is 'SCALAR'.|
||||Only 'After2hours', 'After6hours', 'After12hours', 'After24hours', 'After1week' are allowed.|
|TermsOfUse|Yes||Description:|
||||Add the text to be displayed as terms of use.|
||||TermsOfUse confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 8192.|
|RedirectURL|No||Description:|
||||Enable to redirect users automatically to a particular URL after entering password or voucher data.|
||||RedirectURL confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|URL|No||Description:|
||||Enter URL to which the user will be redirected to.|
||||URL confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|PasswordCreationTime|Yes||Description:|
||||The assigned time of the day at which the new password will be created. At this time the former password will immediately get invalid and current sessions will be cut off.|
||||PasswordCreationTime confines to:|
||||Type is 'SCALAR'.|
||||Only '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00' are allowed.|
|Email|No||Description:|
||||Add email addresses to which the password shall be sent.|
||||Email confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SynchronizePSK|No||Description:|
||||Enable to synchronize the new generated/saved password with wireless PSK.|
||||SynchronizePSK confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|User|Yes||Description:|
||||Select or add users for administrative settings.|
||||User confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|AutoFirewallRule|No||Description:|
||||Turn on to create a firewall rule automatically.|
||||AutoFirewallRule confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|VoucherTemplate|No||Description:|
||||Select and upload a PDF file with the voucher layout.|
||||VoucherTemplate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'FILE'.|
||||Maximum characters allowed are 255.|
||||File formats 'pdf' are allowed.|
|DevicePerVoucher|No||Description:|
||||Enter the number of devices which are allowed to log in with one voucher during its lifetime.|
||||DevicePerVoucher confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|TermsAcceptance|No||Description:|
||||Enable to make hotspot users accept terms of use before accessing the Internet.|
||||TermsAcceptance confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|RestoreDefault|No||Description:|
||||Enable to use a customized HTML file.|
||||RestoreDefault confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|CustomizationType|Yes||Description:|
||||Select the customization type.|
||||CustomizationType confines to:|
||||Type is 'SCALAR'.|
||||Only 'Basic', 'Full' are allowed.|
|Logo|No||Description:|
||||Upload a logo for the login page.|
||||Logo confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'FILE'.|
||||Maximum characters allowed are 255.|
||||File formats 'jpg', 'jpeg', 'png', 'gif' are allowed.|
|ScaleLogo|No||Description:|
||||Enable to scale logo to recommended size.|
||||ScaleLogo confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Title|No||Description:|
||||Add a title for the login page.|
||||Title confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CustomText|No||Description:|
||||Add an additional text for the login page.|
||||CustomText confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|LoginPageTemplate|Yes||Description:|
||||Select the HTML template you want to use for your individual login page.|
||||LoginPageTemplate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'FILE'.|
||||Maximum characters allowed are 255.|
||||File formats 'html' are allowed.|
|ImagesStylesheet|No||Description:|
||||Add files that are referenced in your login page template.|
||||ImagesStylesheet confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
||||Multiple values are allowed.|
|Voucher|Yes||Description:|
||||Add or select the voucher definitions you want to use for the hotspot.|
||||Voucher confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Hotspot|200|Hotspot has been added successfully|
|Add Hotspot|500|Hotspot could not be added|
|Add Hotspot|502|Hotspot with the same name already exists. Please choose a different name|
|Add Hotspot|541|Selected interface is already bound to a hotspot, please select another interface|
|Add Hotspot|542|Login page template name can contain only alphanumeric characters and underscore|
|Add Hotspot|543|Voucher template name can contain only alphanumeric characters and underscore|
|Update Hotspot|200|Hotspot has been updated successfully|
|Update Hotspot|500|Hotspot could not be updated|
|Update Hotspot|541|Selected interface is already bound to a hotspot, please select another interface|
|Update Hotspot|542|Login page template name can contain only alphanumeric characters and underscore|
|Update Hotspot|543|Voucher template name can contain only alphanumeric characters and underscore|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
