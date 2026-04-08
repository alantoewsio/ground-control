# WirelessGrouping

- Operation: Add an Access Point Group / Update an Access Point Group
- Description: To Add/Update an Access Point Group.

## Sample Configuration

``` xml
<WirelessGrouping>
    <Name>wlgroup</Name>
    <WirelessNetworks>
        <Network>wlnet1</Network>
        <Network>wlnet2</Network>
    </WirelessNetworks>
    <VLANTagging>Enable</VLANTagging>
    <APVLANID>15</APVLANID>
    <AccessPoints>
        <AccessPoint>AP30[A40016ADB63B7F1]</AccessPoint>
    </AccessPoints>
</WirelessGrouping>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Enter a descriptive name for the new access point group.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Network|No||Description:|
||||Select the wireless networks that should be broadcasted by the access points of this group.|
||||Network confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|VLANTagging|No|Disable|Description:|
||||Enable or Disable to activate or deactivate VLAN Tagging.|
||||VLANTagging confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|APVLANID|No||Description:|
||||Enter a VLAN ID.|
||||APVLANID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 4094 is allowed.|
||||Maximum digits allowed are 4.|
||||Note:|
||||Applicable only if 'VLAN Tagging' is Enabled.|
|AccessPoint|No||Description:|
||||Select access points which you want to add to this group.|
||||AccessPoint confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add an Access Point Group|200|Group "\<DynamicValue>" has been created successfully|
|Add an Access Point Group|500|Group "\<DynamicValue>" could not be added|
|Add an Access Point Group|502|Group "\<DynamicValue>" could not be created. Group with the same name already exists|
|Add an Access Point Group|523|Group "\<DynamicValue>" could not be created. The group uses more than 8 wireless networks|
|Add an Access Point Group|216|Group "\<DynamicValue>" has been created successfully|
|Add an Access Point Group|541|Group "\<DynamicValue>" could not be added|
|Add an Access Point Group|524|Group "\<DynamicValue>" could not be created. A maximum of 8 wireless networks per access point is supported|
|Add an Access Point Group|543|Group "\<DynamicValue>" could not be added|
|Add an Access Point Group|545|Group "\<DynamicValue>" could not be added|
|Add an Access Point Group|546|Can't assign wireless networks with security mode set to WPA3 to access points.|
|Update an Access Point Group|200|Group "\<DynamicValue>" has been updated successfully|
|Update an Access Point Group|500|Group "\<DynamicValue>" could not be updated|
|Update an Access Point Group|523|Group "\<DynamicValue>" could not be updated. The group uses more than 8 wireless networks|
|Update an Access Point Group|216|Group "\<DynamicValue>" has been updated successfully|
|Update an Access Point Group|541|Group "\<DynamicValue>" could not be updated|
|Update an Access Point Group|524|Group "\<DynamicValue>" could not be updated. A maximum of 8 wireless networks per access point is supported|
|Update an Access Point Group|543|Group "\<DynamicValue>" could not be updated|
|Update an Access Point Group|545|Group "\<DynamicValue>" could not be updated|
|Update an Access Point Group|546|Can't assign wireless networks with security mode set to WPA3 to access points.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
