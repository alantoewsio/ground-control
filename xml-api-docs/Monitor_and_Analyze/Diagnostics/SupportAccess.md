# SupportAccess

- Operation: Support Access Settings
- Description: To configure Support Access Settings for allowing Sophos support team access to the firewall for troubleshooting purposes.

## Sample Configuration

``` xml
<SupportAccess>
    <ConfigOption>Enable/Disable</ConfigOption>
    <GrantAccessFor>1 day/2 days/1 week/2 weeks/1 month/2 months</GrantAccessFor>
</SupportAccess>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ConfigOption|No |ON |Description:|
||||Enable/Disable Support Access.|
||||ConfigOption confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|GrantAccessFor|No | |Description:|
||||Specify 'lifetime_duration'|
||||GrantAccessFor confines to:|
||||Type is 'SCALAR'.|
||||Only '1 day', '2 days', '1 week', '2 weeks', '1 month', '2 months' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Support Access Settings|200|Operation Successful.|
|Support Access Settings|500|Operation Fail.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
