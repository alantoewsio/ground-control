# IPSPolicy

- Operation: Add IPS policy / Update IPS Policy
- Description: To Create/Edit IPS Policy for viewing IPS Signatures and configuring the handling of Signatures.

## Sample Configuration

``` xml
<IPSPolicy>
    <Name>Name</Name>
    <Description>Text</Description>
    <Template>Name of IPS policy</Template>
    <!-- if template is selected all rules of that template to be inherited and add following if mentioned. if template is not selected only following rules -->
    <RuleList>
        <Rule>
            <RuleName>Rulename</RuleName>
            <RuleType>Custom Signature/Default Signature</RuleType>
            <SignaturSelectionType>All Application/Individual Application</SignaturSelectionType>
            <CategoryList>
                <Category>All Categories/{Categoryname}</Category>
            </CategoryList>
            <SeverityList>
                <Severity>All Severity/{Severityname}</Severity>
            </SeverityList>
            <PlatformList>
                <Platform>All Platform/{Platformname}</Platform>
            </PlatformList>
            <TargetList>
                <Target>All Target/{Targetname}</Target>
            </TargetList>
            <SignatureList>
                <Signature>{SignatureName}</Signature>
            </SignatureList>
            <Action>Allow Packet/Drop Packet/Disable/Drop Session/Reset/Bypass Session/Recommended</Action>
        </Rule>
    </RuleList>
</IPSPolicy>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Specify a name for the IPS Policy.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|Description|No||Description:|
||||Specify description for IPS Policy.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Template|No||Description:|
||||Specify the name of an existing IPS policy to use as a template.|
||||Template confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|RuleName|Yes||Description:|
||||Specify rule name of IPS Policy.|
||||RuleName confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 70.|
||||Multiple values are allowed.|
||||Duplicate values will be ignored.|
|RuleType|Yes||Description:|
||||Rule type list. (Default rule list or Custom rule list)|
||||RuleType confines to:|
||||Type is 'ARRAY'.|
||||Only 'Default Signature', 'Custom Signature' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|SignaturSelectionType|Yes||Description:|
||||Select all the Signatures in the list for defining global action.|
||||SignaturSelectionType confines to:|
||||Type is 'ARRAY'.|
||||Only 'Individual Application', 'All Application' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Category|No||Description:|
||||Category under which the IPS Signature falls.|
||||Category confines to:|
||||Type is '2DARRAY'.|
||||Datatype is 'STRING'.|
|Severity|No||Description:|
||||Severity level of the Signature.|
||||Severity confines to:|
||||Type is '2DARRAY'.|
||||Datatype is 'STRING'.|
|Platform|No||Description:|
||||Platform list by id used in filter|
||||Platform confines to:|
||||Type is '2DARRAY'.|
||||Datatype is 'STRING'.|
|Target|No||Description:|
||||Target list by id used in filter|
||||Target confines to:|
||||Type is '2DARRAY'.|
||||Datatype is 'STRING'.|
|Signature|No||Description:|
||||Select individual Signature in the Category for defining action.|
||||Signature confines to:|
||||Type is '2DARRAY'.|
||||Datatype is 'STRING'.|
|Action|Yes||Description:|
||||Select the action to perform when matching traffic pattern is detected.|
||||Action confines to:|
||||Type is 'ARRAY'.|
||||Only 'Recommended', 'Allow Packet', 'Drop Packet', 'Disable', 'Drop Session', 'Reset', 'Bypass Session', '7' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add IPS policy|200|IPS policy "\<DynamicValue>" has been created successfully|
|Add IPS policy|500|IPS policy could not be created|
|Add IPS policy|502|IPS policy could not be created. IPS policy with the same name "\<DynamicValue>" already exists, choose a different name|
|Add IPS policy|505|Custom IPS pattern could not be created. IPS service could not restart|
|Add IPS policy|506|IPS policy could not be created|
|Add IPS policy|522|IPS policy could not be created. You can create a maximum of \<DynamicValue> policies|
|Update IPS Policy|200|IPS policy "\<DynamicValue>" has been updated successfully|
|Update IPS Policy|500|IPS policy could not be updated|
|Update IPS Policy|502|IPS policy could not be created. IPS policy with the same name "\<DynamicValue>" already exists, choose a different name|
|Update IPS Policy|506|IPS policy could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
