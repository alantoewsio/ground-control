# SpoofPrevention

- Operation: Configure Spoof Prevention
- Description: To configure Spoof Prevention by using MAC Address filtering.

## Sample Configuration

``` xml
<SpoofPrevention>
    <SpoofPrevention>Enable/Disable</SpoofPrevention>
    <RestrictUnknownIPOnTrustedMAC>Enable/Disable</RestrictUnknownIPOnTrustedMAC>
    <IPSpoofing>
        <EnableOnZone>
            <Zone>zonename</Zone>
        </EnableOnZone>
    </IPSpoofing>
    <MACFilter>
        <EnableOnZone>
            <Zone>zonename</Zone>
        </EnableOnZone>
    </MACFilter>
    <IPMACFilter>
        <EnableOnZone>
            <Zone>zonename</Zone>
        </EnableOnZone>
    </IPMACFilter>
</SpoofPrevention>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|SpoofPrevention|No|Disable|Description:|
||||Enable Spoof Prevention.|
||||SpoofPrevention confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|RestrictUnknownIPOnTrustedMAC|No||Description:|
||||Enable to drop traffic from any IP Address not in the list of trusted MAC Addresses.|
||||RestrictUnknownIPOnTrustedMAC confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Zone|Yes||Description:|
||||Enable Spoof Prevention against required zones.|
||||Zone confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Note:|
||||To disable the entire configuration, specify value as 'Disable' in tag.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Configure Spoof Prevention|200|Spoof prevention settings have been applied successfully|
|Configure Spoof Prevention|500|Spoof prevention settings could not be applied|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
