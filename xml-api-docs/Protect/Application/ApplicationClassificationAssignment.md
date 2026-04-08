# ApplicationClassificationAssignment

- Operation: Update Application Classification Assignment
- Description: To update application classification.

## Sample Configuration

``` xml
<ApplicationClassificationAssignment>
    <Application>Facebook Website</Application>
    <Classification>New</Classification>
</ApplicationClassificationAssignment>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Application|Yes | |Description:|
||||Specify the application for updating the classification.|
||||Application confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Classification|Yes | |Description:|
||||Specify the classification for the application.|
||||Classification confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update Application Classification Assignment|200|Application classification has been updated successfully|
|Update Application Classification Assignment|500|Application classification could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
