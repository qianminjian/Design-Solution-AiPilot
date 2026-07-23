"""Capability 业务逻辑

调用 LlmClient 实现 3 个能力端点的业务逻辑。
所有 AI 输出标记为 is_ai_assisted=true，按风险等级进入人工复核（security.md §12）。
"""

import logging

from src.capabilities.schemas import (
    EmbeddingRequest,
    EmbeddingResponse,
    TextGenerationRequest,
    TextGenerationResponse,
    TokenUsageSchema,
    VisionRequest,
    VisionResponse,
)
from src.llm.client import ChatMessage, LlmClient, LlmError

logger = logging.getLogger(__name__)

# V0 默认所有 AI 输出进入人工复核（security.md §12 红线）
# 后续按 CapabilityRiskProfile 细化分级
DEFAULT_REQUIRES_HUMAN_REVIEW = True

# Embedding V0 stub 维度（待 embedding 模型配置后切换真实调用）
EMBEDDING_STUB_DIMENSIONS = 8


class CapabilityService:
    """AI 能力服务

    封装 LLM 调用与响应组装，所有 AI 输出强制标记 is_ai_assisted。
    """

    def __init__(self, llm_client: LlmClient):
        self._llm = llm_client

    async def text_generation(self, request: TextGenerationRequest) -> TextGenerationResponse:
        """文本生成能力

        Args:
            request: 文本生成请求

        Returns:
            TextGenerationResponse，标记 is_ai_assisted=true

        Raises:
            LlmError: LLM 调用失败（含超时/鉴权/服务端错误）
        """
        messages: list[ChatMessage] = []
        if request.system:
            messages.append(ChatMessage(role="system", content=request.system))
        messages.append(ChatMessage(role="user", content=request.prompt))

        result = await self._llm.chat(
            messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

        return TextGenerationResponse(
            content=result.content,
            model=result.model,
            finish_reason=result.finish_reason,
            usage=TokenUsageSchema(
                prompt_tokens=result.usage.prompt_tokens,
                completion_tokens=result.usage.completion_tokens,
                total_tokens=result.usage.total_tokens,
            ),
            is_ai_assisted=True,
            requires_human_review=DEFAULT_REQUIRES_HUMAN_REVIEW,
            latency_ms=0,  # 由 router 注入实际耗时
        )

    async def vision(self, request: VisionRequest) -> VisionResponse:
        """视觉理解能力

        V0 复用 chat 接口，将 image_url 拼入 prompt。
        TODO: 待独立 vision 模型部署后切换为多模态消息格式。

        Args:
            request: 视觉理解请求

        Returns:
            VisionResponse，标记 is_ai_assisted=true
        """
        # V0 简化：将 image_url 拼入 prompt，调用 chat 接口
        # TODO: 切换为 OpenAI vision 多模态消息格式（content 含 image_url 类型）
        combined_prompt = f"[图片 URL: {request.image_url}]\n\n问题: {request.prompt}"
        messages: list[ChatMessage] = []
        if request.system:
            messages.append(ChatMessage(role="system", content=request.system))
        messages.append(ChatMessage(role="user", content=combined_prompt))

        result = await self._llm.chat(
            messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

        return VisionResponse(
            content=result.content,
            model=result.model,
            finish_reason=result.finish_reason,
            usage=TokenUsageSchema(
                prompt_tokens=result.usage.prompt_tokens,
                completion_tokens=result.usage.completion_tokens,
                total_tokens=result.usage.total_tokens,
            ),
            is_ai_assisted=True,
            requires_human_review=True,  # 视觉结果默认进入人工复核
            latency_ms=0,
        )

    async def embeddings(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """文本向量化能力

        V0 阶段：尝试调用 LLM embed；若失败（如未配置 embedding 模型）返回 stub。
        TODO: 待 embedding 模型配置后移除 stub 分支。

        Args:
            request: 向量化请求

        Returns:
            EmbeddingResponse
        """
        try:
            result = await self._llm.embed(request.input, model=request.model)
            return EmbeddingResponse(
                embedding=result.embedding,
                dimensions=len(result.embedding),
                model=result.model,
                usage=TokenUsageSchema(
                    prompt_tokens=result.usage.prompt_tokens,
                    completion_tokens=0,
                    total_tokens=result.usage.total_tokens,
                ),
                latency_ms=0,
            )
        except LlmError as exc:
            # V0 降级：返回 stub 向量，标注 TODO
            logger.warning(
                "[Capability] embedding 降级为 stub",
                extra={
                    "error": str(exc),
                    "provider": exc.provider,
                    "status_code": exc.status_code,
                },
            )
            stub_embedding = [0.0] * EMBEDDING_STUB_DIMENSIONS
            return EmbeddingResponse(
                embedding=stub_embedding,
                dimensions=EMBEDDING_STUB_DIMENSIONS,
                model=request.model or "stub",
                usage=TokenUsageSchema(
                    prompt_tokens=0,
                    completion_tokens=0,
                    total_tokens=0,
                ),
                latency_ms=0,
            )
