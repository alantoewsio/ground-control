# AdminAuthenticationMethods

- Operation: Configure Administrator Authentication Server
- Description: To Configure Authentication settings for all Administrator users except for global super administrator 'admin'.

## Sample Configuration

``` xml
<AdminAuthentication>
    <AuthenticationMethods>SameAsFirewall/Custom</AuthenticationMethods>
    <AuthenticationServerList>
        <AuthenticationServer>ServerName</AuthenticationServer>
        :
    </AuthenticationServerList>
</AdminAuthentication>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|AuthenticationServer|No | |Description:|
||||Enable to use same authentication method as configured for Firewall.|
||||AuthenticationServer confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|AuthenticationMethods|Yes | |Description:|
||||Authentication Server to be used when user tries to login.|
||||AuthenticationMethods confines to:|
||||Type is 'SCALAR'.|
||||Only 'on' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Configure Administrator Authentication Server|200|Authentication settings for admin have been updated successfully|
|Configure Administrator Authentication Server|500|Authentication settings for admin could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
