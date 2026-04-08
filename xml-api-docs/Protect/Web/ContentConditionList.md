# ContentConditionList

- Operation: Add Content Condition List / Update Content Condition List
- Description: To Add Content Condition List. To Edit Content Condition List.

## Sample Configuration

``` xml
<ContentConditionList>
    <Name>Name</Name>
    <Description>Description</Description>
    <Key>Key</Key>
    <ContentList>
        <ContentString>Content Text</ContentString>
            :
    </ContentList>
</ContentConditionList>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Specify Content Condition List Name.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 255.|
||||UTF-8 character(s) are allowed.|
|Key|Yes||Description:|
||||Specify Content Condition List Key.|
||||Key confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 127.|
||||UTF-8 character(s) are allowed.|
|Description|No||Description:|
||||Specify Content Condition List Description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|ContentString|No||Description:|
||||Specify Content Condition List Raw Regexes.|
||||ContentString confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Content Condition List|200|Content filter "\<DynamicValue>" has been created successfully|
|Add Content Condition List|500|Content filter "\<DynamicValue>" could not be created. Note the following requirements: Each word or word pattern must be on a separate line. Words or word patterns cannot exceed 80 characters. Name and description must include at least one number or letter. Files cannot exceed 2000 lines. Files must be saved with ASCII or UTF8 encoding. File name must have only ASCII characters|
|Add Content Condition List|502|Content filter could not be created. Content filter with the same name as "\<DynamicValue>" already exists, choose a different name|
|Update Content Condition List|200|Content filter has been deleted successfully|
|Update Content Condition List|500|Content filter is assigned to one or more web policies|
|Update Content Condition List|504|Content filter has already been deleted|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
