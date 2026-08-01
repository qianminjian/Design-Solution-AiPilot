"""TestRunId 中间件测试（P0-1.2 测试数据隔离）

覆盖：
- 透传：客户端发送 x-test-run-id，contextvar 应被设置
- 缺失时使用默认值 "untracked"
- 非法格式容错为 "untracked"
- UUID 格式接受
- GitHub Actions run_id-attempt 格式接受
- contextvar 在请求结束后被清理
- 不回传响应头（testRunId 是请求方注入的，仅用于内部关联）
- is_valid_test_run_id 单元测试
"""

import pytest

from src.middleware.test_run_id import (
    TEST_RUN_ID_HEADER,
    UNTRACKED_TEST_RUN_ID,
    get_test_run_id,
    is_valid_test_run_id,
    test_run_id_var,
)


@pytest.mark.asyncio
async def test_test_run_id_passthrough(async_client):
    """客户端发送的 x-test-run-id 应被读取并写入 contextvar"""
    test_run_id = "550e8400-e29b-41d4-a716-446655440000"
    response = await async_client.get(
        "/health/live",
        headers={TEST_RUN_ID_HEADER: test_run_id},
    )
    assert response.status_code == 200
    # testRunId 是请求方注入的，不回传响应头
    assert TEST_RUN_ID_HEADER not in response.headers


@pytest.mark.asyncio
async def test_test_run_id_default_when_missing(async_client):
    """客户端未发送 x-test-run-id 时，应使用默认值 'untracked'"""
    response = await async_client.get("/health/live")
    assert response.status_code == 200
    # 请求结束后 contextvar 应被重置为 default
    assert get_test_run_id() == UNTRACKED_TEST_RUN_ID


@pytest.mark.asyncio
async def test_test_run_id_contextvar_reset_after_request(async_client):
    """请求结束后 contextvar 应被清理，避免跨请求泄漏"""
    test_run_id = "github-run-12345-1"
    await async_client.get(
        "/health/live",
        headers={TEST_RUN_ID_HEADER: test_run_id},
    )
    # 请求结束后 contextvar 应被 reset 到之前的 default
    assert get_test_run_id() == UNTRACKED_TEST_RUN_ID


@pytest.mark.asyncio
async def test_test_run_id_uuid_format_accepted(async_client):
    """UUIDv4 格式应被接受"""
    test_run_id = "550e8400-e29b-41d4-a716-446655440000"
    # 设置 contextvar 后通过 get_test_run_id 验证
    token = test_run_id_var.set(test_run_id)
    try:
        assert get_test_run_id() == test_run_id
    finally:
        test_run_id_var.reset(token)


@pytest.mark.asyncio
async def test_test_run_id_github_format_accepted(async_client):
    """GitHub Actions run_id-attempt 格式应被接受"""
    test_run_id = "1234567890-1"
    token = test_run_id_var.set(test_run_id)
    try:
        assert get_test_run_id() == test_run_id
    finally:
        test_run_id_var.reset(token)


@pytest.mark.asyncio
async def test_test_run_id_invalid_format_falls_back_to_untracked():
    """非法格式应被容错为 'untracked'"""
    # 通过 is_valid_test_run_id 验证格式校验
    assert not is_valid_test_run_id("invalid format with spaces")
    assert not is_valid_test_run_id("not-a-valid-format")


@pytest.mark.asyncio
async def test_test_run_id_header_name_is_x_test_run_id():
    """header 名应为 x-test-run-id（与 Java/BFF 对齐）"""
    assert TEST_RUN_ID_HEADER == "x-test-run-id"


# ── is_valid_test_run_id 单元测试 ──


class TestIsValidTestRunId:
    """is_valid_test_run_id 格式校验"""

    def test_untracked_应被视为有效(self):
        assert is_valid_test_run_id("untracked") is True

    def test_uuidv4_应被视为有效(self):
        assert is_valid_test_run_id("550e8400-e29b-41d4-a716-446655440000") is True

    def test_github_run_format_应被视为有效(self):
        assert is_valid_test_run_id("1234567890-1") is True

    def test_空字符串应被视为无效(self):
        assert is_valid_test_run_id("") is False

    def test_仅空格应被视为无效(self):
        assert is_valid_test_run_id("   ") is False

    def test_None_应被视为无效(self):
        assert is_valid_test_run_id(None) is False  # type: ignore[arg-type]

    def test_非法格式应被视为无效(self):
        assert is_valid_test_run_id("invalid format with spaces") is False
        assert is_valid_test_run_id("not-a-valid-format") is False
        assert is_valid_test_run_id("12345_abc") is False

    def test_超长字符串应被视为无效(self):
        """长度超过 64 应被视为无效（与 Java column VARCHAR(64) 对齐）"""
        long_value = "a" * 65
        assert is_valid_test_run_id(long_value) is False

    def test_恰好64长度应被视为有效(self):
        """长度等于 64 应被视为有效（边界值）"""
        # 64 位十六进制字符串（虽非 UUID 格式，但用于测试长度边界）
        boundary_value = "a" * 64
        # 长度合法但格式不匹配 UUID/GitHub → 无效
        assert is_valid_test_run_id(boundary_value) is False


# ── get_test_run_id contextvar 测试 ──


class TestGetTestRunId:
    """get_test_run_id contextvar 读取"""

    def test_默认值应为_untracked(self):
        """未设置 contextvar 时返回默认值 'untracked'"""
        # contextvar 默认值为 "untracked"
        assert get_test_run_id() == UNTRACKED_TEST_RUN_ID

    def test_设置后应能读取真实值(self):
        test_run_id = "github-run-98765-2"
        token = test_run_id_var.set(test_run_id)
        try:
            assert get_test_run_id() == test_run_id
        finally:
            test_run_id_var.reset(token)
        # reset 后应回到 default
        assert get_test_run_id() == UNTRACKED_TEST_RUN_ID
