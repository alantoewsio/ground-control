# VPNFailoverGroup

- Operation: Add Failover Connection Group / Update Failover Connection Group
- Description: To Create/Update Failover Connection Group which is a group of connections that are used for failover to provide continuous VPN connectivity for IPSEC connection.

## Sample Configuration

``` xml
<VPNFailoverGroup>
    <GroupDetail>
        <Name>failovergroupname</Name>
        <MemberConnections>
            <Connection>connectionname</Connection>
            :
        </MemberConnections>
        <MailNotification>Enable/Disable</MailNotification>
        <FailoverCondition>
            <FailoverIF>
                <Protocol>PING/TCP</Protocol>
                <Port>Number</Port>
            </FailoverIF>
            :
        </FailoverCondition>
    </GroupDetail>
    <Active>
        <Name>failovergroupname</Name>
    </Active>
    <DeActive>
        <Name>failovergroupname</Name>
    </DeActive>
</VPNFailoverGroup>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name for the Connection Group.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Allowed first characters: (A-Za-z). For other characters: (A-Za-z0-9_)|
|Connection|Yes | |Description:|
||||Select the Connection to be added to Member Connection List.|
||||Connection confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|MailNotification|No | |Description:|
||||Enable Mail Notification to receive Connection failure notification.|
||||MailNotification confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Protocol|No | |Description:|
||||Specify Communication Protocol to configure VPN failover rules.|
||||Protocol confines to:|
||||Type is 'ARRAY'.|
||||Only 'PING', 'TCP', '' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Port|No | |Description:|
||||Specify Port number for communication in case of TCP communication.|
||||Port confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Allowed numbers: 1 to 65535.|
|AutomaticFailback|No | |Description:|
||||Select automatic failback.|
||||AutomaticFailback confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Failover Connection Group|200|Failover group "\<DynamicValue>" has been created successfully|
|Add Failover Connection Group|500|Connection group "\<DynamicValue>" could not be created|
|Add Failover Connection Group|502|Connection group could not be created. Connection group with the same name as "\<DynamicValue>" already exists. Choose a different name|
|Update Failover Connection Group|200|Failover group "\<DynamicValue>" has been updated successfully|
|Update Failover Connection Group|500|Connection group "\<DynamicValue>" could not be updated|
|Update Failover Connection Group|502|Connection group could not be created. Connection group with the same name as "\<DynamicValue>" already exists. Choose a different name|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
