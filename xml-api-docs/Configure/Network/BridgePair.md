# BridgePair

- Operation: Add Bridge-Pair / Edit Bridge-Pair
- Description: To Add/Update Bridge Pair configuration.

## Sample Configuration

``` xml
<BridgePair>
    <Name>bridgepairname</Name>
    <Hardware>Hardwarename</Hardware>
    <Description>Text</Description>
    <RoutingOnBridgePair>Enable/Disable</RoutingOnBridgePair>
    <BridgeMembers>
        <Member>
            <Interface>interfacename</Interface>
            <Zone>zonename</Zone>
        </Member>
        <Member>
            <Interface>interfacename</Interface>
            <Zone>zonename</Zone>
        </Member>
        :
    </BridgeMembers>
    <VLANFilteringOnBridge>Enable/Disable</VLANFilteringOnBridge>
    <PermittedVlansList>
        <PermittedVLAN>permittedvlans</PermittedVLAN>
        :
    </PermittedVlansList>
    <!-- IPv4 configuration -->
    <IPv4Configuration>Enable/Disable</IPv4Configuration>
    <IPv4Assignment>Static/DHCP</IPv4Assignment>
    <IPAddress>ip address</IPAddress>
    <Netmask>netmask</Netmask>
    <Gateway>
        <GatewayName>Text</GatewayName>
        <GatewayIPAddress>ip address</GatewayIPAddress>
    </Gateway>

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
    <Prefix>Number</Prefix>
    <IPv6Gateway>
        <IPv6GatewayName>Text</IPv6GatewayName>
        <IPv6GatewayIPAddress>ipv6 address</IPv6GatewayIPAddress>
    </IPv6Gateway>
    <ARPBroadcast>Enable/Disable</ARPBroadcast>
    <MTU>Number</MTU>
    <MSS>
        <Override>Enable/Disable</Override>
        <MSSValue>Number</MSSValue>
    </MSS>
    <STP>Enable/Disable</STP>
    <MAXAge>{Number}</MAXAge>
    <MACAging>{Number}</MACAging>
    <FilterEthernetFrames>Enable/Disable</FilterEthernetFrames>
    <EtherTypeList>
        <EtherType>EtherType</EtherType>
        <EtherType>EtherType</EtherType>
        :
    </EtherTypeList>
    <!-- delegated configuration -->
    <UpstreamInterface>{interfacename}</UpstreamInterface>
    <SubnetAndInterfaceIDs>{SubnetAndInterfaceIDs}</SubnetAndInterfaceIDs>
    <EnableRA>Enable/Disable</EnableRA>
    <EnableDHCPv6Server>Enable/Disable</EnableDHCPv6Server>
    <!-- RA Configuration for dhcp -->
    <DADAttempts>1</DADAttempts>
    <AllowedRAServers />
    <InterfaceStatus>ON/OFF</InterfaceStatus>
</BridgePair>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|No| |Description:|
||||Specify a descriptive name for the bridge pair.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 58.|
|Hardware|Yes| |Description:|
||||Specify a name for the bridge pair.|
||||Hardware confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed first characters: (A-Za-z). For other characters: (A-Za-z0-9_)|
||||Maximum characters allowed are 10.|
|Description|No| |Description:|
||||Specify description for the bridge-pair.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 100.|
|RoutingOnBridgePair|No| |Description:|
||||Used to enable routing on bridge-pair.|
||||RoutingOnBridgePair confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Interface|Yes| |Description:|
||||Used to select member interfaces in bridge-pair.|
||||Interface confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 15.|
||||Multiple values are allowed.|
|Zone|Yes| |Description:|
||||Used to select Zones to which the interfaces belong in the bridge-pair.|
||||Zone confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|VLANFilteringOnBridge|No| |Description:|
||||Turn on VLAN filtering on the bridge pair.|
||||VLANFilteringOnBridge confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Permittedvlans|No| |Description:|
||||Select the VLAN ID or ID range that you want to allow on the bridge.|
||||Permittedvlans confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 10.|
||||Multiple values are allowed.|
||||Duplicate values will be ignored.|
|IPv4Configuration, IPv6Configuration|No| |Description:|
||||Used to determine whether the IP type is IPv4 or IPv6.|
||||IPv4Configuration,IPv6Configuration confines to:|
||||Type is 'ARRAY'.|
||||Maximum characters allowed are 2.|
||||Only '0', '1' are allowed.|
||||Multiple values are allowed.|
|IPAssignType|No| |Description:|
||||Select the type of IPv4 assignment: Static or DHCP|
||||IPAssignType confines to:|
||||Type is 'SCALAR'.|
||||Only 'Static', 'DHCP' are allowed.|
|IPAddress|No| |Description:|
||||Specify IPv4 Address for IPv4 Configuration.|
||||IPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'NETWORKBROADCAST', 'NETWORKIP' is allowed.|
|Netmask|No| |Description:|
||||Specify Network Subnet mask for IPv4 Configuration.|
||||Netmask confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|GatewayName|No| |Description:|
||||Specify Gateway name for IPv4 Configuration.|
||||GatewayName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|GatewayIPAddress|No| |Description:|
||||Specify Gateway IP Address for IPv4 Configuration.|
||||GatewayIPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'NETWORKBROADCAST', 'NETWORKIP' is allowed.|
|Mode|No| |Description:|
||||Specify the DHCP mode: Auto or Manual.|
||||Mode confines to:|
||||Type is 'SCALAR'.|
||||Only 'Auto', 'Manual' are allowed.|
|DhcpOnly|No| |Description:|
||||Set manual mode to "DHCP only"|
||||DhcpOnly confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|AcceptOtherConfigfromDHCP|No| |Description:|
||||Set manual mode to "Accept other configuration from DHCP" to configure other parameters, using the DHCPv6 server.|
||||AcceptOtherConfigfromDHCP confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|PrefixDelegation|No|1|Description:|
||||Turns IPv6 prefix delegation on or off.|
||||PrefixDelegation confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|PrefixPreference|No|1|Description:|
||||Allows you to request a preferred IPv6 prefix.|
||||PrefixPreference confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|PreferredPrefixAddress|No|1|Description:|
||||Requests the ISP for the prefix address you prefer.|
||||PreferredPrefixAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 45.|
|PreferredPrefixLength|No|1|Description:|
||||Requests the ISP for the prefix length you prefer.|
||||PreferredPrefixLength confines to:|
||||Type is 'SCALAR'.|
||||Only '48', '52', '56', '60' are allowed.|
|DHCPRapidCommit|No| |Description:|
||||Select "DHCP rapid commit" for faster client configuration.|
||||DHCPRapidCommit confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|
|IPv6Address|No| |Description:|
||||Specify IPv6 Address for IPv6 Configuration.|
||||IPv6Address confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS6'.|
||||Maximum characters allowed are 45.|
||||IP Class other than 'MULTICAST', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL', 'NETWORKBROADCAST', 'NETWORKIP' is allowed.|
|Prefix|No| |Description:|
||||Specify Network Subnet mask Prefix for IPv6 Configuration.|
||||Prefix confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 128 is allowed.|
||||Maximum digits allowed are 40.|
|IPv6GatewayName|No| |Description:|
||||Specify Gateway Name for IPv6 Configuration.|
||||IPv6GatewayName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|IPv6GatewayIPAddress|No| |Description:|
||||Specify Gateway IP Address for IPv6 Configuration.|
||||IPv6GatewayIPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS6'.|
||||Maximum characters allowed are 45.|
||||IP Class other than 'MULTICAST', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'NETWORKBROADCAST', 'NETWORKIP' is allowed.|
|UpstreamInterface|No|1|Description:|
||||The firewall uses the delegated IPv6 prefix received by the upstream interface to configure the current interface's address.|
||||UpstreamInterface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SubnetAndInterfaceIDs|No|1|Description:|
||||Subnet and interface IDs of the interface.|
||||SubnetAndInterfaceIDs confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||SUBNETANDIFACEIDS|
||||Maximum characters allowed are 26.|
|EnableRA|No|1|Description:|
||||Configures a router advertisement entry to advertise the IPv6 prefix.|
||||EnableRA confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|EnableDHCPv6Server|No|1|Description:|
||||Configures a DHCPv6 server to provide other DHCP parameters, such as DNS. Doesn't provide IPv6 addresses.|
||||EnableDHCPv6Server confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|dad|No| |Description:|
||||Specify the number of attempts for duplicate address detection.|
||||dad confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 8 is allowed.|
|AllowedRAServers|No| |Description:|
||||Specify the allowed RA servers.|
||||AllowedRAServers confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ARPBroadcast|No| |Description:|
||||Turn on to allow the bridge to forward ARP broadcasts to the destination MAC address FF:FF:FF:FF:FF:FF.|
||||ARPBroadcast confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Disable', 'Enable' are allowed.|
|MTU|Yes|1500|Description:|
||||Used to set Maximum Transmission Unit value which is the largest physical packet size.|
||||MTU confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 576 to 9000 is allowed.|
|Override|No| |Description:|
||||Used to override existing MSS with new MSS.|
||||Override confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|
|MSSValue|Yes|1460|Description:|
||||Used to set Maximum Segment Size which is the amount of data that can be transmitted in a single packet.|
||||MSSValue confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 536 to 8960 is allowed.|
|STP|No| |Description:|
||||Turn on STP on this bridge pair.|
||||STP confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|MAXAge|No| |Description:|
||||Set max age value for STP.|
||||MAXAge confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 6 to 40 is allowed.|
|MACAging|No| |Description:|
||||Set the Ethernet (MAC) address aging time in seconds.|
||||MACAging confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 65535 is allowed.|
|FilterEthernetFrames|No| |Description:|
||||Turn on Ethernet frame filtering on the bridge.|
||||FilterEthernetFrames confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|EtherType|No| |Description:|
||||Select the EtherType that you want to allow on the bridge.|
||||EtherType confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 4.|
||||Multiple values are allowed.|
||||Duplicate values will be ignored.|
|InterfaceStatus|No|ON|Description:|
||||To turn interfaces on or off.|
||||InterfaceStatus confines to:|
||||Type is 'SCALAR'.|
||||Only 'OFF', 'ON' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Bridge-Pair|200|Bridge pair has been added successfully|
|Add Bridge-Pair|500|Bridge pair could not be added|
|Add Bridge-Pair|502|Hardware name "\<DynamicValue>" exists as a specified or system-reserved name. Specify a different name.|
|Add Bridge-Pair|503|Gateway with the same name exists. Enter a different name.|
|Add Bridge-Pair|504|IP address is assigned to some other interface|
|Add Bridge-Pair|508|This IP address is assigned to either peer administration port or peer dedicated port of HA cluster|
|Add Bridge-Pair|510|Bridge pair with the same member interface already exists. Specify a different member interface.|
|Add Bridge-Pair|515|Can't configure another WAN interface because the firewall has reached the maximum number of gateways. To configure the interface, you must delete an IPv4 or IPv6 gateway.|
|Add Bridge-Pair|541|Bridge-pair could not be configured. One of the selected interfaces is either configured as HA dedicated link or peer administration port|
|Add Bridge-Pair|542|Bridge-pair could not be configured. One or both of the bridge interfaces are configured as monitoring port in HA|
|Add Bridge-Pair|543|Bridge pair could not be added|
|Add Bridge-Pair|544|WAN zone can have only one member interface.|
|Add Bridge-Pair|549|VLAN and the parent interface can't be part of the same bridge|
|Add Bridge-Pair|551|Reached the maximum limit of allowed members.|
|Add Bridge-Pair|567|Can't update this interface. It has dependent downstream interfaces.|
|Add Bridge-Pair|568|Can't turn on router advertisement (RA). An RA server exists for this interface.|
|Add Bridge-Pair|571|Invalid subnet ID. Enter the correct length based on the delegated prefix.|
|Add Bridge-Pair|572|Your ISP has delegated an unsupported prefix length to your upstream interface. Go to the interface and enter one of these preferred prefix lengths: 48, 52, 56, or 60.|
|Edit Bridge-Pair|200|Bridge pair has been updated successfully|
|Edit Bridge-Pair|500|Couldn't update the bridge pair.|
|Edit Bridge-Pair|503|Gateway with the same name exists. Enter a different name.|
|Edit Bridge-Pair|504|IP address is assigned to some other interface|
|Edit Bridge-Pair|508|This IP address is assigned to either peer administration port or peer dedicated port of HA cluster|
|Edit Bridge-Pair|510|Bridge pair with the same member interface already exists. Specify a different member interface.|
|Edit Bridge-Pair|515|Can't configure another WAN interface because the firewall has reached the maximum number of gateways. To configure the interface, you must delete an IPv4 or IPv6 gateway.|
|Edit Bridge-Pair|541|Bridge-pair could not be updated. One of the selected interfaces is either configured as HA dedicated link or peer administration port|
|Edit Bridge-Pair|542|Bridge-pair could not be updated. One or both of the bridge interfaces are configured as monitoring port in HA|
|Edit Bridge-Pair|543|Bridge pair could not be added|
|Edit Bridge-Pair|544|WAN zone can have only one member interface.|
|Edit Bridge-Pair|545|Couldn't update the interface. Gateway-based firewall rule exists.|
|Edit Bridge-Pair|546|Virtual host with the same IP address already exists, choose a different IP address for interface-based virtual host|
|Edit Bridge-Pair|549|VLAN and the parent interface can't be part of the same bridge|
|Edit Bridge-Pair|550|Couldnâ€™t remove bridge member. Contains a VLAN thatâ€™s part of another bridge.|
|Edit Bridge-Pair|551|Reached the maximum limit of allowed members.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
