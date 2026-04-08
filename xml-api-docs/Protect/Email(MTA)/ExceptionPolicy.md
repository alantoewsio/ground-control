# ExceptionPolicy

- Operation: Exception Policy Add / Exception Policy Delete / Exception Policy Update
- Description: To Add/Delete/Update Exception Policy

## Sample Configuration

``` xml
<ExceptionPolicy>
    <Name>test1</Name>
    <MalwareProtection>
        <Malware>Enable</Malware>
        <ZeroDayProtection>Enable</ZeroDayProtection>
    </MalwareProtection>
    <SpamProtection>
        <Antispam>Enable</Antispam>
        <Greylisting>Enable</Greylisting>
        <IPReputation>Disable</IPReputation>
        <RecipientVerification>Enable</RecipientVerification>
        <BATV>Enable</BATV>
    </SpamProtection>
    <Other>
        <Encryption>Enable</Encryption>
        <DataProtection>Enable</DataProtection>
        <FileProtection>Disable</FileProtection>
        <BanerAddition>Disable</BanerAddition>
        <CheckForSPF>Disable</CheckForSPF>
        <DKIMSigning>Enable</DKIMSigning>
        <DKIMVerification>Enable</DKIMVerification>
    </Other>
    <ForTheseSourceHost>Enable</ForTheseSourceHost>
    <ORTheseSenderAddresses>Enable</ORTheseSenderAddresses>
    <ORTheseRecipientAddresses>Enable</ORTheseRecipientAddresses>
    <SourceHostList>
        <SourceHost>12.12.10.10</SourceHost>
    </SourceHostList>
    <SenderAddressesList>
        <Address>test1@test.local</Address>
        <Address>test2@test.local</Address>
    </SenderAddressesList>
    <RecipientAddresses>
        <Address>test4@test.local</Address>
        <Address>test5@test.local</Address>
    </RecipientAddresses>
</ExceptionPolicy>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|RBL|No||Description:|
||||Enable/Disable RBL|
||||RBL confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Antispam|No||Description:|
||||Enable/Disable Antispam|
||||Antispam confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Greylisting|No||Description:|
||||Enable/Disable Greylisting|
||||Greylisting confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|RecipientVerification|No||Description:|
||||Enable/Disable RecipientVerification|
||||RecipientVerification confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|IPReputation|No||Description:|
||||Enable/Disable IPReputation|
||||IPReputation confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|RDNSAndHelo|No||Description:|
||||Enable/Disable RDNSAndHelo|
||||RDNSAndHelo confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Malware|No||Description:|
||||Enable/Disable Malware|
||||Malware confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|ZeroDayProtection|No||Description:|
||||Enable/Disable zero-day protection|
||||ZeroDayProtection confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|DataProtection|No||Description:|
||||Enable/Disable DataProtection|
||||DataProtection confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|FileProtection|No||Description:|
||||Enable/Disable FileProtection|
||||FileProtection confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Encryption|No||Description:|
||||Enable/Disable Encryption|
||||Encryption confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|BanerAddition|No||Description:|
||||Enable/Disable BanerAddition|
||||BanerAddition confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|DKIMSigning|No||Description:|
||||Enable/Disable DKIM Signing|
||||DKIMSigning confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|DKIMVerification|No||Description:|
||||Enable/Disable DKIM Verification|
||||DKIMVerification confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|ForTheseSourceHost|No||Description:|
||||Enable/Disable ForTheseSourceHost|
||||ForTheseSourceHost confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|ORTheseSenderAddresses|No||Description:|
||||Enable/Disable ORTheseSenderAddresses|
||||ORTheseSenderAddresses confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|ORTheseRecipientAddresses|No||Description:|
||||Enable/Disable ORTheseRecipientAddresses|
||||ORTheseRecipientAddresses confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|SourceHost|No||Description:|
||||Add IP/FQDN|
||||SourceHost confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Address|No||Description:|
||||Email address of sender(s).|
||||Address confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||EMAILWILDCARD|
||||Multiple values are allowed.|
|Address|No||Description:|
||||Email address of the recipient(s).|
||||Address confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||EMAILWILDCARD|
||||Multiple values are allowed.|
|BATV|No||Description:|
||||Enable/Disable BATV|
||||BATV confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|CheckforSPF|No||Description:|
||||Enable to verify sender's hostname against sender's DNS|
||||CheckforSPF confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_CHECK_SPF_ENABLE}', '$EMAILPROTECTION{SMTP_CHECK_SPF_DISABLE}' are allowed.|
|Name|Yes||Description:|
||||Name to identify the Exception Policy.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 100.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Exception Policy Add|200|Exception policy has been added|
|Exception Policy Add|502|Exception policy could not be added. A policy with the same name as "\<DynamicValue>" already exists, choose a different name|
|Exception Policy Add|500|Exception policy could not be added|
|Exception Policy Add|541|You must select "Skip checks for the exception policy"|
|Exception Policy Add|542|You must enter a valid source/host|
|Exception Policy Add|543|You must enter valid sender addresses|
|Exception Policy Add|544|You must enter valid recipient addresses|
|Exception Policy Add|545|The exception policy must not have an empty source/host, sender or recipient list|
|Exception Policy Update|200|Exception policy has been updated|
|Exception Policy Update|500|Exception policy update failed|
|Exception Policy Update|541|You must select "Skip checks for the exception policy"|
|Exception Policy Update|542|You must enter a valid source/host|
|Exception Policy Update|543|You must enter valid sender addresses|
|Exception Policy Update|544|You must enter valid recipient addresses|
|Exception Policy Update|545|The exception policy must not have an empty source/host, sender or recipient list|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
