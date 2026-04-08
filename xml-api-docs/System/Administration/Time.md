# Time

- **Operation**: System Time Configuration
- **Description**: To set System Date and Time.

## Sample Configuration

``` xml
<Time>
  <TimeZone>Europe/London</TimeZone>
  <SetDateTime>
    <Date>
      <Year>2013</Year>
      <Month>10</Month>
      <Day>09</Day>
    </Date>
    <Time>
      <HH>19</HH>
      <MM>39</MM>
      <SS>31</SS>
    </Time>
  </SetDateTime>
  <PredefinedNTPServer>Enable/Disable</PredefinedNTPServer>
  <CustomNTPServer>
    <NTPServer>1.1.1.1</NTPServer>
    <NTPServer>demo.ntp.org</NTPServer>
  </CustomNTPServer>
  <SyncNow>0/1</SyncNow>
</Time>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|TimeZone|No | |Description:|
||||Select time Zone according to the geographical region in which the appliance is deployed.|
||||TimeZone confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SyncwithNTPServer|Yes | |Description:|
||||Select to synchronize the appliance time automatically with an NTP server.|
||||SyncwithNTPServer confines to:|
||||Type is 'SCALAR'.|
||||Maximum characters allowed are 1.|
||||Only '0', '1' are allowed.|
|Date|No | |Description:|
||||Set Date for appliance's clock.|
||||Date confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Day|No | |Description:|
||||Set Day for appliance's clock.|
||||Day confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Maximum digits allowed are 2.|
|Month|No | |Description:|
||||Set Month for appliance's clock.|
||||Month confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 12 is allowed.|
||||Maximum digits allowed are 2.|
|Year|No | |Description:|
||||Set year for appliance's clock.|
||||Year confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Maximum digits allowed are 4.|
|HH|No | |Description:|
||||Set Hour for appliance's clock.|
||||HH confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 23 is allowed.|
||||Maximum digits allowed are 2.|
|MM|No | |Description:|
||||Set Minutes for appliance's clock.|
||||MM confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 59 is allowed.|
||||Maximum digits allowed are 2.|
|SS|No | |Description:|
||||Set Seconds for appliance's clock.|
||||SS confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 59 is allowed.|
||||Maximum digits allowed are 2.|
|Timezone Category|No | |Description:|
||||To set different Timezone Category.|
||||Timezone Category confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|NTPServer|No | |Description:|
||||Specify NTP server IPv4/IPv6 address or domain name to synchronize appliance's time with custom server.|
||||NTPServer confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
||||Multiple values are allowed.|
|SyncNow|No | |Description:|
||||Synchronizes the firewall clock with the NTP server immediately.|
||||SyncNow confines to:|
||||Type is 'SCALAR'.|
||||Maximum characters allowed are 1.|
||||Only '0', '1' are allowed.|
|PredefinedNTPServer|No | |Description:|
||||Select to use either pre-defined NTP server or custom NTP server.|
||||PredefinedNTPServer confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', '2' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|System Time Configuration|200|Time settings has been applied successfully|
|System Time Configuration|500|Time settings could not be applied|

---
© Copyright 2019 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
