"""OpenAI 兼容 LLM Client 实现

通过 httpx.AsyncClient 调用 OpenAI Chat Completions / Embeddings API。
支持任意 OpenAI 兼容端点（Azure OpenAI、LiteLLM、自部署 vLLM 等）。

设计要点：
- 超时：默认 30s，可通过 LLM_TIMEOUT 配置
- 重试：5xx/网络错误重试 1 次（tenacity），4xx 不重试（避免无效计费）
- 鉴权：401/403 抛 LlmAuthError，不重试
- 日志：记录 model/latency/usage，不记录 prompt 内容（避免泄露客户设计数据）
"""

import logging
import time
from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from src.llm.client import (
    ChatMessage,
    ChatResult,
    EmbeddingResult,
    LlmAuthError,
    LlmClient,
    LlmError,
    LlmTimeoutError,
    TokenUsage,
)

logger = logging.getLogger(__name__)

# 默认 embedding 模型（与 chat 模型分离，避免 gpt-4o 不支持 embedding）
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"


class OpenAICompatibleClient(LlmClient):
    """OpenAI 兼容 LLM Client

    通过 httpx 调用 /v1/chat/completions 和 /v1/embeddings。
    """

    def __init__(
        self,
        *,
        api_base: str,
        api_key: str,
        model: str,
        timeout: float = 30.0,
        embedding_model: str = DEFAULT_EMBEDDING_MODEL,
    ):
        """初始化 OpenAI 兼容 Client

        Args:
            api_base: API 基础地址，如 https://api.openai.com/v1
            api_key: API 密钥
            model: 默认 chat 模型名
            timeout: 请求超时秒数
            embedding_model: 默认 embedding 模型名
        """
        self._api_base = api_base.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._timeout = timeout
        self._embedding_model = embedding_model
        self._client = httpx.AsyncClient(
            base_url=self._api_base,
            timeout=timeout,
            headers=self._build_headers(),
        )

    @property
    def provider_name(self) -> str:
        return "openai"

    def _build_headers(self) -> dict[str, str]:
        """构造请求头"""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        return headers

    async def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> ChatResult:
        """单轮文本补全"""
        messages: list[ChatMessage] = []
        if system:
            messages.append(ChatMessage(role="system", content=system))
        messages.append(ChatMessage(role="user", content=prompt))
        return await self.chat(messages, temperature=temperature, max_tokens=max_tokens)

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> ChatResult:
        """多轮对话调用 /v1/chat/completions"""
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        start = time.monotonic()
        try:
            data = await self._post_with_retry("/chat/completions", payload)
        finally:
            latency_ms = int((time.monotonic() - start) * 1000)

        return self._parse_chat_response(data, latency_ms)

    async def embed(self, input_text: str, *, model: str | None = None) -> EmbeddingResult:
        """文本向量化调用 /v1/embeddings"""
        target_model = model or self._embedding_model
        payload = {"model": target_model, "input": input_text}
        start = time.monotonic()
        try:
            data = await self._post_with_retry("/embeddings", payload)
        finally:
            latency_ms = int((time.monotonic() - start) * 1000)

        return self._parse_embedding_response(data, target_model, latency_ms)

    async def close(self) -> None:
        """关闭底层 HTTP 连接池"""
        await self._client.aclose()

    # ── 内部方法 ──

    @retry(
        retry=retry_if_exception_type((httpx.NetworkError, httpx.TimeoutException)),
        stop=stop_after_attempt(2),  # 1 次重试 = 总共 2 次尝试
        wait=wait_exponential(multiplier=0.5, min=0.5, max=2),
        reraise=True,
    )
    async def _post_with_retry(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        """POST 请求 + 重试

        5xx/网络错误/超时：重试 1 次
        4xx：不重试，按状态码抛对应异常
        """
        try:
            response = await self._client.post(path, json=payload)
        except httpx.TimeoutException as exc:
            raise LlmTimeoutError(
                f"LLM 调用超时: {exc}",
                provider=self.provider_name,
            ) from exc
        except httpx.NetworkError as exc:
            raise LlmError(
                f"LLM 网络错误: {exc}",
                provider=self.provider_name,
            ) from exc

        if response.status_code >= 500:
            raise LlmError(
                f"LLM 服务端错误: HTTP {response.status_code}",
                provider=self.provider_name,
                status_code=response.status_code,
            )

        if response.status_code in (401, 403):
            raise LlmAuthError(
                f"LLM 鉴权失败: HTTP {response.status_code}",
                provider=self.provider_name,
                status_code=response.status_code,
            )

        if response.status_code >= 400:
            raise LlmError(
                f"LLM 调用失败: HTTP {response.status_code}, body={response.text[:200]}",
                provider=self.provider_name,
                status_code=response.status_code,
            )

        return response.json()

    def _parse_chat_response(self, data: dict[str, Any], latency_ms: int) -> ChatResult:
        """解析 chat/completions 响应"""
        try:
            choice = data["choices"][0]
            content = choice["message"]["content"] or ""
            finish_reason = choice.get("finish_reason", "stop")
            model = data.get("model", self._model)
            usage_raw = data.get("usage", {})
            usage = TokenUsage(
                prompt_tokens=usage_raw.get("prompt_tokens", 0),
                completion_tokens=usage_raw.get("completion_tokens", 0),
                total_tokens=usage_raw.get("total_tokens", 0),
            )
        except (KeyError, IndexError, TypeError) as exc:
            raise LlmError(
                f"LLM 响应格式异常: {exc}",
                provider=self.provider_name,
            ) from exc

        logger.info(
            "[LLM] chat call",
            extra={
                "provider": self.provider_name,
                "model": model,
                "latency_ms": latency_ms,
                "prompt_tokens": usage.prompt_tokens,
                "completion_tokens": usage.completion_tokens,
                "total_tokens": usage.total_tokens,
                "finish_reason": finish_reason,
            },
        )
        return ChatResult(
            content=content,
            model=model,
            finish_reason=finish_reason,
            usage=usage,
        )

    def _parse_embedding_response(
        self,
        data: dict[str, Any],
        requested_model: str,
        latency_ms: int,
    ) -> EmbeddingResult:
        """解析 embeddings 响应"""
        try:
            embedding = data["data"][0]["embedding"]
            model = data.get("model", requested_model)
            usage_raw = data.get("usage", {})
            usage = TokenUsage(
                prompt_tokens=usage_raw.get("prompt_tokens", 0),
                completion_tokens=0,
                total_tokens=usage_raw.get("total_tokens", usage_raw.get("prompt_tokens", 0)),
            )
        except (KeyError, IndexError, TypeError) as exc:
            raise LlmError(
                f"Embedding 响应格式异常: {exc}",
                provider=self.provider_name,
            ) from exc

        logger.info(
            "[LLM] embedding call",
            extra={
                "provider": self.provider_name,
                "model": model,
                "latency_ms": latency_ms,
                "dimensions": len(embedding),
                "total_tokens": usage.total_tokens,
            },
        )
        return EmbeddingResult(embedding=embedding, model=model, usage=usage)
