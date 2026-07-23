"""Capability 业务逻辑

调用 LlmClient 和 EmbeddingService 实现 3 个能力端点的业务逻辑。
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
from src.rag.embedding import EmbeddingService

logger = logging.getLogger(__name__)

DEFAULT_REQUIRES_HUMAN_REVIEW = True


class CapabilityService:
    """AI 能力服务

    封装 LLM 调用与响应组装，所有 AI 输出强制标记 is_ai_assisted。
    """

    def __init__(self, llm_client: LlmClient, embedding_service: EmbeddingService):
        self._llm = llm_client
        self._embedding = embedding_service

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

        使用本地 EmbeddingService 生成向量，与 LLM Client 解耦。
        当 EmbeddingService 不可用时降级返回 stub 向量，避免阻塞下游。

        Args:
            request: 向量化请求

        Returns:
            EmbeddingResponse
        """
        try:
            embedding = self._embedding.embed_single(request.input)
            model_name = self._embedding.model_name

            logger.info("[Capability] embedding 生成成功", {"model": model_name})

            return EmbeddingResponse(
                embedding=embedding,
                dimensions=len(embedding),
                model=model_name,
                usage=TokenUsageSchema(
                    prompt_tokens=0,
                    completion_tokens=0,
                    total_tokens=0,
                ),
                latency_ms=0,
            )
        except Exception as exc:
            logger.error(
                "[Capability] embedding 生成失败，降级返回 stub",
                extra={"error": str(exc)},
            )
            stub_dimensions = 384
            stub_embedding = [0.0] * stub_dimensions
            return EmbeddingResponse(
                embedding=stub_embedding,
                dimensions=stub_dimensions,
                model="stub",
                usage=TokenUsageSchema(
                    prompt_tokens=0,
                    completion_tokens=0,
                    total_tokens=0,
                ),
                latency_ms=0,
            )
