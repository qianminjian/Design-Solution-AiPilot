"""AI 服务入口 — Python 3.12 + FastAPI

按 D24 AI 能力目录设计，提供统一 Capability API：
- 文本生成、视觉识别、向量检索、规则检查
- 通过 LLM 网关的 Provider Adapter 路由到具体模型供应商

traceId 贯穿：从 x-trace-id 头提取/生成，写入 contextvar，日志自动注入。
"""

import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.capabilities.router import router as capabilities_router
from src.config import settings
from src.database import check_db_connection
from src.llm.factory import create_llm_client
from src.logging_config import setup_logging
from src.middleware.trace import TraceIdMiddleware
from src.prompts.router import router as prompts_router
from src.rag.router import router as rag_router
from src.solutions.router import router as solutions_router

# 启动时初始化结构化日志（observability.md §1）
setup_logging()
logger = logging.getLogger(__name__)

# LLM 网关连通性探测超时（任务要求 3s，不影响 ready 判定）
LLM_PROBE_TIMEOUT = 3.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理 - 启动/关闭事件"""
    app.state.startup_time = datetime.now(timezone.utc)
    # 初始化 LlmClient 单例（capabilities router 通过 app.state 获取）
    app.state.llm_client = create_llm_client()
    logger.info("[AI] service starting", extra={"version": settings.app_version})
    yield
    # 关闭时释放 LlmClient 连接池
    client = getattr(app.state, "llm_client", None)
    if client is not None:
        await client.close()
    logger.info("[AI] service stopped")


app = FastAPI(
    title="AI Service",
    description="施工图全流程 AI 平台 — AI 能力服务",
    version=settings.app_version,
    lifespan=lifespan,
)

# 中间件注册顺序：后注册的为外层
# CORS 先注册（内层），TraceId 后注册（外层），确保 traceId 贯穿所有请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TraceIdMiddleware)

# 业务路由
app.include_router(capabilities_router)
app.include_router(prompts_router)
app.include_router(rag_router)
app.include_router(solutions_router)


@app.get("/health")
async def health():
    """健康检查 - 包含数据库连接状态"""
    db_connected = await check_db_connection()
    return {
        "status": "ok",
        "service": "ai-service",
        "version": settings.app_version,
        "environment": settings.environment,
        "database": "connected" if db_connected else "disconnected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health/live")
async def liveness():
    """Liveness 探针"""
    return {"status": "up", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/health/ready")
async def readiness():
    """Readiness 探针 - 包含数据库连接检查 + LLM 网关连通性探测

    LLM 探测为可选项，超时/失败不影响 ready 判定，仅标注状态。
    """
    db_connected = await check_db_connection()
    llm_status = await _probe_llm_gateway()

    if db_connected:
        return {
            "status": "ready",
            "database": "connected",
            "llmGateway": llm_status,
        }
    return {
        "status": "not_ready",
        "reason": "database_unavailable",
        "database": "disconnected",
        "llmGateway": llm_status,
    }


async def _probe_llm_gateway() -> dict[str, str]:
    """探测 LLM 网关连通性

    V0 简化：仅检查 API base 可达性 + API key 是否配置。
    实际调用 /v1/models 避免产生 token 计费。

    Returns:
        包含 status 与 detail 的字典：
        - configured: API key 已配置且网关可达
        - unreachable: 网关不可达或超时
        - not_configured: API key 未配置（本地开发场景）
    """
    if not settings.llm_api_key:
        return {"status": "not_configured", "detail": "LLM_API_KEY 未配置"}

    try:
        async with httpx.AsyncClient(timeout=LLM_PROBE_TIMEOUT) as client:
            response = await client.get(
                f"{settings.llm_api_base.rstrip('/')}/models",
                headers={"Authorization": f"Bearer {settings.llm_api_key}"},
            )
        if response.status_code < 500:
            return {"status": "configured", "detail": f"HTTP {response.status_code}"}
        return {"status": "unreachable", "detail": f"HTTP {response.status_code}"}
    except httpx.TimeoutException:
        return {"status": "unreachable", "detail": "probe timeout"}
    except httpx.HTTPError as exc:
        return {"status": "unreachable", "detail": str(exc)[:100]}
    except Exception as exc:  # noqa: BLE001 - 健康探测须吞掉所有异常
        return {"status": "unreachable", "detail": str(exc)[:100]}
