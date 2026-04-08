# CountryGroup

- Operation: Add Country Group / Edit Country Group
- Description: To Add/Edit Country Group.

## Sample Configuration

``` xml
<CountryGroup>
    <Name>name</Name>
    <Description>Text</Description>
    <CountryList>
        <Country>CountryName</Country>
        <Country>CountryName</Country>
        <Country>CountryName</Country>
        :
    </CountryList>
</CountryGroup>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name to identify the Country Group.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|Description|No | |Description:|
||||Enter a description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|Country|No | |Description:|
||||Select Countries from the available options.|
||||Country confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Country Group|200|Country group "\<DynamicValue>" has been added successfully|
|Add Country Group|500|Country group "\<DynamicValue>" could not be added|
|Add Country Group|502|Country group with same name already exists|
|Edit Country Group|200|Country group "\<DynamicValue>" has been updated successfully|
|Edit Country Group|202|Country group "\<DynamicValue>" has been renamed to "\<DynamicValue>" and updated successfully|
|Edit Country Group|500|Country group "\<DynamicValue>" could not be updated|
|Edit Country Group|502|Country group with same name already exists|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
