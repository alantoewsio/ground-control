# WebProxy

- Operation: Update Web Proxy Settings
- Description: Configure Web Proxy settings to use the appliance as a Web Proxy Server.

## Sample Configuration

``` xml
<WebProxy>
    <WebProxyPort>3128</WebProxyPort>
    <TrustedPorts>
        <Port>80</Port>
        :
    </TrustedPorts>
</WebProxy>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|WebProxyPort|Yes|3128|Description:|
||||Set a Web Proxy port if appliance is configured as a Web Proxy Server.|
||||WebProxyPort confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Allowed port range: 1 to 65535.|
||||Maximum digits allowed are 5.|
|Port|No||Description:|
||||Define non-standard ports as trusted ports to allow access to sites hosted on non-standard ports.|
||||Port confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Allowed numbers: 1 to 65535. Character (*) is allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update Web Proxy Settings|200|Web proxy settings have been updated successfully|
|Update Web Proxy Settings|500|Web proxy settings could not be updated|
|Update Web Proxy Settings|504|Web proxy port could not be updated. Web proxy port is already assigned|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
