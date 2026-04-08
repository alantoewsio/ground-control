# FirewallRule

- Operation: Add firewall rule / Edit firewall rule
- Description: Create or edit firewall rule.

## Sample Configuration

``` xml
<FirewallRule>
    <Name>rulename</Name>
    <Description>rule description</Description>
    <Status>Disable/Enable</Status>
    <IPFamily>IPv4/IPv6</IPFamily>
    <Position>top/bottom/after/before</Position>
    <Section>Central_TOP/Local/Central_Bottom</Section>
    <After>
        <Name>Policy name after which Policy Inserted</Name>
    </After>
    <Before>
        <Name>Policy name before which Policy Inserted</Name>
    </Before>
    <PolicyType>User/Network/HTTPBased</PolicyType>
    <UserPolicy>
        <Action>Accept/Reject/Drop</Action>
        <LogTraffic>Enable/Disable</LogTraffic>
        <SkipLocalDestined>Enable/Disable</SkipLocalDestined>
        <SourceZones>
            <Zone>Any/LAN/DMZ/VPN/WAN</Zone>
        </SourceZones>
        <SourceNetworks>
            <Network>Source Network</Network>
        </SourceNetworks>
        <Services>
            <Service>servicename</Service>
        </Services>
        <Schedule>All The Time</Schedule>
        <DestinationZones>
            <Zone>Any/WAN/LAN/LOCAL/VPN</Zone>
        </DestinationZones>
        <DestinationNetworks>
            <Network>Destination Network</Network>
        </DestinationNetworks>
        <MatchIdentity>Enable/Disable</MatchIdentity>
        <ShowCaptivePortal>Enable/Disable</ShowCaptivePortal>
        <Identity>
            <Member>users/groups</Member>
        </Identity>
        <DataAccounting>Include/Exclude</DataAccounting>
        <WebFilter>Allow All</WebFilter>
        <WebCategoryBaseQoSPolicy>Apply/Revoke</WebCategoryBaseQoSPolicy>
        <BlockQuickQuic>Enable/Disable</BlockQuickQuic>
        <ScanVirus>Enable/Disable</ScanVirus>
        <ZeroDayProtection>Enable/Disable</ZeroDayProtection>
        <ScanFTP>Enable/Disable</ScanFTP>
        <ProxyMode>Enable/Disable</ProxyMode>
        <DecryptHTTPS>Enable/Disable</DecryptHTTPS>
        <SourceSecurityHeartbeat>Enable/Disable</SourceSecurityHeartbeat>
        <MinimumSourceHBPermitted>NoRestriction</MinimumSourceHBPermitted>
        <DestSecurityHeartbeat>Enable/Disable</DestSecurityHeartbeat>
        <MinimumDestinationHBPermitted>NoRestriction</MinimumDestinationHBPermitted>
        <ApplicationControl>Allow All</ApplicationControl>
        <ApplicationBaseQoSPolicy>Apply/Revoke</ApplicationBaseQoSPolicy>
        <IntrusionPrevention>None</IntrusionPrevention>
        <TrafficShapingPolicy>None</TrafficShapingPolicy>
        <DSCPMarking>0-Best Effort</DSCPMarking>
        <ScanSMTP>Enable/Disable</ScanSMTP>
        <ScanSMTPS>Enable/Disable</ScanSMTPS>
        <ScanIMAP>Enable/Disable</ScanIMAP>
        <ScanIMAPS>Enable/Disable</ScanIMAPS>
        <ScanPOP3>Enable/Disable</ScanPOP3>
        <ScanPOP3S>Enable/Disable</ScanPOP3S>
    </UserPolicy>
    <NetworkPolicy>
        <Action>Accept/Reject/Drop</Action>
        <LogTraffic>Enable/Disable</LogTraffic>
        <SkipLocalDestined>Enable/Disable</SkipLocalDestined>
        <SourceZones>
            <Zone>Any/LAN/DMZ/VPN/WAN</Zone>
        </SourceZones>
        <SourceNetworks>
            <Network>Source Network</Network>
        </SourceNetworks>
        <Services>
            <Service>servicename</Service>
        </Services>
        <Schedule>All The Time</Schedule>
        <DestinationZones>
            <Zone>Any/WAN/LAN/LOCAL/VPN</Zone>
        </DestinationZones>
        <DestinationNetworks>
            <Network>Destination Network</Network>
        </DestinationNetworks>
        <WebFilter>Allow All</WebFilter>
        <WebCategoryBaseQoSPolicy>Apply/Revoke</WebCategoryBaseQoSPolicy>
        <BlockQuickQuic>Enable/Disable</BlockQuickQuic>
        <ScanVirus>Enable/Disable</ScanVirus>
        <ZeroDayProtection>Enable/Disable</ZeroDayProtection>
        <ScanFTP>Enable/Disable</ScanFTP>
        <ProxyMode>Enable/Disable</ProxyMode>
        <DecryptHTTPS>Enable/Disable</DecryptHTTPS>
        <SourceSecurityHeartbeat>Enable/Disable</SourceSecurityHeartbeat>
        <MinimumSourceHBPermitted>NoRestriction</MinimumSourceHBPermitted>
        <DestSecurityHeartbeat>Enable/Disable</DestSecurityHeartbeat>
        <MinimumDestinationHBPermitted>NoRestriction</MinimumDestinationHBPermitted>
        <ApplicationControl>Allow All</ApplicationControl>
        <ApplicationBaseQoSPolicy>Apply/Revoke</ApplicationBaseQoSPolicy>
        <IntrusionPrevention>None</IntrusionPrevention>
        <TrafficShapingPolicy>None</TrafficShapingPolicy>
        <DSCPMarking>0-Best Effort</DSCPMarking>
        <ScanSMTP>Enable/Disable</ScanSMTP>
        <ScanSMTPS>Enable/Disable</ScanSMTPS>
        <ScanIMAP>Enable/Disable</ScanIMAP>
        <ScanIMAPS>Enable/Disable</ScanIMAPS>
        <ScanPOP3>Enable/Disable</ScanPOP3>
        <ScanPOP3S>Enable/Disable</ScanPOP3S>
    </NetworkPolicy>
    <HTTPBasedPolicy>
        <HostedAddress>Address</HostedAddress>
        <HTTPS>Enable/Disable</HTTPS>
        <RedirectHTTP>Enable/Disable</RedirectHTTP>
        <ListenPort>80</ListenPort>
        <Domains>
            <Domain>example.com</Domain>
        </Domains>
        <SourceNetworks>
            <Network>Any</Network>
        </SourceNetworks>
        <ExceptionNetworks>
            <Network>192.168.1.0/24</Network>
        </ExceptionNetworks>
        <AccessPaths>
            <AccessPath>
                <path>/access</path>
                <backend>server1</backend>
                <auth_profile>profile1</auth_profile>
                <allowed_networks>192.168.1.0/24</allowed_networks>
                <denied_networks>10.0.0.0/8</denied_networks>
                <blocked_countries>CN</blocked_countries>
                <block_unknown_country>1/0</block_unknown_country>
                <stickysession_status>1/0</stickysession_status>
                <hot_standby>1/0</hot_standby>
                <websocket_passthrough>1/0</websocket_passthrough>
            </AccessPath>
        </AccessPaths>
        <Exceptions>
            <Exception>
                <path>psql</path>
                <op>and/or</op>
                <source>192.168.1.0/24</source>
                <skip_threats_filter_categories>application_attacks</skip_threats_filter_categories>
                <skipav>1</skipav>
                <skipbadclients>0</skipbadclients>
                <skipcookie>1</skipcookie>
                <skipform>0</skipform>
                <skipurl>1</skipurl>
                <skiphtmlrewrite>0</skiphtmlrewrite>
                <skipform_missingtoken>0</skipform_missingtoken>
            </Exception>
        </Exceptions>
        <ProtocolSecurity>Default</ProtocolSecurity>
        <CompressionSupport>Disable/Enable</CompressionSupport>
        <RewriteHTML>Enable/Disable</RewriteHTML>
        <RewriteCookies>Enable/Disable</RewriteCookies>
        <PassHostHeader>Enable/Disable</PassHostHeader>
        <IntrusionPrevention>None</IntrusionPrevention>
        <TrafficShapingPolicy>None</TrafficShapingPolicy>
    </HTTPBasedPolicy>
</FirewallRule>
```

