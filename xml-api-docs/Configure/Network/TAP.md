# TAP

- Operation: Configure TAP interface
- Description: To configure TAP interface

## Sample Configuration

``` xml
<TAP>
    <Hardware>interfacename</Hardware>
    <InterfaceSpeed>Auto Negotiate/10MbpsHD/10MbpsFD/100MbpsHD/100MbpsFD/1000MbpsHD/1000MbpsFD/5000MbpsFD/10000MbpsFD/20GbpsFD/25GbpsFD/40GbpsFD/50GbpsFD/56GbpsFD/100GbpsFD</InterfaceSpeed>
    <AutoNegotiation>Enable/Disable</AutoNegotiation>
    <FEC>Off/Automatic/BaseR-encoding/RS-FEC-encoding</FEC>
</TAP>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ACTION|Yes | |Description:|
||||Enter 'add' or 'delete' for the TAP interface|
||||ACTION confines to:|
||||Type is 'SCALAR'.|
||||Only 'add', 'delete', 'show' are allowed.|
|Hardware|No | |Description:|
||||Name of the TAP interface on the device.|
||||Hardware confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|InterfaceSpeed|No |Auto Negotiate |Description:|
||||Sets the interface speed for the TAP interface.|
||||InterfaceSpeed confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AutoNegotiation|No |1 |Description:|
||||Turns on auto-negotiation for connection parameters other than link speed and duplex.|
||||AutoNegotiation confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 1 is allowed.|
|FEC|No |off |Description:|
||||Forward error correction|
||||FEC confines to:|
||||Type is 'SCALAR'.|
||||Only 'Automatic', 'Off', 'BaseR-encoding', 'RS-FEC-encoding' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Configure TAP interface|200|TAP interface has been configured successfully|
|Configure TAP interface|500|TAP interface could not be configured|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
