# ZeroDayProtectionSettings

- Operation: Update zero-day protection configuration
- Description: To update zero-day protection settings.

## Sample Configuration

``` xml
<ZeroDayProtectionSettings>
    <DataCenterLocation>sandbox.sophos.com/us.sandbox.sophos.com/de.sandbox.sophos.com/eu.sandbox.sophos.com/apac.sandbox.sophos.com/au.analysis.sophos.com</DataCenterLocation>
    <ExcludeFileTypes>Audio Files,Compressed Files,Database File</ExcludeFileTypes>
</ZeroDayProtectionSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|DataCenterLocation|No | |Description:|
||||Data center to use for zero-day protection.|
||||DataCenterLocation confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ExcludeFileTypes|No | |Description:|
||||Names of the file types to exclude from zero-day protection.|
||||ExcludeFileTypes confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update zero-day protection configuration|200|Zero-day protection settings are updated successfully.|
|Update zero-day protection configuration|500|Failed to update zero-day protection settings.|
|Update zero-day protection configuration|502|Couldn't update the zero-day protection settings. The selected file types exceed the limit of 50.|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
