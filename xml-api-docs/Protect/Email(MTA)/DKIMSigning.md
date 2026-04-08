# DKIMSigning

- Operation: Add DKIM Signing / Edit DKIM Signing
- Description: To Add/Edit DKIM signing.

## Sample Configuration

``` xml
<DKIMSigning>
    <Domain>Domain name</Domain>
    <KeySelector>test</KeySelector>
    <PrivateRSAKey>test</PrivateRSAKey>
</DKIMSigning>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Domain|Yes||Description:|
||||A Domain name to identify for DKIM signing.|
||||Domain confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'DOMAIN'.|
|KeySelector|Yes|Any|Description:|
||||Key selector.|
||||KeySelector confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|PrivateRSAKey|Yes|Any|Description:|
||||Private RSA key for DKIM signing.|
||||PrivateRSAKey confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add DKIM Signing|200|Added DKIM signing|
|Add DKIM Signing|500|Couldn't add DKIM signing|
|Edit DKIM Signing|200|Updated DKIM signing|
|Edit DKIM Signing|500|Couldn't update DKIM signing|
|Edit DKIM Signing|502|DKIM signing record with this domain exists|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