## Attribute/Parameter Information

|Parameter|Mandatory|Default|Description|
|-|-|-|-|
|Name|Yes||Description:|
||||Specify a name to identify the Security Policy.|
||||Name confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 60.|
||||UTF-8 character(s) are allowed.|
|Description|No||Description:|
||||Specify description for the Security Policy.|
||||Description confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|Status|No|ON|Description:|
||||Enable/Disable the policy.|
||||Status confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|IPFamily|No|IPv4|Description:|
||||Select the Internet Protocol version.|
||||IPFamily confines to:|
||||Type is 'SCALAR'.|
||||Only 'IPv4', 'IPv6' are allowed.|
|Position|Yes||Description:|
||||Rule position in the firewall rule list.|
||||Position confines to:|
||||Type is 'SCALAR'.|
||||Only 'Bottom', 'Top', 'After', 'Before' are allowed.|
|Section|No||Description:|
||||Section to which the rule belongs.|
||||Section confines to:|
||||Type is 'SCALAR'.|
||||Only 'Central_TOP', 'Local', 'Central_Bottom' are allowed.|
|PolicyType|Yes||Description:|
||||Select the type of policy.|
||||PolicyType confines to:|
||||Type is 'SCALAR'.|
||||Only 'Network', 'User', 'HTTPBased' are allowed.|
|Action|No|Drop|Description:|
||||Specify action for the rule traffic.|
||||Action confines to:|
||||Type is 'SCALAR'.|
||||Only 'Accept', 'Drop', 'Reject' are allowed.|
|LogTraffic|No|Disable|Description:|
||||Enable traffic logging for the policy.|
||||LogTraffic confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|SkipLocalDestined|No||Description:|
||||Select if you don't want to apply the firewall rule when appliance IP address is the destination.|
||||SkipLocalDestined confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Zone|No||Description:|
||||Select the source/destination zones for the rule.|
||||Zone confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|Network|No||Description:|
||||Select the source/destination networks for the rule.|
||||Network confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|
|Service|No||Description:|
||||Select Service/Service Groups to which the rule is to be applied.|
||||Service confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 60.|
||||Multiple values are allowed.|
|Schedule|No|NULL|Description:|
||||Select Schedule for the Rule.|
||||Schedule confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|MatchIdentity|No|OFF|Description:|
||||Enable to check whether the specified user/user group from the selected zone is allowed to access the selected service or not.|
||||MatchIdentity confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|ShowCaptivePortal|No|OFF|Description:|
||||Select to accept traffic from unknown users. Captive portal page is displayed to the user where the user can login to access the Internet.|
||||ShowCaptivePortal confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|Member|No||Description:|
||||Select the user(s) or group(s) from the list of available options.|
||||Member confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Maximum characters allowed are 256.|
||||Multiple values are allowed.|
|DataAccounting|No|OFF|Description:|
||||Select to exclude user's network traffic from data accounting.|
||||DataAccounting confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|WebFilter|No|NULL|Description:|
||||Select Web Filter Policy for the rule.|
||||WebFilter confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|WebCategoryBaseQoSPolicy|No||Description:|
||||Select to limit bandwidth for the URLs categorized under the Web category.|
||||WebCategoryBaseQoSPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|BlockQuickQuic|No|OFF|Description:|
||||Ensure Google websites use HTTP/s instead of QUICK QUIC|
||||BlockQuickQuic confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|ScanVirus|No|OFF|Description:|
||||Select to enable virus and spam scanning for HTTP protocol and decrypted HTTPS protocol.|
||||ScanVirus confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|ZeroDayProtection|No|OFF|Description:|
||||Select to turn zero-day protection on.|
||||ZeroDayProtection confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|ScanFTP|No|OFF|Description:|
||||Enable/Disable scanning of FTP traffic.|
||||ScanFTP confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|ProxyMode|No|OFF|Description:|
||||Select to enable transparent web proxy|
||||ProxyMode confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable', 'true', 'false' are allowed.|
|DecryptHTTPS|No|OFF|Description:|
||||Select to decrypt traffic with HTTPS protocol.|
||||DecryptHTTPS confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|SourceSecurityHeartbeat|No|OFF|Description:|
||||Enable/Disable to require the sending of heartbeats.|
||||SourceSecurityHeartbeat confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|MinimumSourceHBPermitted|No|NoRestriction|Description:|
||||Select a minimum health status that a device must have to conform to this policy.|
||||MinimumSourceHBPermitted confines to:|
||||Type is 'SCALAR'.|
||||Only 'GREEN', 'YELLOW', 'No Restriction' are allowed.|
|DestSecurityHeartbeat|No|OFF|Description:|
||||Enable/Disable to require the sending of heartbeats.|
||||DestSecurityHeartbeat confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|MinimumDestinationHBPermitted|No|NoRestriction|Description:|
||||Select a minimum health status that a device must have to conform to this policy.|
||||MinimumDestinationHBPermitted confines to:|
||||Type is 'SCALAR'.|
||||Only 'GREEN', 'YELLOW', 'No Restriction' are allowed.|
|ApplicationControl|No|NULL|Description:|
||||Select Application Filter Policy for the rule.|
||||ApplicationControl confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ApplicationBaseQoSPolicy|No||Description:|
||||Select to limit the bandwidth for the applications categorized under the Application Category.|
||||ApplicationBaseQoSPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|IntrusionPrevention|No|NULL|Description:|
||||Select IPS policy for the rule.|
||||IntrusionPrevention confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|TrafficShapingPolicy|No|NULL|Description:|
||||Select Traffic Shaping policy for the rule.|
||||TrafficShapingPolicy confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|DSCPMarking|No|NULL|Description:|
||||Select DSCP Marking to classify flow of packets based on Traffic Shaping policy.|
||||DSCPMarking confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|ScanSMTP|No|OFF|Description:|
||||Enable/Disable scanning of SMTP traffic.|
||||ScanSMTP confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|ScanSMTPS|No|OFF|Description:|
||||Enable/Disable scanning of SMTPS traffic.|
||||ScanSMTPS confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|ScanIMAP|No|OFF|Description:|
||||Enable/Disable scanning of IMAP traffic.|
||||ScanIMAP confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|ScanIMAPS|No|OFF|Description:|
||||Enable/Disable scanning of IMAPS traffic.|
||||ScanIMAPS confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|ScanPOP3|No|OFF|Description:|
||||Enable/Disable scanning of POP3 traffic.|
||||ScanPOP3 confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|ScanPOP3S|No|OFF|Description:|
||||Enable/Disable scanning of POP3S traffic.|
||||ScanPOP3S confines to:|
||||Type is 'SCALAR'.|
||||Only 'Enable', 'Disable' are allowed.|
|HostedAddress|Yes||Description:|
||||Select the interface of the hosted server to which the rule applies.|
||||HostedAddress confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|HTTPS|Yes|Disable|Description:|
||||Click to enable or disable scanning of HTTPS traffic.|
||||HTTPS confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|RedirectHTTP|No|Disable|Description:|
||||Click to redirect HTTP requests.|
||||RedirectHTTP confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|ListenPort|Yes|80|Description:|
||||Enter a port number on which the hosted web server can be reached externally.|
||||ListenPort confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'INTEGER'.|
||||Range 1 to 65535 is allowed.|
|Domains|Yes||Description:|
||||Enter the domains the web server is responsible for as FQDN.|
||||Domains confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|path|Yes||Description:|
||||Enter the path for which you want to create the site path route.|
||||path confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
||||Character not allowed: Comma (,)|
||||Maximum characters allowed are 63.|
||||UTF-8 character(s) are allowed.|
|backend|Yes||Description:|
||||Select the web servers which are to be used for the specified path.|
||||backend confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|auth_profile|No||Description:|
||||Select the Authentication Policy.|
||||auth_profile confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|allowed_networks|No||Description:|
||||Select or add the allowed networks.|
||||allowed_networks confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|denied_networks|No||Description:|
||||Select or add the denied networks that should be blocked.|
||||denied_networks confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|blocked_countries|No||Description:|
||||Select or add the countries that should be blocked.|
||||blocked_countries confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|block_unknown_country|No||Description:|
||||Select this option if you want to block unknown country.|
||||block_unknown_country confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|stickysession_status|No||Description:|
||||Select this option to ensure that each session will be bound to one web server.|
||||stickysession_status confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|hot_standby|No||Description:|
||||Select this option if you want to send all requests to the first selected web server.|
||||hot_standby confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|websocket_passthrough|No||Description:|
||||Select this option to enable Websocket passthrough.|
||||websocket_passthrough confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|source|No||Description:|
||||Specify the source networks where the client request comes from.|
||||source confines to:|
||||Type is 'ARRAY'.|
||||Datatype is 'STRING'.|
||||Multiple values are allowed.|
|skip_threats_filter_categories|No|Disable|Description:|
||||Select various parameters that you want to skip in section 'Skip these categories'.|
||||skip_threats_filter_categories confines to:|
||||Type is 'ARRAY'.|
||||Maximum characters allowed are 30.|
||||Only 'application_attacks', 'sql_injection_attacks', 'xss_attacks', 'protocol_enforcement', 'scanner_detection', 'data_leakages' are allowed.|
||||Multiple values are allowed.|
|skipav|No|Disable|Description:|
||||Click this to skip 'Anti-Virus'.|
||||skipav confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|skipbadclients|No|Disable|Description:|
||||Select this to skip 'Block Clients with bad reputation'.|
||||skipbadclients confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|skipcookie|No|Disable|Description:|
||||Select this to 'Skip Cookie Signing'.|
||||skipcookie confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|skipform|No|Disable|Description:|
||||Click to skip 'Form Hardening'.|
||||skipform confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|skipurl|No|Disable|Description:|
||||Select this to skip 'Static URL Hardening'.|
||||skipurl confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|skiphtmlrewrite|No|Disable|Description:|
||||If selected, no data matching the defined exception settings will be modified by the WAF engine.|
||||skiphtmlrewrite confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|skipform_missingtoken|No|Disable|Description:|
||||Select this to accept unhardened form data.|
||||skipform_missingtoken confines to:|
||||Type is 'SCALAR'.|
||||Only '0', '1' are allowed.|
|op|No|And|Description:|
||||Select the operation among AND or OR for Path and Source.|
||||op confines to:|
||||Type is 'SCALAR'.|
||||Only 'and', 'or', 'AND', 'OR' are allowed.|
|ProtocolSecurity|No||Description:|
||||Select the Protocol Security policy.|
||||ProtocolSecurity confines to:|
||||Type is 'SCALAR'.|
||||Datatype is 'STRING'.|
|CompressionSupport|No|Disable|Description:|
||||Select this to not send content in compressed form to client on request.|
||||CompressionSupport confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|RewriteHTML|No|Disable|Description:|
||||Select this option to have the device rewrite links of the returned webpages.|
||||RewriteHTML confines to:|
||||Type is 'SCALAR'.|
||||Only '0', 'Enable' are allowed.|
|RewriteCookies|No|Enable|Description:|
||||Select this option to have the device rewrite cookies of the returned webpages.|
||||RewriteCookies confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|
|PassHostHeader|No|Disable|Description:|
||||When you select this option, the host header as requested by the client will be preserved.|
||||PassHostHeader confines to:|
||||Type is 'SCALAR'.|
||||Only 'Disable', 'Enable' are allowed.|

