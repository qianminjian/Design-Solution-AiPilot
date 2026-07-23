"""SolutionService 业务逻辑单元测试

覆盖：
- 模板不存在 → SolutionGenerationError(TEMPLATE_NOT_FOUND)
- 变量缺失 → SolutionGenerationError(MISSING_TEMPLATE_VARIABLE)
- 成功生成（JSON 数组输出，解析为多个候选）
- 成功生成（纯文本输出，回退为单个候选）
- 候选字段映射（name/content/risks/feasibilityNotes）
- Guardrails 黑名单命中
- Guardrails 升级关键词触发人工复核
- LLM 异常透传（由 router 映射 HTTP 状态码）
- 风险等级继承自模板
"""

import json

import pytest

from src.llm.client import LlmAuthError, LlmTimeoutError
from src.solutions.schemas import GenerateSolutionRequest, SolutionVariable
from src.solutions.service import SolutionGenerationError, SolutionService
from tests.conftest import MockLlmClient, make_chat_result


def _make_request(
    template: str = "concept-generation",
    variables: list[dict[str, str]] | None = None,
) -> GenerateSolutionRequest:
    """构造请求 fixture"""
    if variables is None:
        variables = [
            {"key": "siteDescription", "value": "上海某地块"},
            {"key": "brief", "value": "办公塔楼"},
            {"key": "referenceImages", "value": "无"},
            {"key": "constraints", "value": "限高 60m"},
        ]
    return GenerateSolutionRequest(
        promptTemplate=template,
        variables=[SolutionVariable(key=v["key"], value=v["value"]) for v in variables],
    )


@pytest.mark.asyncio
async def test_template_not_found_raises_error():
    """不存在的模板应抛 TEMPLATE_NOT_FOUND"""
    mock = MockLlmClient(chat_result=make_chat_result())
    service = SolutionService(mock)
    request = _make_request(template="non-existent-template")

    with pytest.raises(SolutionGenerationError) as exc_info:
        await service.generate(request)
    assert exc_info.value.code == "TEMPLATE_NOT_FOUND"
    assert mock.chat_calls == []  # 未调用 LLM


@pytest.mark.asyncio
async def test_missing_variable_raises_error():
    """变量缺失应抛 MISSING_TEMPLATE_VARIABLE"""
    mock = MockLlmClient(chat_result=make_chat_result())
    service = SolutionService(mock)
    request = _make_request(
        variables=[{"key": "siteDescription", "value": "上海"}],  # 缺 brief 等
    )

    with pytest.raises(SolutionGenerationError) as exc_info:
        await service.generate(request)
    assert exc_info.value.code == "MISSING_TEMPLATE_VARIABLE"


@pytest.mark.asyncio
async def test_generate_success_with_json_array():
    """LLM 输出 JSON 数组时应解析为多个候选"""
    llm_output = json.dumps(
        [
            {
                "name": "方案 A",
                "massingConcept": "塔楼 + 裙房",
                "spaceStrategy": "垂直分区",
                "keyRisks": ["限高紧", "采光受限"],
                "feasibilityNotes": "需复核消防",
            },
            {
                "name": "方案 B",
                "massingConcept": "板式高层",
                "keyRisks": ["结构跨度大"],
            },
        ],
        ensure_ascii=False,
    )
    mock = MockLlmClient(chat_result=make_chat_result(content=llm_output))
    service = SolutionService(mock)
    request = _make_request()

    response = await service.generate(request)

    assert len(response.candidates) == 2
    assert response.candidates[0].name == "方案 A"
    assert "塔楼" in response.candidates[0].content
    assert response.candidates[0].risks == ["限高紧", "采光受限"]
    assert response.candidates[0].feasibility_notes == "需复核消防"
    assert response.candidates[1].name == "方案 B"
    assert response.candidates[1].feasibility_notes is None
    assert response.is_ai_assisted is True
    assert response.requires_human_review is True  # concept-generation 默认人工复核
    assert response.risk_level == "medium"
    assert response.prompt_template_used == "concept-generation"
    assert response.raw_content == llm_output
    assert response.model == "gpt-4o"


@pytest.mark.asyncio
async def test_generate_success_with_plain_text_fallback():
    """LLM 输出纯文本时应回退为单个候选"""
    llm_output = "这是一个纯文本方案描述，无法解析为 JSON。"
    mock = MockLlmClient(chat_result=make_chat_result(content=llm_output))
    service = SolutionService(mock)
    request = _make_request()

    response = await service.generate(request)

    assert len(response.candidates) == 1
    assert response.candidates[0].name == "LLM 原始输出"
    assert response.candidates[0].content == llm_output
    assert response.candidates[0].risks == []


