# FormTemplate

- Operation: Add FormTemplate / Edit FormTemplate
- Description: To Add/Edit FormTemplate.

## Sample Configuration

``` xml
<FormTemplate>
    <Name>Name</Name>
    <Description>Description</Description>
    <Template>Template</Template>
    <Assets>
        <Asset>Asset</Asset>
        :
        :
        :
    </Assets>
</FormTemplate>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Enter a descriptive name for the template.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
|Description|No||Description:|
||||Enter a description or other information.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|Template|Yes||Description:|
||||Select and upload an HTML template.|
||||Template confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|Asset|No||Description:|
||||Select and upload images, stylesheets, or JavaScript files that are used by the selected template.|
||||Asset confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add FormTemplate|200|Authentication template has been added successfully|
|Add FormTemplate|500|Authentication template could not be added|
|Edit FormTemplate|200|Authentication template has been updated successfully|
|Edit FormTemplate|500|Authentication template could not be updated|
|Edit FormTemplate|502|Authentication template with the same name already exists. Please choose a different name|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
