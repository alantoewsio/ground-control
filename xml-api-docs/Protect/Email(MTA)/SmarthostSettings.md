# SmarthostSettings

- Operation: Update Smarthost Settings
- Description: To update Smarthost global settings when MTA Mode is enabled.

## Sample Configuration

``` xml
<SmarthostSettings>
    <UseSmarthost>Enable</UseSmarthost>
    <SmarthostList>
        <Hostname>ip4</Hostname>
    </SmarthostList>
    <Port>25</Port>
    <AuthenticateDevicewithSmarthost>Enable</AuthenticateDevicewithSmarthost>
    <Username>test</Username>
    <Password passwordform="encrypt">A7B9E8704172D110AA9F2E110D5A0DA6</Password>
</SmarthostSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Password|No||Description:|
||||Password.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AuthenticateDevicewithSmarthost|No|Disable|Description:|
||||Enable if device needs to authenticate with the Smarthost.|
||||AuthenticateDevicewithSmarthost confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMARTHOST_AUTH_ENABLE}', '$EMAILPROTECTION{SMARTHOST_AUTH_DISABLE}' are allowed.|
|UseSmarthost|No|Disable|Description:|
||||Enable to redirect outbound emails through a specific email server.|
||||UseSmarthost confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMARTHOST_ENABLE}', '$EMAILPROTECTION{SMARTHOST_DISABLE}' are allowed.|
|Port|No||Description:|
||||Port of the Smarthost. Device is to redirect outbound email traffic on this port.|
||||Port confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 65535 is allowed.|
|Username|No||Description:|
||||Username.|
||||Username confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Hostname|No||Description:|
||||Hostname of the Smarthost.|
||||Hostname confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update Smarthost Settings|200|Operation Successful|
|Update Smarthost Settings|500|Operation Fail|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
