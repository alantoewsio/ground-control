# AntiVirusFTP

- Operation: Antivirus FTP Configuration
- Description: To Configure FTP Scanning Size.

## Sample Configuration

``` xml
<AntiVirusFTP>
    <FileSize>1024</FileSize><!--Files Greater Than Size(KB) Should Not Be Scanned -->
</AntiVirusFTP>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|FileSize|Yes|1024|Description:|
||||Specify the maximum file size (in KB) for scanning.|
||||FileSize confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 1572864 is allowed.|
||||Maximum digits allowed are 7.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Antivirus FTP Configuration|200|FTP configuration has been updated successfully|
|Antivirus FTP Configuration|500|FTP configuration could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
