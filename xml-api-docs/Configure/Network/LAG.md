# LAG

- Operation: Add LAG / Edit LAG
- Description: To Add/Edit Link Aggregation Group(LAG)interfaces. LAG interfaces allows multiple physical links to be combined into a single logical link.

## Sample Configuration

``` xml
<LAG>
    <Name>Descriptive name of LAG</Name>
    <Hardware>interfacename</Hardware>
    <MemberInterface>
        <Interface>interfacename</Interface>
        :
    </MemberInterface>
    <Mode>ActiveBackup/802.3ad(LACP)</Mode>
    <NetworkZone>zonename</NetworkZone>
    <IPAssignment>Static/DHCP</IPAssignment>
    <!-- IPv4Configuration -->
    <IPv4Configuration>Enable/Disable</IPv4Configuration>
    <IPAssignment>Static/PPPoe/DHCP</IPAssignment>
    <IPv4Address>ipaddress</IPv4Address>
    <Netmask>netmask</Netmask>
    <GatewayName>Text</GatewayName>
    <GatewayIP>ip address</GatewayIP>

    <!-- IPv6Configuration -->
    <IPv6Configuration>Enable/Disable</IPv6Configuration>
    <IPv6Address>ipaddress</IPv6Address>
    <Prefix>Number</Prefix>
    <GatewayNameIpv6>Text</GatewayNameIpv6>
    <GatewayIPv6>ipv6 address</GatewayIPv6>
    <InterfaceSpeed>Auto Negotiate/10MbpsHD/10MbpsFD/100MbpsHD/100MbpsFD/1000MbpsHD/1000MbpsFD/5000MbpsFD/10000MbpsFD/20GbpsFD/25GbpsFD/40GbpsFD/50GbpsFD/56GbpsFD/100GbpsFD</InterfaceSpeed>
    <AutoNegotiation>Enable/Disable</AutoNegotiation>
    <FEC>Off/Automatic/BaseR-encoding/RS-FEC-encoding</FEC>
    <MTU>Number</MTU>
    <MSS>
        <OverrideMSS>Enable/Disable</OverrideMSS>
        <MSSValue>Number</MSSValue>
    </MSS>
    <XmitHashPolicy>Layer2/Layer2+3/Layer3+4</XmitHashPolicy>
    <PrimaryInterface />
    <MACAddress>Default/{userdefined MAC Address}</MACAddress>
    <InterfaceStatus>ON/OFF</InterfaceStatus>
</LAG>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Interface|Yes | |Description:|
||||Select the ports from the list which are the members of the interface.|
||||Interface confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Mode|Yes | |Description:|
||||Select the mode of LAG from available options: Active-Passive and 802.3ad (LACP).|
||||Mode confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|NetworkZone|Yes | |Description:|
||||Select Network zone for the interface.|
||||NetworkZone confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|IPAssignment|Yes |Static |Description:|
||||Select the IP Assignment Scheme from the available options.|
||||IPAssignment confines to:|
||||Type is 'SCALAR'.|
||||Only 'Static', 'DHCP' are allowed.|
|IPv4Address|No | |Description:|
||||Specify IPv4 address for the interface.|
||||IPv4Address confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'NETWORKBROADCAST', 'NETWORKIP' is allowed.|
|Netmask|No | |Description:|
||||Specify Network Subnet mask for the interface.|
||||Netmask confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|GatewayName|No | |Description:|
||||Specify Gateway name through which traffic is to be routed.|
||||GatewayName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|GatewayIP|No | |Description:|
||||Specify Gateway IPv4 Address.|
||||GatewayIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|InterfaceSpeed|No | |Description:|
||||Select Interface speed for Synchronization.|
||||InterfaceSpeed confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|MTU|Yes |1500 |Description:|
||||Specify Maximum Transmission Unit(MTU)value.|
||||MTU confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 576 to 9000 is allowed.|
||||Maximum digits allowed are 4.|
|MSSValue|Yes |Enable |Description:|
||||Select to specify Maximum Segment Size(MSS)to override default MSS.|
||||MSSValue confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 536 to 8960 is allowed.|
||||Maximum digits allowed are 4.|
|XmitHashPolicy|Yes | |Description:|
||||Select the Xmit hash Policy to be used for member interfaces from the options available: Layer2, Layer2+3, Layer 3+4.|
||||XmitHashPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Note:|
||||Available only if 802.3ad LACP mode is selected.|
|MACAddress|Yes |Enable |Description:|
||||Select to use default MAC Address.|
||||MACAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'MACADDRESS'.|
||||Maximum characters allowed are 17.|
|IPv6Address|No | |Description:|
||||Used to set IPv6 address for interface in IPv6 Configuration.|
||||IPv6Address confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS6'.|
||||Maximum characters allowed are 45.|
||||IP Class other than 'MULTICAST', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL', 'NETWORKBROADCAST', 'NETWORKIP' is allowed.|
|Prefix|No | |Description:|
||||Used to set Prefix for Physical interface in IPv6 Configuration.|
||||Prefix confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 128 is allowed.|
||||Maximum digits allowed are 3.|
|GatewayNameIpv6|No | |Description:|
||||Used to configure Gateway Name for IPv6 Configuration.|
||||GatewayNameIpv6 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|GatewayIPv6|No | |Description:|
||||Used to set IPv6 address for Gateway in IPv6 Configuration.|
||||GatewayIPv6 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 45.|
|InterfaceStatus|No |ON |Description:|
||||To turn interfaces on or off.|
||||InterfaceStatus confines to:|
||||Type is 'SCALAR'.|
||||Only 'OFF', 'ON' are allowed.|
|AutoNegotiation|No |1 |Description:|
||||Turns on auto-negotiation for connection parameters other than link speed and duplex.|
||||AutoNegotiation confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 1 is allowed.|
|FEC|No |off |Description:|
||||Forward Error Correction|
||||FEC confines to:|
||||Type is 'SCALAR'.|
||||Only 'Automatic', 'Off', 'BaseR-encoding', 'RS-FEC-encoding' are allowed.|
|Hardware/LagInterface|Yes | |Description:|
||||Specify a name for the LAG interface.|
||||Hardware/LagInterface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 10.|
||||UTF-8 character(s) are allowed.|
|Name|No | |Description:|
||||Specify a descriptive name for the LAG interface.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 58.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add LAG|200|LAG interface added successfully|
|Add LAG|500|LAG interface could not be added|
|Add LAG|502|IP address is assigned to some other interface|
|Add LAG|503|Gateway with the same name exists. Enter a different name.|
|Add LAG|504|LAG interface already exists|
|Add LAG|509|Add link aggregation failed|
|Add LAG|510|Hardware name "\<DynamicValue>" exists as a specified or system-reserved name. Specify a different name.|
|Add LAG|530|Couldn't add some interfaces to LAG. They contain VLANs that are part of a bridge interface.|
|Add LAG|541|At least 2 member interfaces required|
|Add LAG|542|Maximum 4 member interfaces allowed|
|Add LAG|543|Member interface is not physical interface|
|Add LAG|544|Member interface already enslaved|
|Add LAG|545|Member interface should be unbound|
|Add LAG|546|Invalid MAC address.|
|Add LAG|547|MAC address conflicts with the system's MAC address.|
|Add LAG|548|MAC address conflicts with the list of virtual MAC addresses reserved for HA.|
|Add LAG|550|Can't change the IP assignment type to DHCP, Delegated, or PPPoE. The firewall is in active-active HA mode.|
|Add LAG|551|Can't configure another WAN interface because the firewall has reached the maximum number of gateways. To configure the interface, you must delete an IPv4 or IPv6 gateway.|
|Edit LAG|200|LAG interface update successfully|
|Edit LAG|500|LAG interface could not be updated|
|Edit LAG|502|IP address is assigned to some other interface|
|Edit LAG|503|Gateway with the same name exists. Enter a different name.|
|Edit LAG|507|Can't unbind all interfaces.|
|Edit LAG|530|Couldn't add some interfaces to LAG. They contain VLANs that are part of a bridge interface.|
|Edit LAG|541|At least 2 member interfaces required|
|Edit LAG|542|Maximum 4 member interfaces allowed|
|Edit LAG|543|Member interface is not physical interface|
|Edit LAG|544|Member interface already enslaved|
|Edit LAG|546|Invalid MAC address.|
|Edit LAG|547|MAC address conflicts with the system's MAC address.|
|Edit LAG|548|MAC address conflicts with the list of virtual MAC addresses reserved for HA.|
|Edit LAG|549|LAG interface is part of HA configuration so change in member interfaces is not allowed|
|Edit LAG|550|Can't change the IP assignment type to DHCP, Delegated, or PPPoE. The firewall is in active-active HA mode.|
|Edit LAG|551|Can't configure another WAN interface because the firewall has reached the maximum number of gateways. To configure the interface, you must delete an IPv4 or IPv6 gateway.|
|Edit LAG|563|Can't update this interface. It's configured as the dedicated HA link.|
|Edit LAG|564|Can't update this interface. An associated virtual interface is the dedicated HA link.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
