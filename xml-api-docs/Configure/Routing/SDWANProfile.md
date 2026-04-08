# SDWANProfile

- Operation: Add SD-WAN profile / Update SD-WAN profile
- Description: In an SD-WAN profile, you configure a list of gateways to route traffic and health check probes for the gateways. Later, you can attach the profile to SD-WAN policy routes.

## Sample Configuration

``` xml
<SDWANProfile>
    <Name>{SDWANProfileName}</Name>
    <Description />
    <IPFamily>{IPv4/IPv6}</IPFamily>
    <RoutingStrategy>{FirstAvailable/Loadbalancing}</RoutingStrategy>
    <LBMethod>{WRR/SrcSticky/DestSticky/SrcDestSticky/ConnectionSticky}</LBMethod>
    <GatewayPreferences>
        <Gateway>
            <gatewayname />
            <orderid />
            <gatewayweights />
        </Gateway>
    </GatewayPreferences>
    <HealthCheckProfileName />
    <EnableSLA>{ON/OFF}</EnableSLA>
    <SLAStrategy>{BestQuality/CustomSLA}</SLAStrategy>
    <IsLatency>{ON/OFF}</IsLatency>
    <IsJitter>{ON/OFF}</IsJitter>
    <IsPacketloss>{ON/OFF}</IsPacketloss>
    <LatencyValue />
    <JitterValue />
    <PacketlossValue />
    <ProbeCount />
</SDWANProfile>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Name of the SD-WAN profile.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|Description|No | |Description:|
||||Description of the SD-WAN profile.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|IPFamily|No | |Description:|
||||Enter IPv4 or IPv6.|
||||IPFamily confines to:|
||||Type is 'SCALAR'.|
||||Maximum characters allowed are 1.|
||||Only 'IPv4' are allowed.|
|gatewayname|Yes | |Description:|
||||Gateways to use in the profile.|
||||gatewayname confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|EnableSLA|Yes | |Description:|
||||Enter ON or OFF.|
||||EnableSLA confines to:|
||||Type is 'SCALAR'.|
||||Only 'OFF', 'ON' are allowed.|
|SLAStrategy|No | |Description:|
||||Enter BestQuality for the best performing link. Enter CustomSLA to specify the values.|
||||SLAStrategy confines to:|
||||Type is 'SCALAR'.|
||||Only 'BestQuality', 'CustomSLA' are allowed.|
|IsLatency|No |ON |Description:|
||||Turn latency match on or off.|
||||IsLatency confines to:|
||||Type is 'SCALAR'.|
||||Only 'OFF', 'ON' are allowed.|
|IsJitter|No | |Description:|
||||Turn jitter match on or off.|
||||IsJitter confines to:|
||||Type is 'SCALAR'.|
||||Only 'OFF', 'ON' are allowed.|
|IsPacketloss|No | |Description:|
||||Turn packet loss match on or off.|
||||IsPacketloss confines to:|
||||Type is 'SCALAR'.|
||||Only 'OFF', 'ON' are allowed.|
|LatencyValue|No | |Description:|
||||Maximum latency a link can have.|
||||LatencyValue confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 60000 is allowed.|
|JitterValue|No | |Description:|
||||Maximum jitter a link can have.|
||||JitterValue confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 60000 is allowed.|
|PacketlossValue|No | |Description:|
||||Maximum packet loss a link can have.|
||||PacketlossValue confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 100 is allowed.|
|ProbeCount|No | |Description:|
||||Number of probes to determine if the link is active.|
||||ProbeCount confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 5 to 100 is allowed.|
|RoutingStrategy|No | |Description:|
||||Method of using the available gateways for routing traffic.|
||||RoutingStrategy confines to:|
||||Type is 'SCALAR'.|
||||Only 'FirstAvailable', 'Loadbalancing' are allowed.|
|LBMethod|No | |Description:|
||||Load balancing method for the gateways.|
||||LBMethod confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 5 is allowed.|
|GatewayWeights|No | |Description:|
||||Weights to assign to the gateways for load balancing.|
||||GatewayWeights confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 100 is allowed.|
|GatewayPreferences|No | |Description:|
||||Specify 'gatewayDetails'|
||||GatewayPreferences confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'OBJECT'.|
||||gatewayDetails|
||||Multiple values are allowed.|
|HealthCheckProfileName|Yes | |Description:|
||||Name of the health check profile.|
||||HealthCheckProfileName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 85.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add SD-WAN profile|200|Updated the SD-WAN profile "\<DynamicValue>"|
|Add SD-WAN profile|500|Couldn't update SD-WAN profile "\<DynamicValue>"|
|Add SD-WAN profile|502|Couldn't create the profile. SD-WAN profile with the name "\<DynamicValue>" exists|
|Update SD-WAN profile|200|Updated the SD-WAN profile "\<DynamicValue>"|
|Update SD-WAN profile|500|Couldn't update SD-WAN profile "\<DynamicValue>"|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
