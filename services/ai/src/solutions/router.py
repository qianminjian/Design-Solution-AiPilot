"""方案生成 API 路由

POST /api/v1/solutions/generate
面向业务的方案生成端点，集成 prompt 模板 + LLM + Guardrails。
"""

import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.llm.client import LlmAuthError, LlmClient, LlmError, LlmTimeoutError
from src.llm.factory import create_llm_client
from src.solutions.schemas import GenerateSolutionRequest, GenerateSolutionResponse
from src.solutions.service import SolutionGenerationError, SolutionService

router = APIRouter(prefix="/api/v1", tags=["solutions"])


def get_llm_client(request: Request) -> LlmClient:
    """依赖注入：获取 LlmClient 实例（复用 app.state 缓存）"""
    client = getattr(request.app.state, "llm_client", None)
    if client is None:
        client = create_llm_client()
        request.app.state.llm_client = client
    return client


def get_solution_service(
    llm_client: Annotated[LlmClient, Depends(get_llm_client)],
) -> SolutionService:
    """依赖注入：获取 SolutionService"""
    return SolutionService(llm_client)


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


@router.post("/solutions/generate", response_model=GenerateSolutionResponse)
async def generate_solution(
    request: GenerateSolutionRequest,
    service: Annotated[SolutionService, Depends(get_solution_service)],
) -> GenerateSolutionResponse:
    """生成方案候选

    V0 阶段非流式：返回完整响应。
    所有响应强制标记 isAiAssisted=true，按风险等级进入人工复核。
    """
    start = time.monotonic()
    try:
        response = await service.generate(request)
    except SolutionGenerationError as exc:
        if exc.code == "TEMPLATE_NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        if exc.code == "MISSING_TEMPLATE_VARIABLE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
        if exc.code == "LLM_CALL_FAILED":
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except LlmError as exc:
        raise _map_llm_error(exc) from exc

    response.latency_ms = int((time.monotonic() - start) * 1000)
    return response
