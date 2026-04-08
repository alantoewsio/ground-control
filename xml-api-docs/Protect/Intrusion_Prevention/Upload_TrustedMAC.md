# Upload_TrustedMAC

- Operation: Upload Trusted MAC List
- Description: To import Trusted MAC list from a CSV(Comma Separated Value) file instead of adding Trusted MAC individually.

## Sample Configuration

``` xml
<Upload_TrustedMAC>
    <TrustedMACListFile>{name of file passed in multipart}</TrustedMACListFile>
</Upload_TrustedMAC>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|TrustedMACListFile|Yes||Description:|
||||Click to upload the Trusted MAC list from a CSV file.|
||||TrustedMACListFile confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||File formats 'csv', 'txt' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Upload Trusted MAC List|200|Trusted MAC address CSV file has been uploaded successfully|
|Upload Trusted MAC List|201|Few MAC addresses already exist|
|Upload Trusted MAC List|500|Trusted MAC address CSV file could not be uploaded|
|Upload Trusted MAC List|502|Uploaded file is not in expected format|
|Upload Trusted MAC List|503|Few IP/MAC addresses are invalid or missing. Provide valid addresses or choose a different file|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
