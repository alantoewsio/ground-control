# SiteToSiteClient

- Operation: Add SSLVPN Client Connection / Edit SSLVPN Client Connection
- Description: To Add/Edit SSLVPN Client Connection.

## Sample Configuration

``` xml
<SiteToSiteClient>
    <Name>test</Name>
    <ServerConfigurationFile>{file upload in .apc or .epc format}</ServerConfigurationFile>
    <FilePassword>alphanumeric</FilePassword>
    <HttpProxyServer>Enable/Disable</HttpProxyServer>
    <!-- If HttpProxyServer is Enable -->
        <ProxyServer>ProxyServerName</ProxyServer>
        <ProxyPort>PortNumber</ProxyPort>
        <ProxyAuthentication>Enable/Disable</ProxyAuthentication>
        <!-- If ProxyAuthentication is Enable -->
        <Username>username</Username>
        <Password>password</Password>
    <PeerHost>Enable/Disable</PeerHost>
    <!-- If PeerHost is Enable -->
        <HostName>HostName</HostName>
    <Description>text</Description>
    <Status>On/Off</Status>
</SiteToSiteClient>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Connection Name|Yes | |Description:|
||||Enter a descriptive name for the connection.|
||||Connection Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|Description|No | |Description:|
||||Enter a description or other information.|
|Configuration File|Yes | |Description:|
||||Click the 'Browse...' icon to browse for the client configuration file. The file has to be in .apc or .epc format.|
||||Configuration File confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Password|No | |Description:|
||||If the file has been encrypted, enter the password.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
|Use HTTP Proxy Server|No | |Description:|
||||Enable/Disable to use HTTP as proxy server.|
||||Use HTTP Proxy Server confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Proxy Server|Yes | |Description:|
||||Select or add a proxy server.|
||||Proxy Server confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Proxy Port|Yes | |Description:|
||||Enter a proxy port.|
||||Proxy Port confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|Proxy Requires Authentication|No |OFF |Description:|
||||Enable if the client needs to authenticate against the proxy.|
||||Proxy Requires Authentication confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Username|No | |Description:|
||||Enter a username to authenticate against the proxy.|
||||Username confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
|Password|No | |Description:|
||||Enter a password to authenticate against the proxy.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
|Override Peer Hostname|No |Disable |Description:|
||||Enable/Disable to override peer hostname.|
||||Override Peer Hostname confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Hostname|Yes |Disable |Description:|
||||Enter a hostname if the server system's regular hostname cannot be resolved from the client host.|
||||Hostname confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Status|No | |Description:|
||||Status.|
||||Status confines to:|
||||Type is 'SCALAR'.|
||||Only 'Off', 'On' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add SSLVPN Client Connection|200|SSL client connection has been created successfully.|
|Add SSLVPN Client Connection|500|SSL client connection could not be created.|
|Add SSLVPN Client Connection|502|SSL client connection could not be created. SSL client connection with the same name as "\<DynamicValue>" already exists, choose a different name.|
|Add SSLVPN Client Connection|503|Couldn't add the site-to-site SSL VPN client connection. The configuration file isn't FIPS-compliant. Make sure the firewall with the SSL VPN server configuration is FIPS-compliant.|
|Edit SSLVPN Client Connection|200|SSL client connection has been updated successfully.|
|Edit SSLVPN Client Connection|500|SSL client connection could not be updated.|
|Edit SSLVPN Client Connection|503|Couldn't update the site-to-site SSL VPN client connection. The configuration file isn't FIPS-compliant. Make sure the firewall with the SSL VPN server configuration is FIPS-compliant.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
