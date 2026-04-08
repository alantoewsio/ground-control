# OTPSettings

- Operation: Configure OTP
- Description: Configure global OTP parameters.

## Sample Configuration

``` xml
<OTPSettings>
    <otp />
    <allUsers />
    <otpUsers>
        <user />
    </otpUsers>
    <tokenAutoCreation />
    <otpUserPortal />
    <otpVPNPortal />
    <otpSSLVPN />
    <otpWebAdmin />
    <otpIPsec />
    <defaultTimeStep />
    <maxTimeStepsInterval />
    <maxInitialTimeStepDiff />
</OTPSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|otp|No | |Description:|
||||Switch OTP on or off.|
||||otp confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|allUsers|No | |Description:|
||||Require all users to provide One Time Passwords. Otherwise OTP has to be enabled for users or groups explicitly.|
||||allUsers confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|tokenAutoCreation|No | |Description:|
||||User specific OTP tokens may be generated automatically when a user is created. This feature can be switched on or off.|
||||tokenAutoCreation confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|otpUserPortal|No | |Description:|
||||Access to selected facilities may require One Time Passwords. Those facilities can be selected here.|
||||otpUserPortal confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|otpVPNPortal|No | |Description:|
||||Determines if multi-factor authentication is required for users signing in to the VPN portal.|
||||otpVPNPortal confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|otpSSLVPN|No | |Description:|
||||Access to selected facilities may require One Time Passwords. Those facilities can be selected here.|
||||otpSSLVPN confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|otpWebAdmin|No | |Description:|
||||Access to selected facilities may require One Time Passwords. Those facilities can be selected here.|
||||otpWebAdmin confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|otpIPsec|No | |Description:|
||||Access to selected facilities may require One Time Passwords. Those facilities can be selected here.|
||||otpIPsec confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|waf|No | |Description:|
||||Access to selected facilities may require One Time Passwords. Those facilities can be selected here.|
||||waf confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|hotspot|No | |Description:|
||||Access to selected facilities may require One Time Passwords. Those facilities can be selected here.|
||||hotspot confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|defaultTimeStep|No | |Description:|
||||The One Time Password can only be used once within a certain time interval. The length of that interval can be selected here.|
||||defaultTimeStep confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 10 to 300 is allowed.|
||||Maximum digits allowed are 3.|
|maxTimeStepsInterval|No | |Description:|
||||Due to clock drift the matching One Time Passwords is looked for max time steps back and forward in time, respectively.|
||||maxTimeStepsInterval confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 10 is allowed.|
||||Maximum digits allowed are 2.|
|maxInitialTimeStepDiff|No | |Description:|
||||Due to missing clock synchronization, at the very first utilization of an OTP token the matching One Time Password is looked for max time steps back and forward in time, respectively.|
||||maxInitialTimeStepDiff confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 600 is allowed.|
||||Maximum digits allowed are 3.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Configure OTP|200|OTP configuration updated successfully|
|Configure OTP|500|OTP configuration could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
