# AdminPassword

- **Operation**: Change Admin Password
- **Description**: Settings to change Admin Password.

## Sample Configuration

``` xml
<AdminPassword>
    <CurrentPassword>oldpassword</CurrentPassword>
    <NewPassword>newpassword</NewPassword>
</AdminPassword>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|UserName|No |admin |Description:|
||||User Name for the Admin.|
||||UserName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Note:|
||||Modification of user name is not allowed.|
|CurrentPassword|Yes | |Description:|
||||Specify current admin password.|
||||CurrentPassword confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 70.|
|NewPassword|Yes | |Description:|
||||Specify new admin password.|
||||NewPassword confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Change Admin Password|200|Password has been changed successfully|
|Change Admin Password|500|Password change for default admin failed|
|Change Admin Password|510|Couldn't change the password. If MFA is turned on for the default admin account, you must enter the current password followed by the verification code.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
