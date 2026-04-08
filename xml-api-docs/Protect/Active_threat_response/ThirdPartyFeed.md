# ThirdPartyFeed

- Operation: Add Third-party threat feed / Edit Third-party threat feed
- Description: Add Third-party threat feeds or edit Third-party threat feed settings

## Sample Configuration

``` xml
<ThirdPartyFeed>
    <Name>{threatfeedname}</Name>
    <Description>{Threatfeeddescription}</Description>
    <Action>block/monitor</Action>
    <Position>top/bottom</Position>
    <IndicatorType>ip/domain/url</IndicatorType>
    <ExternalURL>{https://example.com/file.txt}</ExternalURL>
    <Enabled>true/false</Enabled>
    <Authorization>noAuthentication/basicAuthentication/apiKey</Authorization>
<!-- Authorization is basicAuthentication config -->
        <Username>{username}</Username>
        <Password>{password}</Password>

<!-- Authorization is apiKey config -->
        <Key>{APIkey}</Key>
        <Value>{APIvalue}</Value>
        <AddTo>{APIlocation}</AddTo>

    <ValidateServerCertificate>true/false</ValidateServerCertificate>
    <PollingInterval>5m/15m/30m/1h/6h/24h/7d/30d</PollingInterval>
</ThirdPartyFeed>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Name for the threat feed.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 63.|
||||Note:|
||||Only 'letters', 'numbers', 'underscores' and 'hyphens' are allowed.|
|Description|No | |Description:|
||||Description of the threat feed.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|Action|Yes |monitor |Description:|
||||Action to take for traffic matching the threat feed.|
||||Action confines to:|
||||Type is 'SCALAR'.|
||||Only 'block', 'monitor' are allowed.|
|Position|No |top |Description:|
||||Specify Top to place this feed at the top of the list. Specify Bottom to place it at the bottom.|
||||Position confines to:|
||||Type is 'SCALAR'.|
||||Only 'top', 'bottom' are allowed.|
|IndicatorType|Yes |ip |Description:|
||||Type of threat indicator, for example, IP address, domain, or URL.|
||||IndicatorType confines to:|
||||Type is 'SCALAR'.|
||||Only 'ip', 'domain', 'url' are allowed.|
|ExternalURL|Yes | |Description:|
||||External URL of the threat feed.|
||||ExternalURL confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 1024.|
|Authorization|Yes |noAuthentication |Description:|
||||Authorization method for HTTPS connections.|
||||Authorization confines to:|
||||Type is 'SCALAR'.|
||||Only 'noAuthentication', 'basicAuthentication', 'apiKey' are allowed.|
|Username|No | |Description:|
||||Username to authenticate HTTPS connections.|
||||Username confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 64.|
||||Note:|
||||Applicable only if Authorization is 'basicAuthentication'.|
|Password|No | |Description:|
||||Password to authenticate HTTPS connections.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 64.|
||||Note:|
||||Applicable only if Authorization is 'basicAuthentication'.|
|Key|No | |Description:|
||||API key name to authenticate HTTPS connections.|
||||Key confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 64.|
||||Note:|
||||Applicable only if Authorization is 'apiKey'.|
|Value|No | |Description:|
||||API key value to authenticate HTTPS connections.|
||||Value confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 64.|
||||Note:|
||||Applicable only if Authorization is 'apiKey'.|
|AddTo|No | |Description:|
||||Adds API key value to the header or query parameters.|
||||AddTo confines to:|
||||Type is 'SCALAR'.|
||||Only 'header', 'queryParam' are allowed.|
||||Note:|
||||Applicable only if Authorization is 'apiKey'.|
|ValidateServerCertificate|Yes | |Description:|
||||Validates the threat feed server's certificate.|
||||ValidateServerCertificate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|PollingInterval|Yes | |Description:|
||||Interval at which the feed is synchronized with the threat feed server.|
||||PollingInterval confines to:|
||||Type is 'SCALAR'.|
||||Only '5m', '15m', '30m', '1h', '6h', '24h', '7d', '30d' are allowed.|
|Enabled|No | |Description:|
||||Turns the threat feed on or off in the firewall.|
||||Enabled confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '0' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Third-party threat feed|200|Added the threat feed.|
|Add Third-party threat feed|500|Couldn't add the threat feed.|
|Add Third-party threat feed|501|Invalid field in threat feed.|
|Add Third-party threat feed|502|Threat feed with this name or External URL already exists.|
|Add Third-party threat feed|522|Can't add the threat feed. You reached the maximum number.|
|Edit Third-party threat feed|200|Updated the threat feed settings.|
|Edit Third-party threat feed|500|Couldn't update the threat feed settings.|
|Edit Third-party threat feed|501|Couldn't update due to invalid input.|
|Edit Third-party threat feed|526|Threat feed doesn't exist.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
