"""All configuration in one place.

Values come from real environment variables first (Docker / CI / hosting), then
from backend/.env for local development. A missing or malformed value stops the
app at start-up with a clear message instead of failing later at runtime.
"""
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Core
    database_url: str
    secret_key: str = Field(min_length=32)
    cors_origin: str = "http://localhost:5175"      # comma-separated list allowed
    api_public_url: str = "http://localhost:8003"   # where PayHere can reach this API
    rate_limit_enabled: bool = True

    # Email (Gmail app password)
    mail_host: str = "smtp.gmail.com"
    mail_port: int = 465
    mail_username: str = ""
    mail_password: str = ""
    mail_from_name: str = "Sharing Excess"

    # PayHere (defaults are the published sandbox values)
    payhere_sandbox: bool = True
    payhere_merchant_id: str = "1211149"
    payhere_merchant_secret: str = "Pay&HeRe"

    # Cloudinary (optional - falls back to local uploads/)
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    @field_validator("database_url")
    @classmethod
    def _postgres_only(cls, v: str) -> str:
        if not v.startswith("postgresql"):
            raise ValueError("DATABASE_URL must be a postgresql:// URL")
        return v

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origin.split(",") if o.strip()]

    @property
    def frontend_url(self) -> str:
        """First allowed origin - used for PayHere return/cancel links."""
        return self.cors_origins[0] if self.cors_origins else "http://localhost:5175"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
