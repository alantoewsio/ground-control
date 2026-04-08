# RouterAdvertisement

- Operation: Add Router Advertisement / Update Router Advertisement
- Description: To Add/Update Router Advertisement.

## Sample Configuration

``` xml
<RouterAdvertisement>
    <Interface>interfacename</Interface>
    <Description>Text</Description>
    <MinAdvertisementInterval>Number</MinAdvertisementInterval>
    <MaxAdvertisementInterval>Number</MaxAdvertisementInterval>
    <ManageIPAddressfromDHCPv6>Enable/Disable</ManageIPAddressfromDHCPv6>
    <ManageOtherParametersfromDHCPv6>Enable/Disable</ManageOtherParametersfromDHCPv6>
    <DefaultGateway>Enable/Disable</DefaultGateway>
    <DefaultGatewayLifeTime>Number</DefaultGatewayLifeTime>
    <PrefixAdvertisementConfiguration>
        <PrefixAdvertisementConfigurationDetail>
            <Prefix64>ipv6 prefix</Prefix64>
            <On-link>Enable/Disable</On-link>
            <Autonomous>Enable/Disable</Autonomous>
            <PreferredLifeTime>Number</PreferredLifeTime>
            <ValidLifeTime>Number</ValidLifeTime>
        </PrefixAdvertisementConfigurationDetail>
        :
    </PrefixAdvertisementConfiguration>
    <LinkMTU>Number</LinkMTU>
    <ReachableTime>Number</ReachableTime>
    <RetransmitTime>Number</RetransmitTime>
    <HopLimit>Number</HopLimit>
</RouterAdvertisement>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Interface|Yes | |Description:|
||||Select interface for Router Advertisement.|
||||Interface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Description|No | |Description:|
||||Specify description for the interface to be selected for router advertisement.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|MinAdvertisementInterval|Yes |198 |Description:|
||||Specify minimum time interval in seconds between two consecutive Router Advertisements sent to the clients.|
||||MinAdvertisementInterval confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 3 to $MinRtrAdvIntervalEndRange is allowed.|
|MaxAdvertisementInterval|Yes |600 |Description:|
||||Specify maximum time interval in seconds between two consecutive Router Advertisements sent to the clients.|
||||MaxAdvertisementInterval confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 4 to 1800 is allowed.|
|ManageIPAddressfromDHCPv6|Yes |Disable |Description:|
||||Select to manage auto configuration of IPv6 address from DHCPv6 Server.|
||||ManageIPAddressfromDHCPv6 confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|ManageOtherParametersfromDHCPv6|Yes | |Description:|
||||Select to manage other parameters like DNS Server, default router etc. from DHCPv6 Server.|
||||ManageOtherParametersfromDHCPv6 confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|DefaultGateway|No | |Description:|
||||Select to manage Default Gateway.|
||||DefaultGateway confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|DefaultGatewayLifeTime|Yes | |Description:|
||||Specify time in seconds for the appliance to be used as a default gateway.|
||||DefaultGatewayLifeTime confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|Prefix64|No | |Description:|
||||Specify 64 bit long prefix which is to identify the network in a IPv6 Address.|
||||Prefix64 confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 21.|
||||Multiple values are allowed.|
|Netmask|No | |Description:|
||||Specify IPv6 prefix.|
|On-link|No |Enable |Description:|
||||Enabling 'On-link' will allow all the devices with IPv6 addresses within the Prefix to be reached on the subnet without the need of a router.|
||||On-link confines to:|
||||Type is 'ARRAY'.|
||||Only 'Enable', 'Disable' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Autonomous|No |Enable |Description:|
||||Used to automatically generate the IPv6 address.|
||||Autonomous confines to:|
||||Type is 'ARRAY'.|
||||Maximum characters allowed are 5.|
||||Only 'Enable', 'Disable' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|PreferredLifeTime|No |240 |Description:|
||||Specify time in minutes for a valid IPv6 address to remain in the preferred state.|
||||PreferredLifeTime confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 100.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|ValidLifeTime|No |1440 |Description:|
||||Specify time in minutes for the IPv6 address to remain in the valid state.|
||||ValidLifeTime confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 100.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
||||Note:|
||||The value of Valid Life Time must be greater than or equal to Preferred Life Time.|
|LinkMTU|Yes |0 |Description:|
||||Specify the Maximum Transmission Unit(MTU)in bytes for the packets sent on the interface.|
||||LinkMTU confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1280 to 1500 is allowed.|
|ReachableTime|Yes |0 |Description:|
||||Specify time in Seconds which is used to assume that the neighboring device is reachable after a 'reachability confirmation' message is received.|
||||ReachableTime confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 3600 is allowed.|
|RetransmitTime|Yes |0 |Description:|
||||Specify time in seconds to wait before retransmitting neighbor solicitation messages.|
||||RetransmitTime confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 4294968 is allowed.|
|HopLimit|Yes |64 |Description:|
||||Specify Hop limit value which limits the number of hops the packet can pass through.|
||||HopLimit confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 255 is allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Router Advertisement|200|Router advertisement configuration has been applied successfully|
|Add Router Advertisement|500|Router advertisement configuration failed|
|Update Router Advertisement|200|Router advertisement configuration has been applied successfully|
|Update Router Advertisement|500|Router advertisement configuration failed|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
