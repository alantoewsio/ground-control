# ApplicationClassificationBatchAssignment

- Operation: Batch Update Application Classification Assignment
- Description: To batch update application classification.

## Sample Configuration

``` xml
<ApplicationClassificationBatchAssignment>
    <ClassAssignmentList>
        <ClassAssignment>
            <app>iCloud</app>
            <class>New</class>
        </ClassAssignment>
        <ClassAssignment>
            <app>iPlay Website</app>
            <class>New</class>
        </ClassAssignment>
    </ClassAssignmentList>
</ApplicationClassificationBatchAssignment>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ClassAssignmentList|No | |Description:|
||||Specify classifications to be updated.|
||||ClassAssignmentList confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'OBJECT'.|
||||appfilter::applicationclassificationassignment|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Batch Update Application Classification Assignment|200|Operation Successful|
|Batch Update Application Classification Assignment|500|Operation Fail|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
