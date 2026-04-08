"""IPS policy rule UI options (from ``mocks/ips policy rule drop-downs.md``)."""

IPS_POLICY_CATEGORIES: list[str] = [
    "All",
    "app-detect",
    "browser-chrome",
    "browser-firefox",
    "browser-ie",
    "browser-other",
    "browser-plugins",
    "browser-webkit",
    "exploit-kit",
    "file-executable",
    "file-flash",
    "file-identify",
    "file-image",
    "file-java",
    "file-multimedia",
    "file-office",
    "file-other",
    "file-pdf",
    "indicator-compromise",
    "indicator-obfuscation",
    "indicator-shellcode",
    "malware-backdoor",
    "malware-cnc",
    "malware-other",
    "misc",
    "netbios",
    "os-linux",
    "os-mobile",
    "os-other",
    "os-solaris",
    "os-windows",
    "policy-other",
    "protocol-dns",
    "protocol-ftp",
    "protocol-icmp",
    "protocol-imap",
    "protocol-nntp",
    "protocol-other",
    "protocol-pop",
    "protocol-rpc",
    "protocol-scada",
    "protocol-services",
    "protocol-snmp",
    "protocol-telnet",
    "protocol-tftp",
    "protocol-voip",
    "pua-other",
    "server-apache",
    "server-iis",
    "server-mail",
    "server-mssql",
    "server-mysql",
    "server-oracle",
    "server-other",
    "server-samba",
    "server-webapp",
    "sql",
    "scan",
]

IPS_POLICY_SEVERITIES: list[str] = [
    "All",
    "1 - Critical",
    "2 - Major",
    "3 - Moderate",
    "4 - Minor",
    "5 - Warning",
]

IPS_POLICY_PLATFORMS: list[str] = [
    "All",
    "Windows",
    "Linux",
    "Unix",
    "Mac",
    "Solaris",
    "BSD",
    "Other",
]

IPS_POLICY_TARGETS: list[str] = [
    "All",
    "Client",
    "Server",
]

IPS_POLICY_RULE_TYPES: tuple[str, ...] = ("Default Signature", "Custom Signature")

IPS_POLICY_SIGNATURE_SELECTION: tuple[str, ...] = ("All Application", "Individual Application")

IPS_POLICY_ACTIONS: tuple[str, ...] = (
    "Recommended",
    "Allow Packet",
    "Drop Packet",
    "Disable",
    "Drop Session",
    "Reset",
    "Bypass Session",
)
