# ARP_Delete

- Operation: Delete Static ARP Entry
- Description: To Delete Static ARP Entry

## Sample Configuration

``` xml
<ARP_Delete>
    <IPAddress>192.168.1.100</IPAddress>
</ARP_Delete>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|IPAddress|Yes | |Description:|
||||Specify a 'IPAddress' to identify an entity.|
||||IPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Delete Static ARP Entry|200|Static ARP entry deleted successfully|
|Delete Static ARP Entry|500|Static ARP entry could not be deleted|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
