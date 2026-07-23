"""Prompt 模板管理测试

覆盖：
- list_templates 返回所有内置模板（6 个：3 个原有 + 3 个方案生成）
- get_template 按名获取
- 未知模板名抛 KeyError
- 模板 render 替换占位符
- /api/v1/prompts 端点
- 新增方案生成模板的结构与字段验证
"""

import pytest

from src.prompts.manager import PromptManager
from src.prompts.templates import (
    BUILTIN_TEMPLATES,
    CONCEPT_GENERATION_PROMPT,
    DESIGN_OPTION_COMPARISON_PROMPT,
    DESIGN_SUMMARY_PROMPT,
    DRAWING_REVIEW_PROMPT,
    RULE_CHECK_PROMPT,
    SCHEME_DEEPENING_PROMPT,
)


def test_list_templates_returns_all_builtin():
    """list_templates 应返回全部 6 个内置模板"""
    manager = PromptManager()
    templates = manager.list_templates()
    assert len(templates) == 6
    names = {t.name for t in templates}
    assert names == {
        "rule-check",
        "drawing-review",
        "design-summary",
        "concept-generation",
        "scheme-deepening",
        "design-option-comparison",
    }


def test_get_template_by_name():
    """get_template 应按名返回模板"""
    manager = PromptManager()
    template = manager.get_template("rule-check")
    assert template.name == "rule-check"
    assert template.risk_level == "high"
    assert template.requires_human_review is True


def test_get_template_unknown_raises_key_error():
    """未知模板名应抛 KeyError"""
    manager = PromptManager()
    with pytest.raises(KeyError, match="不存在"):
        manager.get_template("nonexistent-template")


def test_has_template():
    """has_template 应正确判断模板存在性"""
    manager = PromptManager()
    assert manager.has_template("rule-check") is True
    assert manager.has_template("nonexistent") is False


def test_template_render_replaces_variables():
    """render 应替换 {{var}} 占位符"""
    rendered = RULE_CHECK_PROMPT.render(
        component="梁构件",
        code="GB 50010",
    )
    assert "梁构件" in rendered
    assert "GB 50010" in rendered
    assert "{{component}}" not in rendered
    assert "{{code}}" not in rendered


def test_template_render_missing_variable_raises():
    """render 缺少变量应抛 KeyError"""
    with pytest.raises(KeyError, match="缺少变量"):
        RULE_CHECK_PROMPT.render(component="梁")  # 缺少 code


def test_template_to_dto_has_camel_case_keys():
    """to_dto 应返回 camelCase 键（与 ai.contract.ts 对齐）"""
    dto = DESIGN_SUMMARY_PROMPT.to_dto()
    assert dto["name"] == "design-summary"
    assert dto["riskLevel"] == "low"
    assert dto["requiresHumanReview"] is False
    assert "template" in dto
    assert "variables" in dto
    assert "version" in dto


def test_builtin_templates_have_required_structure():
    """所有内置模板应包含 Role / Constraints / Output Format 结构"""
    for template in BUILTIN_TEMPLATES.values():
        assert "# Role" in template.template, f"{template.name} 缺少 Role 段"
        assert "# Constraints" in template.template, f"{template.name} 缺少 Constraints 段"
        assert "# Output Format" in template.template, f"{template.name} 缺少 Output Format 段"


# ── 概念方案生成模板测试 ──


def test_concept_generation_template_fields():
    """concept-generation 模板字段应符合设计（OD-03 V1 业务 + D09 概念阶段）"""
    assert CONCEPT_GENERATION_PROMPT.name == "concept-generation"
    assert CONCEPT_GENERATION_PROMPT.version == "v1"
    assert CONCEPT_GENERATION_PROMPT.risk_level == "medium"
    assert CONCEPT_GENERATION_PROMPT.requires_human_review is True
    # 4 个变量：siteDescription / brief / referenceImages / constraints
    assert set(CONCEPT_GENERATION_PROMPT.variables) == {
        "siteDescription",
        "brief",
        "referenceImages",
        "constraints",
    }


