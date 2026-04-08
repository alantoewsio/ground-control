# DefaultWebFilterNotificationSettings

- Operation: Update Default Web Filter User Notification Settings
- Description: To update default values used for block, warn and error pages.

## Sample Configuration

``` xml
<DefaultWebFilterNotificationSettings>
    <ContentMaliciousFurtherAnalysis>Text</ContentMaliciousFurtherAnalysis>
    <ZeroDayProtectionAnalysisInProgress>Text</ZeroDayProtectionAnalysisInProgress>
    <ZeroDayProtectionAnalysisIncomplete>Text</ZeroDayProtectionAnalysisIncomplete>
    <CouldNotBeAnalyzedSecurityRisk>Text</CouldNotBeAnalyzedSecurityRisk>
    <DownloadAnalyzedMaliciousBehavior>Text</DownloadAnalyzedMaliciousBehavior>
    <ZeroDayProtectionAnalysisUnsuccessful>Text</ZeroDayProtectionAnalysisUnsuccessful>
    <FoundMaliciousBehavior>Text</FoundMaliciousBehavior>
    <RequiresFurtherAnalysis>Text</RequiresFurtherAnalysis>
    <PleaseWaitUpdateAutomatically>Text</PleaseWaitUpdateAutomatically>
    <IfSafeDownloadAutomatically>Text</IfSafeDownloadAutomatically>
    <DownloadBlockedSecurityRisk>Text</DownloadBlockedSecurityRisk>
    <ReasonForBlockingFile>Text</ReasonForBlockingFile>
    <NetworkAdminReleaseFile>Text</NetworkAdminReleaseFile>
    <TryAgain>Text</TryAgain>
    <NotFoundDownloadedAlready>Text</NotFoundDownloadedAlready>
    <DownloadReady>Text</DownloadReady>
    <ScannedIsSafe>Text</ScannedIsSafe>
    <Warning>Text</Warning>
    <Stop>Text</Stop>
    <Ok>Text</Ok>
    <DownloadBlocked>Text</DownloadBlocked>
    <AboutRequest>Text</AboutRequest>
    <PleaseWait>Text</PleaseWait>
    <FileSafeDownloadBelow>Text</FileSafeDownloadBelow>
    <WebsiteInfringeAcceptableContent>Text</WebsiteInfringeAcceptableContent>
    <HaveOverrideCode>Text</HaveOverrideCode>
    <WebsiteContainsMalware>Text</WebsiteContainsMalware>
    <WebsiteSecurityRisk>Text</WebsiteSecurityRisk>
    <AccessBlockedIdentity>Text</AccessBlockedIdentity>
    <ReasonBlockingSite>Text</ReasonBlockingSite>
    <SecurityRiskDetected>Text</SecurityRiskDetected>
    <AccessBlockedSecurityRisk>Text</AccessBlockedSecurityRisk>
    <InternetAccessBlocked>Text</InternetAccessBlocked>
    <SecurityStatusDeviceNotConfirmed>Text</SecurityStatusDeviceNotConfirmed>
    <AccessWebsiteNotPermitted>Text</AccessWebsiteNotPermitted>
    <AccessWebsiteNotPermittedSecurity>Text</AccessWebsiteNotPermittedSecurity>
    <DownloadRestrictedPua>Text</DownloadRestrictedPua>
    <Proceed>Text</Proceed>
    <WebsiteBlocked>Text</WebsiteBlocked>
    <UploadBlocked>Text</UploadBlocked>
    <ReturnPreviousPage>Text</ReturnPreviousPage>
    <LoginToNetwork>Text</LoginToNetwork>
    <ReasonForMessage>Text</ReasonForMessage>
    <ContentNotExist>Text</ContentNotExist>
    <CannotLoadInvalidContent>Text</CannotLoadInvalidContent>
    <CannotLoadFirewallError>Text</CannotLoadFirewallError>
    <CannotLoadBrowserError>Text</CannotLoadBrowserError>
    <CannotLocateWebsite>Text</CannotLocateWebsite>
    <CannotLoadWebsiteError>Text</CannotLoadWebsiteError>
    <CannotAccessTryAgain>Text</CannotAccessTryAgain>
    <CannotLocateWebsiteNameIncorrect>Text</CannotLocateWebsiteNameIncorrect>
    <CommunicationProblem>Text</CommunicationProblem>
    <ContentNotFound>Text</ContentNotFound>
    <WebsiteError>Text</WebsiteError>
    <SomethingWrong>Text</SomethingWrong>
    <SiteNotAvailable>Text</SiteNotAvailable>
    <StopSecurityRisk>Text</StopSecurityRisk>
    <BlockedSite>Text</BlockedSite>
    <BlockedDownload>Text</BlockedDownload>
    <BlockedUpload>Text</BlockedUpload>
    <AnalysisInProgress>Text</AnalysisInProgress>
    <StopMalware>Text</StopMalware>
    <AnalysisUnsuccessful>Text</AnalysisUnsuccessful>
    <NotAvailable>Text</NotAvailable>
    <ConnectionProblem>Text</ConnectionProblem>
    <FirewallError>Text</FirewallError>
    <AuthFailTitle>Text</AuthFailTitle>
    <AuthFailDescription>Text</AuthFailDescription>
</DefaultWebFilterNotificationSettings>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|ContentMaliciousFurtherAnalysis|No||Description:|
||||Specify 'content_malicious_further_analysis'.|
||||ContentMaliciousFurtherAnalysis confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ZeroDayProtectionAnalysisInProgress|No||Description:|
||||Specify 'zero_day_protection_analysis_in_progress'.|
||||ZeroDayProtectionAnalysisInProgress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ZeroDayProtectionAnalysisIncomplete|No||Description:|
||||Specify 'zero_day_protection_analysis_incomplete'.|
||||ZeroDayProtectionAnalysisIncomplete confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CouldNotBeAnalyzedSecurityRisk|No||Description:|
||||Specify 'could_not_be_analyzed_security_risk'.|
||||CouldNotBeAnalyzedSecurityRisk confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DownloadAnalyzedMaliciousBehavior|No||Description:|
||||Specify 'download_analyzed_malicious_behavior'.|
||||DownloadAnalyzedMaliciousBehavior confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ZeroDayProtectionAnalysisUnsuccessful|No||Description:|
||||Specify 'zero_day_protection_analysis_unsuccessful'.|
||||ZeroDayProtectionAnalysisUnsuccessful confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|FoundMaliciousBehavior|No||Description:|
||||Specify 'found_malicious_behavior'.|
||||FoundMaliciousBehavior confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|RequiresFurtherAnalysis|No||Description:|
||||Specify 'requires_further_analysis'.|
||||RequiresFurtherAnalysis confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|PleaseWaitUpdateAutomatically|No||Description:|
||||Specify 'please_wait_update_automatically'.|
||||PleaseWaitUpdateAutomatically confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|IfSafeDownloadAutomatically|No||Description:|
||||Specify 'if_safe_download_automatically'.|
||||IfSafeDownloadAutomatically confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DownloadBlockedSecurityRisk|No||Description:|
||||Specify 'download_blocked_security_risk'.|
||||DownloadBlockedSecurityRisk confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ReasonForBlockingFile|No||Description:|
||||Specify 'reason_for_blocking_file'.|
||||ReasonForBlockingFile confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|NetworkAdminReleaseFile|No||Description:|
||||Specify 'network_admin_release_file'.|
||||NetworkAdminReleaseFile confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|TryAgain|No||Description:|
||||Specify 'try_again'.|
||||TryAgain confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|NotFoundDownloadedAlready|No||Description:|
||||Specify 'not_found_downloaded_already'.|
||||NotFoundDownloadedAlready confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DownloadReady|No||Description:|
||||Specify 'download_ready'.|
||||DownloadReady confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ScannedIsSafe|No||Description:|
||||Specify 'scanned_is_safe'.|
||||ScannedIsSafe confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Warning|No||Description:|
||||Specify 'warning'.|
||||Warning confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Stop|No||Description:|
||||Specify 'stop'.|
||||Stop confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Ok|No||Description:|
||||Specify 'ok'.|
||||Ok confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DownloadBlocked|No||Description:|
||||Specify 'download_blocked'.|
||||DownloadBlocked confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AboutRequest|No||Description:|
||||Specify 'about_request'.|
||||AboutRequest confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|PleaseWait|No||Description:|
||||Specify 'please_wait'.|
||||PleaseWait confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|FileSafeDownloadBelow|No||Description:|
||||Specify 'file_safe_download_below'.|
||||FileSafeDownloadBelow confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|WebsiteInfringeAcceptableContent|No||Description:|
||||Specify 'website_infringe_acceptable_content'.|
||||WebsiteInfringeAcceptableContent confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|HaveOverrideCode|No||Description:|
||||Specify 'have_override_code'.|
||||HaveOverrideCode confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|WebsiteContainsMalware|No||Description:|
||||Specify 'website_contains_malware'.|
||||WebsiteContainsMalware confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|WebsiteSecurityRisk|No||Description:|
||||Specify 'website_security_risk'.|
||||WebsiteSecurityRisk confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AccessBlockedIdentity|No||Description:|
||||Specify 'access_blocked_identity'.|
||||AccessBlockedIdentity confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ReasonBlockingSite|No||Description:|
||||Specify 'reason_blocking_site'.|
||||ReasonBlockingSite confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SecurityRiskDetected|No||Description:|
||||Specify 'security_risk_detected'.|
||||SecurityRiskDetected confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AccessBlockedSecurityRisk|No||Description:|
||||Specify 'access_blocked_security_risk'.|
||||AccessBlockedSecurityRisk confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|InternetAccessBlocked|No||Description:|
||||Specify 'internet_access_blocked'.|
||||InternetAccessBlocked confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SecurityStatusDeviceNotConfirmed|No||Description:|
||||Specify 'security_status_device_not_confirmed'.|
||||SecurityStatusDeviceNotConfirmed confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AccessWebsiteNotPermitted|No||Description:|
||||Specify 'access_website_not_permitted'.|
||||AccessWebsiteNotPermitted confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AccessWebsiteNotPermittedSecurity|No||Description:|
||||Specify 'access_website_not_permitted_security'.|
||||AccessWebsiteNotPermittedSecurity confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DownloadRestrictedPua|No||Description:|
||||Specify 'download_restricted_pua'.|
||||DownloadRestrictedPua confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Proceed|No||Description:|
||||Specify 'proceed'.|
||||Proceed confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|WebsiteBlocked|No||Description:|
||||Specify 'website_blocked'.|
||||WebsiteBlocked confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|UploadBlocked|No||Description:|
||||Specify 'upload_blocked'.|
||||UploadBlocked confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ReturnPreviousPage|No||Description:|
||||Specify 'return_previous_page'.|
||||ReturnPreviousPage confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|LoginToNetwork|No||Description:|
||||Specify 'login_to_network'.|
||||LoginToNetwork confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ReasonForMessage|No||Description:|
||||Specify 'reason_for_message'.|
||||ReasonForMessage confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ContentNotExist|No||Description:|
||||Specify 'content_not_exist'.|
||||ContentNotExist confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CannotLoadInvalidContent|No||Description:|
||||Specify 'cannot_load_invalid_content'.|
||||CannotLoadInvalidContent confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CannotLoadFirewallError|No||Description:|
||||Specify 'cannot_load_firewall_error'.|
||||CannotLoadFirewallError confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CannotLoadBrowserError|No||Description:|
||||Specify 'cannot_load_browser_error'.|
||||CannotLoadBrowserError confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CannotLocateWebsite|No||Description:|
||||Specify 'cannot_locate_website'.|
||||CannotLocateWebsite confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CannotLoadWebsiteError|No||Description:|
||||Specify 'cannot_load_website_error'.|
||||CannotLoadWebsiteError confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CannotAccessTryAgain|No||Description:|
||||Specify 'cannot_access_try_again'.|
||||CannotAccessTryAgain confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CannotLocateWebsiteNameIncorrect|No||Description:|
||||Specify 'cannot_locate_website_name_incorrect'.|
||||CannotLocateWebsiteNameIncorrect confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CommunicationProblem|No||Description:|
||||Specify 'communication_problem'.|
||||CommunicationProblem confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ContentNotFound|No||Description:|
||||Specify 'content_not_found'.|
||||ContentNotFound confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|WebsiteError|No||Description:|
||||Specify 'website_error'.|
||||WebsiteError confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SomethingWrong|No||Description:|
||||Specify 'something_wrong'.|
||||SomethingWrong confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SiteNotAvailable|No||Description:|
||||Specify 'site_not_available'.|
||||SiteNotAvailable confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|StopSecurityRisk|No||Description:|
||||Specify 'stop_security_risk'.|
||||StopSecurityRisk confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|BlockedSite|No||Description:|
||||Specify 'blocked_site'.|
||||BlockedSite confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|BlockedDownload|No||Description:|
||||Specify 'blocked_download'.|
||||BlockedDownload confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|BlockedUpload|No||Description:|
||||Specify 'blocked_upload'.|
||||BlockedUpload confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AnalysisInProgress|No||Description:|
||||Specify 'analysis_in_progress'.|
||||AnalysisInProgress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|StopMalware|No||Description:|
||||Specify 'stop_malware'.|
||||StopMalware confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AnalysisUnsuccessful|No||Description:|
||||Specify 'analysis_unsuccessful'.|
||||AnalysisUnsuccessful confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|NotAvailable|No||Description:|
||||Specify 'not_available'.|
||||NotAvailable confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ConnectionProblem|No||Description:|
||||Specify 'connection_problem'.|
||||ConnectionProblem confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|FirewallError|No||Description:|
||||Specify 'firewall_error'.|
||||FirewallError confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AuthFailTitle|No||Description:|
||||Specify 'auth_fail_title'.|
||||AuthFailTitle confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AuthFailDescription|No||Description:|
||||Specify 'auth_fail_description'.|
||||AuthFailDescription confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Update Default Web Filter User Notification Settings|200|Operation Successful|
|Update Default Web Filter User Notification Settings|500|Operation Fail|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
