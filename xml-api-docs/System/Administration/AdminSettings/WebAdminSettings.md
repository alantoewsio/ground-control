# WebAdminSettings

- **Operation**: Web Admin Settings
- **Description**: Configure Access Parameters for Remote Management of Web Admin Console.

## Sample Configuration

``` xml
<AdminSettings>
  <WebAdminSettings><!-- each element at this layer is optional if provided will update config as defined rest untouched -->
    <HTTPSport>4444</HTTPSport>
    <UserPortalHTTPSPort>4443</UserPortalHTTPSPort>
    <VPNPortalHTTPSPort>443</VPNPortalHTTPSPort>
    <Certificate>ApplianceCertificate</Certificate>
    <PortalRedirectMode>ip/fqdn/custom</PortalRedirectMode>
    <PortalCustomHostname>0.0.0.0/[aaaa:aa..aa:aaaa]/example.com</PortalCustomHostname>
  </WebAdminSettings>
</AdminSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|HTTPSport|Yes |4444 |Description:|
||||HTTPS Port for secured Web Admin Console access.|
||||HTTPSport confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 65535 is allowed.|
||||Maximum digits allowed are 5.|
|UserPortalHTTPSPort|Yes |4443 |Description:|
||||User Portal HTTPS Port for secured Web Admin Console access.|
||||UserPortalHTTPSPort confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 65535 is allowed.|
||||Maximum digits allowed are 5.|
|Certificate|Yes | |Description:|
||||Certificate to be used by MyAccount and Captive Portal.|
||||Certificate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|PortalRedirectMode|No | |Description:|
||||Mode to use for hostname in Captive Portal, etc.|
||||PortalRedirectMode confines to:|
||||Type is 'SCALAR'.|
||||Maximum characters allowed are 6.|
||||Only 'ip', 'fqdn', 'custom' are allowed.|
|PortalCustomHostname|No | |Description:|
||||Hostname to use for Captive Portal, etc. when custom hostname is enabled.|
||||PortalCustomHostname confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|VPNPortalHTTPSPort|Yes |443 |Description:|
||||HTTPS port for secure access to VPN portal.|
||||VPNPortalHTTPSPort confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 65535 is allowed.|
||||Maximum digits allowed are 5.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Web Admin Settings|200|Admin console setting has been updated successfully|
|Web Admin Settings|500|Admin console setting update failed|
|Web Admin Settings|541|Service is already configured on the specified port, choose another HTTP port|
|Web Admin Settings|542|The admin console port is already in use. Enter a different port number.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
