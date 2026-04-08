"""Full-sync detection for config cache refresh."""

from app.firewall_config_sync import (
    is_full_firewall_config_sync,
    list_sync_entity_catalog,
)


def test_is_full_firewall_config_sync_requires_explicit_entities() -> None:
    catalog = [x["id"] for x in list_sync_entity_catalog()]
    assert not is_full_firewall_config_sync(
        entities=catalog,
        entities_explicit=False,
    )
    assert not is_full_firewall_config_sync(entities=None, entities_explicit=False)


def test_is_full_firewall_config_sync_all_catalog_ids() -> None:
    catalog_ids = [x["id"] for x in list_sync_entity_catalog()]
    full_set = sorted(catalog_ids)
    assert is_full_firewall_config_sync(
        entities=full_set,
        entities_explicit=True,
    )
    assert is_full_firewall_config_sync(
        entities=list(reversed(full_set)),
        entities_explicit=True,
    )


def test_is_full_firewall_config_sync_partial_not_full() -> None:
    catalog_ids = [x["id"] for x in list_sync_entity_catalog()]
    if len(catalog_ids) < 2:
        return
    assert not is_full_firewall_config_sync(
        entities=catalog_ids[:-1],
        entities_explicit=True,
    )


def test_apply_ssh_device_info_after_full_sync_skips_ssh_for_test_firewall(
    main_session,
    secrets_session,
) -> None:
    from app.firewall_ssh import (
        SSH_DEVICE_INFO_UNKNOWN,
        apply_firewall_ssh_device_info_after_full_sync,
    )
    from app.models import Firewall

    fw = Firewall(
        host="pytest-test-fw.example",
        port=4444,
        username="admin",
        is_test=True,
    )
    main_session.add(fw)
    main_session.commit()
    fid = int(fw.id)

    apply_firewall_ssh_device_info_after_full_sync(
        main_session, secrets_session, fid
    )
    main_session.refresh(fw)
    assert fw.firmware_version == SSH_DEVICE_INFO_UNKNOWN
    assert fw.model == SSH_DEVICE_INFO_UNKNOWN
    assert fw.device_hostname == SSH_DEVICE_INFO_UNKNOWN
    assert fw.serial_number == SSH_DEVICE_INFO_UNKNOWN
    assert fw.license_info == SSH_DEVICE_INFO_UNKNOWN
