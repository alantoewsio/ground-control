# WebFilterNotificationSettings

- Operation: Update Web Filter User Notification Settings
- Description: To update Web Filter User Notification Settings.

## Sample Configuration

``` xml
<WebFilterNotificationSettings>
    <OverrideDefaultDeniedMessage>Enable/Disable</OverrideDefaultDeniedMessage>
    <DefaultDeniedMessage>Default/{Message}</DefaultDeniedMessage>
    <OverrideDefaultWarnedMessage>Enable/Disable</OverrideDefaultWarnedMessage>
    <DefaultWarnedMessage>Default/{Message}</DefaultWarnedMessage>
    <DeniedMessageImage>Default/Custom</DeniedMessageImage>
    <TopImageFile>{FileNamePassedInMultipartRequest}</TopImageFile>
    <BottomImageFile>{FileNamePassedInMultipartRequest}</BottomImageFile>
</WebFilterNotificationSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|OverrideDefaultDeniedMessage|No|Enable|Description:|
||||Enable to override default Denied Message.|
||||OverrideDefaultDeniedMessage confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|DefaultDeniedMessage|No||Description:|
||||Custom Category Denied Message in HTML.|
||||DefaultDeniedMessage confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|OverrideDefaultWarnedMessage|No|Enable|Description:|
||||Enable to override default Warned Message.|
||||OverrideDefaultWarnedMessage confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|DefaultWarnedMessage|No||Description:|
||||Custom Category Warned Message in HTML.|
||||DefaultWarnedMessage confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|OverrideDefaultOverrideMessage|No|Enable|Description:|
||||Enable to override default override message.|
||||OverrideDefaultOverrideMessage confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|DefaultOverrideMessage|No||Description:|
||||Custom category override message in HTML.|
||||DefaultOverrideMessage confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|OverrideDefaultQuotaMessage|No|Enable|Description:|
||||Enable to override default quota usage message.|
||||OverrideDefaultQuotaMessage confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|DefaultQuotaMessage|No||Description:|
||||Custom category quota usage message in HTML.|
||||DefaultQuotaMessage confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DeniedMessageImage|No||Description:|
||||Select to display default or custom image on notification page.|
||||DeniedMessageImage confines to:|
||||Type is 'SCALAR'.|
||||Only 'Default', 'Custom' are allowed.|
|TopImageFile|No||Description:|
||||Specify the image to display at the top of the message page.|
||||TopImageFile confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'FILE'.|
||||File formats 'jpg', 'jpeg' are allowed.|
|BottomImageFile|No||Description:|
||||Specify the image to display at the bottom of the message page.|
||||BottomImageFile confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'FILE'.|
||||File formats 'jpg', 'jpeg' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update Web Filter User Notification Settings|200|Web filter settings have been updated successfully|
|Update Web Filter User Notification Settings|500|Web filter settings could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
