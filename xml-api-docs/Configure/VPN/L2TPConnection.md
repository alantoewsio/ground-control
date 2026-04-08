# L2TPConnection

- Operation: Add L2TP Connection / Edit L2TP Connection
- Description: To Add/Edit L2TP Connection.

## Sample Configuration

``` xml
<L2TPConnection>
    <Configuration>
        <Name>Name</Name>
        <Description>Text</Description>
        <Policy>DefaultRemoteAccess</Policy>
        <ActionOnVPNRestart>RespondOnly/Disable</ActionOnVPNRestart>
        <AuthenticationType>PresharedKey/DigitalCertificate</AuthenticationType>
        <!-- If type presharedkey -->
        <PresharedKey>key</PresharedKey>
        <!-- if type certificate -->
        <LocalCertificate>ApplianceCertificate</LocalCertificate>

        <LocalWANPort>PortB</LocalWANPort>
        <!-- For alias wan port -->
        <AliasLocalWANPort>PortB:0</AliasLocalWANPort>
        <LocalIDType>DNS/IP Address/Email/DER ASN1 DN (X.509)</LocalIDType>
        <LocalID>localid</LocalID>
        <RemoteHost>hostname or ipaddress</RemoteHost>
        <AllowNATTraversal>Enable/Disable</AllowNATTraversal>
        <RemoteLANNetwork>
            <Network>Host</Network>
            :
        </RemoteLANNetwork>
        <RemoteIDType>DNS/IP Address/Email/DER ASN1 DN (X.509)</RemoteIDType>
        <RemoteID>remoteid</RemoteID>
        <LocalPort>1701</LocalPort>
        <RemotePort>*</RemotePort>
        <DisconnectOnIdleInterval>600</DisconnectOnIdleInterval>
    </Configuration>
    <Connection><Name>connectionname</Name></Connection>
    <DisConnection><Name>connectionname</Name></DisConnection>
    <Active><Name>connectionname</Name></Active>
    <DeActive><Name>connectionname</Name></DeActive>
</L2TPConnection>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name for L2TP Connection.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed first characters: (A-Za-z). For other characters: (A-Za-z0-9_)|
||||Maximum characters allowed are 50.|
|Description|No | |Description:|
||||Specify description for L2TP Connection.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|Policy|Yes | |Description:|
||||Select Policy to use for L2TP Connection from the available options: Default Policy, DefaultHeadOffice, DefaultRemoteAccess, AES128_MD5, DefaultBranchOffice or DefaultL2TP.|
||||Policy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ActionOnVPNRestart|Yes | |Description:|
||||Select an action for the Connection from the available options: Disable or Respond Only.|
||||ActionOnVPNRestart confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'RespondOnly' are allowed.|
|AuthenticationType|Yes | |Description:|
||||Select Authentication type from the available options: Preshared key or Digital Certificate.|
||||AuthenticationType confines to:|
||||Type is 'SCALAR'.|
||||Only 'PresharedKey', 'DigitalCertificate' are allowed.|
|PresharedKey/LocalCertificate|Yes | |Description:|
||||If Authentication Type is selected as Preshared Key, specify Preshared Key value.|
||||PresharedKey/LocalCertificate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed characters: (A-Za-z0-9_@\-\.)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|Local Certificate|Yes | |Description:|
||||If Authentication Type is selected as Local Certificate, select certificate to be used.|
||||Local Certificate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AliasLocalWANPort|Yes | |Description:|
||||Select Local WAN Port for L2TP Connection.|
||||AliasLocalWANPort confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|LocalIDType|No | |Description:|
||||Select Local ID type for Preshared Key.|
||||LocalIDType confines to:|
||||Type is 'SCALAR'.|
||||Only 'DNS', 'IP Address', 'Email', 'DER ASN1 DN (X.509)' are allowed.|
|LocalID|Yes | |Description:|
||||Specify the Local ID value for L2TP Connection.|
||||LocalID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|RemoteHost|Yes | |Description:|
||||Specify IP Address of remote Host.|
||||RemoteHost confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed IPv4 address range: (0-255.0-255.0-255.0-255). To specify any IPv4 address, use an asterisk (*).|
|AllowNATTraversal|No |Enable |Description:|
||||Enable NAT Traversal if remote host has Private IP Address.|
||||AllowNATTraversal confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Network|Yes | |Description:|
||||Select Remote LAN Network.|
||||Network confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Not allowed for first character: (# ,). Not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|
|RemoteIDType|No | |Description:|
||||Select Remote ID type for Preshared Key.|
||||RemoteIDType confines to:|
||||Type is 'SCALAR'.|
||||Only 'DNS', 'IP Address', 'Email', 'DER ASN1 DN (X.509)' are allowed.|
|RemoteID|Yes | |Description:|
||||Specify the Remote ID value.|
||||RemoteID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|LocalPort|Yes | |Description:|
||||Specify Local Port number.|
||||LocalPort confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed port range: (1 to 65535). To specify any port, use an asterisk (*).|
||||Maximum characters allowed are 5.|
|RemotePort|Yes | |Description:|
||||Specify Remote Port number.|
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
||||Range 120 to 999 is allowed.|
||||Maximum digits allowed are 3.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add L2TP Connection|200|L2TP connection "\<DynamicValue>" has been added successfully|
|Add L2TP Connection|201|L2TP connection "\<DynamicValue>" has been added successfully. The modification will be applicable only when L2TP is enabled|
|Add L2TP Connection|500|L2TP connection "\<DynamicValue>" could not be added|
|Add L2TP Connection|502|Enter a different name. An L2TP or IPsec connection with the name exists.|
|Add L2TP Connection|505|L2TP connection "\<DynamicValue>" could not be rewritten|
|Add L2TP Connection|508|Certificate invalid.|
|Add L2TP Connection|541|Preshared key mismatch. All the connections shared between endpoints must have the same preshared key|
|Add L2TP Connection|550|Couldn't update the remote access L2TP VPN. The local certificate isn't FIPS-compliant.|
|Edit L2TP Connection|200|L2TP connection "\<DynamicValue>" has been updated successfully|
|Edit L2TP Connection|201|L2TP connection "\<DynamicValue>" has been updated successfully. The modification will be applicable only when L2TP is enabled|
|Edit L2TP Connection|500|L2TP connection "\<DynamicValue>" could not be updated|
|Edit L2TP Connection|502|Enter a different name. An L2TP or IPsec connection with the name exists.|
|Edit L2TP Connection|503|L2TP connection "\<DynamicValue>" has a network conflict|
|Edit L2TP Connection|505|L2TP connection "\<DynamicValue>" could not be rewritten|
|Edit L2TP Connection|508|Certificate invalid.|
|Edit L2TP Connection|541|Preshared key mismatch. All the connections shared between endpoints must have the same preshared key|
|Edit L2TP Connection|550|Couldn't update the remote access L2TP VPN. The local certificate isn't FIPS-compliant.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
