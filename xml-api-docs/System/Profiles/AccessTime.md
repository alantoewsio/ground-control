# AccessTimePolicy

- **Operation**: Add Access Time / Edit Access Time
- **Description**: To Add/Edit Access Time policy. It enables to set a time interval within which users are allowed Internet access. 

## Sample Configuration

``` xml
<AccessTimePolicy>
    <Name>Name</Name>
    <Strategy>Allow/Deny</Strategy>
    <Schedule>All The Time</Schedule>
    <Description>Text</Description>
</AccessTimePolicy>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify name for the Policy.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|Strategy|No |Allow |Description:|
||||Select Strategy to be applied during the Scheduled time from the available options: Allow or Deny.|
||||Strategy confines to:|
||||Type is 'SCALAR'.|
||||Only ''Y'', ''N'' are allowed.|
|Schedule|No | |Description:|
||||Select Schedule from the available options.|
||||Schedule confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Description|No | |Description:|
||||Specify Policy description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Access Time|200|Access time policy "\<DynamicValue>" has been created successfully|
|Add Access Time|500|Access time policy "\<DynamicValue>" could not be created|
|Add Access Time|502|Access time policy could not be created. Access time policy with same name as "\<DynamicValue>" already exists. Choose a different name|
|Edit Access Time|200|Access time policy "\<DynamicValue>" has been updated successfully|
|Edit Access Time|500|Access time policy "\<DynamicValue>" could not be updated|
|Edit Access Time|502|Access time policy could not be created. Access time policy with same name as "\<DynamicValue>" already exists. Choose a different name|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
