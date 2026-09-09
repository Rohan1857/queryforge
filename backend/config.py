from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://bi_user:bi_pass@localhost:5432/queryforge"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Claude AI — no default, must be set in .env
    ANTHROPIC_API_KEY: str = ""

    # OpenRouter (preferred over direct Anthropic when set)
    OPENROUTER_API_KEY: str = ""
    LLM_MODEL: str = "anthropic/claude-sonnet-4-20250514"

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24

    # File Uploads
    UPLOAD_DIR: str = "./uploads"

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False

    # Development auth
    DEV_AUTH_BYPASS: bool = False
    DEV_AUTH_EMAIL: str = "dev@example.com"
    DEV_AUTH_NAME: str = "Developer Demo User"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
