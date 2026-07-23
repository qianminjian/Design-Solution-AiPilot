"""方案生成 API 请求/响应模型

与 solutions.contract.ts DTO 一一对应，使用 camelCase 别名匹配前端契约。
所有响应强制标记 isAiAssisted=true，按风险等级进入人工复核（security.md §12）。
"""

from pydantic import BaseModel, ConfigDict, Field

from src.prompts.models import RiskLevel


class SolutionVariable(BaseModel):
    """Prompt 模板变量键值对"""

    model_config = ConfigDict(populate_by_name=True)

    key: str = Field(..., min_length=1, max_length=64, description="变量名")
    value: str = Field(..., min_length=1, max_length=8000, description="变量值")


class GenerateSolutionRequest(BaseModel):
    """方案生成请求

    用户选择 prompt 模板并提供变量值，AI 渲染模板并调用 LLM 生成方案候选。
    """

    model_config = ConfigDict(populate_by_name=True)

    prompt_template: str = Field(
        ...,
        min_length=1,
        max_length=64,
        alias="promptTemplate",
        description="Prompt 模板名称（如 concept-generation）",
    )
    variables: list[SolutionVariable] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="模板变量键值对",
    )
    project_id: str | None = Field(
        default=None,
        max_length=64,
        alias="projectId",
        description="关联项目 ID（用于审计与 traceId 关联）",
    )
    sketch_document_id: str | None = Field(
        default=None,
        max_length=64,
        alias="sketchDocumentId",
        description="草图文档 ID（CDE 文档），AI 通过 presigned URL 取图",
    )
    temperature: float = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
        description="采样温度，方案生成建议 0.6-0.9",
    )
    max_tokens: int = Field(
        default=2048,
        ge=1,
        le=8192,
        alias="maxTokens",
        description="最大生成 token 数",
    )


class SolutionCandidate(BaseModel):
    """方案候选（LLM 输出解析后）"""

    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=200, description="候选名称")
    content: str = Field(..., min_length=1, description="候选内容（Markdown/JSON 字符串）")
    risks: list[str] = Field(default_factory=list, description="风险点列表")
    feasibility_notes: str | None = Field(
        default=None,
        alias="feasibilityNotes",
        description="可行性注记",
    )


class GuardrailResult(BaseModel):
    """Guardrails 校验结果"""

    model_config = ConfigDict(populate_by_name=True)

    passed: bool = Field(..., description="是否通过校验")
    warnings: list[str] = Field(default_factory=list, description="警告信息")
    escalated_review: bool = Field(
        default=False,
        alias="escalatedReview",
        description="是否升级人工复核（触发安全关键词）",
    )


class TokenUsageSchema(BaseModel):
    """Token 用量"""

    model_config = ConfigDict(populate_by_name=True)

    prompt_tokens: int = Field(alias="promptTokens")
    completion_tokens: int = Field(alias="completionTokens")
    total_tokens: int = Field(alias="totalTokens")


class GenerateSolutionResponse(BaseModel):
    """方案生成响应

    所有响应强制标记 isAiAssisted=true，requiresHumanReview 默认 true。
    """

    model_config = ConfigDict(populate_by_name=True)

    candidates: list[SolutionCandidate] = Field(
        ...,
        min_length=1,
        description="方案候选列表",
    )
    raw_content: str = Field(
        ...,
        alias="rawContent",
        description="LLM 原始输出（未解析，用于审计追溯）",
    )
    model: str = Field(..., description="实际调用的 LLM 模型名")
    usage: TokenUsageSchema
    risk_level: RiskLevel = Field(
        ...,
        alias="riskLevel",
        description="风险等级（继承自 prompt 模板）",
    )
    prompt_template_used: str = Field(
        ...,
        alias="promptTemplateUsed",
        description="实际使用的 prompt 模板名",
    )
    guardrail: GuardrailResult
    is_ai_assisted: bool = Field(default=True, alias="isAiAssisted")
    requires_human_review: bool = Field(default=True, alias="requiresHumanReview")
    latency_ms: int = Field(alias="latencyMs")
