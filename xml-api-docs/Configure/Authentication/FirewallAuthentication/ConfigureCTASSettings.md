# ConfigureCTASSettings

- Operation: Configure CTAS
- Description: To configure authentication settings for CTAS Clients.

## Sample Configuration

``` xml
<FirewallAuthentication>
    <CTASSettings>
        <CTASUserInactivity>Enable/Disable</CTASUserInactivity>
        <CTASInActivtyTime>Number</CTASInActivtyTime>
        <CTASDataTransferThreshold>Number</CTASDataTransferThreshold>
    </CTASSettings>
</FirewallAuthentication>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|CTASInActivtyTime|No |3 |Description:|
||||Specify inactivity time in minutes after which the user will be logged out and must re-authenticate.|
||||CTASInActivtyTime confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 3 to 1440 is allowed.|
||||Maximum digits allowed are 4.|
|CTASDataTransferThreshold|No |100 |Description:|
||||Specify minimum data in bytes to be transferred within specified time.|
||||CTASDataTransferThreshold confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Maximum digits allowed are 10.|
|CTASUserInactivity|No | |Description:|
||||Enable/Disable User Inactivity.|
||||CTASUserInactivity confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Configure CTAS|200|CTAS settings have been updated successfully|
|Configure CTAS|500|CTAS settings could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
