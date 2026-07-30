"""Capability API 路由

3 个能力端点：
- POST /api/v1/capabilities/text-generation
- POST /api/v1/capabilities/vision
- POST /api/v1/capabilities/embeddings
"""

import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.capabilities.schemas import (
    EmbeddingRequest,
    EmbeddingResponse,
    TextGenerationRequest,
    TextGenerationResponse,
    VisionRequest,
    VisionResponse,
)
from src.capabilities.service import CapabilityService
from src.llm.client import LlmAuthError, LlmClient, LlmError, LlmTimeoutError
from src.llm.factory import create_llm_client
from src.rag.embedding import EmbeddingService

router = APIRouter(prefix="/api/v1", tags=["capabilities"])


def get_llm_client(request: Request) -> LlmClient:
    """依赖注入：获取 LlmClient 实例

    优先从 app.state 获取（lifespan 中初始化的缓存实例），
    缺失时通过 factory 创建并缓存。
    """
    client = getattr(request.app.state, "llm_client", None)
    if client is None:
        client = create_llm_client()
        request.app.state.llm_client = client
    return client


def get_embedding_service(request: Request) -> EmbeddingService:
    """依赖注入：获取 EmbeddingService 实例"""
    embedding = getattr(request.app.state, "embedding_service", None)
    if embedding is None:
        # 优先从配置的绝对路径加载（容器内预下载模型），避免运行时联网
        from src.config import settings
        embedding = EmbeddingService(
            model_name=settings.embedding_model,
            model_path=settings.embedding_model_path,
        )
        request.app.state.embedding_service = embedding
    return embedding


def get_capability_service(
    llm_client: Annotated[LlmClient, Depends(get_llm_client)],
    embedding_service: Annotated[EmbeddingService, Depends(get_embedding_service)],
) -> CapabilityService:
    """依赖注入：获取 CapabilityService"""
    return CapabilityService(llm_client, embedding_service)


def _map_llm_error(exc: LlmError) -> HTTPException:
    """将 LLM 异常映射为 HTTP 响应"""
    if isinstance(exc, LlmTimeoutError):
        return HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"LLM 调用超时: {exc}",
        )
    if isinstance(exc, LlmAuthError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="LLM 鉴权失败，请检查 API Key 配置",
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"LLM 调用失败: {exc}",
    )


@router.post("/capabilities/text-generation", response_model=TextGenerationResponse)
async def text_generation(
    request: TextGenerationRequest,
    service: Annotated[CapabilityService, Depends(get_capability_service)],
) -> TextGenerationResponse:
    """文本生成能力端点"""
    start = time.monotonic()
    try:
        response = await service.text_generation(request)
    except LlmError as exc:
        raise _map_llm_error(exc) from exc
    response.latency_ms = int((time.monotonic() - start) * 1000)
    return response


@router.post("/capabilities/vision", response_model=VisionResponse)
async def vision(
    request: VisionRequest,
    service: Annotated[CapabilityService, Depends(get_capability_service)],
) -> VisionResponse:
    """视觉理解能力端点

    V0 复用 chat 接口，待 vision 模型部署后切换。
    """
    start = time.monotonic()
    try:
        response = await service.vision(request)
    except LlmError as exc:
        raise _map_llm_error(exc) from exc
    response.latency_ms = int((time.monotonic() - start) * 1000)
    return response


@router.post("/capabilities/embeddings", response_model=EmbeddingResponse)
async def embeddings(
    request: EmbeddingRequest,
    service: Annotated[CapabilityService, Depends(get_capability_service)],
) -> EmbeddingResponse:
    """文本向量化能力端点

    V0 阶段：LLM 调用失败时返回 stub 向量，待 embedding 模型配置后移除降级。
    """
    start = time.monotonic()
    response = await service.embeddings(request)
    response.latency_ms = int((time.monotonic() - start) * 1000)
    return response
