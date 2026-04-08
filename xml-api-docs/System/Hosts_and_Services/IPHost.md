# IPHost

- Operation: Add IP Host / Edit IP Host
- Description: To Create/Edit IP Host.

## Sample Configuration

``` xml
<IPHost>
    <Name>name</Name>
    <IPFamily>IPv4/IPv6</IPFamily><!-- default IPv4 -->
    <Description>Text</Description>
    <HostType>IP/Network/IPRange/IPList</HostType>
    <IPAddress>1.1.1.1</IPAddress><!-- for type IP only -->
    <!-- For Network Type -->
    <IPAddress>1.1.1.1</IPAddress>
    <Subnet>128.0.0.0</Subnet>
    <!-- Network type ends -->
    <!-- For IPRange -->
    <StartIPAddress>startIPaddress</StartIPAddress>
    <EndIPAddress>endIPaddress</EndIPAddress>
    <!-- IPRange type ends -->
    <!-- For IPList type -->|||<ListOfIPAddresses>192.168.1.125,192.236.25.1</ListOfIPAddresses>
    <!-- Network type ends -->
    <HostGroupList>
        <HostGroup>hostgroupname</HostGroup>
        <HostGroup>hostgroupname</HostGroup>
        <HostGroup>hostgroupname</HostGroup>
        :
    </HostGroupList>
</IPHost>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name to identify the IP Host.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Not allowed for first character: (# ,). Not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
|IPFamily|No |IPv4 |Description:|
||||Select IP Family to which Host belongs: IPv4 or IPv6.|
||||IPFamily confines to:|
||||Type is 'SCALAR'.|
||||Only 'IPv4', 'IPv6' are allowed.|
|HostType|Yes | |Description:|
||||Select the type of Host: IP, Network, IP Range or IP List.|
||||HostType confines to:|
||||Type is 'SCALAR'.|
||||Only 'System Host', 'IP', 'IPRange', 'IPList', 'Network' are allowed.|
|IPAddress|Yes | |Description:|
||||Specify IP Address based on the host type selected.|
||||IPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|Subnet|No | |Description:|
||||Specify Subnet address if the host type selected is 'Network'.|
||||Subnet confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|StartIPAddress|Yes | |Description:|
||||Specify the starting IP address of the IP Range if host type selected is 'IP Range'.|
||||StartIPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'LOCALHOST' is allowed.|
|EndIPAddress|Yes | |Description:|
||||Specify the end IP address of the IP Range if host type selected is 'IP Range'.|
||||EndIPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'LOCALHOST' is allowed.|
|ListOfIPAddresses|Yes | |Description:|
||||Specify the list of IP addresses.|
||||ListOfIPAddresses confines to:|
||||Type is 'CSV'.|
||||Datatype is 'IPADDRESS'.|
||||Comma separated values are allowed.|
||||Maximum characters allowed are 60.|
||||IP Class other than 'LOCALHOST', 'UNSPECIFIED' is allowed.|
|HostGroup|No | |Description:|
||||Select the Host Group to which the Host belongs.|
||||HostGroup confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
||||Multiple values are allowed.|
|Description|No | |Description:|
||||Enter a description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add IP Host|200|Host "\<DynamicValue>" has been added successfully|
|Add IP Host|500|Host "\<DynamicValue>" could not be added|
|Add IP Host|502|Host with same name already exists|
|Add IP Host|503|Host with the same detail already exists|
|Edit IP Host|200|Host "\<DynamicValue>" has been updated successfully|
|Edit IP Host|202|Host "\<DynamicValue>" has been renamed to "\<DynamicValue>" and updated successfully|
|Edit IP Host|500|Host "\<DynamicValue>" could not be updated|
|Edit IP Host|502|Host with same name already exists|
|Edit IP Host|503|Host with the same detail already exists|
|Edit IP Host|541|Host with the same virtual host IP address already exists, choose a different IP address|

---
---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
