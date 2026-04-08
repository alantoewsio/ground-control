# MulticastRoute

- Operation: Add Multicast Route / Edit Multicast Route
- Description: To Add/Update Multicast Route. Multicast Route delivers the traffic generated from a single source to multiple receivers.

## Sample Configuration

``` xml
<MulticastRoute>
    <SourceIPAddress>ipaddress</SourceIPAddress>
    <SourceInterface>PortA</SourceInterface>
    <SourceTunnel>SystemInterface/IPSec/GRE</SourceTunnel>
    <MulticastAddress>ipaddress</MulticastAddress>
    <DestinationInterfaceList>
        <DestinationInterface>
            <!-- For TunnelType IPSec give 'IPSec Connection' in 'Interface' tag -->
            <Interface>PortB</Interface>
            <TunnelType>SystemInterface/IPSec/GRE</TunnelType>
        </DestinationInterface>
        :
    </DestinationInterfaceList>
    <OldConfiguration>
        <SourceIPAddress>ipaddress</SourceIPAddress>
        <MulticastAddress>ipaddress</MulticastAddress>
    </OldConfiguration>
</MulticastRoute>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|SourceIPAddress|Yes | |Description:|
||||Specify Source IPv4 address.|
||||SourceIPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|SourceTunnel|No | |Description:|
||||Select Source Tunnel from the available options: System Interface, IPSec or GRE.|
||||SourceTunnel confines to:|
||||Type is 'SCALAR'.|
||||Only 'SystemInterface', 'IPSec', 'GRE' are allowed.|
|SourceInterface|No | |Description:|
||||Select Source Interface from the list.|
||||SourceInterface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|MulticastAddress|Yes | |Description:|
||||Specify the Multicast IPv4 Address.|
||||MulticastAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
|TunnelType|No | |Description:|
||||Select Destination Tunnel Type from the available options: System Interface, IPSec or GRE.|
||||TunnelType confines to:|
||||Type is 'ARRAY'.|
||||Only 'SystemInterface', 'IPSec', 'GRE' are allowed.|
||||Multiple values are allowed.|
|Interface|No | |Description:|
||||Select Destination Interface from the list.|
||||Interface confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Multicast Route|200|Added the multicast route.|
|Add Multicast Route|211|Saved the configuration but can't apply it. Make sure the source interface is connected.|
|Add Multicast Route|212|Saved the configuration but can't apply it. Make sure the source interface is connected.|
|Add Multicast Route|213|Saved the configuration but can't apply it. Make sure the destination interface is connected.|
|Add Multicast Route|214|Saved the configuration but can't apply it. Make sure the destination interface is connected.|
|Add Multicast Route|500|Couldn't add the multicast route.|
|Add Multicast Route|504|You cannot configure both multicast forwarding and PIM concurrently. To configure multicast forwarding, disable PIM|
|Add Multicast Route|541|Multicast route could not be updated. Internal error occured while saving the configuration|
|Add Multicast Route|542|Invalid destination ip address. Destination address must be in the range of 224.0.2.0 to 239.255.255.255|
|Add Multicast Route|543|Source and destination interface must not be the same.|
|Add Multicast Route|544|Provided input interface conflicts with an existing multicast route's input interface having the same source and destination IP addresses|
|Add Multicast Route|545|Multicast route could not be updated. Multicast route with similar configuration already exists|
|Add Multicast Route|547|Invalid source ip address. Source IP address must not be in the range of 224.0.0.0 to 239.255.255.255|
|Edit Multicast Route|200|Updated the multicast route.|
|Edit Multicast Route|211|Saved the configuration but can't apply it. Make sure the source interface is connected.|
|Edit Multicast Route|212|Saved the configuration but can't apply it. Make sure the source interface is connected.|
|Edit Multicast Route|213|Saved the configuration but can't apply it. Make sure the destination interface is connected.|
|Edit Multicast Route|214|Saved the configuration but can't apply it. Make sure the destination interface is connected.|
|Edit Multicast Route|500|Couldn't update the multicast route.|
|Edit Multicast Route|504|You cannot configure both multicast forwarding and PIM concurrently. To configure multicast forwarding, disable PIM|
|Edit Multicast Route|541|Existing configuration could not be updated. Internal error|
|Edit Multicast Route|542|Invalid destination ip address. Destination address must be in the range of 224.0.2.0 to 239.255.255.255|
|Edit Multicast Route|543|Source and destination interface must not be the same.|
|Edit Multicast Route|544|Provided input interface conflicts with an existing multicast route's input interface having the same source and destination IP addresses|
|Edit Multicast Route|545|Multicast route could not be updated. Multicast route with similar configuration already exists|
|Edit Multicast Route|546|Multicast route could not be added. Internal error|
|Edit Multicast Route|547|Invalid source ip address. Source IP address must not be in the range of 224.0.0.0 to 239.255.255.255|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
