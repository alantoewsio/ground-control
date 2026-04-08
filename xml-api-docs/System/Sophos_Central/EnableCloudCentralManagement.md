# EnableCloudCentralManagement

- **Operation**: Enable Central Managemant
- **Description**: To Enable a firewall to be managed from Sophos Central

## Sample Configuration

``` xml
<EnableCloudCentralManagement>
    <FWBackup>BackupDisable/BackupEnable</FWBackup>
</EnableCloudCentralManagement>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Join Method|No | |Description:|
||||Enter the joinmethod 'Manual' or 'ZeroTouch'|
||||Join Method confines to:|
||||- Type is 'SCALAR'.|
||||- Only 'Manual', 'ZeroTouch' are allowed.|
|Backup Mode|No | |Description:|
||||Enter the Backup configuration mode 'BackupEnable' or 'BackupDisable'|
||||Backup Mode confines to:|
||||- Type is 'SCALAR'.|
||||Only 'BackupDisable', 'BackupEnable' are allowed.|

## Status Message Information

|Operation|  Status  |Message|
|-|-|-|
|Enable Central Managemant|200|Operation Successful.|
|Enable Central Managemant|500|Operation Fail.|

---
---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
