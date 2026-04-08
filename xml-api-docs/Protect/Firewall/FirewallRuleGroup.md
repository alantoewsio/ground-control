# FirewallRuleGroup

- Operation: Add firewall rule group / Edit firewall rule group
- Description: Create or edit firewall rule group.

## Sample Configuration

``` xml
<FirewallRuleGroup>
    <Name>Group Name</Name>
    <Description>Group Description</Description>
    <SecurityPolicyList>
        <SecurityPolicy>SecurityPolicy1</SecurityPolicy>
        <SecurityPolicy>SecurityPolicy2</SecurityPolicy>
        :
        :
    </SecurityPolicyList>
    <SourceZones>
        <Zone>LAN</Zone>
        <Zone>CustomZone1</Zone>
        :
        :
    </SourceZones>
    <DestinationZones>
        <Zone>LAN</Zone>
        <Zone>DMZ</Zone>
        :
        :
    </DestinationZones>
    <Policytype>User/network rule,Network rule,User rule,WAF rule,Any</Policytype>
</FirewallRuleGroup>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Specify a name to identify the Firewall Group.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 150.|
||||UTF-8 character(s) are allowed.|
|Description|No||Description:|
||||Specify a descripion for the Firewall Group.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|SecurityPolicy|No||Description:|
||||Specify a Firewall Rule to Add/Remove into the Firewall Group.|
||||SecurityPolicy confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
||||Multiple values up to 200 are allowed.|
|Policytype|No||Description:|
||||Select the type of policy.|
||||Policytype confines to:|
||||Type is 'SCALAR'.|
||||Only 'User/network rule', 'Network rule', 'User rule', 'WAF rule', 'Any' are allowed.|
|Zone|No||Description:|
||||Select the source zone(s) allowed to the Firewall Group.|
||||Zone confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Zone|No||Description:|
||||Select the destination zone(s) for the Firewall Group.|
||||Zone confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add firewall rule group|200|Created firewall rule group and added the rules to the group|
|Add firewall rule group|500|Firewall group creation failed|
|Add firewall rule group|502|Duplicate group. Group with the same name already exists|
|Edit firewall rule group|200|Created firewall rule group and added the rules to the group|
|Edit firewall rule group|500|Firewall group creation failed|
|Edit firewall rule group|502|Duplicate group. Group with the same name already exists|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
