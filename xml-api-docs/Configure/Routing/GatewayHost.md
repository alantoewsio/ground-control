# GatewayHost

- Operation: Add Gateway Object / Update Gateway Object
- Description: To Add/Edit Gateway Object.

## Sample Configuration

``` xml
<GatewayHost>
    <Name>Default</Name>
    <IPFamily>IPv4/IPv6</IPFamily><!-- default IPv4 -->
    <GatewayIP>ip</GatewayIP>
    <Interface>{interface}</Interface>
    <NetworkZone>{zonename}</NetworkZone>
    <HealthCheck>{0/1}</HealthCheck>
    <MailNotification>ON/OFF</MailNotification>
    <Interval />
    <Timeout />
    <Retries />
    <MonitoringCondition>
        <Rule>
            <Protocol>PING/TCP</Protocol>
            <Port>Number</Port>
            <IPAddress>ip</IPAddress>
            <Condition>AND/OR</Condition><!-- Rule order matters as this condition will apply on next condition -->
        </Rule>
        :
    </MonitoringCondition>
</GatewayHost>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify name of the gateway.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|GatewayIP|Yes | |Description:|
||||Specify IP Address of the gateway.|
||||GatewayIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS','IPADDRESS6'.|
||||Maximum characters allowed are 45.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST' is allowed.|
|Interface|Yes | |Description:|
||||Select the Out interface for the gateway.|
||||Interface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Healthcheck|No | |Description:|
||||Click to enable health check for monitoring the gateway.|
||||Healthcheck confines to:|
||||Type is 'SCALAR'.|
||||Only 'OFF', 'ON' are allowed.|
|Interval|Yes | |Description:|
||||Specify the time interval in seconds after which the health should be monitored.|
||||Interval confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 5 to 65535 is allowed.|
|Timeout|Yes | |Description:|
||||Specify the time interval in seconds within which the gateway must respond.|
||||Timeout confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 10 is allowed.|
|FailureRetries|Yes | |Description:|
||||Specify the number of tries to probe the health of the gateway, after which the gateway will be declared unreachable.|
||||FailureRetries confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 10 is allowed.|
|MailNotification|No | |Description:|
||||Enable to receive an email notification if there is a change in gateway status.|
||||MailNotification confines to:|
||||Type is 'SCALAR'.|
||||Only 'OFF', 'ON' are allowed.|
|Protocol|Yes | |Description:|
||||Select the communication protocol depending on the service to be tested for the gateway's health|
||||Protocol confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Port|Yes | |Description:|
||||Specify the port number for TCP communication|
||||Port confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|IPAddress|Yes | |Description:|
||||Specify the IP address of the computer or the network device which is permanently running or most reliable|
||||IPAddress confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'IPADDRESS','IPADDRESS6'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Condition|No | |Description:|
||||Select the operator for the monitoring condition. AND: All the conditions must be satisfied for the gateway to be considered alive. OR: At least one condition must be satisfied for the gateway to be considered alive.|
||||Condition confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|IPFamily|Yes | |Description:|
||||Select IP Family for the gateway.|
||||IPFamily confines to:|
||||Type is 'SCALAR'.|
||||Only 'IPv4', 'IPv6' are allowed.|
|NetworkZone|No |None |Description:|
||||Zone to which the gateway belongs.|
||||NetworkZone confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Gateway Object|200|Gateway host "\<DynamicValue>" has been added successfully.|
|Add Gateway Object|500|Gateway host "\<DynamicValue>" could not be added.|
|Add Gateway Object|502|Gateway host "\<DynamicValue>" could not be created. Gateway with the same name already exists.|
|Add Gateway Object|503|Monitoring condition with duplicate parameters cannot be added.|
|Add Gateway Object|504|The firewall has reached the maximum number of gateways. To configure another, you must delete an IPv4 or IPv6 gateway.|
|Update Gateway Object|200|Gateway host "\<DynamicValue>" has been updated successfully.|
|Update Gateway Object|500|Gateway host "\<DynamicValue>" could not be updated.|
|Update Gateway Object|503|Monitoring condition with duplicate parameters cannot be added.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
