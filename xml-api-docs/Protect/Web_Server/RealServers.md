# RealServers

- Operation: Add Web Server / Update Web Server
- Description: To Add/Edit Web Server.

## Sample Configuration

``` xml
<RealServers>
    <Name>Text</Name>
    <Description>Text</Description>
    <Host>HostName</Host>
    <Type>Plaintext (HTTP)/Encrypted (HTTPS)</Type>
    <Port>Integer</Port>
    <KeepAlive>Enable/Disable</KeepAlive>
    <TimeOut>Integer</TimeOut>
    <DisableReuse>Enable/Disable</DisableReuse>
</RealServers>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Enter a descriptive name for the web server.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|Description|No||Description:|
||||Enter a description or other information.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|Host|Yes||Description:|
||||Add or select a host, which can either be of the type IP Address or FQDN Host.|
||||Host confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Port|Yes|80|Description:|
||||Enter a port number for the web server.|
||||Port confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 65535 is allowed.|
|Type|No||Description:|
||||Select a server type, i.e. whether you want the communication between Sophos Firewall and the web server to be encrypted (HTTPS) or plaintext (HTTP).|
||||Type confines to:|
||||Type is 'SCALAR'.|
||||Only 'Plaintext (HTTP)', 'Encrypted (HTTPS)' are allowed.|
|KeepAlive|No|Enable|Description:|
||||Enable Keep alive to keep the connection between Sophos Firewall and the web server open instead of opening a new connection for every single request.|
||||KeepAlive confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|TimeOut|Yes|300|Description:|
||||Enter a timeout for the Keep alive option.|
||||TimeOut confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 65535 is allowed.|
||||Note:|
||||Applicable only if 'Keep alive' is enabled.|
|DisableReuse|No|Disable|Description:|
||||Disable backend connection pooling.|
||||DisableReuse confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Web Server|200|Web server has been added successfully|
|Add Web Server|500|Web server could not be added|
|Add Web Server|502|Web server with the same name already exists. Please choose a different name|
|Update Web Server|200|Web server has been updated successfully|
|Update Web Server|500|Web server could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
