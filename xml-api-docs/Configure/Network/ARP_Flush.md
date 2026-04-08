# ARP_Flush

- Operation: Flush All Dynamic Entries / Get Dynamic Neighbour Entries
- Description: Get all dynamic Neighbour Entries

## Sample Configuration

``` xml
<ARP_Flush>
    <IPFamily>IPv4/IPv6</IPFamily>
</ARP_Flush>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|IPFamily|No| |Description:|
||||Specify 'ipfamily'|
||||IPFamily confines to:|
||||Type is 'SCALAR'.|
||||Only 'IPv4', 'IPv6' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Flush All Dynamic Entries|200|Operation Successful.|
|Flush All Dynamic Entries|500|Operation Fail.|
|Get Dynamic Neighbour Entries|200|Operation Successful.|
|Get Dynamic Neighbour Entries|500|Operation Fail.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
