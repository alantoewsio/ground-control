# VPNIPSecConnection

- Operation: Add Failover Group IPSEC Connection / Edit IPSEC Connection
- Description: To Create/Edit IPSEC Connection for secure VPN communication at the IP Layer.To edit IPSec connections.

## Sample Configuration

``` xml
<VPNIPSecConnection>
    <Configuration>
        <Name>name</Name>
        <Description>Text</Description>
        <ConnectionType>RemoteAccess/SiteToSite/HostToHost</ConnectionType>
        <Policy>DefaultRemoteAccess</Policy>
        <ActionOnVPNRestart>Disable/RespondOnly/Initiate</ActionOnVPNRestart>
        <AuthenticationType>PresharedKey/DigitalCertificate/RSAKey</AuthenticationType>

        <!-- For preshared Key -->
        <PresharedKey>key</PresharedKey>

        <!-- For Certificate -->
        <LocalCertificate>ApplianceCertificate</LocalCertificate>
        <RemoteCertificate>ExternalCertificate</RemoteCertificate>

        <!-- For Network Detail IP Family -->
        <SubnetFamily>IPv4/IPv6</SubnetFamily>

        <!-- For Endpoint Detail IP Family -->
        <EndpointFamily>IPv4/IPv6</EndpointFamily>

        <!-- For RSA Key -->
        <RemoteRSAKey>Text</RemoteRSAKey>
        <LocalWANPort>PortB</LocalWANPort>
        <!-- For alias wan port -->
        <AliasLocalWANPort>PortB:0</AliasLocalWANPort>
        <RemoteHost>Host</RemoteHost>
        <LocalSubnet>Host</LocalSubnet>

        <!-- only for site-to-site -->
        <NATedLAN>Host</NATedLAN>
        <LocalIDType>DNS/IP Address/Email/DER ASN1 DN (X.509)</LocalIDType>
        <LocalID>localid</LocalID>

        <!-- only for RemoteAccess & Host-to-Host -->
        <AllowNATTraversal>Enable/Disable</AllowNATTraversal>
        <RemoteNetwork>
            <Network>Network</Network>
        </RemoteNetwork>
        <RemoteIDType>DNS/IP Address/Email/DER ASN1 DN (X.509)</RemoteIDType>
        <RemoteID>remoteid</RemoteID>
        <UserAuthenticationMode>Disable/AsServer/AsClient</UserAuthenticationMode>

        <!-- for AsClient -->
        <Username>username</Username>
        <Password>password</Password>

        <!-- for AsServer -->
        <AllowedUser>
            <User>username</User>
            :
        </AllowedUser>
        <Protocol>ALL/UDP/TCP/ICMP</Protocol>
        <LocalPort>Number</LocalPort>
        <RemotePort>Number</RemotePort>
        <DisconnectOnIdleInterval>600</DisconnectOnIdleInterval>
        <Status>Active/Deactive</Status>
    </Configuration>
 <!-- these four tags will work only after the connection is created-->
    <Active><Name>connectionname</Name></Active>
    <DeActive><Name>connectionname</Name></DeActive>
    <Connection><Name>connectionname</Name></Connection>
    <DisConnection><Name>connectionname</Name></DisConnection>
</VPNIPSecConnection>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name to identify IPSec connection.|
||||Name confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Allowed first characters: (A-Za-z). For other characters: (A-Za-z0-9_)|
||||Maximum characters allowed are 100.|
||||Multiple values are allowed.|
|Description|No | |Description:|
||||Specify description for the IPSEC connection.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|ConnectionType|Yes | |Description:|
||||Select Connection type for VPN IPSEC connection from the available options: Remote Access, Site to Site or Host to Host.|
||||ConnectionType confines to:|
||||Type is 'SCALAR'.|
||||Only 'RemoteAccess', 'SiteToSite', 'HostToHost', 'TunnelInterface' are allowed.|
|Policy|Yes | |Description:|
||||Select Policy to be used for connection from the available options: Default Policy, DefaultHeadOffice, DefaultRemoteAccess, AES128_MD5, DefaultBranchOffice or DefaultL2TP.|
||||Policy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ActionOnVPNRestart|No | |Description:|
||||Select action to be taken when VPN Services restarts from the available options: Disable or Respond Only.|
||||ActionOnVPNRestart confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'RespondOnly', 'Initiate' are allowed.|
|AuthenticationType|No | |Description:|
||||Select Authentication type based on the Connection type.|
||||AuthenticationType confines to:|
||||Type is 'SCALAR'.|
||||Only 'PresharedKey', 'DigitalCertificate', 'RSAKey' are allowed.|
|PresharedKey/LocalCertificate|Yes | |Description:|
||||Specify Preshared key or Select Local Certificate to be used by Appliance for authentication based on the Authentication type selected.|
||||PresharedKey/LocalCertificate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 64.|
||||Minimum characters allowed are 5.|
|RemoteCertificate/RemoteRSAKey|No | |Description:|
||||Select Remote Certificate or Specify RSA Key to be used by remote peer for authentication based on the Authentication type selected.|
||||RemoteCertificate/RemoteRSAKey confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Note:|
||||This options are available if Connection type selected is Site-to-Site or Host-to-Host..|
|AliasLocalWANPort|Yes | |Description:|
||||Select local WAN port from the list.|
||||AliasLocalWANPort confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|RemoteHost|Yes | |Description:|
||||Specify IP Address/Domain name of the remote peer.|
||||RemoteHost confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
||||If Authentication type is 'RSAKey' then character (*) is not allowed.|
|Failover Group Name|Yes | |Description:|
||||Specify a name for Failover Group.|
||||Failover Group Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed first characters: (A-Za-z). For other characters: (A-Za-z0-9_)|
|Failover Mail Notification|No | |Description:|
||||Enable to trigger Email notifications to Administrator at failover events.|
||||Failover Mail Notification confines to:|
||||Type is 'SCALAR'.|
||||Only 'y', 'n' are allowed.|
|Protocol|No | |Description:|
||||Select Protocol.|
||||Protocol confines to:|
||||Type is 'ARRAY'.|
||||Only 'ping', 'tcp', '' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Port|No | |Description:|
||||Select Port.|
||||Port confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Allowed numbers: 1 to 65535.|
|LocalSubnet|No | |Description:|
||||Select Local LAN subnet.|
||||LocalSubnet confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|
||||Duplicate values will be ignored.|
|NATedLAN|No | |Description:|
||||If NAT Local LAN is selected for Site-to-Site Connection type, select IP Host or Network Host from the list.|
||||NATedLAN confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Not allowed for first character: (# ,). Not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|LocalIDType|Yes | |Description:|
||||Select ID type for Preshared Key and RSA Key.|
||||LocalIDType confines to:|
||||Type is 'SCALAR'.|
||||Only 'DNS', 'IP Address', 'Email', 'DER ASN1 DN (X.509)' are allowed.|
|LocalID|Yes | |Description:|
||||Specify the value as per selected Local ID type.|
||||LocalID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AllowNATTraversal|No | |Description:|
||||Enable NAT Traversal if a NAT device is located between VPN end points.|
||||AllowNATTraversal confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|RemoteIDType|Yes | |Description:|
||||Select Remote ID type.|
||||RemoteIDType confines to:|
||||Type is 'SCALAR'.|
||||Only 'DNS', 'IP Address', 'Email', 'DER ASN1 DN (X.509)' are allowed.|
|RemoteID|Yes | |Description:|
||||Specify the value as per selected Remote ID type.|
||||RemoteID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|UserAuthenticationMode|No | |Description:|
||||Select mode for User Authentication if required at time of connection.|
||||UserAuthenticationMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'EnableAsClient', 'EnableAsServer' are allowed.|
|Username|Yes | |Description:|
||||Specify Username if User Authentication mode is enabled as Client.|
||||Username confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|Password|No | |Description:|
||||Specify Password if User Authentication mode is enabled as Client.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|User|No | |Description:|
||||Add all the users which are allowed to connect if authentication mode is enabled as Server.|
||||User confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 256.|
||||Multiple values are allowed.|
||||Duplicate values will be ignored.|
|Protocol|No | |Description:|
||||Select Protocol to be allowed for negotiations.|
||||Protocol confines to:|
||||Type is 'SCALAR'.|
||||Only 'ALL', 'ICMP', 'UDP', 'TCP' are allowed.|
|LocalPort|Yes | |Description:|
||||Specify local port number that local VPN peer will use to transport traffic.|
||||LocalPort confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed port range: (1 to 65535). To specify any port, use an asterisk (*).|
||||Maximum characters allowed are 5.|
|RemotePort|Yes | |Description:|
||||Specify remote port number that remote VPN peer will use to transport traffic.|
||||RemotePort confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed port range: (1 to 65535). To specify any port, use an asterisk (*).|
||||Maximum characters allowed are 5.|
|DisconnectOnIdleInterval|No |0 |Description:|
||||Disconnect on idle interval.|
||||DisconnectOnIdleInterval confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 120 to 21600 is allowed.|
||||Maximum digits allowed are 5.|
|ActivateOnSave|No | |Description:|
||||Choose if the connection should be activated right after save.|
||||ActivateOnSave confines to:|
||||Type is 'SCALAR'.|
||||Only 'y', 'n' are allowed.|
|Local IP Address|No | |Description:|
||||Local IP Address for Interface Binding.|
||||Local IP Address confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|Bind with Interface|No | |Description:|
||||Enable or Disable Selection for Interface Binding.|
||||Bind with Interface confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|Remote IP Address|No | |Description:|
||||Remote IP Address for Interface Binding.|
||||Remote IP Address confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|SubnetFamily|No | |Description:|
||||IP Family Selection for Network Detail.|
||||SubnetFamily confines to:|
||||Type is 'SCALAR'.|
||||Only 'IPv4', 'IPv6', 'Dual' are allowed.|
|Network|No | |Description:|
||||Specify the remote LAN network.|
||||Network confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Failover Group IPSEC Connection|200|Failover group with defined connections added successfully|
|Add Failover Group IPSEC Connection|500|Operation failed. An error occurred during the operation|
|Add Failover Group IPSEC Connection|502|Failed to create the connection. Failover group name "\<DynamicValue>" already exists|
|Add Failover Group IPSEC Connection|503|Failed to create the connection. Local subnet and remote LAN network must be different|
|Add Failover Group IPSEC Connection|504|Connection name(s) already exists. Choose another name|
|Add Failover Group IPSEC Connection|541|Failed to create the connection. All the connections with authentication type "Preshared key" between a pair of endpoints must have same preshared keys|
|Add Failover Group IPSEC Connection|542|Multiple connections with same endpoints but different preshared keys exist. You must modify preshared keys to be the same|
|Add Failover Group IPSEC Connection|543|Failed to save the configuration for connection(s). An error occurred while saving the configuration|
|Add Failover Group IPSEC Connection|544|Failed to save the configuration for connection "\<DynamicValue>". An error occurred while saving the failover configuration|
|Add Failover Group IPSEC Connection|545|Interfaces configured in WAN zone can only be selected for local endpoint.|
|Add Failover Group IPSEC Connection|546|Preshared key must have at least 5 characters.|
|Add Failover Group IPSEC Connection|506|Couldn't add the IPsec connection. The local certificate isn't FIPS-compliant.|
|Add Failover Group IPSEC Connection|508|Certificate invalid.|
|Add Failover Group IPSEC Connection|510|Couldn't add the IPsec connection. The remote certificate isn't FIPS-compliant.|
|Add Failover Group IPSEC Connection|511|Couldn't add the IPsec connection. The remote RSA key isn't FIPS-compliant.|
|Add Failover Group IPSEC Connection|549|Can't change local and remote subnets from Any-Any to specific subnets. For more details, see the help.|
|Edit IPSEC Connection|200|IPsec connection "\<DynamicValue>}" has been updated successfully|
|Edit IPSEC Connection|201|IPsec connection "\<DynamicValue>}" has been updated successfully|
|Edit IPSEC Connection|500|IPsec connection "\<DynamicValue>}" could not be updated|
|Edit IPSEC Connection|502|Enter a different name. An L2TP or IPsec connection with the name exists.|
|Edit IPSEC Connection|503|IPsec connection "\<DynamicValue>}": network conflict|
|Edit IPSEC Connection|505|IPsec connection "\<DynamicValue>}" could not be rewritten|
|Edit IPSEC Connection|545|Interfaces configured in WAN zone can only be selected for local endpoint.|
|Edit IPSEC Connection|546|Preshared key must have at least 5 characters.|
|Edit IPSEC Connection|506|Couldn't add the IPsec connection. The local certificate isn't FIPS-compliant.|
|Edit IPSEC Connection|508|Certificate invalid.|
|Edit IPSEC Connection|510|Couldn't add the IPsec connection. The remote certificate isn't FIPS-compliant.|
|Edit IPSEC Connection|511|Couldn't add the IPsec connection. The remote RSA key isn't FIPS-compliant.|
|Edit IPSEC Connection|549|Can't change local and remote subnets from Any-Any to specific subnets. For more details, see the help.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
