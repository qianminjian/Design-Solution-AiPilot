"""方案生成 API 端点集成测试

使用 dependency_overrides 注入 MockLlmClient，覆盖：
- /solutions/generate 成功响应
- 模板不存在 -> 404
- 变量缺失 -> 400
- LLM 鉴权失败 -> 502
- LLM 超时 -> 504
- 参数校验失败 -> 422
"""

import json

import pytest

from src.llm.client import LlmAuthError, LlmTimeoutError
from src.main import app
from src.solutions.router import get_llm_client
from tests.conftest import MockLlmClient, make_chat_result


def _override_llm_client(mock_client: MockLlmClient) -> None:
    """覆盖 get_llm_client 依赖"""
    app.dependency_overrides[get_llm_client] = lambda: mock_client


def _clear_overrides() -> None:
    """清理依赖覆盖"""
    app.dependency_overrides.clear()


_VALID_CONCEPT_PAYLOAD = {
    "promptTemplate": "concept-generation",
    "variables": [
        {"key": "siteDescription", "value": "上海"},
        {"key": "brief", "value": "办公塔楼"},
        {"key": "referenceImages", "value": "无"},
        {"key": "constraints", "value": "限高 60m"},
    ],
    "temperature": 0.7,
    "maxTokens": 2048,
}


@pytest.mark.asyncio
async def test_generate_solution_success(async_client):
    """成功生成方案应返回 200 与 AI 辅助标记"""
    llm_output = json.dumps(
        [
            {
                "name": "方案 A",
                "content": "塔楼方案",
                "risks": ["限高紧"],
                "feasibilityNotes": "需复核消防",
            },
        ],
        ensure_ascii=False,
    )
    mock = MockLlmClient(chat_result=make_chat_result(content=llm_output))
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/solutions/generate",
            json=_VALID_CONCEPT_PAYLOAD,
        )
    finally:
        _clear_overrides()

    assert response.status_code == 200
    data = response.json()
    assert data["isAiAssisted"] is True
    assert data["requiresHumanReview"] is True
    assert data["riskLevel"] == "medium"
    assert data["promptTemplateUsed"] == "concept-generation"
    assert len(data["candidates"]) == 1
    assert data["candidates"][0]["name"] == "方案 A"
    assert data["candidates"][0]["risks"] == ["限高紧"]
    assert data["candidates"][0]["feasibilityNotes"] == "需复核消防"
    assert data["rawContent"] == llm_output
    assert data["model"] == "gpt-4o"
    assert data["latencyMs"] >= 0
    assert data["guardrail"]["passed"] is True


@pytest.mark.asyncio
async def test_generate_solution_template_not_found(async_client):
    """不存在的模板应返回 404"""
    mock = MockLlmClient(chat_result=make_chat_result())
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/solutions/generate",
            json={
                "promptTemplate": "non-existent",
                "variables": [{"key": "x", "value": "y"}],
            },
        )
    finally:
        _clear_overrides()

    assert response.status_code == 404
    assert "不存在" in response.json()["detail"]


@pytest.mark.asyncio
async def test_generate_solution_missing_variable(async_client):
    """变量缺失应返回 400"""
    mock = MockLlmClient(chat_result=make_chat_result())
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/solutions/generate",
            json={
                "promptTemplate": "concept-generation",
                "variables": [{"key": "siteDescription", "value": "上海"}],
            },
        )
    finally:
        _clear_overrides()

    assert response.status_code == 400
    assert "缺失" in response.json()["detail"]


@pytest.mark.asyncio
async def test_generate_solution_llm_auth_error(async_client):
    """LLM 鉴权失败应返回 502"""
    mock = MockLlmClient(chat_exception=LlmAuthError("invalid key"))
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/solutions/generate",
            json=_VALID_CONCEPT_PAYLOAD,
        )
    finally:
        _clear_overrides()

    assert response.status_code == 502


@pytest.mark.asyncio
async def test_generate_solution_llm_timeout(async_client):
    """LLM 超时应返回 504"""
    mock = MockLlmClient(chat_exception=LlmTimeoutError("timeout"))
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/solutions/generate",
            json=_VALID_CONCEPT_PAYLOAD,
        )
    finally:
        _clear_overrides()

    assert response.status_code == 504


@pytest.mark.asyncio
async def test_generate_solution_validation_error_empty_template(async_client):
    """空 promptTemplate 应返回 422"""
    response = await async_client.post(
        "/api/v1/solutions/generate",
        json={"promptTemplate": "", "variables": [{"key": "x", "value": "y"}]},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_generate_solution_validation_error_empty_variables(async_client):
    """空 variables 列表应返回 422"""
    response = await async_client.post(
        "/api/v1/solutions/generate",
        json={"promptTemplate": "concept-generation", "variables": []},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_generate_solution_design_summary_template(async_client):
    """design-summary 模板应返回 low 风险等级"""
    mock = MockLlmClient(chat_result=make_chat_result(content="摘要内容"))
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/solutions/generate",
            json={
                "promptTemplate": "design-summary",
                "variables": [{"key": "content", "value": "方案描述"}],
            },
        )
    finally:
        _clear_overrides()

    assert response.status_code == 200
    data = response.json()
    assert data["riskLevel"] == "low"
    assert data["requiresHumanReview"] is False  # design-summary 默认不强制复核


@pytest.mark.asyncio
async def test_generate_solution_with_project_id(async_client):
    """请求携带 projectId 应被接受（不影响业务逻辑）"""
    mock = MockLlmClient(chat_result=make_chat_result(content="[]"))
    _override_llm_client(mock)

    try:
        response = await async_client.post(
            "/api/v1/solutions/generate",
            json={**_VALID_CONCEPT_PAYLOAD, "projectId": "proj-123"},
        )
    finally:
        _clear_overrides()

    assert response.status_code == 200
