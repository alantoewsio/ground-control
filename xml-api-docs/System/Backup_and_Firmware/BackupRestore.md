#BackupRestore 

- **Operation**: Schedule Backup
- **Description**: Settings for scheduling backup.

## Sample Configuration

``` xml
<BackupRestore>
  <ScheduleBackup>
    <BackupMode>FTP/Mail/Local</BackupMode>
    <BackupPrefix>Test</BackupPrefix>
    <FTPServer>1.1.1.1</FTPServer><!-- For FTP -->
    <Username>Test</Username><!-- For FTP -->
    <Password>Test</Password><!-- For FTP -->
    <FtpPath>/usr/backup</FtpPath><!-- For FTP -->
    <EmailAddress>test@test.com</EmailAddress><!--For Mail -->
    <BackupFrequency>Never/Daily/Weekly/Monthly</BackupFrequency>
    <Day>Sunday</Day>
    <Hour>01</Hour>
    <Minute>30</Minute>
    <Date>12</Date>
    <EncryptionPassword>Test</EncryptionPassword>
  </ScheduleBackup>
</BackupRestore>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|BackupPrefix|No | |Description:|
||||Prefix of Backup file|
||||BackupPrefix confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 32.|
|BackupMode|No | |Description:|
||||Select how and to whom the backup files are to be sent.|
||||BackupMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'FTP', 'Mail', 'Local' are allowed.|
|FTPServer|Yes | |Description:|
||||Specify FTP Server IP address if backup is to be stored on FTP Server.|
||||FTPServer confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS','IPADDRESS6'.|
||||Maximum characters allowed are 45.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|Username|Yes | |Description:|
||||Specify Username if backup is to be stored on FTP Server.|
||||Username confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|Password|No | |Description:|
||||Specify Password if backup is to be stored on FTP Server.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|EmailAddress|Yes | |Description:|
||||Specify Email ID on which the backup is to be mailed.|
||||EmailAddress confines to:|
||||Type is 'CSV'.|
||||Datatype is 'EMAIL'.|
||||Comma separated values are allowed.|
||||Maximum characters allowed are 300.|
|Date|Yes | |Description:|
||||DATE|
||||Date confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 31 is allowed.|
|Minute|Yes | |Description:|
||||Minutes|
||||Minute confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 59 is allowed.|
|EncryptionPassword|No | |Description:|
||||Specify password to encrypt backup|
||||EncryptionPassword confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 1023.|
||||Minimum characters allowed are 12.|
|Day|Yes | |Description:|
||||weekday of Backup file|
||||Day confines to:|
||||Type is 'SCALAR'.|
||||Only 'Sunday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Monday' are allowed.|
|FtpPath|No | |Description:|
||||ftppath of Backup file|
||||FtpPath confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 1024.|
||||UTF-8 character(s) are allowed.|
||||Character forward slash (/) is not allowed.|
|BackupFrequency|No | |Description:|
||||Select system data backup frequency from the options available.|
||||BackupFrequency confines to:|
||||Type is 'SCALAR'.|
||||Only 'Never', 'Monthly', 'Weekly', 'Daily' are allowed.|
|Hour|Yes | |Description:|
||||Hour|
||||Hour confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 23 is allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Schedule Backup Now|200|Backup schedule settings have been updated successfully|
|Schedule Backup Now|500|Update backup schedule settings failed|
|Schedule Backup|200|Backup schedule settings have been updated successfully|
|Schedule Backup|500|Update backup schedule settings failed|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
