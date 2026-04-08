# IPSCustomSignature

- Operation: Add Custom Signature / Update custom signature
- Description: To Create/Update Custom Signature for Proprietary Sever, custom protocol or specialized applications and protect network.

## Sample Configuration

``` xml
<IPSCustomSignature>
    <Name>SignatureName</Name>
    <Protocol>TCP/UDP/ICMP/ALL</Protocol>
    <CustomRule>SignatureDefinition</CustomRule>
    <Severity>Critical/Major/Moderate/Minor/Warning</Severity>
    <RecommendedAction>Allow Packet/Drop Packet/Drop Session/Reset/Bypass Session</RecommendedAction>
</IPSCustomSignature>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Specify a name for the Custom Signature.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 15.|
|Protocol|Yes||Description:|
||||Select Signature Protocol from the options available.|
||||Protocol confines to:|
||||Type is 'SCALAR'.|
||||Only 'TCP', 'UDP', 'ICMP', 'ALL' are allowed.|
|CustomRule|Yes||Description:|
||||Specify Signature definition.|
||||CustomRule confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||To separate letters, use a dot (.).|
|Severity|Yes||Description:|
||||Select the Severity level from the options available.|
||||Severity confines to:|
||||Type is 'SCALAR'.|
||||Only 'Critical', 'Major', 'Moderate', 'Minor', 'Warning' are allowed.|
|RecommendedAction|Yes||Description:|
||||Select the action to be taken if traffic pattern matching to the Signature is found.|
||||RecommendedAction confines to:|
||||Type is 'SCALAR'.|
||||Only 'Allow Packet', 'Drop Packet', 'Drop Session', 'Reset', 'Bypass Session', '3' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Custom Signature|200|Custom IPS pattern "\<DynamicValue>" has been added successfully|
|Add Custom Signature|500|Custom IPS pattern could not be added|
|Add Custom Signature|502|Custom IPS pattern could not be added. Custom IPS pattern with the same name as "\<DynamicValue>" already exists, choose a different name|
|Add Custom Signature|504|Custom IPS pattern could not be created. Custom rule is not valid|
|Add Custom Signature|505|Custom IPS pattern could not be created. IPS service could not restart|
|Add Custom Signature|506|Custom IPS pattern could not be created|
|Update custom signature|200|Custom IPS pattern "\<DynamicValue>" has been updated successfully|
|Update custom signature|500|Custom IPS pattern could not be updated|
|Update custom signature|502|Custom IPS pattern could not be added. Custom IPS pattern with the same name as "\<DynamicValue>" already exists, choose a different name|
|Update custom signature|504|IPS custom rule is not valid|
|Update custom signature|505|Custom IPS pattern could not be created. IPS service could not restart|
|Update custom signature|506|Custom IPS pattern could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
