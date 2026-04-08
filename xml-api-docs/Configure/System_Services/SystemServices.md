# SystemServices

- Operation: Manage Servers
- Description: To view the current status and manage all the configured services.

## Sample Configuration

``` xml
<SystemServices>
    <AntiSpam>
        <Status>Success/Stopped/Running/Unregistered</Status>
        <Action>Start/Stop/Restart</Action>
    </AntiSpam>
    <AntiVirus>
        <Status>Success/Stopped/Running/Unregistered</Status>
        <Action>Start/Stop/Restart</Action>
    </AntiVirus>
    <Authentication>
        <Status>Success/Stopped/Running/Unregistered</Status>
        <Action>Start/Stop/Restart</Action>
    </Authentication>
    <DHCPServer>
        <Status>Success/Stopped/Running/Unregistered</Status>
        <Action>Start/Stop/Restart</Action>
    </DHCPServer>
    <DNSServer>
        <Status>Success/Stopped/Running/Unregistered</Status>
        <Action>Start/Stop/Restart</Action>
    </DNSServer>
    <IPS>
        <Status>Success/Stopped/Running/Unregistered</Status>
        <Action>Start/Stop/Restart</Action>
    </IPS>
    <WebProxy>
        <Status>Success/Stopped/Running/Unregistered</Status>
        <Action>Start/Stop/Restart</Action>
    </WebProxy>
    <WAF>
        <Status>Success/Stopped/Running/Unregistered</Status>
        <Action>Start/Stop/Restart</Action>
    </WAF>
    <DHCPv6Server>
        <Status>Success/Stopped/Running/Unregistered</Status>
        <Action>Start/Stop/Restart</Action>
    </DHCPv6Server>
    <RouterAdvertisementService>
        <Status>Success/Stopped/Running/Unregistered</Status>
        <Action>Start/Stop/Restart</Action>
    </RouterAdvertisementService>
</SystemServices>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Service|Yes | |Description:|
||||Name of the configured service.|
||||Service confines to:|
||||Type is 'SCALAR'.|
||||Only 'kasd', 'kavd', 'access_server', 'dhcpserver', 'dns', 'ips', 'awarrenhttp', 'waf', 'dhcpd6', 'hotspot', 'radvd' are allowed.|
|Action|Yes | |Description:|
||||Start, Stop or Restart the configured service.|
||||Action confines to:|
||||Type is 'SCALAR'.|
||||Only 'Start', 'Stop', 'Restart' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Manage Servers|200|Applied settings|
|Manage Servers|500|Couldn't apply settings|
|Manage Servers|541|Service could not be started because of improper configuration|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
