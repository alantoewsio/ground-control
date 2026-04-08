# WirelessProtectionGlobalSettings

- Operation: Global Settings
- Description: Configure wireless protection global settings.

## Sample Configuration

``` xml
<WirelessProtectionGlobalSettings>
    <WirelessProtection>Enable</WirelessProtection>
    <AllowedZone>
        <Zone>LAN</Zone>
        <Zone>WiFi</Zone>
    </AllowedZone>
    <NotificationTimeout>5</NotificationTimeout>
    <RADIUSServer>None/Redius1</RADIUSServer>
</WirelessProtectionGlobalSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|WirelessProtection|No||Description:|
||||Enable or disable wireless protection.|
||||WirelessProtection confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Zone|No||Description:|
||||Specify allowed zones for wireless protection.|
||||Zone confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|NotificationTimeout|No||Description:|
||||Specify notification timeout in minutes.|
||||NotificationTimeout confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|RADIUSServer|Yes||Description:|
||||Specify RADIUS server for wireless protection.|
||||RADIUSServer confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Global Settings|200|Wireless protection global settings updated successfully|
|Global Settings|500|Wireless protection global settings could not be updated|
|Global Settings|501|IP address is assigned to some other interface/access point|
|Global Settings|504|Virtual host with the same IP address already exists, choose a different IP address for access point based virtual host|
|Global Settings|511|Update access point failed while unbinding interface|
|Global Settings|512|Update access point failed while deleting DHCP server|
|Global Settings|513|Update access point failed while deleting DHCP relay|
|Global Settings|516|Failed to unbind access point|
|Global Settings|520|Failed to unbind access point (all configuration parts updated)|
|Global Settings|521|Wireless protection global settings could not be updated|
|Global Settings|523|Without unbinding other wireless LAN access points, default access point cannot be unbounded. Please unbound all other wireless LAN access points and then try again|
|Global Settings|524|Default access point is unbound so access point could not be bound|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
