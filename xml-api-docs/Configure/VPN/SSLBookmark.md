# SSLBookmark

- Operation: Add SSLVPN Bookmark / Edit SSLVPN Bookmark
- Description: To Add/Edit SSL VPN Bookmark for accessing Bookmarks through End-user Web Portal.

## Sample Configuration

``` xml
<SSLBookmark>
    <Name>bookmarkname</Name>
    <Type>HTTP/HTTPS/RDP/TELNET/SSH/FTP/FTPS/SFTP/SMB/VNC</Type>
    <URL>url</URL>
    <ShareSession>Enable/Disable</ShareSession>
    <Description>Text</Description>
    <AutoLogin>Enable/Disable</AutoLogin>
    <!-- if AutoLogin is Enable -->
    <UserName />
    <Password />
    <!--	HTTP/HTTPS	-->
    <RefferredDomains>
        <Domains>domainname</Domains>
        :
    </RefferredDomains>
    <Port>Number</Port>
    <!--	RDP	-->
    <Domain>domainname</Domain>
    <Port>Number</Port>
    <ProtocolSecurity>RDP/TLS/NLA</ProtocolSecurity> <!-- IF NLA then Autologin Must Be Enable -->
    <!--	TELNET	-->
    <Port>Number</Port>
    <!--	SSH	-->
    <Port>Number</Port>
    <PrivateKey>Text</PrivateKey>	<!-- IF AutoLogin Enable Then Either Password Or Private Key -->
    <PublicHostKey>Text</PublicHostKey>
    <!--	FTP	-->
    <Port>Number</Port>
    <InitRemoteFolder>Text</InitRemoteFolder>
    <!--	FTPS	-->
    <Port>Number</Port>
    <InitRemoteFolder>Text</InitRemoteFolder>
    <PublicHostKey>Text</PublicHostKey>
    <!--	SFTP	-->
    <Port>Number</Port>
    <InitRemoteFolder>Text</InitRemoteFolder>
    <PublicHostKey>Text</PublicHostKey>
    <PrivateKey />	<!-- IF AutoLogin Enable Then Either Password Or Private Key -->
    <!--	SMB	-->
    <Port>Number</Port>
    <InitRemoteFolder>Text</InitRemoteFolder>
    <Domain />
    <!-- VNC -->
    <Port>Number</Port>
</SSLBookmark>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name for Bookmark.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|Description|No | |Description:|
||||Specify a bookmark description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Private Key|Yes | |Description:|
||||Enter Private Key.|
||||Private Key confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|URL|Yes | |Description:|
||||Specify the URL of the website for which the bookmark is to be created.|
||||URL confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed characters: (A-Za-z0-9-_.)|
||||Maximum characters allowed are 250.|
|ShareSession|No | |Description:|
||||Enable the share session.|
||||ShareSession confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|AutoLogin|No | |Description:|
||||Enable the automatic login.|
||||AutoLogin confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|UserName|Yes | |Description:|
||||Specify a username for the bookmark.|
||||UserName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Password|No | |Description:|
||||Specify a password for the bookmark.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Protocol Security|No | |Description:|
||||Select Protocol Security.|
||||Protocol Security confines to:|
||||Type is 'SCALAR'.|
||||Only 'RDP', 'TLS', 'NLA' are allowed.|
|Type|Yes | |Description:|
||||Select the type of Bookmark.|
||||Type confines to:|
||||Type is 'SCALAR'.|
||||Only 'HTTPS', 'HTTP', 'RDP', 'TELNET', 'SSH', 'FTP', 'FTPS', 'SFTP', 'SMB', 'VNC' are allowed.|
|Init Remote Folder|No | |Description:|
||||If Bookmark type selected is FTP, FTPS, SFTP or SMB, Specify the remote directory path.|
||||Init Remote Folder confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 250.|
|Port|No | |Description:|
||||If Bookmark type selected is TELNET, Specify Port number on which TELNET Service is running.|
||||Port confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Allowed port range: 1 to 65535|
||||Maximum digits allowed are 5.|
|Domains|No | |Description:|
||||If Bookmark type selected is RDP, Specify the domain name on remote machine.|
||||Domains confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Public Host Key|Yes | |Description:|
||||Enter Public Host Key.|
||||Public Host Key confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Domains|No | |Description:|
||||Specify set of Domain(s)/URL(s) to render Bookmarked URL appropriately.|
||||Domains confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||String must start with HTTP:// or HTTPS://. Other characters: (A-Za-z). To separate letters, use a dot (.) or dash (-). To separate the port number, use a colon (:). Allowed port range: 0 to 99999|
||||Multiple values are allowed.|
||||Duplicate values will be ignored.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add SSLVPN Bookmark|200|Bookmark "\<DynamicValue>" has been added successfully|
|Add SSLVPN Bookmark|500|Bookmark "\<DynamicValue>" could not be added|
|Add SSLVPN Bookmark|502|Bookmark could not be added. Bookmark name "\<DynamicValue>" or bookmark URL: "\<DynamicValue>" already exists. Choose a different name or URL|
|Edit SSLVPN Bookmark|200|Bookmark "\<DynamicValue>" has been updated successfully|
|Edit SSLVPN Bookmark|500|Bookmark "\<DynamicValue>" could not be updated|
|Edit SSLVPN Bookmark|502|Bookmark could not be added. Bookmark name "\<DynamicValue>" or bookmark URL: "\<DynamicValue>" already exists. Choose a different name or URL|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
