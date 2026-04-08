# DNSRequestRoute

- Operation: Add DNS Request Route / Edit DNS Request Route
- Description: To configure DNS request routes to internal DNS Servers.

## Sample Configuration

``` xml
<DNSRequestRoute>
    <DomainName>{Host/Domain Name}</DomainName>
    <TargetServers><!-- only 8 addresses are supported -->
        <Host>{Host}</Host>
        <Host>{Host}</Host>
        :
        :
    </TargetServers>
</DNSRequestRoute>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|DomainName|Yes | |Description:|
||||Specify the domain for which you want to use internal DNS Server.|
||||DomainName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'FQDN'.|
||||Maximum characters allowed are 255.|
|Host|Yes | |Description:|
||||Select DNS Server to resolve the domain specified above. You can also add IP Address from this page.|
||||Host confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add DNS Request Route|200|DNS request route "\<DynamicValue>" has been added successfully|
|Add DNS Request Route|500|DNS request route could not be created|
|Add DNS Request Route|502|Specify different domain name as DNS request route with name "\<DynamicValue>" already exists|
|Add DNS Request Route|522|DNS request route could not be added as maximum 1024 DNS request routes are allowed|
|Add DNS Request Route|523|DNS request route could not be created as maximum 8 target servers are allowed|
|Edit DNS Request Route|200|DNS request route "\<DynamicValue>" has been updated successfully.|
|Edit DNS Request Route|500|DNS request route could not be updated|
|Edit DNS Request Route|523|DNS request route could not be updated as maximum 8 target servers are allowed|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
