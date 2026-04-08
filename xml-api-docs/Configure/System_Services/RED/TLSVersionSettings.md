Operation:	TLSVersionSettings
Description:	To configure TLS version settings. 

Sample Configuration
	<RED>
		<TLSVersionSettings>
			<TLSVersion>TLS v1.0 and later/TLS v1.2 and later/TLS v1.2 (strict) and later</TLSVersion>
		</TLSVersionSettings>
	</RED>

Attribute/Parameter Information :

Parameter	Mandatory	Default	Description
TLSVersion	Yes 	 	Description:
Enter the TLS version for RED.
TLSVersion confines to:
Type is 'SCALAR'.
Only '0', '1', '2' are allowed.

Status Message Information :

Operation	  Status  	Message
TLSVersionSettings	200	Updated the TLS version setting.
TLSVersionSettings	500	Couldn't update the TLS version setting.
TLSVersionSettings	517	Configuration cannot be updated as RED service is not running.
TLSVersionSettings	520	Unknown internal error occured.

© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
