# WebFilterURLGroup

- Operation: Add URL Group / Update URL Group
- Description: To Add/Edit URL Group.

## Sample Configuration

``` xml
<WebFilterURLGroup>
    <Name>Name</Name>
    <URLlist>
        <URL>URLs</URL>
        <URL>URLs</URL>
    </URLlist>
    <Description>Text</Description>
    <IsDefault>Yes/No</IsDefault>
</WebFilterURLGroup>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Specify name for URL Group.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|Description|No||Description:|
||||Specify Group description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|URL|No||Description:|
||||Specify the URLs to include in the Group.|
||||URL confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 250.|
||||Multiple values are allowed.|
|IsDefault|No|No|Description:|
||||Specify if it is a built-in URL Group. This field is read-only. When updating any value in this field will be ignored.|
||||IsDefault confines to:|
||||Type is 'SCALAR'.|
||||Only 'Yes', 'No' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add URL Group|200|URL group "\<DynamicValue>" added successfully|
|Add URL Group|500|URL group "\<DynamicValue>" could not be added|
|Add URL Group|502|URL group with the same name as "\<DynamicValue>" already exists. Please choose a different name|
|Update URL Group|200|URL group "\<DynamicValue>" updated successfully|
|Update URL Group|500|URL group "\<DynamicValue>" could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
