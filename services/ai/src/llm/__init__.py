"""LLM Client 抽象层

按 D24 AI 能力目录设计，统一封装不同 Provider 的调用差异。
V0 仅实现 OpenAI 兼容 Provider，后续可扩展 Claude / 自部署模型。
"""

from src.llm.client import (
    LlmClient,
    LlmError,
    LlmTimeoutError,
    LlmAuthError,
    ChatMessage,
    ChatResult,
    EmbeddingResult,
)
from src.llm.factory import create_llm_client

__all__ = [
    "LlmClient",
    "LlmError",
    "LlmTimeoutError",
    "LlmAuthError",
    "ChatMessage",
    "ChatResult",
    "EmbeddingResult",
    "create_llm_client",
]
