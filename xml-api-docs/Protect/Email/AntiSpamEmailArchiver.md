# AntiSpamEmailArchiver

- Operation: Add Email Archiver / Edit Email Archiver
- Description: To Add/Edit Email Archiver for archiving all the Emails.

## Sample Configuration

``` xml
<AntiSpamEmailArchiver>
    <Name>name</Name>
    <RecipientList>
        <Recipient>EmailAddress</Recipient>
        :
    </RecipientList>
    <SendCopyOfEmailTo>EmailAddress</SendCopyOfEmailTo>
</AntiSpamEmailArchiver>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name for Email Archiver.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||To separate words, use a space.|
||||Maximum characters allowed are 50.|
|Recipient|Yes | |Description:|
||||Select the Email Address of the Recipient to archive the Emails.|
||||Recipient confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SendCopyOfEmailTo|Yes | |Description:|
||||Specify Email Address to which the Email Copy is to be sent.|
||||SendCopyOfEmailTo confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'EMAIL'.|
||||Maximum characters allowed are 50.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Email Archiver|200|Email journal "\<DynamicValue>" has been created successfully|
|Add Email Archiver|500|Email journal "\<DynamicValue>" could not be created|
|Add Email Archiver|502|Email journal could not be created. Email journal with same name as "\<DynamicValue>" already exists, choose a different name|
|Edit Email Archiver|200|Email journal "\<DynamicValue>" has been updated successfully|
|Edit Email Archiver|500|Email journal "\<DynamicValue>" could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
