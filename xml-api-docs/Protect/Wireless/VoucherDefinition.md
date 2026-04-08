# VoucherDefinition

- Operation: Add Hotspot Voucher Definition / Update Hotspot Voucher Definition
- Description: To Add/Update Hotspot Voucher Definition.

## Sample Configuration

``` xml
<VoucherDefinition>
    <Name>name</Name>
    <Description>description</Description>
    <ValidityPeriod>integer</ValidityPeriod>
    <ValidityUnit>Minutes/Hours/Days</ValidityUnit>
    <TimeQuota>integer</TimeQuota>
    <QuotaUnit>Minutes/Hours</QuotaUnit>
    <DataVolume>integer</DataVolume>
    <DataUnit>MB/GB</DataUnit>
</VoucherDefinition>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Enter a descriptive name for the voucher definition.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
|Description|No||Description:|
||||Enter a description or other information.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ValidityPeriod|Yes||Description:|
||||Enter the time span for which a voucher with this definition will be valid.|
||||ValidityPeriod confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 730 is allowed.|
|ValidityUnit|No||Description:|
||||Select the unit for Validity Period.|
||||ValidityUnit confines to:|
||||Type is 'SCALAR'.|
||||Only 'Minutes', 'Hours', 'Days' are allowed.|
|TimeQuota|No||Description:|
||||Enter the maximum online time after which a voucher of this definition expires.|
||||TimeQuota confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|QuotaUnit|No||Description:|
||||Select the unit for Time Quota.|
||||QuotaUnit confines to:|
||||Type is 'SCALAR'.|
||||Only 'Minutes', 'Hours' are allowed.|
|DataVolume|No||Description:|
||||Enter the maximum data volume to be transmitted with this voucher definition.|
||||DataVolume confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|DataUnit|No||Description:|
||||Select the unit for Data Volume.|
||||DataUnit confines to:|
||||Type is 'SCALAR'.|
||||Only 'MB', 'GB' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Hotspot Voucher Definition|200|Voucher definition has been added successfully|
|Add Hotspot Voucher Definition|500|Voucher definition could not be added|
|Add Hotspot Voucher Definition|502|Voucher definition with the same name already exists. Please choose a different name|
|Update Hotspot Voucher Definition|200|Voucher definition has been updated successfully|
|Update Hotspot Voucher Definition|500|Voucher definition could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
