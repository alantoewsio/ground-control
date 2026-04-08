Operation:	Red Configuration
Description:	To register Sophos Firewall OS at the RED Provisioning Service (RPS) of Sophos to act as a RED hub. 

Sample Configuration
	<RED>
		<REDConfiguration>
			<Status>Enable/Disable</Status>
			<OrganizationName />
			<City />
			<Country />
			<Email />
			<REDEULA>Enable/Disable</REDEULA>
		</REDConfiguration>
	</RED>

Attribute/Parameter Information :

Parameter	Mandatory	Default	Description
Status	Yes 	 	Description:
Enter the status.
Status confines to:
Type is 'SCALAR'.
Only '0', '1' are allowed.
OrganizationName	No 	 	Description:
Enter the name of the organization.
OrganizationName confines to:
Type is 'SCALAR'.
Datatype is 'STRING'.
City	No 	 	Description:
Enter the city where the organization is located.
City confines to:
Type is 'SCALAR'.
Datatype is 'STRING'.
Country	No 	 	Description:
Select the country where the organization is located.
Country confines to:
Type is 'SCALAR'.
Datatype is 'STRING'.
Email	No 	 	Description:
Enter an email address.
Email confines to:
Type is 'SCALAR'.
Datatype is 'EMAIL'.
REDTermsOfUse	No 	 	Description:
Sophos End User Terms of Use
REDTermsOfUse confines to:
Type is 'SCALAR'.
Only '0', '1' are allowed.

Status Message Information :

Operation	  Status  	Message
Red Configuration	200	Updated RED configuration settings.
Red Configuration	500	Couldn't update RED configuration settings.
Red Configuration	511	Unknown internal error occured.
Red Configuration	512	The entered unlock code does not match for this device.
Red Configuration	513	Registering with RED registry service failed. Please make sure that this device can connect to the internet on port 3400.
Red Configuration	514	Unknown error occured in interaction with RED registry service.
Red Configuration	515	Failed to create RED certificate.
Red Configuration	516	Failed to delete RED certificate.
Red Configuration	517	Configuration cannot be updated as RED service is not running.
Red Configuration	518	Failed to create tunnel interface for RED device.
Red Configuration	519	Failed to delete tunnel interface for RED device.

© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
