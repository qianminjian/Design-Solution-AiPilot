"""Capability API 请求/响应模型

与 ai.contract.ts DTO 一一对应，使用 camelCase 别名以匹配前端契约。
"""

from pydantic import BaseModel, ConfigDict, Field


class TokenUsageSchema(BaseModel):
    """Token 用量"""

    model_config = ConfigDict(populate_by_name=True)

    prompt_tokens: int = Field(alias="promptTokens")
    completion_tokens: int = Field(alias="completionTokens")
    total_tokens: int = Field(alias="totalTokens")


class TextGenerationRequest(BaseModel):
    """文本生成请求"""

    model_config = ConfigDict(populate_by_name=True)

    prompt: str = Field(..., min_length=1, description="用户 prompt")
    system: str | None = Field(default=None, description="系统指令")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="采样温度")
    max_tokens: int = Field(default=1024, ge=1, le=8192, alias="maxTokens")
    prompt_template: str | None = Field(default=None, alias="promptTemplate")


class TextGenerationResponse(BaseModel):
    """文本生成响应"""

    model_config = ConfigDict(populate_by_name=True)

    content: str
    model: str
    finish_reason: str = Field(alias="finishReason")
    usage: TokenUsageSchema
    is_ai_assisted: bool = Field(default=True, alias="isAiAssisted")
    requires_human_review: bool = Field(default=True, alias="requiresHumanReview")
    latency_ms: int = Field(alias="latencyMs")


class VisionRequest(BaseModel):
    """视觉理解请求"""

    model_config = ConfigDict(populate_by_name=True)

    image_url: str = Field(..., min_length=1, alias="imageUrl")
    prompt: str = Field(..., min_length=1)
    system: str | None = None
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1024, ge=1, le=8192, alias="maxTokens")


class VisionResponse(BaseModel):
    """视觉理解响应"""

    model_config = ConfigDict(populate_by_name=True)

    content: str
    model: str
    finish_reason: str = Field(alias="finishReason")
    usage: TokenUsageSchema
    is_ai_assisted: bool = Field(default=True, alias="isAiAssisted")
    requires_human_review: bool = Field(default=True, alias="requiresHumanReview")
    latency_ms: int = Field(alias="latencyMs")


class EmbeddingRequest(BaseModel):
    """文本向量化请求"""

    model_config = ConfigDict(populate_by_name=True)

    input: str = Field(..., min_length=1)
    model: str | None = None


class EmbeddingResponse(BaseModel):
    """向量化响应"""

    model_config = ConfigDict(populate_by_name=True)

    embedding: list[float]
    dimensions: int
    model: str
    usage: TokenUsageSchema
    latency_ms: int = Field(alias="latencyMs")
