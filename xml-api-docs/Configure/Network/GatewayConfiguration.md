# GatewayConfiguration

- Operation: Update Gateway
- Description: To update Gateway details. Gateway routes traffic between networks.

## Sample Configuration

``` xml
<GatewayConfiguration>
    <GatewayFailoverTimeout>60</GatewayFailoverTimeout>
    <Gateway><!-- Gateway name to be mentioned for reference. Gateway cannot be added using this tag, it can only be updated-->
        <Name>Default</Name>
        <IPFamily>IPv4/IPv6</IPFamily><!-- default IPv4 -->
        <IPAddress>ip</IPAddress>
        <Type>Active/Backup</Type>
        <!-- for ipv4 family & Active type -->
        <Weight>1</Weight>
        <!-- for backup type -->
        <ActivateGatewayOnFailureOf>Any/All/{GWName}/Manual</ActivateGatewayOnFailureOf>
        <ActionOnActivation>InheritWeight/UseCustomWeight</ActionOnActivation>
        <ActionOnFailback>ServeNewConnections/ServeAllConnections</ActionOnFailback>
        <CustomWeight>1</CustomWeight><!-- Use this tag only when <ActionOnActivation>has value 'UseCustomWeight' -->
        <FailOverRules>
            <GatewayName>Default</GatewayName>
            <IPFamily>IPv4/IPv6</IPFamily><!-- default IPv4 -->
            <Rule>
                <Protocol>PING/TCP</Protocol>
                <IPAddress>ip</IPAddress>
                <Port>Number</Port>
                <Condition>AND/OR</Condition><!-- Rule order matters as this condition will apply on next rule -->
            </Rule>
                :
        </FailOverRules>
    </Gateway>
</GatewayConfiguration>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Protocol|No | |Description:|
||||Specify Communication Protocol to configure Gateway failover rules.|
||||Protocol confines to:|
||||Type is 'ARRAY'.|
||||Only 'TCP', 'PING' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|IPAddress|Yes | |Description:|
||||Gateway IP Address.|
||||IPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS','IPADDRESS6'.|
||||Maximum characters allowed are 45.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|Type|Yes |Active |Description:|
||||Select Gateway Type from the options available: Active or Backup.|
||||Type confines to:|
||||Type is 'SCALAR'.|
||||Only 'Backup', 'Active' are allowed.|
||||Note:|
||||Available only when two or more gateways are configured.|
|Weight|Yes | |Description:|
||||Specify Weight which determines how much traffic will pass through a particular link relative to the other link.|
||||Weight confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Maximum digits allowed are 3.|
|ActivateGatewayOnFailureOf|Yes | |Description:|
||||Select Gateway Activation Condition.Select Gateway Activation Condition: ALL, ANY, Manual or Custom.|
||||ActivateGatewayOnFailureOf confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ActionOnActivation|No | |Description:|
||||Select action on activation of backup gateway from available options: Inherit weight of the failed active gateway or Use pre-configured weight.|
||||ActionOnActivation confines to:|
||||Type is 'SCALAR'.|
||||Only 'InheritWeight', 'UseCustomWeight' are allowed.|
|CustomWeight|No | |Description:|
||||Specify weight if 'Use pre-configured weight' option is selected for the action.|
||||CustomWeight confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Maximum digits allowed are 3.|
|Condition|No | |Description:|
||||Specify whether all or at least one of the rule conditions must be met by selecting AND/OR.|
||||Condition confines to:|
||||Type is 'ARRAY'.|
||||Only 'AND', 'OR' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Port|No | |Description:|
||||Specify Port number for communication in case of TCP communication.|
||||Port confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Allowed port range: (1 to 65535). To specify any port, use an asterisk (*).|
||||Maximum characters allowed are 5.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Name|Yes | |Description:|
||||Name to identify the Gateway.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|IPAddress (Failover)|No | |Description:|
||||Specify IP Address of the device which is permanently running.|
||||IPAddress confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'IPADDRESS','IPADDRESS6'.|
||||Maximum characters allowed are 45.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|ActionOnFailback|No | |Description:|
||||Specify the action for existing and new connections after failback.|
||||ActionOnFailback confines to:|
||||Type is 'SCALAR'.|
||||Only 'ServeNewConnections', 'ServeAllConnections' are allowed.|
||||Note:|
||||1 - Serves all connections through the restored gateway. This interrupts existing connections.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update Gateway|200|"\<DynamicValue>" gateway has been updated successfully|
|Update Gateway|202|Gateway name "\<DynamicValue>" has been renamed to "\<DynamicValue>" and updated successfully|
|Update Gateway|500|Gateway "\<DynamicValue>" could not be updated|
|Update Gateway|502|Gateway with the same name exists. Enter a different name.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
