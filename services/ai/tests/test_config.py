"""Settings 配置加载与解析单元测试"""

from typing import Any
from unittest.mock import patch

import pytest

from src.config import Settings


def _make_settings(**overrides: Any) -> Settings:
    """构造 Settings 实例，允许覆盖部分字段"""
    return Settings(**overrides)


def test_default_settings_loads_correctly():
    """未传入任何覆盖时，应使用默认值"""
    settings = _make_settings()

    assert settings.app_name == "ai-service"
    assert settings.app_version == "0.1.0"
    assert settings.environment == "development"
    assert settings.log_level == "info"

    # 数据库默认值
    assert settings.db_host == "localhost"
    assert settings.db_port == 5432
    assert settings.db_name == "design_platform"
    assert settings.db_user == "platform"
    assert settings.db_password == "platform_dev"
    assert settings.db_pool_size == 10
    assert settings.db_max_overflow == 20

    # AI Provider 默认值
    assert settings.llm_api_key == ""
    assert settings.llm_api_base == "https://api.openai.com/v1"
    assert settings.llm_model == "gpt-4o"
    assert settings.llm_timeout == 30

    # RAG 默认值
    assert settings.embedding_model == "all-MiniLM-L6-v2"
    assert settings.chunk_size == 512
    assert settings.chunk_overlap == 64
    assert settings.top_k == 5

    # CORS 默认值
    assert settings.cors_origins == "http://localhost:3000"


def test_database_url_property():
    """database_url 属性应正确构建连接字符串"""
    settings = _make_settings(
        db_user="alice",
        db_password="s3cret",
        db_host="db.example.com",
        db_port=6543,
        db_name="mydb",
    )

    assert (
        settings.database_url
        == "postgresql+psycopg://alice:s3cret@db.example.com:6543/mydb"
    )


def test_cors_origins_list_default():
    """cors_origins_list 默认返回单个元素列表"""
    settings = _make_settings()
    assert settings.cors_origins_list == ["http://localhost:3000"]


def test_cors_origins_list_comma_separated():
    """cors_origins_list 应按逗号分隔为列表"""
    settings = _make_settings(cors_origins="https://a.com,https://b.com,https://c.com")
    assert settings.cors_origins_list == [
        "https://a.com",
        "https://b.com",
        "https://c.com",
    ]


def test_cors_origins_list_trims_whitespace():
    """cors_origins_list 应去除前后空格"""
    settings = _make_settings(cors_origins="  https://a.com  ,  https://b.com  ")
    assert settings.cors_origins_list == ["https://a.com", "https://b.com"]


def test_cors_origins_list_json_array_format():
    """cors_origins_list 应支持 JSON 数组格式"""
    settings = _make_settings(cors_origins='["https://a.com","https://b.com"]')
    assert settings.cors_origins_list == ["https://a.com", "https://b.com"]


def test_cors_origins_list_invalid_json_falls_back_to_comma_split():
    """cors_origins_list 遇到非法 JSON 应回退到逗号分隔"""
    # 以 [ 开头但非合法 JSON
    settings = _make_settings(cors_origins="[invalid json")
    # 应回退到逗号分隔，结果是 ["[invalid json"]
    assert settings.cors_origins_list == ["[invalid json"]


def test_cors_origins_list_empty_string():
    """cors_origins_list 为空字符串时返回空列表"""
    settings = _make_settings(cors_origins="")
    assert settings.cors_origins_list == []


def test_cors_origins_list_only_whitespace():
    """cors_origins_list 仅含空白时返回空列表"""
    settings = _make_settings(cors_origins="   ,   ,   ")
    assert settings.cors_origins_list == []


def test_cors_origins_validator_converts_list_to_string():
    """cors_origins 字段验证器应将列表转换为逗号分隔字符串"""
    settings = _make_settings(cors_origins=["https://a.com", "https://b.com"])  # type: ignore[arg-type]
    assert settings.cors_origins == "https://a.com,https://b.com"
    assert settings.cors_origins_list == ["https://a.com", "https://b.com"]


def test_cors_origins_validator_converts_none_to_default():
    """cors_origins 字段验证器应将 None 转换为默认值"""
    settings = _make_settings(cors_origins=None)  # type: ignore[arg-type]
    assert settings.cors_origins == "http://localhost:3000"


def test_cors_origins_validator_passes_string_through():
    """cors_origins 字段验证器应将字符串原样存储"""
    settings = _make_settings(cors_origins="https://example.com")
    assert settings.cors_origins == "https://example.com"


def test_settings_reads_environment_variables(monkeypatch: pytest.MonkeyPatch):
    """Settings 应从环境变量读取配置"""
    monkeypatch.setenv("APP_NAME", "ai-service-from-env")
    monkeypatch.setenv("DB_PORT", "9999")
    monkeypatch.setenv("LLM_MODEL", "claude-3.5-sonnet")
    monkeypatch.setenv("CORS_ORIGINS", "https://env-a.com,https://env-b.com")

    settings = Settings()

    assert settings.app_name == "ai-service-from-env"
    assert settings.db_port == 9999
    assert settings.llm_model == "claude-3.5-sonnet"
    assert settings.cors_origins == "https://env-a.com,https://env-b.com"
    assert settings.cors_origins_list == ["https://env-a.com", "https://env-b.com"]


def test_settings_case_insensitive_env(monkeypatch: pytest.MonkeyPatch):
    """Settings 应不区分大小写读取环境变量"""
    monkeypatch.setenv("APP_NAME", "lower-case-test")
    settings = Settings()
    assert settings.app_name == "lower-case-test"

    monkeypatch.setenv("app_name", "upper-case-test")
    settings = Settings()
    assert settings.app_name == "upper-case-test"


def test_settings_extra_env_ignored(monkeypatch: pytest.MonkeyPatch):
    """Settings 应忽略未声明的环境变量"""
    monkeypatch.setenv("UNKNOWN_FIELD", "ignored")
    # 不应抛出异常
    settings = Settings()
    assert not hasattr(settings, "unknown_field")
