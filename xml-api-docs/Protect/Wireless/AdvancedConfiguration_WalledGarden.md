# AdvancedConfiguration_WalledGarden

- Operation: Hotspot Walled Garden
- Description: To configure Hotspot Walled Garden.

## Sample Configuration

``` xml
<AdvancedConfiguration>
    <WalledGarden>
        <AllowedNetworks>IPHost/IPHostGroup/MACHost/FQDNHost/FQDNHostGroup/CountryGroup/Country</AllowedNetworks>
        :
    </WalledGarden>
</AdvancedConfiguration>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|AllowedNetworks|No||Description:|
||||Add or select specific hosts or networks to be always accessible by all users, without entering a password or a voucher code.|
||||AllowedNetworks confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Hotspot Walled Garden|200|Walled garden updated successfully|
|Hotspot Walled Garden|500|Walled garden could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
