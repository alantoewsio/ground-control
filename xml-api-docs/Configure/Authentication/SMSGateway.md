# SMSGateway

- Operation: Add SMS Gateway Profile / SMS Gateway Test Connection / Edit SMS Gateway Profile
- Description: Create/Edit SMS Gateway Profile.

## Sample Configuration

``` xml
<SMSGateway>
    <Name>smsgateway name</Name>
    <URL>url</URL>
    <HTTPMethod>Get/Post</HTTPMethod>
    <UseCountryCodeWithCellNumber>Enable/Disable</UseCountryCodeWithCellNumber>
    <CellNumberPreFix>phone number prefix</CellNumberPreFix>
    <RequestParamterList>
        <RequestParamter>
            <ParameterName>parameter name</ParameterName>
            <ParameterValue>parameter value</ParameterValue>
        </RequestParamter>
        :
    </RequestParamterList>
    <ResponseFormat>Text</ResponseFormat>
    <ResponseParamterList>
        <ResponseParamter>
            <ParameterName>parameter name</ParameterName>
            <ParameterValue>parameter value</ParameterValue>
        </ResponseParamter>
        :
    </ResponseParamterList>
    <MobileNo>mobile number</MobileNo>
</SMSGateway>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify name of the SMS Gateway.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 100.|
||||UTF-8 character(s) are allowed.|
|URL|Yes | |Description:|
||||Specify URL for sending SMS request to SMS Gateway.|
||||URL confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||The URL should start with ftp/http/https or the IP Address should be an IPv4 Address.|
|HTTPMethod|No | |Description:|
||||Specify the method for sending SMS request to SMS Gateway.|
||||HTTPMethod confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||UTF-8 character(s) are allowed.|
|UseCountryCodeWithCellNumber|No |Disable |Description:|
||||Enable to use Country Code with Cell Number.|
||||UseCountryCodeWithCellNumber confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CellNumberPreFix|No | |Description:|
||||Specify prefix to be used with the Cell Number.|
||||CellNumberPreFix confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||UTF-8 character(s) are allowed.|
|RequestParamter.ParameterName|Yes | |Description:|
||||Specify Parameter Name for SMS Request.|
||||ParameterName confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|RequestParamter.ParameterValue|Yes | |Description:|
||||Specify Parameter value for SMS Request.|
||||ParameterValue confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|ResponseFormat|No | |Description:|
||||Specify Response format.|
||||ResponseFormat confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|ResponseParamter.ParameterName|Yes | |Description:|
||||Specify Parameter Name for the response message.|
||||ParameterName confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|ResponseParamter.ParameterValue|Yes | |Description:|
||||Specify Parameter value for the response message.|
||||ParameterValue confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|MobileNo|No | |Description:|
||||Specify mobile number for test connection.|
||||MobileNo confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add SMS Gateway Profile|200|SMS gateway profile has been added successfully|
|Add SMS Gateway Profile|500|SMS gateway profile could not be added|
|Add SMS Gateway Profile|502|SMS gateway profile with the same name already exists, choose a different name|
|Edit SMS Gateway Profile|200|SMS gateway profile has been updated successfully|
|Edit SMS Gateway Profile|500|SMS gateway profile could not be updated|
|SMS Gateway Test Connection|200|Operation Successful.|
|SMS Gateway Test Connection|500|Operation Fail.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
