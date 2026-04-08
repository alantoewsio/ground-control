# GlobalSettings

- Operation: Configure Global
- Description: To configure authentication settings for Firewall.

## Sample Configuration

``` xml
<FirewallAuthentication>
    <GlobalSettings>
        <MaximumSessionTimeoutMinutes>Unlimited/{minutes}</MaximumSessionTimeoutMinutes>
        <SimultaneousLogins>Unlimited/{count}</SimultaneousLogins>
    </GlobalSettings>
</FirewallAuthentication>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|MaximumSessionTimeoutMinutes|No | |Description:|
||||Specify maximum time in minutes after which the user will be logged out automatically and must re-authenticate.|
||||MaximumSessionTimeoutMinutes confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 3 to 1440 is allowed.|
||||Maximum digits allowed are 4.|
|SimultaneousLogins|No | |Description:|
||||Specify maximum number of simultaneous logins allowed to the user.|
||||SimultaneousLogins confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 99 is allowed.|
||||Maximum digits allowed are 2.|
|SimultaneousLogins Unlimited|No | |Description:|
||||Enable to allow unlimited concurrent logins to the user.|
||||SimultaneousLogins Unlimited confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|MaximumSessionTimeoutMinutes Unlimited|No | |Description:|
||||Enable Unlimited to allow the users to remain logged in.|
||||MaximumSessionTimeoutMinutes Unlimited confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Configure Global|200|User global settings have been updated successfully|
|Configure Global|500|Couldn't update global user settings.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
