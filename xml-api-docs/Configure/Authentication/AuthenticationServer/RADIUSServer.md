# RADIUSServer

- Operation: Add RADIUS server / Edit RADIUS server
- Description: Add or update RADIUS servers.

## Sample Configuration

``` xml
<AuthenticationServer>
    <RADIUSServer>
        <!-- For Radius Server -->
        <ServerName>name</ServerName>
        <ServerAddress>ipaddress</ServerAddress>
        <Port>1812</Port>
        <!-- If Accounting Port is needs to be enable then only write the below parameter else it will be disabled-->
        <AccountingPort>2222</AccountingPort>
        <SharedSecret>sharedsecret</SharedSecret>
        <DomainName>name</DomainName>
        <IntegrationType>LooseIntegration/TightIntegration</IntegrationType>
        <GroupNameAttribute>attribute</GroupNameAttribute>
    </RADIUSServer>
</AuthenticationServer>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ServerType|No | |Description:|
||||Select Server type from the available options: LDAP Server, Active Directory or RADIUS Server.|
||||ServerType confines to:|
||||Type is 'SCALAR'.|
||||Only '4' are allowed.|
|ServerName|No | |Description:|
||||Specify name to identify the RADIUS Server.|
||||ServerName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|ServerIP|Yes | |Description:|
||||Specify IP Address of the RADIUS Server.|
||||ServerIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS','IPADDRESS6'.|
||||Maximum characters allowed are 45.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|AuthenticationPort|Yes |1812 |Description:|
||||Specify port number through which the server communicates.|
||||AuthenticationPort confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Allowed port range: 1 to 65535|
||||Maximum digits allowed are 5.|
|SharedSecret|Yes | |Description:|
||||Specify shared secret which is used to encrypt information passed to the appliance.|
||||SharedSecret confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 48.|
|GroupNameAttribute|Yes | |Description:|
||||Specify name to be displayed to the user for configured Group Name.|
||||GroupNameAttribute confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|IntegrationType|No | |Description:|
||||Select integration type which is used in setting the user group membership from the available options: Loose Integration or Tight Integration.|
||||IntegrationType confines to:|
||||Type is 'SCALAR'.|
||||Only '1' are allowed.|
|domainName|No | |Description:|
||||Domain name of users.|
||||domainName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add RADIUS server|200|RADIUS server "\<DynamicValue>" has been added successfully|
|Add RADIUS server|500|RADIUS server could not be added|
|Add RADIUS server|502|Authentication server already exists|
|Add RADIUS server|503|RADIUS server could not be added. RADIUS server with the same name or IP address already exists|
|Edit RADIUS server|200|RADIUS server "\<DynamicValue>" has been updated successfully|
|Edit RADIUS server|500|RADIUS server could not be updated|
|Edit RADIUS server|502|RADIUS server could not be updated. RADIUS server already exists|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
