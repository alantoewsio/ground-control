# TrustedMAC

- Operation: Add Trusted MAC / Update Trusted MAC
- Description: To Create/Update Trusted MAC list which filters the devices that can access network.

## Sample Configuration

``` xml
<TrustedMAC>
    <!-- Either manual addition or using file import -->
    <MACAddress>macaddress</MACAddress>
    <AssociateIP>ip address</AssociateIP>
    <IPV4Association>None/Static/DHCP</IPV4Association>
    <IPV4Address>IPAddress</IPV4Address>
    <IPV6Association>None/Static/DHCP</IPV6Association>
    <IPV6Address>IPAddress</IPV6Address>
    <OldConfiguration>
        <MACAddress>macaddress</MACAddress>
    </OldConfiguration>
</TrustedMAC>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|MACAddress|Yes||Description:|
||||Specify MAC Address to be added to the Trusted MAC List.|
||||MACAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'MACADDRESS'.|
||||Maximum characters allowed are 17.|
|IPV4Association|No|Static|Description:|
||||Select IP Association type for binding IPv4 Address to MAC Address.|
||||IPV4Association confines to:|
||||Type is 'SCALAR'.|
||||Only 'Static', 'DHCP', 'None' are allowed.|
|IPV4Address|No||Description:|
||||Specify IPv4 Address for IP-MAC binding.|
||||IPV4Address confines to:|
||||Type is 'CSV'.|
||||Datatype is 'IPADDRESS'.|
||||Comma separated values are allowed.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|IPV6Address|No||Description:|
||||Specify IPv6 Address for IP-MAC binding.|
||||IPV6Address confines to:|
||||Type is 'CSV'.|
||||Datatype is 'IPADDRESS6'.|
||||Comma separated values are allowed.|
||||Maximum characters allowed are 39.|
||||IP Class other than 'MULTICAST', 'LOCALHOST', 'UNSPECIFIED' is allowed.|
|IPV6Association|No|Static|Description:|
||||Select IP Association type for binding IPv6 Address to MAC Address.|
||||IPV6Association confines to:|
||||Type is 'SCALAR'.|
||||Only 'Static', 'DHCP', 'None' are allowed.|
|AssociateIP|No||Description:|
||||Enable/Disable IP Association.|
||||AssociateIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Trusted MAC|200|Operation Successful|
|Add Trusted MAC|500|Operation Fail|
|Update Trusted MAC|200|Operation Successful|
|Update Trusted MAC|500|Operation Fail|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
