from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Hello Dashboard"
    database_url: str = "sqlite:///./dashboard.db"
    debug: bool = True
    
    # --- NEU: Das hat gefehlt! ---
    secret_key: str = "super_geheimer_fallback_key_falls_nichts_in_env_steht"
    # -----------------------------

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

settings = Settings()