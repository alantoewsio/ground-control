# SNMPAgentConfiguration

- **Operation**: SNMP Agent Configuration
- **Description**: Configure Sophos Firewall as an SNMP agent to allow management via SNMP network managers.

## Sample Configuration

``` xml
<SNMPAgentConfiguration>
  <Configuration>Enable/Disable</Configuration>
  <Name>AgentName</Name>
  <Description>Text</Description>
  <Location>SystemLocation</Location>
  <ContactPerson>SystemContact</ContactPerson>
  <ManagerPort>80</ManagerPort>
  <AgentPort>port</AgentPort><!-- AgentPort xml tag is only read purpose -->
</SNMPAgentConfiguration>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Configuration|No | |Description:|
||||Select to enable SNMP Agent.|
||||Configuration confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Name|Yes | |Description:|
||||Specify a name to identify the agent.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 100.|
|Description|No | |Description:|
||||Description about the agent.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 100.|
|Location|Yes | |Description:|
||||Physical location of the appliance.|
||||Location confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 100.|
|ContactPerson|Yes | |Description:|
||||Specify the contact information of the person responsible for the maintenance of appliance.|
||||ContactPerson confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 100.|
|ManagerPort|Yes |161 |Description:|
||||Specify the port through which the management station will connect to the appliance.|
||||ManagerPort confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 65535 is allowed.|
||||Maximum digits allowed are 5.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|SNMP Agent Configuration|200|Agent configuration changes has been applied successfully|
|SNMP Agent Configuration|500|Agent configuration could not be applied|
|SNMP Agent Configuration|511|Client port having same port number already exists, choose a different port number|

---
© Copyright 2019 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
