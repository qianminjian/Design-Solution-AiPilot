"""TraceId 中间件

从请求头 x-trace-id 获取或生成 UUID，写入 contextvar（trace_id），
并写入 request.state.trace_id 供下游使用，回传响应头。

与 BFF (NestJS) + Core (Java) 对齐（api-conventions.md §7）：
- BFF 入口生成 traceId，下游服务从 header 提取并续接
- 所有服务在响应头回传 x-trace-id
"""

import uuid
from contextvars import ContextVar

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

# trace_id contextvar：跨 async 边界传递，日志/filter 可读取
trace_id_var: ContextVar[str] = ContextVar("trace_id", default="")

# 与 Java/BFF 对齐的 header 名
TRACE_ID_HEADER = "x-trace-id"


def get_trace_id() -> str:
    """获取当前请求的 trace_id

    供业务代码/日志 filter 使用，未在请求上下文时返回空串。
    """
    return trace_id_var.get()


def _generate_trace_id() -> str:
    """生成新的 trace_id（UUIDv4）"""
    return str(uuid.uuid4())


class TraceIdMiddleware(BaseHTTPMiddleware):
    """TraceId 中间件

    1. 从请求头 x-trace-id 获取，缺失则生成 UUID
    2. 写入 contextvar 与 request.state，供下游使用
    3. 回传响应头 x-trace-id
    """

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        trace_id = request.headers.get(TRACE_ID_HEADER) or _generate_trace_id()

        # 写入 contextvar（日志 filter 可读取）
        token = trace_id_var.set(trace_id)
        # 写入 request.state（业务代码可读取，与 api-conventions.md 对齐）
        request.state.trace_id = trace_id

        try:
            response = await call_next(request)
        finally:
            # 请求结束清理 contextvar，避免跨请求泄漏
            trace_id_var.reset(token)

        response.headers[TRACE_ID_HEADER] = trace_id
        return response