## Status Message Information

|Operation|Status|Message|
|-|-|-|
|Add firewall rule|200|Firewall rule has been created successfully|
|Add firewall rule|500|Firewall rule could not be created|
|Add firewall rule|502|Firewall rule with the same name already exists|
|Add firewall rule|541|Number of IP addresses in external IP range and mapped IP range do not match|
|Add firewall rule|542|Can't select HTTP on the specified listening port. Another server is using HTTPS on this port|
|Add firewall rule|543|Can't redirect to HTTPS. The specified domains are in use in another firewall rule on port 80|
|Add firewall rule|544|Can't specify port 80 for this domain. The domain has HTTP to HTTPS redirection in another rule|
|Add firewall rule|545|Service is already configured on the specified port, choose another port|
|Add firewall rule|546|The specified domains are in use in another policy on the same listening port|
|Add firewall rule|547|You cannot create business application rule using the specified "Hosted address" and "Listening port"|
|Add firewall rule|548|Protected application server of IPv4 cannot be bound with non-HTTP-based policy with IP range more than 255|
|Add firewall rule|549|Protected application server of IPv4 cannot be bound with non-HTTP-based policy with IP range more than 255|
|Add firewall rule|550|You cannot configure "\<DynamicValue>" for listening port as it is configured as user portal port|
|Add firewall rule|551|Can't select "Block request to destination with no heartbeat" if WAN is selected in "Destination zones"|
|Add firewall rule|553|Can't set up redirection to HTTPS for the same domains in different policies|
|Add firewall rule|554|Can't create firewall rule. Can't specify wildcard FQDN for a protected server|
|Add firewall rule|596|Can't make the change locally. For configurations made through Sophos Central, you can only make changes centrally|
|Edit firewall rule|200|Firewall rule has been updated successfully|
|Edit firewall rule|202|Firewall rule "\<DynamicValue>" has been renamed to "\<DynamicValue>" and updated successfully|
|Edit firewall rule|500|Firewall rule could not be updated|
|Edit firewall rule|502|Firewall rule could not be updated. Firewall rule "\<DynamicValue>" already exists, choose a different name|
|Edit firewall rule|541|Failed to create/update the firewall rule as more than 1024 objects have been selected simultaneously|
|Edit firewall rule|542|Can't select HTTP on the specified listening port. Another server is using HTTPS on this port|
|Edit firewall rule|543|Can't specify port 80 for this domain. The domain has HTTP to HTTPS redirection in another rule|
|Edit firewall rule|544|Can't redirect to HTTPS. The specified domains are in use in another firewall rule on port 80|
|Edit firewall rule|545|Service is already configured on the specified port, choose another port|
|Edit firewall rule|546|The specified domains are in use in another policy on the same listening port|
|Edit firewall rule|547|You cannot create business application rule using the specified "Hosted address" and "Listening port"|
|Edit firewall rule|548|Protected application server of IPv4 cannot be bound with non-HTTP-based policy with IP range more than 255|
|Edit firewall rule|549|Protected application server of IPv4 cannot be bound with non-HTTP-based policy with IP range more than 255|
|Edit firewall rule|550|You cannot configure "\<DynamicValue>" for listening port as it is configured as user portal port|
|Edit firewall rule|551|Can't select "Block request to destination with no heartbeat" if WAN is selected in "Destination zones"|
|Edit firewall rule|552|Firewall rule with the same rule name but different rule type already exists|
|Edit firewall rule|553|Can't set up redirection to HTTPS for the same domains in different policies|
|Edit firewall rule|554|Can't update a firewall rule that specifies wildcard FQDN for a protected server|
|Edit firewall rule|596|Can't make the change locally. For configurations made through Sophos Central, you can only make changes centrally|

---
© Copyright 2025 Sophos Firewall Limited. All rights reserved.
Sophos Firewall is registered trademarks of Sophos Firewall Limited and Sophos Firewall Group. All other product and company names mentioned are trademarks or registered trademarks of their respective owners.
No part of this publication may be reproduced, stored in a retrieval system, or transmitted, in any form or by any means, electronic, mechanical, photocopying, recording or otherwise unless you are either a valid licensee where the documentation can be reproduced in accordance with the license terms or you otherwise have the prior permission in writing of the copyright owner.
