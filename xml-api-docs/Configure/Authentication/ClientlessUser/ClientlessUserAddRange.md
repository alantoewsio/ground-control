# ClientlessUserAddRange

- Operation: Add Clientless User Range
- Description: To add multiple Clientless Users.

## Sample Configuration

``` xml
<ClientlessUserAddRange>
    <FromIPAddress>ipaddress</FromIPAddress>
    <ToIPAddress>ipaddress</ToIPAddress>
    <ClientLessGroup>group</ClientLessGroup>
</ClientlessUserAddRange>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Range From|No | |Description:|
||||Specify the starting IP address for the range.|
||||Range From confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS','IPADDRESS6'.|
||||Maximum characters allowed are 45.|
|Range To|No | |Description:|
||||Specify the ending IP address for the range.|
||||Range To confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS','IPADDRESS6'.|
||||Maximum characters allowed are 45.|
|Group|No | |Description:|
||||Select Group for the users.|
||||Group confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Clientless User Range|200|All the users have been added successfully|
|Add Clientless User Range|500|Clientless user could not be added|
|Add Clientless User Range|502|Clientless user with the same name already exists|
|Add Clientless User Range|503|Clientless user with the same IP address already exists|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
