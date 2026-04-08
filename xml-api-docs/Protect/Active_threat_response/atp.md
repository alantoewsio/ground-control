# ATP

- Operation: Sophos X-Ops threat feeds
- Description: To configure Sophos X-Ops threat feeds.

## Sample Configuration

``` xml
<ATP>
    <ThreatProtectionStatus>Enable/Disable</ThreatProtectionStatus>
    <Policy>alert/drop</Policy>
    <HostException>
        <Host>HostName</Host>
        :
    </HostException>
    <ThreatException>
        <Threat>Threat</Threat>
        :
    </ThreatException>
    <InspectContent>{all/untrusted}</InspectContent>
</ATP>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ThreatProtectionStatus|No | |Description:|
||||Enable/Disable Sophos X-Ops threat feeds.|
||||ThreatProtectionStatus confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Policy|Yes |Log Only |Description:|
||||Select the action that the Sophos X-Ops threat feeds should use if a threat has been detected.|
||||Policy confines to:|
||||Type is 'SCALAR'.|
||||Only 'Log Only', 'Log and Drop' are allowed.|
||||Note:|
||||Applicable only if 'Sophos X-Ops threat feeds' is enabled.|
|Host|No | |Description:|
||||Add or select the source networks or hosts that should be exempt from being scanned for threats by Active Threat Response.|
||||Host confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Note:|
||||Applicable for Sophos X-Ops, MDR and Third-party threat feeds.|
|Threat|No | |Description:|
||||Add destination IP addresses or domain names that you want to skip from being scanned for threats by Active Threat Response.|
||||Threat confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Note:|
||||Applicable for Sophos X-Ops, MDR and Third-party threat feeds.|
|InspectContent|No | |Description:|
||||Specify the settings to inspect content based on the trust status.|
||||InspectContent confines to:|
||||Type is 'SCALAR'.|
||||Only 'all', 'untrusted' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Sophos X-Ops threat feeds|200|Operation Successful.|
|Sophos X-Ops threat feeds|500|Operation Fail.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
