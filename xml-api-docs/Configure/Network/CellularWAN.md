# CellularWAN

- Operation: Cellular WAN
- Description: Use this XML to configure, connect, or disconnect a cellular WAN network.

## Sample Configuration

``` xml
<CellularWAN>
    <Action>Enable/Disable/Query/Set</Action>
    <!--query params -->
    <SerialPort>543</SerialPort>
    <ATCommand>string</ATCommand>
    <!--set params -->
    <DisconnectOnSystemDown>on/off</DisconnectOnSystemDown>
</CellularWAN>
<CellularWANSettings>
    <!-- InterfaceName is readonly -->
    <Name>Text</Name>
    <IPAssignment>PPP/DHCP</IPAssignment>
    <Connect>Auto/Manual</Connect>
    <ReconnectTries>Always/1/2/3</ReconnectTries>
    <ModemPort>Serial0/Serial1/.../Serial9</ModemPort>
    <PhoneNumber>phone number</PhoneNumber>
    <UserName>username</UserName>
    <Password>password</Password>
    <SIMCardPINCode>Text</SIMCardPINCode>
    <APN>Text</APN>
    <DHCPConnectCommand>Text</DHCPConnectCommand>
    <DHCPDisconnectCommand>Text</DHCPDisconnectCommand>
    <InitializationStrings>
        <String>Text</String>
        :
    </InitializationStrings>
    <GatewaySettings>
        <GatewayName>gatewayname</GatewayName>
    </GatewaySettings>
    <AssignmentType>Automatic/Manual</AssignmentType>
    <MTU>Number</MTU>
    <MSS>Number</MSS>
    <MACAddress>Default/{userdefined MAC Address}</MACAddress>
    <ConnectionStatus>Connected/Disconnected</ConnectionStatus>
</CellularWANSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|No| |Description:|
||||Name of the cellular WAN interface.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 58.|
|IPAssignment|Yes| |Description:|
||||IP assignment method used by the modem.|
||||IPAssignment confines to:|
||||Type is 'SCALAR'.|
||||Only 'PPP', 'DHCP' are allowed.|
|Connect|Yes| |Description:|
||||Mode for establishing the connection.|
||||Connect confines to:|
||||Type is 'SCALAR'.|
||||Only 'Auto', 'Manual' are allowed.|
|ReconnectTries|Yes| |Description:|
||||Number of attempts to make when reconnecting to an access point.|
||||ReconnectTries confines to:|
||||Type is 'SCALAR'.|
||||Only 'Always', '1', '2', '3' are allowed.|
|ModemPort|No| |Description:|
||||Serial interface on which the modem establishes a connection.|
||||ModemPort confines to:|
||||Type is 'SCALAR'.|
||||Only 'Serial0', 'Serial1', 'Serial2', 'Serial3', 'Serial4', 'Serial5', 'Serial6', 'Serial7', 'Serial8', 'Serial9' are allowed.|
|PhoneNumber|No| |Description:|
||||Phone number to use for establishing the connection.|
||||PhoneNumber confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 15.|
|UserName|No| |Description:|
||||Username required for the connection.|
||||UserName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Characters not allowed: (^;'"\)|
||||Maximum characters allowed are 60.|
|Password|No| |Description:|
||||Password required for the connection.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 30.|
|SIMCardPINCode|No| |Description:|
||||Code to unlock a PIN-enabled SIM card.|
||||SIMCardPINCode confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
|APN|No| |Description:|
||||Access point name.|
||||APN confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|DHCPConnectCommand|No| |Description:|
||||DHCP command used to connect to the cellular WAN.|
||||DHCPConnectCommand confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
|DHCPDisconnectCommand|No| |Description:|
||||DHCP command used to disconnect from the cellular WAN.|
||||DHCPDisconnectCommand confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
|String|No| |Description:|
||||Turns some features on the wireless modem on or off.|
||||String confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|GatewayName|Yes| |Description:|
||||Name of the gateway.|
||||GatewayName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
|AssignmentType|Yes| |Description:|
||||Automatic or manual assignment for MTU and MSS.|
||||AssignmentType confines to:|
||||Type is 'SCALAR'.|
||||Only 'Manual', 'Autometic' are allowed.|
|MTU|No| |Description:|
||||Largest packet size in bytes that the network can transmit.|
||||MTU confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 576 to 9000 is allowed.|
|MSS|No| |Description:|
||||Data in bytes that a TCP packet can transmit.|
||||MSS confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 536 to 8960 is allowed.|
|MACAddress|No| |Description:|
||||MAC address that overrides the default address.|
||||MACAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'MACADDRESS'.|
||||Maximum characters allowed are 17.|
|ConnectionStatus|No| |Description:|
||||Status of the 3G, 4G, or 5G modem's connectivity.|
||||ConnectionStatus confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disconnected', 'Connected' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Cellular WAN|200|Saved cellular WAN configuration.|
|Cellular WAN|201|Trying to connect. Wait a few moments.|
|Cellular WAN|202|Trying to disconnect. Wait a few moments.|
|Cellular WAN|500|Couldn't configure cellular WAN.|
|Cellular WAN|502|Modem not found.|
|Cellular WAN|503|Couldn't identify the current device as modem.|
|Cellular WAN|504|Couldn't connect to cellular WAN.|
|Cellular WAN|505|Couldn't disconnect from cellular WAN.|
|Cellular WAN|506|Saved configuration. Modem not found.|
|Cellular WAN|508|The modem doesn't support the configured network adapter method (DHCP).|
|Cellular WAN|509|Modem port didn't respond.|
|Cellular WAN|510|Modem can't connect.|
|Cellular WAN|521|Invalid MAC address.|
|Cellular WAN|522|MAC address conflicts with the system's MAC address.|
|Cellular WAN|523|MAC address conflicts with the list of virtual MAC addresses reserved for HA.|
|Cellular WAN|524|Gateway with the same name exists. Enter a different name.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
