# FQDNHostGroup

- Operation: Add FQDN Host Group / Edit FQDN Host Group
- Description: To Add/Edit FQDN Host Group.

## Sample Configuration

``` xml
<FQDNHostGroup>
    <Name>name</Name>
    <Description>Text</Description>
    <FQDNHostList>
        <FQDNHost>Hostname</FQDNHost>
        <FQDNHost>Hostname</FQDNHost>
        <FQDNHost>Hostname</FQDNHost>
        <FQDNHost>Hostname</FQDNHost>
    </FQDNHostList>
</FQDNHostGroup>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|FQDNHost|No | |Description:|
||||Specify 'select'|
||||FQDNHost confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||NoComma|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|
|Description|No | |Description:|
||||Specify FQDN Host Group description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Name|No | |Description:|
||||Specify a name to identify the FQDN Host group.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||UTF-8 character(s) are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add FQDN Host Group|200|\<DynamicValue> "\<DynamicValue>" has been created successfully|
|Add FQDN Host Group|500|Host group "\<DynamicValue>" could not be created|
|Add FQDN Host Group|502|Host with same name already exists|
|Edit FQDN Host Group|200|\<DynamicValue> "\<DynamicValue>" has been updated successfully|
|Edit FQDN Host Group|202|Host group "\<DynamicValue>" has been renamed to "\<DynamicValue>" and updated successfully|
|Edit FQDN Host Group|500|Host group "\<DynamicValue>" could not be updated|
|Edit FQDN Host Group|502|Host with same name already exists|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
