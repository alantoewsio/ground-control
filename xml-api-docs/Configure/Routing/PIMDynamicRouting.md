# PIMDynamicRouting

- Operation: PIM-SM Configuration
- Description: Protocol-Independent Multicast

## Sample Configuration

``` xml
<PIMDynamicRouting>
    <ManagePIM>Enable/Disable</ManagePIM>
    <InterfaceList>
        <Interface>interfacename</Interface>
        <Interface>interfacename</Interface>
        :
        :
    </InterfaceList>
    <CandidateRP>Disable/Static/Dynamic</CandidateRP>
    <StaticRPIP>
        <IPAddress>IPV4</IPAddress>
        <GroupIP>
            <IPAddress>IPV4</IPAddress>
            :
            :
        </GroupIP>
    </StaticRPIP>
    :
    :
    <DynamicRIP>
        <Interface>interfacename</Interface>
        <GroupIP>
            <IPAddress>IPV4</IPAddress>
            :
            :
        </GroupIP>
        <Priority>Unknown</Priority>
        <Timer>Unknown</Timer>
    </DynamicRIP>
</PIMDynamicRouting>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ManagePIM|No |Disabled |Description:|
||||Click this to enable PIM to provide dynamic multicast support on the device.|
||||ManagePIM confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|CandidateRP|No |As selected in 'PIM Enabled Interface'. |Description:|
||||Select interface IP that will be used as RP IP.|
||||CandidateRP confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Static', 'Dynamic' are allowed.|
||||Note:|
||||Enabled only if 'Candidate RP' is selected in 'RP Settings'.|
|IPAddress|No | |Description:|
||||Specify a unicast IP address for static RP.|
||||IPAddress confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'IPADDRESS'.|
||||Multiple values are allowed.|
||||Duplicate values will be ignored.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
||||Note:|
||||Enabled only if 'Static IP' is selected in 'RP Settings'.|
|IPAddress|No | |Description:|
||||Specify multicast group IP address or network address separated by a comma that will be served by given RP.|
||||IPAddress confines to:|
||||Type is '2DARRAY'.|
||||Datatype is 'STRING'.|
||||Note:|
||||Enabled only if 'Enable PIM' is selected.|
|Interface|No | |Description:|
||||Select interface IP that will be used as RP IP.|
||||Interface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Note:|
||||Enabled only when 'Enable PIM' is selected.|
|priority|No |1 |Description:|
||||Specify the priority of the PIM router in the RP election process.|
||||priority confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 255 is allowed.|
||||Note:|
||||Enabled only if 'Candidate RP' is selected in 'RP Settings'.|
|Timer|No |60 |Description:|
||||Specify time in seconds after which at every specified time, RP candidate messages are generated.|
||||Timer confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 30 to 180 is allowed.|
||||Note:|
||||Enabled only if 'Candidate RP' is selected in 'RP Settings'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|PIM-SM Configuration|200|PIM configuration has been applied successfully|
|PIM-SM Configuration|500|PIM configuration could not be applied|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
