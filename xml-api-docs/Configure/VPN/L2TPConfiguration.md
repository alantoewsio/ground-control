# L2TPConfiguration

- Operation: Configure L2TP
- Description: Configure L2TP for creating VPN tunnel over the Internet.

## Sample Configuration

``` xml
<L2TPConfiguration>
    <L2TPSettings>
        <L2TPGeneralSettings>Enable/Disable</L2TPGeneralSettings>
        <AssignIPFrom>
            <StartIP>ip</StartIP>
            <EndIP>ip</EndIP>
        </AssignIPFrom>
        <LeaseIPFromRadiusServer>Enable/Disable</LeaseIPFromRadiusServer>
        <PrimaryDNSServer>ip</PrimaryDNSServer>
        <SecondaryDNSServer>ip</SecondaryDNSServer>
        <PrimaryWINSServer>ip</PrimaryWINSServer>
        <SecondaryWINSServer>ip</SecondaryWINSServer>
    </L2TPSettings>
    <L2TPMembers>
    <!-- add and Remove Members-->
        <UserName>admin</UserName>
        :
    </L2TPMembers>
</L2TPConfiguration>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|L2TPGeneralSettings|No |Disable |Description:|
||||Show the general L2TP settings.|
||||L2TPGeneralSettings confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|StartIP|Yes | |Description:|
||||Specify starting IP Address of range, if L2TP Server is leasing address.|
||||StartIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|EndIP|Yes | |Description:|
||||Specify ending IP Address of range, if L2TP Server is leasing address.|
||||EndIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|LeaseIPFromRadiusServer|No |Disable |Description:|
||||Enable to lease IP Address through the Radius Server.|
||||LeaseIPFromRadiusServer confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|PrimaryDNSServer|Yes | |Description:|
||||Specify Primary DNS Server.|
||||PrimaryDNSServer confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|SecondaryDNSServer|No | |Description:|
||||Specify Secondary DNS Server.|
||||SecondaryDNSServer confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|PrimaryWINSServer|No | |Description:|
||||Specify Primary WINS Server.|
||||PrimaryWINSServer confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|SecondaryWINSServer|No | |Description:|
||||Specify Secondary WINS Server.|
||||SecondaryWINSServer confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Configure L2TP|200|L2TP configuration has been updated successfully|
|Configure L2TP|500|L2TP configuration could not be updated|
|Configure L2TP|541|IP address range could not be added. One or more IP address(s) already configured for PPTP|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
