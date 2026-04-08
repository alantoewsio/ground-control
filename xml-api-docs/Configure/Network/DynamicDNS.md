# DynamicDNS

- Operation: Add Dynamic DNS / Edit Dynamic DNS
- Description: To Add/Update Dynamic DNS(DDNS). DDNS links static domain/host name to a dynamically assigned IP Address.

## Sample Configuration

``` xml
<DynamicDNS>
    <HostName>google.com</HostName>
    <Interface>PortB</Interface>
    <IPv4Address>UsePortIP/NATedPublicIP</IPv4Address>
    <ServiceProvider>DynDNS/ZoneEdit/EasyDNS/DynAccess</ServiceProvider>
    <LoginName>name</LoginName>
    <Password>password</Password>
</DynamicDNS>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|HostName|Yes | |Description:|
||||Specify the host name which is registered with DDNS Service provider.|
||||HostName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'DOMAIN'.|
||||To separate words, use a dot (.).|
||||Maximum characters allowed are 253.|
|Interface|Yes | |Description:|
||||Select the interface whose IP Address will be bound to the specified host name.|
||||Interface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|IPv4Address|Yes | |Description:|
||||Select IPv4 Source Address from the available options: Use Port IP or NATed Public IP.|
||||IPv4Address confines to:|
||||Type is 'SCALAR'.|
||||Only 'NATedPublicIP', 'UsePortIP' are allowed.|
|ServiceProvider|Yes | |Description:|
||||Select the Service Provider with which the host name is registered.|
||||ServiceProvider confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|LoginName|Yes | |Description:|
||||Specify your DDNS account's Login name.|
||||LoginName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|Password|Yes | |Description:|
||||Specify your DDNS account's Password.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 120.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Dynamic DNS|200|DDNS account "\<DynamicValue>" has been created successfully|
|Add Dynamic DNS|500|DDNS "\<DynamicValue>" account could not be created|
|Add Dynamic DNS|502|DDNS account could not be created. DDNS account with the same name as "\<DynamicValue>" already exists, choose a different name|
|Edit Dynamic DNS|200|DDNS account "\<DynamicValue>" has been updated successfully|
|Edit Dynamic DNS|500|DDNS "\<DynamicValue>" account could not be updated|
|Edit Dynamic DNS|502|DDNS account could not be created. DDNS account with the same name as "\<DynamicValue>" already exists, choose a different name|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
