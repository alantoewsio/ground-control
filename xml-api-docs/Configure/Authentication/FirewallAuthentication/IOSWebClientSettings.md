# IOSWebClientSettings

- Operation: Configure IOS Web Client
- Description: To configure authentication settings for iOS Web Client.

## Sample Configuration

``` xml
<FirewallAuthentication>
    <iOSWebClientSettings>
        <iOSWebClientInActivtyTime>Number</iOSWebClientInActivtyTime>
        <iOSWebClientDataTransferThreshold>Number</iOSWebClientDataTransferThreshold>
    </iOSWebClientSettings>
</FirewallAuthentication>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|iOSWebClientDataTransferThreshold|Yes |1024 |Description:|
||||Specify minimum data in bytes to be transferred within specified time.|
||||iOSWebClientDataTransferThreshold confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 4294967295 is allowed.|
||||Maximum digits allowed are 10.|
|iOSWebClientInActivtyTime|Yes |6 |Description:|
||||Specify inactivity time in minutes after which the user will be logged out and must re-authenticate.|
||||iOSWebClientInActivtyTime confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 6 to 1440 is allowed.|
||||Maximum digits allowed are 4.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Configure IOS Web Client|200|Web client settings (iOS and Android) have been applied successfully|
|Configure IOS Web Client|500|Web client settings (iOS and Android) could not be applied|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
