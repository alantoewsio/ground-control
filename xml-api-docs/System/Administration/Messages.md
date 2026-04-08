# Messages

- **Operation**: Reset Admin Messages / Update Admin Messages
- **Description**: Customize Messages which are displayed during User Events.

## Sample Configuration

``` xml
<Messages>
<!-- FOR API update only provided -->
  <AuthenticationMessages>
    <Useraccountblocked>Text</Useraccountblocked>
    <Useraccountdisabled>Text</Useraccountdisabled>
    <Useraccountexpired>Text</Useraccountexpired>
    <ClientlessUserLoginNotAllowed>Text</ClientlessUserLoginNotAllowed>
    <DataTransferExhausted>Text</DataTransferExhausted>
    <DeactiveUser>Text</DeactiveUser>
    <DeleteUser>Text</DeleteUser>
    <DisconnectUser>Text</DisconnectUser>
    <GuestUserValidityExpired>Text</GuestUserValidityExpired>
    <Loginnotallowedatthistime>Text</Loginnotallowedatthistime>
    <InvalidMachine>Text</InvalidMachine>
    <Loginnotallowedatthisworkstation>Text</Loginnotallowedatthisworkstation>
    <SomeoneelseisloggedinfromsameIPAddress>Text</SomeoneelseisloggedinfromsameIPAddress>
    <LoggedOffSuccessfulMessage>Text</LoggedOffSuccessfulMessage>
    <LoggedOnSuccessfulMessage>Text</LoggedOnSuccessfulMessage>
    <MaxLoginLimit>Text</MaxLoginLimit>
    <NotAuthenticate>Text</NotAuthenticate>
    <NotCurrentlyAllowed>Text</NotCurrentlyAllowed>
    <Userpasswordexpired>Text</Userpasswordexpired>
    <Userneedstoresetthepassword>Text</Userneedstoresetthepassword>
    <LoggedOffDueToSessionTimeOut>Text</LoggedOffDueToSessionTimeOut>
    <SurfingTimeExhausted>Text</SurfingTimeExhausted>
    <SurfingTimeExpired>Text</SurfingTimeExpired>
  </AuthenticationMessages>
  <SMTP>
    <SXLRejection>Text</SXLRejection>
    <ProbableSpamRejection>Text</ProbableSpamRejection>
    <ProbableVirusOutbreakRejection>Text</ProbableVirusOutbreakRejection>
    <SpamRejection>Text</SpamRejection>
    <VirusOutbreakRejection>Text</VirusOutbreakRejection>
    <EmailDomainRejection>Text</EmailDomainRejection>
    <SpamMailRejection>Text</SpamMailRejection>
    <MailHeaderRejection>Text</MailHeaderRejection>
    <MailVirusRejection>Text</MailVirusRejection>
    <IPAddressRejection>Text</IPAddressRejection>
    <OversizedMailRejection>Text</OversizedMailRejection>
    <UndersizedMailRejection>Text</UndersizedMailRejection>
    <DeliveryNotification>Text</DeliveryNotification>
    <AttachmentInfection>Text</AttachmentInfection>
    <RBLRejection>Text</RBLRejection>
    <SuspectedInfection>Text</SuspectedInfection>
    <DataControlListRejection>Text</DataControlListRejection>
    <SourceIPAddressRejection>Text</SourceIPAddressRejection>
    <DestinationIPAddressRejection>Text</DestinationIPAddressRejection>
  </SMTP>
  <Administration>
    <DisclaimerMessage>Text</DisclaimerMessage>
  </Administration>
  <SMSCustomization>
    <DefaultSMS>Text</DefaultSMS>
  </SMSCustomization>
</Messages>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Message|No | |Description:|
||||To update message.|
||||Message confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
||||Messages should not be blank, Maximum length allowed is 600 characters and New line character ( ) is not allowed.|
|ResetFlag|No | |Description:|
||||To reset an updated message to default.|
||||ResetFlag confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Reset Admin Messages|200|Operation Successful.|
|Reset Admin Messages|500|Operation Fail.|
|Update Admin Messages|200|Configuration message has been updated successfully|
|Update Admin Messages|500|Configuration message could not be updated|

---
© Copyright 2019 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
