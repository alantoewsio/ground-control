# WirelessMeshNetworks

- Operation: Add Mesh Networks / Update Mesh Networks
- Description: Create Mesh Networks and assign Access Points to them.

## Sample Configuration

``` xml
<WirelessMeshNetworks>
    <MeshID>testmesh</MeshID>
    <FrequencyBand>5GHz/2.4GHz</FrequencyBand>
    <Description />
    <AccessPoints>
        <MeshNetwork>
            <AccessPoint>AP30[A40016ADB63B7F1]</AccessPoint>
            <Role>RootAccessPoint</Role>
        </MeshNetwork>
    </AccessPoints>
</WirelessMeshNetworks>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|MeshID|Yes||Description:|
||||Click here to add one or more mesh access points.|
||||MeshID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 10.|
|FrequencyBand|Yes|5GHz|Description:|
||||Select the frequency band for the Mesh Network.|
||||FrequencyBand confines to:|
||||Type is 'SCALAR'.|
||||Only '5GHz', '2.4GHz' are allowed.|
|Description|No||Description:|
||||Add description for the Mesh Network.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AccessPoint|No||Description:|
||||Select an access point for the Mesh Network Role.|
||||AccessPoint confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Role|No|RootAccessPoint|Description:|
||||Select the access point's role for the selected Mesh Network.|
||||Role confines to:|
||||Type is 'ARRAY'.|
||||Only 'MeshAccessPoint', 'RootAccessPoint' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Mesh Networks|200|Mesh network has been added successfully|
|Add Mesh Networks|500|Mesh network could not be added|
|Add Mesh Networks|501|IP address is assigned to some other interface/access point|
|Add Mesh Networks|504|Virtual host with the same IP address already exists, choose a different IP address for access point based virtual host|
|Add Mesh Networks|521|Mesh network could not be added|
|Add Mesh Networks|522|Default wireless LAN access point is unbound. Please bind default access point and try again|
|Update Mesh Networks|200|Mesh network has been updated successfully|
|Update Mesh Networks|500|Mesh network could not be updated|
|Update Mesh Networks|501|IP address is assigned to some other interface/access point|
|Update Mesh Networks|504|Virtual host with the same IP address already exists, choose a different IP address for access point based virtual host|
|Update Mesh Networks|511|Update access point failed while unbinding interface|
|Update Mesh Networks|512|Update access point failed while deleting DHCP server|
|Update Mesh Networks|513|Update access point failed while deleting DHCP relay|
|Update Mesh Networks|516|Failed to unbind access point|
|Update Mesh Networks|520|Failed to unbind access point (all configuration parts updated)|
|Update Mesh Networks|521|Mesh network could not be updated|
|Update Mesh Networks|523|Without unbinding other wireless LAN access points, default access point cannot be unbounded. Please unbound all other wireless LAN access points and then try again|
|Update Mesh Networks|524|Default access point is unbound so access point could not be bound|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
