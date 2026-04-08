Operation:	DeauthorizeDevice
Description:	To configure automatic device deauthorization. 

Sample Configuration
	<RED>
		<DeauthorizeDevice>
			<AutoDeauthorization>Enable/Disable</AutoDeauthorization>
			<DeauthorizeAfter />
		</DeauthorizeDevice>
	</RED>

Attribute/Parameter Information :

Parameter	Mandatory	Default	Description
AutoDeauthorization	Yes 	 	Description:
Enable/Disable Automatic Device Deauthorization.
AutoDeauthorization confines to:
Type is 'SCALAR'.
Only '0', '1' are allowed.
DeauthorizeAfter	No 	Disable 	Description:
Enter a time span after which the device will be deauthorized.
DeauthorizeAfter confines to:
Type is 'SCALAR'.
Datatype is 'INTEGER'.
Range 5 to 1440 is allowed.

Status Message Information :

Operation	  Status  	Message
DeauthorizeDevice	200	Updated automatic device deauthorization setting.
DeauthorizeDevice	500	Couldn't update automatic device deauthorization setting.
DeauthorizeDevice	511	Unknown internal error occured.
DeauthorizeDevice	517	Configuration cannot be updated as RED service is not running.

© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
