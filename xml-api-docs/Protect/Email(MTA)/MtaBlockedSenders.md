# MtaBlockedSenders

- Operation: MTA Blockedlist
- Description: To update blocked domain for MTA Blocked list.

## Sample Configuration

``` xml
<MtaBlockedSenders>
    <BlockedEmailAddresses>
        <EmailAddress>user2@example.com</EmailAddress>
        :
        :
    </BlockedEmailAddresses>
</MtaBlockedSenders>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|EmailAddress|No||Description:|
||||Blocked email addresses can contain wildcarded e-mail domains like *@example.com or e-mail addresses.|
||||EmailAddress confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||EMAILWILDCARD|
||||Multiple values are allowed.|
||||Note:|
||||Note that emails from blocked email addresses will be rejected during SMTP.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|MTA Blockedlist|200|Blocked senders list has been updated|
|MTA Blockedlist|500|Unable to update blocked senders list|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
