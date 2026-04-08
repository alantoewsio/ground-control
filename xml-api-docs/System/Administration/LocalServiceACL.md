# LocalServiceACL

- **Operation**: Admin Service Access / Edit Admin Service Access
- **Description**: To Create/Edit Admin service access.

## Sample Configuration

``` xml
<LocalServiceACL>
  <RuleName>name</RuleName>
  <Description>text</Description>
  <IPFamily>IPv4/IPv6</IPFamily>
  <SourceZone />
  <Hosts>
    <Host>hostname or ipaddress</Host>
    :
  </Hosts>
  <Services>
    <Service>HTTPS/SSH/DNS/DynamicRouting/Ping/Ping6/SSLVPN/UserPortal/WebProxy/VPNPortal/ADSSO/CaptivePortal/RadiusSSO/ClientAuthentication/ChromebookSSO/WirelessProtection/SMTPRelay/SNMP/RED/IPsec</Service>
    :
  </Services>
  <Action>accept/drop</Action>
</LocalServiceACL>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|RuleName|Yes | |Description:|
||||Specify name to identify the rule.|
||||RuleName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|Description|No | |Description:|
||||Specify description for the rule.|
|IPFamily|No | |Description:|
||||Select ipfamily for the rule.|
||||IPFamily confines to:|
||||Type is 'SCALAR'.|
||||Only 'IPv4', 'IPv6' are allowed.|
|SourceZone|No | |Description:|
||||Specify source zone to which the rule applies.|
||||SourceZone confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Source Hosts|No | |Description:|
||||Select source host or source network address to which the rule applies.|
||||Source Hosts confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Destination Hosts|No | |Description:|
||||Select destination host to which the rule applies.|
||||Destination Hosts confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Services|Yes | |Description:|
||||Select admin services to which the rule applies.|
||||Services confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'INTEGER'.|
||||Multiple values are allowed.|
||||Duplicate values will be ignored.|
|Action|No | |Description:|
||||Specify action to which the rule applies.|
||||Action confines to:|
||||Type is 'SCALAR'.|
||||Only 'accept', 'drop' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Admin Service Access|200||
|Admin Service Access|500||
|Admin Service Access|502||
|Admin Service Access|541|You can't turn on web admin console access from all WAN sources. For secure access, we recommend that you add a local service ACL exception rule that only allows access from specific IP addresses and networks or use Sophos Central.|
|Edit Admin Service Access|200||
|Edit Admin Service Access|500||
|Edit Admin Service Access|541|You can't turn on web admin console access from all WAN sources. For secure access, we recommend that you add a local service ACL exception rule that only allows access from specific IP addresses and networks or use Sophos Central.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