def test_concept_generation_render_replaces_all_variables():
    """concept-generation render 应替换全部 4 个变量"""
    rendered = CONCEPT_GENERATION_PROMPT.render(
        siteDescription="上海浦东某商业地块",
        brief="5-15 层中小型办公建筑",
        referenceImages="https://example.com/ref1.png",
        constraints="退界 5m，限高 60m",
    )
    assert "上海浦东某商业地块" in rendered
    assert "5-15 层中小型办公建筑" in rendered
    assert "https://example.com/ref1.png" in rendered
    assert "退界 5m，限高 60m" in rendered
    # 不应有未替换的占位符
    for var in CONCEPT_GENERATION_PROMPT.variables:
        assert f"{{{{{var}}}}}" not in rendered


def test_concept_generation_render_missing_variable_raises():
    """concept-generation render 缺少变量应抛 KeyError"""
    with pytest.raises(KeyError, match="缺少变量"):
        CONCEPT_GENERATION_PROMPT.render(
            siteDescription="地块 A",
            brief="办公",
            referenceImages="",
            # 缺少 constraints
        )


def test_concept_generation_template_includes_human_review_constraint():
    """concept-generation 应明确包含'人工复核'约束（AI 安全红线）"""
    assert "人工复核" in CONCEPT_GENERATION_PROMPT.template
    assert "AI 辅助" in CONCEPT_GENERATION_PROMPT.template


# ── 方案深化建议模板测试 ──


def test_scheme_deepening_template_fields():
    """scheme-deepening 模板字段应符合 D10 §D10.5 方案深化流程"""
    assert SCHEME_DEEPENING_PROMPT.name == "scheme-deepening"
    assert SCHEME_DEEPENING_PROMPT.version == "v1"
    assert SCHEME_DEEPENING_PROMPT.risk_level == "medium"
    assert SCHEME_DEEPENING_PROMPT.requires_human_review is True
    assert set(SCHEME_DEEPENING_PROMPT.variables) == {
        "conceptBaseline",
        "deepeningScope",
        "focusAspects",
    }


def test_scheme_deepening_render_replaces_all_variables():
    """scheme-deepening render 应替换全部 3 个变量"""
    rendered = SCHEME_DEEPENING_PROMPT.render(
        conceptBaseline="G1 基线摘要：体量 5 层框架",
        deepeningScope="space,envelope,structure",
        focusAspects="平立剖一致性、结构预协同",
    )
    assert "G1 基线摘要：体量 5 层框架" in rendered
    assert "space,envelope,structure" in rendered
    assert "平立剖一致性、结构预协同" in rendered
    for var in SCHEME_DEEPENING_PROMPT.variables:
        assert f"{{{{{var}}}}}" not in rendered


def test_scheme_deepening_template_references_d10_sections():
    """scheme-deepening 应引用 D10.7（平立剖一致性）和 D10.9/D10.10（结构/MEP 边界）"""
    template_text = SCHEME_DEEPENING_PROMPT.template
    assert "D10.7" in template_text
    assert "D10.9" in template_text
    assert "D10.10" in template_text


def test_scheme_deepening_template_includes_human_review_constraint():
    """scheme-deepening 应明确包含'专业会签'约束（V1 AI 安全红线）"""
    assert "专业会签" in SCHEME_DEEPENING_PROMPT.template
    assert "AI 辅助" in SCHEME_DEEPENING_PROMPT.template


# ── 方案比选分析模板测试 ──


def test_design_option_comparison_template_fields():
    """design-option-comparison 模板字段应符合 D26 §D26.3 第 5 条"""
    assert DESIGN_OPTION_COMPARISON_PROMPT.name == "design-option-comparison"
    assert DESIGN_OPTION_COMPARISON_PROMPT.version == "v1"
    assert DESIGN_OPTION_COMPARISON_PROMPT.risk_level == "low"
    assert DESIGN_OPTION_COMPARISON_PROMPT.requires_human_review is True
    assert set(DESIGN_OPTION_COMPARISON_PROMPT.variables) == {
        "options",
        "criteria",
        "constraints",
    }


