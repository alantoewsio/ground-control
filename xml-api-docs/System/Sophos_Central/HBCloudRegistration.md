# HBCloudRegistration

- **Operation**: Heartbeat Sophos Central Registration
- **Description**: To register your Sophos Central account to the Sophos Firewall OS.

## Sample Configuration

``` xml
<HBCloudRegistration>
    <Username>email address</Username>
    <Password>password</Password>
</HBCloudRegistration>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Password|Yes | |Description:|
||||Enter the password of your Sophos Central account|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Username|Yes | |Description:|
||||Enter the email address of your Sophos Central account.|
||||Username confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Heartbeat Sophos Central Registration|200|Firewall registered with Sophos Central successfully.|
|Heartbeat Sophos Central Registration|500|Couldn't register the firewall with Sophos Central. Verify your Sophos Central credentials.|
|Heartbeat Sophos Central Registration|541|Temporary error while accessing Sophos Central, please try again|
|Heartbeat Sophos Central Registration|542|The operation timed out, please try again later|
|Heartbeat Sophos Central Registration|543|Email address or password incorrect, verify your account credentials|
|Heartbeat Sophos Central Registration|544|Sophos Central identity could not be verified|
|Heartbeat Sophos Central Registration|545|Detected stand-alone node. Stopping Sophos Central registration to prevent inconsistent node statuses.|

---
---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
