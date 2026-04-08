# GreTunnel

- Operation: Add GRE tunnel / Show GRE tunnel / Set GRE tunnel option
- Description: Add the GRE tunnel. To show the configuration of the GRE tunnel. Set the GRE tunnel configuration for DDNS, tunnel state, and TTL.

## Sample Configuration

``` xml
<GreTunnel>
    <TunnelName>gre023</TunnelName>
    <LocalGateway>PortB</LocalGateway>
    <RemoteGateway>DomainName/IpAddress</RemoteGateway>
    <LocalNet>14.25.3.29</LocalNet>
    <RemoteNet>18.25.26.3</RemoteNet>
    <TTL>(0-255)</TTL>
    <Dyndns>On/Off</Dyndns>
    <State>Enabled/Disabled</State>
</GreTunnel>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|TUNNELNAME|No | |Description:|
||||Enter the tunnel name|
||||TUNNELNAME confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||To separate words, use a space.|
||||Maximum characters allowed are 15.|
|TTL|No | |Description:|
||||Enter the TTL|
||||TTL confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 255 is allowed.|
|State|No | |Description:|
||||To set the state of the tunnel, enter 'Enable' or 'Disable'|
||||State confines to:|
||||Type is 'SCALAR'.|
||||To separate words, use a space.|
||||Only 'Enabled', 'Disabled' are allowed.|
|DYNDNS|No | |Description:|
||||Enter the dynamic DNS|
||||DYNDNS confines to:|
||||Type is 'SCALAR'.|
||||To separate words, use a space.|
||||Only 'On', 'Off' are allowed.|
|LOCALGATEWAY|No | |Description:|
||||Local gateway|
||||LOCALGATEWAY confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||UTF-8 character(s) are allowed.|
|REMOTEGATEWAY|No | |Description:|
||||Enter the remote WAN IP address or DDNS|
||||REMOTEGATEWAY confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||To separate words, use a dot (.).|
||||Maximum characters allowed are 64.|
|LOCALNET|No | |Description:|
||||Enter the tunnel's local IP address|
||||LOCALNET confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
|REMOTENET|No | |Description:|
||||Enter the remote IP address|
||||REMOTENET confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add GRE tunnel|200|GRE tunnel has been added successfully|
|Add GRE tunnel|500|GRE tunnel could not be added|
|Show GRE tunnel|200|GRE tunnel configuration retrieved successfully|
|Show GRE tunnel|500|GRE tunnel configuration could not be retrieved|
|Set GRE tunnel option|200|GRE tunnel options have been updated successfully|
|Set GRE tunnel option|500|GRE tunnel options could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
