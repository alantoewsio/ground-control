# IPSFullSignaturePack

- Operation: IPSFullSignaturePack
- Description: Full or partial IPS signature pack download.

## Sample Configuration

``` xml
<IPSFullSignaturePack>
    <Status>enable/disable</Status>
</IPSFullSignaturePack>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Status|Yes|disable|Description:|
||||Turns IPS full signature pack download on or off.|
||||Status confines to:|
||||Type is 'SCALAR'.|
||||Only 'enable', 'disable', 'show' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|IPSFullSignaturePack|200|Operation Successful.|
|IPSFullSignaturePack|500|Operation Fail.|

---
© Copyright 2026 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
