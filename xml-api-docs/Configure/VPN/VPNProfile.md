# VPNProfile

- Operation: Add VPN Policy / Edit VPN Policy
- Description: To Create/Edit VPN Policy. VPN Policy describes the security parameters that are used for negotiations to establish a secure tunnel between two devices.To edit VPN Policy.

## Sample Configuration

``` xml
<VPNProfile>
    <Name>Name</Name>
    <Description>Text</Description>
    <KeyingMethod>Automatic/Manual</KeyingMethod>
    <AllowReKeying>Enable/Disable</AllowReKeying>
    <KeyNegotiationTries>3</KeyNegotiationTries>
    <AuthenticationMode>MainMode/AggressiveMode</AuthenticationMode>
    <PassDataInCompressedFormat>Enable/Disable</PassDataInCompressedFormat>
    <Phase1>
        <EncryptionAlgorithm1>DES</EncryptionAlgorithm1>
        <AuthenticationAlgorithm1>MD5</AuthenticationAlgorithm1>
        <!-- below mentioned are optional and for aggressivemode not required -->
        <EncryptionAlgorithm2>DES</EncryptionAlgorithm2>
        <AuthenticationAlgorithm2>MD5</AuthenticationAlgorithm2>
        <EncryptionAlgorithm3>DES</EncryptionAlgorithm3>
        <AuthenticationAlgorithm3>MD5</AuthenticationAlgorithm3>
        <SupportedDHGroups>
            <!-- Any from belowlist -->
            <DHGroup>1(DH768)</DHGroup>
            <DHGroup>2(DH1024)</DHGroup>
            <DHGroup>5(DH1536)</DHGroup>
            <DHGroup>14(DH2048)</DHGroup>
            <DHGroup>15(DH3072)</DHGroup>
            <DHGroup>16(DH4096)</DHGroup>
        </SupportedDHGroups>
        <KeyLife>3600 seconds</KeyLife>
        <ReKeyMargin>120</ReKeyMargin>
        <RandomizeRe-KeyingMarginBy>0</RandomizeRe-KeyingMarginBy>
        <DeadPeerDetection>Enable/Disable</DeadPeerDetection>
        <!-- if DeadPeerDetection is enable -->
        <CheckPeerAfterEvery>30</CheckPeerAfterEvery>
        <WaitForResponseUpto>120</WaitForResponseUpto>
        <ActionWhenPeerUnreachable>Disconnect/Hold/ReInitiate</ActionWhenPeerUnreachable>
    </Phase1>
    <Phase2>
        <EncryptionAlgorithm1>DES</EncryptionAlgorithm1>
        <AuthenticationAlgorithm1>MD5</AuthenticationAlgorithm1>
        <!-- below mentioned are optional and for aggressivemode not required -->
        <EncryptionAlgorithm2>DES</EncryptionAlgorithm2>
        <AuthenticationAlgorithm2>MD5</AuthenticationAlgorithm2>
        <EncryptionAlgorithm3>DES</EncryptionAlgorithm3>
        <AuthenticationAlgorithm3>MD5</AuthenticationAlgorithm3>

        <PFSGroup>SameAsPhase1/None/1(DH768)/...</PFSGroup>
        <KeyLife>3600 seconds</KeyLife>
    </Phase2>

    <!-- For Manual Keying -->
    <LocalSPI>hex</LocalSPI>
    <RemoteSPI>hex</RemoteSPI>
    <EncryptionAlgorithm>DES</EncryptionAlgorithm>
    <InboundEncryptionKey>key</InboundEncryptionKey>
    <OutboundEncryptionKey>key</OutboundEncryptionKey>
    <AuthenticationAlgorithm>MD5</AuthenticationAlgorithm>
    <InboundAuthenticationKey>key</InboundAuthenticationKey>
    <OutboundAuthenticationKey>key</OutboundAuthenticationKey>
</VPNProfile>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify VPN Policy name.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||To separate words, use a space.|
|Description|No | |Description:|
||||Specify description for VPN Policy.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|KeyingMethod|Yes |Automatic |Description:|
||||Select Keying method to manage Keys from the available options: Automatic or Manual.|
||||KeyingMethod confines to:|
||||Type is 'SCALAR'.|
||||Only 'Manual', 'Automatic' are allowed.|
|AllowReKeying|Yes |Disable |Description:|
||||Enable to start the negotiation process automatically before Key expiry.|
||||AllowReKeying confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|KeyNegotiationTries|Yes |3 |Description:|
||||Specify maximum key negotiation trials allowed.|
||||KeyNegotiationTries confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 50 is allowed.|
||||Maximum digits allowed are 2.|
|AuthenticationMode|Yes |Main Mode |Description:|
||||Select authentication mode for exchanging authentication information from the available options: Main Mode or Aggressive Mode.|
||||AuthenticationMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'MainMode', 'AggressiveMode' are allowed.|
|PassDataInCompressedFormat|Yes |Enable |Description:|
||||Enable to pass data in compressed format.|
||||PassDataInCompressedFormat confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|PerfectForwardSecrecy|Yes |Enable |Description:|
||||Enable to generate new Key for every negotiation on Key expiry.|
||||PerfectForwardSecrecy confines to:|
||||Type is 'SCALAR'.|
||||Only 'y', 'n' are allowed.|
|EncryptionAlgorithm1|Yes | |Description:|
||||Select Encryption algorithm for maintaining integrity of exchanged data during Phase 1.|
||||EncryptionAlgorithm1 confines to:|
||||Type is 'SCALAR'.|
||||Only 'DES', '3DES', 'AES128', 'AES192', 'AES256', 'TwoFish', 'BlowFish', 'Serpent', 'AES128GCM16', 'AES192GCM16', 'AES256GCM16' are allowed.|
|AuthenticationAlgorithm1|Yes | |Description:|
||||Select Authentication algorithm to be used for authenticating communicating parties during Phase 1.|
||||AuthenticationAlgorithm1 confines to:|
||||Type is 'SCALAR'.|
||||Only 'MD5', 'SHA1', 'SHA2_256', 'SHA2_384', 'SHA2_512' are allowed.|
|EncryptionAlgorithm2|No | |Description:|
||||Select Encryption algorithm for maintaining integrity of exchanged data during Phase 1.|
||||EncryptionAlgorithm2 confines to:|
||||Type is 'SCALAR'.|
||||Only 'DES', '3DES', 'AES128', 'AES192', 'AES256', 'TwoFish', 'BlowFish', 'Serpent', 'AES128GCM16', 'AES192GCM16', 'AES256GCM16' are allowed.|
|AuthenticationAlgorithm2|No | |Description:|
||||Select Authentication algorithm to be used for authenticating communicating parties during Phase 1.|
||||AuthenticationAlgorithm2 confines to:|
||||Type is 'SCALAR'.|
||||Only 'MD5', 'SHA1', 'SHA2_256', 'SHA2_384', 'SHA2_512' are allowed.|
|EncryptionAlgorithm3|No | |Description:|
||||Select Encryption algorithm for maintaining integrity of exchanged data during Phase 1.|
||||EncryptionAlgorithm3 confines to:|
||||Type is 'SCALAR'.|
||||Only 'DES', '3DES', 'AES128', 'AES192', 'AES256', 'TwoFish', 'BlowFish', 'Serpent', 'AES128GCM16', 'AES192GCM16', 'AES256GCM16' are allowed.|
|AuthenticationAlgorithm3|No | |Description:|
||||Select Authentication algorithm to be used for authenticating communicating parties during Phase 1.|
||||AuthenticationAlgorithm3 confines to:|
||||Type is 'SCALAR'.|
||||Only 'MD5', 'SHA1', 'SHA2_256', 'SHA2_384', 'SHA2_512' are allowed.|
|DHGroup|Yes | |Description:|
||||Select DH Group which specifies the Key length used for encryption.|
||||DHGroup confines to:|
||||Type is 'ARRAY'.|
||||Only '1(DH768)', '2(DH1024)', '5(DH1536)', '14(DH2048)', '15(DH3072)', '16(DH4096)', '17(DH6144)', '18(DH8192)', '19(ecp256)', '20(ecp384)', '21(ecp521)', '25(ecp192)', '26(ecp224)', '27(ecp224bp)', '28(ecp256bp)', '29(ecp384bp)', '30(ecp512bp)', '31(curve25519)' are allowed.|
||||Multiple values are allowed.|
|KeyLife|Yes |3600 |Description:|
||||Specify Key life in seconds after which the key expires.|
||||KeyLife confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 120 to 86400 is allowed.|
||||Maximum digits allowed are 5.|
|ReKeyMargin|Yes |120 |Description:|
||||Specify the time before which the negotiation process will start automatically before Key expiry.|
||||ReKeyMargin confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Maximum digits allowed are 3.|
|RandomizeRe-KeyingMarginBy|Yes | |Description:|
||||Specify Randomize Re-Keying time.|
||||RandomizeRe-KeyingMarginBy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 100 is allowed.|
||||Maximum digits allowed are 3.|
|DeadPeerDetection|No |Enable |Description:|
||||Enable to check whether peer is live or not.|
||||DeadPeerDetection confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Check Peer After Every|No |30 |Description:|
||||Specify time after which peer will check the status of another peer.|
||||Check Peer After Every confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Maximum digits allowed are 3.|
|Wait For Response Upto|No |120 |Description:|
||||Specify time in seconds for initiated peer to wait for status response.|
||||Wait For Response Upto confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Maximum digits allowed are 4.|
|Action When Peer Unreachable|No | |Description:|
||||Specify action to be taken when peer is not reachable.|
||||Action When Peer Unreachable confines to:|
||||Type is 'SCALAR'.|
||||Only 'Hold', 'Disconnect', 'ReInitiate' are allowed.|
|EncryptionAlgorithm1|Yes | |Description:|
||||Select Encryption algorithm for maintaining integrity of exchanged data during Phase 2.|
||||EncryptionAlgorithm1 confines to:|
||||Type is 'SCALAR'.|
||||Only 'DES', '3DES', 'AES128', 'AES192', 'AES256', 'TwoFish', 'BlowFish', 'Serpent', 'AES128GCM16', 'AES192GCM16', 'AES256GCM16', 'AES128GMAC', 'AES192GMAC', 'AES256GMAC' are allowed.|
|AuthenticationAlgorithm1|Yes | |Description:|
||||Select Authentication algorithm to be used for authenticating communicating parties during Phase 2.|
||||AuthenticationAlgorithm1 confines to:|
||||Type is 'SCALAR'.|
||||Only 'MD5', 'SHA1', 'SHA2_256', 'SHA2_384', 'SHA2_512' are allowed.|
|EncryptionAlgorithm2|No | |Description:|
||||Select Encryption algorithm for maintaining integrity of exchanged data during Phase 2.|
||||EncryptionAlgorithm2 confines to:|
||||Type is 'SCALAR'.|
||||Only 'DES', '3DES', 'AES128', 'AES192', 'AES256', 'TwoFish', 'BlowFish', 'Serpent', 'AES128GCM16', 'AES192GCM16', 'AES256GCM16', 'AES128GMAC', 'AES192GMAC', 'AES256GMAC' are allowed.|
|AuthenticationAlgorithm2|No | |Description:|
||||Select Authentication algorithm to be used for authenticating communicating parties during Phase 2.|
||||AuthenticationAlgorithm2 confines to:|
||||Type is 'SCALAR'.|
||||Only 'MD5', 'SHA1', 'SHA2_256', 'SHA2_384', 'SHA2_512' are allowed.|
|EncryptionAlgorithm3|No | |Description:|
||||Select Encryption algorithm for maintaining integrity of exchanged data during Phase 2.|
||||EncryptionAlgorithm3 confines to:|
||||Type is 'SCALAR'.|
||||Only 'DES', '3DES', 'AES128', 'AES192', 'AES256', 'TwoFish', 'BlowFish', 'Serpent', 'AES128GCM16', 'AES192GCM16', 'AES256GCM16', 'AES128GMAC', 'AES192GMAC', 'AES256GMAC' are allowed.|
|AuthenticationAlgorithm3|No | |Description:|
||||Select Authentication algorithm to be used for authenticating communicating parties during Phase 2.|
||||AuthenticationAlgorithm3 confines to:|
||||Type is 'SCALAR'.|
||||Only 'MD5', 'SHA1', 'SHA2_256', 'SHA2_384', 'SHA2_512' are allowed.|
|PFSGroup|No | |Description:|
||||Select PFS Group which specifies the Key length used for encryption.|
||||PFSGroup confines to:|
||||Type is 'SCALAR'.|
||||Only 'SameasPhase-I', '1(DH768)', '2(DH1024)', '5(DH1536)', '14(DH2048)', '15(DH3072)', '16(DH4096)', '17(DH6144)', '18(DH8192)', '19(ecp256)', '20(ecp384)', '21(ecp521)', '25(ecp192)', '26(ecp224)', '27(ecp224bp)', '28(ecp256bp)', '29(ecp384bp)', '30(ecp512bp)', '31(curve25519)', 'None' are allowed.|
|KeyLife|Yes |3600 |Description:|
||||Specify Key life for Phase 2 in seconds after which the key expires.|
||||KeyLife confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 120 to 86400 is allowed.|
||||Maximum digits allowed are 5.|
|LocalSPI|Yes | |Description:|
||||Select local SPI|
||||LocalSPI confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed characters: (A-Fa-f0-9)|
||||Maximum characters allowed are 8.|
||||Minimum characters allowed are 3.|
|RemoteSPI|Yes | |Description:|
||||Select remote SPI.|
||||RemoteSPI confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed characters: (A-Fa-f0-9)|
||||Maximum characters allowed are 8.|
||||Minimum characters allowed are 3.|
|EncryptionAlgorithm|Yes | |Description:|
||||If Keying method is selected as Manual, select Encryption algorithm for maintaining integrity of exchanged data during Phase 1.|
||||EncryptionAlgorithm confines to:|
||||Type is 'SCALAR'.|
||||Only 'DES', '3DES', 'AES128', 'AES192', 'AES256' are allowed.|
|InboundEncryptionKey|Yes | |Description:|
||||Specify Inbound Encryption Key.|
||||InboundEncryptionKey confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed characters: (A-Fa-f0-9)|
||||Maximum characters allowed are 64.|
|OutboundEncryptionKey|Yes | |Description:|
||||Specify Outbound Encryption Key.|
||||OutboundEncryptionKey confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed characters: (A-Fa-f0-9)|
||||Maximum characters allowed are 64.|
|AuthenticationAlgorithm|Yes | |Description:|
||||If keying method is selected as Manual, select Authentication algorithm to be used for authenticating communicating parties during Phase 1.|
||||AuthenticationAlgorithm confines to:|
||||Type is 'SCALAR'.|
||||Only 'NONE', 'MD5', 'SHA1', 'SHA2_256', 'SHA2_384', 'SHA2_512' are allowed.|
|sha2_96_truncate|No | |Description:|
||||Truncate SHA2-256 to 96bit|
||||sha2_96_truncate confines to:|
||||Type is 'SCALAR'.|
||||Only 'no', 'yes' are allowed.|
|keyexchange|No | |Description:|
||||method of key exchange, which protocol should be used to initialize the connection.|
||||keyexchange confines to:|
||||Type is 'SCALAR'.|
||||Only 'ikev1', 'ikev2' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add VPN Policy|200|Created the IPsec profile.|
|Add VPN Policy|500|Couldn't create the profile. Try again later.|
|Add VPN Policy|502|Couldn't create the profile. An IPsec profile with this name already exists.|
|Edit VPN Policy|200|Updated the IPsec profile.|
|Edit VPN Policy|500|Couldn't update the profile.|
|Edit VPN Policy|502|Couldn't create the profile. An IPsec profile with this name already exists.|
|Edit VPN Policy|511|Couldn't rewrite the connections for the IPsec profile.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
