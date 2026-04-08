# SurfingQuotaPolicy

- **Operation**:|Add Surfing Quota Policy / Edit Surfing Quota Policy
- **Description**:|Create/Edit Surfing Quota Policy. It defines the allowed surfing time for a User to access the internet.

## Sample Configuration

``` xml
<SurfingQuotaPolicy>
  <Name>Name</Name>
  <CycleType>Cyclic/NonCyclic</CycleType>
  <CycleHours>Hours</CycleHours>
  <CycleMinutes>minutes</CycleMinutes>
  <PerDay>Days/Weekly/Monthly/Yearly</PerDay>
  <Validity>Unlimited/{Days}</Validity>
  <MaximumHours>Unlimited/{Days}</MaximumHours>
  <Minutes>Number</Minutes>
  <Description>Text</Description>
</SurfingQuotaPolicy>
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
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|CycleType|No | |Description:|
||||Select Cycle Type.|
||||CycleType confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Range should be within 1 to 87840.|
|CycleHours|No | |Description:|
||||Specify Cycle hours which defines the upper limit of surfing hours.|
||||CycleHours confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CycleMinutes|Yes | |Description:|
||||Specify Cycle minutes which defines the upper limit of surfing minutes.|
||||CycleMinutes confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Maximum digits allowed are 4.|
|Validity|No | |Description:|
||||Select 'Unlimited' for not restricting total surfing days.|
||||Validity confines to:|
||||Type is 'SCALAR'.|
||||Only '-11', '' are allowed.|
|Validity|No | |Description:|
||||Specify the number of surfing days allowed.|
||||Validity confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Range 0 to 3660 is allowed.|
|Maximum Hours|No | |Description:|
||||Select 'Unlimited' for not restricting total surfing hours.|
||||Maximum Hours confines to:|
||||Type is 'SCALAR'.|
||||Only '-11', '' are allowed.|
|MaximumHours|No | |Description:|
||||Specify the total surfing hours allowed.|
||||MaximumHours confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 7.|
|Minutes|No | |Description:|
||||Specify the total surfing minutes allowed.|
||||Minutes confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Range 0 to 59 is allowed.|
|Description|No | |Description:|
||||Specify description of the Policy.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Surfing Quota Policy|200|Surfing quota policy "\<DynamicValue>" has been created successfully|
|Add Surfing Quota Policy|500|Surfing quota policy "\<DynamicValue>" could not be created|
|Add Surfing Quota Policy|502|Surfing quota policy could not be created. Surfing quota policy with the same name as "\<DynamicValue>" already exists, choose a different name|
|Edit Surfing Quota Policy|200|Surfing quota policy "\<DynamicValue>" has been updated successfully|
|Edit Surfing Quota Policy|500|Surfing quota policy "\<DynamicValue>" could not be updated|
|Edit Surfing Quota Policy|502|Surfing quota policy could not be created. Surfing quota policy with the same name as "\<DynamicValue>" already exists, choose a different name|

---
---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
