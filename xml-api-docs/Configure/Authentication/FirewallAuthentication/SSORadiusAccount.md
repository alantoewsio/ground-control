# SSORadiusAccount

- Operation: SSO using Radius Accounting request
- Description: To configure SSO authentication settings using RADIUS accounting requests.

## Sample Configuration

``` xml
<FirewallAuthentication>
    <SSORadiusAccount>
        <Radius>
            <ClientIP>ip address</ClientIP>
            <SharedSecret>Text</SharedSecret>
        </Radius>
        :
        :
    </SSORadiusAccount>
</FirewallAuthentication>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ClientIP|No | |Description:|
||||Specifying Radius Client IP.|
||||ClientIP confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'IPADDRESS'.|
||||Maximum characters allowed are 15.|
||||Multiple values are allowed.|
|SharedSecret|No | |Description:|
||||Specifying Shared Secret.|
||||SharedSecret confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|SSO using Radius Accounting request|200|RADIUS client IP address added successfully for RADIUS SSO authentication|
|SSO using Radius Accounting request|500|RADIUS client IP address could not be added successfully for RADIUS SSO authentication|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
