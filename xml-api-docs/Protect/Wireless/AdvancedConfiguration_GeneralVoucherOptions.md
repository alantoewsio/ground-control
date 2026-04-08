# AdvancedConfiguration_GeneralVoucherOptions

- Operation: Update Hotspot Voucher Options
- Description: To update Hotspot Voucher Options.

## Sample Configuration

``` xml
<AdvancedConfiguration>
    <GeneralVoucherOptions>
        <DeleteOption>Enable/Disable</DeleteOption>
        <DeleteExpiredVouchersAfter>days in integer</DeleteExpiredVouchersAfter>
    </GeneralVoucherOptions>
</AdvancedConfiguration>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|DeleteOption|No||Description:|
||||Enable if you want to delete expired vouchers from the database.|
||||DeleteOption confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|DeleteExpiredVouchersAfter|No||Description:|
||||Select time interval after which you want to delete expired vouchers from the database.|
||||DeleteExpiredVouchersAfter confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update Hotspot Voucher Options|200|General voucher options updated successfully|
|Update Hotspot Voucher Options|500|General voucher options could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
