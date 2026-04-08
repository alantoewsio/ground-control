# DNSHostEntry

- Operation: Add DNS Host Entry / Edit DNS Host Entry
- Description: To Add/Edit DNS Host Entry which allows adding DNS mapping of domain with IPv4/IPv6 Address. Maximum 8 addresses are allowed in one DNS Host Entry.

## Sample Configuration

``` xml
<DNSHostEntry>
    <HostName>hostname</HostName>
    <AddressList><!-- only 8 addresses are supported -->
        <Address>
            <EntryType>Manual/InterfaceIP</EntryType>
            <IPFamily>IPv4/IPv6</IPFamily>
            <IPAddress>ip address</IPAddress><!-- When EntryType is InterfaceIP interface name is required. -->
            <TTL>Number</TTL>
            <Weight>Number</Weight>
            <PublishOnWAN>Enable/Disable</PublishOnWAN>
        </Address>
        :
        :
        :
    </AddressList>
    <AddReverseDNSLookUp>Enable/Disable</AddReverseDNSLookUp>
</DNSHostEntry>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|HostName|Yes | |Description:|
||||Specify a Fully Qualified Domain Name(FQDN) for Host/Domain.|
||||HostName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'DOMAINNAMELOOKUP'.|
||||Maximum characters allowed are 253.|
|IPFamily|Yes | |Description:|
||||Select the type of family.|
||||IPFamily confines to:|
||||Type is 'ARRAY'.|
||||Only 'IPv6', 'IPv4' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|EntryType|Yes | |Description:|
||||Select Entry type from the available options: Manual or Interface IP.|
||||EntryType confines to:|
||||Type is 'ARRAY'.|
||||Only 'InterfaceIP', 'Manual' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|IPAddress|Yes | |Description:|
||||Select the IPv4/IPv6 address to be mapped to the domain.|
||||IPAddress confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|TTL|Yes |3600 |Description:|
||||Specify Time to Live in seconds.|
||||TTL confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 604800 is allowed.|
||||Maximum digits allowed are 6.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Weight|Yes | |Description:|
||||Specify weight for load balancing the traffic.|
||||Weight confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 255 is allowed.|
||||Maximum digits allowed are 3.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|PublishOnWAN|Yes | |Description:|
||||Enable to publish DNS Host Entry on WAN.|
||||PublishOnWAN confines to:|
||||Type is 'ARRAY'.|
||||Only 'Enable', 'Disable' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|AddReverseDNSLookUp|No |Disable |Description:|
||||Enable to allow reverse DNS lookup.|
||||AddReverseDNSLookUp confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add DNS Host Entry|200|DNS host entry "\<DynamicValue>" is added successfully|
|Add DNS Host Entry|500|Failed to add DNS host entry. One or more parameters (host/domain name/TTL/IP address) missing or invalid|
|Add DNS Host Entry|502|Failed to add DNS host entry. DNS host entry with the same host/domain name already exists. Provide a different host/domain name|
|Add DNS Host Entry|503|Failed to add/update DNS host entry. Identical configuration "\<DynamicValue>" already exists|
|Add DNS Host Entry|510|Failed to add DNS host entry. Maximum 1024 DNS Host entries are allowed|
|Add DNS Host Entry|541|Failed to add DNS host entry. Contact support|
|Edit DNS Host Entry|200|DNS host entry "\<DynamicValue>" is updated successfully|
|Edit DNS Host Entry|500|Failed to update DNS host entry. One or more parameters (host/domain name/TTL/IP address) missing or invalid|
|Edit DNS Host Entry|502|Failed to update DNS host entry. Contact support|
|Edit DNS Host Entry|503|Failed to add/update DNS host entry. Identical configuration "\<DynamicValue>" already exists|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
