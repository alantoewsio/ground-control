# EmailConfiguration

- Operation: Email Configuration
- Description: To configure scanning of file size restriction for all the SMTP, POP and IMAP Emails.

## Sample Configuration

``` xml
<EmailConfiguration>
    <GeneralSettings>
        <EmailSignature>This is Signature</EmailSignature>
        <EmailBannerMode>Inline no conversion/MIME part/Off</EmailBannerMode>
    </GeneralSettings>
    <SMTPSSettings>
        <DontScanEmailsGreaterThan>1024</DontScanEmailsGreaterThan>
        <ActionForOversizeEmails>Drop</ActionForOversizeEmails>
        <BypassSpamCheck>Enable</BypassSpamCheck>
        <VerifySendersIPReputation>Enable</VerifySendersIPReputation>
        <SMTPSDosSettings>Enable</SMTPSDosSettings>
        <ConfirmSpamAction>Accept</ConfirmSpamAction>
        <ProbableSpamAction>Accept</ProbableSpamAction>
        <MaximumConnections>5000</MaximumConnections>
        <MaximumConnectionsHost>100</MaximumConnectionsHost>
        <MaximumEmailsConnection>1000</MaximumEmailsConnection>
        <MaximumRecepientsEmail>100</MaximumRecepientsEmail>
        <EmailsRate>1000</EmailsRate>
        <ConnectionsRate>100</ConnectionsRate>
    </SMTPSSettings>
    <POPIMAPSettings>
        <DontScanEmailsGreaterThan>1024</DontScanEmailsGreaterThan>
        <RecipientHeaders>
            <Header>Delivered-To</Header>
            <Header>Received</Header>
            <Header>X-RCPT-TO</Header>
        </RecipientHeaders>
    </POPIMAPSettings>
    <SMTPTLSConfiguration>
        <TLSCertificate>SecurityAppliance_SSL_CA</TLSCertificate>
        <AllowInvalidCertificate>Enable</AllowInvalidCertificate>
        <RequireTLSWithHost>new</RequireTLSWithHost>
        <RequireTLSWithSenderDomain>new</RequireTLSWithSenderDomain>
        <SkipTLSHosts>new</SkipTLSHosts>
        <SkipTLSHosts>testrange</SkipTLSHosts>
        <DisableTLS1>Enable/Disable</DisableTLS1>
    </SMTPTLSConfiguration>
    <POPSIMAPTLSConfiguration>
        <TLSCertificate>SecurityAppliance_SSL_CA</TLSCertificate>
        <AllowInvalidCertificate>Enable</AllowInvalidCertificate>
        <DisableTLS1>Enable/Disable</DisableTLS1>
    </POPSIMAPTLSConfiguration>
</EmailConfiguration>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|DontScanEmailsGreaterThan|Yes |1024 |Description:|
||||Specify maximum file size(in KB) to be scanned received through SMTP.|
||||DontScanEmailsGreaterThan confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|ActionForOversizeEmails|Yes | |Description:|
||||Select Action for the Oversize mails.|
||||ActionForOversizeEmails confines to:|
||||Type is 'SCALAR'.|
||||Only 'Accept', 'Reject', 'Drop' are allowed.|
|DontScanEmailsGreaterThan|Yes |1024 |Description:|
||||Specify maximum file size(in KB) to be scanned received through POP3/IMAP.|
||||DontScanEmailsGreaterThan confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Maximum digits allowed are 5.|
|Email Banner Mode|No |Email Banner Mode |Description:|
||||Specify 'bannermode'.|
||||Email Banner Mode confines to:|
||||Type is 'SCALAR'.|
||||Only 'inline_plain', 'mimepart', 'off' are allowed.|
|DisableTLS1|No | |Description:|
||||Disable Legacy TLS protocols for SMTP TLS Configuration.|
||||DisableTLS1 confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|AllowInvalidCertificate|No | |Description:|
||||Allow Invalid Certificate.|
||||AllowInvalidCertificate confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|TLSCertificate|Yes | |Description:|
||||POPS Scanning certificate.|
||||TLSCertificate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|MaximumRecepientsEmail|No |100 |Description:|
||||Specify maximum file receiver (in KB) to be received mail through SMTP.|
||||MaximumRecepientsEmail confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 512 is allowed.|
|smtphostname|No | |Description:|
||||specify smtp hostname.|
||||smtphostname confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|MaximumConnectionsHost|No |100 |Description:|
||||Specify 'smtpmaxconnperhost'.|
||||MaximumConnectionsHost confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 10000 is allowed.|
|MaximumConnections|No |5000 |Description:|
||||Specify 'smtpmaxconnection'.|
||||MaximumConnections confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 20000 is allowed.|
|EmailsRate|No |1000 |Description:|
||||Specify 'smtpemailsrateperhost'.|
||||EmailsRate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 20000 is allowed.|
|ConnectionsRate|No |100 |Description:|
||||Specify 'smtpconnrateperhost'.|
||||ConnectionsRate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 20000 is allowed.|
|smtpcerttype|No | |Description:|
||||Specify 'smtpcerttype'.|
||||confines to:|
||||Type is 'SCALAR'.|
||||Only 'ca', 'cert' are allowed.|
|EmailSignature|No | |Description:|
||||Specify Signature to be added for all the outgoing Emails.|
||||EmailSignature confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 2000.|
|RequireTLSWithSenderDomain|No | |Description:|
||||Specify 'requiredtlsdomain'.|
||||RequireTLSWithSenderDomain confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 512.|
||||Multiple values are allowed.|
|TLSCertificate|Yes | |Description:|
||||Select SSL Client Certificate to use common Certificate for Authentication.|
||||TLSCertificate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Header|Yes | |Description:|
||||Specify Header value to detect recipient for POP3/IMAP.|
||||Header confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Allowed characters:(A-Za-z0-9.-)|
||||Maximum characters allowed are 255.|
||||Multiple values are allowed.|
|SkipTLSHosts|No | |Description:|
||||Specify 'skiptlshost'.|
||||SkipTLSHosts confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 512.|
||||Multiple values are allowed.|
|BypassSpamCheck|No |Disable |Description:|
||||Enable to bypass Spam scanning of the authenticated traffic.|
||||BypassSpamCheck confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|VerifySendersIPReputation|Yes |Disable |Description:|
||||Enable to verify the reputation of the Sender IP Address.|
||||VerifySendersIPReputation confines to:|
||||Type is 'SCALAR'.|
||||Only ''on'', ''off'' are allowed.|
|RequireTLSWithHost|No | |Description:|
||||Specify 'requiredtlshost'.|
||||RequireTLSWithHost confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 512.|
||||Multiple values are allowed.|
|DisableTLS1|No | |Description:|
||||Disable Legacy TLS protocols for POP and IMAP TLS Configuration.|
||||DisableTLS1 confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|MaximumEmailsConnection|No |100 |Description:|
||||Specify 'smtpmaxmailperconn'.|
||||MaximumEmailsConnection confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 1000 is allowed.|
|SMTPSDosSettings|No |Disable |Description:|
||||Specify 'smtpdosstatus'.|
||||SMTPSDosSettings confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Email Configuration|200|Configuration has been updated successfully|
|Email Configuration|500|Configuration could not be updated|
|Email Configuration|505|Sub operation could not be completed while updating configuration|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