def test_design_option_comparison_render_replaces_all_variables():
    """design-option-comparison render 应替换全部 3 个变量"""
    rendered = DESIGN_OPTION_COMPARISON_PROMPT.render(
        options='[{"name":"A","description":"体量 1","metrics":{"cost":100}}]',
        criteria='[{"name":"成本","direction":"min"}]',
        constraints='[{"name":"限高","value":"60m"}]',
    )
    assert '"name":"A"' in rendered
    assert '"name":"成本"' in rendered
    assert '"name":"限高"' in rendered
    for var in DESIGN_OPTION_COMPARISON_PROMPT.variables:
        assert f"{{{{{var}}}}}" not in rendered


def test_design_option_comparison_template_includes_feasibility_first():
    """design-option-comparison 应包含 Feasibility-first 原则（D26 §D26.3 第 2 条）"""
    assert "Feasibility-first" in DESIGN_OPTION_COMPARISON_PROMPT.template
    assert "Pareto" in DESIGN_OPTION_COMPARISON_PROMPT.template


def test_design_option_comparison_template_not_optimal():
    """design-option-comparison 应明确不预设'最优'（D26 §D26.3 第 5 条）"""
    assert "不预设" in DESIGN_OPTION_COMPARISON_PROMPT.template
    assert "不使用隐藏权重" in DESIGN_OPTION_COMPARISON_PROMPT.template


# ── 端到端测试 ──


@pytest.mark.asyncio
async def test_prompts_list_endpoint(async_client):
    """GET /api/v1/prompts 应返回 6 个模板"""
    response = await async_client.get("/api/v1/prompts")
    assert response.status_code == 200
    data = response.json()
    assert "templates" in data
    assert len(data["templates"]) == 6
    assert "traceId" in data


@pytest.mark.asyncio
async def test_prompts_get_by_name_endpoint(async_client):
    """GET /api/v1/prompts/{name} 应返回单个模板"""
    response = await async_client.get("/api/v1/prompts/rule-check")
    assert response.status_code == 200
    data = response.json()
    assert data["template"]["name"] == "rule-check"
    assert data["template"]["riskLevel"] == "high"


@pytest.mark.asyncio
async def test_prompts_get_concept_generation_endpoint(async_client):
    """GET /api/v1/prompts/concept-generation 应返回新模板"""
    response = await async_client.get("/api/v1/prompts/concept-generation")
    assert response.status_code == 200
    data = response.json()
    assert data["template"]["name"] == "concept-generation"
    assert data["template"]["riskLevel"] == "medium"
    assert data["template"]["requiresHumanReview"] is True
    assert "siteDescription" in data["template"]["variables"]


@pytest.mark.asyncio
async def test_prompts_get_scheme_deepening_endpoint(async_client):
    """GET /api/v1/prompts/scheme-deepening 应返回新模板"""
    response = await async_client.get("/api/v1/prompts/scheme-deepening")
    assert response.status_code == 200
    data = response.json()
    assert data["template"]["name"] == "scheme-deepening"
    assert data["template"]["riskLevel"] == "medium"
    assert data["template"]["requiresHumanReview"] is True


@pytest.mark.asyncio
async def test_prompts_get_design_option_comparison_endpoint(async_client):
    """GET /api/v1/prompts/design-option-comparison 应返回新模板"""
    response = await async_client.get("/api/v1/prompts/design-option-comparison")
    assert response.status_code == 200
    data = response.json()
    assert data["template"]["name"] == "design-option-comparison"
    assert data["template"]["riskLevel"] == "low"
    assert data["template"]["requiresHumanReview"] is True


@pytest.mark.asyncio
async def test_prompts_get_unknown_returns_404(async_client):
    """GET /api/v1/prompts/{unknown} 应返回 404"""
    response = await async_client.get("/api/v1/prompts/nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_prompts_endpoint_returns_trace_id_header(async_client):
    """prompts 端点响应应包含 x-trace-id 头"""
    response = await async_client.get(
        "/api/v1/prompts",
        headers={"x-trace-id": "prompts-trace-001"},
    )
    assert response.status_code == 200
    assert response.headers["x-trace-id"] == "prompts-trace-001"
