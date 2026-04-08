# NetFlowConfiguration

- **Operation**: Configure Netflow / Configure Netflow
- **Description**:

## Sample Configuration

``` xml
<NetFlowConfiguration>
  <Server>
    <ServerName />
    <NetflowServer />
    <NetflowServerPort />
  </Server>
</NetFlowConfiguration>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|No | |Description:|
||||Specify a unique name for Netflow server.|
||||Name confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 32.|
||||UTF-8 character(s) are allowed.|
||||Multiple values are allowed.|
|NetflowServer|No | |Description:|
||||Specify IP Address (IPv4 / IPv6) or domain name of the Netflow Server.|
||||NetflowServer confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'IPADDRESS','DOMAIN','STRING'.|
||||Multiple values are allowed.|
|NetflowServerPort|No |2055 |Description:|
||||Specify the UDP port number for communication with the Netflow Server.|
||||NetflowServerPort confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'INTEGER'.|
||||Allowed port range: 1 to 65535|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Configure Netflow|200|Netflow configuration has been updated successfully|
|Configure Netflow|500|Netflow configuration could not be updated|
|Configure Netflow|200|Netflow configuration has been updated successfully|
|Configure Netflow|500|Netflow configuration could not be updated|

---
© Copyright 2019 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
