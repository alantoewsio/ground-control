# VPNAuthenticationMethods

- Operation: VPN Authentication Methods
- Description: To configure Authentication settings for VPN.

## Sample Configuration

``` xml
<VPNAuthentication>
    <VPNAuthenticationMethods>SameAsFirewall/Custom</VPNAuthenticationMethods>
    <VPNAuthenticationServerList>
        <AuthenticationServer>ServerName</AuthenticationServer>
        :
    </VPNAuthenticationServerList>
</VPNAuthentication>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|VPNAuthenticationMethods|Yes | |Description:|
||||Enable to use the same authentication method as configured for Firewall.|
||||VPNAuthenticationMethods confines to:|
||||Type is 'SCALAR'.|
||||Only 'on', 'off' are allowed.|
|AuthenticationServer|No | |Description:|
||||Authentication Server that will be used when user tries to login.|
||||AuthenticationServer confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|VPN Authentication Methods|200|VPN authentication settings have been updated successfully|
|VPN Authentication Methods|500|VPN authentication settings could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
