# HAConfigure

- Operation: HA Configuration-HA Settings
- Description: Configure High Availability. It is a feature wherein two appliances are grouped together in a cluster and instructed to work as a single entity.

## Sample Configuration

``` xml
<HAConfigure>
    <!-- Configured HA QuickMode for Auxilliary,Active_Active,Active_Passive -->
    <HA_Quick>
        <Device>Auxilliary/Active_Active/Active_Passive</Device>
        <NodeName />
        <DedicatedLink>InterfaceName</DedicatedLink>
        <Passphrase>text</Passphrase>
    </HA_Quick>
    <!-- Configured HA Interactive -->
    <HA_Interactive>
        <Device>Auxilliary/Active_Active/Active_Passive</Device>
        <NodeName />
        <!-- Auxilliary Mode -->
        <Auxilliary>
            <DedicatedLink>InterfaceName</DedicatedLink>
            <Passphrase>text</Passphrase>
        </Auxilliary>
        <!-- Auxilliary End -->
        <!-- Active_Active Or Active_Passive Mode -->
        <ClusterID>Number(0-63)</ClusterID>
        <Passphrase>text</Passphrase>
        <DedicatedLink>InterfaceName</DedicatedLink>_
        <DedicatedLinkIPAddress />
        <MonitorPorts>
            <Interface>Port1</Interface>
            <Interface>Port2</Interface>
            :
        </MonitorPorts>
        <PeerAdministrationList>
            <PeerConfiguration>
                <Interface>Interface</Interface>
                <IPAddressV4>mac</IPAddressV4>
                <IPAddressV6>ip</IPAddressV6>
                <!-- Selected only for bridge Interface -->
                <ReserveBridgePort>Member of Bridge</ReserveBridgePort>
                <!--- Bridge Peer end -->
            </PeerConfiguration>
            :
        </PeerAdministrationList>
        <KeepAlive_Interval>Number(250-500)</KeepAlive_Interval>
        <KeepAlive_Attempts>Number(16-24)</KeepAlive_Attempts>
        <HostMAC>Enable/Disable</HostMAC>
        <FallbackPrimaryDevice>Enable/Disable</FallbackPrimaryDevice>
    </HA_Interactive>
    <!-- Reset Interactive Mode -->
    <HA_Interactive_Reset />
    <!-- Stop Quick Mode -->
    <HA_Quick_Stop />
    <!-- Disable HA -->
    <DisableHA />
</HAConfigure>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|HAConfigurationMode|Yes | |Description:|
||||Select configuration mode for the cluster from the available options: Active-Active OR Active-Passive.|
||||HAConfigurationMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'Active_Active', 'Active_Passive', 'Auxilliary' are allowed.|
|ClusterId|No |0 |Description:|
||||Enter cluster id between 0 to 63.|
||||ClusterId confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 63 is allowed.|
|Keepalive attempts|No | |Description:|
||||Specify the keepalive attempts to make before determining it as device failure (8-16).|
||||Keepalive attempts confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 16 to 24 is allowed.|
|Peer administration settings|No | |Description:|
||||Specify the IP address and port range.|
||||Peer administration settings confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Port|No | |Description:|
||||Select the ports to be monitored and in case any port goes down, the appliance will leave cluster.|
||||Port confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DedicatedHALinkPort|Yes | |Description:|
||||Specify HA link port through which the two appliances are physically connected.|
||||DedicatedHALinkPort confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|PeerHALinkIP|Yes | |Description:|
||||Specify IP Address configured on the HA link port of the peer appliance.|
||||PeerHALinkIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 30.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST' is allowed.|
|NodeName|Yes | |Description:|
||||Name of the HA device.|
||||NodeName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 30.|
||||Minimum characters allowed are 1.|
|EncryptionKey|Yes | |Description:|
||||Specify 'encryptionkey'|
||||EncryptionKey confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 16.|
||||Minimum characters allowed are 8.|
|Keepalive request interval|No | |Description:|
||||Set the keepalive request interval from 250 to 500 milliseconds.|
||||Keepalive request interval confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 250 to 500 is allowed.|
|HA configuration mode|No |QuickHAMode |Description:|
||||Select the HA configuration mode.|
||||HA configuration mode confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '0' are allowed.|
|FailbackPrimaryDevice|No |No preference |Description:|
||||Select to fail back to the primary device after it recovers.|
||||FailbackPrimaryDevice confines to:|
||||Type is 'SCALAR'.|
||||Only 'No preference', 'Auxiliary', 'Primary' are allowed.|
|DisableVMAC|No |Disable |Description:|
||||Use hypervisor assigned MAC addresses.|
||||DisableVMAC confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Port|No | |Description:|
||||Select the port for Heartbeat Link using which both Appliances in HA would monitor each other.|
||||Port confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|HA Configuration-HA Settings|200|HA has been enabled successfully|
|HA Configuration-HA Settings|211|HA has been enabled successfully, but it is recommended to check the physical connectivity of peer monitoring ports|
|HA Configuration-HA Settings|216|HA has been successfully configured. Traffic load balancing is disabled|
|HA Configuration-HA Settings|500|HA could not be enabled|
|HA Configuration-HA Settings|502|Peer system is already running in HA, so can't configure HA again|
|HA Configuration-HA Settings|504|HA is not allowed when VLAN/alias is configured on dedicated HA link port|
|HA Configuration-HA Settings|505|Override MAC is configured on dedicated port, so HA could not be configured|
|HA Configuration-HA Settings|541|Sanity check for HA failed|
|HA Configuration-HA Settings|542|Device is not activated|
|HA Configuration-HA Settings|543|Dedicated interface is down|
|HA Configuration-HA Settings|544|At least one of the monitored interfaces is down|
|HA Configuration-HA Settings|545|Unable to connect with peer device|
|HA Configuration-HA Settings|546|Peer device is not activated|
|HA Configuration-HA Settings|547|Peer dedicated interface is down|
|HA Configuration-HA Settings|548|Firmware version mismatch with peer device|
|HA Configuration-HA Settings|549|Peer HA link IP address is not assigned on "Peer HA link port"|
|HA Configuration-HA Settings|550|Peer administration IP is clashing with current system's interfaces IPs|
|HA Configuration-HA Settings|551|Peer HA link IP is clashing with current system's interfaces IPs|
|HA Configuration-HA Settings|554|HA cannot be configured. Please complete the device registration to configure HA|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
