# Certificate

- **Operation**: Add Certificate / Update Certificate
- **Description**: To Add/Update Certificates.

## Sample Configuration

``` xml
<Certificate>
  <Action>UploadCertificate/GenerateSelfSignedCertificate/GenerateCertificateSigningRequest</Action>
  <Name>Name</Name>
  
  <!-- for UploadCertificate -->
  <CertificateFormat>Text</CertificateFormat>
  <CertificateFile>{Filename uploaded in multipart request}</CertificateFile>
  <PrivateKeyFile>{Filename uploaded in multipart request}</PrivateKeyFile>
  <Password>Password</Password>

  <!-- For GenerateCertificate and GenerateCSR -->
  <ValidFrom>2011-03-06</ValidFrom>
  <ValidUpto>2011-03-06</ValidUpto>
  <KeyType>RSA/Elliptic Curve</KeyType>
  <!-- When KeyType is RSA -->
  <KeyLength>1024/1536/2048/4096</KeyLength>
  <!-- When KeyType is Elliptic Curve -->
  <CurveName>secp256r1/secp384r1</CurveName>
  <SecureHash>SHA - 256/SHA - 384/SHA - 512</SecureHash>
  <CountryName>Andorra</CountryName>
  <StateProvinceName>name</StateProvinceName>
  <LocalityName>CityName</LocalityName>
  <OrganizationName>CompanyName</OrganizationName>
  <OrganizationUnitName>DepartmentName</OrganizationUnitName>
  <CommonName>ServersHostname</CommonName>
  <EmailAddress>email</EmailAddress>
  <DNSSubjectAltNames>
    <DNSName>Domain name</DNSName>
  </DNSSubjectAltNames>
  <IPAddressSubjectAltNames>
    <IPAddress>IP Address</IPAddress>
    <IPAddress>IPv6 Address</IPAddress>
  </IPAddressSubjectAltNames>
  <CertificateIDType>DNS/IP Address/Email/DER ASN1 DN (X.509)</CertificateIDType>
  <CertificateID>ipaddress</CertificateID>
</Certificate>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Action|No | |Description:|
||||Select action from the available options: Upload Certificate, Generate Self Signed Certificate|
||||Or Generate Certificate Signing Request (CSR).|
||||Action confines to:|
||||Type is 'SCALAR'.|
||||Only 'UploadCertificate', 'GenerateSelfSignedCertificate', 'p', 'GenerateCertificateSigningRequest', 'UploadRemoteCertificate' are allowed.|
|Name|Yes | |Description:|
||||Specify name of the Certificate.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed characters: (A-Za-z0-9_@\-\.)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|CertificateFile|No | |Description:|
||||Browse and select the certificate file to be uploaded.|
||||CertificateFile confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||File formats 'PEM', 'der', 'cer', 'p7b', 'pfx', 'p12' are allowed.|
|PrivateKeyFile|No | |Description:|
||||Browse and select the private key file to be uploaded.|
||||PrivateKeyFile confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||File formats 'key' are allowed.|
|Password|No | |Description:|
||||Specify a password for the Certificate used for authentication.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 128.|
||||Minimum characters allowed are 4.|
|ValidFrom|No | |Description:|
||||Specify date from which the Certificate is valid.|
||||ValidFrom confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ValidUpto|No | |Description:|
||||Specify date upto which the Certificate is valid.|
||||ValidUpto confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|KeyType|No |RSA |Description:|
||||For key type, select RSA or elliptic curve.|
||||KeyType confines to:|
||||Type is 'SCALAR'.|
||||Only 'RSA', 'Elliptic Curve' are allowed.|
|KeyLength|No |2048 |Description:|
||||Select key length, or the number of bits used to construct the key.|
||||KeyLength confines to:|
||||Type is 'SCALAR'.|
||||Only '1024', '1536', '2048', '4096' are allowed.|
|CurveName|No |secp256r1 |Description:|
||||Select curve name.|
||||CurveName confines to:|
||||Type is 'SCALAR'.|
||||Only 'secp256r1', 'secp384r1', 'secp521r1' are allowed.|
|SecureHash|No |SHA - 256 |Description:|
||||Select secure hash.|
||||SecureHash confines to:|
||||Type is 'SCALAR'.|
||||Only 'SHA - 256', 'SHA - 384', 'SHA - 512' are allowed.|
|KeyEncryption|No |Disable |Description:|
||||Click to enable Key encryption.|
||||KeyEncryption confines to:|
||||Type is 'SCALAR'.|
||||Only 'y', 'n', 'N', 'Y' are allowed.|
|CertificateIDType|No | |Description:|
||||Select the Certificate ID from the options.|
||||CertificateIDType confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CertificateID|No | |Description:|
||||Specify the value corresponding to the Certificate ID selected.|
||||CertificateID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CountryName|No | |Description:|
||||Select the Country from the available options.|
||||CountryName confines to:|
||||Type is 'SCALAR'.|
||||Only 'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BA', 'BW', 'BV', 'BR', 'IO', 'VG', 'BN', 'BG', 'BF', 'BI', 'KH', 'CM', 'CA', 'CV', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CG', 'CD', 'CK', 'CR', 'HR', 'CU', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'TL', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'CI', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MK', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'FX', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'AN', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'KP', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA', 'RE', 'RO', 'RU', 'RW', 'BL', 'SH', 'KN', 'LC', 'MF', 'PM', 'VC', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'KR', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SZ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'VI', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VA', 'VE', 'VN', 'WF', 'EH', 'YE', 'ZM', 'ZW', 'YD', 'SU', 'PU', 'BQ', 'CT', 'DD', 'FQ', 'JT', 'MI', 'NQ', 'NT', 'PC', 'PZ', 'QO', 'QU', 'VD', 'WK', 'ZZ' are allowed.|
|OrganizationName|No | |Description:|
||||Specify the organization name which will use this Certificate and domain name.|
||||OrganizationName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 64.|
||||Note:|
||||Domain name must be unique.|
|OrganizationUnitName|No | |Description:|
||||Specify the department name which will use this Certificate and domain name.|
||||OrganizationUnitName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 64.|
||||Note:|
||||Domain name must be unique.|
|StateProvinceName|No | |Description:|
||||Specify the state within the country.|
||||StateProvinceName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 128.|
|LocalityName|No | |Description:|
||||Specify the name of the locality.|
||||LocalityName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 128.|
|CommonName|Yes | |Description:|
||||Specify Common name which compromises of host and domain name.|
||||CommonName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 64.|
|EmailAddress|No | |Description:|
||||Specify the Email Address of the person to contact for communication.|
||||EmailAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'EMAIL'.|
||||Maximum characters allowed are 128.|
|KeyEncryption|No | |Description:|
||||Click to enable Key encryption.|
||||KeyEncryption confines to:|
||||Type is 'SCALAR'.|
||||Only 'y', 'Y', 'n', 'N' are allowed.|
|CertificateFormat|No | |Description:|
||||Select format of Certificate file from the available options.|
||||CertificateFormat confines to:|
||||Type is 'SCALAR'.|
||||Only 'pem', 'der', 'cer', 'pkcs7', 'pkcs12', 'p7b' are allowed.|
|DNSName|No | |Description:|
||||List of DNS Subject Alternative Names (SANs).|
||||DNSName confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|DNSName|No | |Description:|
||||Specify a DNS Subject Alternative Name (SAN).|
||||DNSName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|IPAddress|No | |Description:|
||||List of IP address Subject Alternative Names (SANs).|
||||IPAddress confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|IPAddress|No | |Description:|
||||Specify an IP address Subject Alternative Name (SAN).|
||||IPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|certname|No | |Description:|
||||Specify 'certname'|
||||confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Certificate|200|Certificate has been generated successfully|
|Add Certificate|500|Certificate could not be generated|
|Add Certificate|502|Certificate could not be uploaded. Certificate already exists, choose a different certificate|
|Add Certificate|503|Failed to generate the certificate. Certificate with identical identification attributes already exists|
|Add Certificate|510|Certificate could not be uploaded due to invalid private key or passphrase. Choose a proper key|
|Add Certificate|519|Couldn't generate CSR.|
|Add Certificate|541|Certificate file may be corrupted|
|Update Certificate|200|Certificate has been updated successfully|
|Update Certificate|500|Certificate could not be updated|
|Update Certificate|503|Failed to generate the certificate. Certificate with identical identification attributes already exists|
|Update Certificate|519|Couldn't update CSR.|
|Update Certificate|510|Certificate could not be uploaded due to invalid private key or passphrase. Choose a proper key|
|Update Certificate|541|Certificate file may be corrupted|

---
© Copyright 2019 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
