# NatRule

- Operation: Add NAT policy / Edit NAT policy
- Description: Create NAT policy. Edit NAT policy.

## Sample Configuration

``` xml
<NATRule>
    <Name>Rule Name</Name>
    <Description>Description of Rule</Description>
    <IPFamily>IPv4/IPv6</IPFamily>
    <Status>Enable/Disable</Status>
    <Position>top/bottom/after/before</Position>
    <!-- After and Before Tag Apply only for Set Request -->
    <After>
        <Name>NAT Rule name after which Rule Inserted </Name>
    </After>
    <Before>
        <Name>NAT Rule name before which Rule Inserted </Name>
    </Before>
    <!-- Only Applicable to create Linked NAT for Set Request -->
    <LinkedFirewallrule>FirewallRuleName</LinkedFirewallrule>

    <OriginalSourceNetworks>
        <Network>Source Network</Network>
        <Network>Source Network</Network>
            :
    </OriginalSourceNetworks>
    <TranslatedSource>Original/MASQ/IPAddress/IPRange</TranslatedSource>

    <OriginalDestinationNetworks>
        <Network>Source Network</Network>
        <Network>Source Network</Network>
            :
    </OriginalDestinationNetworks>
    <TranslatedDestination>Original/IPAddress/IPRange/IPList/FQDN</TranslatedDestination>

    <OriginalServices>
        <Service>servicename</Service>
        :
    </OriginalServices>
    <TranslatedService>Original/TCPUDP_Service</TranslatedService>

    <InboundInterfaces>
        <Interface>interface</Interface>
        :
    </InboundInterfaces>
    <OutboundInterfaces>
        <Interface>interface</Interface>
        :
    </OutboundInterfaces>
    <OverrideInterfaceNATPolicy>Enable/Disable</OverrideInterfaceNATPolicy>
    <!-- Case when OverrideInterfaceDefaultNATPolicy is Enable -->
    <InterfaceNATPolicyList>
        <Override>
            <specific_interface>interface</specific_interface>
            <specific_translatedsourceid>Original/MASQ/IPAddress/IPRange</specific_translatedsourceid>
        </Override>
        :
        :
    </InterfaceNATPolicyList>
    <NATMethod>Round-robin/First_alive/Random/StickyIP/OnetoOne</NATMethod>
    <HealthCheck>Enable/Disable</HealthCheck>
    <LoadBalance>
        <!-- Case when HealthCheck is Enable -->
        <ProbeMethod>TCP/ICMP</ProbeMethod>
        <!-- Only ProbeMethod as TCP -->
        <Port>1-65535</Port>
        <ProbeInterval />
        <ResponseTimeOut>1-10</ResponseTimeOut>
        <DeactivateHostAfter>1-10</DeactivateHostAfter>
    </LoadBalance>
</NATRule>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Specify the NAT policy name.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|Description|No||Description:|
||||Enter a description for the NAT policy.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 255.|
|IPFamily|No|IPv4|Description:|
||||Select the Internet Protocol version.|
||||IPFamily confines to:|
||||Type is 'SCALAR'.|
||||Only 'IPv4', 'IPv6' are allowed.|
|Status|No|ON|Description:|
||||Turn on or turn off policy.|
||||Status confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|Position|Yes||Description:|
||||Rule position in the NAT rule list.|
||||Position confines to:|
||||Type is 'SCALAR'.|
||||Only 'Bottom', 'Top', 'After', 'Before' are allowed.|
|Name|No||Description:|
||||Specify the name of NAT rule above or below which you want to insert the rule.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|LinkedFirewallrule|No||Description:|
||||Specify the firewall rule name to create a linked NAT rule.|
||||LinkedFirewallrule confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Network|No||Description:|
||||Select the source networks to be allowed.|
||||Network confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|
|TranslatedSource|No||Description:|
||||Select the translated source network. To masquerade, select MASQ.|
||||TranslatedSource confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Network|No||Description:|
||||Select the destination networks to be allowed.|
||||Network confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|
|TranslatedDestination|No||Description:|
||||Select the translated destination network.|
||||TranslatedDestination confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Service|No||Description:|
||||Select the services or service groups to which the rule is to be applied.|
||||Service confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|
|TranslatedService|No||Description:|
||||Select the translated services or service groups.|
||||TranslatedService confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
|Interface|No||Description:|
||||Select the inbound interfaces to be allowed.|
||||Interface confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Interface|No||Description:|
||||Select the outbound interfaces to be allowed.|
||||Interface confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|OverrideInterfaceNATPolicy|No|Disable|Description:|
||||Turn on or turn off override NAT.|
||||OverrideInterfaceNATPolicy confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|InterfaceNATPolicyList|No|NULL|Description:|
||||Specify 'interfacespecific_nat_object'|
||||InterfaceNATPolicyList confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'OBJECT'.|
||||interfacespecific_nat_object|
||||Multiple values are allowed.|
|specific_interface|Yes||Description:|
||||Select the outbound interfaces to be allowed.|
||||specific_interface confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|specific_translatedsourceid|No||Description:|
||||Select the translated source network. To masquerade, select MASQ.|
||||specific_translatedsourceid confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|NATMethod|No|Sticky IP|Description:|
||||Select the method of load balancing.|
||||NATMethod confines to:|
||||Type is 'SCALAR'.|
||||Only 'Round-robin', 'First_alive', 'Random', 'StickyIP', 'OnetoOne' are allowed.|
||||Note:|
||||Applicable when Source Zone for Hosted Server is selected as 'WAN' and 'IP Range' or 'IP List' is selected for Protected Server.|
|HealthCheck|No|OFF|Description:|
||||Select to check if IP addresses are alive.|
||||HealthCheck confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
||||Note:|
||||Applicable only if 'Load Balancing' is enabled.|
|ProbeMethod|Yes||Description:|
||||Select the probe method to check server health.|
||||ProbeMethod confines to:|
||||Type is 'SCALAR'.|
||||Only 'ICMP', 'TCP' are allowed.|
|Port|Yes||Description:|
||||Specify the port number on which server health is to be monitored.|
||||Port confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Allowed port range: 1 to 65535|
||||Maximum digits allowed are 5.|
||||Note:|
||||Applicable only if 'TCP Probe' Health Check Method is selected.|
|ProbeInterval|Yes|60|Description:|
||||Specify the time interval (in seconds) after which health is to be monitored.|
||||ProbeInterval confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 5 to 65535 is allowed.|
||||Maximum digits allowed are 5.|
|ResponseTimeOut|Yes|2|Description:|
||||Specify the duration (in seconds) within which the server must respond.|
||||ResponseTimeOut confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 10 is allowed.|
||||Maximum digits allowed are 2.|
|DeactivateHostAfter|No|3|Description:|
||||Specify the number of tries to probe server health after which server is declared unreachable.|
||||DeactivateHostAfter confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 10 is allowed.|
||||Maximum digits allowed are 2.|
|monitorindex|No||Description:|
||||Specify 'monitorindex'|
||||monitorindex confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add NAT policy|200|Added NAT rule "\<DynamicValue>"|
|Add NAT policy|500|Couldn't add NAT rule "\<DynamicValue>"|
|Add NAT policy|502|NAT rule "\<DynamicValue>" exists. Specify a different name|
|Add NAT policy|503|Virtual host could not be added. Virtual host/web server with the same IP address already exists, choose a different external IP address|
|Add NAT policy|504|Virtual host could not be added. Virtual host/web server with the same port/port range already exists. Please choose a different external port/port range|
|Add NAT policy|522|Virtual host could not be created. External IP address range can have a maximum of 128 IP addresses|
|Add NAT policy|523|Virtual host could not be created. Mapped IP address range can have a maximum of 128 IP addresses|
|Add NAT policy|541|Number of IP addresses in external IP range and mapped IP range do not match|
|Add NAT policy|548|Protected application server of IPv4 cannot be bound with non-HTTP-based policy with IP range more than 255|
|Add NAT policy|549|Protected application server of IPv4 cannot be bound with non-HTTP-based policy with IP range more than 255|
|Edit NAT policy|200|Updated NAT rule "\<DynamicValue>"|
|Edit NAT policy|500|Couldn't update NAT rule "\<DynamicValue>"|
|Edit NAT policy|502|NAT rule "\<DynamicValue>" exists. Specify a different name|
|Edit NAT policy|503|Virtual host could not be added. Virtual host/web server with the same IP address already exists, choose a different external IP address|
|Edit NAT policy|504|Virtual host could not be added. Virtual host/web server with the same port/port range already exists. Please choose a different external port/port range|
|Edit NAT policy|522|Virtual host could not be created. External IP address range can have a maximum of 128 IP addresses|
|Edit NAT policy|523|Virtual host could not be created. Mapped IP address range can have a maximum of 128 IP addresses|
|Edit NAT policy|541|Number of IP addresses in external IP range and mapped IP range do not match|
|Edit NAT policy|548|Protected application server of IPv4 cannot be bound with non-HTTP-based policy with IP range more than 255|
|Edit NAT policy|549|Protected application server of IPv4 cannot be bound with non-HTTP-based policy with IP range more than 255|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
