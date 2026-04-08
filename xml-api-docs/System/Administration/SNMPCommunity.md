# SNMPCommunity

- **Operation**: Add SNMP Community / Edit SNMP Community
- Description: Add/Edit SNMP Community which is a group of SNMP managers.

## Sample Configuration

``` xml
<SNMPCommunity>
  <Name>name of SNMP Community</Name>
  <Description>Text</Description>
  <IPAddress>1.1.1.1</IPAddress>
  <OldIPAddress>10.1.1.1 </OldIPAddress>
  <Supportv1ProtocolVersion>Enable/Disable</Supportv1ProtocolVersion>
  <Supportv2cProtocolVersion>Enable/Disable</Supportv2cProtocolVersion>
  <TrapSupportv1>Enable/Disable</TrapSupportv1>
  <TrapSupportv2c>Enable/Disable</TrapSupportv2c>
</SNMPCommunity>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify the name to identify the community.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 100.|
||||UTF-8 character(s) are allowed.|
|Description|No | |Description:|
||||Community description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 200.|
|IPAddress|Yes | |Description:|
||||Specify IP address of the SNMP manager.|
||||IPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS','IPADDRESS6'.|
||||Maximum characters allowed are 45.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|Supportv2cProtocolVersion|Yes | |Description:|
||||Enable if SNMP Manager is SNMP v2c compliant.|
||||Supportv2cProtocolVersion confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|
|TrapSupportv1|No | |Description:|
||||Enable if SNMP Manager supports Trap Support v1.|
||||TrapSupportv1 confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|
|TrapSupportv2c|No | |Description:|
||||Enable if SNMP Manager supports Trap Support v2c.|
||||TrapSupportv2c confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|
|Supportv1ProtocolVersion|Yes | |Description:|
||||Enable if SNMP Manager is SNMP v1 compliant.|
||||Supportv1ProtocolVersion confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add SNMP Community|200|Community has been created successfully|
|Add SNMP Community|216|Community has been created successfully. The modification will be applicable only when SNMP is enabled|
|Add SNMP Community|500|Community could not be created|
|Add SNMP Community|502|Community could not be created. Community with the same name as "\<DynamicValue>" already exists, choose a different name|
|Edit SNMP Community|200|Community "\<DynamicValue>" has been updated successfully|
|Edit SNMP Community|216|Community "\<DynamicValue>" has been updated successfully. The modification will be applicable only when SNMP is enabled|
|Edit SNMP Community|500|Community could not be updated|
|Edit SNMP Community|502|Community could not be created. Community with the same name as "\<DynamicValue>" already exists, choose a different name|

---
© Copyright 2019 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
