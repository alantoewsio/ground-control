# ApplicationObject

- Operation: Application object add / Application object edit
- Description: Add an application object. Update an application object.

## Sample Configuration

``` xml
<ApplicationObject>
    <Name>Name</Name>
    <SelectAllRule>Enable/Disable</SelectAllRule>
    <SmartFilter>text</SmartFilter>
    <CategoryList>
        <!-- if selectall then ignore other categories -->
        <Category>SelectALL/{categoryname}</Category>
        :
    </CategoryList>
    <RiskList>
        <!-- if selectall then ignore other risklevel -->
        <Risk>SelectALL/{risklevel}</Risk>
        :
    </RiskList>
    <CharacteristicsList>
        <!-- if selectall then ignore other characteristics -->
        <Characteristics>SelectALL/{Characteristic}</Characteristics>
        :
    </CharacteristicsList>
    <TechnologyList>
        <!-- if selectall then ignore other technology -->
        <Technology>SelectALL/{technology}</Technology>
        :
    </TechnologyList>
    <ClassificationList>
        <!-- if selectall then ignore other classification -->
        <Classification>SelectALL/{classification}</Classification>
        :
    </ClassificationList>
    <ApplicationList>
        <!-- if selectall then ignore other application -->
        <Application>SelectAll/{applicationname}</Application>
        :
    </ApplicationList>
</ApplicationObject>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Enter a name for the application object.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 80.|
||||UTF-8 character(s) are allowed.|
|SelectAllRule|Yes | |Description:|
||||Specify 'isselectall'.|
||||SelectAllRule confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Category|No | |Description:|
||||Select the category of applications to be shown.|
||||Category confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Risk|No | |Description:|
||||Select the risk level of applications to be shown.|
||||Risk confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Characteristics|No | |Description:|
||||Select the characteristics of applications to be shown.|
||||Characteristics confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Technology|No | |Description:|
||||Select the technology of applications to be shown.|
||||Technology confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Classification|No | |Description:|
||||Select the classification of applications to be shown.|
||||Classification confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SmartFilter|No | |Description:|
||||Enter the application name for search.|
||||SmartFilter confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Application|No | |Description:|
||||Select the applications based on the specified criteria.|
||||Application confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Application object add|200|Updated application object "\<DynamicValue>"|
|Application object add|500|Couldn't update application object "\<DynamicValue>"|
|Application object add|503|Application object with this name exists. Specify a different name|
|Application object add|504|Invalid parameter and hence could not be added/updated|
|Application object edit|200|Updated application object "\<DynamicValue>"|
|Application object edit|500|Couldn't update application object "\<DynamicValue>"|
|Application object edit|503|Application object with this name exists. Specify a different name|
|Application object edit|504|Invalid parameter and hence could not be added/updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
