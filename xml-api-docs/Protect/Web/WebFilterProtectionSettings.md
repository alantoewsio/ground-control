# WebFilterProtectionSettings

- Operation: Update Web Filter Protection Settings
- Description: To update Web Filter Protection Settings.

## Sample Configuration

``` xml
<WebFilterProtectionSettings>
    <ScanMode>RealTime/BatchMode</ScanMode>
    <FTPFileSizeThreshold>1024</FTPFileSizeThreshold>
    <FileSizeThreshold>1024</FileSizeThreshold>
    <AudioVideoFileScanning>Enable/Disable</AudioVideoFileScanning>
    <HTTPSScanningCA>Text</HTTPSScanningCA>
    <DenyUnknownProtocol>Enable/Disable</DenyUnknownProtocol>
    <AllowInvalidCertificate>Enable/Disable</AllowInvalidCertificate>
    <NoHttpsNotification>Enable/Disable</NoHttpsNotification>
    <PharmingProtection>Enable/Disable</PharmingProtection>
    <Scanning>Single Anti-Virus (Maximum Performance)/Dual Anti-Virus (Maximum Security)</Scanning>
    <BlockUnscannableContent>Enable/Disable</BlockUnscannableContent>
    <PUADetection>Enable/Disable</PUADetection>
    <PUAWhitelist>
        <PUA>Name of PUA</PUA>
        :
        :
        :
    </PUAWhitelist>
</WebFilterProtectionSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ScanMode|No||Description:|
||||Select Scanning mode for HTTP/HTTPS Traffic from the available options: Real Time or Batch.|
||||ScanMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'RealTime', 'BatchMode' are allowed.|
|FTPFileSizeThreshold|No|1024|Description:|
||||Specify the maximum file size (in KB) for scanning.|
||||FTPFileSizeThreshold confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 1572864 is allowed.|
||||Maximum digits allowed are 7.|
|FileSizeThreshold|No|1024|Description:|
||||Specify File Size Threshold (in KB) such that files that exceed configured threshold will not be scanned.|
||||FileSizeThreshold confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 1572864 is allowed.|
||||Maximum digits allowed are 7.|
|AudioVideoFileScanning|No|Disable|Description:|
||||Enable to scan video and audio streams being downloaded.|
||||AudioVideoFileScanning confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|HTTPSScanningCA|No||Description:|
||||Select the CA used in HTTPS scanning.|
||||HTTPSScanningCA confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DenyUnknownProtocol|No|Disable|Description:|
||||Enable to deny invalid traffic through HTTPS port.|
||||DenyUnknownProtocol confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|AllowInvalidCertificate|No|Enable|Description:|
||||Enable to allow access to sites using an invalid SSL Certificate.|
||||AllowInvalidCertificate confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|NoHttpsNotification|No|Disable|Description:|
||||Enable to show notifications only for HTTPs with decrypt and scan HTTPs.|
||||NoHttpsNotification confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|PharmingProtection|No|Disable|Description:|
||||Enable to protect against Pharming attacks.|
||||PharmingProtection confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Scanning|No|Single Anti-Virus (Maximum Performance)|Description:|
||||Scan Engine Selection.|
||||Scanning confines to:|
||||Type is 'SCALAR'.|
||||Only 'Single Anti-Virus (Maximum Performance)', 'Dual Anti-Virus (Maximum Security)' are allowed.|
|BlockUnscannableContent|No|Block (Best Protection)|Description:|
||||Control of unscannable files.|
||||BlockUnscannableContent confines to:|
||||Type is 'SCALAR'.|
||||Only 'Allow', 'Block (Best Protection)' are allowed.|
|PUADetection|No|Disable|Description:|
||||Enable to deny PUA from being downloaded.|
||||PUADetection confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|PUA|No||Description:|
||||List of allowed PUAs when PUA detection is enabled.|
||||PUA confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update Web Filter Protection Settings|200|Web filter settings have been updated successfully|
|Update Web Filter Protection Settings|500|Web filter settings could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
