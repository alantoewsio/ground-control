# DHCPServerIpv6

- Operation: Add IPv6 DHCP Server / Edit IPv6 DHCP Server
- Description: This json is used to add IPv6 DHCP Server. This json is used to update IPv6 DHCP Server.

## Sample Configuration

``` xml
<DHCPServerIpv6>
    <Name>Name</Name>
    <Interface>PortA</Interface>
    <IPLease>
        <IP>StartIPAddress-EndIPAddress</IP>
        :
    </IPLease>
    <StaticLease>
        <Lease>
            <HostName>host</HostName>
            <DUID>duid</DUID>
            <IPAddress>ip</IPAddress>
        </Lease>
        :
    </StaticLease>
    <UseApplianceDNSSettings>Enable</UseApplianceDNSSettings>
    <PreferredTime>540</PreferredTime>
    <ValidTime>720</ValidTime>
    <PrimaryDNSServer>DNSIPAddress</PrimaryDNSServer>
    <SecondaryDNSServer>DNSIPAddress</SecondaryDNSServer>
    <DHCPOption>
        <Options>
            <OptionName>name</OptionName>
            <OptionType>type</OptionType>
            <OptionCode>code</OptionCode>
            <OptionValue>value</OptionValue>
        </Options>
        :
    </DHCPOption>
</DHCPServerIpv6>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify name for DHCP Server.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|Interface|No | |Description:|
||||Select interface on which DHCP Service is to be configured.|
||||Interface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Lease IP Range|No | |Description:|
||||Specify IP Address range from which DHCP Server will assign addresses to the clients.|
||||Lease IP Range confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 105.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
||||IP Class other than 'MULTICAST', 'LOCALHOST', 'UNSPECIFIED', 'LINKLOCAL' is allowed.|
|Host Name|No | |Description:|
||||Specify host name if lease type selected is 'Static' where specific IP addresses are assigned to the clients.|
||||Host Name confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
||||Multiple values are allowed.|
|DUID|No | |Description:|
||||Specify 'duid'|
||||DUID confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 72.|
||||Multiple values are allowed.|
|IP Address|No | |Description:|
||||Specify IP Address for MAC-IP mapping for 'Static' lease type.|
||||IP Address confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'IPADDRESS6'.|
||||Maximum characters allowed are 51.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
||||IP Class other than 'MULTICAST', 'LOCALHOST', 'UNSPECIFIED', 'LINKLOCAL' is allowed.|
|preferredtime|Yes | |Description:|
||||Specify preferred time.|
||||preferredtime confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 43200 is allowed.|
||||Maximum digits allowed are 5.|
|validtime|Yes | |Description:|
||||Specify valid time.|
||||validtime confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 43200 is allowed.|
||||Maximum digits allowed are 5.|
|Use Appliance's DNS Settings|No | |Description:|
||||Specify Enable/Disable for Appliance's DNS Settings|
||||Use Appliance's DNS Settings confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|
|primarydnsv6|No | |Description:|
||||Provide Primary DNS Server IP Address if appliance DNS Server is not to be used.|
||||primarydnsv6 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS6'.|
||||Maximum characters allowed are 51.|
||||IP Class other than 'MULTICAST', 'UNSPECIFIED', 'LINKLOCAL' is allowed.|
|secondarydnsv6|No | |Description:|
||||Provide Secondary DNS Server IP Address if appliance DNS Server is not be used.|
||||secondarydnsv6 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS6'.|
||||Maximum characters allowed are 51.|
||||IP Class other than 'MULTICAST', 'UNSPECIFIED', 'LINKLOCAL' is allowed.|
|LeaseForRelay|No | |Description:|
||||Select this to enable the DHCP server to accept client requests from DCHP Relay. The DHCP server assigns IP addresses to clients which are not in the network of the selected interface. In this case, the address range defined above has to be within the network where relayed DHCP requests are forwarded from, and not within the network of the selected interface.|
||||LeaseForRelay confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|OptionType|No | |Description:|
||||Type of value for the DHCP option you specify.|
||||OptionType confines to:|
||||Type is 'ARRAY'.|
||||Only 'boolean', 'string', 'one', 'two', 'four', 'arr_one', 'arr_two', 'arr_four', 'ipv6addr', 'arr_ipv6addr', 'fqdn' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|OptionCode|No | |Description:|
||||Code for the DHCP option.|
||||OptionCode confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 65535 is allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|OptionName|No | |Description:|
||||DHCP option that you specify.|
||||OptionName confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|OptionValue|No | |Description:|
||||Values for the DHCP option.|
||||OptionValue confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add IPv6 DHCP Server|200|DHCP server configuration has been added successfully|
|Add IPv6 DHCP Server|500|DHCP server configuration could not be added|
|Add IPv6 DHCP Server|502|DHCP server with the same name already exists. Please choose a different name|
|Add IPv6 DHCP Server|504|Added the DHCP server configuration. Couldn't add one or more DHCP options.|
|Add IPv6 DHCP Server|542|DHCP server cannot be configured for WAN subnet|
|Add IPv6 DHCP Server|541|DHCP configuration with the same hostname/MAC address/DUID address already exists, choose a different hostname/MAC address/DUID address|
|Add IPv6 DHCP Server|543|Interface IP cannot be configured as "DHCP lease IP"|
|Add IPv6 DHCP Server|545|Leased IP range with the same IP addresses already assigned for this interface. Choose different IP addresses|
|Add IPv6 DHCP Server|544|Lease IP range is not within the subnet range of the selected interface|
|Add IPv6 DHCP Server|547|The IP lease range should be from the same subnet|
|Edit IPv6 DHCP Server|200|DHCP server configuration has been updated successfully|
|Edit IPv6 DHCP Server|500|DHCP server configuration could not be updated|
|Edit IPv6 DHCP Server|504|Updated the DHCP server configuration. Couldn't add one or more DHCP options.|
|Edit IPv6 DHCP Server|541|DHCP configuration with the same hostname/MAC address/DUID address already exists, choose a different hostname/MAC address/DUID address|
|Edit IPv6 DHCP Server|542|DHCP server cannot be configured for WAN subnet|
|Edit IPv6 DHCP Server|543|Interface IP cannot be configured as "DHCP lease IP"|
|Edit IPv6 DHCP Server|544|Lease IP range is not within the subnet range of the selected interface|
|Edit IPv6 DHCP Server|545|Leased IP range with the same IP addresses already assigned for this interface. Choose different IP addresses|
|Edit IPv6 DHCP Server|547|The IP lease range should be from the same subnet|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
