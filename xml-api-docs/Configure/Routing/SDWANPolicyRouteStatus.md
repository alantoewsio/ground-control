# SDWANPolicyRouteStatus

- Operation: Policy Route status change
- Description: To turn on or turn off SD-WAN policy route.

## Sample Configuration

``` xml
<SDWANPolicyRouteStatus>
    <SDWANPolicyRouteName>{SDWANPolicyRouteName}</SDWANPolicyRouteName>
    <Status>ON/OFF</Status>
</SDWANPolicyRouteStatus>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|SDWANPolicyRouteName|Yes | |Description:|
||||Specify a name for the SD-WAN policy route.|
||||SDWANPolicyRouteName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Status|Yes | |Description:|
||||Turn on or turn off SD-WAN policy route.|
||||Status confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Policy Route status change|200|Operation Successful.|
|Policy Route status change|500|Operation Fail.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
