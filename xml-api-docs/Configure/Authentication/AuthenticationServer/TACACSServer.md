# TACACSServer

- Operation: Add TACACS+ server / Edit TACACS+ server
- Description: Add or update TACACS+ servers.

## Sample Configuration

``` xml
<AuthenticationServer>
    <TACACSServer>
        <ServerName>name</ServerName>
        <ServerAddress>ipaddress</ServerAddress>
        <Port>49</Port>
        <SharedSecret>sharedsecret</SharedSecret>
    </TACACSServer>
</AuthenticationServer>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ServerType|No | |Description:|
||||Select Server type from the available options: LDAP Server, Active Directory or Tacacs Server.|
||||ServerType confines to:|
||||Type is 'SCALAR'.|
||||Only '5' are allowed.|
|ServerName|No | |Description:|
||||Specify name to identify the TACACS Server.|
||||ServerName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|ServerIP|Yes | |Description:|
||||Specify IP Address of the TACACS Server.|
||||ServerIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 45.|
|AuthenticationPort|Yes |1812 |Description:|
||||Specify port number through which the server communicates.|
||||AuthenticationPort confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed port range: 1 to 65535|
||||Maximum characters allowed are 5.|
|SharedSecret|Yes | |Description:|
||||Specify shared secret which is used to encrypt information passed to the appliance.|
||||SharedSecret confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add TACACS+ server|200|TACACS+ server has been added successfully|
|Add TACACS+ server|500|TACACS+ server could not be added|
|Add TACACS+ server|502|TACACS+ server could not be added. Authentication server already exists|
|Add TACACS+ server|503|TACACS+ server could not be added. TACACS+ server with the same name or IP address already exists|
|Edit TACACS+ server|200|TACACS+ server has been updated successfully|
|Edit TACACS+ server|500|TACACS+ server could not be updated|
|Edit TACACS+ server|502|TACACS+ server could not be updated. TACACS+ server already exists|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
