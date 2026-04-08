# DecryptionProfile

- **Operation**: Add Decryption Profile / Update Decryption Profile
- **Description**: Add a Decryption Profile.Update a Decryption Profile.

## Sample Configuration

``` xml
<DecryptionProfile>
  <Name>Name</Name>
  <NewName>Edited Name</NewName>
  <Description>Description</Description>
  <IsDefault>yes/no</IsDefault>
  <UseDefaultCAs>yes/no</UseDefaultCAs>
  <RSACA>CA Name</RSACA>
  <ECCA>CA Name</ECCA>
  <BlockInvalidDate>yes/no</BlockInvalidDate>
  <BlockUntrustedIssuer>yes/no</BlockUntrustedIssuer>
  <BlockSelfSigned>yes/no</BlockSelfSigned>
  <BlockRevoked>yes/no</BlockRevoked>
  <BlockNameMismatch>yes/no</BlockNameMismatch>
  <BlockOtherReasons>yes/no</BlockOtherReasons>
  <MinRSAKeySize>No minimum/1024/2048</MinRSAKeySize>
  <MinTLSVersion>TLS v1.0/TLS v1.1/TLS v1.2/TLS v1.3</MinTLSVersion>
  <MaxTLSVersion>TLS v1.0/TLS v1.1/TLS v1.2/TLS v1.3/Maximum supported</MaxTLSVersion>
  <BlockAction>Drop/Reject/Reject and notify</BlockAction>
  <UnrecognizedCiphers>Allow without decryption/Drop/Reject</UnrecognizedCiphers>
  <SSLConnectionsExceeded>Use SSL/TLS settings default/Allow without decryption/Drop/Reject</SSLConnectionsExceeded>
  <SSLv2SSLv3>Use SSL/TLS settings default/Allow without decryption/Drop/Reject</SSLv2SSLv3>
  <SSLCompression>Use SSL/TLS settings default/Allow without decryption/Drop/Reject</SSLCompression>
  <BlockedAlgorithmList>
    <KeyExchangeAlgorithm>RSA</KeyExchangeAlgorithm>
    <AuthenticationAlgorithm>DSA</AuthenticationAlgorithm>
    <BlockAndStreamCipher>RC4</BlockAndStreamCipher>
    <HashAlgorithm>MD5</HashAlgorithm>
  </BlockedAlgorithmList>
</DecryptionProfile>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name for the Decryption Profile.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|Description|No | |Description:|
||||Specify a description for the Decryption Profile.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|IsDefault|No |no |Description:|
||||Read-only field specifying if it's a default decryption profile.|
|UseDefaultCAs|No |yes |Description:|
||||Enable to use CAs specified in TLS/SSL settings for re-signing.|
||||UseDefaultCAs confines to:|
||||Type is 'SCALAR'.|
||||Only 'yes', 'no', 'true', 'false' are allowed.|
|RSACA|No | |Description:|
||||Select the RSA CA for re-signing.|
|ECCA|No | |Description:|
||||Select the EC CA for re-signing.|
|BlockInvalidDate|No |no |Description:|
||||Enable to block certificates with an invalid date.|
||||BlockInvalidDate confines to:|
||||Type is 'SCALAR'.|
||||Only 'yes', 'no', 'true', 'false' are allowed.|
|BlockUntrustedIssuer|No |no |Description:|
||||Enable to block certificates with an untrusted issuer.|
||||BlockUntrustedIssuer confines to:|
||||Type is 'SCALAR'.|
||||Only 'yes', 'no', 'true', 'false' are allowed.|
|BlockSelfSigned|No |no |Description:|
||||Enable to block self-signed certificates.|
||||BlockSelfSigned confines to:|
||||Type is 'SCALAR'.|
||||Only 'yes', 'no', 'true', 'false' are allowed.|
|BlockRevoked|No |no |Description:|
||||Enable to block revoked certificates.|
||||BlockRevoked confines to:|
||||Type is 'SCALAR'.|
||||Only 'yes', 'no', 'true', 'false' are allowed.|
|BlockNameMismatch|No |no |Description:|
||||Enable to block certificates with mismatched names.|
||||BlockNameMismatch confines to:|
||||Type is 'SCALAR'.|
||||Only 'yes', 'no', 'true', 'false' are allowed.|
|BlockOtherReasons|No |no |Description:|
||||Enable to block certificates with other errors.|
||||BlockOtherReasons confines to:|
||||Type is 'SCALAR'.|
||||Only 'yes', 'no', 'true', 'false' are allowed.|
|MinTLSVersion|No |TLS v1.0 |Description:|
||||Select minimum allowed SSL/TLS version.|
|MaxTLSVersion|No |Maximum supported |Description:|
||||Select maximum allowed SSL/TLS version.|
|BlockAction|No |Reject and notify |Description:|
||||Specify the block action for the Decryption Profile.|
||||BlockAction confines to:|
||||Type is 'SCALAR'.|
||||Only 'Drop', 'Reject', 'Reject and notify' are allowed.|
|UnrecognizedCiphers|No |Allow without decryption |Description:|
||||Specify the action for unrecognized cipher suites.|
||||UnrecognizedCiphers confines to:|
||||Type is 'SCALAR'.|
||||Only 'Allow without decryption', 'Drop', 'Reject' are allowed.|
|SSLConnectionsExceeded|No |Use SSL/TLS settings default |Description:|
||||Specify the action for exceeded SSL connections.|
||||SSLConnectionsExceeded confines to:|
||||Type is 'SCALAR'.|
||||Only 'Use SSL/TLS settings default', 'Allow without decryption', 'Drop', 'Reject' are allowed.|
|SSLv2SSLv3|No |Use SSL/TLS settings default |Description:|
||||Specify the action to be used for SSL 2.0 and SSL 3.0.|
||||SSLv2SSLv3 confines to:|
||||Type is 'SCALAR'.|
||||Only 'Use SSL/TLS settings default', 'Allow without decryption', 'Drop', 'Reject' are allowed.|
|SSLCompression|No |Use SSL/TLS settings default |Description:|
||||Specify the action for connections using SSL compression.|
||||SSLCompression confines to:|
||||Type is 'SCALAR'.|
||||Only 'Use SSL/TLS settings default', 'Allow without decryption', 'Drop', 'Reject' are allowed.|
|KeyExchangeAlgorithm|No | |Description:|
||||Specify blocked key exchange algorithms the profile contains.|
|AuthenticationAlgorithm|No | |Description:|
||||Specify blocked authentication algorithms the profile contains.|
|BlockAndStreamCipher|No | |Description:|
||||Specify blocked block and stream cipher algorithms the profile contains.|
|HashAlgorithm|No | |Description:|
||||Specify blocked hash algorithms the profile contains.|
|MinRSAKeySize|No |1024 |Description:|
||||Specify the minimum allowed RSA key size.|
||||MinRSAKeySize confines to:|
||||Type is 'SCALAR'.|
||||Only 'No minimum', '1024', '2048' are allowed.|
|NewName|No | |Description:|
||||Edit the name for the Decryption Profile.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Decryption Profile|200|Created decryption profile "\<DynamicValue>".|
|Add Decryption Profile|500||
|Add Decryption Profile|502|Couldn't create decryption profile. Decryption profile with the name "\<DynamicValue>" exists. Specify a different name.|
|Add Decryption Profile|522|Reached the maximum number of decryption profiles.|
|Update Decryption Profile|200|Updated decryption profile "\<DynamicValue>".|
|Update Decryption Profile|500||

---
---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
