# SSLTunnelAccessSettings

- Operation: Configure SSLVPN Tunnel Access
- Description: To configure SSL VPN Tunnel Access mode for providing remote access to the users.

## Sample Configuration

``` xml
<SSLTunnelAccessSettings>
    <Protocol>UDP/TCP</Protocol>
    <SSLServerCertificate>ApplianceCertificate</SSLServerCertificate>
    <OverrideHostName>Text</OverrideHostName>
    <Port>Number</Port>
    <IPLeaseRange>
        <StartIP>ip</StartIP>
        <EndIP>ip</EndIP>
    </IPLeaseRange>
    <SubnetMask>255.255.255.0</SubnetMask>
    <IPv6Lease />
    <IPv6Prefix />
    <LeaseMode>IPv4/IPv4 and IPv6</LeaseMode>
    <PrimaryDNSIPv4>ip</PrimaryDNSIPv4>
    <SecondaryDNSIPv4>ip</SecondaryDNSIPv4>
    <PrimaryWINSIPv4>ip</PrimaryWINSIPv4>
    <SecondaryWINSIPv4>ip</SecondaryWINSIPv4>
    <DomainName>Text</DomainName>
    <DisconnectDeadPeerAfter>180</DisconnectDeadPeerAfter>
    <DisconnectIdlePeerAfter>15</DisconnectIdlePeerAfter>
    <EncryptionAlgorithm>AES-256-GCM/AES-192-GCM/AES-128-GCM/AES-256-CBC/AES-192-CBC/AES-128-CBC/DES-EDE3-CBC/BF-CBC</EncryptionAlgorithm>
    <AuthenticationAlgorithm>SHA1/SHA256/SHA384/SHA512/MD5</AuthenticationAlgorithm>
    <Keysize>1024bit/2048bit</Keysize>
    <KeyLifetime>Number</KeyLifetime>
    <CompressSSLVPNTraffic>Enable/Disable</CompressSSLVPNTraffic>
    <DebugMode>Enable/Disable</DebugMode>
    <SecurityHeartbeat>Enable/Disable</SecurityHeartbeat>
    <SaveCredential>Enable/Disable</SaveCredential>
    <TwoFAToken>Enable/Disable</TwoFAToken>
    <AdLogon>Enable/Disable</AdLogon>
    <AutoConnect>Enable/Disable</AutoConnect>
    <HostorDNSName>FQDN name</HostorDNSName>
    <StaticIPAddresses>Enable/Disable</StaticIPAddresses>
</SSLTunnelAccessSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Protocol|Yes | |Description:|
||||Select protocol to be used for SSL VPN connection from the available options: TCP or UDP.|
||||Protocol confines to:|
||||Type is 'SCALAR'.|
||||Only 'TCP', 'UDP' are allowed.|
|SSLServerCertificate|Yes | |Description:|
||||Select SSL Server Certificate to be used for Authentication.|
||||SSLServerCertificate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|StartIP|Yes | |Description:|
||||Specify starting IP Address of the range from which IP Address is leased to SSL VPN Clients.|
||||StartIP confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|SubnetMask|Yes | |Description:|
||||Specify Subnet mask.|
||||SubnetMask confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|IPv6Lease|Yes | |Description:|
||||Used to set IPv6 address for interface in IPv6 Configuration.|
||||IPv6Lease confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS6'.|
||||Maximum characters allowed are 45.|
|IPv6Prefix|Yes | |Description:|
||||Used to set Prefix for IPv6 Configuration.|
||||IPv6Prefix confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 64 to 112 is allowed.|
||||Maximum digits allowed are 3.|
|LeaseMode|Yes | |Description:|
||||Select Lease Mode.|
||||LeaseMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'IPv4 and IPv6', 'IPv4' are allowed.|
|PrimaryDNSIPv4|No | |Description:|
||||Specify Primary DNS Server IP Address.|
||||PrimaryDNSIPv4 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|SecondaryDNSIPv4|No | |Description:|
||||Specify Secondary DNS Server IP Address.|
||||SecondaryDNSIPv4 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|PrimaryWINSIPv4|No | |Description:|
||||Specify Primary WINS Server IP Address.|
||||PrimaryWINSIPv4 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|SecondaryWINSIPv4|No | |Description:|
||||Specify Secondary WINS Server IP Address.|
||||SecondaryWINSIPv4 confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
|DisconnectDeadPeerAfter|No |300 |Description:|
||||Specify time in seconds after which connection must be disconnected, if peer is not live.|
||||DisconnectDeadPeerAfter confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 60 to 1800 is allowed.|
|DisconnectIdlePeerAfter|No |15 |Description:|
||||Specify user inactivity time in minutes after which the connection will be dropped.|
||||DisconnectIdlePeerAfter confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 15 to 360 is allowed.|
|EncryptionAlgorithm|No | |Description:|
||||Select Encryption Algorithm to be userd for Authentication.|
||||EncryptionAlgorithm confines to:|
||||Type is 'SCALAR'.|
||||Only 'AES-256-GCM', 'AES-192-GCM', 'AES-128-GCM', 'AES-256-CBC', 'AES-192-CBC', 'AES-128-CBC', 'DES-EDE3-CBC', 'BF-CBC' are allowed.|
|AuthenticationAlgorithm|No | |Description:|
||||Select Authentication Algorithm to be userd for Authentication.|
||||AuthenticationAlgorithm confines to:|
||||Type is 'SCALAR'.|
||||Only 'SHA1', 'SHA256', 'SHA384', 'SHA512', 'MD5' are allowed.|
|Keysize|No | |Description:|
||||Specify the key size from the dropdown list.|
||||Keysize confines to:|
||||Type is 'SCALAR'.|
||||Only '1024bit', '2048bit' are allowed.|
|KeyLifetime|No | |Description:|
||||Specify the key life time.|
||||KeyLifetime confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 60 to 86400 is allowed.|
|DebugMode|No | |Description:|
||||Enable/Disable Debugging mode.|
||||DebugMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|OverrideHostName|No | |Description:|
||||Specify the override hostname.|
||||OverrideHostName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DomainName|No | |Description:|
||||Specify the domain name.|
||||DomainName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Port|No | |Description:|
||||Specify the SSL VPN port|
||||Port confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 65535 is allowed.|
|SecurityHeartbeat|No |Disable |Description:|
||||Sends the endpoint's Security Heartbeat through the tunnel.|
||||SecurityHeartbeat confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|SaveCredential|No |Disable |Description:|
||||Allows users to save their username and password.|
||||SaveCredential confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|TwoFAToken|No |Disable |Description:|
||||Requires users to enter a one-time password to establish the tunnel.|
||||TwoFAToken confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|AdLogon|No |Disable |Description:|
||||Runs the Active Directory sign-in script after connecting the tunnel.|
||||AdLogon confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|AutoConnect|No |Disable |Description:|
||||Connects the tunnel automatically.|
||||AutoConnect confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|HostorDNSName|No | |Description:|
||||Checks if the hostname or the domain name can be reached when the tunnel connects automatically.|
||||HostorDNSName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|StaticIPAddresses|No | |Description:|
||||Turn the static IP address option on or off.|
||||StaticIPAddresses confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Configure SSLVPN Tunnel Access|200|SSL VPN global configuration has been updated successfully|
|Configure SSLVPN Tunnel Access|500|SSL VPN global configuration could not be updated|
|Configure SSLVPN Tunnel Access|541|Certificate cannot be selected as client certificate|
|Configure SSLVPN Tunnel Access|542|Network with the same IP address as start lease IP already exists, choose a different IP address|
|Configure SSLVPN Tunnel Access|543|Network conflict by end lease IP|
|Configure SSLVPN Tunnel Access|544|Not a valid IP lease range|
|Configure SSLVPN Tunnel Access|547|Couldn't update the remote access SSL VPN. The local certificate isn't FIPS-compliant|
|Configure SSLVPN Tunnel Access|548|The SSL server certificate uses MD5. It must use a stronger algorithm.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
