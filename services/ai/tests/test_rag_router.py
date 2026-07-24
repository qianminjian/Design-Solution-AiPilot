"""RAG Router 端点测试

使用 dependency_overrides 注入 Mock KnowledgeBaseService，覆盖：
- POST /rag/query 成功响应与异常
- POST /rag/knowledge-bases 创建
- GET /rag/knowledge-bases 列表
- POST /rag/knowledge-bases/{id}/documents 添加文档
- DELETE /rag/knowledge-bases/{id} 删除
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.main import app
from src.rag.knowledge_base import KnowledgeBaseService
from src.rag.retrieval_chain import Citation, GroundedAnswer
from src.rag.router import get_knowledge_base_service


def _override_service(mock_service: KnowledgeBaseService) -> None:
    """覆盖 get_knowledge_base_service 依赖"""
    app.dependency_overrides[get_knowledge_base_service] = lambda: mock_service


def _clear_overrides() -> None:
    """清理依赖覆盖"""
    app.dependency_overrides.clear()


def _build_mock_service() -> MagicMock:
    """构造 Mock KnowledgeBaseService（spec 隔离）"""
    service = MagicMock(spec=KnowledgeBaseService)
    return service


def _build_grounded_answer() -> GroundedAnswer:
    """构造 GroundedAnswer fixture"""
    return GroundedAnswer(
        conclusion="根据规范，建筑物的耐火等级分为四级。",
        citations=[
            Citation(
                chunk_id="c1",
                document_id="d1",
                title="建筑设计防火规范",
                section="1.1",
                content="建筑物的耐火等级分为四级",
                score=0.95,
            ),
        ],
        uncertainty=0.2,
        model_version="gpt-4o",
        retrieval_time_ms=120,
    )


# ── /rag/query ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_rag_query_success(async_client):
    """检索问答应返回 200 与 AI 辅助标记"""
    mock_service = _build_mock_service()
    mock_service.query = AsyncMock(return_value=_build_grounded_answer())
    _override_service(mock_service)

    try:
        response = await async_client.post(
            "/api/v1/rag/query",
            json={"knowledge_base_id": "kb-001", "question": "耐火等级分为几级？"},
        )
    finally:
        _clear_overrides()

    assert response.status_code == 200
    data = response.json()
    assert data["conclusion"] == "根据规范，建筑物的耐火等级分为四级。"
    assert data["uncertainty"] == 0.2
    assert data["model_version"] == "gpt-4o"
    assert data["requires_human_review"] is True
    assert data["is_ai_assisted"] is True
    assert len(data["citations"]) == 1
    assert data["citations"][0]["chunk_id"] == "c1"
    assert data["citations"][0]["score"] == 0.95

    mock_service.query.assert_called_once_with("kb-001", "耐火等级分为几级？")


@pytest.mark.asyncio
async def test_rag_query_returns_500_on_exception(async_client):
    """服务异常时应返回 500"""
    mock_service = _build_mock_service()
    mock_service.query = AsyncMock(side_effect=RuntimeError("LLM 不可用"))
    _override_service(mock_service)

    try:
        response = await async_client.post(
            "/api/v1/rag/query",
            json={"knowledge_base_id": "kb-001", "question": "测试"},
        )
    finally:
        _clear_overrides()

    assert response.status_code == 500


@pytest.mark.asyncio
async def test_rag_query_missing_fields_returns_422(async_client):
    """请求缺少必填字段应返回 422"""
    response = await async_client.post(
        "/api/v1/rag/query",
        json={"question": "测试"},  # 缺少 knowledge_base_id
    )

    assert response.status_code == 422


# ── POST /rag/knowledge-bases ────────────────────────────────


@pytest.mark.asyncio
async def test_create_knowledge_base_success(async_client):
    """创建知识库应返回 201"""
    mock_service = _build_mock_service()
    _override_service(mock_service)

    try:
        response = await async_client.post(
            "/api/v1/rag/knowledge-bases",
            json={"knowledge_base_id": "kb-new"},
        )
    finally:
        _clear_overrides()

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "created"
    assert data["knowledge_base_id"] == "kb-new"

    mock_service.create_knowledge_base.assert_called_once_with("kb-new")


@pytest.mark.asyncio
async def test_create_knowledge_base_returns_500_on_exception(async_client):
    """创建失败应返回 500"""
    mock_service = _build_mock_service()
    mock_service.create_knowledge_base.side_effect = RuntimeError("ChromaDB 不可用")
    _override_service(mock_service)

    try:
        response = await async_client.post(
            "/api/v1/rag/knowledge-bases",
            json={"knowledge_base_id": "kb-new"},
        )
    finally:
        _clear_overrides()

    assert response.status_code == 500


# ── GET /rag/knowledge-bases ──────────────────────────────────


@pytest.mark.asyncio
async def test_list_knowledge_bases_success(async_client):
    """列出知识库应返回 200 与列表"""
    mock_service = _build_mock_service()
    mock_service.list_knowledge_bases.return_value = ["kb-001", "kb-002"]
    mock_service.get_knowledge_base_info.return_value = {"document_count": 5}
    _override_service(mock_service)

    try:
        response = await async_client.get("/api/v1/rag/knowledge-bases")
    finally:
        _clear_overrides()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["id"] == "kb-001"
    assert data[0]["document_count"] == 5
    assert data[1]["id"] == "kb-002"


@pytest.mark.asyncio
async def test_list_knowledge_bases_returns_empty_list(async_client):
    """无知识库时应返回空列表"""
    mock_service = _build_mock_service()
    mock_service.list_knowledge_bases.return_value = []
    _override_service(mock_service)

    try:
        response = await async_client.get("/api/v1/rag/knowledge-bases")
    finally:
        _clear_overrides()

    assert response.status_code == 200
    assert response.json() == []


# ── POST /rag/knowledge-bases/{id}/documents ─────────────────


@pytest.mark.asyncio
async def test_add_documents_success(async_client):
    """添加文档应返回 200 与切片数"""
    mock_service = _build_mock_service()
    mock_service.add_documents.return_value = 8
    _override_service(mock_service)

    try:
        response = await async_client.post(
            "/api/v1/rag/knowledge-bases/kb-001/documents",
            json={
                "documents": [
                    {"id": "d1", "content": "测试内容1"},
                    {"id": "d2", "content": "测试内容2"},
                ]
            },
        )
    finally:
        _clear_overrides()

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["knowledge_base_id"] == "kb-001"
    assert data["chunk_count"] == 8

    mock_service.add_documents.assert_called_once()
    call_args = mock_service.add_documents.call_args
    assert call_args.args[0] == "kb-001"
    assert len(call_args.args[1]) == 2


@pytest.mark.asyncio
async def test_add_documents_returns_500_on_exception(async_client):
    """添加文档失败应返回 500"""
    mock_service = _build_mock_service()
    mock_service.add_documents.side_effect = RuntimeError("Embedding 模型未加载")
    _override_service(mock_service)

    try:
        response = await async_client.post(
            "/api/v1/rag/knowledge-bases/kb-001/documents",
            json={"documents": [{"id": "d1", "content": "测试"}]},
        )
    finally:
        _clear_overrides()

    assert response.status_code == 500


# ── DELETE /rag/knowledge-bases/{id} ─────────────────────────


@pytest.mark.asyncio
async def test_delete_knowledge_base_success(async_client):
    """删除知识库应返回 200"""
    mock_service = _build_mock_service()
    _override_service(mock_service)

    try:
        response = await async_client.delete("/api/v1/rag/knowledge-bases/kb-001")
    finally:
        _clear_overrides()

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "deleted"
    assert data["knowledge_base_id"] == "kb-001"

    mock_service.delete_knowledge_base.assert_called_once_with("kb-001")


@pytest.mark.asyncio
async def test_delete_knowledge_base_returns_500_on_exception(async_client):
    """删除失败应返回 500"""
    mock_service = _build_mock_service()
    mock_service.delete_knowledge_base.side_effect = RuntimeError("ChromaDB 故障")
    _override_service(mock_service)

    try:
        response = await async_client.delete("/api/v1/rag/knowledge-bases/kb-001")
    finally:
        _clear_overrides()

    assert response.status_code == 500
