# WAFSlowHTTP

- Operation: SlowHTTP Protection
- Description: Configure WAF slow HTTP.

## Sample Configuration

``` xml
<WAFSlowHTTP>
    <RequestHeaderTimeoutEnabled>Enable/Disable</RequestHeaderTimeoutEnabled>
    <RequestHeaderTimeoutSoftLimit>10</RequestHeaderTimeoutSoftLimit>
    <RequestHeaderTimeoutHardLimit>30</RequestHeaderTimeoutHardLimit>
    <RequestHeaderTimeoutExtensionRate>5000</RequestHeaderTimeoutExtensionRate>
    <NetworkExceptions>
        <Host>HostName</Host>
    </NetworkExceptions>
</WAFSlowHTTP>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|RequestHeaderTimeoutEnabled|Yes||Description:|
||||Enable or disable request header timeout protection.|
||||RequestHeaderTimeoutEnabled confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|RequestHeaderTimeoutSoftLimit|Yes||Description:|
||||Specify the soft limit for request header timeout in seconds.|
||||RequestHeaderTimeoutSoftLimit confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|RequestHeaderTimeoutHardLimit|Yes||Description:|
||||Specify the hard limit for request header timeout in seconds.|
||||RequestHeaderTimeoutHardLimit confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|RequestHeaderTimeoutExtensionRate|Yes||Description:|
||||Specify the extension rate for request header timeout.|
||||RequestHeaderTimeoutExtensionRate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|Host|No||Description:|
||||Specify networks to skip from slow HTTP protection.|
||||Host confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|SlowHTTP Protection|200|Operation Successful|
|SlowHTTP Protection|500|Operation Fail|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
