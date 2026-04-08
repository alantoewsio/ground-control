# SSLTLSInspectionRule

- Operation: Add SSL TLS inspection rule / Update SSL TLS inspection rule
- Description: Add an SSL TLS inspection rule. Update an SSL TLS inspection rule.

## Sample Configuration

``` xml
<SSLTLSInspectionRule>
    <Name>Name</Name>
    <NewName>Edited Name</NewName>
    <IsDefault>yes/no</IsDefault>
    <Description>Description</Description>
    <Enable>Yes/No</Enable>

    <!-- Position is optional in ADD operations. If it is not supplied the default Bottom is applied
         It is not required in UPDATE or APIImport -->
    <Position>Top/Bottom</Position>

    <LogConnections>Enable/Disable</LogConnections>
    <DecryptAction>Do not decrypt/Decrypt/Deny</DecryptAction>
    <DecryptionProfile>Decryption Profile</DecryptionProfile>
    <SourceZones>
        <Zone>Zone</Zone>
            :
    </SourceZones>
    <SourceNetworks>
        <Network>Source Network</Network>
            :
    </SourceNetworks>
    <DestinationZones>
        <Zone>Zone</Zone>
            :
    </DestinationZones>
    <DestinationNetworks>
        <Network>Destination Network</Network>
            :
    </DestinationNetworks>
    <Identity>
        <Members>Users/Groups</Members>
            :
    </Identity>
    <Services>
        <Service>Service</Service>
            :
    </Services>
    <Websites>
        <Activity>
            <Name>Name</Name>
            <Type>Web Category/URL Group</Type>
        </Activity>
            :
    </Websites>

    <!-- MoveTo is optional, for ADD it is applied after Position -->
    <MoveTo>
        <Name>Name of reference position</Name>
        <OrderBy>Before/After</OrderBy>
    </MoveTo>

</SSLTLSInspectionRule>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Specify rule name.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|NewName|No||Description:|
||||Specify new rule name for update operations.|
||||NewName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|IsDefault|No|no|Description:|
||||Read-only field specifying if it's a default SSL/TLS inspection rule.|
||||IsDefault confines to:|
||||Type is 'SCALAR'.|
||||Only 'yes', 'no' are allowed.|
|Description|No||Description:|
||||Specify rule description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|Enable|No||Description:|
||||Specify whether rule is enabled.|
||||Enable confines to:|
||||Type is 'SCALAR'.|
||||Only 'Yes', 'No', 't', 'f' are allowed.|
|Position|No||Description:|
||||Specify 'Top' to have this rule placed at the top of the list, and 'Bottom' to have it appear at the bottom.|
||||Position confines to:|
||||Type is 'SCALAR'.|
||||Only 'Top', 'Bottom' are allowed.|
|LogConnections|No||Description:|
||||Specify 'Enable' to log connections to the SSL log.|
||||LogConnections confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable', 't', 'f' are allowed.|
|DecryptAction|No||Description:|
||||Specify the action to use for traffic matching the rule.|
||||DecryptAction confines to:|
||||Type is 'SCALAR'.|
||||Only 'Decrypt', 'Do not decrypt', 'Deny' are allowed.|
|DecryptionProfile|No||Description:|
||||Specify the name of the associated decryption profile.|
||||DecryptionProfile confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Zone|No||Description:|
||||Specify the source zone(s) to which rule is to be applied.|
||||Zone confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Network|No||Description:|
||||Specify the source network(s) to which rule is to be applied.|
||||Network confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Zone|No||Description:|
||||Specify the destination zone(s) to which rule is to be applied.|
||||Zone confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Network|No||Description:|
||||Specify the destination network(s) to which rule is to be applied.|
||||Network confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Members|No||Description:|
||||Specify the source users/groups to which rule is to be applied.|
||||Members confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Service|No||Description:|
||||Specify the service(s) to which rule is to be applied.|
||||Service confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Websites|No||Description:|
||||Specify the category/websites to which rule is to be applied.|
||||Websites confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'OBJECT'.|
||||webfilter::websites|
||||Multiple values are allowed.|
|Name|No||Description:|
||||Reference position for rule move|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|OrderBy|No||Description:|
||||Specifies whether to move above or below.|
||||OrderBy confines to:|
||||Type is 'SCALAR'.|
||||Only 'Before', 'After' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add SSL TLS inspection rule|200|Created SSL/TLS inspection rule "\<DynamicValue>"|
|Add SSL TLS inspection rule|500|Couldn't create SSL/TLS inspection rule "\<DynamicValue>"|
|Add SSL TLS inspection rule|502|Couldn't create SSL/TLS inspection rule "\<DynamicValue>". An SSL/TLS inspection rule with the name exists. Specify a different name|
|Add SSL TLS inspection rule|522|Reached maximum number of SSL/TLS inspection rules|
|Update SSL TLS inspection rule|200|Updated SSL/TLS inspection rule "\<DynamicValue>"|
|Update SSL TLS inspection rule|500|Couldn't update SSL/TLS inspection rule "\<DynamicValue>"|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
