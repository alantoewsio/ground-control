# SSLBookmarkGroup

- Operation: Add SSLVPN Bookmark Group / Edit SSLVPN Bookmark Group
- Description: To Add/Edit SSL VPN Bookmark Group.

## Sample Configuration

``` xml
<SSLBookmarkGroup>
    <Name>bookmarkgroupname</Name>
    <BookmarkList>
        <Bookmark>bookmark</Bookmark>
        :
    </BookmarkList>
    <Description>Text</Description>
</SSLBookmarkGroup>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name for the bookmark Group.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|Bookmark|Yes | |Description:|
||||Select Bookmarks to be grouped.|
||||Bookmark confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will be ignored.|
|Description|No | |Description:|
||||Specify Bookmark Group description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add SSLVPN Bookmark Group|200|Bookmark group "\<DynamicValue>" has been created successfully|
|Add SSLVPN Bookmark Group|500|Bookmark group "\<DynamicValue>" could not be created|
|Add SSLVPN Bookmark Group|502|Bookmark group could not be created. Bookmark group with name as "\<DynamicValue>" already exists. Choose a different name|
|Edit SSLVPN Bookmark Group|200|Bookmark group "\<DynamicValue>" has been updated successfully|
|Edit SSLVPN Bookmark Group|500|Bookmark group "\<DynamicValue>" could not be updated|
|Edit SSLVPN Bookmark Group|502|Bookmark group could not be created. Bookmark group with name as "\<DynamicValue>" already exists. Choose a different name|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
