# PatternDownload

- Operation: Pattern update
Description: Pattern download and installation

## Sample Configuration

``` xml
<PatternDownload>
  <AutoUpdate>On/Off</AutoUpdate>
  <Interval>Every Hour/Every 2 Hours/Every 4 Hours/Every 12 Hours/Daily/Every 2 Days</Interval>
</PatternDownload>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Interval|No | |Description:|
||||Specify 'pattern_interval'|
||||Interval confines to:|
||||Type is 'SCALAR'.|
||||Only 'Every 15 minutes', 'Every 30 minutes', 'Every Hour', 'Every 2 Hours', 'Every 4 Hours', 'Every 12 Hours', 'Daily', 'Every 2 Days' are allowed.|
|AutoUpdate|Yes | |Description:|
||||Specify 'pattern_download_mode'|
||||AutoUpdate confines to:|
||||Type is 'SCALAR'.|
||||Only 'On', 'Off' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Pattern update|200|Pattern download/installation interval updated successfully|
|Pattern update|500|Pattern download/installation interval could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
