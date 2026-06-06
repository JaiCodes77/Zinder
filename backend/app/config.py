from typing import List
import json
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    REDIS_URL: str = "redis://localhost:6379/0"
    PORT: int = 8080
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()
            # Attempt to parse as a JSON list (e.g. '["http://localhost:3000"]')
            if v.startswith("[") and v.endswith("]"):
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(item) for item in parsed]
                except json.JSONDecodeError:
                    pass
            # Fallback to comma-separated values (e.g. 'http://localhost:3000,http://localhost:5173')
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

settings = Settings()
