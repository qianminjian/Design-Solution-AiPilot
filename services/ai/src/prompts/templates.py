"""内置 Prompt 模板常量

按 backend-python.md §Prompt 工程规范：每个模板必须有结构（role / constraints / output format）。
V0 阶段为占位实现，后续按 D24.6 CapabilityRevision 走版本化评审流程。

注意：占位内容仅为 V0 演示，正式投产后须由 Prompt 工程师 + 业务专家共同评审。
"""

from src.prompts.models import PromptTemplate

# ── 规范条文检查 Prompt ──
RULE_CHECK_PROMPT = PromptTemplate(
    name="rule-check",
    version="v1",
    description="建筑规范条文合规性检查，输出不合规项与建议",
    template="""你是建筑施工图合规审查助手。

# Role
合规审查员

# Constraints
- 严格依据给定的规范条文判断
- 输出标记为"AI 辅助"，不替代注册建筑师专业审签
- 不确定时明确标注"需人工复核"

# Input
- 构件描述: {{component}}
- 适用规范: {{code}}

# Output Format
JSON 数组，每项含 {clause, compliant, evidence, suggestion}
""".strip(),
    variables=["component", "code"],
    risk_level="high",
    requires_human_review=True,
)


# ── 图纸审查 Prompt ──
DRAWING_REVIEW_PROMPT = PromptTemplate(
    name="drawing-review",
    version="v1",
    description="施工图图纸问题识别，标注坐标与置信度",
    template="""你是建筑施工图审查助手。

# Role
图纸审查员

# Constraints
- 仅识别图纸中可见的问题，不推断未画部分
- 每个问题须标注图纸坐标与置信度
- 输出标记为"AI 辅助"，高风险问题强制人工复核

# Input
- 图纸类型: {{drawingType}}
- 关注维度: {{focus}}

# Output Format
JSON 数组，每项含 {issue, severity, coordinate, confidence, suggestion}
""".strip(),
    variables=["drawingType", "focus"],
    risk_level="high",
    requires_human_review=True,
)


# ── 设计方案摘要 Prompt ──
DESIGN_SUMMARY_PROMPT = PromptTemplate(
    name="design-summary",
    version="v1",
    description="设计方案文本摘要生成，用于汇报材料",
    template="""你是建筑设计方案摘要助手。

# Role
方案摘要撰写员

# Constraints
- 客观复述设计意图，不增加主观评价
- 摘要长度不超过 500 字
- 输出标记为"AI 辅助"

# Input
- 方案描述: {{content}}

# Output Format
Markdown 格式的摘要文本
""".strip(),
    variables=["content"],
    risk_level="low",
    requires_human_review=False,
)


# 全部内置模板注册表（name -> PromptTemplate）
BUILTIN_TEMPLATES: dict[str, PromptTemplate] = {
    RULE_CHECK_PROMPT.name: RULE_CHECK_PROMPT,
    DRAWING_REVIEW_PROMPT.name: DRAWING_REVIEW_PROMPT,
    DESIGN_SUMMARY_PROMPT.name: DESIGN_SUMMARY_PROMPT,
}
