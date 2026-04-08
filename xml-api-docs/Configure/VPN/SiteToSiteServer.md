# SiteToSiteServer

- Operation: Add SSLVPN Server Connection / Edit SSLVPN Server Connection
- Description: To Add/Edit SSLVPN Server Connection.

## Sample Configuration

``` xml
<SiteToSiteServer>
    <Name>text</Name>
    <StaticIP>Enable/Disable</StaticIP>
    <!-- If StaticIP is Enable -->
    <PeerIP>ipaddress</PeerIP>
    <LocalNetworks>
        <Network>host</Network>
        :
    </LocalNetworks>
    <RemoteNetworks>
        <Network>host</Network>
        :
    </RemoteNetworks>
    <Description>text</Description>
    <Status>On/Off</Status>
</SiteToSiteServer>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Connection Name|Yes | |Description:|
||||Enter a descriptive name for the connection.|
||||Connection Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|Description|No | |Description:|
||||Enter a description or other information.|
|Use Static Virtual IP Status|No | |Description:|
||||Enable/Disable 'Use Static Virtual IP Address'.|
||||Use Static Virtual IP Status confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Use Static Virtual IP Address|No | |Description:|
||||Enter a suitable IP address which will be assigned during tunnel setup if the IP Address assigned from the Virtual IP pool is in use on the client's host.|
||||Use Static Virtual IP Address confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|Local Networks.|Yes | |Description:|
||||Select or add one or more remote networks that are allowed to connect to the local network(s).|
||||Local Networks. confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Remote Networks.|Yes | |Description:|
||||Select or add one or more remote networks that are allowed to connect to the local network(s).|
||||Remote Networks. confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Status|No | |Description:|
||||Specify 'isenable'|
||||Status confines to:|
||||Type is 'SCALAR'.|
||||Only 'Off', 'On' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add SSLVPN Server Connection|200|SSL server connection has been created successfully.|
|Add SSLVPN Server Connection|500|SSL server connection could not be added.|
|Add SSLVPN Server Connection|502|SSL server connection could not be created. SSL server connection with the same name as "\<DynamicValue>" already exists, choose a different name.|
|Edit SSLVPN Server Connection|200|SSL server connection has been updated successfully.|
|Edit SSLVPN Server Connection|500|SSL server connection could not be updated.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
