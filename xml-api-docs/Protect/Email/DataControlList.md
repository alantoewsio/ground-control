# DataControlList

- Operation: Add Data Control List / Update Data Control List
- Description: To Add/Update Data Control List for email data protection.

## Sample Configuration

``` xml
<DataControlList>
    <Name>Postal Addr</Name>
    <Signatures>
        <Signature>Postal addresses [Canada]</Signature>
        <Signature>Postal addresses [Germany]</Signature>
        <Signature>Postal addresses [Spain]</Signature>
    </Signatures>
</DataControlList>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|name|Yes | |Description:|
||||Specify 'name'.|
||||confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|signaturename|No | |Description:|
||||Specify 'signaturename'.|
||||confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Data Control List|200|Data control list "\<DynamicValue>" has been added successfully|
|Add Data Control List|500|Data control list "\<DynamicValue>" could not be added|
|Add Data Control List|502|Data control list with same name already exists|
|Add Data Control List|545|Configuration could not be applied because MTA mode is disabled|
|Update Data Control List|200|Data control list has been updated successfully|
|Update Data Control List|500|Data control list could not be updated|
|Update Data Control List|502|Data control list with same name already exists|
|Update Data Control List|545|Configuration could not be applied because MTA mode is disabled|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
