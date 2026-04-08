# FQDNHost

- Operation: Add FQDN Host / Update FQDN Host
- Description: To Add/Edit FQDN Host.

## Sample Configuration

``` xml
<FQDNHost>
    <Name>name</Name>
    <Description>Text</Description>
    <FQDN>fqdn</FQDN>
    <FQDNHostGroupList>
        <FQDNHostGroup>hostgroupname</FQDNHostGroup>
        <FQDNHostGroup>hostgroupname</FQDNHostGroup>
        <FQDNHostGroup>hostgroupname</FQDNHostGroup>
        :
    </FQDNHostGroupList>
</FQDNHost>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|hostname/Name|Yes | |Description:|
||||Specify a name to identify the FQDN Host.|
||||hostname/Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|FQDN|Yes | |Description:|
||||Specify FQDN Address.|
||||FQDN confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 253.|
||||UTF-8 character(s) are allowed.|
|FQDNHostGroup|No | |Description:|
||||Select Host Group from the available options.|
||||FQDNHostGroup confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
||||Multiple values are allowed.|
|Description|No | |Description:|
||||Enter a description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add FQDN Host|200|FQDN host "\<DynamicValue>" has been added successfully|
|Add FQDN Host|500|FQDN host "\<DynamicValue>" could not be added|
|Add FQDN Host|502|FQDN host "\<DynamicValue>" could not be added|
|Add FQDN Host|503|Host could not be added. The maximum creation limit exceeded|
|Update FQDN Host|200|FQDN host "\<DynamicValue>" has been updated successfully|
|Update FQDN Host|202|FQDN host "\<DynamicValue>" has been renamed to "\<DynamicValue>" and updated successfully|
|Update FQDN Host|500|FQDN host "\<DynamicValue>" could not be updated|
|Update FQDN Host|502|FQDN host "\<DynamicValue>" could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
