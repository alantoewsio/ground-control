# PPTPConfiguration

- Operation: Configure PPTP
- Description: Configure PPTP for tunneling PPTP traffic between VPN peers.

## Sample Configuration

``` xml
<PPTPConfiguration>
    <Configuration>
        <PPTPGeneralSettings>Enable/Disable</PPTPGeneralSettings>
        <AssignIPFrom>
            <StartIP>ip</StartIP>
            <EndIP>ip</EndIP>
        </AssignIPFrom>
        <LeaseIPFromRadiusServer>Enable/Disable</LeaseIPFromRadiusServer>
        <PrimaryDNSServer>ip</PrimaryDNSServer>
        <SecondaryDNSServer>ip</SecondaryDNSServer>
        <PrimaryWINSServer>ip</PrimaryWINSServer>
        <SecondaryWINSServer>ip</SecondaryWINSServer>
    </Configuration>
    <PPTPMembers>
    <!-- add and Remove Members-->
        <UserName>admin</UserName>
        :
    </PPTPMembers>
</PPTPConfiguration>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|PPTPGeneralSettings|No |Disable |Description:|
||||Enable PPTP.|
||||PPTPGeneralSettings confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|StartIP|Yes | |Description:|
||||Specify starting IP Address of range, if PPTP Server is leasing address.|
||||StartIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|EndIP|Yes | |Description:|
||||Specify ending IP Address of range, if PPTP Server is leasing address.|
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
|Configure PPTP|200|PPTP connection configuration has been updated successfully|
|Configure PPTP|500|PPTP connection configuration could not be updated|
|Configure PPTP|541|IP address range could not be added. One or more IP address(s) already configured for L2TP|
|Configure PPTP|542|Failed to configure the PPTP. IP address range is not valid|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
