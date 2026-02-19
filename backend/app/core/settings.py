from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Hello Dashboard"
    database_url: str = "sqlite:///./dashboard.db"
    debug: bool = True

model_config = SettingsConfigDict(
    env_file=".env",
    env_file_encoding="utf-8",
    case_sensitive=False,
    extra="ignore",
)




settings = Settings()
