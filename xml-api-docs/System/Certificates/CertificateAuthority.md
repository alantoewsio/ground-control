# CertificateAuthority

- **Operation**: Add Certificate Authority / Edit Certificate Authority
- **Description**: Add/Edit Certificate Authority which issues Certificates.

## Sample Configuration

``` xml
<CertificateAuthority>
  <Name>Name</Name>
  <Format>PEM/DER</Format>
  <CACertFile>{CAFilename uploaded in multipart request}</CACertFile>
  <CAPrivateKeyFile>{CAFilename uploaded in multipart request}</CAPrivateKeyFile>
  <Password>Password</Password>
  <Type>Uploaded/Built-in/Internal</Type>
</CertificateAuthority>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Name of the certificate authority.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed characters: (A-Za-z0-9_@\-\.)|
||||Maximum characters allowed are 255.|
||||UTF-8 character(s) are allowed.|
|Format|No | |Description:|
||||Format of the root certificate you uploaded.|
||||Format confines to:|
||||Type is 'SCALAR'.|
||||Only 'PEM', 'DER' are allowed.|
|CACertFile|No | |Description:|
||||Browse to the full path from where the certificate is to be uploaded.|
||||CACertFile confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CAPrivateKeyFile|No | |Description:|
||||Browse to the full path from where the private key is to be uploaded.|
||||CAPrivateKeyFile confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Password|No | |Description:|
||||Specify the password to access the private key.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 30.|
||||Minimum characters allowed are 4.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Certificate Authority|200|Certificate authority has been uploaded successfully|
|Add Certificate Authority|500|Attached certificate authority is invalid. Please choose a valid certificate authority.|
|Add Certificate Authority|502|Certificate authority (CA) could not be added. CA with the same name already exists, choose a different name|
|Add Certificate Authority|503|Certificate authority (CA) could not be uploaded. CA certificate already exists. Choose another CA|
|Add Certificate Authority|510|Failed to upload Certificate Authority. Invalid private key file or password|
|Add Certificate Authority|541|Certificate authority file may be corrupt|
|Edit Certificate Authority|200|Certificate authority details have been updated successfully|
|Edit Certificate Authority|500|Certificate authority details could not be updated|
|Edit Certificate Authority|502|Certificate authority (CA) could not be added. CA with the same name already exists, choose a different name|
|Edit Certificate Authority|503|Certificate authority (CA) could not be uploaded. CA certificate already exists. Choose another CA|
|Edit Certificate Authority|504|Failed to update certificate authority (CA). Since CA is used in HTTPS scanning, you must update all its parameters|
|Edit Certificate Authority|510|Failed to upload Certificate Authority. Invalid private key file or password|
|Edit Certificate Authority|541|Certificate authority file may be corrupt|

---
© Copyright 2019 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
