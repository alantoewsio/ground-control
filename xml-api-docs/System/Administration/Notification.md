# Notification

- **Operation**: Test Notification Mail / Update Mail Server Settings
- **Description**: Configure Mail Server for Notification Emails.

## Sample Configuration

``` xml
<Notification>
  <MailServer>1.1.1.1</MailServer>
  <Port>25</Port>
  <AuthenticationRequired>Enable/Disable</AuthenticationRequired>
  <!-- If authentication|is Enable Username,Password tags are required.-->
  <Username>Test</Username>
  <Password>Test</Password>
  <Subject>{Subject for Mail}</Subject>
  <MailBody>{Mail Content}</MailBody>
  <SenderAddress>test@test.com</SenderAddress>
  <Recepient>test@test.com</Recepient>
  <ConnectionSecurity>None/SSLTLS/STARTTLS</ConnectionSecurity>
  <Certificate>ApplianceCertificate</Certificate>
  <IPSecTunnelStatusChangeNotification>Enable/Disable</IPSecTunnelStatusChangeNotification>
  <ManagementInterface>None/{Interface}</ManagementInterface>
  <IPFamily>IPv4/IPv6</IPFamily>
</Notification>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|MailServer|Yes | |Description:|
||||Specify Mail Server IPv4 address/FQDN address.|
||||MailServer confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'IPADDRESS','DOMAIN','IPADDRESS6'.|
||||Maximum characters allowed are 255.|
||||IP Class other than 'MULTICAST', 'RESERVED', 'LOCALHOST', 'UNSPECIFIED', 'BROADCAST', 'LINKLOCAL' is allowed.|
|Port|Yes |25 |Description:|
||||Specify the port number for Mail Server.|
||||Port confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Allowed port range: 1 to 65535|
||||Maximum digits allowed are 5.|
|NotificationServer|No | |Description:|
||||Select how you want to send system-generated notifications: through Firewall Device or through and external email server.|
||||NotificationServer confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '0' are allowed.|
|Username|Yes | |Description:|
||||Specify username if user authentication is enabled.|
||||Username confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Characters not allowed: (^;'"\)|
||||Maximum characters allowed are 50.|
|Password|No | |Description:|
||||Specify password if user authentication is enabled.|
||||Password confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ConnectionSecurity|No | |Description:|
||||Select the Security Method to be applied on Appliance to Mail Server Connection.|
||||ConnectionSecurity confines to:|
||||Type is 'SCALAR'.|
||||Only 'None', 'STARTTLS', 'SSLTLS' are allowed.|
||||Note:|
||||'Select SSL/TLS to enforce the encryption. If not, the appliance will follow the mail server's security preference. For email notifications, it uses the certificate based on email configuration (Email > General settings > SMTP TLS configuration).'.|
|Certificate|No | |Description:|
||||Select Certificate to be used for secured connection.|
||||Certificate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Note:|
||||'When device is in MTA mode. for email notifications, it uses the certificate based on email configuration (Email > General settings > SMTP TLS configuration).'.|
|SenderAddress|Yes | |Description:|
||||Specify the Email address from which notification is to be mailed.|
||||SenderAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'EMAIL'.|
||||Maximum characters allowed are 128.|
|Subject|Yes | |Description:|
||||Specify subject of the test Email.|
||||Subject confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ManagementInterface|No | |Description:|
||||Select the management interface. Its IP address will be sent in email notifications.|
||||ManagementInterface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|IPFamily|No | |Description:|
||||IP family of the selected management interface for email notifications|
||||IPFamily confines to:|
||||Type is 'SCALAR'.|
||||Only 'IPv4', 'IPv6' are allowed.|
|AuthenticationRequired|No | |Description:|
||||Enable if authentication is required to access Mail Server.|
||||AuthenticationRequired confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|
|MailBody|Yes | |Description:|
||||Specify the message to be sent via Email.|
||||MailBody confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Recepient|Yes | |Description:|
||||Specify the Email address to which the notification is to be mailed.|
||||Recepient confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'EMAIL'.|
||||Maximum characters allowed are 128.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Test Notification Mail|200|Sent a test email. Check the mail server to make sure it's delivered.|
|Test Notification Mail|500|Failed to send the test mail on the email address. For more details, refer to the log viewer|
|Test Notification Mail|541|Failed to connect to the mail server. For more information please check the log viewer|
|Test Notification Mail|542|SMTP server failed to respond. Please try after some time|
|Test Notification Mail|543|Password mismatch. Please enter the correct password|
|Test Notification Mail|544|Authentication method mismatch. Please confirm the authentication method support for LOGIN or PLAIN on the mail server|
|Test Notification Mail|545|Connection security method STARTTLS not supported by the server. Please check the mail notification configuration|
|Test Notification Mail|546|Mail server refused to communicate. For more information please check the log viewer|
|Update Mail Server Settings|200|Notification setting has been applied successfully|
|Update Mail Server Settings|500|Notification setting could not be updated|

---
© Copyright 2019 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
