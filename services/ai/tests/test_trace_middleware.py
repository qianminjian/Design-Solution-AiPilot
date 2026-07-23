"""TraceId 中间件测试

覆盖：
- 透传：客户端发送 x-trace-id，响应头应原样回传
- 生成：客户端未发送，服务端应生成 UUID 并回传
- contextvar：中间件内 trace_id 可被 get_trace_id 读取
"""

import re

import pytest

from src.middleware.trace import TRACE_ID_HEADER, get_trace_id, trace_id_var


@pytest.mark.asyncio
async def test_trace_id_passthrough(async_client):
    """客户端发送的 x-trace-id 应原样回传"""
    response = await async_client.get(
        "/health/live",
        headers={TRACE_ID_HEADER: "client-trace-id-abc"},
    )
    assert response.status_code == 200
    assert response.headers[TRACE_ID_HEADER] == "client-trace-id-abc"


@pytest.mark.asyncio
async def test_trace_id_generated_when_missing(async_client):
    """客户端未发送 x-trace-id 时，服务端应生成 UUID 并回传"""
    response = await async_client.get("/health/live")
    assert response.status_code == 200
    trace_id = response.headers[TRACE_ID_HEADER]
    # UUIDv4 格式
    assert re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", trace_id)


@pytest.mark.asyncio
async def test_trace_id_different_per_request(async_client):
    """不同请求应生成不同的 trace_id"""
    resp1 = await async_client.get("/health/live")
    resp2 = await async_client.get("/health/live")
    assert resp1.headers[TRACE_ID_HEADER] != resp2.headers[TRACE_ID_HEADER]


@pytest.mark.asyncio
async def test_trace_id_contextvar_reset_after_request(async_client):
    """请求结束后 contextvar 应被清理，避免跨请求泄漏"""
    await async_client.get(
        "/health/live",
        headers={TRACE_ID_HEADER: "trace-to-clear"},
    )
    # 请求结束后 contextvar 应为空（reset 到之前的 default）
    assert get_trace_id() == ""


@pytest.mark.asyncio
async def test_trace_id_accessible_via_get_trace_id():
    """get_trace_id 应能在 contextvar 设置时读取"""
    token = trace_id_var.set("manual-trace-id")
    try:
        assert get_trace_id() == "manual-trace-id"
    finally:
        trace_id_var.reset(token)
    assert get_trace_id() == ""


@pytest.mark.asyncio
async def test_trace_id_header_name_is_x_trace_id():
    """header 名应为 x-trace-id（与 Java/BFF 对齐）"""
    assert TRACE_ID_HEADER == "x-trace-id"
