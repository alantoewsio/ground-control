# WebFilterCategory

- Operation: Add Category / Update Category
- Description: To Add/Edit Web Filter Category.

## Sample Configuration

``` xml
<WebFilterCategory>
    <Name>Name</Name>
    <Classification>Productive/Unproductive/Acceptable/Objectionable</Classification>
    <QoSPolicy>None</QoSPolicy>
    <ConfigureCategory>Local/External</ConfigureCategory>
     <!-- if ConfigureCategory = Local,then we retrieve DomainList and KeywordList -->
    <DomainList>
        <Domain>domain</Domain>
        :
    </DomainList>
    <KeywordList>
        <Keyword>keywords</Keyword>
        :
    </KeywordList>
    <!-- if ConfigureCategory = External,then we retrieve URLList -->
    <URLList>
        <URL>http://custom.com</URL>
        <URL>ftp://custom1.com</URL>
        :
        :
    </URLList>
    <Description>Text</Description>
    <OverrideDefaultDeniedMessage>Enable/Disable</OverrideDefaultDeniedMessage>
    <DefaultDeniedMessage>Default/{Message}</DefaultDeniedMessage>
</WebFilterCategory>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Specify name of the Web Category.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Characters not allowed: (^;'"\)|
||||Maximum characters allowed are 50.|
|Classification|No||Description:|
||||Select how category is to be classified. Available options are Productive, Unproductive, Acceptable and Objectionable.|
||||Classification confines to:|
||||Type is 'SCALAR'.|
||||Only 'Productive', 'Unproductive', 'Acceptable', 'Objectionable' are allowed.|
|QoSPolicy|Yes||Description:|
||||Select the QoS Policy if bandwidth restriction is to be applied.|
||||QoSPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
|ConfigureCategory|Yes||Description:|
||||Content type can be Local or External URL Database.|
||||ConfigureCategory confines to:|
||||Type is 'SCALAR'.|
||||Only 'Local', 'External' are allowed.|
|Domain|No||Description:|
||||Specify Domains to be included under Web Category.|
||||Domain confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 250.|
||||Multiple values are allowed.|
|URL|No||Description:|
||||Specify URLs to be included under Web Category.|
||||URL confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 250.|
||||Multiple values are allowed.|
|Keyword|No||Description:|
||||Specify Keywords to be included under Web Category.|
||||Keyword confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 250.|
||||Multiple values are allowed.|
|Description|No||Description:|
||||Specify Category description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 512.|
|OverrideDefaultDeniedMessage|No||Description:|
||||Enable to override the default denied message.|
||||OverrideDefaultDeniedMessage confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|DefaultDeniedMessage|No||Description:|
||||Specify message in HTML.|
||||DefaultDeniedMessage confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Category|200|Created the web category|
|Add Category|201|One or more domains or keywords could not be added. Use only valid domains or keywords|
|Add Category|202|Created the web category|
|Add Category|500|Couldn't create the web category|
|Add Category|502|Web category with this name exists. Specify a different name|
|Add Category|522|You have exceeded the maximum limit for URLs|
|Add Category|523|You have exceeded the maximum limit for keywords|
|Update Category|200|Updated the web category|
|Update Category|201|Web category created successfully without one or more invalid domains or keywords|
|Update Category|500|Couldn't update the web category|
|Update Category|502|Web category with this name exists. Specify a different name|
|Update Category|503|You have exceeded the maximum limit for URLs|
|Update Category|504|You have exceeded the maximum limit for keywords|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
