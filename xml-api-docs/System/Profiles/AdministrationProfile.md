# AdministrationProfile

- **Operation**: Add Profile / Update Profile
- **Description**: To create and update profiles for various administrator users.

## Sample Configuration

``` xml
<AdministrationProfile>
    <Name>profilename</Name>
    <Dashboard>Read-Write/Read-Only/None</Dashboard>
    <Wizard>Read-Write/Read-Only/None</Wizard>
    <System>
    <!--
        Below tags should be skipped when all the entities in a category will have same value as category

        if subelement are not defined attach as group level
        e.g. system is read-only and only password is defined as read-write then centralconsole will be readonly and password as readwrite
        if not defined at group level then all sub element are required, check at API Opcode not at parser level
    -->
        <SetSystemProfile>Read-Write/Read-Only/None</SetSystemProfile>
        <Profile>Read-Write/Read-Only/None</Profile>
        <Password>Read-Write/Read-Only/None</Password>
        <CentralManagement>Read-Write/Read-Only/None</CentralManagement>
        <Backup>Read-Write/Read-Only/None</Backup>
        <Restore>Read-Write/Read-Only/None</Restore>
        <Firmware>Read-Write/Read-Only/None</Firmware>
        <Licensing>Read-Write/Read-Only/None</Licensing>
        <Services>Read-Write/Read-Only/None</Services>
        <Updates>Read-Write/Read-Only/None</Updates>
        <RebootShutdown>Read-Write/Read-Only/None</RebootShutdown>
        <HA>Read-Write/Read-Only/None</HA>
        <DownloadCertificates>Read-Write/Read-Only/None</DownloadCertificates>
        <OtherCertificateConfiguration>Read-Write/Read-Only/None</OtherCertificateConfiguration>
        <Diagnostics>Read-Write/Read-Only/None</Diagnostics>
        <OtherSystemConfiguration>Read-Write/Read-Only/None</OtherSystemConfiguration>
    </System>
    <Objects>Read-Write/Read-Only/None</Objects>
    <Network>Read-Write/Read-Only/None</Network>
    <Identity>
        <SetIdentityProfile>Read-Write/Read-Only/None</SetIdentityProfile>
        <Authentication>Read-Write/Read-Only/None</Authentication>
        <Groups>Read-Write/Read-Only/None</Groups>
        <ExportUsers>Read-Write/Read-Only/None</ExportUsers>
        <Users>Read-Write/Read-Only/None</Users>
        <AdministratorUsers>Read-Write/Read-Only/None</AdministratorUsers>
        <GuestUsersManagement>Read-Write/Read-Only/None</GuestUsersManagement>
        <OtherGuestUserSettings>Read-Write/Read-Only/None</OtherGuestUserSettings>
        <Policy>Read-Write/Read-Only/None</Policy>
        <TestExternalServerConnectivity>Read-Write/Read-Only/None</TestExternalServerConnectivity>
        <DisconnectLiveUser>Read-Write/Read-Only/None</DisconnectLiveUser>
    </Identity>
    <Firewall>Read-Write/Read-Only/None</Firewall>
    <VPN>
        <SetVPNProfile>Read-Write/Read-Only/None</SetVPNProfile>
        <ConnectTunnel>Read-Write/Read-Only/None</ConnectTunnel>
        <OtherVPNConfigurations>Read-Write/Read-Only/None</OtherVPNConfigurations>
    </VPN>
    <IPS>Read-Write/Read-Only/None</IPS>
    <WebFilter>Read-Write/Read-Only/None</WebFilter>
    <CloudApplicationDashboard>Read-Write/Read-Only/None</CloudApplicationDashboard>
    <ZeroDayProtection>Read-Write/Read-Only/None</ZeroDayProtection>
    <ApplicationFilter>Read-Write/Read-Only/None</ApplicationFilter>
    <WAF>
        <SetWAFProfile>Read-Write/Read-Only/None</SetWAFProfile>
        <Alerts>Read-Write/Read-Only/None</Alerts>
        <OtherWAFConfiguration>Read-Write/Read-Only/None</OtherWAFConfiguration>
    </WAF>
    <IM>Read-Write/Read-Only/None</IM>
    <QoS>Read-Write/Read-Only/None</QoS>
    <AntiVirus>
        <SetAntiVirusProfile>Read-Write/Read-Only/None</SetAntiVirusProfile>
        <DownloadQuarantineMail>Read-Write/Read-Only/None</DownloadQuarantineMail>
        <OtherAntiVirusConfigurations>Read-Write/Read-Only/None</OtherAntiVirusConfigurations>
    </AntiVirus>
    <AntiSpam>
        <SetAntiSpamProfile>Read-Write/Read-Only/None</SetAntiSpamProfile>
        <DownloadReleaseQuarantineMail>Read-Write/Read-Only/None</DownloadReleaseQuarantineMail>
        <OtherAntiSpamConfigurations>Read-Write/Read-Only/None</OtherAntiSpamConfigurations>
    </AntiSpam>
    <TrafficDiscovery>Read-Write/Read-Only/None</TrafficDiscovery>
    <LogsReports>
        <SetLogsReportsProfile>Read-Write/Read-Only/None</SetLogsReportsProfile>
        <Configuration>Read-Write/Read-Only/None</Configuration>
        <LogViewer>Read-Write/Read-Only/None</LogViewer>
        <ReportsAccess>Read-Write/Read-Only/None</ReportsAccess>
        <Four-EyeAuthenticationSettings>Read-Write/Read-Only/None</Four-EyeAuthenticationSettings>
        <De-Anonymization>Read-Write/Read-Only/None</De-Anonymization>
    </LogsReports>
</AdministrationProfile>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name to identify the profile.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|Listofentityrole|No | |Description:|
||||List of roles that can be assigned to Profile. You can assign Read-Only or Read-Write rights of individual roles.|
||||Listofentityrole confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Profile|200|Profile "\<DynamicValue>" has been created successfully|
|Add Profile|500|Profile "\<DynamicValue>" could not be created|
|Add Profile|502|Profile could not be created. Profile with the same name as "\<DynamicValue>" already exists. Choose a different name|
|Update Profile|200|Profile "\<DynamicValue>" has been updated successfully|
|Update Profile|500|Profile "\<DynamicValue>" could not be updated|

---
---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
