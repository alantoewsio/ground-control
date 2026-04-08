# WebFilterException

- Operation: Add Web Filter Exception / Update Web Filter Exception
- Description: To Add/Edit Web Filter Exception.

## Sample Configuration

``` xml
<WebFilterException>
    <Name>Name</Name>
    <Desc>Description.</Desc>
    <Enabled>on/off</Enabled>
    <HttpsDecrypt>on/off</HttpsDecrypt>
    <VirusScan>on/off</VirusScan>
    <PolicyCheck>on/off</PolicyCheck>
    <ZeroDayProtection>on/off</ZeroDayProtection>
    <EnableSrcIP>yes/no</EnableSrcIP>
    <EnableDstIP>yes/no</EnableDstIP>
    <EnableURLRegex>yes/no</EnableURLRegex>
    <EnableWebCat>yes/no</EnableWebCat>
    <IsDefault>yes/no</IsDefault>
    <DomainList>
        <WebCategory>Web Category name.</WebCategory>
        :
        <SrcIp>IPAddress</SrcIp>
        :
        <DstIp>IPAddress</DstIp>
        :
        <URLRegex>^[A-Za-z0-9.-]*\.sophosxl\.net</URLRegex>
        :
    </DomainList>
</WebFilterException>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Specify a name for the Web Filter exception.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Characters not allowed: (^;'"\)|
||||Maximum characters allowed are 60.|
|NewName|No||Description:|
||||To change the web filter name with a new one.|
||||NewName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Characters not allowed: (^;'"\)|
||||Maximum characters allowed are 60.|
|Desc|No||Description:|
||||Specify Exception description.|
||||Desc confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 250.|
|Enabled|No||Description:|
||||Enable web filter exception.|
||||Enabled confines to:|
||||Type is 'SCALAR'.|
||||Only 'on', 'off' are allowed.|
|HttpsDecrypt|No||Description:|
||||Skip HTTPS decryption.|
||||HttpsDecrypt confines to:|
||||Type is 'SCALAR'.|
||||Only 'on', 'off' are allowed.|
|VirusScan|No||Description:|
||||Skip malware scanning.|
||||VirusScan confines to:|
||||Type is 'SCALAR'.|
||||Only 'on', 'off' are allowed.|
|PolicyCheck|No||Description:|
||||Skip policy checks.|
||||PolicyCheck confines to:|
||||Type is 'SCALAR'.|
||||Only 'on', 'off' are allowed.|
|ZeroDayProtection|No||Description:|
||||Skip zero-day protection.|
||||ZeroDayProtection confines to:|
||||Type is 'SCALAR'.|
||||Only 'on', 'off' are allowed.|
|CertValidation|No||Description:|
||||Skip HTTPS certificate validation.|
||||CertValidation confines to:|
||||Type is 'SCALAR'.|
||||Only 'on', 'off' are allowed.|
|EnableSrcIP|No||Description:|
||||Enable checking source IP addresses.|
||||EnableSrcIP confines to:|
||||Type is 'SCALAR'.|
||||Only 'yes', 'no' are allowed.|
|SrcIp|No||Description:|
||||Select the source IP address to bypass the web filter.|
||||SrcIp confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 43.|
||||Multiple values are allowed.|
|EnableDstIP|No||Description:|
||||Enable checking destination IP addresses.|
||||EnableDstIP confines to:|
||||Type is 'SCALAR'.|
||||Only 'yes', 'no' are allowed.|
|DstIp|No||Description:|
||||Select the destination IP address to bypass the web filter.|
||||DstIp confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 43.|
||||Multiple values are allowed.|
|EnableURLRegex|No||Description:|
||||Enable checking URL pattern matches.|
||||EnableURLRegex confines to:|
||||Type is 'SCALAR'.|
||||Only 'yes', 'no' are allowed.|
|URLRegex|No||Description:|
||||Select the URL regex to bypass the web filter.|
||||URLRegex confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|EnableWebCat|No||Description:|
||||Enable checking website categories.|
||||EnableWebCat confines to:|
||||Type is 'SCALAR'.|
||||Only 'yes', 'no' are allowed.|
|WebCategory|No||Description:|
||||Select the Web Category to bypass the web filter.|
||||WebCategory confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|IsDefault|No||Description:|
||||Default exception.|
||||IsDefault confines to:|
||||Type is 'SCALAR'.|
||||Only 'yes', 'no' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Web Filter Exception|200|Web protection exception "\<DynamicValue>" has been added successfully|
|Add Web Filter Exception|500|Web protection exception "\<DynamicValue>" could not be added|
|Add Web Filter Exception|502|Web protection exception with the same name as "\<DynamicValue>" already exists. Please choose a different name|
|Add Web Filter Exception|522|Maximum number of exceptions has been reached|
|Update Web Filter Exception|200|Web protection exception "\<DynamicValue>" has been updated successfully|
|Update Web Filter Exception|500|Web protection exception "\<DynamicValue>" could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
