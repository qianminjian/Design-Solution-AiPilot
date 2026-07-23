"""Prompt 模板管理测试

覆盖：
- list_templates 返回所有内置模板
- get_template 按名获取
- 未知模板名抛 KeyError
- 模板 render 替换占位符
- /api/v1/prompts 端点
"""

import pytest

from src.prompts.manager import PromptManager
from src.prompts.templates import (
    BUILTIN_TEMPLATES,
    DRAWING_REVIEW_PROMPT,
    RULE_CHECK_PROMPT,
    DESIGN_SUMMARY_PROMPT,
)


def test_list_templates_returns_all_builtin():
    """list_templates 应返回全部 3 个内置模板"""
    manager = PromptManager()
    templates = manager.list_templates()
    assert len(templates) == 3
    names = {t.name for t in templates}
    assert names == {"rule-check", "drawing-review", "design-summary"}


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


@pytest.mark.asyncio
async def test_prompts_list_endpoint(async_client):
    """GET /api/v1/prompts 应返回模板列表"""
    response = await async_client.get("/api/v1/prompts")
    assert response.status_code == 200
    data = response.json()
    assert "templates" in data
    assert len(data["templates"]) == 3
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
