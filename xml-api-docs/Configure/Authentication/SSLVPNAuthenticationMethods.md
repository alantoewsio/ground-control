# SSLVPNAuthenticationMethods

- Operation: Configure SSL VPN Authentication
- Description: To Configure Authentication Settings for SSL VPN.

## Sample Configuration

``` xml
<SSLVPNAuthentication>
    <SSLVPNAuthenticationMethods>SameAsVPN/SameAsFirewall/Custom</SSLVPNAuthenticationMethods>
    <SSLVPNAuthenticationServerList>
        <AuthenticationServer>ServerName</AuthenticationServer>
        :
    </SSLVPNAuthenticationServerList>
</SSLVPNAuthentication>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|SSLVPNAuthenticationMethods|No | |Description:|
||||Enable to use authentication method same as configured for VPN/Firewall or configure Authentication Server.|
||||SSLVPNAuthenticationMethods confines to:|
||||Type is 'SCALAR'.|
||||Only 'SameAsFirewall', 'SameAsVPN', 'Custom' are allowed.|
|AuthenticationServer|No | |Description:|
||||Authentication Server that will be used when user tries to login.|
||||AuthenticationServer confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Configure SSL VPN Authentication|200|SSL VPN authentication settings have been updated successfully|
|Configure SSL VPN Authentication|500|SSL VPN authentication settings could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
