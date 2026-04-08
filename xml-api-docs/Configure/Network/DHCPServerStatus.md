# DHCPServerStatus

- Operation: DHCP Server status change
- Description: To enable/disable DHCP Server.

## Sample Configuration

``` xml
<DHCPServerStatus>
    <DHCPServerNamedhcpname>{DHCPServerName}</DHCPServerNamedhcpname>
    <Status>ON/OFF</Status>
</DHCPServerStatus>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|DHCPServerNamedhcpname|Yes | |Description:|
||||Specify name for DHCP Server.|
||||DHCPServerNamedhcpname confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Status|Yes | |Description:|
||||Enable or Disable the DHCP Server as required.|
||||Status confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|DHCP Server status change|200|Operation Successful.|
|DHCP Server status change|500|Operation Fail.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
