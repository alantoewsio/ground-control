# AntiVirusMailSMTPScanningRules

- Operation: Add SMTP Malware Scanning Policy / Edit SMTP Malware Scanning Policy
- Description: To Configure SMTP Malware Scanning Policies for defining policies to apply on SMTP Traffic.

## Sample Configuration

``` xml
<AntiVirusMailSMTPScanningRules>
    <Name>Name</Name>
    <After><Name>Name</Name></After>
    <SenderList>
        <Sender>EmailAddress</Sender>
        :
    </SenderList>
    <ReceiverList>
        <Receiver>EmailAddress</Receiver>
        :
    </ReceiverList>
    <Scanning>Disable/Disable</Scanning>
    <Quarantine>Enable/Disable</Quarantine>
    <NotifySender>Enable/Disable</NotifySender>
    <BlockFileTypes>
        <FileType>VideoFiles</FileType>
        :
    </BlockFileTypes>
    <ReceiverActionInfected>Don'tDeliver/DeliverOriginal/RemoveAndDeliver</ReceiverActionInfected>
    <NotifyAdministratorInfected>Don'tDeliver/SendOriginal/RemoveAttachment</NotifyAdministratorInfected>
    <ReceiverActionSuspicious>Don'tDeliver/DeliverOriginal/RemoveAndDeliver</ReceiverActionSuspicious>
    <NotifyAdministratorSuspicious>Don'tDeliver/SendOriginal/RemoveAttachment</NotifyAdministratorSuspicious>
    <ReceiverActionProtectedAttachment>Don'tDeliver/DeliverOriginal/RemoveAndDeliver</ReceiverActionProtectedAttachment>
    <NotifyAdministratorProtectedAttachment>Don'tDeliver/SendOriginal/RemoveAttachment</NotifyAdministratorProtectedAttachment>
</AntiVirusMailSMTPScanningRules>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Sender|Yes | |Description:|
||||Select the Sender name from the list of the users.|
||||Sender confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Receiver|Yes | |Description:|
||||Select the recipient name from the list of users.|
||||Receiver confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Scanning|No |Disable |Description:|
||||Enable to use the Policy for Virus scanning.|
||||Scanning confines to:|
||||Type is 'SCALAR'.|
||||Only 'Single Anti-Virus (Maximum Performance)', 'Dual Anti-Virus (Maximum Security)', 'Disable' are allowed.|
|Quarantine|No |Disable |Description:|
||||Enable to store infected mails in Quarantine.|
||||Quarantine confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|FileType|No | |Description:|
||||Select file types to block as an attachment.|
||||FileType confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|WhiteList|No | |Description:|
||||Select mime type to allow as an attachment.|
||||WhiteList confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|ReceiverActionSuspicious|No |Don'tDeliver |Description:|
||||Notify Receiver based on the action selected if message has Suspicious attachments.|
||||ReceiverActionSuspicious confines to:|
||||Type is 'SCALAR'.|
||||Only 'Don'tDeliver', 'DeliverOriginal', 'RemoveAndDeliver' are allowed.|
|ReceiverActionProtectedAttachment|No |Don'tDeliver |Description:|
||||Notify Receiver based on the action selected if message has Protected attachments.|
||||ReceiverActionProtectedAttachment confines to:|
||||Type is 'SCALAR'.|
||||Only 'Don'tDeliver', 'DeliverOriginal', 'RemoveAndDeliver' are allowed.|
|NotifyAdministratorInfected|No |Don'tDeliver |Description:|
||||Notify administrator based on the action selected if message has Infected attachments.|
||||NotifyAdministratorInfected confines to:|
||||Type is 'SCALAR'.|
||||Only 'Don'tDeliver', 'SendOriginal', 'RemoveAttachment' are allowed.|
|NotifyAdministratorSuspicious|No |Don'tDeliver |Description:|
||||Notify administrator based on the action selected if message has Suspicious attachments.|
||||NotifyAdministratorSuspicious confines to:|
||||Type is 'SCALAR'.|
||||Only 'Don'tDeliver', 'SendOriginal', 'RemoveAttachment' are allowed.|
|NotifyAdministratorProtectedAttachment|No |Don'tDeliver |Description:|
||||Notify administrator based on the action selected if message has Protected attachments.|
||||NotifyAdministratorProtectedAttachment confines to:|
||||Type is 'SCALAR'.|
||||Only 'Don'tDeliver', 'SendOriginal', 'RemoveAttachment' are allowed.|
|NotifySender|No |Disable |Description:|
||||Enable to notify the sender when mail is infected.|
||||NotifySender confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Name|Yes | |Description:|
||||Specify name to identify the SMTP Scanning Rule.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|ReceiverActionInfected|No |Don'tDeliver |Description:|
||||Notify Receiver based on the action selected if message has Infected attachments.|
||||ReceiverActionInfected confines to:|
||||Type is 'SCALAR'.|
||||Only 'Don'tDeliver', 'DeliverOriginal', 'RemoveAndDeliver' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add SMTP Malware Scanning Policy|200|SMTP malware scanning policy "\<DynamicValue>" has been added successfully|
|Add SMTP Malware Scanning Policy|500|SMTP malware scanning policy "\<DynamicValue>" could not be added|
|Add SMTP Malware Scanning Policy|502|SMTP malware scanning policy could not be added. Mail scanning policy with the same name as "\<DynamicValue>" already exists, choose a different name|
|Edit SMTP Malware Scanning Policy|200|SMTP malware scanning policy "\<DynamicValue>" has been updated successfully|
|Edit SMTP Malware Scanning Policy|500|SMTP malware scanning policy "\<DynamicValue>" could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