@pytest.mark.asyncio
async def test_generate_success_with_json_code_block():
    """LLM 输出 ```json 代码块时应正确解析"""
    llm_output = """这是方案建议：

```json
[
  {
    "name": "方案 A",
    "content": "塔楼方案",
    "risks": ["限高"]
  }
]
```

以上为候选方案。"""
    mock = MockLlmClient(chat_result=make_chat_result(content=llm_output))
    service = SolutionService(mock)
    request = _make_request()

    response = await service.generate(request)

    assert len(response.candidates) == 1
    assert response.candidates[0].name == "方案 A"
    assert response.candidates[0].content == "塔楼方案"
    assert response.candidates[0].risks == ["限高"]


@pytest.mark.asyncio
async def test_guardrail_blocked_keyword_detected():
    """黑名单关键词命中时 Guardrail 应标记未通过"""
    llm_output = json.dumps(
        [{"name": "方案", "content": "包含 暴力 内容"}],
        ensure_ascii=False,
    )
    mock = MockLlmClient(chat_result=make_chat_result(content=llm_output))
    service = SolutionService(mock)
    request = _make_request()

    response = await service.generate(request)

    assert response.guardrail.passed is False
    assert any("黑名单" in w for w in response.guardrail.warnings)


@pytest.mark.asyncio
async def test_guardrail_escalation_keyword_triggers_review():
    """安全升级关键词应触发强制人工复核"""
    llm_output = json.dumps(
        [{"name": "方案", "content": "这是最终施工图版本"}],
        ensure_ascii=False,
    )
    mock = MockLlmClient(chat_result=make_chat_result(content=llm_output))
    service = SolutionService(mock)
    # design-summary 模板默认 requires_human_review=False，便于验证升级
    request = GenerateSolutionRequest(
        promptTemplate="design-summary",
        variables=[SolutionVariable(key="content", value="测试内容")],
    )

    response = await service.generate(request)

    # design-summary 默认 requires_human_review=False，但升级关键词应强制 true
    assert response.guardrail.escalated_review is True
    assert response.requires_human_review is True


@pytest.mark.asyncio
async def test_llm_auth_error_propagates():
    """LLM 鉴权失败应透传 LlmAuthError（由 router 映射为 502）"""
    mock = MockLlmClient(chat_exception=LlmAuthError("invalid api key"))
    service = SolutionService(mock)
    request = _make_request()

    with pytest.raises(LlmAuthError):
        await service.generate(request)


@pytest.mark.asyncio
async def test_llm_timeout_propagates():
    """LLM 超时应透传 LlmTimeoutError（由 router 映射为 504）"""
    mock = MockLlmClient(chat_exception=LlmTimeoutError("timeout"))
    service = SolutionService(mock)
    request = _make_request()

    with pytest.raises(LlmTimeoutError):
        await service.generate(request)


@pytest.mark.asyncio
async def test_risk_level_inherited_from_template():
    """风险等级应继承自 prompt 模板"""
    mock = MockLlmClient(chat_result=make_chat_result(content="摘要内容"))
    service = SolutionService(mock)
    request = GenerateSolutionRequest(
        promptTemplate="design-summary",
        variables=[SolutionVariable(key="content", value="测试")],
    )

    response = await service.generate(request)

    assert response.risk_level == "low"
    # design-summary 默认 requires_human_review=False
    assert response.requires_human_review is False


@pytest.mark.asyncio
async def test_temperature_and_max_tokens_passed_to_llm():
    """请求中的 temperature 和 maxTokens 应传递给 LLM"""
    mock = MockLlmClient(chat_result=make_chat_result(content="[]"))
    service = SolutionService(mock)
    request = GenerateSolutionRequest(
        promptTemplate="design-summary",
        variables=[SolutionVariable(key="content", value="测试")],
        temperature=0.3,
        maxTokens=512,
    )

    await service.generate(request)

    assert len(mock.chat_calls) == 1
    assert mock.chat_calls[0]["temperature"] == 0.3
    assert mock.chat_calls[0]["max_tokens"] == 512


@pytest.mark.asyncio
async def test_scheme_deepening_template_works():
    """scheme-deepening 模板应正确渲染"""
    mock = MockLlmClient(
        chat_result=make_chat_result(
            content=json.dumps(
                {"name": "深化方案", "content": "空间深化建议"},
                ensure_ascii=False,
            ),
        ),
    )
    service = SolutionService(mock)
    request = GenerateSolutionRequest(
        promptTemplate="scheme-deepening",
        variables=[
            SolutionVariable(key="conceptBaseline", value="G1 基线"),
            SolutionVariable(key="deepeningScope", value="space,envelope"),
            SolutionVariable(key="focusAspects", value="疏散"),
        ],
    )

    response = await service.generate(request)

    assert response.risk_level == "medium"
    assert response.requires_human_review is True
    assert response.prompt_template_used == "scheme-deepening"
