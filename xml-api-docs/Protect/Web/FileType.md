# FileType

- Operation: Add File Type / Edit File Type
- Description: To Add/Edit File Type. File Type is a grouping of file extensions or MIME headers.

## Sample Configuration

``` xml
<FileType>
    <Name>Name</Name>
    <Template>Blank</Template><!-- If template is selected all extensions & mime header should be added by opcode and if mentioned separatly add them in list -->
    <FileExtensionList>
        <FileExtension>file extensions like txt,jpg,gif</FileExtension>
        <FileExtension>file extensions like txt,jpg,gif</FileExtension>
        <FileExtension>file extensions like txt,jpg,gif</FileExtension>
        <FileExtension>file extensions like txt,jpg,gif</FileExtension>
    </FileExtensionList>
    <MIMEHeaderList>
        <MIMEHeader>MIME headers</MIMEHeader>
        <MIMEHeader>MIME headers</MIMEHeader>
        <MIMEHeader>MIME headers</MIMEHeader>
        <MIMEHeader>MIME headers</MIMEHeader>
    </MIMEHeaderList>
    <Description>Text</Description>
</FileType>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Specify a name to identify the File Type Category.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|Template|No|Blank|Description:|
||||Select a template for the File Type Category.|
||||Template confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|FileExtension|No||Description:|
||||Enter File Extensions to be included in the Category.|
||||FileExtension confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|MIMEHeader|No||Description:|
||||Enter MIME Header to be included in the Category.|
||||MIMEHeader confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Description|No||Description:|
||||Specify File Type Category description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 1000.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add File Type|200|File type "\<DynamicValue>" has been added successfully|
|Add File Type|500|File type could not be added|
|Add File Type|502|File type could not be added. File type "\<DynamicValue>" already exists, choose a different name|
|Add File Type|503|File type category contains duplicate file extensions|
|Add File Type|505|Extensions or MIME headers contain invalid characters|
|Edit File Type|200|File type "\<DynamicValue>" has been updated successfully|
|Edit File Type|202|File type "\<DynamicValue>" has been renamed to "\<DynamicValue>" and updated successfully|
|Edit File Type|500|File type could not be updated|
|Edit File Type|502|File type could not be updated. File type "\<DynamicValue>" already exists, choose a different name|
|Edit File Type|503|File type category contains duplicate file extensions|
|Edit File Type|505|Extensions or MIME headers contain invalid characters|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
