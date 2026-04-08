# DKIMVerification

- Operation: Edit DKIM Verification
- Description: To Edit DKIM Verification

## Sample Configuration

``` xml
<DKIMVerification>
    <VerifactionStatus>Enable/Disable</VerifactionStatus>
    <ActionForVerifactionFail>Quarantine/Reject/Pass</ActionForVerifactionFail>
    <ActionForSignatureInvalid>Quarantine/Reject/Pass</ActionForSignatureInvalid>
    <ActionForSignatureNotFound>Quarantine/Reject/Pass</ActionForSignatureNotFound>
</DKIMVerification>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|DKIM Verification status|Yes||Description:|
||||Enable dkim verification|
||||DKIM Verification status confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DKIM Verification failed|Yes||Description:|
||||Specify action on dkim verification failed.|
||||DKIM Verification failed confines to:|
||||Type is 'SCALAR'.|
||||Only 'Accept', 'Quarantine', 'Reject' are allowed.|
|DKIM Signature invalid|Yes||Description:|
||||Specify action on found dkim signature invalid|
||||DKIM Signature invalid confines to:|
||||Type is 'SCALAR'.|
||||Only 'Accept', 'Quarantine', 'Reject' are allowed.|
|DKIM Signature not found|Yes|Any|Description:|
||||Specify action on dkim signature missing|
||||DKIM Signature not found confines to:|
||||Type is 'SCALAR'.|
||||Only 'Accept', 'Quarantine', 'Reject' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Edit DKIM Verification|200|Updated DKIM verification|
|Edit DKIM Verification|500|Couldn't delete DKIM verification|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
