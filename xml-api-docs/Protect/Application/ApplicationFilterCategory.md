# ApplicationFilterCategory

- Operation: Application Category
- Description: To edit Application Category to use in Application Filtering Policy.

## Sample Configuration

``` xml
<ApplicationFilterCategory>
    <Name>Name</Name>
    <ApplicationSettings>
        <Application>
            <Name>Name</Name>
            <QoSPolicy>None/Custom Qos Policy</QoSPolicy>
        </Application>
    </ApplicationSettings>
    <QoSPolicy>None/Custom Qos Policy</QoSPolicy>
    <BandwidthUsageType>Individual/Shared</BandwidthUsageType>
    <Description>Text</Description>
</ApplicationFilterCategory>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Name of the Application Filter Category.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Note:|
||||Category Name cannot be changed.|
|QoSPolicy|Yes | |Description:|
||||Select the QoS Policy to apply to the Application Filter Category.|
||||QoSPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Application Category|200|Traffic shaping policy has been applied successfully|
|Application Category|500|Traffic shaping policy could not be applied|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
