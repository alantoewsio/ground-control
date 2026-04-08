# Interface

- Operation: Interface
- Description: Manage physical interfaces and view Port wise Network and Zone details.

## Sample Configuration

``` xml
<Interface>
    <Name>Descriptive name of Interface</Name>
    <Hardware>interfacename</Hardware>
    <NetworkZone>zonename</NetworkZone>
    <BreakoutMembers>0/2/4</BreakoutMembers>
    <BreakoutSource>{interfacename}</BreakoutSource>
    <!-- IPv4Configuration -->
    <IPv4Configuration>Enable/Disable</IPv4Configuration>
    <IPv4Assignment>Static/PPPoe/DHCP</IPv4Assignment>
    <!--  For Static -->
    <IPAddress>ipaddress</IPAddress>
    <Netmask>netmask</Netmask>
    <GatewayName>gatewayname</GatewayName>
    <GatewayIP>IP address</GatewayIP>

    <!-- For PPPoE -->
    <PreferredIP>ipaddress</PreferredIP>
    <LocalIP>ipaddress</LocalIP>
    <Username>username</Username>
    <Password>password</Password>
    <ServiceName>name</ServiceName>
    <ServiceName2>name</ServiceName2>
    <LCPEchoInterval>Disable/no of seconds</LCPEchoInterval>
    <LCPFailure>Disable/No of Attempts</LCPFailure>
    <SchedulTimeForReconnect>Enable</SchedulTimeForReconnect>
    <Schedule>
        <DayOfWeek>All Days of week/Sunday/Monday/Tuesday/Wednesday/Thursday/Friday/Saturday</DayOfWeek>
        <Hour>Number</Hour>
        <Minute>Number</Minute>
    </Schedule>
    <DSLSetting>{Enable/Disable}</DSLSetting>
    <VLANTag />
    <!-- IPv6Configuration -->
    <IPv6Configuration>Enable/Disable</IPv6Configuration>
    <IPv6Assignment>Static/DHCP/Delegated</IPv6Assignment>
    <!-- dhcp configuration -->
    <Mode>Auto/Manual</Mode>
    <DhcpOnly>Enable/Disable</DhcpOnly>
    <AcceptOtherConfigfromDHCP>Enable/Disable</AcceptOtherConfigfromDHCP>
    <PrefixDelegation>Enable/Disable</PrefixDelegation>
    <PrefixPreference>Enable/Disable</PrefixPreference>
    <PreferredPrefixAddress>{PreferredPrefixAddress}</PreferredPrefixAddress>
    <PreferredPrefixLength>{PreferredPrefixLength}</PreferredPrefixLength>
    <DHCPRapidCommit>Enable/Disable</DHCPRapidCommit>
    <IPv6Address>ipaddress</IPv6Address>
    <Prefix>Number</Prefix>
    <GatewayNameIpv6>gatewayname</GatewayNameIpv6>
    <GatewayIPv6>ipv6 address</GatewayIPv6>
    <!-- delegated configuration -->
    <UpstreamInterface>{interfacename}</UpstreamInterface>
    <SubnetAndInterfaceIDs>{SubnetAndInterfaceIDs}</SubnetAndInterfaceIDs>
    <EnableRA>Enable/Disable</EnableRA>
    <EnableDHCPv6Server>Enable/Disable</EnableDHCPv6Server>
    <!-- Advanced Settings -->
    <InterfaceSpeed>Auto Negotiate/10MbpsHD/10MbpsFD/100MbpsHD/100MbpsFD/1000MbpsHD/1000MbpsFD/5000MbpsFD/10000MbpsFD/20GbpsFD/25GbpsFD/40GbpsFD/50GbpsFD/56GbpsFD/100GbpsFD</InterfaceSpeed>
    <AutoNegotiation>Enable/Disable</AutoNegotiation>
    <FEC>Off/Automatic/BaseR-encoding/RS-FEC-encoding</FEC>
    <MTU>1500</MTU>
    <MSS>
        <OverrideMSS>Enable/Disable</OverrideMSS>
        <MSSValue>1455</MSSValue>
    </MSS>
    <MACAddress>Default/{userdefined MAC Address}</MACAddress>
    <!-- RA Configuration for dhcp -->
    <DADAttempts>1</DADAttempts>
    <AllowedRAServers />
    <Status>Text</Status><!-- this tag is only read purpose showing connectivity status of Interface -->
    <InterfaceStatus>ON/OFF</InterfaceStatus>
</Interface>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Hardware|Yes | |Description:|
||||Name of the physical interface/port on the appliance.|
||||Hardware confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|NetworkZone|No | |Description:|
||||Select Zone to which the interface belongs.|
||||NetworkZone confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed first characters: Alphanumeric characters (A-Za-z1-9) and not a zero (0). For other characters: (A-Za-z0-9_)|
|IPv4Configuration, IPv6Configuration|No | |Description:|
||||Used to determine whether the IP type is IPv4 or IPv6.|
||||IPv4Configuration,IPv6Configuration confines to:|
||||Type is 'ARRAY'.|
||||Only '0', '1' are allowed.|
||||Multiple values are allowed.|
|IPv4Assignment|No | |Description:|
||||Select IP Assignment type from the available options: Static, PPPoE or DHCP.|
||||IPv4Assignment confines to:|
||||Type is 'SCALAR'.|
||||Only 'Static', 'PPPoE', 'DHCP' are allowed.|
|IPAddress|No | |Description:|
||||Used to set IPv4 address for interface in IPv4 configuration.|
||||IPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|Netmask|No | |Description:|
||||Used to set IPv4 Network Subnet mask.|
||||Netmask confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 15.|
||||IPv4 Address should be between: [128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255]|
|GatewayName|No | |Description:|
||||In IPv4 configuration, if Network Zone is selected as WAN, specify the Gateway through which traffic from the interface is to be routed.|
||||GatewayName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||UTF-8 character(s) are allowed.|
|GatewayIP|No | |Description:|
||||In IPv4 configuration, specify the Gateway IP Address.|
||||GatewayIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|Username|No | |Description:|
||||In IPv4 configuration, if Network Zone is selected as WAN and IP Assignment is selected as PPPoE, specify the username for PPPoE IP assignment.|
||||Username confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Characters not allowed: (^;'"\)|
||||Maximum characters allowed are 50.|
|Password|No | |Description:|
||||In IPv4 configuration, if Network Zone is selected as WAN and IP Assignment is selected as PPPoE, specify the password for PPPoE IP assignment.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ServiceName|No | |Description:|
||||In IPv4 configuration, if Network Zone is selected as WAN and IP Assignment is selected as PPPoE, specify the Service Name or Access Concentrator for PPPoE IP assignment.|
||||ServiceName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|ServiceName2|No | |Description:|
||||In IPv4 configuration, if Network Zone is selected as WAN and IP Assignment is selected as PPPoE, specify the Service Name or Access Concentrator for PPPoE IP assignment.|
||||ServiceName2 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 20.|
|SendLCPEchoRequestEvery|No |20 |Description:|
||||Specify time interval between LCP Echo Requests. These requests are used to check if the link is alive.|
||||SendLCPEchoRequestEvery confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 5 to 180 is allowed.|
||||Maximum digits allowed are 4.|
|WaitForLCPEchoReplyFor|No |3 |Description:|
||||Number of attempts to wait for LCP echo reply after which the PPPoE link will be declared as closed.|
||||WaitForLCPEchoReplyFor confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 65535 is allowed.|
||||Maximum digits allowed are 5.|
|PreferredIP|No | |Description:|
||||Specify Static IP Address provided by ISP for a PPPoE Connection.|
||||PreferredIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|SchedulTimeForReconnect|No | |Description:|
||||Enable Schedule for Reconnect.|
||||SchedulTimeForReconnect confines to:|
||||Type is 'SCALAR'.|
||||Only '0', 'Enable' are allowed.|
|Day For Auto Start|No | |Description:|
||||Specify day for Auto Start.|
||||Day For Auto Start confines to:|
||||Type is 'SCALAR'.|
||||Only 'All Days of week', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday' are allowed.|
|Hour For Auto Start|No | |Description:|
||||Specify Hour for Auto Start.|
||||Hour For Auto Start confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 23 is allowed.|
|Minute For Auto Start|No | |Description:|
||||Specify Minutes for Auto Start.|
||||Minute For Auto Start confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 59 is allowed.|
|Mode|No | |Description:|
||||Specify 'dhcpmode'|
||||Mode confines to:|
||||Type is 'SCALAR'.|
||||Only 'Auto', 'Manual' are allowed.|
|isdhcponly|No | |Description:|
||||Specify 'isdhcponly'|
||||confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|acceptotherconf|No | |Description:|
||||Specify 'acceptotherconf'|
||||confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|
|DHCPRapidCommit|No | |Description:|
||||Specify 'rapidcommit'|
||||DHCPRapidCommit confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|
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
||||UTF-8 character(s) are allowed.|
|GatewayIPv6|No | |Description:|
||||Used to set IPv6 address for Gateway in IPv6 Configuration.|
||||GatewayIPv6 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 45.|
|DSLSetting|No | |Description:|
||||To enable the VDSL settings.|
||||DSLSetting confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 2 is allowed.|
||||Note:|
||||0 - Disable DSL,1 - Enable VDSL,2 - Enable ADSL.|
|MTU|Yes |1500 |Description:|
||||Used to set Maximum Transmission Unit value which is the largest physical packet size.|
||||MTU confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|MSSValue|Yes |1460 |Description:|
||||Used to set Maximum Segment Size which is the amount of data that can be transmitted in a single packet.|
||||MSSValue confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 536 to 8960 is allowed.|
|dad|No | |Description:|
||||Specify 'dad'|
||||dad confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 8 is allowed.|
|AllowedRAServers|No | |Description:|
||||Specify 'raserveraddress'|
||||AllowedRAServers confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|BreakoutMembers|No | |Description:|
||||Enter the number of breakout members.|
|BreakoutSource|No | |Description:|
||||Source interface for breakout members.|
||||BreakoutSource confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 15.|
|PrefixDelegation|No |1 |Description:|
||||Turns IPv6 prefix delegation on or off.|
||||PrefixDelegation confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|PrefixPreference|No |1 |Description:|
||||Allows you to request a preferred IPv6 prefix.|
||||PrefixPreference confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|PreferredPrefixAddress|No |1 |Description:|
||||Requests the ISP for the prefix address you prefer.|
||||PreferredPrefixAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 45.|
|PreferredPrefixLength|No |1 |Description:|
||||Requests the ISP for the prefix length you prefer.|
||||PreferredPrefixLength confines to:|
||||Type is 'SCALAR'.|
||||Only '48', '52', '56', '60' are allowed.|
|UpstreamInterface|No |1 |Description:|
||||The firewall uses the delegated IPv6 prefix received by the upstream interface to configure the current interface's address.|
||||UpstreamInterface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SubnetAndInterfaceIDs|No |1 |Description:|
||||Subnet and interface IDs of the interface.|
||||SubnetAndInterfaceIDs confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||SUBNETANDIFACEIDS|
||||Maximum characters allowed are 26.|
|EnableRA|No |1 |Description:|
||||Configures a router advertisement entry to advertise the IPv6 prefix.|
||||EnableRA confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|EnableDHCPv6Server|No |1 |Description:|
||||Configures a DHCPv6 server to provide other DHCP parameters, such as DNS. Doesn't provide IPv6 addresses.|
||||EnableDHCPv6Server confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|FEC|No |off |Description:|
||||Forward Error Correction|
||||FEC confines to:|
||||Type is 'SCALAR'.|
||||Only 'Automatic', 'Off', 'BaseR-encoding', 'RS-FEC-encoding' are allowed.|
|MACAddress|No |Enable |Description:|
||||Select to use default MAC Address.|
||||MACAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'MACADDRESS'.|
||||Maximum characters allowed are 17.|
|Name|No | |Description:|
||||Specify a descriptive name for the physical interface/port.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 58.|
|InterfaceStatus|No |ON |Description:|
||||To turn interfaces on or off.|
||||InterfaceStatus confines to:|
||||Type is 'SCALAR'.|
||||Only 'OFF', 'ON' are allowed.|
|InterfaceSpeed|No |Auto Negotiate |Description:|
||||Used to set interface Speed for Physical interface.|
||||InterfaceSpeed confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|VLANTag|No | |Description:|
||||Specify the VLAN Tag to configure interface.|
||||VLANTag confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 4094 is allowed.|
|AutoNegotiation|No |1 |Description:|
||||Turns on auto-negotiation for connection parameters other than link speed and duplex.|
||||AutoNegotiation confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 1 is allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Interface|200|Updated interface "\<DynamicValue>".|
|Interface|500|Interface "\<DynamicValue>" could not be updated|
|Interface|502|IP address is assigned to some other interface|
|Interface|503|Gateway with the same name exists. Enter a different name.|
|Interface|505|Interface could not be updated. Gateway-based firewall rule exists|
|Interface|507|Interface-based virtual host with the same IP address already exists, choose a different IP address|
|Interface|508|This IP address is assigned to either peer administration port or peer dedicated port of HA cluster|
|Interface|510|There has to be at least one interface in WAN zone|
|Interface|513|Update interface failed while deleting DHCP relay|
|Interface|515|Can't configure another WAN interface because the firewall has reached the maximum number of gateways. To configure the interface, you must delete an IPv4 or IPv6 gateway.|
|Interface|520|Failed to unbind interface (all configuration parts updated)|
|Interface|541|Update interface failed while deleting DHCP server|
|Interface|542|Update interface failed while unbinding interface|
|Interface|543|Update interface failed while deleting PPPoE information|
|Interface|544|Update interface failed while deleting gateway information|
|Interface|545|Failed to unbind interface|
|Interface|546|Invalid MAC address.|
|Interface|547|MAC address conflicts with the system's MAC address.|
|Interface|548|MAC address conflicts with the list of virtual MAC addresses reserved for HA.|
|Interface|549|MAC address change is not allowed. PPPoE is configured on VLAN or physical interface|
|Interface|550|Can't change the IP assignment type to DHCP, Delegated, or PPPoE. The firewall is in active-active HA mode.|
|Interface|551|Can't change the IP assignment from static to PPPoE or DHCP when VLAN is configured.|
|Interface|561|VLAN interface with the same VDSL tag already exists.|
|Interface|564|Can't set Network zone to None. An associated virtual interface is the dedicated HA link.|
|Interface|565|Can't update this interface. An associated virtual interface is the dedicated HA link.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
