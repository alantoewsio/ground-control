# Schedule

- **Operation**: Add Schedule / Edit Schedule
- **Description**: To Add/Edit Schedule. Schedule defines a time schedule for applying firewall rules or Web and Application Filter policies. 

## Sample Configuration

``` xml
<Schedule>
  <Name>Name</Name>
  <Description>Text</Description>
  <Type>Recurring/OneTime</Type>
  <ScheduleDetails>
    <!-- for onetime -->
    <StartDate>2011-02-28 15:37:52</StartDate>
    <EndDate>2011-03-14 15:38:07</EndDate>
    <!-- for onetime ends -->
    <ScheduleDetail>
      <!-- for recurring type -->
      <Days>WeekDays</Days>
      <StartTime>00:00</StartTime>
      <StopTime>00:00</StopTime>

      <!-- for onetime -->
      <Days>WeekDays</Days>
      <StartTime>00:00</StartTime>
      <StopTime>00:00</StopTime>
    </ScheduleDetail>
    :
  </ScheduleDetails>
</Schedule>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify name to identify the Schedule.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|Description|No | |Description:|
||||Specify Schedule Description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Type|No |Recurring |Description:|
||||Select Type of Schedule: Recurring or One Time.|
||||Type confines to:|
||||Type is 'SCALAR'.|
||||Only 'Recurring', 'OneTime' are allowed.|
|StartDate|Yes | |Description:|
||||Specify Start date if 'One Time' Schedule type is selected.|
||||StartDate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|EndDate|Yes | |Description:|
||||Specify End date if 'One Time' Schedule type is selected.|
||||EndDate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Days|Yes | |Description:|
||||Select days of the week for the schedule to be active.|
||||Days confines to:|
||||Type is 'ARRAY'.|
||||Only 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Week Days', 'Weekdays Including Saturday', 'All Days of week' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|StartTime|Yes | |Description:|
||||Select the Start Time for the Schedule to be active.|
||||StartTime confines to:|
||||Type is 'ARRAY'.|
||||Only '00:00', '00:15', '00:30', '00:45', '01:00', '01:15', '01:30', '01:45', '02:00', '02:15', '02:30', '02:45', '03:00', '03:15', '03:30', '03:45', '04:00', '04:15', '04:30', '04:45', '05:00', '05:15', '05:30', '05:45', '06:00', '06:15', '06:30', '06:45', '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45', '17:00', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '21:45', '22:00', '22:15', '22:30', '22:45', '23:00', '23:15', '23:30', '23:45', '23:59' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|StopTime|Yes | |Description:|
||||Select the End Time for the Schedule to be active.|
||||StopTime confines to:|
||||Type is 'ARRAY'.|
||||Only '00:00', '00:15', '00:30', '00:45', '01:00', '01:15', '01:30', '01:45', '02:00', '02:15', '02:30', '02:45', '03:00', '03:15', '03:30', '03:45', '04:00', '04:15', '04:30', '04:45', '05:00', '05:15', '05:30', '05:45', '06:00', '06:15', '06:30', '06:45', '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45', '17:00', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '21:45', '22:00', '22:15', '22:30', '22:45', '23:00', '23:15', '23:30', '23:45', '23:59' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Schedule|200|Schedule "\<DynamicValue>" has been added successfully.|
|Add Schedule|500|Schedule could not be created.|
|Add Schedule|502|Schedule could not be created. Schedule with the same name as "\<DynamicValue>" already exists, choose a different name.|
|Add Schedule|503|Schedule with the same start and stop time already exists, choose different set of start and stop time.|
|Edit Schedule|200|Schedule "\<DynamicValue>" has been updated successfully.|
|Edit Schedule|202|Schedule "\<DynamicValue>" has been renamed to "\<DynamicValue>" and updated successfully|
|Edit Schedule|500|Schedule could not be updated.|
|Edit Schedule|502|Schedule could not be updated. Schedule with the same name as "\<DynamicValue>" already exists, choose a different name|
|Edit Schedule|503|Schedule with the same start and stop time already exists, choose different set of start and stop time.|

---
---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.