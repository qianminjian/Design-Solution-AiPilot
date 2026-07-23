"""OpenAI 兼容 LLM Client 测试

使用 httpx.MockTransport mock HTTP 调用，覆盖：
- 成功 chat 调用
- 成功 embedding 调用
- 超时 -> LlmTimeoutError
- 鉴权失败 -> LlmAuthError
- 5xx 服务端错误 -> LlmError
"""

import json
from typing import Any

import httpx
import pytest

from src.llm.client import (
    ChatMessage,
    LlmAuthError,
    LlmError,
    LlmTimeoutError,
)
from src.llm.openai_client import OpenAICompatibleClient


def _make_chat_response(
    *,
    content: str = "hello",
    model: str = "gpt-4o",
    finish_reason: str = "stop",
    prompt_tokens: int = 5,
    completion_tokens: int = 3,
) -> dict[str, Any]:
    """构造 OpenAI chat/completions 响应体"""
    return {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": finish_reason,
            }
        ],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        },
    }


def _make_embedding_response(
    *,
    embedding: list[float] | None = None,
    model: str = "text-embedding-3-small",
    prompt_tokens: int = 4,
) -> dict[str, Any]:
    """构造 OpenAI embeddings 响应体"""
    if embedding is None:
        embedding = [0.1, 0.2, 0.3]
    return {
        "object": "list",
        "model": model,
        "data": [{"index": 0, "embedding": embedding}],
        "usage": {"prompt_tokens": prompt_tokens, "total_tokens": prompt_tokens},
    }


def _create_client_with_transport(transport: httpx.MockTransport) -> OpenAICompatibleClient:
    """创建使用指定 transport 的 OpenAICompatibleClient（绕过真实 httpx.AsyncClient）"""
    client = OpenAICompatibleClient(
        api_base="https://api.openai.com/v1",
        api_key="test-key",
        model="gpt-4o",
        timeout=5.0,
    )
    # 替换底层 httpx client 为带 mock transport 的实例
    client._client = httpx.AsyncClient(
        base_url="https://api.openai.com/v1",
        timeout=5.0,
        headers=client._build_headers(),
        transport=transport,
    )
    return client


@pytest.mark.asyncio
async def test_chat_success():
    """应该成功调用 chat 并解析响应"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_make_chat_response(content="你好"))

    transport = httpx.MockTransport(handler)
    client = _create_client_with_transport(transport)

    try:
        result = await client.chat(
            [ChatMessage(role="user", content="hello")],
            temperature=0.5,
            max_tokens=100,
        )
    finally:
        await client.close()

    assert result.content == "你好"
    assert result.model == "gpt-4o"
    assert result.finish_reason == "stop"
    assert result.usage.prompt_tokens == 5
    assert result.usage.completion_tokens == 3
    assert result.usage.total_tokens == 8


@pytest.mark.asyncio
async def test_complete_with_system_prompt():
    """complete 应该正确注入 system 消息"""
    captured: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        captured.append(body)
        return httpx.Response(200, json=_make_chat_response())

    transport = httpx.MockTransport(handler)
    client = _create_client_with_transport(transport)

    try:
        await client.complete("hello", system="你是助手", temperature=0.3)
    finally:
        await client.close()

    assert len(captured) == 1
    messages = captured[0]["messages"]
    assert messages[0] == {"role": "system", "content": "你是助手"}
    assert messages[1] == {"role": "user", "content": "hello"}
    assert captured[0]["temperature"] == 0.3


@pytest.mark.asyncio
async def test_chat_timeout_raises_llm_timeout_error():
    """超时应抛 LlmTimeoutError"""
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("simulated timeout")

    transport = httpx.MockTransport(handler)
    client = _create_client_with_transport(transport)

    try:
        with pytest.raises(LlmTimeoutError):
            await client.chat([ChatMessage(role="user", content="hi")])
    finally:
        await client.close()


@pytest.mark.asyncio
async def test_chat_auth_failure_raises_llm_auth_error():
    """401 应抛 LlmAuthError"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "invalid api key"})

    transport = httpx.MockTransport(handler)
    client = _create_client_with_transport(transport)

    try:
        with pytest.raises(LlmAuthError) as exc_info:
            await client.chat([ChatMessage(role="user", content="hi")])
        assert exc_info.value.status_code == 401
    finally:
        await client.close()


@pytest.mark.asyncio
async def test_chat_server_error_raises_llm_error():
    """5xx 应抛 LlmError（非 auth/timeout）"""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"error": "service unavailable"})

    transport = httpx.MockTransport(handler)
    client = _create_client_with_transport(transport)

    try:
        with pytest.raises(LlmError) as exc_info:
            await client.chat([ChatMessage(role="user", content="hi")])
        # LlmAuthError / LlmTimeoutError 都是 LlmError 子类，须排除
        assert not isinstance(exc_info.value, (LlmAuthError, LlmTimeoutError))
        assert exc_info.value.status_code == 503
    finally:
        await client.close()


@pytest.mark.asyncio
async def test_chat_network_error_raises_llm_error():
    """网络错误应抛 LlmError"""
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.NetworkError("connection refused")

    transport = httpx.MockTransport(handler)
    client = _create_client_with_transport(transport)

    try:
        with pytest.raises(LlmError):
            await client.chat([ChatMessage(role="user", content="hi")])
    finally:
        await client.close()


@pytest.mark.asyncio
async def test_embed_success():
    """应该成功调用 embedding 并解析响应"""
    expected_embedding = [0.1, 0.2, 0.3, 0.4]

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_make_embedding_response(embedding=expected_embedding))

    transport = httpx.MockTransport(handler)
    client = _create_client_with_transport(transport)

    try:
        result = await client.embed("test text")
    finally:
        await client.close()

    assert result.embedding == expected_embedding
    assert result.model == "text-embedding-3-small"
    assert result.usage.prompt_tokens == 4


@pytest.mark.asyncio
async def test_chat_invalid_response_raises_llm_error():
    """响应格式异常应抛 LlmError"""
    def handler(request: httpx.Request) -> httpx.Response:
        # 缺少 choices 字段
        return httpx.Response(200, json={"unexpected": "format"})

    transport = httpx.MockTransport(handler)
    client = _create_client_with_transport(transport)

    try:
        with pytest.raises(LlmError, match="响应格式异常"):
            await client.chat([ChatMessage(role="user", content="hi")])
    finally:
        await client.close()


@pytest.mark.asyncio
async def test_provider_name_is_openai():
    """provider_name 应为 openai"""
    client = OpenAICompatibleClient(
        api_base="https://api.openai.com/v1",
        api_key="test",
        model="gpt-4o",
    )
    assert client.provider_name == "openai"
    await client.close()
