# POPIMAPScanningPolicy

- Operation: Add POP-IMAP Scanning Policy / Edit POP-IMAP Scanning Policy
- Description: To Add/Edit POP-IMAP Scanning Policy for action to be taken if the Mail is identified as Spam.

## Sample Configuration

``` xml
<POPIMAPScanningPolicy>
    <Name>rule1</Name>
    <After>
        <Name>rule2</Name>
    </After>
    <EmailAddress>
        <SenderEmail>Any</SenderEmail>
        <SenderAction>Contains</SenderAction>
        <RecipientEmail>Any</RecipientEmail>
        <RecipientAction>Contains</RecipientAction>
    </EmailAddress>
    <FilterCriteria>InboundEmailIs</FilterCriteria>
    <Action>Prefix Subject</Action>
    <To>Virus Outbreak:</To>
    <MatchIs>Virus Outbreak</MatchIs>
</POPIMAPScanningPolicy>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||A name to identify the scanning rule.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|Address|No||Description:|
||||Specified IP address value for Source IP/Network Address.|
||||Address confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|SenderAction|Yes|Contains|Description:|
||||Select whether the sender email address contains/is exactly(equals) to the specified sender email address.|
||||SenderAction confines to:|
||||Type is 'SCALAR'.|
||||Only '$POPIMAP{SENDER_MATCHTYPE_CONTAINS}', '$POPIMAP{SENDER_MATCHTYPE_EQUALS}' are allowed.|
|RecipientAction|Yes|Contains|Description:|
||||Select whether the recipient email address contains/is exactly(equals) to the specified recipient email address.|
||||RecipientAction confines to:|
||||Type is 'SCALAR'.|
||||Only '$POPIMAP{RECIPIENT_MATCHTYPE_CONTAINS}', '$POPIMAP{RECIPIENT_MATCHTYPE_EQUALS}' are allowed.|
|FilterCriteria|Yes||Description:|
||||Select the Filter Criteria for scanning Inbound Email.|
||||FilterCriteria confines to:|
||||Type is 'SCALAR'.|
||||Only '$POPIMAP{RULETYPE_INBOUND_EMAIL}', '$POPIMAP{RULETYPE_SOURCEIP_NETWORK}', '$POPIMAP{RULETYPE_MESSAGE_SIZE}', '$POPIMAP{RULETYPE_MESSAGE_HEADER}', '$POPIMAP{RULETYPE_NONE}' are allowed.|
|MessageSizeOperator|No|GreaterThan|Description:|
||||Selected value for Message Size: Greater Than or Less Than.|
||||MessageSizeOperator confines to:|
||||Type is 'SCALAR'.|
||||Only '$POPIMAP{RULETYPE_MESSAGE_SIZE_GRETERTHEN}', '$POPIMAP{RULETYPE_MESSAGE_SIZE_LESSTHEN}' are allowed.|
|MessageSize|No||Description:|
||||Specified action will be taken if the Email size matches the specified size.|
||||MessageSize confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|Action|Yes|Accept|Description:|
||||Select Action to be taken for POP-IMAP Traffic: Accept or Prefix Subject.|
||||Action confines to:|
||||Type is 'SCALAR'.|
||||Only '$POPIMAP{POP_IMAP_ACTION_ACCEPT}', '$POPIMAP{POP_IMAP_ACTION_PREFIX_SUBJECT}' are allowed.|
|To|No||Description:|
||||Text to be prefixed on Email Subject, if Action is selected as Prefix Subject.|
||||To confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 300.|
|MessageHeaderString|No||Description:|
||||Selected value of parameter Message Header: Subject, From, To or Other.|
||||MessageHeaderString confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 765.|
|MatchIs|No||Description:|
||||Selected value for parameter Inbound Email is or value passed for parameter Message Header.|
||||MatchIs confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 750.|
|MessageHeaderOperator|No|GreaterThan|Description:|
||||Select whether the Message Header contains/is exactly(equals) to the specified value.|
||||MessageHeaderOperator confines to:|
||||Type is 'SCALAR'.|
||||Only '$POPIMAP{RULETYPE_MESSAGE_HEADER_CONTAINS}', '$POPIMAP{RULETYPE_MESSAGE_HEADER_EQUALS}' are allowed.|
|SenderEmail|Yes|Any|Description:|
||||Email address of sender(s).|
||||SenderEmail confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|RecipientEmail|Yes|Any|Description:|
||||Email address of the recipient(s).|
||||RecipientEmail confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add POP-IMAP Scanning Policy|200|POP-IMAP scanning policy "\<DynamicValue>" has been added successfully|
|Add POP-IMAP Scanning Policy|500|POP-IMAP scanning policy "\<DynamicValue>" could not be added|
|Add POP-IMAP Scanning Policy|502|POP-IMAP scanning policy could not be added. A policy with the same name as "\<DynamicValue>" already exists, choose a different name|
|Edit POP-IMAP Scanning Policy|200|POP-IMAP scanning policy "\<DynamicValue>" has been updated successfully|
|Edit POP-IMAP Scanning Policy|500|POP-IMAP scanning policy "\<DynamicValue>" could not be updated|
|Edit POP-IMAP Scanning Policy|502|POP-IMAP scanning policy could not be added. A policy with the same name as "\<DynamicValue>" already exists, choose a different name|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
