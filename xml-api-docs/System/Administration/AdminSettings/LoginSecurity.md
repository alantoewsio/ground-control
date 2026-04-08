# LoginSecurity

- **Operation**: Login Security Settings
- **Description**: Configure Login Security Settings for Remote Administrators.

## Sample Configuration

``` xml
<AdminSettings>
  <LoginSecurity>
    <LockSession>Disable/{value}</LockSession>
    <LogoutSession>Disable/{value}</LogoutSession>
    <BlockLogin>Enable/Disable</BlockLogin>
    <BlockLoginSettings>
      <UnsucccessfulAttempt>2</UnsucccessfulAttempt>
      <Duration>20</Duration>
      <ForMinutes>3</ForMinutes>
    </BlockLoginSettings>
  </LoginSecurity>
</AdminSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|LogoutSession|No | |Description:|
||||Enable to logout Admin Session after configured timeout.|
||||LogoutSession confines to:|
||||Type is 'SCALAR'.|
||||Only '1' are allowed.|
|LogoutSession|No |10 |Description:|
||||Inactivity Timeout in minutes to logout Admin session.|
||||LogoutSession confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 120 is allowed.|
||||Maximum digits allowed are 3.|
||||Note:|
||||Admin Session Logout time value must be greater than Lock Admin Session time.|
|BlockLogin|No | |Description:|
||||Enable to block Admin login after configured number of failed attempts within configured time span.|
||||BlockLogin confines to:|
||||Type is 'SCALAR'.|
||||Maximum characters allowed are 1.|
||||Only 'Enable' are allowed.|
|UnsucccessfulAttempt|No |2 |Description:|
||||Allowed number of failed Admin login attempts from the same IP address.|
||||UnsucccessfulAttempt confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 5 is allowed.|
||||Maximum digits allowed are 1.|
|Duration|No |20 |Description:|
||||Time span within which if Admin Login attempts exceed configured ???Unsuccessful Attempts???, then Admin Login gets blocked.|
||||Duration confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 120 is allowed.|
|ForMinutes|No |3 |Description:|
||||Time interval for which Admin Login is blocked.|
||||ForMinutes confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 60 is allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Login Security Settings|200|Login security setting has been updated successfully|
|Login Security Settings|500|Login security setting update failed|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
