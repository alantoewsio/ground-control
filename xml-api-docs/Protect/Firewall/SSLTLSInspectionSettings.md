# SSLTLSInspectionSettings

- Operation: Update SSL TLS inspection settings
- Description: Settings to use for SSL/TLS inspection

## Sample Configuration

``` xml
<SSLTLSInspectionSettings>
    <RSACA>Name</RSACA>
    <ECCA>Name</ECCA>
    <SSLv2SSLv3>Allow without decryption/Drop/Reject</SSLv2SSLv3>
    <SSLCompression>Allow without decryption/Drop/Reject</SSLCompression>
    <SSLConnectionsExceeded>Allow without decryption/Drop/Reject</SSLConnectionsExceeded>
    <TLS13Decryption>Decrypt as 1.3/Downgrade to TLS 1.2 and decrypt</TLS13Decryption>
    <SSLTLSEngine>Enabled/Disabled</SSLTLSEngine>
    <SSLTLSInspection>Enabled/Disabled</SSLTLSInspection>
</SSLTLSInspectionSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|RSACA|No||Description:|
||||Select the RSA CA for re-signing.|
||||RSACA confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ECCA|No||Description:|
||||Select the EC CA for re-signing.|
||||ECCA confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SSLv2SSLv3|No|Allow without decryption|Description:|
||||Specify the action to be used for SSL 2.0 and SSL 3.0.|
||||SSLv2SSLv3 confines to:|
||||Type is 'SCALAR'.|
||||Only 'Allow without decryption', 'Drop', 'Reject' are allowed.|
|SSLCompression|No|Allow without decryption|Description:|
||||Specify the action for connections using SSL compression.|
||||SSLCompression confines to:|
||||Type is 'SCALAR'.|
||||Only 'Allow without decryption', 'Drop', 'Reject' are allowed.|
|SSLConnectionsExceeded|No|Allow without decryption|Description:|
||||Specify the action for exceeded SSL connections.|
||||SSLConnectionsExceeded confines to:|
||||Type is 'SCALAR'.|
||||Only 'Allow without decryption', 'Drop', 'Reject' are allowed.|
|TLS13Decryption|No|Decrypt as 1.3|Description:|
||||Specify the action for TLS 1.3 connections.|
||||TLS13Decryption confines to:|
||||Type is 'SCALAR'.|
||||Only 'Decrypt as 1.3', 'Downgrade to TLS 1.2 and decrypt' are allowed.|
|SSLTLSEngine|No|Enabled|Description:|
||||Turns on TLS engine|
||||SSLTLSEngine confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enabled', 'Disabled' are allowed.|
|SSLTLSInspection|No|Enabled|Description:|
||||Enable to inspect SSL/TLS traffic.|
||||SSLTLSInspection confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disabled', 'Enabled' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update SSL TLS inspection settings|200|Operation Successful|
|Update SSL TLS inspection settings|500|Operation Fail|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
