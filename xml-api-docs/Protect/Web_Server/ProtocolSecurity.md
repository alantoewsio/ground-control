# ProtocolSecurity

- Operation: Add Protection Policy / Edit Protection Policy
- Description: To Add/Edit Protection Policy.

## Sample Configuration

``` xml
<ProtocolSecurity>
    <Name>Text</Name>
    <Description>Text</Description>
    <PassOutlookAnywhere>Enable/Disable</PassOutlookAnywhere>
    <Mode>Monitor/Reject</Mode>
    <CookieSigning>Enable/Disable</CookieSigning>
    <StaticUrlHardening>Enable/Disable</StaticUrlHardening>
    <!-- If StaticUrlHardening is Enable.-->
    <EntryURLType>Manual</EntryURLType>
    <!-- If EntryURLType is Manual.-->
    <EntryURLList>
        <EntryURL />
        :
    </EntryURLList>
    <FormHardening>Enable/Disable</FormHardening>
    <AntiVirus>Enable/Disable</AntiVirus>
    <!-- If AntiVirus is Enable.-->
    <AVMode>Avira/Sophos/DualScan</AVMode>
    <Direction>Uploads/Downloads/UploadsAndDownloads</Direction>
    <BlockUnscannableContent>Enable/Disable</BlockUnscannableContent>
    <LimitScanSize>Enable/Disable</LimitScanSize>
    <Megabytes>Number</Megabytes>
    <BlockClientsWithBadReputation>Enable/Disable</BlockClientsWithBadReputation>
    <!-- If BlockClientsWithBadReputation is Enable.-->
    <SkipRemoteLookups>Enable/Disable</SkipRemoteLookups>
    <ThreatsFilter>Enable/Disable</ThreatsFilter>
    <!-- If ThreatsFilter is Enable.-->
    <ParanoiaLevel>1/2/3/4</ParanoiaLevel>
    <SkipFilterRules>
        <FilterRules />
        :
    </SkipFilterRules>
    <ThreatFilters>
        <Filter />
        :
    </ThreatFilters>
</ProtocolSecurity>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Enter a descriptive name for the Protection Policy object.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|Description|No||Description:|
||||Enter a description or other information.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|Mode|Yes||Description:|
||||Select a mode from 'Monitor' and 'Reject'.|
||||Mode confines to:|
||||Type is 'SCALAR'.|
||||Only 'Monitor', 'Reject' are allowed.|
|ThreatsFilter|No|Disable|Description:|
||||Enable to protect webservers from several threats.|
||||ThreatsFilter confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Filter|No||Description:|
||||Only available when common threat filter is enable.|
||||Filter confines to:|
||||Type is 'ARRAY'.|
||||Maximum characters allowed are 30.|
||||Only 'Application attacks', 'SQL injection attacks', 'XSS attacks', 'Protocol enforcement', 'Scanner detection', 'Data leakages' are allowed.|
||||Multiple values are allowed.|
|ParanoiaLevel|No|1|Description:|
||||If you've turned on common threat filter, you can select the level of rule matching from 1 (most permissive) to 4 (most restrictive).|
||||ParanoiaLevel confines to:|
||||Type is 'SCALAR'.|
||||Only '1', '2', '3', '4' are allowed.|
|FilterRules|No||Description:|
||||Provide the rule number that you want to skip.|
||||FilterRules confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'INTEGER'.|
||||Multiple values are allowed.|
||||Note:|
||||Applicable only if 'Common Threat Filter' is enabled.|
|AntiVirus|No|Disable|Description:|
||||Enable to protect a webserver against viruses.|
||||AntiVirus confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|PassOutlookAnywhere|No|Disable|Description:|
||||Enable to allow external Microsoft Outlook clients to access the Microsoft Exchange Server via the WAF.|
||||PassOutlookAnywhere confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|CookieSigning|No|Disable|Description:|
||||Enable to protects a webserver against manipulated cookies.|
||||CookieSigning confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|StaticUrlHardening|No|Disable|Description:|
||||Enable to protect against URL rewriting.|
||||StaticUrlHardening confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|EntryURLType|No|Manual|Description:|
||||Define type of URL hardening.|
||||EntryURLType confines to:|
||||Type is 'SCALAR'.|
||||Only 'Manual', 'SitemapFile', 'SitemapURL' are allowed.|
|EntryURL|No||Description:|
||||Add URL for static URL hardening.|
||||EntryURL confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
||||Multiple values are allowed.|
||||Note:|
||||Applicable only if 'Static URL Hardening' is enabled.|
|FormHardening|No|Disable|Description:|
||||Enable to protect against web form rewriting.|
||||FormHardening confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|AVMode|No||Description:|
||||Specifies mode for anti virus values can be Avira, Sophos, Dual Scan.|
||||AVMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'Avira', 'Sophos', 'DualScan' are allowed.|
||||Note:|
||||Applicable only if 'Anti-Virus' is enabled.|
|LimitScanSize|No|Disable|Description:|
||||Enable to enter the scan size limit.|
||||LimitScanSize confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
||||Note:|
||||Applicable only if 'Anti-Virus' is enabled.|
|Direction|No|Uploads|Description:|
||||Select whether to scan only up or downloads or both.|
||||Direction confines to:|
||||Type is 'SCALAR'.|
||||Only 'Uploads', 'Downloads', 'UploadsAndDownloads' are allowed.|
||||Note:|
||||Applicable only if 'Anti-Virus' is enabled.|
|BlockUnscannableContent|No|Disable|Description:|
||||Enable to block files that cannot be scanned.|
||||BlockUnscannableContent confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
||||Note:|
||||Applicable only if 'Anti-Virus' is enabled.|
|Megabytes|No||Description:|
||||Provide the scan size limit in Megabyte.|
||||Megabytes confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Note:|
||||Applicable only if 'Limit scan size' is enabled.|
|BlockClientsWithBadReputation|No|Disable|Description:|
||||Enable to block clients which have a bad reputation according to their classification, based on GeoIP and RBL information.|
||||BlockClientsWithBadReputation confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|SkipRemoteLookups|No|Disable|Description:|
||||Enable to use GeoIP-based classification.|
||||SkipRemoteLookups confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
||||Note:|
||||Applicable only if 'Block clients with bad reputation' is enabled.|
|HSTSEnforcement|No|Disable|Description:|
||||Enforce strict transport security.|
||||HSTSEnforcement confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|XContentTypeOptions|No|Disable|Description:|
||||MIME type sniffing protection.|
||||XContentTypeOptions confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add Protection Policy|200|Protection policy has been added successfully|
|Add Protection Policy|500|Protection policy could not be added|
|Add Protection Policy|502|Protection policy with the same name already exists. Please choose a different name|
|Edit Protection Policy|200|Protection policy has been updated successfully|
|Edit Protection Policy|500|Protection policy could not be updated|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
