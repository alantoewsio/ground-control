# QOSPolicy

- Operation: Add QoS policy / Update QoS policy
- Description: To Add/Edit QoS Policy for managing and distributing the total bandwidth for the Users.

## Sample Configuration

``` xml
<QoSPolicy>
    <Name>policyname</Name>
    <PolicyBasedOn>User/Firewall/Application/WebCategory</PolicyBasedOn>
    <PolicyType>Strict/Committed</PolicyType>
    <ImplementationOn>Total/Individual</ImplementationOn>
    <Priority>RealTime/BusinessCritical/Normal2/Normal3/Normal4/Normal5/BulkyFTP/BestEffort</Priority>
    <BandwidthUsageType>Individual/Shared</BandwidthUsageType>
    <!-- Start :: Below Section is to be passed on the selection of above -->
    <!-- Policy Based On = User/Firewall/Application/Web Category,Policy Type="Strict" Implementation On="Total" -->
    <TotalBandwidth>between 2 -2560000 KB</TotalBandwidth>

    <!-- Policy Based On = User/Firewall/Application/Web Category,Policy Type="Committed" Implementation On="Total" -->
    <GuaranteedBandwidth>between 2-2560000 KB</GuaranteedBandwidth>
    <BurstableBandwidth>between 2-2560000 KB and greater then GuaranteedBandwidth</BurstableBandwidth>

    <!-- Policy Based On = User/Firewall/Application,Policy Type="Strict" Implementation On="Individual" -->
    <UploadBandwidth>between 2 -2560000 KB</UploadBandwidth>
    <DownloadBandwidth>between 2 -2560000 KB</DownloadBandwidth>

    <!-- Policy Based On = User/Firewall/Application,Policy Type="Committed" Implementation On="Individual" -->
    <GuaranteedUploadBandwidth>between 2-2560000 KB</GuaranteedUploadBandwidth>
    <BurstableUploadBandwidth>between 2-2560000 KB and greater then GuaranteedUploadBandwidth</BurstableUploadBandwidth>
    <GuaranteedDownloadBandwidth>between 2-2560000 KB</GuaranteedDownloadBandwidth>
    <BurstableDownloadBandwidth>between 2-2560000 KB and greater then GuaranteedDownloadBandwidth</BurstableDownloadBandwidth>

    <!-- End -->
    <Description>Text</Description>
    <DetailId>detailid</DetailId>
    <SchedulebasedPolicyRuleList>
        <Rule>
            <DetailId>detailid</DetailId>
            <PolicyType>Strict/Committed</PolicyType>
            <!-- Start :: Below Section is to be passed on the bases of above selection of PolicyType,Policy Based On,Implementation On  -->
                <!-- Policy Based On = User/Firewall/Application/Web Category,Policy Type="Strict" Implementation On="Total" -->
                <TotalBandwidth>between 2 -2560000 KB</TotalBandwidth>

                <!-- Policy Based On = User/Firewall/Application/Web Category,Policy Type="Committed" Implementation On="Total" -->
                <GuaranteedBandwidth>between 2-2560000 KB</GuaranteedBandwidth>
                <BurstableBandwidth>between 2-2560000 KB and greater than GuaranteedBandwidth</BurstableBandwidth>

                <!-- Policy Based On = User/Firewall/Application,Policy Type="Strict" Implementation On="Individual" -->
                <UploadBandwidth>between 2 -2560000 KB</UploadBandwidth>
                <DownloadBandwidth>between 2 -2560000 KB</DownloadBandwidth>

                <!-- Policy Based On = User/Firewall/Application,Policy Type="Committed" Implementation On="Individual" -->
                <GuaranteedUploadBandwidth>between 2-2560000 KB</GuaranteedUploadBandwidth>
                <BurstableUploadBandwidth>between 2-2560000 KB and greater then GuaranteedUploadBandwidth</BurstableUploadBandwidth>
                <GuaranteedDownloadBandwidth>between 2-2560000 KB</GuaranteedDownloadBandwidth>
                <BurstableDownloadBandwidth>between 2-2560000 KB and greater then GuaranteedDownloadBandwidth</BurstableDownloadBandwidth>
            <!-- End -->
            <Schedule>schedulename</Schedule>
        </Rule>
        :
    </SchedulebasedPolicyRuleList>
</QoSPolicy>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes | |Description:|
||||Specify a name for the QoS Policy.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 50.|
||||UTF-8 character(s) are allowed.|
|PolicyType|No | |Description:|
||||Select the type of Policy from the options available: Strict or Committed.|
||||PolicyType confines to:|
||||Type is 'SCALAR'.|
||||Only 'Strict', 'Committed' are allowed.|
|ImplementationOn|No | |Description:|
||||Select option to specify implementation strategy of Policy.|
||||ImplementationOn confines to:|
||||Type is 'SCALAR'.|
||||Only 'Total', 'Individual' are allowed.|
|Priority|Yes | |Description:|
||||Set the Bandwidth priority.|
||||Priority confines to:|
||||Type is 'SCALAR'.|
||||Only 'RealTime', 'BusinessCritical', 'Normal2', 'Normal3', 'Normal4', 'Normal5', 'BulkyFTP', 'BestEffort' are allowed.|
|TotalBandwidth|Yes | |Description:|
||||Specify allowed total bandwidth for 'Strict' policy type and 'Total' Implementation Strategy.|
||||TotalBandwidth confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 2 to 10240000 is allowed.|
|Shared Bandwidth Usage Type|No | |Description:|
||||Select the type of Bandwidth usage.|
||||Shared Bandwidth Usage Type confines to:|
||||Type is 'SCALAR'.|
||||To separate words, use a space.|
||||Only 'on', 'off' are allowed.|
|Description|No | |Description:|
||||Specify Policy description.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|GuaranteedUploadBandwidth|Yes | |Description:|
||||Specify Guaranteed Upload bandwidth which is the minimum guaranteed bandwidth the user can use to upload.|
||||GuaranteedUploadBandwidth confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 2 to 10240000 is allowed.|
||||Note:|
||||Applicable when policy type selected is 'Committed' and implementation strategy selected is 'Individual'.|
|BurstableUploadBandwidth|Yes | |Description:|
||||Specify Burstable Upload bandwidth which is the maximum bandwidth the user can use to upload.|
||||BurstableUploadBandwidth confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 2 to 10240000 is allowed.|
||||Note:|
||||Applicable when policy type selected is 'Committed' and implementation strategy selected is 'Individual'.|
|GuaranteedDownloadBandwidth|Yes | |Description:|
||||Specify Guaranteed Download bandwidth which is the minimum guaranteed bandwidth the user can use to download.|
||||GuaranteedDownloadBandwidth confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 2 to 10240000 is allowed.|
||||Note:|
||||Applicable when policy type selected is 'Committed' and implementation strategy selected is 'Individual'.|
|BurstableDownloadBandwidth|Yes | |Description:|
||||Specify Burstable Download bandwidth which is the maximum bandwidth the user can use to download.|
||||BurstableDownloadBandwidth confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 2 to 10240000 is allowed.|
||||Note:|
||||Applicable when policy type selected is 'Committed' and implementation strategy selected is 'Individual'.|
|GuaranteedBandwidth|Yes | |Description:|
||||Specify Guaranteed bandwidth which is the minimum bandwidth available to the user.|
||||GuaranteedBandwidth confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 2 to 10240000 is allowed.|
||||Note:|
||||Applicable when policy type selected is 'Committed' and implementation strategy selected is 'Total'.|
|Policy Based On|No |0 |Description:|
||||Select an option for whom the Policy is to be created.|
||||Policy Based On confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|DownloadBandwidth|Yes | |Description:|
||||Specify Download bandwidth for 'Individual' Implementation strategy and 'Strict' policy type.|
||||DownloadBandwidth confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 2 to 10240000 is allowed.|
|BurstableBandwidth|Yes | |Description:|
||||Specify burstable bandwidth which is the maximum bandwidth a user can use.|
||||BurstableBandwidth confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 2 to 10240000 is allowed.|
||||Note:|
||||Applicable when policy type selected is 'Committed' and implementation strategy selected is 'Total'.|
|UploadBandwidth|Yes | |Description:|
||||Specify Upload bandwidth for 'Individual' Implementation strategy and 'Strict' policy type.|
||||UploadBandwidth confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 2 to 10240000 is allowed.|
|Implementation On|No | |Description:|
||||Select implementation strategy of Policy to override default QoS Policy details.|
||||Implementation On confines to:|
||||Type is 'ARRAY'.|
||||Only '6', '7' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|Policy Type|No | |Description:|
||||Select the type of Policy from the options available: Strict or Committed to override default QoS Policy details.|
||||Policy Type confines to:|
||||Type is 'ARRAY'.|
||||Only '8', '11' are allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
|grntddownbandwidthlist|No | |Description:|
||||Specify Guaranteed Download bandwidth which is the minimum guaranteed bandwidth the user can use to download.|
||||grntddownbandwidthlist confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'INTEGER'.|
||||Range 2 to 10240000 is allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
||||Note:|
||||This option is available when adding Schedule wise QoS Policy details.|
|grntdupbandwidthlist|No | |Description:|
||||Specify Guaranteed Upload bandwidth which is the minimum guaranteed bandwidth the user can use to upload.|
||||grntdupbandwidthlist confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'INTEGER'.|
||||Range 2 to 10240000 is allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
||||Note:|
||||This option is available when adding Schedule wise QoS Policy details.|
|upbandwidthlist|No | |Description:|
||||Specify Upload bandwidth for 'Individual' Implementation strategy and 'Strict' policy type.|
||||upbandwidthlist confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'INTEGER'.|
||||Range 2 to 10240000 is allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
||||Note:|
||||This option is available when adding Schedule wise QoS Policy details.|
|downbandwidthlist|No | |Description:|
||||Specify Download bandwidth for 'Individual' Implementation strategy and 'Strict' policy type.|
||||downbandwidthlist confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'INTEGER'.|
||||Range 2 to 10240000 is allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
||||Note:|
||||This option is available when adding Schedule wise QoS Policy details.|
|grntdbandwidthlist|No | |Description:|
||||Specify Guaranteed bandwidth for 'Total' Implementation strategy and 'Committed' policy type.|
||||grntdbandwidthlist confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'INTEGER'.|
||||Range 2 to 10240000 is allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
||||Note:|
||||This option is available when adding Schedule wise QoS Policy details.|
|burstbandwidthlist|No | |Description:|
||||Specify burstable bandwidth for 'Total' Implementation strategy and 'Committed' policy type.|
||||burstbandwidthlist confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'INTEGER'.|
||||Range 2 to 10240000 is allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
||||Note:|
||||This option is available when adding Schedule wise QoS Policy details.|
|bandwidthlist|No | |Description:|
||||Specify allowed total bandwidth for 'Strict' policy type and 'Total' Implementation Strategy.|
||||bandwidthlist confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'INTEGER'.|
||||Range 2 to 10240000 is allowed.|
||||Multiple values are allowed.|
||||Duplicate values will not be ignored.|
||||Note:|
||||This option is available when adding Schedule wise QoS Policy details.|
|qosdetailnamelist|No | |Description:|
||||List of QoS Policy details.|
||||qosdetailnamelist confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||UTF-8 character(s) are allowed.|
||||Multiple values are allowed.|
|ScheduleDetail|No | |Description:|
||||Specify 'ScheduleDetail'|
||||ScheduleDetail confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'OBJECT'.|
||||qos::qosPolicyDetails|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add QoS policy|200|Traffic shaping policy "\<DynamicValue>" has been created successfully|
|Add QoS policy|500|Traffic shaping policy "\<DynamicValue>" could not be created|
|Add QoS policy|502|Traffic shaping policy could not be created. Traffic shaping policy with the same name as "\<DynamicValue>" already exists, choose a different name|
|Update QoS policy|200|Traffic shaping policy "\<DynamicValue>" has been updated successfully|
|Update QoS policy|500|Traffic shaping policy "\<DynamicValue>" could not be updated|
|Update QoS policy|502|Traffic shaping policy could not be created. Traffic shaping policy with the same name as "\<DynamicValue>" already exists, choose a different name|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
