"""健康检查端点测试

覆盖：
- GET /health：基础健康检查（status=ok + timestamp）
- GET /health/live：liveness 探针
- GET /health/ready：readiness 探针（含数据库连接 + LLM 网关探测）
- _probe_llm_gateway：configured / unreachable / not_configured / timeout 等分支
"""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
def transport():
    return ASGITransport(app=app)


@pytest.mark.asyncio
async def test_health_returns_ok(transport):
    """GET /health 应返回 200 与 status=ok"""
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "ai-service"
    assert "timestamp" in data
    # database 字段应为 connected 或 disconnected（取决于测试环境）
    assert data["database"] in {"connected", "disconnected"}


@pytest.mark.asyncio
async def test_health_live_returns_up(transport):
    """GET /health/live 应返回 status=up"""
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health/live")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "up"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_health_ready_returns_ready_when_db_connected(transport):
    """数据库连接成功时 GET /health/ready 应返回 status=ready"""
    with patch("src.main.check_db_connection", new=AsyncMock(return_value=True)):
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
        ) as client:
            response = await client.get("/health/ready")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"
    # llmGateway 字段必返回（status + detail）
    assert "llmGateway" in data
    assert "status" in data["llmGateway"]
    assert "detail" in data["llmGateway"]


@pytest.mark.asyncio
async def test_health_ready_returns_not_ready_when_db_disconnected(transport):
    """数据库连接失败时 GET /health/ready 应返回 status=not_ready"""
    with patch("src.main.check_db_connection", new=AsyncMock(return_value=False)):
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
        ) as client:
            response = await client.get("/health/ready")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "not_ready"
    assert data["reason"] == "database_unavailable"
    assert data["database"] == "disconnected"
    # 即使数据库不可用，仍应返回 llmGateway 探测结果
    assert "llmGateway" in data


@pytest.mark.asyncio
async def test_probe_llm_gateway_returns_not_configured_when_api_key_empty():
    """LLM_API_KEY 未配置时 _probe_llm_gateway 应返回 not_configured"""
    from src.main import _probe_llm_gateway

    with patch("src.main.settings") as mock_settings:
        mock_settings.llm_api_key = ""
        mock_settings.llm_api_base = "https://api.openai.com/v1"

        result = await _probe_llm_gateway()

    assert result["status"] == "not_configured"
    assert "LLM_API_KEY" in result["detail"]


@pytest.mark.asyncio
async def test_probe_llm_gateway_returns_configured_when_gateway_reachable():
    """LLM 网关可达（HTTP < 500）时 _probe_llm_gateway 应返回 configured"""
    from src.main import _probe_llm_gateway

    class MockResponse:
        def __init__(self, status_code: int):
            self.status_code = status_code

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, headers=None):
            return MockResponse(status_code=200)

    with patch("src.main.settings") as mock_settings, patch(
        "src.main.httpx.AsyncClient",
        new=MockAsyncClient,
    ):
        mock_settings.llm_api_key = "sk-test-key"
        mock_settings.llm_api_base = "https://api.openai.com/v1"

        result = await _probe_llm_gateway()

    assert result["status"] == "configured"
    assert "HTTP 200" in result["detail"]


@pytest.mark.asyncio
async def test_probe_llm_gateway_returns_unreachable_when_5xx():
    """LLM 网关返回 5xx 时 _probe_llm_gateway 应返回 unreachable"""
    from src.main import _probe_llm_gateway

    class MockResponse:
        def __init__(self, status_code: int):
            self.status_code = status_code

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, headers=None):
            return MockResponse(status_code=503)

    with patch("src.main.settings") as mock_settings, patch(
        "src.main.httpx.AsyncClient",
        new=MockAsyncClient,
    ):
        mock_settings.llm_api_key = "sk-test-key"
        mock_settings.llm_api_base = "https://api.openai.com/v1"

        result = await _probe_llm_gateway()

    assert result["status"] == "unreachable"
    assert "HTTP 503" in result["detail"]


@pytest.mark.asyncio
async def test_probe_llm_gateway_returns_unreachable_on_timeout():
    """LLM 网关探测超时时应返回 unreachable"""
    import httpx as httpx_mod

    from src.main import _probe_llm_gateway

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, headers=None):
            raise httpx_mod.TimeoutException("simulated timeout")

    with patch("src.main.settings") as mock_settings, patch(
        "src.main.httpx.AsyncClient",
        new=MockAsyncClient,
    ):
        mock_settings.llm_api_key = "sk-test-key"
        mock_settings.llm_api_base = "https://api.openai.com/v1"

        result = await _probe_llm_gateway()

    assert result["status"] == "unreachable"
    assert "timeout" in result["detail"].lower()


@pytest.mark.asyncio
async def test_probe_llm_gateway_returns_unreachable_on_http_error():
    """LLM 网关抛出 httpx.HTTPError 时应返回 unreachable"""
    import httpx as httpx_mod

    from src.main import _probe_llm_gateway

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, headers=None):
            raise httpx_mod.HTTPError("connection refused")

    with patch("src.main.settings") as mock_settings, patch(
        "src.main.httpx.AsyncClient",
        new=MockAsyncClient,
    ):
        mock_settings.llm_api_key = "sk-test-key"
        mock_settings.llm_api_base = "https://api.openai.com/v1"

        result = await _probe_llm_gateway()

    assert result["status"] == "unreachable"
    assert "connection refused" in result["detail"]


@pytest.mark.asyncio
async def test_probe_llm_gateway_returns_unreachable_on_unexpected_exception():
    """LLM 网关抛出未预期异常时应返回 unreachable（不向上传播）"""
    from src.main import _probe_llm_gateway

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, headers=None):
            raise RuntimeError("unexpected internal error")

    with patch("src.main.settings") as mock_settings, patch(
        "src.main.httpx.AsyncClient",
        new=MockAsyncClient,
    ):
        mock_settings.llm_api_key = "sk-test-key"
        mock_settings.llm_api_base = "https://api.openai.com/v1"

        result = await _probe_llm_gateway()

    assert result["status"] == "unreachable"
    assert "unexpected internal error" in result["detail"]
