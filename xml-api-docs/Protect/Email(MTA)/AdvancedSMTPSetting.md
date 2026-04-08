# AdvancedSMTPSetting

- Operation: Update Advanced SMTP Setting
- Description: To Update Advanced SMTP Setting

## Sample Configuration

``` xml
<AdvancedSMTPSetting>
    <RejectInvalidHELOorMissingRDNS>Enable</RejectInvalidHELOorMissingRDNS>
    <ScanOutboundEmails>Enable</ScanOutboundEmails>
    <DoStrictRDNSchecks>Disable</DoStrictRDNSchecks>
    <FirewallRelateInboundMails>Disable</FirewallRelateInboundMails>
    <BATVSecret>abcd</BATVSecret>
</AdvancedSMTPSetting>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|RejectInvalidHELOorMissingRDNS|No||Description:|
||||This option rejects hosts that send invalid HELO/EHLO arguments or lack RDNS entries|
||||RejectInvalidHELOorMissingRDNS confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|DoStrictRDNSchecks|No||Description:|
||||Select this option if you want to additionally reject emails from hosts with invalid RDNS records|
||||DoStrictRDNSchecks confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|ScanOutboundEmails|No||Description:|
||||Enable to scan all outgoing email traffic. Email is quarantined if found to be malware infected, or marked as Spam.|
||||ScanOutboundEmails confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|FirewallRelateInboundMails|No||Description:|
||||Enable to relate firewall rule on inbound mails.|
||||FirewallRelateInboundMails confines to:|
||||Type is 'SCALAR'.|
||||Only 'Turn on', 'Turn off' are allowed.|
|BATVsecret|Yes||Description:|
||||Enter BATV secret.|
||||BATVsecret confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update Advanced SMTP Setting|200|Operation Successful|
|Update Advanced SMTP Setting|500|Operation Fail|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
