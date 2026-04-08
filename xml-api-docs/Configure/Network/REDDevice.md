# REDDevice

- Operation: Add RED Device / Update RED Device
- Description: To configure RED.To configure RED.

## Sample Configuration

``` xml
<REDDevice transactionid="">
    <Status>Enable/Disable</Status>
    <BranchName />
    <Device>RED10/RED15/RED50/red20/red60</Device>
    <REDDeviceID />
    <TunnelID />
    <UnlockCode />
    <UTMHostName />
    <SecondUTMHostName>
    <!--For RED15 & RED50 -->
    </SecondUTMHostName>
    <Use2ndIPHostnameFor>
    <!--For RED15 & RED50 -->
    </Use2ndIPHostnameFor>
    <Description />
    <DeploymentMode>AutoDeployment/ManualDeployment
    <!--Automatically via Provisioning Service/ Manually via USB Stick -->
    </DeploymentMode>
    <UplinkSettings>
        <Uplink>
            <Connection>DHCP/Static</Connection>
            <!--Static configuration -->
            <Address />
            <Netmask />
            <DefaultGateway />
            <DNS />
        </Uplink>
        <SecondUplink>
            <Connection>DHCP/Static</Connection>
            <Address />
            <Netmask />
            <DefaultGateway />
            <DNS />
        </SecondUplink>
        <SecondUplinkMode />
        <UMTS3GFailover>Enable/Disable</UMTS3GFailover>
        <FailOverSettings>
            <Username />
            <Password />
            <Pin />
            <MobileNetwork>GSM/CDMA</MobileNetwork>
            <APN />
            <DialString>*99#</DialString>
        </FailOverSettings>
    </UplinkSettings>
    <Certificate>
        <Cert>RED cert for registration</Cert>
        <Key />
        <CA />
    </Certificate>
    <Authorized />
    <NetworkSetting>
        <OperationMode>Standard/Split/Transparent</OperationMode>
        <StandardSplit>
            <Networks>
                <!--Hosts for network -->
                <Network>
                    :
                </Network>
            </Networks>
        </StandardSplit>
        <TransparentSplit>
            <DNS />
            <Networks>
                <!--Hosts for network -->
                <Network>
                    :
                </Network>
            </Networks>
            <Domains>
                <!--Domains for network -->
                <Domain>
                    :
                </Domain>
            </Domains>
        </TransparentSplit>
        <!--interface configuration -->
        <IPAddress />
        <NetMask />
        <Zone />
        <MACFilter>
            <FilterType>None/Allowlist/Blocklist</FilterType>
            <MACAddress />
        </MACFilter>
        <TunnelCompression>Enable/Disable</TunnelCompression>
    </NetworkSetting>
    <!-- For RED50 Only -->
    <SwitchSettings>
        <LANPortMode>Switch/VLAN</LANPortMode>
        <!-- VLAN configuration-->
        <LANPortSettings>
            <LAN1>
                <Mode>Disabled/Untagged DropTagged/Untagged/Tagged</Mode>
                <Vids />
            </LAN1>
            <LAN2>
                <Mode>Unused/Untagged DropTagged/Untagged/Tagged</Mode>
                <Vids />
            </LAN2>
            <LAN3>
                <Mode>Unused/Untagged DropTagged/Untagged/Tagged</Mode>
                <Vids />
            </LAN3>
            <LAN4>
                <Mode>Unused/Untagged DropTagged/Untagged/Tagged</Mode>
                <Vids />
            </LAN4>
        </LANPortSettings>
    </SwitchSettings>
    <AdvancedSettings>
        <!--bridge IP settings for RED20 & RED60 -->
        <RemoteIPAssignment>NoIPAddress/DHCP/Static</RemoteIPAssignment>
        <!--config for static bridge IP type-->
        <RemoteTunnelIPv4Address>IPv4address</RemoteTunnelIPv4Address>
    </AdvancedSettings>
</REDDevice>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|BranchName|Yes | |Description:|
||||Enter the name for the remote location where the RED will be set up.|
||||BranchName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Device|No | |Description:|
||||Select the client type depending on the type of RED device you want to connect.|
||||Device confines to:|
||||Type is 'SCALAR'.|
||||Only 'RED15', 'RED15W', 'red20', 'RED50', 'red60', 'RED_FIREWALL_SERVER', 'RED_FIREWALL_SERVER_LEGACY', 'RED_FIREWALL_CLIENT', 'RED_FIREWALL_CLIENT_LEGACY' are allowed.|
|REDDeviceID|Yes | |Description:|
||||Enter the RED ID.|
||||REDDeviceID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|TunnelID|No | |Description:|
||||Specify 'tunnel_id'|
||||TunnelID confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|UnlockCode|No | |Description:|
||||Enter the unlock code.|
||||UnlockCode confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|UTMHostName|Yes | |Description:|
||||Enter the hostname of the UTM.|
||||UTMHostName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Connection|Yes |DHCP |Description:|
||||Select the connection type for the uplink.|
||||Connection confines to:|
||||Type is 'SCALAR'.|
||||Only 'DHCP', 'Static' are allowed.|
|Address|No | |Description:|
||||Enter an IPv4 address.|
||||Address confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'UNSPECIFIED' is allowed.|
|Netmask|No |/24 (255.255.255.0) |Description:|
||||Enter Netmask.|
||||Netmask confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 15.|
||||IPv4 Address should be between: [128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255]|
|DefaultGateway|No | |Description:|
||||Enter gateway IP address.|
||||DefaultGateway confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||IP Class other than 'UNSPECIFIED' is allowed.|
|DNS|No | |Description:|
||||Enter DNS Server IP.|
||||DNS confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
|SecondUTMHostName|No | |Description:|
||||Enter the second hostname of the UTM.|
||||SecondUTMHostName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Not allowed for first character: (# ,). Not allowed: Comma (,)|
|SecondUplinkMode|No |Failover |Description:|
||||Turn on active load balancing between the uplinks.|
||||SecondUplinkMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'balance', 'failover' are allowed.|
|Use2ndIPHostNameFor|No |Failover |Description:|
||||Enable to distribute traffic equally between, the primary and the secondary hosts.|
||||Use2ndIPHostNameFor confines to:|
||||Type is 'SCALAR'.|
||||Only 'Loadbalancing', 'Failover' are allowed.|
|Description|No | |Description:|
||||Enter a description for the RED settings.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|OperationMode|Yes |Standard/Unified |Description:|
||||Specify how the remote network must be integrated into your local network.|
||||OperationMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'Standard', 'Split', 'Transparent' are allowed.|
|Network|No | |Description:|
||||Add one or more split networks.|
||||Network confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Domain|No | |Description:|
||||Add one or more split domains.|
||||Domain confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|IPAddress|Yes | |Description:|
||||Enter the IP address of the RED device.|
||||IPAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS'.|
|NetMask|Yes | |Description:|
||||/24 (255.255.255.0)|
||||NetMask confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||IPv4 Address should be between: [128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255].[0,128,192,224,240,248,252,254,255]|
|Zone|Yes | |Description:|
||||Select the requested zone.|
||||Zone confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed first characters: Alphanumeric characters (A-Za-z1-9) and not a zero (0). For other characters: (A-Za-z0-9_)|
|DHCPRange|No | |Description:|
||||Enter the DHCP range RED is allowed to use.|
||||DHCPRange confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|FilterType|No | |Description:|
||||Select the MAC filtering type to restrict the MAC addresses that can be connected to the RED device.|
||||FilterType confines to:|
||||Type is 'SCALAR'.|
||||Only 'None', 'Allowlist', 'Blocklist' are allowed.|
|MACAddress|No | |Description:|
||||The list of MAC addresses used to restrict access to the RED device.|
||||MACAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DeploymentMode|No |Automatically via Provisioning Service |Description:|
||||Select the requested deployment method.|
||||DeploymentMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'AutoDeployment', 'ManualDeployment' are allowed.|
|UMTS3GFailover|No |Disable |Description:|
||||Enable/disable the 3G/UMTS failover function.|
||||UMTS3GFailover confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Username|No | |Description:|
||||Enter a username for the mobile network.|
||||Username confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Password|No | |Description:|
||||Enter password for the mobile network.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Pin|No | |Description:|
||||Enter the PIN of the SIM card if a PIN is configured.|
||||Pin confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 15.|
|MobileNetwork|No |GSM |Description:|
||||Select the mobile network type.|
||||MobileNetwork confines to:|
||||Type is 'SCALAR'.|
||||Only 'GSM', 'CDMA' are allowed.|
|APN|No | |Description:|
||||Enter provider's access point name information.|
||||APN confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DialString|No |*99# |Description:|
||||Enter the dial string used by your provider.|
||||DialString confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|LANPortMode|No |Switch |Description:|
||||Configure the LAN ports to use as simple switches or for intelligent VLAN use.|
||||LANPortMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'Switch', 'VLAN' are allowed.|
|Cert|No | |Description:|
||||Enter the certificate of the firewall appliance|
||||Cert confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Authorized|No |1 |Description:|
||||Enter weather the device should be authorized or not|
||||Authorized confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|Mode|No | |Description:|
||||Configure the LAN ports individually.|
||||Mode confines to:|
||||Type is 'SCALAR'.|
||||Only 'Tagged', 'Untagged', 'Untagged DropTagged', 'Unused', 'Disabled' are allowed.|
|Vids|No | |Description:|
||||Specify the VLAN IDs.|
||||Vids confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|REDMTU|Yes |1500 |Description:|
||||Enter the MTU of the RED device.|
||||REDMTU confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 576 to 1500 is allowed.|
|RemoteTunnelIPv4Address|No |0.0.0.0 |Description:|
||||Static IPv4 address for the RED end of the tunnel.|
||||RemoteTunnelIPv4Address confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|RemoteIPAssignment|No |None |Description:|
||||IP assignment method for the RED end of the tunnel.|
||||RemoteIPAssignment confines to:|
||||Type is 'SCALAR'.|
||||Only 'DHCP', 'Static', 'NoIPAddress' are allowed.|
|TunnelCompression|No |Disable |Description:|
||||Enable/Disable the tunnel compression.|
||||TunnelCompression confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Status|No | |Description:|
||||Shows the RED Device Status.|
||||Status confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Key|No | |Description:|
||||Enter the private key of the RED device|
||||Key confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CA|No | |Description:|
||||Enter the CA-certificate that RED uses|
||||CA confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add RED Device|200|RED device has been created successfully|
|Add RED Device|500|RED device could not be updated.|
|Add RED Device|501|Invalid zone entry.|
|Add RED Device|502|Specify different domain name as DNS request route with name "\<DynamicValue>" already exists|
|Add RED Device|503|RED device with the same ID already exists. Please choose a different RED ID|
|Add RED Device|504|RED ID is invalid.|
|Add RED Device|512|The entered unlock code does not match for this device.|
|Add RED Device|513|Registering with RED registry service failed. Please make sure that this device can connect to the internet on port 3400.|
|Add RED Device|514|Unknown error occured in interaction with RED registry service.|
|Add RED Device|515|Failed to create RED certificate.|
|Add RED Device|516|Failed to delete RED certificate.|
|Add RED Device|517|Configuration cannot be updated as RED service is not running.|
|Add RED Device|518|Failed to create tunnel interface for RED device.|
|Add RED Device|519|Failed to delete tunnel interface for RED device.|
|Add RED Device|520|Unknown internal error occured.|
|Add RED Device|521|The RED ID you entered is not registered on the provisioning service. Please check that the RED ID you have entered matches the one which is printed on the label of your RED.|
|Add RED Device|522|RED tunnel ID is already in use, choose a different one.|
|Add RED Device|526|RED device record not exists|
|Add RED Device|541|RED device configuration with the same hostname already exists, choose a different hostname|
|Add RED Device|542|IP address is already assigned to another interface.|
|Add RED Device|543|RED IP cannot be configured as DHCP lease IP|
|Add RED Device|544|Configured RED IP address is not within RED DHCP range|
|Add RED Device|545|Leased IP range with the same IP addresses already assigned for this interface. Choose different IP addresses|
|Add RED Device|546|You cannot configure DHCP server. Selected interface is already configured in DHCP relay.|
|Add RED Device|547|RED MTU is not within the range 576 to 1500.|
|Add RED Device|561|RED and remote tunnel IP addresses must belong to the same subnet.|
|Update RED Device|200|RED device has been updated successfully.|
|Update RED Device|500|RED device update failed.|
|Update RED Device|501|Invalid zone entry.|
|Update RED Device|502|Specify different domain name as DNS request route with name "\<DynamicValue>" already exists|
|Update RED Device|503|RED device with the same ID already exists. Please choose a different RED ID|
|Update RED Device|504|RED ID is invalid.|
|Update RED Device|512|The entered unlock code does not match for this device.|
|Update RED Device|513|Registering with RED registry service failed. Please make sure that this device can connect to the internet on port 3400.|
|Update RED Device|514|Unknown error occured in interaction with RED registry service.|
|Update RED Device|515|Failed to create RED certificate.|
|Update RED Device|516|Failed to delete RED certificate.|
|Update RED Device|517|Configuration cannot be updated as RED service is not running.|
|Update RED Device|518|Failed to create tunnel interface for RED device.|
|Update RED Device|519|Failed to delete tunnel interface for RED device.|
|Update RED Device|526|RED device record not exists|
|Update RED Device|541|RED device configuration with the same hostname already exists, choose a different hostname|
|Update RED Device|542|IP address is already assigned to another interface.|
|Update RED Device|543|RED IP cannot be configured as DHCP lease IP|
|Update RED Device|544|Configured RED IP address is not within RED DHCP range|
|Update RED Device|545|Leased IP range with the same IP addresses already assigned for this interface. Choose different IP addresses|
|Update RED Device|546|You cannot configure DHCP server. Selected interface is already configured in DHCP relay.|
|Update RED Device|561|RED and remote tunnel IP addresses must belong to the same subnet.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
