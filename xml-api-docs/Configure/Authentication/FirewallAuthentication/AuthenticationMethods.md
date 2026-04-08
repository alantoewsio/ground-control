# AuthenticationMethods

- Operation: Configure Firewall
- Description: To configure authentication settings for Firewall.

## Sample Configuration

``` xml
<FirewallAuthentication>
    <AuthenticationMethods>
        <AuthenticationServerList>
            <AuthenticationServer>ServerName</AuthenticationServer>
            <AuthenticationServer>ServerName</AuthenticationServer>
            <AuthenticationServer>ServerName</AuthenticationServer>
        </AuthenticationServerList>
        <DefaultGroup>OpenGroup</DefaultGroup>
    </AuthenticationMethods>
</FirewallAuthentication>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|DefaultGroup|No | |Description:|
||||Select default group for the Authentication Server.|
||||DefaultGroup confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AuthenticationServer|No | |Description:|
||||Select Authentication Server to be used for authentication when the user tries to login.|
||||AuthenticationServer confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Configure Firewall|200|Firewall authentication settings have been updated successfully|
|Configure Firewall|500|Firewall authentication settings could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
