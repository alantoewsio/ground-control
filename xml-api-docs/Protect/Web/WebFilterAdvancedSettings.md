# WebFilterAdvancedSettings

- Operation: Update Web Filter Advanced Settings
- Description: To update Web Filter Advanced Settings.

## Sample Configuration

``` xml
<WebFilterAdvancedSettings>
    <WebCaching>Enable/Disable</WebCaching>
    <WebProxyPort>3128</WebProxyPort>
    <WebProxyMinimumTLSVersion>TLS 1.0/TLS 1.1/TLS 1.2</WebProxyMinimumTLSVersion>
    <TrustedPorts>
        <Port>80</Port>
        :
    </TrustedPorts>
</WebFilterAdvancedSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|WebCaching|No|Disable|Description:|
||||Enable web content cache.|
||||WebCaching confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|WebProxyPort|No|3128|Description:|
||||Set a Web Proxy port if appliance is configured as a Web Proxy Server.|
||||WebProxyPort confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Allowed port range: 1 to 65535.|
||||Maximum digits allowed are 5.|
|WebProxyMinimumTLSVersion|No|TLS 1.1|Description:|
||||Minimum required TLS version for web proxy and captive portal.|
||||WebProxyMinimumTLSVersion confines to:|
||||Type is 'SCALAR'.|
||||Only 'TLS 1.0', 'TLS 1.1', 'TLS 1.2' are allowed.|
|Port|No||Description:|
||||Define non-standard ports as trusted ports to allow access to sites hosted on non-standard ports.|
||||Port confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'INTEGER'.|
||||Allowed port range: 1 to 65535.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update Web Filter Advanced Settings|200|Web filter settings have been updated successfully|
|Update Web Filter Advanced Settings|500|Web filter settings could not be updated|
|Update Web Filter Advanced Settings|504|Web proxy port could not be updated. Web proxy port is already assigned|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
