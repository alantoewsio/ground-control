# WebFilterPolicy

- Operation: Add Policy / Update Policy / Update Policy from API
- Description: To Add/Edit Web Filter Policy for controlling user's Web Access.

## Sample Configuration

``` xml
<WebFilterPolicy>
    <Name>Name</Name>
    <Description>Description</Description>
    <DefaultAction>Allow/Deny</DefaultAction>
    <EnableReporting>Enable/Disable</EnableReporting>
    <!-- Maximum permitted size (in MB), between 1 and 1536 MB -->
    <DownloadFileSizeRestriction>300</DownloadFileSizeRestriction>
    <DownloadFileSizeRestrictionEnabled>0/1</DownloadFileSizeRestrictionEnabled>
    <GoogAppDomainListEnabled>0/1</GoogAppDomainListEnabled>
    <!-- comma-separated list of allowed domains for Google Apps -->
    <GoogAppDomainList>gmail.com, yahoo.com</GoogAppDomainList>
    <YoutubeFilterEnabled>0/1</YoutubeFilterEnabled>
    <YoutubeFilterIsStrict>0/1</YoutubeFilterIsStrict>
    <EnforceSafeSearch>0/1</EnforceSafeSearch>
    <EnforceImageLicensing>0/1</EnforceImageLicensing>
    <XFFEnabled>0/1</XFFEnabled>
    <Office365Enabled>0/1</Office365Enabled>
    <!-- comma-separated list of allowed domains or directory ids for Microsoft 365 -->
    <Office365TenantsList>contoso.com,fabrikam.onmicrosoft.com,72f988bf-86f1-41af-91ab-2d7cd011db47</Office365TenantsList>
    <Office365DirectoryId>456ff232-35l2-5h23-b3b3-3236w0826f3d</Office365DirectoryId>
    <QuotaLimit>60</QuotaLimit>
    <RuleList>
        <Rule>
            <CategoryList>
                <Category>
                    <!--category name -->
                    <ID>Extreme</ID>
                    <type>WebCategory/URLGroup/UserActivity/DynamicCategory/FileType</type>
                </Category>
                    :
            </CategoryList>
            <HTTPAction>Deny/Allow/Warn/Log/Quota</HTTPAction>
            <HTTPSAction>Deny/Allow/Warn/Log/Quota</HTTPSAction>
            <FollowHTTPAction>1/0</FollowHTTPAction>
            <Schedule>All The Time</Schedule>
            <PolicyRuleEnabled>1/0</PolicyRuleEnabled>
            <CCLRuleEnabled>1/0</CCLRuleEnabled>
            <UserList>
                <User>User Name</User>
                    :
            </UserList>
            <CCLList>
                <CCL>CCL Name</CCL>
                    :
            </CCLList>
        </Rule>
            :
    </RuleList>
</WebFilterPolicy>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|No||Description:|
||||Specify a name for the Web Filter Policy.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|Description|No||Description:|
||||Specify Policy description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|DefaultAction|Yes||Description:|
||||When default template is not given this parameter should provide for default action of policy.|
||||DefaultAction confines to:|
||||Type is 'SCALAR'.|
||||Only 'Allow', 'Deny' are allowed.|
|EnableReporting|No|Enable|Description:|
||||Select to enable reporting of policy.|
||||EnableReporting confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Template|No||Description:|
||||Select from the available templates to create new policy based on existing policy.|
||||Template confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|DownloadFileSizeRestrictionEnabled|No||Description:|
||||Enable to check for maximum allowed file download size in MB.|
||||DownloadFileSizeRestrictionEnabled confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '0' are allowed.|
|DownloadFileSizeRestriction|Yes||Description:|
||||Specify maximum allowed file download size in MB.|
||||DownloadFileSizeRestriction confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 0 to 1536 is allowed.|
||||Maximum digits allowed are 4.|
|GoogAppDomainListEnabled|No||Description:|
||||Enable to specify domains allowed to access google service.|
||||GoogAppDomainListEnabled confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '0' are allowed.|
|GoogAppDomainList|No||Description:|
||||Specify domains allowed to access google service.|
||||GoogAppDomainList confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 256.|
|YoutubeFilterEnabled|No||Description:|
||||Enable YouTube Restricted Mode to restrict the content that is accessible.|
||||YoutubeFilterEnabled confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '0' are allowed.|
|YoutubeFilterIsStrict|No||Description:|
||||Adjust the policy used for YouTube Restricted Mode.|
||||YoutubeFilterIsStrict confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '0' are allowed.|
|EnforceSafeSearch|No||Description:|
||||Enable to block websites containing pornography and explicit sexual content from appearing in the search results of Google, Yahoo, Bing search results.|
||||EnforceSafeSearch confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '0' are allowed.|
||||Note:|
||||This is applicable only when Adult Content, Nudity and Porn Categories are denied in Web Filter Policy.|
|EnforceImageLicensing|No||Description:|
||||Further limit inappropriate content by enforcing search engine filters for Creative Commons licensed images.|
||||EnforceImageLicensing confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '0' are allowed.|
||||Note:|
||||Modifies search queries to enforce use of the search engine's filter for Creative Commons licensed content. This option provides additional protection against potentially inappropriate images being returned in search results, although it will also exclude a lot of other content.|
|XFFEnabled|No||Description:|
||||Enable X-Forwarded-For header.|
||||XFFEnabled confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '0' are allowed.|
|Office365Enabled|No||Description:|
||||Turn on to specify the domains and domain IDs allowed to access the Microsoft 365 service.|
||||Office365Enabled confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '0' are allowed.|
|Office365TenantsList|No||Description:|
||||Domain names and domain IDs allowed to access the Microsoft 365 service.|
||||Office365TenantsList confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 256.|
|Office365DirectoryId|No||Description:|
||||Domain ID allowed to access the Microsoft 365 service.|
||||Office365DirectoryId confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 50.|
|QuotaLimit|No|60|Description:|
||||Maximum allowed time that a user can spend browsing restricted web content regarding to quota policy action.|
||||QuotaLimit confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 1440 is allowed.|
||||Maximum digits allowed are 4.|
|RuleList|No||Description:|
||||Specify the rules contained in this policy.|
||||RuleList confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'OBJECT'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Policy|200|Web policy "\<DynamicValue>" has been created successfully|
|Add Policy|500|Web policy "\<DynamicValue>" could not be created|
|Add Policy|502|Web policy could not be created. Web policy with the same name as "\<DynamicValue>" already exists, choose a different name|
|Add Policy|522|Maximum number of policies has been reached|
|Update Policy from API|200|Web policy "\<DynamicValue>" has been updated successfully|
|Update Policy from API|500|Web policy "\<DynamicValue>" could not be updated|
|Update Policy from API|502|Web policy could not be created. Web policy with the same name as "\<DynamicValue>" already exists, choose a different name|
|Update Policy|200|Web policy "\<DynamicValue>" has been updated successfully|
|Update Policy|500|Web policy "\<DynamicValue>" could not be updated|
|Update Policy|502|Web policy could not be created. Web policy with the same name as "\<DynamicValue>" already exists, choose a different name|
|Update Policy|503|Quota limit must be a multiple of 10. It can't be zero|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
