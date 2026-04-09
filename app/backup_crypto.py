"""Password-based encryption for Ground Control backup archives (envelope around ZIP bytes)."""

from __future__ import annotations

import base64
import os

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

BACKUP_ENVELOPE_MAGIC = b"GCENC1"
_SALT_LEN = 16
_PBKDF2_ITERATIONS = 480_000


def _derive_fernet_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=_PBKDF2_ITERATIONS,
    )
    raw = kdf.derive(password.encode("utf-8"))
    return base64.urlsafe_b64encode(raw)


def encrypt_backup_archive(plain_zip: bytes, password: str) -> bytes:
    if not password:
        raise ValueError("Backup password is required to encrypt.")
    salt = os.urandom(_SALT_LEN)
    key = _derive_fernet_key(password, salt)
    token = Fernet(key).encrypt(plain_zip)
    return BACKUP_ENVELOPE_MAGIC + salt + token


def decrypt_backup_archive(envelope: bytes, password: str) -> bytes:
    if not password:
        raise ValueError("Backup password is required to decrypt this archive.")
    if len(envelope) < len(BACKUP_ENVELOPE_MAGIC) + _SALT_LEN + 1:
        raise ValueError("Backup file is too small or corrupted.")
    if not envelope.startswith(BACKUP_ENVELOPE_MAGIC):
        raise ValueError("Not a Ground Control encrypted backup envelope.")
    salt = envelope[len(BACKUP_ENVELOPE_MAGIC) : len(BACKUP_ENVELOPE_MAGIC) + _SALT_LEN]
    token = envelope[len(BACKUP_ENVELOPE_MAGIC) + _SALT_LEN :]
    key = _derive_fernet_key(password, salt)
    try:
        return Fernet(key).decrypt(token)
    except InvalidToken as exc:
        raise ValueError("Incorrect backup password or corrupted archive.") from exc


def is_gc_encrypted_backup(data: bytes) -> bool:
    return len(data) >= len(BACKUP_ENVELOPE_MAGIC) and data.startswith(
        BACKUP_ENVELOPE_MAGIC
    )


def is_plain_zip_payload(data: bytes) -> bool:
    return len(data) >= 4 and data[:4] == b"PK\x03\x04"
