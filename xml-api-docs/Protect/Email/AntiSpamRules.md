# AntiSpamRules

- Operation: Add SMTP Scanning Policy / Order SMTP Scanning Policy / Edit SMTP Scanning Policy
- Description: To Add/Edit SMTP Scanning Policy for action to be taken if the Mail is identified as Spam. To order SMTP Scanning Policy.

## Sample Configuration

``` xml
<AntiSpamRules>
    <Name>rulename</Name>
    <After><Name>rulename</Name></After>
    <RecipientList>
        <Action>Contains</Action>
        <RecipientEmail>Any</RecipientEmail>
        :
    </RecipientList>
    <SenderEmailList>
        <Action>Equals</Action>
        <SenderEmail>Any</SenderEmail>
        :
    </SenderEmailList>
    <MarkSpamIf>
        <Condition>CyberoamAntiSpamIdentifiesMailAs/None/OutboundAntiSpamModuleHasIdentifiedMailAs/FromIPAddressBelongsTo/SenderIPAddressBlacklistedByRBL/MessageSizeIs/Subject/From/To/{otherheaders}</Condition>
        <!-- Operator only for Message Size and SelectMessageHeader Box option -->
        <OtherHeader>Text</OtherHeader>
        <Operator>Contains/Equals/GreaterThan/LessThan</Operator>
        <MatchIs>Spam</MatchIs>
    </MarkSpamIf>
    <SMTPAction>
        <Action>Reject/Drop/Accept/Change Recipient/Prefix Subject</Action>
        <ActionParameter>Text</ActionParameter>
        <Quarantine>Enable/Disable</Quarantine>
    </SMTPAction>
    <POPIMAPAction>
        <Action>Accept/Prefix Subject</Action>
        <ActionParameter>Text</ActionParameter>
    </POPIMAPAction>
</AntiSpamRules>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name for Anti Spam Rule.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|Action|No |Contains |Description:|
||||Select whether the recipient email address contains/is exactly(equals) to the specified recipient email address.|
||||Action confines to:|
||||Type is 'SCALAR'.|
||||Only 'Equals', 'Contains' are allowed.|
|RecipientEmail|Yes | |Description:|
||||Select Recipient Email Address.|
||||RecipientEmail confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Action|No |Contains |Description:|
||||Select whether the sender email address contains/is exactly(equals) to the specified sender email address.|
||||Action confines to:|
||||Type is 'SCALAR'.|
||||Only 'Equals', 'Contains' are allowed.|
|SenderEmail|Yes | |Description:|
||||Select Sender Email Address.|
||||SenderEmail confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Condition|Yes | |Description:|
||||Select the condition for scanning Inbound Email.|
||||Condition confines to:|
||||Type is 'SCALAR'.|
||||Only 'None', 'FromIPAddressBelongsTo', 'SenderIPAddressBlacklistedByRBL', '4', 'MessageSizeIs', 'CyberoamAntiSpamIdentifiesMailAs', 'OutboundAntiSpamModuleHasIdentifiedMailAs', 'DataProtectionPolicy', 'SourceIPAddress/NetworkBelongsTo', 'DestinationIPAddress/NetworkBelongsTo' are allowed.|
|Dropdown of Anti Spam Module Has Identified Mail As|No | |Description:|
||||Select what the Inbound Email has been identified as: Spam, Probable Spam, Virus Outbreak or Probable Virus Outbreak.|
||||Dropdown of Anti Spam Module Has Identified Mail As confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Message Size is Greater than or Less than.|No | |Description:|
||||Select the option for comparing Message Size.|
||||Message Size is Greater than or Less than. confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|MatchIs|Yes | |Description:|
||||Specify the Message Size of the Email.|
||||MatchIs confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Allowed first characters: (1-9). For other characters: (0-9.).|
||||Maximum digits allowed are 6.|
|Message Header|No | |Description:|
||||Select to scan Message Header for Spam.|
||||Message Header confines to:|
||||Type is 'SCALAR'.|
||||Only 'Subject', 'From', 'To', 'Other' are allowed.|
|Other Value of Message Header|No | |Description:|
||||Specify text to scan in the Message Header.|
||||Other Value of Message Header confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|Message Header Match Type is contains or equal|No | |Description:|
||||Select whether the message header contains/is exactly(equals) to the specified message header value.|
||||Message Header Match Type is contains or equal confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Message Header Value|No | |Description:|
||||Specify Message Header Value if 'Other' is selected as Message Header.|
||||Message Header Value confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 250.|
|Action|Yes | |Description:|
||||Select Action to be taken for SMTP Traffic: Reject, Accept, Change Recipient, Prefix Subject or Drop.|
||||Action confines to:|
||||Type is 'SCALAR'.|
||||Only 'Reject', 'Accept', 'Change Recipient', 'Prefix Subject', 'Drop', 'Accept With SPX' are allowed.|
|ActionParameter|Yes | |Description:|
||||Specify Value if Action selected is 'Change Recipient'.|
||||ActionParameter confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 100.|
|Quarantine|No | |Description:|
||||Enable to quarantine the Email.|
||||Quarantine confines to:|
||||Type is 'SCALAR'.|
||||Only '0', 'Enable' are allowed.|
|SPXTemplates|No | |Description:|
||||Select SPX Template.|
||||SPXTemplates confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DataProtectionPolicy|No | |Description:|
||||Select Data Protection Policy.|
||||DataProtectionPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|IPAddress|No | |Description:|
||||Select Source IP/Network Address.|
||||IPAddress confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|IPAddress|No | |Description:|
||||Select Destination IP/Network Address.|
||||IPAddress confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add SMTP Scanning Policy|200|SMTP scanning policy "\<DynamicValue>" has been added successfully|
|Add SMTP Scanning Policy|500|SMTP scanning policy could not be added|
|Add SMTP Scanning Policy|502|SMTP scanning policy could not be added. A policy with the same name as "\<DynamicValue>" already exists, choose a different name|
|Edit SMTP Scanning Policy|200|SMTP scanning policy "\<DynamicValue>" has been updated successfully|
|Edit SMTP Scanning Policy|500|SMTP scanning policy "\<DynamicValue>" could not be updated|
|Order SMTP Scanning Policy|200|SMTP policy order has been updated successfully|
|Order SMTP Scanning Policy|500|SMTP policy order could not be updated|
|Order SMTP Scanning Policy|505|SMTP policy order could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
