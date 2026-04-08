# AntiSpamQuarantineDigestSettings

- Operation: Spam Digest Settings
- Description: Configure Quarantine Digest Settings for mailing Digests to the user as per the configured frequency.

## Sample Configuration

``` xml
<AntiSpamQuarantineDigestSettings>
    <SpamDigestSettings>
        <SpamQuarantineDigest>Enable/Disable</SpamQuarantineDigest>
        <EmailFrequency>Hourly/Day/Week</EmailFrequency>
        <SendEmailAt>
            <Hour>Number</Hour>
            <Minute>Number</Minute>
            <Days>Sunday</Days>
            :
            :
            <Days>Saturday</Days>
        </SendEmailAt>
        <FromEmailAddress>email</FromEmailAddress>
        <DisplayName>SpamDigest</DisplayName>
        <AllowUserToOverride>Enable/Disable</AllowUserToOverride><!-- Allow User To Override Digest Settings -->
        <ReleaseLinkSettings>Interface/AdminHost</ReleaseLinkSettings>
        <ReleaseLinkInterface>PortA</ReleaseLinkInterface>
        <ReleaseLinkHost>abcd.local</ReleaseLinkHost>
        <QuarantineArea>
            <DiskSize>5GB/10GB/15GB</DiskSize>
        </QuarantineArea>
    </SpamDigestSettings>
    <SpamDigestUsers>
        <EnableUsers>
            <EnableUser>username</EnableUser>
            :
            :
            <EnableUser>username</EnableUser>
        </EnableUsers>
        <DisableUsers>
            <DisableUser>username</DisableUser>
            :
            :
            <DisableUser>username</DisableUser>
        </DisableUsers>
    </SpamDigestUsers>
</AntiSpamQuarantineDigestSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|SpamQuarantineDigest|No | |Description:|
||||Enable Quarantine Digest to configure Digest service.|
||||SpamQuarantineDigest confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'off' are allowed.|
|EmailFrequency|Yes | |Description:|
||||Specify the frequency of Quarantine Digest mails.|
||||EmailFrequency confines to:|
||||Type is 'SCALAR'.|
||||Only 'Hourly', 'Day', 'Week' are allowed.|
|Hour|Yes | |Description:|
||||Select time interval in hours for Hourly Digest mails.|
||||Hour confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 23 is allowed.|
|Hour|Yes | |Description:|
||||Select Hour of the Day for Daily Digest mails.|
||||Hour confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 23 is allowed.|
|Minute|Yes | |Description:|
||||Select Minutes of the Hour for Daily Digest mails.|
||||Minute confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 59 is allowed.|
|Hour|Yes | |Description:|
||||Select Hour of the Day for Weekly Digest mails.|
||||Hour confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 23 is allowed.|
|Minute|Yes | |Description:|
||||Select Minutes of the Hour for Weekly Digest mails.|
||||Minute confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 59 is allowed.|
|Days|Yes | |Description:|
||||Select Days for Weekly Digest mails.|
||||Days confines to:|
||||Type is 'ARRAY'.|
||||Only '0', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday' are allowed.|
||||Multiple values are allowed.|
|FromEmailAddress|Yes | |Description:|
||||Specify Email Address from which Digest mails should be sent.|
||||FromEmailAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'EMAIL'.|
||||Maximum characters allowed are 128.|
|DisplayName|Yes | |Description:|
||||Specify Mail Sender name.|
||||DisplayName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 100.|
|Addresspattern|No | |Description:|
||||Specify address patterns for which the quarantine report will not be sent.|
||||Addresspattern confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||EMAILWILDCARD|
||||Multiple values are allowed.|
|ReleaseLinkSettings|No | |Description:|
||||To specify the quarantine release link settings, select the interface IP address or the hostname. You can change the settings in "Admin console and end-user interaction".|
||||ReleaseLinkSettings confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|MailQuarantineSize|Yes | |Description:|
||||Specify the size of the quarantine area for emails.|
||||MailQuarantineSize confines to:|
||||Type is 'SCALAR'.|
||||Only '$ANTISPAM{QUARANTINE_SIZE_FIVE}', '$ANTISPAM{QUARANTINE_SIZE_TEN}', '$ANTISPAM{QUARANTINE_SIZE_FIFTEEN}' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Spam Digest Settings|200|Updated quarantine settings|
|Spam Digest Settings|500|Couldn't update quarantine settings|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
