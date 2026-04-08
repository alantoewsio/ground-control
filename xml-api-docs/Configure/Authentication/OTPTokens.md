# OTPTokens

- Operation: Add OTP Token / Update OTP Token
- Description: Add OTP Token Update OTP Token

## Sample Configuration

``` xml
<OTPTokens>
    <tokenid />
    <timeStep />
    <timeStepOffset />
    <secret />
    <lastLogin />
    <timeOffset />
    <extraCodes />
    <active />
    <autoCreated />
    <user />
    <comment />
</OTPTokens>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|tokenid|No | |Description:|
||||Specify 'tokenid'|
||||tokenid confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 32.|
||||Minimum characters allowed are 1.|
|timeStep|No | |Description:|
||||OTP time step|
||||timeStep confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 10 to 300 is allowed.|
||||Maximum digits allowed are 3.|
|timeStepOffset|No | |Description:|
||||OTP time step offset|
||||timeStepOffset confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|secret|No | |Description:|
||||OTP Secret|
||||secret confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 120.|
||||Minimum characters allowed are 32.|
|lastLogin|No | |Description:|
||||OTP last successful login|
||||lastLogin confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|timeOffset|No | |Description:|
||||Time offset to adjust clock skew|
||||timeOffset confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INT'.|
|extraCodes|No | |Description:|
||||one-time random codes that may be used if the secret is temporarily unavailable|
||||extraCodes confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 69.|
|active|No | |Description:|
||||indicates if is this token has been enabled or disabled|
||||active confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|autoCreated|No | |Description:|
||||indicates if this token has been generated automatically at token creation|
||||autoCreated confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|userid|No | |Description:|
||||Specify 'userid'|
||||userid confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|comment|No | |Description:|
||||Tokens comment|
||||comment confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add OTP Token|200|OTP Token added successfully|
|Add OTP Token|500|OTP Token could not be added|
|Update OTP Token|200|OTP Token updated successfully|
|Update OTP Token|500|OTP Token could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
