# SelfSignedCertificateAuthority

- **Operation**: Generate Certificate Authority
- **Description**: Generate Certificate Authority

## Sample Configuration

``` xml
<SelfSignedCertificateAuthority>
  <!-- Name is for read purpose only, will be ignored for update -->
  <CountryName>Andorra</CountryName>
  <StateProvinceName>name</StateProvinceName>
  <LocalityName>CityName</LocalityName>
  <OrganizationName>CompanyName</OrganizationName>
  <OrganizationUnitName>DepartmentName</OrganizationUnitName>
  <CommonName>ServersHostname</CommonName>
  <EmailAddress>email</EmailAddress>
  <CAPassword>Password</CAPassword>
  <KeyType>RSA/Elliptic Curve</KeyType>
  <!-- When KeyType is RSA -->
  <KeyLength>2048/4096</KeyLength>
  <!-- When KeyType is Elliptic Curve -->
  <CurveName>secp256r1/secp384r1/secp521r1</CurveName>
  <SecureHash>SHA - 256/SHA - 384/SHA - 512</SecureHash>
  <!-- Output will be in zip file with its public key/privatekey -->
  <CACertFile>{CAFilename uploaded in multipart request}</CACertFile>
  <CAPrivateKeyFile>{CAFilename uploaded in multipart request}</CAPrivateKeyFile>
</SelfSignedCertificateAuthority>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Country Name|Yes | |Description:|
||||Select the Country from the available options.|
||||Country Name confines to:|
||||Type is 'SCALAR'.|
||||Only 'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BA', 'BW', 'BV', 'BR', 'IO', 'VG', 'BN', 'BG', 'BF', 'BI', 'KH', 'CM', 'CA', 'CV', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CG', 'CD', 'CK', 'CR', 'HR', 'CU', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'TL', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'CI', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MK', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'FX', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'AN', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'KP', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA', 'RE', 'RO', 'RU', 'RW', 'BL', 'SH', 'KN', 'LC', 'MF', 'PM', 'VC', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'KR', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SZ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'VI', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VA', 'VE', 'VN', 'WF', 'EH', 'YE', 'ZM', 'ZW', 'YD', 'ZZ', 'PU' are allowed.|
|State|Yes | |Description:|
||||Specify the state within the country.|
||||State confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 128.|
|Locality Name|Yes | |Description:|
||||Specify the name of the locality.|
||||Locality Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 128.|
|Organization Name|Yes | |Description:|
||||Specify the organization name which will use this Certificate and domain name.|
||||Organization Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 64.|
|Organization Unit Name|Yes | |Description:|
||||Specify the department name which will use this Certificate and domain name.|
||||Organization Unit Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 64.|
|Common Name|Yes | |Description:|
||||Specify Common name which compromises of host and domain name.|
||||Common Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 64.|
|Email Address|Yes | |Description:|
||||Specify the Email Address of the person to contact for communication.|
||||Email Address confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'EMAIL'.|
||||Maximum characters allowed are 128.|
|Password|No | |Description:|
||||Specify a password for the Certificate used for authentication.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 30.|
||||Minimum characters allowed are 4.|
|Key type|No |RSA |Description:|
||||For key type, select RSA or elliptic curve.|
||||Key type confines to:|
||||Type is 'SCALAR'.|
||||Only 'rsa', 'ec' are allowed.|
|Key length|No |2048 |Description:|
||||For private key, select the key length.|
||||Key length confines to:|
||||Type is 'SCALAR'.|
||||Only '2048', '4096' are allowed.|
|Curve name|No |secp256r1 |Description:|
||||Select curve name.|
||||Curve name confines to:|
||||Type is 'SCALAR'.|
||||Only 'secp256r1', 'secp384r1', 'secp521r1' are allowed.|
|Secure hash|No |SHA - 256 |Description:|
||||Select secure hash.|
||||Secure hash confines to:|
||||Type is 'SCALAR'.|
||||Only 'sha256', 'sha384', 'sha512' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Generate Certificate Authority|200|Certificate authority has been generated successfully|
|Generate Certificate Authority|500|Certificate authority details could not be updated or certificates could not be regenerated|
|Generate Certificate Authority|505|Certificate authority has been added successfully. You need to restart VPN services from the CLI console|

---
© Copyright 2019 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
