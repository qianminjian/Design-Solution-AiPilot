"""Capability API 端点测试

使用 dependency_overrides 注入 MockLlmClient，覆盖：
- text-generation 成功
- vision 成功
- embeddings 成功与降级（stub）
- LLM 超时 -> 504
- LLM 鉴权失败 -> 502
- 参数校验失败 -> 422
"""

import pytest

from src.capabilities.router import get_llm_client
from src.llm.client import LlmAuthError, LlmTimeoutError
from src.main import app
from tests.conftest import MockLlmClient, make_chat_result, make_embed_result


def _override_llm_client(mock_client: MockLlmClient) -> None:
    """覆盖 get_llm_client 依赖，注入 mock client"""
    app.dependency_overrides[get_llm_client] = lambda: mock_client


def _clear_overrides() -> None:
    """清理依赖覆盖"""
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_text_generation_success(async_client):
    """text-generation 端点应返回 AI 辅助标记的响应"""
    mock = MockLlmClient(chat_result=make_chat_result(content="生成的设计说明"))
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/capabilities/text-generation",
            json={"prompt": "生成设计说明", "temperature": 0.5},
        )
    finally:
        _clear_overrides()

    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "生成的设计说明"
    assert data["model"] == "gpt-4o"
    assert data["isAiAssisted"] is True
    assert data["requiresHumanReview"] is True
    assert data["latencyMs"] >= 0
    assert data["usage"]["promptTokens"] == 10
    assert data["usage"]["completionTokens"] == 5
    assert data["usage"]["totalTokens"] == 15


@pytest.mark.asyncio
async def test_text_generation_with_system_and_max_tokens(async_client):
    """text-generation 应正确传递 system 与 maxTokens"""
    mock = MockLlmClient(chat_result=make_chat_result())
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/capabilities/text-generation",
            json={
                "prompt": "hi",
                "system": "你是助手",
                "maxTokens": 256,
                "temperature": 0.1,
            },
        )
    finally:
        _clear_overrides()

    assert response.status_code == 200
    # 验证 mock 收到的参数
    assert len(mock.chat_calls) == 1
    call = mock.chat_calls[0]
    assert call["temperature"] == 0.1
    assert call["max_tokens"] == 256
    # 第一条消息应为 system
    assert call["messages"][0].role == "system"
    assert call["messages"][0].content == "你是助手"


@pytest.mark.asyncio
async def test_text_generation_empty_prompt_rejected(async_client):
    """空 prompt 应被参数校验拒绝（422）"""
    mock = MockLlmClient(chat_result=make_chat_result())
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/capabilities/text-generation",
            json={"prompt": ""},
        )
    finally:
        _clear_overrides()

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_text_generation_temperature_out_of_range(async_client):
    """temperature 超出 [0, 2] 应被拒绝"""
    mock = MockLlmClient(chat_result=make_chat_result())
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/capabilities/text-generation",
            json={"prompt": "hi", "temperature": 3.0},
        )
    finally:
        _clear_overrides()

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_text_generation_llm_timeout_returns_504(async_client):
    """LLM 超时应返回 504"""
    mock = MockLlmClient(chat_exception=LlmTimeoutError("timeout"))
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/capabilities/text-generation",
            json={"prompt": "hi"},
        )
    finally:
        _clear_overrides()

    assert response.status_code == 504


@pytest.mark.asyncio
async def test_text_generation_llm_auth_error_returns_502(async_client):
    """LLM 鉴权失败应返回 502"""
    mock = MockLlmClient(chat_exception=LlmAuthError("invalid key", status_code=401))
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/capabilities/text-generation",
            json={"prompt": "hi"},
        )
    finally:
        _clear_overrides()

    assert response.status_code == 502


@pytest.mark.asyncio
async def test_vision_success(async_client):
    """vision 端点应返回 AI 辅助标记的响应"""
    mock = MockLlmClient(chat_result=make_chat_result(content="图纸描述"))
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/capabilities/vision",
            json={
                "imageUrl": "https://example.com/image.png",
                "prompt": "描述这张图",
            },
        )
    finally:
        _clear_overrides()

    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "图纸描述"
    assert data["isAiAssisted"] is True
    assert data["requiresHumanReview"] is True


