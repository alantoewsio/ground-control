# PasswordComplexitySettings

- **Operation**: Admin Password Complexity Settings
- **Description**: Set Complexity for Admin Password.

## Sample Configuration

``` xml
<AdminSettings>
  <PasswordComplexitySettings>
    <PasswordComplexityCheck>Enable/Disable</PasswordComplexityCheck>
      <PasswordComplexity>
      <MinimumPasswordLength>Disable/Enable</MinimumPasswordLength>
      <!-- IF MinimumPasswordLength Is Enable -->
        <MinimumPasswordLengthValue>{Value}</MinimumPasswordLengthValue>
        <IncludeAlphabeticCharacters>Enable/Disable</IncludeAlphabeticCharacters>
        <IncludeNumericCharacter>Enable/Disable</IncludeNumericCharacter>
        <IncludeSpecialCharacter>Enable/Disable</IncludeSpecialCharacter>
      </PasswordComplexity>
  </PasswordComplexitySettings>
</AdminSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|MinimumPasswordLengthValue|No |8 |Description:|
||||Minimum number of characters required in password.|
||||MinimumPasswordLengthValue confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 5 to 20 is allowed.|
|IncludeAlphabeticCharacters|No | |Description:|
||||Enable to enforce check for minimum One (1) Upper and One (1) Lower case character.|
||||IncludeAlphabeticCharacters confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|
|IncludeNumericCharacter|No | |Description:|
||||Enable to enforce check for minimum One (1) numeric character.|
||||IncludeNumericCharacter confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|
|IncludeSpecialCharacter|No | |Description:|
||||Enable to enforce check for minimum One (1) special character.|
||||IncludeSpecialCharacter confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|
|MinimumPasswordLength|No |8 |Description:|
||||Enable to enforce minimum password length check.|
||||MinimumPasswordLength confines to:|
||||Type is 'SCALAR'.|
||||Only '8' are allowed.|
||||Note:|
||||By default, the minimum Password length is eight (8)characters.|
|PasswordComplexityCheck|No | |Description:|
||||Enable to set Password Complexity Settings.|
||||PasswordComplexityCheck confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Admin Password Complexity Settings|200|Admin password complexity setting has been updated successfully|
|Admin Password Complexity Settings|500|Administrator password complexity setting update failed|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
