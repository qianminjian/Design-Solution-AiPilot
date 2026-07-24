"""配置管理 - 基于 Pydantic Settings 从环境变量加载"""

from typing import Any

from pydantic import field_validator
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

    # RAG 配置
    embedding_model: str = "all-MiniLM-L6-v2"
    chromadb_url: str = "http://localhost:8000"
    chromadb_auth_credentials: str = ""
    chromadb_persist_directory: str = "./data/chroma"
    chunk_size: int = 512
    chunk_overlap: int = 64
    top_k: int = 5

    # MinIO / S3 配置
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket_name: str = "platform-data"
    s3_region: str = "us-east-1"

    # CORS - 接受字符串格式（逗号分隔或 JSON 数组），通过属性解析为列表
    cors_origins: str = "http://localhost:3000"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def normalize_cors_origins(cls, value: Any) -> str:
        """规范化 cors_origins 为字符串存储"""
        if value is None:
            return "http://localhost:3000"
        if isinstance(value, list):
            # 列表输入时重新序列化为逗号分隔字符串
            return ",".join(str(item) for item in value)
        return str(value)

    @property
    def cors_origins_list(self) -> list[str]:
        """解析 cors_origins 字符串为列表（支持逗号分隔与 JSON 数组格式）"""
        import json

        stripped = self.cors_origins.strip()
        if stripped.startswith("["):
            try:
                parsed = json.loads(stripped)
                if isinstance(parsed, list):
                    return [str(item) for item in parsed]
            except json.JSONDecodeError:
                pass
        return [item.strip() for item in stripped.split(",") if item.strip()]

    @property
    def database_url(self) -> str:
        """构建数据库连接 URL"""
        return (
            f"postgresql+psycopg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


settings = Settings()
