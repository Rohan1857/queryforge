from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://bi_user:bi_pass@localhost:5432/queryforge"

    @property
    def async_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        if url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Claude AI — no default, must be set in .env
    ANTHROPIC_API_KEY: str = ""

    # OpenRouter (preferred over direct Anthropic when set)
    OPENROUTER_API_KEY: str = ""
    LLM_MODEL: str = "cohere/north-mini-code:free"

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24

    # File Uploads
    UPLOAD_DIR: str = "./uploads"

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Server & CORS
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    CORS_ORIGINS: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        defaults = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
        if self.CORS_ORIGINS:
            custom = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
            return list(dict.fromkeys(defaults + custom))
        return defaults

    # Development auth
    DEV_AUTH_BYPASS: bool = False
    DEV_AUTH_EMAIL: str = "dev@example.com"
    DEV_AUTH_NAME: str = "Developer Demo User"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