@pytest.mark.asyncio
async def test_vision_missing_image_url_rejected(async_client):
    """缺少 imageUrl 应被拒绝"""
    mock = MockLlmClient(chat_result=make_chat_result())
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/capabilities/vision",
            json={"prompt": "hi"},
        )
    finally:
        _clear_overrides()

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_embeddings_success(async_client):
    """embeddings 端点应返回向量（使用本地 EmbeddingService）"""
    response = await async_client.post(
        "/api/v1/capabilities/embeddings",
        json={"input": "test text"},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["embedding"]) > 0
    assert data["dimensions"] == len(data["embedding"])
    assert data["model"] == "all-MiniLM-L6-v2"


@pytest.mark.asyncio
async def test_embeddings_fallback_to_stub_on_embedding_error(async_client):
    """EmbeddingService 调用失败时应降级返回 stub 向量"""
    from src.capabilities.router import get_embedding_service

    original_get_embedding = get_embedding_service

    class FailingEmbeddingService:
        @property
        def model_name(self):
            return "stub"

        def embed_single(self, text: str) -> list[float]:
            raise RuntimeError("embedding service unavailable")

    app.dependency_overrides[get_embedding_service] = lambda: FailingEmbeddingService()

    try:
        response = await async_client.post(
            "/api/v1/capabilities/embeddings",
            json={"input": "test text"},
        )
    finally:
        app.dependency_overrides[get_embedding_service] = original_get_embedding

    assert response.status_code == 200
    data = response.json()
    assert len(data["embedding"]) > 0
    assert data["dimensions"] == len(data["embedding"])
    assert data["model"] == "stub"


@pytest.mark.asyncio
async def test_text_generation_llm_generic_error_returns_502(async_client):
    """LLM 普通异常（非 Timeout/Auth）应返回 502"""
    from src.llm.client import LlmError

    mock = MockLlmClient(chat_exception=LlmError("provider 5xx", status_code=500))
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/capabilities/text-generation",
            json={"prompt": "hi"},
        )
    finally:
        _clear_overrides()

    assert response.status_code == 502
    assert "LLM 调用失败" in response.json()["detail"]


@pytest.mark.asyncio
async def test_vision_llm_timeout_returns_504(async_client):
    """vision 端点 LLM 超时应返回 504"""
    mock = MockLlmClient(chat_exception=LlmTimeoutError("timeout"))
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/capabilities/vision",
            json={
                "imageUrl": "https://example.com/image.png",
                "prompt": "描述这张图",
            },
        )
    finally:
        _clear_overrides()

    assert response.status_code == 504


@pytest.mark.asyncio
async def test_vision_llm_auth_error_returns_502(async_client):
    """vision 端点 LLM 鉴权失败应返回 502"""
    mock = MockLlmClient(chat_exception=LlmAuthError("invalid key", status_code=401))
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/capabilities/vision",
            json={
                "imageUrl": "https://example.com/image.png",
                "prompt": "描述这张图",
            },
        )
    finally:
        _clear_overrides()

    assert response.status_code == 502


@pytest.mark.asyncio
async def test_vision_llm_generic_error_returns_502(async_client):
    """vision 端点 LLM 普通异常应返回 502"""
    from src.llm.client import LlmError

    mock = MockLlmClient(chat_exception=LlmError("server error", status_code=500))
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/capabilities/vision",
            json={
                "imageUrl": "https://example.com/image.png",
                "prompt": "描述这张图",
            },
        )
    finally:
        _clear_overrides()

    assert response.status_code == 502
    assert "LLM 调用失败" in response.json()["detail"]


@pytest.mark.asyncio
async def test_text_generation_response_has_trace_id_header(async_client):
    """响应应包含 x-trace-id 头"""
    mock = MockLlmClient(chat_result=make_chat_result())
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/capabilities/text-generation",
            json={"prompt": "hi"},
            headers={"x-trace-id": "test-trace-123"},
        )
    finally:
        _clear_overrides()

    assert response.status_code == 200
    assert response.headers["x-trace-id"] == "test-trace-123"
