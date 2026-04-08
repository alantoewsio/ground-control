# DirectWebProxyAuthentication

- Operation: Update authentication settings for direct web proxy
- Description: Update per-connection AD SSO authentication settings and multi-user hosts.

## Sample Configuration

``` xml
<DirectWebProxyAuthentication>
    <PerConnectionAuth>Enable/Disable</PerConnectionAuth>
    <MultiUserHosts>
        <Host>Multi-user host name</Host>
    </MultiUserHosts>
</DirectWebProxyAuthentication>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|PerConnectionAuth|No | |Description:|
||||Turn per-connection authentication on or off.|
||||PerConnectionAuth confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Host|No | |Description:|
||||Multi-user hosts for which to turn on per-connection authentication.|
||||Host confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 1500.|
||||Multiple values are allowed.|
||||Duplicate values will be ignored.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update authentication settings for direct web proxy|200|Updated the authentication settings for direct web proxy.|
|Update authentication settings for direct web proxy|500|Couldn't update the authentication settings for direct web proxy.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
