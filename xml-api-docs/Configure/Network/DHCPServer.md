# DHCPServer

- Operation: Add IPv4 DHCP Server / Edit IPv4 DHCP Server
- Description: To Add/Update IPv4 DHCP Server.

## Sample Configuration

``` xml
<DHCPServer>
    <Name>Name</Name>
    <Interface>PortA</Interface>
    <UseInterfaceIPasGateway>UseInterfaceIPAsGateway/ANY</UseInterfaceIPasGateway>
    <IPLease>
        <IP>StartIPAddress-EndIPAddress</IP>
        :
    </IPLease>
    <ConflictDetection>Disable</ConflictDetection>
    <StaticLease>
        <Lease>
            <HostName>host</HostName>
            <MACAddress>mac</MACAddress>
            <IPAddress>ip</IPAddress>
        </Lease>
        :
    </StaticLease>
    <!-- for IPV4 only-->
    <SubnetMask>128.0.0.0</SubnetMask>
    <DomainName>name</DomainName>
    <Gateway>{IPAddress}</Gateway>
    <DefaultLeaseTime>1440</DefaultLeaseTime>
    <MaxLeaseTime>2880</MaxLeaseTime>
    <ConflictDetection>Enable/Disable</ConflictDetection>
    <UseApplianceDNSSettings>Enable</UseApplianceDNSSettings>
    <!-- Use this tag when above tag has value disabled -->
    <PrimaryDNSServer>DNSIPAddress</PrimaryDNSServer>
    <SecondaryDNSServer>DNSIPAddress</SecondaryDNSServer>
    <PrimaryWINSServer>ipaddress</PrimaryWINSServer>
    <SecondaryWINSServer>ipaddress</SecondaryWINSServer>
    <BootServer />
    <BootFile />
    <DHCPOption>
        <Options>
            <OptionName>name</OptionName>
            <OptionType>type</OptionType>
            <OptionCode>code</OptionCode>
            <OptionValue>value</OptionValue>
        </Options>
        :
    </DHCPOption>
</DHCPServer>
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
|IP|No | |Description:|
||||Specify IP Address range from which DHCP Server will assign addresses to the clients.|
||||IP confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
||||Multiple values are allowed.|
||||Note:|
||||This option is available if the lease type selected is 'Dynamic'.|
|HostName|No | |Description:|
||||Specify host name if lease type selected is 'Static' where specific IP addresses are assigned to the clients.|
||||HostName confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|MACAddress|No | |Description:|
||||Specify MAC Address for defining MAC-IP mapping if lease type is 'Static'.|
||||MACAddress confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'MACADDRESS'.|
||||Maximum characters allowed are 17.|
||||Multiple values are allowed.|
|IPAddress|No | |Description:|
||||Specify IP Address for MAC-IP mapping for 'Static' lease type.|
||||IPAddress confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|SubnetMask|Yes | |Description:|
||||Select the Subnet mask for the Server.|
||||SubnetMask confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|UseInterfaceIPasGateway|No |Disable |Description:|
||||Select to use interface IP as gateway.|
||||UseInterfaceIPasGateway confines to:|
||||Type is 'SCALAR'.|
||||Only 'UseInterfaceIPAsGateway' are allowed.|
|Gateway|Yes | |Description:|
||||Specify IP Address for default gateway, if Use Interface IP as Gateway is not selected.|
||||Gateway confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|DefaultLeaseTime|Yes |1440 |Description:|
||||Specify Default Lease Time in minutes.|
||||DefaultLeaseTime confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 43200 is allowed.|
||||Maximum digits allowed are 5.|
|MaxLeaseTime|Yes |2880 |Description:|
||||Specify Maximum Lease Time in minutes after which DHCP Clients must ask Server for new settings.|
||||MaxLeaseTime confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 43200 is allowed.|
||||Maximum digits allowed are 5.|
|UseApplianceDNSSettings|No |Enable |Description:|
||||Enable to use Appliance DNS Settings.|
||||UseApplianceDNSSettings confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|
|PrimaryDNSServer|No | |Description:|
||||Provide Primary DNS Server IP Address if appliance DNS Server is not to be used.|
||||PrimaryDNSServer confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|SecondaryDNSServer|No | |Description:|
||||Provide Secondary DNS Server IP Address if appliance DNS Server is not be used.|
||||SecondaryDNSServer confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|PrimaryWINSServer|No | |Description:|
||||Specify IP Address of Primary WINS Server.|
||||PrimaryWINSServer confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|SecondaryWINSServer|No | |Description:|
||||Specify IP Address of Secondary WINS Server.|
||||SecondaryWINSServer confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|ConflictDetection|No | |Description:|
||||Enable to check IP before leasing to avoid leasing out repetitive IP addresses.|
||||ConflictDetection confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|
|LeaseForRelay|No | |Description:|
||||Select this to enable the DHCP server to accept client requests from DCHP Relay. The DHCP server assigns IP addresses to clients which are not in the network of the selected interface. In this case, the address range defined above has to be within the network where relayed DHCP requests are forwarded from, and not within the network of the selected interface.|
||||LeaseForRelay confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|OptionType|No | |Description:|
||||Type of value for the DHCP option you specify.|
||||OptionType confines to:|
||||Type is 'ARRAY'.|
||||Only 'array-of', 'boolean', 'string', 'one', 'two', 'four', 'ipaddr', 'arr_one', 'arr_two', 'arr_four', 'ipv6addr', 'arr_ipaddr', 'arr_ipv6addr' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|OptionCode|No | |Description:|
||||Code for the DHCP option|
||||OptionCode confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 255 is allowed.|
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
|BootServer|No | |Description:|
||||IP address of the server with the boot file.|
||||BootServer confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||NOSEMICOMMA|
||||Maximum characters allowed are 1024.|
|BootFile|No | |Description:|
||||Full path with name of the boot file|
||||BootFile confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||NOSEMICOMMA|
||||Maximum characters allowed are 1024.|
|DomainName|No | |Description:|
||||Specify domain name which will be assigned to the DHCP Clients.|
||||DomainName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||To separate words, use a dot (.).|
||||Maximum characters allowed are 250.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add IPv4 DHCP Server|200|DHCP server configuration has been added successfully|
|Add IPv4 DHCP Server|500|DHCP server configuration could not be added|
|Add IPv4 DHCP Server|502|DHCP server configuration could not be added. DHCP server configuration already exists. Choose a different server|
|Add IPv4 DHCP Server|503|You cannot configure DHCP server. Selected interface is already configured in DHCP relay.|
|Add IPv4 DHCP Server|504|Added the DHCP server configuration. Couldn't add one or more DHCP options.|
|Add IPv4 DHCP Server|505|DHCP server configuration is in use|
|Add IPv4 DHCP Server|541|DHCP configuration with the same hostname/MAC address/DUID address already exists, choose a different hostname/MAC address/DUID address|
|Add IPv4 DHCP Server|542|DHCP server cannot be configured for WAN subnet|
|Add IPv4 DHCP Server|543|Interface IP cannot be configured as "DHCP lease IP"|
|Add IPv4 DHCP Server|544|Lease IP range is not within the subnet range of the selected interface|
|Add IPv4 DHCP Server|545|Leased IP range with the same IP addresses already assigned for this interface. Choose different IP addresses|
|Add IPv4 DHCP Server|546|Configured gateway IP address is not within the subnet range of "Lease IP"|
|Add IPv4 DHCP Server|547|Auxiliary interface IP cannot be configured as "DHCP lease IP"|
|Edit IPv4 DHCP Server|200|DHCP server configuration has been updated successfully|
|Edit IPv4 DHCP Server|500|DHCP server configuration could not be updated|
|Edit IPv4 DHCP Server|504|Updated the DHCP server configuration. Couldn't add one or more DHCP options.|
|Edit IPv4 DHCP Server|505|DHCP server configuration is in use|
|Edit IPv4 DHCP Server|541|DHCP configuration with the same hostname/MAC address/DUID address already exists, choose a different hostname/MAC address/DUID address|
|Edit IPv4 DHCP Server|542|DHCP server cannot be configured for WAN subnet|
|Edit IPv4 DHCP Server|543|Interface IP cannot be configured as "DHCP lease IP"|
|Edit IPv4 DHCP Server|544|Lease IP range is not within the subnet range of the selected interface|
|Edit IPv4 DHCP Server|545|Leased IP range with the same IP addresses already assigned for this interface. Choose different IP addresses|
|Edit IPv4 DHCP Server|546|Configured gateway IP address is not within the subnet range of "Lease IP"|
|Edit IPv4 DHCP Server|547|Auxiliary interface IP cannot be configured as "DHCP lease IP"|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
