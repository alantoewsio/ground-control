# NTLMSettings

- Operation: Configure NTLM
- Description: To configure authentication settings for NTLM users.

## Sample Configuration

``` xml
<FirewallAuthentication>
    <NTLMSettings>
        <NTLMInActivtyTime>Number</NTLMInActivtyTime>
        <NTLMDataTransferThreshold>Number</NTLMDataTransferThreshold>
        <NTLMChallegeRedirect>Enable/Disable</NTLMChallegeRedirect>
    </NTLMSettings>
</FirewallAuthentication>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|NTLMInActivtyTime|Yes |6 |Description:|
||||Specify inactivity time in minutes after which the user will be logged out and must re-authenticate.|
||||NTLMInActivtyTime confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 6 to 1440 is allowed.|
||||Maximum digits allowed are 4.|
|NTLMDataTransferThreshold|Yes |1024 |Description:|
||||Specify minimum data in bytes to be transferred within specified time.|
||||NTLMDataTransferThreshold confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Maximum digits allowed are 10.|
|NTLMChallegeRedirect|No | |Description:|
||||NTLM Challenge Redirect|
||||NTLMChallegeRedirect confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Configure NTLM|200|Applied AD SSO settings.|
|Configure NTLM|500|Couldn't apply AD SSO settings.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
