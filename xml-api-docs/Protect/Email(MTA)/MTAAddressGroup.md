# MTAAddressGroup

- Operation: Add Address Group / Edit Address Group
- Description: To Add/Edit Address Group for applying Anti Spam scanning rules to group of Email Addresses, IP Addresses or RBLs when MTA Mode is enabled.

## Sample Configuration

``` xml
<MTAAddressGroup>
    <Name>add1</Name>
    <GroupType>EmailAddressOrDomain</GroupType>
    <Description>dsdsadsad</Description>
    <EmailImportType>Manual</EmailImportType>
    <EmailAddressList>
        <EmailAddressDomain>this.com</EmailAddressDomain>
    </EmailAddressList>
</MTAAddressGroup>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Specify a name for the Address Group.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||ADDRESSGRPNAME|
||||Maximum characters allowed are 50.|
|GroupType|No||Description:|
||||Select the Group type from the options available: RBL, IPv4 Address or Email Address/Domain.|
||||GroupType confines to:|
||||Type is 'SCALAR'.|
||||Only 'RBLIPv4', 'IPAddress', 'EmailAddressOrDomain', 'RBLIPv6' are allowed.|
|RBLName/EmailAddressDomain/IPAddressNetwork|Yes||Description:|
||||Specify RBL name/IP Address/Email to include in the Address Group.|
||||RBLName/EmailAddressDomain/IPAddressNetwork confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Specify a valid email address.|
||||To separate words, use a dot (.).|
||||Maximum characters allowed are 100.|
||||Multiple values are allowed.|
||||Duplicate values will be ignored.|
|Description|No||Description:|
||||Specify Address Group description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|EmailImportType|No||Description:|
||||If Email/Domain is selected as Group Type, select whether to include Email Addresses manually or import from a file.|
||||EmailImportType confines to:|
||||Type is 'SCALAR'.|
||||Only 'Import', 'Manual' are allowed.|
|EmailAddressFile|No||Description:|
||||Specify the Email Address/Domain for 'Manual' import type.|
||||EmailAddressFile confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||File formats 'csv', 'txt' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Address Group|200|Address group "\<DynamicValue>" has been added successfully|
|Add Address Group|500|Address group "\<DynamicValue>" could not be added|
|Add Address Group|502|Address group could not be added. Address group "\<DynamicValue>" already exists, choose a different name|
|Add Address Group|541|Address group "\<DynamicValue>" could not be added because all email addresses/domains are invalid in uploaded file|
|Add Address Group|542|Address group "\<DynamicValue>" could not be added because uploaded file was empty|
|Add Address Group|543|Can't import file. It contains more than 400 email addresses or domains|
|Edit Address Group|200|Address group "\<DynamicValue>" has been updated successfully|
|Edit Address Group|500|Address group "\<DynamicValue>" could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
