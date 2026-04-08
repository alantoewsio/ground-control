# WirelessNetworkStatus

- Operation: Enable-Disable Wireless Network
- Description: Enable or Disable Wireless Network.

## Sample Configuration

``` xml
<WirelessNetworkStatus>
    <Name>wlnet1</Name>
    <Status>Enable</Status>
</WirelessNetworkStatus>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Enter the name of Interface.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 10.|
|Status|Yes||Description:|
||||Select this to enable Access Point to broadcast wireless networks.|
||||Status confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Enable-Disable Wireless Network|200|Updated wireless network "\<DynamicValue>"|
|Enable-Disable Wireless Network|500|Couldn't update wireless network "\<DynamicValue>"|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
