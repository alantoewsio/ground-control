# Zone

- Operation: Add Zone / Edit Zone / Edit Zone from API
- Description: To Add/Edit Zone. Zone is a logical grouping of physical interfaces/ports.

## Sample Configuration

``` xml
<Zone>
    <Name>zonename</Name>
    <Type>LAN/DMZ</Type>
    <!-- MemberPorts are for readonly purpose -->
    <Description>Text</Description>
    <ApplianceAccess>
        <AdminServices>
            <HTTPS>Enable/Disable</HTTPS>
            <SSH>Enable/Disable</SSH>
        </AdminServices>
        <AuthenticationServices>
            <ClientAuthentication>Enable/Disable</ClientAuthentication>
            <CaptivePortal>Enable/Disable</CaptivePortal>
            <ADSSO>Enable/Disable</ADSSO>
            <RadiusSSO>Enable/Disable</RadiusSSO>
            <ChromebookSSO>Enable/Disable</ChromebookSSO>
        </AuthenticationServices>
        <NetworkServices>
            <DNS>Enable/Disable</DNS>
            <Ping>Enable/Disable</Ping>
        </NetworkServices>
        <VPNServices>
            <IPsec>Enable/Disable</IPsec>
            <RED>Enable/Disable</RED>
            <SSLVPN>Enable/Disable</SSLVPN>
            <VPNPortal>Enable/Disable</VPNPortal>
        </VPNServices>
        <OtherServices>
            <WebProxy>Enable/Disable</WebProxy>
            <WirelessProtection>Enable/Disable</WirelessProtection>
            <UserPortal>Enable/Disable</UserPortal>
            <DynamicRouting>Enable/Disable</DynamicRouting>
            <SMTPRelay>Enable/Disable</SMTPRelay>
            <SNMP>Enable/Disable</SNMP>
        </OtherServices>
    </ApplianceAccess>
</Zone>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name to identify the Zone.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed first characters: Alphanumeric characters (A-Za-z1-9) and not a zero (0). For other characters: (A-Za-z0-9_)|
||||Maximum characters allowed are 60.|
|Type|Yes |LAN |Description:|
||||Select the type of Zone from the available options: LAN or DMZ.|
||||Type confines to:|
||||Type is 'SCALAR'.|
||||Only 'LAN', 'WAN', 'DMZ', 'LOCAL', 'VPN', 'Discover' are allowed.|
|MemberPorts|No | |Description:|
||||Displays all the member ports of the particular Zone selected.|
||||MemberPorts confines to:|
||||Type is 'CSV'.|
||||Datatype is 'STRING'.|
||||Comma separated values are allowed.|
|Description|No | |Description:|
||||Specify Zone description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
|IPsec/WirelessProtection/RadiusSSO/UserPortal/DNS/DynamicRouting/SSH/WebProxy/HTTP/RED/CaptivePortal/HTTPS/ChromebookSSO/VPNPortal/Ping/SMTPRelay/ADSSO/SNMP/ClientAuthentication/SSLVPN|No | |Description:|
||||Define the type of administrative access permitted on zone.|
||||IPsec/WirelessProtection/RadiusSSO/UserPortal/DNS/DynamicRouting/SSH/WebProxy/HTTP/RED/CaptivePortal/HTTPS/ChromebookSSO/VPNPortal/Ping/SMTPRelay/ADSSO/SNMP/ClientAuthentication/SSLVPN confines to:|
||||Type is 'ARRAY'.|
||||Only 'Enable', 'Disable' are allowed.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Zone|200|Zone has been added successfully|
|Add Zone|500|Zone could not be added|
|Add Zone|502|Zone could not be added. Zone with the same name already exists, choose a different name|
|Add Zone|510|Zone could not be added. You cannot create more than 100 zones|
|Edit Zone from API|200|Zone has been updated successfully|
|Edit Zone from API|500|Zone could not be updated|
|Edit Zone|200|Zone has been updated successfully|
|Edit Zone|500|Zone could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
