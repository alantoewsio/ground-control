# UserActivity

- Operation: Add User Activity / Update User Activity
- Description: To Add/Edit User activity for controlling user's Web Access.

## Sample Configuration

``` xml
<UserActivity>
    <Name>Name</Name>
    <!-- for updating name -->
    <NewName>New Name</NewName>
    <Desc>Text</Desc>
    <CategoryList>
        <Category>
            <Type>web category/file type/url group</Type>
            <ID>Category name.</ID>
        </Category>
            :
    </CategoryList>
</UserActivity>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Specify a name for the Web Filter Activity.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Characters not allowed: (^;'"\)|
||||Maximum characters allowed are 50.|
|NewName|No||Description:|
||||Change the activity name.|
||||NewName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Characters not allowed: (^;'"\)|
||||Maximum characters allowed are 50.|
|Desc|No||Description:|
||||Specify Activity description.|
||||Desc confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|Type|No||Description:|
||||Specify the type of category.|
||||Type confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Only 'web category', 'file type', 'url group' are allowed.|
|ID|No||Description:|
||||Specify the category name.|
||||ID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CategoryList|No||Description:|
||||Specify categories the activity contains.|
||||CategoryList confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'OBJECT'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add User Activity|200|User activity has been added successfully|
|Add User Activity|500|User activity could not be added|
|Add User Activity|502|User activity with the same name already exists. Please choose a different name|
|Update User Activity|200|User activity has been updated successfully|
|Update User Activity|500|User activity could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
