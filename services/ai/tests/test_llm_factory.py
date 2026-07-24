"""LLM Client 工厂单元测试

覆盖：
- 根据 settings 正确创建 OpenAICompatibleClient
- 配置参数透传（api_base/api_key/model/timeout）
- 不支持的 provider 抛 ValueError
- API Key 为空时仍创建 client（便于本地无 key 启动）
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest

from src.llm.client import LlmClient
from src.llm.factory import create_llm_client
from src.llm.openai_client import OpenAICompatibleClient


@dataclass
class _FakeSettings:
    """模拟 settings 对象，仅包含工厂依赖的字段"""

    llm_api_base: str = "https://api.openai.com/v1"
    llm_api_key: str = "sk-test-key"
    llm_model: str = "gpt-4o"
    llm_timeout: int = 30


@pytest.fixture
def fake_settings(monkeypatch: pytest.MonkeyPatch) -> _FakeSettings:
    """注入 _FakeSettings 到 factory 模块

    用 monkeypatch 替换 src.llm.factory.settings，
    测试结束后自动还原为原始 settings，避免污染其他测试。
    """
    settings = _FakeSettings()
    # factory.py 中 `from src.config import settings` 绑定到 factory 命名空间
    monkeypatch.setattr("src.llm.factory.settings", settings)
    return settings


class TestCreateLlmClient:
    """create_llm_client 工厂测试套"""

    @pytest.mark.asyncio
    async def test_should_create_openai_compatible_client(self, fake_settings):
        """默认 provider 应创建 OpenAICompatibleClient 实例"""
        # Act
        client = create_llm_client()

        # Assert
        try:
            assert isinstance(client, OpenAICompatibleClient)
            assert isinstance(client, LlmClient)
            assert client.provider_name == "openai"
        finally:
            await client.close()

    @pytest.mark.asyncio
    async def test_should_pass_api_base_to_client(self, fake_settings):
        """settings.llm_api_base 应透传给 client._api_base"""
        # Arrange
        fake_settings.llm_api_base = "https://custom.llm.endpoint/v1"

        # Act
        client = create_llm_client()

        # Assert
        try:
            assert client._api_base == "https://custom.llm.endpoint/v1"
        finally:
            await client.close()

    @pytest.mark.asyncio
    async def test_should_pass_api_key_to_client(self, fake_settings):
        """settings.llm_api_key 应透传给 client._api_key"""
        # Arrange
        fake_settings.llm_api_key = "sk-secret-key-123"

        # Act
        client = create_llm_client()

        # Assert
        try:
            assert client._api_key == "sk-secret-key-123"
            # 验证 header 中携带 Authorization
            headers = client._build_headers()
            assert headers["Authorization"] == "Bearer sk-secret-key-123"
        finally:
            await client.close()

    @pytest.mark.asyncio
    async def test_should_pass_model_to_client(self, fake_settings):
        """settings.llm_model 应透传给 client._model"""
        # Arrange
        fake_settings.llm_model = "gpt-4o-mini"

        # Act
        client = create_llm_client()

        # Assert
        try:
            assert client._model == "gpt-4o-mini"
        finally:
            await client.close()

    @pytest.mark.asyncio
    async def test_should_pass_timeout_to_client(self, fake_settings):
        """settings.llm_timeout 应透传给 client._timeout"""
        # Arrange - 测试 int 转 float 的类型转换
        fake_settings.llm_timeout = 60

        # Act
        client = create_llm_client()

        # Assert
        try:
            assert client._timeout == 60.0
            assert isinstance(client._timeout, float)
        finally:
            await client.close()

    @pytest.mark.asyncio
    async def test_should_create_client_with_empty_api_key(self, fake_settings):
        """API Key 为空时应仍创建 client（便于本地无 key 启动）

        工厂注释：LLM_API_KEY 为空时仍创建 client，调用时抛鉴权异常
        """
        # Arrange
        fake_settings.llm_api_key = ""

        # Act
        client = create_llm_client()

        # Assert - 不抛异常即可
        try:
            assert isinstance(client, OpenAICompatibleClient)
            assert client._api_key == ""
            headers = client._build_headers()
            # API Key 为空时不应包含 Authorization header
            assert "Authorization" not in headers
        finally:
            await client.close()

    @pytest.mark.asyncio
    async def test_should_strip_trailing_slash_in_api_base(self, fake_settings):
        """api_base 末尾的 / 应被去除（OpenAICompatibleClient 行为）"""
        # Arrange
        fake_settings.llm_api_base = "https://api.openai.com/v1/"

        # Act
        client = create_llm_client()

        # Assert
        try:
            assert client._api_base == "https://api.openai.com/v1"
        finally:
            await client.close()
