# DNS

- Operation: DNS List
- Description: To configure Domain Name System(DNS). DNS translates domain names to IP addresses.

## Sample Configuration

``` xml
<DNS>
    <IPv4Settings>
        <ObtainDNSFrom>DHCP/PPPoE/Static</ObtainDNSFrom>
        <DNSIPList><!--This tag should be used only when <ObtainDNSFrom>has value "Static"	-->
            <DNS1>ipaddress</DNS1>
            <DNS2>ipaddress</DNS2>
            <DNS3>ipaddress</DNS3>
        </DNSIPList>
    </IPv4Settings>
    <IPv6Settings>
        <ObtainDNSFrom>DHCP/Static</ObtainDNSFrom>
        <DNSIPList><!--This tag should be used only when <ObtainDNSFrom>has value "Static"	-->
            <DNS1>ipaddress</DNS1>
            <DNS2>ipaddress</DNS2>
            <DNS3>ipaddress</DNS3>
        </DNSIPList>
    </IPv6Settings>
    <DNSQueryConfiguration>ChooseServerBasedOnIncomingRequestsRecordType/ChooseIPv6DNSServerOverIPv4/ChooseIPv4DNSServerOverIPv6/ChooseIPv6IfRequestOriginatorAddressIsIPv6,ElseIPv4</DNSQueryConfiguration>
</DNS>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ObtainDNSFrom|No | |Description:|
||||Click to override the appliance DNS with the DNS address received from DHCP Server or PPPoE Server.|
||||ObtainDNSFrom confines to:|
||||Type is 'SCALAR'.|
||||Only 'Static', 'DHCP', 'PPPoE' are allowed.|
|DNS1|No | |Description:|
||||Click to provide Static DNS Address 1.|
||||DNS1 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|DNS2|No | |Description:|
||||Click to provide Static DNS Address 2.|
||||DNS2 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|DNS3|No | |Description:|
||||Click to provide Static DNS Address 3.|
||||DNS3 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|DNS1 (IPv6)|No | |Description:|
||||Provide IPv6 DNS Server Address 1.|
||||DNS1 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS6'.|
||||IP Class other than 'MULTICAST', 'UNSPECIFIED', 'LINKLOCAL' is allowed.|
|DNS2 (IPv6)|No | |Description:|
||||Provide IPv6 DNS Server Address 2.|
||||DNS2 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS6'.|
||||IP Class other than 'MULTICAST', 'UNSPECIFIED', 'LINKLOCAL' is allowed.|
|DNS3 (IPv6)|No | |Description:|
||||Provide IPv6 DNS Server Address 3.|
||||DNS3 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS6'.|
||||IP Class other than 'MULTICAST', 'UNSPECIFIED', 'LINKLOCAL' is allowed.|
|DNSQueryConfiguration|No | |Description:|
||||Select to choose the DNS Server to be used for resolving domain names.|
||||DNSQueryConfiguration confines to:|
||||Type is 'SCALAR'.|
||||Only 'ChooseServerBasedOnIncomingRequestsRecordType', 'ChooseIPv6DNSServerOverIPv4', 'ChooseIPv4DNSServerOverIPv6', 'ChooseIPv6IfRequestOriginatorAddressIsIPv6,ElseIPv4' are allowed.|
|ObtainDNSFrom (IPv6)|No | |Description:|
||||Click to override the appliance DNSv6 with the DNSv6 address received from DHCP6 Server.|
||||ObtainDNSFrom confines to:|
||||Type is 'SCALAR'.|
||||Only 'Static', 'DHCP' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|DNS List|200|DNS configuration has been applied successfully|
|DNS List|500|DNS configuration could not be applied|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
