# DefaultConfigurationLanguage

- **Operation**: i18 Default Configuration
- **Description**: Set Default Configuration Language.

## Sample Configuration

``` xml
<AdminSettings>
  <DefaultConfigurationLanguage>English/Hindi/Chinese-Traditional/Chinese-Simplified/French/Japanese</DefaultConfigurationLanguage>
</AdminSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|DefaultConfigurationLanguage|Yes |English |Description:|
||||Select language for all default configuration of Appliance.|
||||DefaultConfigurationLanguage confines to:|
||||Type is 'SCALAR'.|
||||Only 'English', 'Hindi', 'Chinese-Traditional', 'Chinese-Simplified', 'French', 'Japanese', 'German', 'Italian', 'Korean', 'Brazilian-Portuguese', 'Russian', 'Spanish' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|i18 Default Configuration|200|Default configuration language updated successfully|
|i18 Default Configuration|500|Default configuration language could not be updated|
|i18 Default Configuration|531|A process using the same resources is executing parallelly. Please wait for it to conclude|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
