"""Tests for silent SSH SFOS main-menu banner parsing."""

from app.firewall_ssh import (
    parse_sophos_ssh_main_menu_screen,
    strip_ssh_terminal_escapes,
)

_SAMPLE_SCREEN = """
Sophos Firmware Version: SFOS 22.0.0 GA-Build411 
Model: SF01V 
Hostname: gw.payg.aws.toews.io 

Main Menu 

    1.  Network  Configuration
    2.  System   Configuration
    3.  Route    Configuration 
    4.  Device Console 
    5.  Device Management
    6.  VPN Management
    7.  Shutdown/Reboot Device
    0.  Exit 

    Select Menu Number [0-7]: 
"""


def test_parse_sophos_ssh_main_menu_screen_sample() -> None:
    p = parse_sophos_ssh_main_menu_screen(_SAMPLE_SCREEN)
    assert p["firmware_version"] == "SFOS 22.0.0 GA-Build411"
    assert p["model"] == "SF01V"
    assert p["device_hostname"] == "gw.payg.aws.toews.io"


def test_parse_case_insensitive_labels() -> None:
    text = "SOPHOS FIRMWARE VERSION: v1\nMODEL: X\nHOSTNAME: h.example\n"
    p = parse_sophos_ssh_main_menu_screen(text)
    assert p["firmware_version"] == "v1"
    assert p["model"] == "X"
    assert p["device_hostname"] == "h.example"


def test_strip_ansi_before_parse() -> None:
    raw = "\x1b[31mSophos Firmware Version:\x1b[0m SFOS 9\nModel: M1\n"
    cleaned = strip_ssh_terminal_escapes(raw)
    assert "\x1b" not in cleaned
    p = parse_sophos_ssh_main_menu_screen(raw)
    assert p["firmware_version"] == "SFOS 9"
    assert p["model"] == "M1"
