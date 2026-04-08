# MTASPXConfiguration

- Operation: Update SPX Configuration
- Description: To update SPX global configuration when MTA Mode is enabled.

## Sample Configuration

``` xml
<MTASPXConfiguration>
    <SPXGlobalTemplate>
        <DefaultSPXTemplate>Default Template</DefaultSPXTemplate>
    </SPXGlobalTemplate>
    <HostName>None</HostName>
    <Port>8094</Port>
    <KeepUnusedPassFor>30</KeepUnusedPassFor>
    <AllowPassRegistrationFor>10</AllowPassRegistrationFor>
    <SendNotifcationErrorTo>SenderOnly</SendNotifcationErrorTo>
</MTASPXConfiguration>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|KeepUnusedPassFor|Yes|30|Description:|
||||Specify the expiry time (in days) of an unused password.|
||||KeepUnusedPassFor confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AllowSecureReplyfor|Yes|30|Description:|
||||Specify the maximum time (in days) in which recipient can securely reply to an SPX-encrypted email using the SPX Reply Portal|
||||AllowSecureReplyfor confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SendNotifcationErrorTo|Yes|Sender Only|Description:|
||||Specify whom to send a notification when an SPX error occurs.|
||||SendNotifcationErrorTo confines to:|
||||Type is 'SCALAR'.|
||||Only 'SenderOnly', 'Nobody' are allowed.|
|Network|No||Description:|
||||Specify the networks from which password registration requests will be accepted.|
||||Network confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|AllowPassRegistrationFor|Yes|10|Description:|
||||Specify the time (in days) after which the link to Password Registration Portal expires.|
||||AllowPassRegistrationFor confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|DefaultSPXTemplate|No||Description:|
||||Specify Global Template Name.|
||||DefaultSPXTemplate confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|HostName|No||Description:|
||||Specify the IP Address or domain on which Password Registration Portal is hosted.|
||||HostName confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Port|Yes|8094|Description:|
||||Enter the port on which the SPX password registration portal should listen.|
||||Port confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1025 to 65535 is allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update SPX Configuration|200|Operation Successful|
|Update SPX Configuration|500|Operation Fail|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
