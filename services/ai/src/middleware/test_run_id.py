"""TestRunId 中间件（P0-1.2 测试数据隔离）

从请求头 x-test-run-id 提取测试运行 ID，写入 contextvar 与 request.state，
供下游业务代码与日志 filter 读取。

与 BFF (NestJS) + Core (Java) 对齐：
- BFF 透传 x-test-run-id 头到下游
- AI 服务在本中间件提取并写入 contextvar
- 日志 filter 注入 test_run_id 字段，便于关联分析

格式校验（与 packages/shared/src/testing/test-run-id.ts 对齐）：
- "untracked"：默认值，未标记
- UUIDv4 格式：单次本地测试
- GitHub Actions run_id-attempt 格式：CI 流水线
- 非法格式容错为 "untracked"
"""

import os
import re
from contextvars import ContextVar

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

# test_run_id contextvar：跨 async 边界传递，日志/业务可读取
test_run_id_var: ContextVar[str] = ContextVar("test_run_id", default="untracked")

# 与 Java/BFF 对齐的 header 名
TEST_RUN_ID_HEADER = "x-test-run-id"

# 环境变量名（与 Java TestRunIdFilter 一致）
ENV_TEST_RUN_ID = "TEST_RUN_ID"

# 默认值：未标记
UNTRACKED_TEST_RUN_ID = "untracked"

# 格式正则
_UUID_REGEX = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
_GITHUB_RUN_FORMAT_REGEX = re.compile(r"^\d+-\d+$")

# 长度上限（与 Java column VARCHAR(64) 对齐）
TEST_RUN_ID_MAX_LENGTH = 64


def get_test_run_id() -> str:
    """获取当前请求的 test_run_id

    供业务代码/日志 filter 使用：
    - "untracked"：未标记（生产或本地开发，SLO 报表包含）
    - UUID 或 github-run_id-attempt 格式：真实测试运行（SLO 报表排除）
    """
    return test_run_id_var.get()


def is_valid_test_run_id(value: str) -> bool:
    """校验 test_run_id 格式

    接受的格式：
    - "untracked"（默认值）
    - UUIDv4（推荐用于单次本地测试）
    - GitHub Actions run_id-run_attempt 格式（CI 流水线）
    """
    if not value or len(value) > TEST_RUN_ID_MAX_LENGTH:
        return False
    if value == UNTRACKED_TEST_RUN_ID:
        return True
    if _UUID_REGEX.match(value):
        return True
    return bool(_GITHUB_RUN_FORMAT_REGEX.match(value))


def _resolve_test_run_id(header_value: str | None) -> str:
    """解析 test_run_id：请求头 > 环境变量 > 默认值 'untracked'

    非法格式容错为 'untracked'，避免错误标记污染数据。
    """
    # 1. 优先从请求头读取
    value = (header_value or "").strip()
    if not value:
        # 2. 请求头缺失时，从环境变量兜底
        value = (os.getenv(ENV_TEST_RUN_ID) or "").strip()
    if not value:
        # 3. 都缺失时使用默认值
        return UNTRACKED_TEST_RUN_ID
    # 4. 格式校验：非法格式容错为 untracked
    if not is_valid_test_run_id(value):
        return UNTRACKED_TEST_RUN_ID
    return value


class TestRunIdMiddleware(BaseHTTPMiddleware):
    """TestRunId 中间件

    1. 从请求头 x-test-run-id 提取，缺失则从环境变量 TEST_RUN_ID 兜底
    2. 都缺失时使用默认值 "untracked"
    3. 写入 contextvar 与 request.state，供下游业务/日志使用
    4. 不回传响应头（testRunId 是请求方注入的，仅用于内部关联）
    """

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        test_run_id = _resolve_test_run_id(request.headers.get(TEST_RUN_ID_HEADER))

        # 写入 contextvar（日志 filter 可读取）
        token = test_run_id_var.set(test_run_id)
        # 写入 request.state（业务代码可读取）
        request.state.test_run_id = test_run_id

        try:
            response = await call_next(request)
        finally:
            # 请求结束清理 contextvar，避免跨请求泄漏
            test_run_id_var.reset(token)

        return response
