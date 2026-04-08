# SMTPPolicy

- Operation: Add SMTP Policy / Edit SMTP Policy
- Description: To Add/Edit SMTP Policy which defines action to be taken on traffic destined for specific mail domain.

## Sample Configuration

``` xml
<SMTPPolicy>
    <Name>Postman.local</Name>
    <DomainList>
        <DomainName>Postman.local</DomainName>
    </DomainList>
    <RouteBy>Static Host/DNS Host</RouteBy>
    <DNSHostName>hostname</DNSHostName>
    <SpamProtection>
        <SpamProtectionStatus>ON</SpamProtectionStatus>
        <Checkforinboundspam>Enable</Checkforinboundspam>
        <Checkforvirusoutbreak>Disable</Checkforvirusoutbreak>
        <Checkforoutboundspam>Enable</Checkforoutboundspam>
        <UseGreylisting>Enable</UseGreylisting>
        <RejectOnBATV>Enable</RejectOnBATV>
        <CheckForSPF>Disable</CheckForSPF>
        <CheckforRBL>Enable</CheckforRBL>
        <SpamAction>Drop</SpamAction>
        <ProbableSpamAction>Warn</ProbableSpamAction>
        <RecipientVerification>WithCallout(Recommended)</RecipientVerification>
        <RBLList>
            <RBLName>Premium RBL Services</RBLName>
            <RBLName>Standard RBL Services</RBLName>
        </RBLList>
        <SpamMarker>[SPAM]</SpamMarker>
    </SpamProtection>
    <MalwareProtection>
        <MalwareProtectionStatus>ON</MalwareProtectionStatus>
        <MalwareScanning>Dual Anti-Virus</MalwareScanning>
        <AntivirusAction>Drop</AntivirusAction>
        <NotifySender>Disable</NotifySender>
        <QuarantineUnscannableandEncryptedContent>Enable</QuarantineUnscannableandEncryptedContent>
        <ZeroDayProtection>Enable</ZeroDayProtection>
        <ScannedFileSize>10</ScannedFileSize>
    </MalwareProtection>
    <FiletypeFilter>
        <FiletypeFilterStatus>ON</FiletypeFilterStatus>
        <BlockFileTypes>
            <FileType>Video Files</FileType>
            <FileType>Audio Files</FileType>
        </BlockFileTypes>
        <MIMEWhiteList>
            <WhiteList>video/msvideo</WhiteList>
            <WhiteList>video/x-msvideo</WhiteList>
            <WhiteList>video/quicktime</WhiteList>
            <WhiteList>application/smil</WhiteList>
        </MIMEWhiteList>
        <DropMessageGreaterThan>0</DropMessageGreaterThan>
    </FiletypeFilter>
    <DataProtection>
        <DataProtectionStatus>ON</DataProtectionStatus>
        <ActionOnRuleMatch>Accept with SPX</ActionOnRuleMatch>
        <NotifyOnMatch>Enable</NotifyOnMatch>
        <DataProtectionPolicy>Postal addresses</DataProtectionPolicy>
        <DataProtectionSPXTemplate>Default Template</DataProtectionSPXTemplate>
    </DataProtection>
    <Action>Accept</Action>
    <SPXEncryption>None</SPXEncryption>
    <RouteList>
        <HostName>
            <routingid>10.198</routingid>
            <routingorder>0</routingorder>
        </HostName>
    </RouteList>
</SMTPPolicy>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Name to identify the SMTP Policy.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 100.|
|FileType|Yes||Description:|
||||Attachment file types that are removed from Email during Malware Scanning.|
||||FileType confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|BindDN|No||Description:|
||||Bind DN of Active Directory Server.|
||||BindDN confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|SPXEncryption|No||Description:|
||||SPX Template to be applied to the Email.|
||||SPXEncryption confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Checkforinboundspam|No||Description:|
||||Emails received by the users are scanned for spam by the Device.|
||||Checkforinboundspam confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_INBOUND_SPAM_DISABLE}', '$EMAILPROTECTION{SMTP_INBOUND_SPAM_ENABLE}' are allowed.|
|Checkforoutboundspam|No||Description:|
||||Emails sent by the local users are scanned for spam by the Device before being delivered.|
||||Checkforoutboundspam confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_OUTBOUND_SPAM_DISABLE}', '$EMAILPROTECTION{SMTP_OUTBOUND_SPAM_ENABLE}' are allowed.|
|CheckforRBL|No||Description:|
||||Emails are scanned to verify the reputation of the sender IP Address.|
||||CheckforRBL confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_CHECK_RBL_DISABLE}', '$EMAILPROTECTION{SMTP_CHECK_RBL_ENABLE}' are allowed.|
|RBLName|No||Description:|
||||Selected RBL against which Device verifies IP Reputation of Emails.|
||||RBLName confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|SpamAction|No||Description:|
||||Action to be taken if Email is detected as Spam.|
||||SpamAction confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_SPAM_ACTION_QUARANTINE}', '$EMAILPROTECTION{SMTP_SPAM_ACTION_WARN}', '$EMAILPROTECTION{SMTP_SPAM_ACTION_OFF}', '$EMAILPROTECTION{SMTP_SPAM_ACTION_DROP}' are allowed.|
|ProbableSpamAction|No||Description:|
||||Action to be taken if Email is detected as suspicious but not confirmed as Spam.|
||||ProbableSpamAction confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_PROBABLE_SPAM_ACTION_QUARANTINE}', '$EMAILPROTECTION{SMTP_PROBABLE_SPAM_ACTION_WARN}', '$EMAILPROTECTION{SMTP_PROBABLE_SPAM_ACTION_OFF}', '$EMAILPROTECTION{SMTP_PROBABLE_SPAM_ACTION_DROP}' are allowed.|
|BulkMarker|No||Description:|
||||If Bulk Action is specified as Warn, this is the tagged message in the Subject of an Email if it is found to be a Bulk.|
||||BulkMarker confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 256.|
|MalwareScanning|Yes||Description:|
||||The type of Anti-virus scanning to be applied: Single or Dual.|
||||MalwareScanning confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_AV_SCANNING_DISABLE}', '$EMAILPROTECTION{SMTP_AV_SCANNING_SINGLE_AV}', '$EMAILPROTECTION{SMTP_AV_SCANNING_DUAL_AV}' are allowed.|
|AntivirusAction|No||Description:|
||||Action to be taken if a malware is detected in an Email.|
||||AntivirusAction confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_AV_ACTION_QUARANTINE}', '$EMAILPROTECTION{SMTP_AV_ACTION_DROP}', '$EMAILPROTECTION{SMTP_AV_ACTION_OFF}', '$EMAILPROTECTION{SMTP_AV_ACTION_PREFIXSUBJECT}' are allowed.|
|ActionOnRuleMatch|No||Description:|
||||Action to be taken on an Email if it is found to contain sensitive information as detected in any Data Protection Policy (DPP).|
||||ActionOnRuleMatch confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_DPP_ACTION_ACCEPT}', '$EMAILPROTECTION{SMTP_DPP_ACTION_ACCEPTWITHSPX}', '$EMAILPROTECTION{SMTP_DPP_ACTION_OFF}' are allowed.|
|QuarantineUnscannableandEncryptedContent|No|Enable|Description:|
||||Enable to quarantine emails whose content cannot be scanned.|
||||QuarantineUnscannableandEncryptedContent confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{UNSCANNABLE_QUARANTINE_DISABLE}', '$EMAILPROTECTION{UNSCANNABLE_QUARANTINE_ENABLE}' are allowed.|
|ZeroDayProtection|No|Disable|Description:|
||||Enable to send emails for zero-day protection analysis.|
||||ZeroDayProtection confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SANDSTORM_ENABLE}', '$EMAILPROTECTION{SANDSTORM_DISABLE}' are allowed.|
|RecipientVerification|No|Off(Not Recommended)|Description:|
||||Enable to verify email recipients of outbound emails.|
||||RecipientVerification confines to:|
||||Type is 'SCALAR'.|
||||Only 'Off(Not Recommended)', 'WithCallout(Recommended)', 'In Active Directory' are allowed.|
|UseGreylisting|No|Disable|Description:|
||||Enable to greylist unknown Sender IP addresses of inbound emails.|
||||UseGreylisting confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|RejectOnBATV|No|Disable|Description:|
||||Enable to reject bounce mail.|
||||RejectOnBATV confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|NotifySender|No||Description:|
||||If enabled, the original message is withheld by the Device and a notification is sent to the sender informing that the Email was infected.|
||||NotifySender confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_AV_NOTIFY_SENDER_DISABLE}', '$EMAILPROTECTION{SMTP_AV_NOTIFY_SENDER_ENABLE}' are allowed.|
|DomainName|Yes||Description:|
||||Domain(s) to which the profile links.|
||||DomainName confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|DataProtectionPolicy|No||Description:|
||||The policy to be applied for DP scanning.|
||||DataProtectionPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|BaseDN|No||Description:|
||||Base DN of Active Directory Server.|
||||BaseDN confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|RouteBy|No|MX|Description:|
||||The server type of the target route.|
||||RouteBy confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_STATICHOST_ROUTE}', '$EMAILPROTECTION{SMTP_DNSHOST_ROUTE}', '$EMAILPROTECTION{SMTP_MX_ROUTE}' are allowed.|
|RouteList|No||Description:|
||||Specify 'route_details'|
||||RouteList confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'OBJECT'.|
||||route_details|
||||Multiple values are allowed.|
|SpamMarker|No||Description:|
||||If Spam Action or Probable Spam Action is specified as Warn, this is the tagged message in the Subject of an Email if it is found to be a Spam or Probable Spam.|
||||SpamMarker confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 256.|
|DNSHostName|No||Description:|
||||DNS host name for the target route.|
||||DNSHostName confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DataProtectionStatus|Yes|OFF|Description:|
||||On Data Protection Policy section to configure confidential data protection in Email Traffic.|
||||DataProtectionStatus confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_DPP_SETTING_DISABLE}', '$EMAILPROTECTION{SMTP_DPP_SETTING_ENABLE}' are allowed.|
|routingid|No||Description:|
||||IP Address of Static Host.|
||||routingid confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|AD Server|No||Description:|
||||Select AD Server for Recipient Verification.|
||||AD Server confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|MalwareProtectionStatus|Yes|OFF|Description:|
||||On Anti-virus section to configure malware scanning of Email traffic.|
||||MalwareProtectionStatus confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_ANTIVIRUS_SETTING_DISABLE}', '$EMAILPROTECTION{SMTP_ANTIVIRUS_SETTING_ENABLE}' are allowed.|
|WhiteList|No||Description:|
||||MIME Header(s) of the selected File Type(s). Only selected headers are to be allowed while the rest in the selected File Type are to be blocked during Malware scanning of Email attachments.|
||||WhiteList confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Action|No|Accept|Description:|
||||Action to be taken on SMTP traffic on which profile is applied: Accept or Reject.|
||||Action confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_GLOBAL_ACTION_ACCEPT}', '$EMAILPROTECTION{SMTP_GLOBAL_ACTION_ADDHEADER}', '$EMAILPROTECTION{SMTP_GLOBAL_ACTION_DELETEHEADER}', '$EMAILPROTECTION{SMTP_GLOBAL_ACTION_SUBJECTMARKER}', '$EMAILPROTECTION{SMTP_GLOBAL_ACTION_CHANGESUBJECT}', '$EMAILPROTECTION{SMTP_GLOBAL_ACTION_ADDRECIPENT}', '$EMAILPROTECTION{SMTP_GLOBAL_ACTION_REJECT}' are allowed.|
|DataProtectionSPXTemplate|No||Description:|
||||SPX Template to be applied to the Email if Data Protection section is enabled and Accept with SPX action is selected.|
||||DataProtectionSPXTemplate confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|FiletypeFilterStatus|Yes|OFF|Description:|
||||On Filetype Protection section to configure filtering of specific attachments in Email Traffic.|
||||FiletypeFilterStatus confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_FILETYPE_FILTER_SETTING_DISABLE}', '$EMAILPROTECTION{SMTP_FILETYPE_FILTER_SETTING_ENABLE}' are allowed.|
|CheckForSPF|No||Description:|
||||Enable to verify sender's hostname against sender's DNS|
||||CheckForSPF confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_CHECK_SPF_ENABLE}', '$EMAILPROTECTION{SMTP_CHECK_SPF_DISABLE}' are allowed.|
|SpamProtectionStatus|Yes|OFF|Description:|
||||On Anti-spam section to configure Spam scanning of Email traffic.|
||||SpamProtectionStatus confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_ANTISPAM_SETTING_DISABLE}', '$EMAILPROTECTION{SMTP_ANTISPAM_SETTING_ENABLE}' are allowed.|
|DropMessageGreaterThan|Yes||Description:|
||||Specified action will be taken if the Email size matches the specified size.|
||||DropMessageGreaterThan confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|BulkAction|No||Description:|
||||Action to be taken if Email is detected as Bulk.|
||||BulkAction confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_BULK_ACTION_QUARANTINE}', '$EMAILPROTECTION{SMTP_BULK_ACTION_WARN}', '$EMAILPROTECTION{SMTP_BULK_ACTION_OFF}', '$EMAILPROTECTION{SMTP_BULK_ACTION_DROP}' are allowed.|
|routingorder|No||Description:|
||||Order in which Static Hosts are listed.|
||||routingorder confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
|NotifyOnMatch|No||Description:|
||||Enable to notify the sender of an Email if it is found to contain sensitive information as per configured DP policy.|
||||NotifyOnMatch confines to:|
||||Type is 'SCALAR'.|
||||Only '$EMAILPROTECTION{SMTP_DPP_NOTIFY_SENDER_DISABLE}', '$EMAILPROTECTION{SMTP_DPP_NOTIFY_SENDER_ENABLE}' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add SMTP Policy|200|SMTP policy has been added successfully|
|Add SMTP Policy|500|SMTP policy could not be added|
|Add SMTP Policy|542|Email address/domain could not be added. Address/domain already exists in current list, choose a different address/domain|
|Add SMTP Policy|541|Selected domain is already used in another profile|
|Add SMTP Policy|502|SMTP policy could not be added. A profile with the same name as "\<DynamicValue>" already exists, choose a different name|
|Add SMTP Policy|543|SMTP policy could not be added. You must select SPX template with password type other than "Sender generated" for data control list|
|Add SMTP Policy|545|Configuration could not be applied because MTA mode is disabled|
|Edit SMTP Policy|200|SMTP policy has been updated successfully|
|Edit SMTP Policy|500|SMTP policy update failed|
|Edit SMTP Policy|542|Email address/domain could not be added. Address/domain already exists in current list, choose a different address/domain|
|Edit SMTP Policy|541|Selected domain is already used in another profile|
|Edit SMTP Policy|543|SMTP policy could not be updated. You must select SPX template with password type other than "Sender generated" for data control list|
|Edit SMTP Policy|545|Configuration could not be applied because MTA mode is disabled|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
