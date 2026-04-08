# AntiVirusHTTPsConfiguration

- Operation: Update HTTP or HTTPS Configurations
- Description: To Configure HTTP/HTTPS Settings for scanning and restricting all the HTTP/HTTPS traffic.

## Sample Configuration

``` xml
<AntiVirusHTTPsConfiguration>
    <ScanMode>RealTime/BatchMode</ScanMode>
    <FileSizeThreshold>1024</FileSizeThreshold>
    <AudioVideoFileScanning>Enable/Disable</AudioVideoFileScanning>
    <HTTPSConfigurations>
        <HTTPSScanningCA>Text</HTTPSScanningCA>
        <DenyUnknownProtocol>Enable/Disable</DenyUnknownProtocol>
        <AllowInvalidCertificate>Enable/Disable</AllowInvalidCertificate>
        <NoHttpsNotification>Enable/Disable</NoHttpsNotification>
    </HTTPSConfigurations>
    <PUADetection>Enable/Disable</PUADetection>
</AntiVirusHTTPsConfiguration>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ScanMode|Yes||Description:|
||||Select Scanning mode for HTTP/HTTPS Traffic from the available options: Real Time or Batch.|
||||ScanMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'RealTime', 'BatchMode' are allowed.|
|FileSizeThreshold|Yes|1024|Description:|
||||Specify File Size Threshold (in KB) such that files that exceed configured threshold will not be scanned.|
||||FileSizeThreshold confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 1572864 is allowed.|
||||Maximum digits allowed are 7.|
|AudioVideoFileScanning|Yes|Disable|Description:|
||||Enable to scan video and audio streams being downloaded.|
||||AudioVideoFileScanning confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|HTTPSScanningCA|Yes||Description:|
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
|PUADetection|No|Disable|Description:|
||||Enable to deny PUA from being downloaded.|
||||PUADetection confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|NoHttpsNotification|No|Disable|Description:|
||||Enable to show notifications only for HTTPs with decrypt and scan HTTPs.|
||||NoHttpsNotification confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update HTTP or HTTPS Configurations|200|HTTP configuration has been updated successfully|
|Update HTTP or HTTPS Configurations|500|HTTP configuration could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
