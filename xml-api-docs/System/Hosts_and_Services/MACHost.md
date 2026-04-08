# MACHost

- Operation: Add Mac Host / Edit Mac Host
- Description: To Create/Edit MAC Host.

## Sample Configuration

``` xml
<MACHost>
    <Name>Name</Name>
    <Description>Text</Description>
    <Type>MACAddress/MACList</Type>
    <MACAddress>00:16:76:49:33:CE</MACAddress>
    <MACList>
        <MACAddress>00:16:76:49:33:CE</MACAddress>
        <MACAddress>00:16:76:49:33:CE</MACAddress>
        <MACAddress>00:16:76:49:33:CE</MACAddress>
        <MACAddress>00:16:76:49:33:CE</MACAddress>
    </MACList>
</MACHost>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name to identify the MAC Host.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|Type|No |true |Description:|
||||Select the MAC Host Type: MAC Address or MAC List.|
||||Type confines to:|
||||Type is 'SCALAR'.|
||||Only 'MACAddress', 'MACLIST' are allowed.|
|MACAddress|Yes | |Description:|
||||Specify MAC Address based on the Host type selected.|
||||MACAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'MACADDRESS'.|
||||Maximum characters allowed are 17.|
|MACAddress|Yes | |Description:|
||||Specify multiple MAC Addresses if selected Host type is 'MAC List'.|
||||MACAddress confines to:|
||||Type is 'CSV'.|
||||Datatype is 'STRING'.|
||||Comma separated values are allowed.|
|Description|No | |Description:|
||||Enter a description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Mac Host|200|MAC host "\<DynamicValue>" has been added successfully|
|Add Mac Host|500|MAC host "\<DynamicValue>" could not be added|
|Add Mac Host|502|Host with same name already exists|
|Add Mac Host|503|Host with the same detail already exists|
|Edit Mac Host|200|MAC host "\<DynamicValue>" has been updated successfully|
|Edit Mac Host|202|MAC host "\<DynamicValue>" has been renamed to "\<DynamicValue>" and updated successfully|
|Edit Mac Host|500|MAC host "\<DynamicValue>" could not be updated|
|Edit Mac Host|502|Host with same name already exists|
|Edit Mac Host|503|Host with the same detail already exists|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
