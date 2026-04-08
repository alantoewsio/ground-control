# VLAN

- Operation: Add VLAN / Edit VLAN
- Description: To Add/Update VLAN interfaces. VLAN is a broadcast domain configured on Switch on a port-by-port basis.

## Sample Configuration

``` xml
<VLAN>
    <Name>Descriptive name of VLAN</Name>
    <Hardware>interfacename</Hardware>
    <Interface>interface name</Interface>
    <Zone>zonename</Zone>
    <VLANID>id</VLANID>
    <IPv4Configuration>Enable/Disable</IPv4Configuration><!-- default on -->
    <IPv4Assignment>Static/PPPoE/DHCP</IPv4Assignment>
    <IPAddress>ipaddress</IPAddress>
    <Netmask>25.0.0.0</Netmask>
    <LocalIP>ip address</LocalIP>
    <!-- for WAN zone -->
    <GatewayName>name</GatewayName>
    <!-- for Static -->
    <GatewayAddress>ip address</GatewayAddress>
    <!-- For PPPoE -->
    <Username>username</Username>
    <Password>password</Password>
    <PreferredIP>ip address</PreferredIP>
    <ServiceName>name</ServiceName>
    <ServiceName2>name</ServiceName2>
    <LCPEchoInterval>Disable/no of seconds</LCPEchoInterval>
    <LCPFailure>Disable/No of Attempts</LCPFailure>
    <SchedulTimeForReconnect>Enable</SchedulTimeForReconnect>
    <Schedule>
        <DayOfWeek>All Days of week/Sunday/Monday/Tuesday/Wednesday/Thursday/Friday/Saturday</DayOfWeek>
        <Hour>Numver</Hour>
        <Minute>Number</Minute>
    </Schedule>
    <!-- IPv6 configuration -->
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
    <IPv6Address>ipv6 address</IPv6Address>
    <IPv6Prefix>Number</IPv6Prefix>
    <IPv6GatewayName>name</IPv6GatewayName>
    <IPv6GatewayAddress>ipaddress</IPv6GatewayAddress>
    <Status>Connected or Disconnected</Status><!-- this tag is only read purpose showing connectivity status of VLAN -->
    <InterfaceStatus>ON/OFF</InterfaceStatus>
    <!-- delegated configuration -->
    <UpstreamInterface>{interfacename}</UpstreamInterface>
    <SubnetAndInterfaceIDs>{SubnetAndInterfaceIDs}</SubnetAndInterfaceIDs>
    <EnableRA>Enable/Disable</EnableRA>
    <EnableDHCPv6Server>Enable/Disable</EnableDHCPv6Server>
</VLAN>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Hardware/Interface|Yes | |Description:|
||||Select the parent interface/port for the virtual sub-interface.|
||||Hardware/Interface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||UTF-8 character(s) are allowed.|
|Zone|Yes | |Description:|
||||Select Zone to assign to the sub-interface.|
||||Zone confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|VLANID|Yes | |Description:|
||||Specify VLAN ID.|
||||VLANID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 4094 is allowed.|
||||Maximum digits allowed are 4.|
|IPv4Assignment|Yes |Static |Description:|
||||Select IP Assignment type from the available options: Static, PPPoE or DHCP.|
||||IPv4Assignment confines to:|
||||Type is 'SCALAR'.|
||||Only 'Static', 'PPPoe', 'DHCP' are allowed.|
|IPAddress|No | |Description:|
||||Used to set IPv4 address for interface in IPv4 configuration.|
||||IPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'NETWORKBROADCAST', 'NETWORKIP' is allowed.|
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
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|GatewayAddress|No | |Description:|
||||In IPv4 configuration, specify the Gateway IP Address.|
||||GatewayAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|Username|Yes | |Description:|
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
||||In IPv4 configuration, if Network Zone is selected as WAN and IP Assignment is selected as PPPoE, specify the Service Name for PPPoE IP assignment.|
||||ServiceName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 20.|
|ServiceName2|No | |Description:|
||||In IPv4 configuration, if Network Zone is selected as WAN and IP Assignment is selected as PPPoE, specify the Service Name for PPPoE IP assignment.|
||||ServiceName2 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 20.|
|Send LCP Echo Request Every|No |20 |Description:|
||||Specify time interval between LCP Echo Requests. These requests are used to check if the link is alive.|
||||Send LCP Echo Request Every confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 5 to 180 is allowed.|
||||Maximum digits allowed are 4.|
|Wait For LCP Echo Reply For|No |3 |Description:|
||||Number of attempts to wait for LCP echo reply after which the PPPoE link will be declared as closed.|
||||Wait For LCP Echo Reply For confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 65535 is allowed.|
||||Maximum digits allowed are 5.|
|Mode|No | |Description:|
||||Specify 'dhcpmode'|
||||Mode confines to:|
||||Type is 'SCALAR'.|
||||Only 'Auto', 'Manual' are allowed.|
|isdhcponly|No | |Description:|
||||Specify 'isdhcponly'|
||||isdhcponly confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|acceptotherconf|No | |Description:|
||||Specify 'acceptotherconf'|
||||acceptotherconf confines to:|
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
|IPv6Prefix|No | |Description:|
||||Used to set Prefix for Physical interface in IPv6 Configuration.|
||||IPv6Prefix confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Maximum digits allowed are 3.|
|IPv6GatewayName|No | |Description:|
||||Used to configure Gateway Name for IPv6 Configuration.|
||||IPv6GatewayName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|IPv6GatewayAddress|No | |Description:|
||||Used to set IPv6 address for Gateway in IPv6 Configuration.|
||||IPv6GatewayAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 45.|
|InterfaceStatus|No |ON |Description:|
||||To turn interfaces on or off.|
||||InterfaceStatus confines to:|
||||Type is 'SCALAR'.|
||||Only 'OFF', 'ON' are allowed.|
|SchedulTimeForReconnect|No |Disable |Description:|
||||Enable Schedule for Reconnect.|
||||SchedulTimeForReconnect confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Day For Auto Start|No | |Description:|
||||Specify Day for Auto Start.|
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
|dad|No | |Description:|
||||Specify 'dad'|
||||dad confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 8 is allowed.|
|raserveraddress|No | |Description:|
||||Specify 'raserveraddress'|
||||raserveraddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
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
|PreferredIP|No | |Description:|
||||Specify Static IP Address provided by ISP for a PPPoE Connection.|
||||PreferredIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|Name|No | |Description:|
||||Specify a descriptive name for the VLAN.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 58.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add VLAN|200|Added VLAN interface "\<DynamicValue>"|
|Add VLAN|500|Couldn't add VLAN interface "\<DynamicValue>"|
|Add VLAN|502|VLAN interface could not be added. IP address or VLAN ID already exists|
|Add VLAN|503|Gateway with the same name exists. Enter a different name.|
|Add VLAN|508|This IP address is assigned to either peer administration port or peer dedicated port of HA cluster|
|Add VLAN|510|Couldn't add VLAN interface "\<DynamicValue>". Select the zone.|
|Add VLAN|550|Can't change the IP assignment type to DHCP, Delegated, or PPPoE. The firewall is in active-active HA mode.|
|Add VLAN|551|Can't configure another WAN interface because the firewall has reached the maximum number of gateways. To configure the interface, you must delete an IPv4 or IPv6 gateway.|
|Add VLAN|561|VLAN interface could not be added|
|Add VLAN|571|Invalid subnet ID. Enter the correct length based on the delegated prefix.|
|Add VLAN|572|Your ISP has delegated an unsupported prefix length to your upstream interface. Go to the interface and enter one of these preferred prefix lengths: 48, 52, 56, or 60.|
|Edit VLAN|200|Updated VLAN interface "\<DynamicValue>"|
|Edit VLAN|500|Couldn't update VLAN interface "\<DynamicValue>"|
|Edit VLAN|502|VLAN interface could not be added. IP address or VLAN ID already exists|
|Edit VLAN|503|Gateway with the same name exists. Enter a different name.|
|Edit VLAN|505|VLAN could not be updated. Gateway based firewall rule exists|
|Edit VLAN|507|Interface-based virtual host with the same IP address already exists, choose a different IP address|
|Edit VLAN|508|This IP address is assigned to either peer administration port or peer dedicated port of HA cluster|
|Edit VLAN|511|Update VLAN failed while unbinding VLAN|
|Edit VLAN|512|Update VLAN failed while deleting DHCP server|
|Edit VLAN|513|Update VLAN failed while deleting DHCP relay|
|Edit VLAN|514|Update VLAN failed while deleting PPPoE information|
|Edit VLAN|515|Update VLAN failed while deleting gateway information|
|Edit VLAN|516|Failed to unbind VLAN|
|Edit VLAN|520|Failed to unbind VLAN (all configuration parts updated)|
|Edit VLAN|550|Can't change the IP assignment type to DHCP, Delegated, or PPPoE. The firewall is in active-active HA mode.|
|Edit VLAN|551|Can't configure another WAN interface because the firewall has reached the maximum number of gateways. To configure the interface, you must delete an IPv4 or IPv6 gateway.|
|Edit VLAN|563|Can't update this interface. It's configured as the dedicated HA link.|
|Edit VLAN|567|Can't update this interface. It has dependent downstream interfaces.|
|Edit VLAN|568|Can't turn on router advertisement (RA). An RA server exists for this interface.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
