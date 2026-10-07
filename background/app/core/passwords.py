"""Shared bcrypt input contract; passwords are never silently truncated."""

BCRYPT_MAX_PASSWORD_BYTES = 72


def encode_bcrypt_password(password: str) -> bytes:
    encoded = password.encode('utf-8')
    if len(encoded) > BCRYPT_MAX_PASSWORD_BYTES:
        raise ValueError('密码 UTF-8 编码后不能超过 72 字节（中文通常占 3 字节）')
    return encoded
