"""pytest 全局 fixtures"""

from collections.abc import AsyncIterator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from src.llm.client import (
    ChatMessage,
    ChatResult,
    EmbeddingResult,
    LlmClient,
    TokenUsage,
)
from src.main import app


class MockLlmClient(LlmClient):
    """内存 LlmClient mock，用于 capability 端点测试

    通过设置 chat_result / embed_result / chat_exception 控制行为。
    """

    def __init__(
        self,
        *,
        chat_result: ChatResult | None = None,
        embed_result: EmbeddingResult | None = None,
        chat_exception: Exception | None = None,
        embed_exception: Exception | None = None,
    ):
        self._chat_result = chat_result
        self._embed_result = embed_result
        self._chat_exception = chat_exception
        self._embed_exception = embed_exception
        self.chat_calls: list[dict[str, Any]] = []
        self.embed_calls: list[dict[str, Any]] = []

    @property
    def provider_name(self) -> str:
        return "mock"

    async def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> ChatResult:
        messages: list[ChatMessage] = []
        if system:
            messages.append(ChatMessage(role="system", content=system))
        messages.append(ChatMessage(role="user", content=prompt))
        return await self.chat(messages, temperature=temperature, max_tokens=max_tokens)

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> ChatResult:
        self.chat_calls.append({
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        })
        if self._chat_exception is not None:
            raise self._chat_exception
        if self._chat_result is None:
            raise RuntimeError("MockLlmClient 未配置 chat_result")
        return self._chat_result

    async def embed(self, input_text: str, *, model: str | None = None) -> EmbeddingResult:
        self.embed_calls.append({"input": input_text, "model": model})
        if self._embed_exception is not None:
            raise self._embed_exception
        if self._embed_result is None:
            raise RuntimeError("MockLlmClient 未配置 embed_result")
        return self._embed_result

    async def close(self) -> None:
        pass


def make_chat_result(
    *,
    content: str = "mocked response",
    model: str = "gpt-4o",
    finish_reason: str = "stop",
    prompt_tokens: int = 10,
    completion_tokens: int = 5,
) -> ChatResult:
    """构造 ChatResult fixture"""
    return ChatResult(
        content=content,
        model=model,
        finish_reason=finish_reason,
        usage=TokenUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
        ),
    )


def make_embed_result(
    *,
    embedding: list[float] | None = None,
    model: str = "text-embedding-3-small",
    prompt_tokens: int = 8,
) -> EmbeddingResult:
    """构造 EmbeddingResult fixture"""
    if embedding is None:
        embedding = [0.1, 0.2, 0.3, 0.4]
    return EmbeddingResult(
        embedding=embedding,
        model=model,
        usage=TokenUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=0,
            total_tokens=prompt_tokens,
        ),
    )


@pytest.fixture
def mock_llm_client() -> MockLlmClient:
    """默认 mock LlmClient（返回成功 chat 结果）"""
    return MockLlmClient(chat_result=make_chat_result())


@pytest.fixture
async def async_client() -> AsyncIterator[AsyncClient]:
    """httpx AsyncClient with ASGITransport

    通过 ASGITransport 直接调用 FastAPI app，无需真实端口。
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def reset_prompt_manager_singleton():
    """重置 PromptManager 全局单例（避免测试间状态泄漏）"""
    from src.prompts import manager as manager_module
    saved = manager_module._default_manager
    manager_module._default_manager = None
    yield
    manager_module._default_manager = saved
