"""LLM Client 工厂

根据配置创建具体的 LlmClient 实现。
V0 仅支持 OpenAI 兼容 Provider，后续可扩展 anthropic / 自部署模型。
"""

from src.config import settings
from src.llm.client import LlmClient
from src.llm.openai_client import OpenAICompatibleClient


def create_llm_client() -> LlmClient:
    """根据 settings.llm_provider 创建 LlmClient

    V0 仅支持 openai provider。
    LLM_API_KEY 为空时仍创建 client（便于本地无 key 启动，调用时抛鉴权异常）。

    Returns:
        LlmClient 实例
    """
    provider = "openai"  # V0 写死，后续从 settings 读取

    if provider == "openai":
        return OpenAICompatibleClient(
            api_base=settings.llm_api_base,
            api_key=settings.llm_api_key,
            model=settings.llm_model,
            timeout=float(settings.llm_timeout),
        )

    raise ValueError(f"不支持的 LLM Provider: {provider}")
