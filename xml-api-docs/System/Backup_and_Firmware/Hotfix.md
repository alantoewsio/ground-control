# Hotfix

- **Operation**: Turn on or turn off hotfix
- **Description**: Allow or disallow automatic installation of hotfixes

## Sample Configuration

``` xml
<Hotfix>
  <AllowAutoInstallOfHotFixes>Enable/Disable</AllowAutoInstallOfHotFixes>
</Hotfix>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|AllowAutoInstallOfHotFixes|Yes |Enable |Description:|
||||Allow automatic installation of hotfixes|
||||AllowAutoInstallOfHotFixes confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable', 'show' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Turn on or turn off hotfix|200|Update settings applied successfully|
|Turn on or turn off hotfix|500|Update settings could not be applied|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
