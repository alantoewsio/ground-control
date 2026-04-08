# DataTransferPolicy

- **Operation**: Add Data Transfer Policy / Edit Data Transfer Policy
- **Description**: Create/Edit Data Transfer Policy. It allows limiting the data upload/download by users.

## Sample Configuration

``` xml
<DataTransferPolicy>
    <Name>Name</Name>
    <RestrictionBasedOn>TotalDataTranfer/IndividualDataTransfer</RestrictionBasedOn>
    <CycleType>Cyclic/NonCyclic</CycleType>
    <CyclePeriod>Day/Week/Month/Year</CyclePeriod>
    <!-- For Total Data Transfer : Start -->
    <CycleDataTransferInMB>1</CycleDataTransferInMB>
    <MaximumDataTransfer>Unlimited</MaximumDataTransfer>
    <MaximumDataTransferInMB>{mb}</MaximumDataTransferInMB>
    <!-- For Total Data Transfer : End -->
    <!-- For Individual Data Transfer :Start -->
    <CycleUploadDataTransfer>Unlimited</CycleUploadDataTransfer>
    <CycleDownloadDataTransfer>Unlimited</CycleDownloadDataTransfer>
    <MaximumUploadDataTransfer>Unlimited</MaximumUploadDataTransfer>
    <MaximumDownloadDataTransfer>Unlimited</MaximumDownloadDataTransfer>
    <CycleUploadDataTransferInMB>{mb}</CycleUploadDataTransferInMB>
    <CycleDownloadDataTransferInMB>{mb}</CycleDownloadDataTransferInMB>
    <MaximumUploadDataTransferInMB>{mb}</MaximumUploadDataTransferInMB>
    <MaximumDownloadDataTransferInMB>{mb}</MaximumDownloadDataTransferInMB>
    <!-- For Individual Data Transfer :End -->
    <Description>Text</Description>
</DataTransferPolicy>
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
|RestrictionBasedOn|Yes | |Description:|
||||Select the data transfer restriction from the available options: Total Data Transfer or Individual Data Transfer (Upload & Download).|
||||RestrictionBasedOn confines to:|
||||Type is 'SCALAR'.|
||||Only 'TotalDataTransfer', 'IndividualDataTransfer' are allowed.|
|CycleType/CyclePeriod|Yes | |Description:|
||||Select Cycle Type from the available options: Cyclic or Non-Cyclic.|
||||CycleType/CyclePeriod confines to:|
||||Type is 'SCALAR'.|
||||Only 'NonCyclic', 'Cyclic', 'Week', 'Month', 'Year' are allowed.|
|CycleDataTransferInMB|Yes | |Description:|
||||Specify the data transfer limit allowed to the User per cycle.|
||||CycleDataTransferInMB confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 999999999 is allowed.|
||||Maximum digits allowed are 9.|
|MaximumDataTransferInMB|No | |Description:|
||||Specify maximum data transfer limit after which user will not be able to log on.|
||||MaximumDataTransferInMB confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 999999999 is allowed.|
||||Maximum digits allowed are 9.|
|Description|No | |Description:|
||||Specify description for the Policy.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|CycleUploadDataTransferInMB|Yes | |Description:|
||||Specify upload data transfer limit allowed to the User per cycle.|
||||CycleUploadDataTransferInMB confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 999999999 is allowed.|
||||Maximum digits allowed are 9.|
|CycleUploadDataTransfer|No | |Description:|
||||Enable to allow unlimited upload data transfer to the User per cycle.|
||||CycleUploadDataTransfer confines to:|
||||Type is 'SCALAR'.|
||||Only 'Unlimited' are allowed.|
|CycleDownloadDataTransferInMB|Yes | |Description:|
||||Specify download data transfer limit allowed to the User per cycle.|
||||CycleDownloadDataTransferInMB confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 999999999 is allowed.|
||||Maximum digits allowed are 9.|
|CycleDownloadDataTransfer|No | |Description:|
||||Enable to allow unlimited download data transfer to the User per cycle.|
||||CycleDownloadDataTransfer confines to:|
||||Type is 'SCALAR'.|
||||Only 'Unlimited' are allowed.|
|MaximumUploadDataTransferInMB|Yes | |Description:|
||||Specify maximum upload data transfer limit after which the user will not be able to log on.|
||||MaximumUploadDataTransferInMB confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 999999999 is allowed.|
||||Maximum digits allowed are 9.|
|MaximumUploadDataTransfer|No | |Description:|
||||Enable to allow maximum upload data transfer.|
||||MaximumUploadDataTransfer confines to:|
||||Type is 'SCALAR'.|
||||Only 'Unlimited' are allowed.|
|MaximumDownloadDataTransferInMB|Yes | |Description:|
||||Specify maximum download data transfer limit after which the user will not be able to log on.|
||||MaximumDownloadDataTransferInMB confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 999999999 is allowed.|
||||Maximum digits allowed are 9.|
|MaximumDownloadDataTransfer|No | |Description:|
||||Enable to allow maximum download data transfer.|
||||MaximumDownloadDataTransfer confines to:|
||||Type is 'SCALAR'.|
||||Only 'Unlimited' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Data Transfer Policy|200|Network traffic quota "\<DynamicValue>" has been created successfully|
|Add Data Transfer Policy|500|Network traffic quota "\<DynamicValue>" could not be created|
|Add Data Transfer Policy|502|Network traffic quota could not be created. Network traffic quota with the same name as "\<DynamicValue>" already exists. Choose a different name|
|Edit Data Transfer Policy|200|Network traffic quota "\<DynamicValue>" has been updated successfully|
|Edit Data Transfer Policy|500|Network traffic quota "\<DynamicValue>" could not be updated|
|Edit Data Transfer Policy|502|Network traffic quota could not be created. Network traffic quota with the same name as "\<DynamicValue>" already exists. Choose a different name|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
