# AdvancedConfiguration_LoginPageCertificate

- Operation: Update Login Certificate
- Description: To update Login Certificate.

## Sample Configuration

``` xml
<AdvancedConfiguration>
    <LoginPageCertificate>
        <Certificate>certificate name</Certificate>
    </LoginPageCertificate>
</AdvancedConfiguration>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Certificate|No||Description:|
||||Select the certificate from the drop-down list.|
||||Certificate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update Login Certificate|200|Login page certificate updated successfully|
|Update Login Certificate|500|Login page certificate could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
