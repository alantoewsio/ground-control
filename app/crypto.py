from cryptography.fernet import Fernet, InvalidToken

from app import config


def _fernet() -> Fernet:
    key = config.fernet_key()
    if not key:
        raise RuntimeError(
            "GROUND_CONTROL_FERNET_KEY is not set. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_secret(plain: str) -> str:
    return _fernet().encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Could not decrypt stored secret (wrong key?)") from exc
