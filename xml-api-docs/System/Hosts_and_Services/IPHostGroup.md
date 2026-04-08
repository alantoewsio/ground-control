# IPHostGroup

- Operation: Add Ip Host Group / Edit Ip Host Group
- Description: To Add/Edit IP Host Group.

## Sample Configuration

``` xml
<IPHostGroup>
    <Name>name</Name>
    <IPFamily>IPv4/IPv6</IPFamily><!-- default IPv4 -->
    <Description>Text</Description>
    <HostList>
        <Host>Hostname</Host>
        <Host>Hostname</Host>
        <Host>Hostname</Host>
        <Host>Hostname</Host>
    </HostList>
</IPHostGroup>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|No | |Description:|
||||Specify a name to identify the IP Host group.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||UTF-8 character(s) are allowed.|
|Description|No | |Description:|
||||Describe the IP Host Group.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Host|No | |Description:|
||||Select Host names to be added in the IP Host Group.|
||||Host confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||NoComma|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|
|IPFamily|No |IPv4 |Description:|
||||Select IP Family of the IP Host Group: IPv4 or IPv6.|
||||IPFamily confines to:|
||||Type is 'SCALAR'.|
||||Only 'IPv4', 'IPv6' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Ip Host Group|200|\<DynamicValue> "\<DynamicValue>" has been created successfully|
|Add Ip Host Group|500|Host group "\<DynamicValue>" could not be created|
|Add Ip Host Group|502|Host with same name already exists|
|Edit Ip Host Group|200|\<DynamicValue> "\<DynamicValue>" has been updated successfully|
|Edit Ip Host Group|202|Host group "\<DynamicValue>" has been renamed to "\<DynamicValue>" and updated successfully|
|Edit Ip Host Group|500|Host group "\<DynamicValue>" could not be updated|
|Edit Ip Host Group|502|Host with same name already exists|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
