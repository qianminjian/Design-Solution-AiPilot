"""配置管理 - 基于 Pydantic Settings 从环境变量加载"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """应用配置 - 所有配置从环境变量读取"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # 服务配置
    app_name: str = "ai-service"
    app_version: str = "0.1.0"
    environment: str = "development"
    log_level: str = "info"

    # 数据库配置（PostgreSQL）
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "design_platform"
    db_user: str = "platform"
    db_password: str = "platform_dev"
    db_pool_size: int = 10
    db_max_overflow: int = 20

    # AI Provider 配置
    llm_api_key: str = ""
    llm_api_base: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o"
    llm_timeout: int = 30

    # CORS
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    @property
    def database_url(self) -> str:
        """构建数据库连接 URL"""
        return (
            f"postgresql+psycopg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


settings = Settings()
