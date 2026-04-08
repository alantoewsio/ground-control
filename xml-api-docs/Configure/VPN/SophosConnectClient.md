# SophosConnectClient

- Operation: Configure Sophos Connect VPN Client
- Description: To Configure connection for Sophos Connect VPN client.

## Sample Configuration

``` xml
<SophosConnectClient>
    <SophosConnectClientConfiguration>Enable/Disable</SophosConnectClientConfiguration>
    <Name>connectionname</Name>
    <Interface>interfacename</Interface>
    <!-- For alias wan port -->
    <AliasInterface>alias interfacename</AliasInterface>
    <PolicyID>policyname</PolicyID>
    <AuthenticationType>PresharedKey/DigitalCertificate</AuthenticationType>
    <!-- for preshared key -->
    <PresharedKey>key</PresharedKey>
    <!-- for Certificate -->
    <LocalCertificate>{certificatename}</LocalCertificate>
    <RemoteCertificate>{certificatename}</RemoteCertificate>

    <LocalIDType>DNS/IP Address/Email/DER ASN1 DN (X.509)</LocalIDType>
    <LocalID>localid</LocalID>
    <RemoteIDType>DNS/IP Address/Email/DER ASN1 DN (X.509)</RemoteIDType>
    <RemoteID>remoteid</RemoteID>

    <AllowedUsers>
        <User>username</User>
        :
    </AllowedUsers>
    <AssignIP>
        <StartIP>ip address</StartIP>
        <EndIP>ip address</EndIP>
    </AssignIP>
    <LeaseIPFromRadiusServer>Enable/Disable</LeaseIPFromRadiusServer>
    <DNSServer1>ip address</DNSServer1>
    <DNSServer2>ip address</DNSServer2>
    <DisconnectOnIdleInterval>600</DisconnectOnIdleInterval>
    <SecurityHeartbeat>Enable/Disable</SecurityHeartbeat>
    <SaveCredential>Enable/Disable</SaveCredential>
    <TwoFAToken>Enable/Disable</TwoFAToken>
    <AdLogon>Enable/Disable</AdLogon>
    <AutoConnect>Enable/Disable</AutoConnect>
    <HostorDNSName>FQDN name</HostorDNSName>
    <AssignDNS>Enable/Disable</AssignDNS>
    <DomainName>Domain suffix</DomainName>
    <DefaultGateway>Enable/Disable</DefaultGateway>
    <PermittedNetworkResourcesIPv4>
            <Resource>Host1</Resource>
            <Resource>Host2</Resource>
            :
            :
    </PermittedNetworkResourcesIPv4>
</SophosConnectClient>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|SophosConnectClientConfiguration|No |Disable |Description:|
||||Configure Sophos Connect client information.|
||||SophosConnectClientConfiguration confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|AliasInterface|Yes | |Description:|
||||Select interface from the list of WAN ports on which user will connect VPN.|
||||AliasInterface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AuthenticationType|Yes | |Description:|
||||Select Authentication type for the Sophos Connect VPN Client.|
||||AuthenticationType confines to:|
||||Type is 'SCALAR'.|
||||Only 'PresharedKey', 'DigitalCertificate' are allowed.|
|PresharedKey|No | |Description:|
||||Specify Preshared key or Select Local Certificate to be used by Appliance for authentication based on the Authentication type selected.|
||||PresharedKey confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 1000.|
|RemoteCertificate|No | |Description:|
||||Select Certificate to be used for authentication by the remote peer.|
||||RemoteCertificate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|LocalIDType|Yes | |Description:|
||||Select Local ID type.|
||||LocalIDType confines to:|
||||Type is 'SCALAR'.|
||||Only 'DNS', 'IP Address', 'Email', 'DER ASN1 DN (X.509)' are allowed.|
|LocalID|Yes | |Description:|
||||Specify value for Local ID selected.|
||||LocalID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|RemoteIDType|Yes | |Description:|
||||Select Remote ID type.|
||||RemoteIDType confines to:|
||||Type is 'SCALAR'.|
||||Only 'DNS', 'IP Address', 'Email', 'DER ASN1 DN (X.509)' are allowed.|
|RemoteID|Yes | |Description:|
||||Specify value for Remote ID selected.|
||||RemoteID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|User|No | |Description:|
||||Specify users to be allowed to connect to Sophos Connect VPN Client.|
||||User confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 256.|
||||Multiple values are allowed.|
|Name|Yes | |Description:|
||||Specify client's name to be displayed.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed first characters: (A-Za-z). For other characters: (A-Za-z0-9_)|
|StartIP|Yes | |Description:|
||||Specify the starting IP Address for the range from which IP Address is leased to the Client.|
||||StartIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|EndIP|Yes | |Description:|
||||Specify the ending IP Address for the range from which IP Address is leased to the Client.|
||||EndIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|DNSServer1|No | |Description:|
||||Provide DNS Server IP Address.|
||||DNSServer1 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|DNSServer2|No | |Description:|
||||Provide Second DNS Server IP Address.|
||||DNSServer2 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|PolicyID|Yes | |Description:|
||||Specify value for policy ID selected.|
||||PolicyID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Resource|No | |Description:|
||||Allows the remote user to access these internal network resources.|
||||Resource confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|
||||Duplicate values will be ignored.|
||||Note:|
||||Only IPv4 hosts are allowed.|
|LeaseIPFromRadiusServer|No |Disable |Description:|
||||Enable to lease IP Address through the Radius Server.|
||||LeaseIPFromRadiusServer confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|DisconnectOnIdleInterval|No |0 |Description:|
||||Disconnect on idle interval.|
||||DisconnectOnIdleInterval confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 120 to 21600 is allowed.|
||||Maximum digits allowed are 5.|
|SecurityHeartbeat|No |Disable |Description:|
||||Sends the endpoint's Security Heartbeat through the tunnel.|
||||SecurityHeartbeat confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|SaveCredential|No |Disable |Description:|
||||Allows users to save their username and password.|
||||SaveCredential confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|TwoFAToken|No |Disable |Description:|
||||Requires users to enter a one-time password to establish the tunnel.|
||||TwoFAToken confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|AdLogon|No |Disable |Description:|
||||Runs the Active Directory sign-in script after connecting the tunnel.|
||||AdLogon confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|AutoConnect|No |Disable |Description:|
||||Connects the tunnel automatically.|
||||AutoConnect confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|HostorDNSName|No | |Description:|
||||Checks if the hostname or the domain name can be reached when the tunnel connects automatically.|
||||HostorDNSName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|AssignDNS|No |Disable |Description:|
||||Allows you to assign a DNS suffix.|
||||AssignDNS confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|DomainName|No | |Description:|
||||Domain name to use after the connection is established.|
||||DomainName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|DefaultGateway|No |Enable |Description:|
||||Uses the tunnel as the default gateway for the remote user after the connection is established.|
||||DefaultGateway confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Configure Sophos Connect VPN Client|200|Activated remote access IPsec VPN.|
|Configure Sophos Connect VPN Client|201|Updated remote access IPsec VPN.|
|Configure Sophos Connect VPN Client|500|Couldn't update remote access IPsec VPN.|
|Configure Sophos Connect VPN Client|502|Enter a different name. An L2TP or IPsec connection with the name exists.|
|Configure Sophos Connect VPN Client|503|IPsec connection "\<DynamicValue>": network conflict|
|Configure Sophos Connect VPN Client|508|Certificate invalid.|
|Configure Sophos Connect VPN Client|511|Couldn't activate remote access IPsec VPN.|
|Configure Sophos Connect VPN Client|512|IPsec connection "\<DynamicValue>" could not be rewritten|
|Configure Sophos Connect VPN Client|541|Preshared key mismatch. All the connections shared between endpoints must have the same preshared key|
|Configure Sophos Connect VPN Client|550|Couldn't update the remote access IPsec VPN. The local certificate isn't FIPS-compliant.|
|Configure Sophos Connect VPN Client|551|Couldn't update the remote access IPsec VPN. The remote certificate isn't FIPS-compliant.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
