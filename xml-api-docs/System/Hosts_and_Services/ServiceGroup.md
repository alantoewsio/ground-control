# ServiceGroup

- Operation: Add Service Group / Edit Service Group
- Description: To Create/Edit Service Group.

## Sample Configuration

``` xml
<ServiceGroup>
    <Name>Name</Name>
    <Description>Text</Description>
    <ServiceList>
        <Service>ServiceName</Service>
        <Service>ServiceName</Service>
        <Service>ServiceName</Service>
        <Service>ServiceName</Service>
        <Service>ServiceName</Service>
    </ServiceList>
</ServiceGroup>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name to identify the Service Group.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|Description|No | |Description:|
||||Specify Description of the Service Group.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Service|Yes | |Description:|
||||Select Services from the list to be added in the Service Group.|
||||Service confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Service Group|200|Service group "\<DynamicValue>" has been added successfully|
|Add Service Group|500|Service group "\<DynamicValue>" could not be added|
|Add Service Group|502|Service group could not be added. Service or service group "\<DynamicValue>" already exists, choose a different name|
|Edit Service Group|200|Service group "\<DynamicValue>" has been updated successfully|
|Edit Service Group|202|Service group "\<DynamicValue>" has been renamed to "\<DynamicValue>" and updated successfully|
|Edit Service Group|500|Service group "\<DynamicValue>" could not be updated|
|Edit Service Group|502|Service group could not be updated. Service or service group "\<DynamicValue>" already exists, choose a different name|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
