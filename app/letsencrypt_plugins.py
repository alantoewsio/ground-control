"""Metadata for official Certbot DNS plugins (credential INI keys).

Credential keys match each plugin's documentation (``dns_<plugin>_*``).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class DnsPluginField:
    key: str
    label: str
    input_type: str  # text | password | textarea
    required: bool = True
    placeholder: str = ""


@dataclass(frozen=True)
class DnsPluginSpec:
    """``plugin_id`` is the Certbot DNS authenticator suffix (e.g. ``cloudflare`` → ``dns-cloudflare``)."""

    plugin_id: str
    label: str
    fields: tuple[DnsPluginField, ...]


# Official EFF DNS plugins: https://eff-certbot.readthedocs.io/en/stable/using.html#dns-plugins
DNS_PLUGIN_SPECS: tuple[DnsPluginSpec, ...] = (
    DnsPluginSpec(
        "cloudflare",
        "Cloudflare",
        (
            DnsPluginField(
                "dns_cloudflare_api_token",
                "API token",
                "password",
                True,
                "Create a token with Zone → DNS → Edit",
            ),
        ),
    ),
    DnsPluginSpec(
        "digitalocean",
        "DigitalOcean",
        (
            DnsPluginField(
                "dns_digitalocean_token",
                "Personal access token",
                "password",
                True,
                "",
            ),
        ),
    ),
    DnsPluginSpec(
        "dnsimple",
        "DNSimple",
        (
            DnsPluginField(
                "dns_dnsimple_token",
                "OAuth token / API token",
                "password",
                True,
                "",
            ),
        ),
    ),
    DnsPluginSpec(
        "dnsmadeeasy",
        "DNS Made Easy",
        (
            DnsPluginField("dns_dnsmadeeasy_key", "API key", "text", True, ""),
            DnsPluginField("dns_dnsmadeeasy_secret", "Secret key", "password", True, ""),
        ),
    ),
    DnsPluginSpec(
        "gehirn",
        "Gehirn Infrastructure Service",
        (
            DnsPluginField("dns_gehirn_api_token", "API token", "password", True, ""),
            DnsPluginField("dns_gehirn_api_secret", "API secret", "password", True, ""),
        ),
    ),
    DnsPluginSpec(
        "google",
        "Google Cloud DNS",
        (
            DnsPluginField(
                "dns_google_credentials_json",
                "Service account JSON",
                "textarea",
                True,
                "Paste the full JSON key for a service account with DNS Administrator on the zone",
            ),
        ),
    ),
    DnsPluginSpec(
        "linode",
        "Linode",
        (
            DnsPluginField(
                "dns_linode_key",
                "Personal access token",
                "password",
                True,
                "",
            ),
        ),
    ),
    DnsPluginSpec(
        "luadns",
        "LuaDNS",
        (
            DnsPluginField("dns_luadns_username", "Username / email", "text", True, ""),
            DnsPluginField("dns_luadns_token", "API token", "password", True, ""),
        ),
    ),
    DnsPluginSpec(
        "nsone",
        "NS1",
        (
            DnsPluginField(
                "dns_nsone_api_key",
                "API key",
                "password",
                True,
                "",
            ),
        ),
    ),
    DnsPluginSpec(
        "ovh",
        "OVH",
        (
            DnsPluginField(
                "dns_ovh_endpoint",
                "Endpoint",
                "text",
                True,
                "e.g. ovh-eu, ovh-us, kimsufi-eu, soyoustart-eu, runabove-ca",
            ),
            DnsPluginField("dns_ovh_application_key", "Application key", "text", True, ""),
            DnsPluginField("dns_ovh_application_secret", "Application secret", "password", True, ""),
            DnsPluginField("dns_ovh_consumer_key", "Consumer key", "password", True, ""),
        ),
    ),
    DnsPluginSpec(
        "rfc2136",
        "RFC 2136 (BIND / on-prem DNS)",
        (
            DnsPluginField("dns_rfc2136_server", "DNS server host", "text", True, ""),
            DnsPluginField(
                "dns_rfc2136_port",
                "DNS server port",
                "text",
                False,
                "53",
            ),
            DnsPluginField("dns_rfc2136_name", "TSIG key name", "text", True, ""),
            DnsPluginField("dns_rfc2136_secret", "TSIG secret (base64)", "password", True, ""),
            DnsPluginField(
                "dns_rfc2136_algorithm",
                "TSIG algorithm",
                "text",
                True,
                "HMAC-SHA256",
            ),
        ),
    ),
    DnsPluginSpec(
        "route53",
        "Amazon Route 53",
        (
            DnsPluginField(
                "dns_route53_access_key_id",
                "AWS access key ID",
                "text",
                False,
                "Optional if using an IAM instance profile",
            ),
            DnsPluginField(
                "dns_route53_secret_access_key",
                "AWS secret access key",
                "password",
                False,
                "Optional if using an IAM instance profile",
            ),
        ),
    ),
    DnsPluginSpec(
        "sakuracloud",
        "Sakura Cloud",
        (
            DnsPluginField("dns_sakuracloud_api_token", "API token", "password", True, ""),
            DnsPluginField("dns_sakuracloud_api_secret", "API secret", "password", True, ""),
        ),
    ),
)

PLUGIN_BY_ID: dict[str, DnsPluginSpec] = {p.plugin_id: p for p in DNS_PLUGIN_SPECS}


def plugins_payload() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for spec in DNS_PLUGIN_SPECS:
        out.append(
            {
                "id": spec.plugin_id,
                "label": spec.label,
                "fields": [
                    {
                        "key": f.key,
                        "label": f.label,
                        "type": f.input_type,
                        "required": f.required,
                        "placeholder": f.placeholder or None,
                    }
                    for f in spec.fields
                ],
            }
        )
    return out
