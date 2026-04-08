# ARPConfiguration

- Operation: ARP Configuration
- Description: Configure Address Resolution Protocol(ARP) which is a protocol that translates IP Address to MAC Address.

## Sample Configuration

``` xml
<ARPConfiguration>
    <ARPCacheEntryTimeOut>Minutes</ARPCacheEntryTimeOut>
    <LogPossibleARPPoisoningAttempts>Enable/Disable</LogPossibleARPPoisoningAttempts>
</ARPConfiguration>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ARPCacheEntryTimeOut|No|2|Description:|
||||Specify time interval after which entries in the cache should be flushed.|
||||ARPCacheEntryTimeOut confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 500 is allowed.|
|LogPossibleARPPoisoningAttempts|No|Disable|Description:|
||||Enable to log the poisoning attempts which happens when there is a mismatch in IP Address or MAC Address at time of ARP Request.|
||||LogPossibleARPPoisoningAttempts confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|ARP Configuration|200|Operation Successful.|
|ARP Configuration|500|Operation Fail.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
