"""Encrypt / decrypt connection config dicts using Fernet (AES + HMAC)."""

from __future__ import annotations

import base64
import hashlib
import json

from cryptography.fernet import Fernet, InvalidToken

# Sensitive fields that should be encrypted in connection configs
_SENSITIVE_FIELDS = {"password", "token", "secret", "credentials", "api_key"}


def _derive_key(secret: str) -> bytes:
    """Derive a 32-byte Fernet-compatible key from an arbitrary secret string."""
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_config(config: dict, key: str) -> dict:
    """Encrypt the sensitive fields of a config dict. Returns a dict (safe for JSONB)."""
    fernet = Fernet(_derive_key(key))
    encrypted = {}
    for k, v in config.items():
        if any(s in k.lower() for s in _SENSITIVE_FIELDS):
            encrypted[k] = fernet.encrypt(json.dumps(v).encode()).decode()
        else:
            encrypted[k] = v
    return encrypted


def decrypt_config(config: dict | str, key: str) -> dict:
    """Decrypt a config dict's sensitive fields.

    Accepts both dict (JSONB) and str (legacy JSON-encoded) inputs.
    """
    fernet = Fernet(_derive_key(key))
    if isinstance(config, str):
        config = json.loads(config)

    decrypted = {}
    for k, v in config.items():
        if any(s in k.lower() for s in _SENSITIVE_FIELDS) and isinstance(v, str):
            try:
                decrypted[k] = json.loads(fernet.decrypt(v.encode()).decode())
            except (InvalidToken, json.JSONDecodeError):
                # If decryption fails, the value might be plaintext (legacy)
                decrypted[k] = v
        else:
            decrypted[k] = v
    return decrypted
