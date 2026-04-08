# SDWANPolicyRoute

- Operation: Add SD-WAN route / Update SD-WAN route
- Description: Add an SD-WAN policy route. Update an SD-WAN policy route.

## Sample Configuration

``` xml
<SDWANPolicyRoute>
    <Name>Default</Name>
    <Description />
    <IPFamily>{0/1}</IPFamily><!-- default IPv4 -->
    <SourceNetworks>
        <Network>Source Network</Network>
        <Network>Source Network</Network>
        :
    </SourceNetworks>
    <Services>
        <Service>servicename</Service>
        :
    </Services>
    <DestinationNetworks>
        <Network>Destinaiton Network</Network>
        <Network>Destinaiton Network</Network>
        :
    </DestinationNetworks>
    <ApplicationObjects>
        <ApplicationObject>obj1</ApplicationObject>
        <ApplicationObject>obj2</ApplicationObject>
    </ApplicationObjects>
    <Users>
        <User>{user/groups}</User>
        <User>{user/groups}</User>
        :
    </Users>
    <LinkSelection>{SelectGateways/SelectSDWANProfile}</LinkSelection>
    <SDWANProfileName>{SDWANProfileName}</SDWANProfileName>
    <Gateway>{Gateway}/WANLinkLoadBalance</Gateway><!-- Traffic will be load balanced across the active gateway when WANLinkLoadBalance is used -->
    <BackupGateway>{Gateway}/WANLinkLoadBalance</BackupGateway><!-- Do not use this tag if you don't want to set backup gateway -->
    <Healthcheck>{0/1}</Healthcheck>
    <Interface>{interface}</Interface>
    <DSCPMarking>0-Best Effort/1/2/3/4/5/6/7/8-Class 1(CS1)/9/10-Class 1,Gold(AF11)/11/12-Class1,Silver(AF12)/13/14-Class 1,Bronze(AF13)/15/16-Class 2(CS2)/17/18-Class 2,Gold(AF21)/19/20-Class 2,Silver(AF22)/21/22-Class 2,Bronze(AF23)/23/24-Class 3(CS3)/25/26-Class 3,Gold(AF31)/27/28-Class 3,Silver(AF32)/29/30-Class 3,Bronze(AF33)/31/32-Class 4(CS4)/33/34-Class 4,Gold(AF41)/35/36-Class 4,Silver(AF42)/37/38-Class 4,Bronze(AF43)/39/40-Class 5(CS5)/41/42/43/44/45/46-Expedited Forwarding(EF)/47/48-Control(CS6)/49/50/51/52/53/54/55/56-Control(CS7)/57/58/59/60/61/62/63</DSCPMarking>
</SDWANPolicyRoute>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Name of the SD-WAN route.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|Description|No | |Description:|
||||Description for the route.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|IPFamily|Yes |IPv4 |Description:|
||||Enter IPv4 or IPv6.|
||||IPFamily confines to:|
||||Type is 'SCALAR'.|
||||Only 'IPv4', 'IPv6' are allowed.|
|Network|No | |Description:|
||||Source networks of the traffic.|
||||Network confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|
|Network|No | |Description:|
||||Destination networks of the traffic.|
||||Network confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|
|Service|No | |Description:|
||||Port and protocol over which to route the traffic.|
||||Service confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|
|User|No | |Description:|
||||Users and groups whose traffic you want to apply the route to|
||||User confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 256.|
||||Multiple values are allowed.|
|BackupGateway|No | |Description:|
||||Backup gateway to use (if you want to) when the primary gateway fails.|
||||BackupGateway confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|LinkSelection|No | |Description:|
||||Method of link selection.|
||||LinkSelection confines to:|
||||Type is 'SCALAR'.|
||||Only 'SelectGateways', 'SelectSDWANProfile' are allowed.|
|Interface|No | |Description:|
||||Incoming interface that receives the packets.|
||||Interface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DSCPMarking|No | |Description:|
||||DSCP value of packets to match with the SD-WAN route.|
||||DSCPMarking confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Range 1 to 64 is allowed.|
|Healthcheck|No | |Description:|
||||Turn this SD-WAN route on or off when all the specified gateways are down.|
||||Healthcheck confines to:|
||||Type is 'SCALAR'.|
||||Only 'OFF', 'ON' are allowed.|
|SDWANProfileName|Yes | |Description:|
||||SD-WAN profile to assign to the route. Profiles have gateways assigned to them.|
||||SDWANProfileName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ApplicationObject|No | |Description:|
||||Enter the application objects.|
||||ApplicationObject confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 80.|
||||Multiple values are allowed.|
|Gateway|No | |Description:|
||||Primary gateway for routing the traffic.|
||||Gateway confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add SD-WAN route|200|Added the SD-WAN route "\<DynamicValue>"|
|Add SD-WAN route|500|Couldn't add SD-WAN route "\<DynamicValue>"|
|Add SD-WAN route|502|Couldn't create the route. SD-WAN route with the name "\<DynamicValue>" exists|
|Update SD-WAN route|200|Updated SD-WAN route "\<DynamicValue>"|
|Update SD-WAN route|500|Couldn't update SD-WAN route "\<DynamicValue>"|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
