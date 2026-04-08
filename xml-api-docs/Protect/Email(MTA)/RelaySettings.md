# RelaySettings

- Operation: Update Relay Settings
- Description: To update relay settings for email configuration.

## Sample Configuration

``` xml
<RelaySettings>
    <HostBased>
        <AllowRelay>
            <HostsOrNetworks>
                <HostsOrNetwork>allowed1</HostsOrNetwork>
            </HostsOrNetworks>
        </AllowRelay>
        <BlockRelay>
            <HostsOrNetworks>
                <HostsOrNetwork>blocked1</HostsOrNetwork>
            </HostsOrNetworks>
        </BlockRelay>
    </HostBased>
    <UpstreamHost>
        <AllowRelay>
            <HostsOrNetworks>
                <HostsOrNetwork>allowed2</HostsOrNetwork>
            </HostsOrNetworks>
        </AllowRelay>
        <BlockRelay>
            <HostsOrNetworks>
                <HostsOrNetwork>blocked2</HostsOrNetwork>
            </HostsOrNetworks>
        </BlockRelay>
    </UpstreamHost>
    <AuthenticatedRelaySettings>
        <AuthenticatedRelay>Enable</AuthenticatedRelay>
        <UsersOrGroups>
            <UsersOrGroup>Open Group</UsersOrGroup>
            <UsersOrGroup>Guest Group</UsersOrGroup>
        </UsersOrGroups>
    </AuthenticatedRelaySettings>
</RelaySettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|HostsOrNetwork|No||Description:|
||||The hosts/networks which can use SF as an email relay.|
||||HostsOrNetwork confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|HostsOrNetwork|No|Any|Description:|
||||The hosts/networks that should be blocked by Device.|
||||HostsOrNetwork confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|HostsOrNetwork|No||Description:|
||||The upstream hosts/networks from whom you are to allow inbound emails, typically your ISP or external MX.|
||||HostsOrNetwork confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|HostsOrNetwork|No||Description:|
||||The hosts/networks whose inbound emails should be blocked by Device.|
||||HostsOrNetwork confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|AuthenticatedRelay|No|Disabled|Description:|
||||Checkbox to allow the authenticated users or groups selected below to use Device as an Email Relay.|
||||AuthenticatedRelay confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|UsersOrGroup|No|Any|Description:|
||||Users or groups to be allowed to use Device as an Email Relay.|
||||UsersOrGroup confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update Relay Settings|200|Operation Successful|
|Update Relay Settings|500|Operation Fail|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
