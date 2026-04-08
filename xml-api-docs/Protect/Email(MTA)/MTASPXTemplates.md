# MTASPXTemplates

- Operation: Add SPX Template / Update SPX Template
- Description: To Add/Edit SPX Templates when MTA Mode is enabled.

## Sample Configuration

``` xml
<MTASPXTemplates>
    <Name>Test</Name>
    <Description>Test</Description>
    <OrganizationName>Test</OrganizationName>
    <PDFEncryption>AES/256</PDFEncryption>
    <PageSize>A/4</PageSize>
    <PasswordType>SpecifiedByRecipient</PasswordType>
    <NotificationSubject>SPX Registration Request from %%ORGANIZATION_NAME%%</NotificationSubject>
    <NotificationBody>&lt;p&gt;&lt;b&gt;SPX Registration Request from %ORGANIZATION_NAME%&lt;/b&gt;&lt;/p&gt;|n&lt;p&gt;%SENDER% has sent you an encrypted message. Before you can receive and view this Email you will need to register a password by clicking &lt;A HREF="%REG_LINK%"&gt;here&lt;/A&gt;.&lt;/p&gt;|n&lt;p&gt;After you have completed the registration, you can use the same password to view other SPX-encrypted Emails.&lt;/p&gt;|n&lt;small&gt;&lt;i&gt;Note: if your Email program does not support active links, you can register by copying and pasting the text below into your internet browser:&lt;/i&gt;|n|n%REG_LINK%|n|n&lt;hr/&gt;|n&lt;i&gt;This email and any files transmitted with it are confidential and intended solely for the use of the individual or entity to whom they are addressed. This message contains confidential information and is intended only for the individual named. If you are not the named addressee you should not disseminate, distribute or copy this email. Please notify the sender immediately if you have received this email by mistake and delete this email from your system. If you are not the intended recipient you are notified that disclosing, copying, distributing or taking any action in reliance on the contents of this information is strictly prohibited.&lt;/i&gt;&lt;/small&gt;</NotificationBody>
    <InstructionsForRecipient>&lt;p&gt;&lt;b&gt;Encrypted email notification from %ORGANIZATION_NAME%&lt;/b&gt;&lt;/p&gt;|n&lt;p&gt;&lt;b&gt;Encrypted email message from %SENDER%&lt;/b&gt;&lt;/p&gt;|n|n&lt;p&gt;This email contains a message that has been sent as an encrypted PDF document in order to ensure the secure delivery of its contents.&lt;/p&gt;|n|n&lt;font size="+1"&gt;&lt;b&gt;Open the encrypted PDF attachment to view your secure message.&lt;/b&gt;&lt;/font&gt;|n|n&lt;p&gt;To access this message, you should open the attached PDF using Adobe Acrobat Reader version 7.0 or higher. In order to view its contents, you must enter the password that you received (or will receive) from the sender.&lt;/p&gt;|n|nIf you have any problems viewing the encrypted message or do not know your password, please contact the sender of the message.|n|n&lt;small&gt;&lt;i&gt;Note that Adobe Acrobat may restrict access to certain attachment types.  If this is the case, you will need to inform the original sender and make alternative arrangements.&lt;/i&gt;|n|n&lt;hr/&gt;|n&lt;i&gt;This email and any files transmitted with it are confidential and intended solely for the use of the individual or entity to whom they are addressed. This message contains confidential information and is intended only for the individual named. If you are not the named addressee you should not disseminate, distribute or copy this email. Please notify the sender immediately if you have received this email by mistake and delete this email from your system. If you are not the intended recipient you are notified that disclosing, copying, distributing or taking any action in reliance on the contents of this information is strictly prohibited.&lt;/i&gt;&lt;/small&gt;</InstructionsForRecipient>
    <SPXReplyPortal>Enable/Disabled</SPXReplyPortal>
    <IncludeOriginalBodyIntoReply>Enable/Disabled</IncludeOriginalBodyIntoReply>
</MTASPXTemplates>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Specify the name to uniquely identify the template.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|Description|No||Description:|
||||Specify details of the template|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|OrganizationName|No||Description:|
||||Specify the organization name which will be displayed on the email notification.|
||||OrganizationName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|PDFEncryption|Yes|AES/128|Description:|
||||Select the encryption standard of the PDF file.|
||||PDFEncryption confines to:|
||||Type is 'SCALAR'.|
||||Only 'AES/128', 'AES/256' are allowed.|
|PageSize|Yes|A4|Description:|
||||Select the page size of the PDF file.|
||||PageSize confines to:|
||||Type is 'SCALAR'.|
||||Only 'A/4', 'Letter', 'Legal' are allowed.|
|PasswordType|Yes|Specified by sender|Description:|
||||Select how you want to generate the password for accessing the encrypted email message.|
||||PasswordType confines to:|
||||Type is 'SCALAR'.|
||||Only 'SpecifiedBySender', 'GeneratedOneTimePasswordForEveryEmail', 'GeneratedAndStoredForRecipient', 'SpecifiedByRecipient' are allowed.|
|NotificationSubject|No||Description:|
||||Customize subject of notification Email.|
||||NotificationSubject confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Note:|
||||Applicable only if Password Type is 'Generated one-time password for every email', 'Generated and stored for recipient' or 'Specified by recipient'.|
|NotificationBody|No||Description:|
||||Customize body of notification Email.|
||||NotificationBody confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Note:|
||||Applicable only if Password Type is 'Generated one-time password for every email', 'Generated and stored for recipient' or 'Specified by recipient'.|
|InstructionsForRecipient|No||Description:|
||||Specify instructions sent to recipient in SPX-encrypted Email.|
||||InstructionsForRecipient confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SPXReplyPortal|No|Disabled|Description:|
||||Enable SPX Reply Portal - This option enables users to securely reply to SPX-encrypted emails using the SPX Reply Portal.|
||||SPXReplyPortal confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disabled', 'Enable' are allowed.|
|IncludeOriginalBodyIntoReply|No|Disabled|Description:|
||||This option includes the body of the email into the reply email.|
||||IncludeOriginalBodyIntoReply confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disabled', 'Enable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add SPX Template|200|SPX template "\<DynamicValue>" has been added successfully|
|Add SPX Template|500|SPX template "\<DynamicValue>" could not be added|
|Add SPX Template|502|SPX template with the same name already exists|
|Update SPX Template|200|SPX template "\<DynamicValue>" has been updated successfully|
|Update SPX Template|500|SPX template "\<DynamicValue>" could not be updated|
|Update SPX Template|502|SPX template with the same name already exists|
|Update SPX Template|541|SPX template could not be updated. It is bound with data control list in content scanning policy|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
