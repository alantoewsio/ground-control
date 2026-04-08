# AntiSpamTrustedDomain

- Operation: Add Domain Name
- Description: To Add Trusted Domain name for bypassing scanning of mails from trusted domains.

## Sample Configuration

``` xml
<AntiSpamTrustedDomain>
    <DomainList>
        <DomainName>name</DomainName>
        :
    </DomainList>
</AntiSpamTrustedDomain>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|DomainName|Yes | |Description:|
||||Specify the name for the Trusted Domain.|
||||DomainName confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Domain Name|200|Domain has been added successfully|
|Add Domain Name|500|Domain could not be added|
|Add Domain Name|502|Domain could not be added. Domain already exists. Choose a different domain|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
