# SyslogServers

- Operation: Add Syslog Servers / Update Syslog Servers
- Description: To Add/Edit Syslog Servers for remotely storing logs to help identify Security issues.

## Sample Configuration

``` xml
<SyslogServers>
    <Name>Name</Name>
    <ServerAddress>ipaddress</ServerAddress>
    <Port>port</Port>
    <EnableSecureConnection>Enable/Disable</EnableSecureConnection>
    <Facility>DAEMON/KERNEL/USER/Local0/Local1/Local2/Local3/Local4/Local5/Local6/Local7</Facility>
    <SeverityLevel>Emergency/Alert/Critical/Error/Warning/Notification/Information/Debug</SeverityLevel>
    <Format>DeviceStandardFormat</Format>
    <LogSettings>
        <SecurityPolicy>
            <Log_suppress>Enable/Disable</Log_suppress>
            <!-- SendLogs will represent group level entity  -->
            <!-- Don't define SendLogs if all sub modules are listed  -->
            <SendLogs>Enable/Disable</SendLogs>
            <!-- Define submodule if want to overwrite -->
            <PolicyRules>Enable/Disable</PolicyRules><!-- Default Disable -->
            <InvalidTraffic>Enable/Disable</InvalidTraffic>
            <LocalACLs>Enable/Disable</LocalACLs>
            <DoSAttack>Enable/Disable</DoSAttack>
            <DroppedICMPRedirectedPacket>Enable/Disable</DroppedICMPRedirectedPacket>
            <DroppedSourceRoutedPacket>Enable/Disable</DroppedSourceRoutedPacket>
            <DroppedFragmentedTraffic>Enable/Disable</DroppedFragmentedTraffic>
            <MACFiltering>Enable/Disable</MACFiltering>
            <IP-MACPairFiltering>Enable/Disable</IP-MACPairFiltering>
            <IPSpoofPrevention>Enable/Disable</IPSpoofPrevention>
            <SSLVPNTunnel>Enable/Disable</SSLVPNTunnel>
            <ProtectedApplicationServer>Enable/Disable</ProtectedApplicationServer>
            <Heartbeat>Enable/Disable</Heartbeat>
            <ICMPErrorMessage>Enable/Disable</ICMPErrorMessage>
            <BridgeACLs>Enable/Disable</BridgeACLs>
        </SecurityPolicy>
        <IPS>
            <!-- SendLogs will represent group level entity  -->
            <Log_suppress>Enable/Disable</Log_suppress>
            <SendLogs>Enable/Disable</SendLogs>
            <!-- Define submodule if want to overwrite -->
            <Anomaly>Enable/Disable</Anomaly>
            <Signatures>Enable/Disable</Signatures>
        </IPS>
        <AntiVirus>
            <Log_suppress>Enable/Disable</Log_suppress>
            <!-- SendLogs will represent group level entity  -->
            <SendLogs>Enable/Disable</SendLogs>
            <!-- Define submodule if want to overwrite -->
            <HTTP>Enable/Disable</HTTP>
            <FTP>Enable/Disable</FTP>
            <SMTP>Enable/Disable</SMTP>
            <POP3>Enable/Disable</POP3>
            <IMAP>Enable/Disable</IMAP>
            <IM>Enable/Disable</IM>
            <HTTPS>Enable/Disable</HTTPS>
            <SMTPS>Enable/Disable</SMTPS>
            <POPS>Enable/Disable</POPS>
            <IMAPS>Enable/Disable</IMAPS>
        </AntiVirus>
        <AntiSpam>
            <Log_suppress>Enable/Disable</Log_suppress>
            <!-- SendLogs will represent group level entity  -->
            <SendLogs>Enable/Disable</SendLogs>
            <!-- Define submodule if want to overwrite -->
            <SMTP>Enable/Disable</SMTP>
            <POP3>Enable/Disable</POP3>
            <IMAP>Enable/Disable</IMAP>
            <SMTPS>Enable/Disable</SMTPS>
            <POPS>Enable/Disable</POPS>
            <IMAPS>Enable/Disable</IMAPS>
        </AntiSpam>
        <ContentFiltering>
            <Log_suppress>Enable/Disable</Log_suppress>
            <!-- SendLogs will represent group level entity  -->
            <SendLogs>Enable/Disable</SendLogs>
            <!-- Define submodule if want to overwrite -->
            <WebFilter>Enable/Disable</WebFilter>
            <ApplicationFilter>Enable/Disable</ApplicationFilter>
            <WebContentPolicy>Enable/Disable</WebContentPolicy>
        </ContentFiltering>
        <Events>
            <Log_suppress>Enable/Disable</Log_suppress>
            <!-- SendLogs will represent group level entity  -->
            <SendLogs>Enable/Disable</SendLogs>
            <!-- Define submodule if want to overwrite -->
            <AdminEvents>Enable/Disable</AdminEvents>
            <AuthenticationEvents>Enable/Disable</AuthenticationEvents>
            <SystemEvents>Enable/Disable</SystemEvents>
        </Events>
        <WebServerProtection>
            <Log_suppress>Enable/Disable</Log_suppress>
            <!-- SendLogs will represent group level entity  -->
            <SendLogs>Enable/Disable</SendLogs>
            <!-- Define submodule if want to overwrite -->
            <WAFEvents>Enable/Disable</WAFEvents>
        </WebServerProtection>
        <ATP>
            <Log_suppress>Enable/Disable</Log_suppress>
            <!-- SendLogs will represent group level entity  -->
            <SendLogs>Enable/Disable</SendLogs>
            <!-- Define submodule if want to overwrite -->
            <ATPEvents>Enable/Disable</ATPEvents>
        </ATP>
        <Wireless>
            <Log_suppress>Enable/Disable</Log_suppress>
            <!-- SendLogs will represent group level entity  -->
            <SendLogs>Enable/Disable</SendLogs>
            <!-- Define submodule if want to overwrite -->
            <AccessPoints_SSID>Enable/Disable</AccessPoints_SSID>
        </Wireless>
        <Heartbeat>
            <Log_suppress>Enable/Disable</Log_suppress>
            <!-- SendLogs will represent group level entity  -->
            <SendLogs>Enable/Disable</SendLogs>
            <!-- Define submodule if want to overwrite -->
            <EndpointStatus>Enable/Disable</EndpointStatus>
        </Heartbeat>
        <SystemHealth>
            <Log_suppress>Enable/Disable</Log_suppress>
            <!-- SendLogs will represent group level entity  -->
            <SendLogs>Enable/Disable</SendLogs>
            <!-- Define submodule if want to overwrite -->
            <Usage>Enable/Disable</Usage>
        </SystemHealth>
        <ZeroDayProtection>
            <Log_suppress>Enable/Disable</Log_suppress>
            <!-- SendLogs will represent group level entity  -->
            <SendLogs>Enable/Disable</SendLogs>
            <!-- Define submodule if want to overwrite -->
            <ZeroDayProtectionEvents>Enable/Disable</ZeroDayProtectionEvents>
        </ZeroDayProtection>
    </LogSettings>
</SyslogServers>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes |uiui |Description:|
||||Specify a name for Syslog Server.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|IP Address/Domain|Yes | |Description:|
||||Specify IP Address/Domain name of the Syslog Server.|
||||IP Address/Domain confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS','IPADDRESS6','DOMAIN'.|
||||Maximum characters allowed are 255.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|Secure connection|Yes | |Description:|
||||Specify 'isssl'|
||||Secure connection confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Port|Yes | |Description:|
||||Specify Port number for communication with Syslog Server.|
||||Port confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Allowed port range: 1 to 65535|
||||Maximum digits allowed are 5.|
|Facility|No | |Description:|
||||Select Syslog facility for log messages to be sent to the Syslog Server.|
||||Facility confines to:|
||||Type is 'SCALAR'.|
||||Only 'DAEMON', 'KERNEL', 'LOCAL0', 'LOCAL1', 'LOCAL2', 'LOCAL3', 'LOCAL4', 'LOCAL5', 'LOCAL6', 'LOCAL7', 'USER' are allowed.|
|Severity Level|Yes | |Description:|
||||Select Security levels of logs.|
||||Severity Level confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Format|Yes | |Description:|
||||Format in which the logs are produced.|
||||Format confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Name|No |uiui |Description:|
||||Specify log suppression status.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Syslog Servers|200|Syslog server "\<DynamicValue>" has been created successfully|
|Add Syslog Servers|500|Syslog server could not be added|
|Add Syslog Servers|502|Syslog server could not be added. Syslog server already exists|
|Add Syslog Servers|522|Maximum syslog configuration has been created|
|Add Syslog Servers|541|"Central_Management" and "Central_Reporting" are names reserved for "Syslog servers". Specify a different name|
|Update Syslog Servers|200|Syslog server "\<DynamicValue>" has been updated successfully|
|Update Syslog Servers|500|Syslog server could not be updated|
|Update Syslog Servers|502|Syslog server could not be added. Syslog server already exists|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
