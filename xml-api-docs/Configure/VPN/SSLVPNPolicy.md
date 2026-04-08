# SSLVPNPolicy

- Operation: Add SSLVPN Policy / Edit SSLVPN Policy
- Description: To Add/Edit SSL VPN Policy for determining access mode available to the remote users.

## Sample Configuration

``` xml
<SSLVPNPolicy>
    <TunnelPolicy>
        <Name>Name</Name>
        <Description>Text</Description>
        <PolicyMembers>
            <Member />
            :
        </PolicyMembers>
        <!--TunnelAccess Enable -->
        <UseAsDefaultGateway>off/on</UseAsDefaultGateway>
        <PermittedNetworkResourcesIPv4>
            <Resource>#PortA</Resource>
            :
        </PermittedNetworkResourcesIPv4>
        <PermittedNetworkResourcesIPv6>
            <Resource>#PortA</Resource>
            :
        </PermittedNetworkResourcesIPv6>
        <DisconnectIdleClients>on/off</DisconnectIdleClients>
        <OverrideGlobalTimeout>Number</OverrideGlobalTimeout>
    </TunnelPolicy>
    <ClientlessPolicy>
        <Name>Name</Name>
        <Description>Text</Description>
        <PolicyMembers>
            <Member />
            :
        </PolicyMembers>
        <RestrictWebApplications>Enable/Disable</RestrictWebApplications>
        <WebAccessibleResources>
            <BookmarkGroups>mailsitesbookmarkgroup</BookmarkGroups>
            <Bookmarks>bkyahoo</Bookmarks>
            :
        </WebAccessibleResources>
    </ClientlessPolicy>
</SSLVPNPolicy>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name for SSL VPN Policy.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||UTF-8 character(s) are allowed.|
|Web Access|Yes | |Description:|
||||Enable Web Access mode for remote users.|
||||Web Access confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '6' are allowed.|
|Description|No | |Description:|
||||Specify SSL VPN Policy description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|UseAsDefaultGateway|No |SplitTunnel |Description:|
||||Select tunnel type for routing user's traffic from the available options: Split Tunnel or Full Tunnel.|
||||UseAsDefaultGateway confines to:|
||||Type is 'SCALAR'.|
||||Only 'Off', 'On' are allowed.|
|Resource|No | |Description:|
||||Host/Network that remote user can access.|
||||Resource confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Multiple values are allowed.|
||||Duplicate values will be ignored.|
|PermittedNetworkResourcesIPv6|No | |Description:|
||||Host/Network that remote user can access.|
||||PermittedNetworkResourcesIPv6 confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||UTF-8 character(s) are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will be ignored.|
|DisconnectIdleClients|No |UseGlobalSettings |Description:|
||||Select whether to use Global Settings or Override Global Settings.|
||||DisconnectIdleClients confines to:|
||||Type is 'SCALAR'.|
||||Only 'Off', 'On' are allowed.|
|OverrideGlobalTimeout|No | |Description:|
||||If Override Global Settings option is selected, mention idle timeout in minutes.|
||||OverrideGlobalTimeout confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 15 to 360 is allowed.|
|RestrictWebApplications|No | |Description:|
||||Enable access to Custom URLs for Web Access Mode.|
||||RestrictWebApplications confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|WebAccessibleResources|No | |Description:|
||||Bookmarks/Bookmarks Group the remote user can access in Web Access mode.|
||||WebAccessibleResources confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Multiple values are allowed.|
||||Duplicate values will be ignored.|
|Member|No | |Description:|
||||Enable Web Access mode for remote users.|
||||Member confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add SSLVPN Policy|200|Remote access policy "\<DynamicValue>" has been inserted successfully|
|Add SSLVPN Policy|500|Remote access policy "\<DynamicValue>" could not be created|
|Add SSLVPN Policy|502|Remote access policy could not be created. Policy with same name as "\<DynamicValue>" already exists, choose a different name|
|Edit SSLVPN Policy|200|Remote access policy "\<DynamicValue>" has been updated successfully|
|Edit SSLVPN Policy|500|Remote access policy "\<DynamicValue>" could not be updated|
|Edit SSLVPN Policy|502|Remote access policy could not be created. Policy with same name as "\<DynamicValue>" already exists, choose a different name|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
