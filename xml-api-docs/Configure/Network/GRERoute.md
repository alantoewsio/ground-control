# GRERoute

- Operation: Add and delete GRE route
- Description: To add or delete a GRE route.

## Sample Configuration

``` xml
<GreRoute>
    <Host>12.26.3.0</Host>
    <Netmask>255.255.255.0</Netmask>
    <TunnelName>gre0345</TunnelName>
</GreRoute>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|OPERATION|No | |Description:|
||||Enter 'add' or 'delete' for the GRE route|
||||OPERATION confines to:|
||||Type is 'SCALAR'.|
||||Only 'add', 'del' are allowed.|
|Tunnel Name|Yes | |Description:|
||||Enter the tunnel name|
||||Tunnel Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||To separate words, use a space.|
|Netmask|No | |Description:|
||||Enter the netmask of the destination host/network|
||||Netmask confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Host|No | |Description:|
||||Enter the destination host IP address|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add and delete GRE route|200|GRE route has been added successfully|
|Add and delete GRE route|500|GRE route could not be added|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
