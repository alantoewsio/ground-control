# LoginDisclaimer

- **Operation**: Login Disclaimer Settings
- **Description**: Configure Disclaimer displayed at Admin Login.

## Sample Configuration

``` xml
<AdminSettings>
  <LoginDisclaimer>Enable/Disable</LoginDisclaimer>
</AdminSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|LoginDisclaimer|No | |Description:|
||||Enable to display disclaimer at Admin Login.|
||||LoginDisclaimer confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Login Disclaimer Settings|200|Login disclaimer setting has been updated successfully|
|Login Disclaimer Settings|500|Login disclaimer setting update failed|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
