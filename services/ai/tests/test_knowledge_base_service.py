"""KnowledgeBaseService 单元测试

覆盖知识库核心业务逻辑：
- 创建知识库（重复创建应跳过）
- 删除知识库
- 列出知识库
- 添加文档（含切分、向量化、入库）
- 查询（委托 RetrievalChain）
- 获取知识库信息

使用 Mock 隔离 vector_store / embedding_service / document_processor / llm_client。
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.rag.document_processor import DocumentChunk
from src.rag.knowledge_base import KnowledgeBaseService
from src.rag.retrieval_chain import GroundedAnswer


@pytest.fixture
def mock_vector_store():
    """Mock ChromaVectorStore"""
    store = MagicMock()
    store.list_collections.return_value = []
    store.get_collection_size.return_value = 0
    store._client = MagicMock()
    return store


@pytest.fixture
def mock_embedding_service():
    """Mock EmbeddingService"""
    service = MagicMock()
    service.embed.return_value = [[0.1, 0.2, 0.3]]
    return service


@pytest.fixture
def mock_document_processor():
    """Mock DocumentProcessor，返回固定切分结果"""
    processor = MagicMock()
    processor.split_text.return_value = [
        DocumentChunk(
            content="测试内容",
            chunk_id="doc1_chunk_0",
            document_id="doc1",
            title="测试标题",
            section="1.1",
            start_page=1,
            end_page=1,
        ),
    ]
    return processor


@pytest.fixture
def mock_llm_client():
    """Mock LlmClient"""
    client = MagicMock()
    client.provider_name = "mock"
    return client


@pytest.fixture
def service(mock_vector_store, mock_embedding_service, mock_document_processor, mock_llm_client):
    """构造 KnowledgeBaseService 实例"""
    return KnowledgeBaseService(
        vector_store=mock_vector_store,
        embedding_service=mock_embedding_service,
        document_processor=mock_document_processor,
        llm_client=mock_llm_client,
        top_k=5,
    )


class TestCreateKnowledgeBase:
    """创建知识库"""

    def test_should_create_new_knowledge_base(self, service, mock_vector_store):
        # Arrange
        mock_vector_store.list_collections.return_value = []
        mock_vector_store._client.get_or_create_collection.return_value = MagicMock()

        # Act
        service.create_knowledge_base("kb-001")

        # Assert
        mock_vector_store._client.get_or_create_collection.assert_called_once_with(name="kb-001")

    def test_should_skip_when_knowledge_base_already_exists(self, service, mock_vector_store):
        # Arrange
        mock_vector_store.list_collections.return_value = ["kb-001"]

        # Act
        service.create_knowledge_base("kb-001")

        # Assert - 不应再次创建
        mock_vector_store._client.get_or_create_collection.assert_not_called()


class TestDeleteKnowledgeBase:
    """删除知识库"""

    def test_should_delete_existing_knowledge_base(self, service, mock_vector_store):
        # Act
        service.delete_knowledge_base("kb-001")

        # Assert
        mock_vector_store.delete_collection.assert_called_once_with("kb-001")


class TestListKnowledgeBases:
    """列出知识库"""

    def test_should_return_all_knowledge_base_ids(self, service, mock_vector_store):
        # Arrange
        mock_vector_store.list_collections.return_value = ["kb-001", "kb-002", "kb-003"]

        # Act
        result = service.list_knowledge_bases()

        # Assert
        assert result == ["kb-001", "kb-002", "kb-003"]

    def test_should_return_empty_list_when_no_knowledge_bases(self, service, mock_vector_store):
        # Arrange
        mock_vector_store.list_collections.return_value = []

        # Act
        result = service.list_knowledge_bases()

        # Assert
        assert result == []


class TestAddDocuments:
    """添加文档"""

    def test_should_split_embed_and_store_documents(self, service, mock_vector_store, mock_embedding_service, mock_document_processor):
        # Arrange
        documents = [
            {"id": "doc1", "content": "测试内容", "title": "测试标题", "section": "1.1"},
        ]

        # Act
        chunk_count = service.add_documents("kb-001", documents)

        # Assert
        assert chunk_count == 1
        mock_document_processor.split_text.assert_called_once_with("测试内容", "doc1")
        mock_embedding_service.embed.assert_called_once()
        mock_vector_store.add_documents.assert_called_once()

        # 验证传入 vector_store 的参数
        call_args = mock_vector_store.add_documents.call_args
        assert call_args.kwargs["collection_name"] == "kb-001"
        assert len(call_args.kwargs["documents"]) == 1
        assert call_args.kwargs["documents"][0] == "测试内容"
        assert len(call_args.kwargs["ids"]) == 1
        assert call_args.kwargs["ids"][0] == "doc1_chunk_0"

    def test_should_handle_empty_document_list(self, service, mock_vector_store, mock_embedding_service):
        # Act
        chunk_count = service.add_documents("kb-001", [])

        # Assert
        assert chunk_count == 0
        mock_embedding_service.embed.assert_not_called()
        mock_vector_store.add_documents.assert_not_called()

    def test_should_use_document_fallback_when_metadata_missing(self, service, mock_document_processor):
        """文档缺少 title/section 时应使用 chunk 默认值"""
        # Arrange - 重新设置 mock 返回带默认 title/section 的 chunk
        mock_document_processor.split_text.return_value = [
            DocumentChunk(
                content="内容",
                chunk_id="doc1_chunk_0",
                document_id="doc1",
                title="默认标题",
                section="默认章节",
                start_page=1,
                end_page=1,
            ),
        ]

        documents = [{"id": "doc1", "content": "内容"}]  # 缺少 title 和 section

        # Act
        service.add_documents("kb-001", documents)

        # Assert - 调用 vector_store.add_documents 时 metadata 应使用 chunk 的默认值
        call_args = mock_document_processor.split_text.call_args
        assert call_args.args[0] == "内容"

    def test_should_aggregate_multiple_documents_chunks(self, service, mock_vector_store, mock_document_processor, mock_embedding_service):
        """多文档时应聚合所有切片"""
        # Arrange
        mock_document_processor.split_text.side_effect = [
            [DocumentChunk(content="c1", chunk_id="d1_c0", document_id="d1", title="t1", section="s1", start_page=1, end_page=1)],
            [DocumentChunk(content="c2", chunk_id="d2_c0", document_id="d2", title="t2", section="s2", start_page=1, end_page=1)],
        ]
        documents = [
            {"id": "d1", "content": "c1", "title": "t1", "section": "s1"},
            {"id": "d2", "content": "c2", "title": "t2", "section": "s2"},
        ]

        # Act
        chunk_count = service.add_documents("kb-001", documents)

        # Assert
        assert chunk_count == 2
        mock_embedding_service.embed.assert_called_once()
        call_args = mock_vector_store.add_documents.call_args
        assert len(call_args.kwargs["documents"]) == 2
        assert len(call_args.kwargs["ids"]) == 2


class TestQuery:
    """查询知识库"""

    @pytest.mark.asyncio
    async def test_should_delegate_to_retrieval_chain(self, service, mock_vector_store, mock_llm_client):
        """查询应委托给 RetrievalChain 并返回 GroundedAnswer"""
        # Arrange - mock vector_store.query 返回空结果触发"未检索到文档"分支
        mock_vector_store.query.return_value = ([[]], [[]], [[]])

        # Act
        result = await service.query("kb-001", "测试问题")

        # Assert
        assert result is not None
        assert hasattr(result, "conclusion")
        assert hasattr(result, "citations")
        assert hasattr(result, "uncertainty")
        assert result.uncertainty == 1.0  # 空结果不确定性为 1.0
        assert len(result.citations) == 0
        mock_vector_store.query.assert_called_once()


class TestGetKnowledgeBaseInfo:
    """获取知识库信息"""

    def test_should_return_document_count(self, service, mock_vector_store):
        # Arrange
        mock_vector_store.get_collection_size.return_value = 42

        # Act
        info = service.get_knowledge_base_info("kb-001")

        # Assert
        assert info["document_count"] == 42
        mock_vector_store.get_collection_size.assert_called_once_with("kb-001")

    def test_should_return_zero_when_collection_not_exists(self, service, mock_vector_store):
        # Arrange
        mock_vector_store.get_collection_size.return_value = 0

        # Act
        info = service.get_knowledge_base_info("nonexistent")

        # Assert
        assert info["document_count"] == 0
