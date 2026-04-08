# ApplicationFilterPolicy

- Operation: Appfilter policy add from api / Appfilter policy edit
- Description: To create or edit Application Filter Policy.

## Sample Configuration

``` xml
<ApplicationFilterPolicy>
    <Name>Name</Name>
    <Description>Text</Description>
    <MicroAppSupport>True/False</MicroAppSupport>
    <!-- Here options for adding policy rules are Template or combination of DefaultAction,RuleList tags -->
    <Template>AllowAll</Template>
    <!-- If template tag is given then DefaultAction,RuleList tags are ignored. -->
    <DefaultAction>Allow/Deny</DefaultAction>
    <RuleList>
        <Rule>
            <SelectAllRule>Enable/Disable</SelectAllRule>
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
            <Action>Allow/Deny</Action>
            <Schedule>All The Time</Schedule>
        </Rule>
        :
    </RuleList>
</ApplicationFilterPolicy>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify name for the Application Filter Policy.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|Description|No | |Description:|
||||Specify description of the Application Filter Policy.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 1000.|
|Template|No | |Description:|
||||Select from the available templates to create new policy based on existing policy.|
||||Template confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Technology|No | |Description:|
||||Select Technology related to which applications are to be displayed.|
||||Technology confines to:|
||||Type is 'OBJECT'.|
||||Datatype is 'STRING'.|
|Characteristics|No | |Description:|
||||Select Characteristics related to which applications are to be displayed.|
||||Characteristics confines to:|
||||Type is 'OBJECT'.|
||||Datatype is 'STRING'.|
|Search|No | |Description:|
||||Specify the Application name to search.|
||||Search confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Category|No | |Description:|
||||Select Category related to which applications are to be displayed.|
||||Category confines to:|
||||Type is 'OBJECT'.|
||||Datatype is 'STRING'.|
|Application|No | |Description:|
||||Select individual application from the list for the specified criteria.|
||||Application confines to:|
||||Type is 'OBJECT'.|
||||Datatype is 'STRING'.|
|Schedule|No | |Description:|
||||Select Schedule to apply the Filter Policy.|
||||Schedule confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Action|No | |Description:|
||||Select action for the Policy.|
||||Action confines to:|
||||Type is 'ARRAY'.|
||||Only 'Deny', 'Allow' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Risk|No | |Description:|
||||Select Risk Level related to which applications are to be displayed.|
||||Risk confines to:|
||||Type is 'OBJECT'.|
||||Datatype is 'STRING'.|
|DefaultAction|No | |Description:|
||||When default template is not given this parameter should provide for default action of policy.|
||||DefaultAction confines to:|
||||Type is 'SCALAR'.|
||||Maximum characters allowed are 1.|
||||Only 'Allow', 'Deny' are allowed.|
|MicroAppSupport|No | |Description:|
||||Micro App Support.|
||||MicroAppSupport confines to:|
||||Type is 'SCALAR'.|
||||Only 'True', 'False' are allowed.|
|ruledetails|No | |Description:|
||||Specify 'ruledetails'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Appfilter policy add from api|200|Operation Successful|
|Appfilter policy add from api|500|Operation Fail|
|Appfilter policy edit|200|Application filter policy "\<DynamicValue>" has been updated successfully|
|Appfilter policy edit|500|Application filter policy "\<DynamicValue>" could not be updated|
|Appfilter policy edit|502|Policy could not be created. Application filter policy with the same name as "\<DynamicValue>" already exists, choose a different name|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
