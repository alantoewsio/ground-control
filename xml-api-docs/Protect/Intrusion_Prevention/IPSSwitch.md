# IPSSwitch

- Operation: IPS switch
- Description: To set IPS switch on or off.

## Sample Configuration

``` xml
<IPSSwitch>
    <Status>Enable/Disable</Status>
</IPSSwitch>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Status|Yes|OFF|Description:|
||||Turn IPS switch on or off.|
||||Status confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|IPS switch|200|Operation Successful|
|IPS switch|500|Operation Fail|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
