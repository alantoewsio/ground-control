# CRL

- Operation: Add CRL / Edit CRL
- Description: Add/Edit Certificate Revocation List(CRL) which is a list of revoked certificates i.e. certificates which are lost, stolen or updated.

## Sample Configuration

``` xml
<CRL>
  <Name>Name</Name>
  <CRLFile>{name of file uploaded in multipart}</CRLFile>
</CRL>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|CRLFile|No | |Description:|
||||Browse to the complete path from where CRL file is to be uploaded.|
||||CRLFile confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||File formats 'crl' are allowed.|
|Name|Yes | |Description:|
||||Specify the name to identify CRL.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed characters: (A-Za-z0-9_@\-\.)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add CRL|200|CRL "\<DynamicValue>" has been uploaded successfully|
|Add CRL|500|CRL "\<DynamicValue>" could not be uploaded|
|Add CRL|502|CRL could not be uploaded. CRL with same name as "\<DynamicValue>" already exists. Choose a different name|
|Add CRL|503|CRL "\<DynamicValue>" is expired, could not be uploaded|
|Edit CRL|200|CRL "\<DynamicValue>" has been updated successfully|
|Edit CRL|500|CRL "\<DynamicValue>" could not be updated|

---
© Copyright 2019 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
