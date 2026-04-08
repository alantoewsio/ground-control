# HealthCheckProfileStatus

- Operation: Change health check object status
- Description: To turn on or turn off the health check object.

## Sample Configuration

``` xml
<HealthCheckProfileStatus>
    <Name>{HealthCheckProfileStatusName}</Name>
    <Status>ON/OFF</Status>
</HealthCheckProfileStatus>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Name of the health check profile.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Status|Yes | |Description:|
||||Turn on or turn off health check profile.|
||||Status confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Change health check object status|200|Operation Successful.|
|Change health check object status|500|Operation Fail.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
