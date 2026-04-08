# GuestUser

- Operation: Add Single OR Multiple Guest Users
- Description: To Add Single/Multiple Guest Users

## Sample Configuration

``` xml
<GuestUser>
    <Name>username</Name>
    <Email>emailid</Email>
    <UserValidity>Duration in Days</UserValidity>
    <ValidityStart>Immediately/AfterFirstLogin</ValidityStart>
</GuestUser>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|NoOfUsers|Yes | |Description:|
||||Specify 'numberofusers'|
||||NoOfUsers confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 100 is allowed.|
||||Maximum digits allowed are 3.|
|Name|Yes | |Description:|
||||Specify 'name'|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Email|No | |Description:|
||||Specify 'email'|
||||Email confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'EMAIL'.|
|UserValidity|Yes | |Description:|
||||Specify 'genexpiryperiod'|
||||UserValidity confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ExpiryPeriodType|Yes | |Description:|
||||Specify 'genexpiryperiodtype'|
||||ExpiryPeriodType confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '2', '3' are allowed.|
|ValidityStart|No | |Description:|
||||Specify 'validitystart'|
||||ValidityStart confines to:|
||||Type is 'SCALAR'.|
||||Only 'Immediately', 'AfterFirstLogin' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Single OR Multiple Guest Users|200|Operation Successful.|
|Add Single OR Multiple Guest Users|500|Operation Fail.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
