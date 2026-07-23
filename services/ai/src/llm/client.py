"""LLM Client 抽象基类与异常定义

定义统一的 complete/chat/embed 接口，屏蔽不同 Provider 差异。
所有 Provider 实现须继承 LlmClient 并实现抽象方法。
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


# ── 异常层级 ──

class LlmError(Exception):
    """LLM 调用基础异常"""

    def __init__(self, message: str, *, provider: str = "", status_code: int = 0):
        super().__init__(message)
        self.provider = provider
        self.status_code = status_code


class LlmTimeoutError(LlmError):
    """LLM 调用超时"""


class LlmAuthError(LlmError):
    """LLM 鉴权失败（401/403）"""


# ── 数据结构 ──

@dataclass(frozen=True)
class ChatMessage:
    """对话消息（OpenAI 兼容格式）"""

    role: str  # system / user / assistant
    content: str


@dataclass(frozen=True)
class TokenUsage:
    """Token 用量"""

    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


@dataclass(frozen=True)
class ChatResult:
    """chat 调用结果"""

    content: str
    model: str
    finish_reason: str
    usage: TokenUsage


@dataclass(frozen=True)
class EmbeddingResult:
    """embed 调用结果"""

    embedding: list[float]
    model: str
    usage: TokenUsage


# ── 抽象基类 ──

class LlmClient(ABC):
    """LLM Client 抽象基类

    所有 Provider 实现须继承此类并实现 complete/chat/embed 方法。
    调用方依赖此抽象，不依赖具体 Provider 实现（依赖倒置）。
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Provider 名称（如 openai / anthropic）"""

    @abstractmethod
    async def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> ChatResult:
        """文本补全（单轮，无对话历史）

        Args:
            prompt: 用户输入
            system: 可选系统指令
            temperature: 采样温度
            max_tokens: 最大生成 token 数

        Returns:
            ChatResult 包含内容/模型/用量
        """

    @abstractmethod
    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> ChatResult:
        """多轮对话

        Args:
            messages: 对话消息列表
            temperature: 采样温度
            max_tokens: 最大生成 token 数

        Returns:
            ChatResult 包含内容/模型/用量
        """

    @abstractmethod
    async def embed(self, input_text: str, *, model: str | None = None) -> EmbeddingResult:
        """文本向量化

        Args:
            input_text: 待向量化的文本
            model: 指定 embedding 模型（可选）

        Returns:
            EmbeddingResult 包含向量/模型/用量
        """

    @abstractmethod
    async def close(self) -> None:
        """释放底层资源（HTTP 连接池等）"""
