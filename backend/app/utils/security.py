import secrets

from passlib.context import CryptContext

# pbkdf2_sha256 is compatible with Python 3.14+; bcrypt is not
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def generate_otp() -> str:
    """Cryptographically random 6-digit OTP."""
    return str(secrets.randbelow(900000) + 100000)
