"""检索问答测试 - mock embedding 和 LLM"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.rag.document_processor import DocumentProcessor
from src.rag.embedding import EmbeddingService
from src.rag.knowledge_base import KnowledgeBaseService
from src.rag.retrieval_chain import RetrievalChain
from src.rag.vector_store import ChromaVectorStore


class MockLlmClient:
    """Mock LLM Client"""

    @property
    def provider_name(self):
        return "mock"

    async def chat(self, messages, **kwargs):
        class MockResult:
            content = "根据参考资料，建筑物的耐火等级分为四级。【参考资料 1】"
            model = "mock-model"
            finish_reason = "end_turn"
            usage = MagicMock()
            usage.prompt_tokens = 100
            usage.completion_tokens = 50
            usage.total_tokens = 150

        return MockResult()

    async def complete(self, prompt, **kwargs):
        pass

    async def embed(self, input_text, **kwargs):
        pass

    async def close(self):
        pass


class TestRetrievalChain:
    """检索链测试"""

    @pytest.fixture
    def vector_store(self):
        store = ChromaVectorStore(persist_directory="./data/chroma_test_rag")
        store.reset()
        yield store
        store.reset()

    @pytest.fixture
    def embedding_service(self):
        service = MagicMock(spec=EmbeddingService)
        service.embed.return_value = [[0.1] * 384]
        service.embed_single.return_value = [0.1] * 384
        service.model_name = "all-MiniLM-L6-v2"
        return service

    @pytest.fixture
    def llm_client(self):
        return MockLlmClient()

    @pytest.fixture
    def retrieval_chain(self, vector_store, embedding_service, llm_client):
        return RetrievalChain(
            vector_store=vector_store,
            embedding_service=embedding_service,
            llm_client=llm_client,
            top_k=3,
        )

    @pytest.mark.asyncio
    async def test_query_with_results(self, retrieval_chain, vector_store):
        """测试有检索结果的查询"""
        collection_name = "test_rag"
        documents = [
            "建筑设计规范：建筑物的耐火等级分为四级。一级耐火等级最高，四级最低。",
            "建筑设计规范：高层建筑的定义是高度超过27米的住宅建筑。",
            "建筑设计规范：消防通道的宽度不应小于4米。",
        ]
        vector_store.add_documents(collection_name, documents)

        answer = await retrieval_chain.query(collection_name, "耐火等级分为几级？")

        assert answer.conclusion is not None
        assert len(answer.conclusion) > 0
        assert len(answer.citations) > 0
        assert answer.uncertainty >= 0
        assert answer.requires_human_review is True
        assert answer.is_ai_assisted is True

    @pytest.mark.asyncio
    async def test_query_empty_knowledge_base(self, retrieval_chain):
        """测试查询空知识库"""
        answer = await retrieval_chain.query("empty_kb", "测试问题")

        assert answer.conclusion is not None
        assert "未能从知识库中找到相关信息" in answer.conclusion
        assert len(answer.citations) == 0
        assert answer.uncertainty == 1.0

    def test_build_citations(self, retrieval_chain):
        """测试构建引用"""
        documents = ["内容1", "内容2"]
        metadatas = [
            {"chunk_id": "c1", "document_id": "d1", "title": "标题1", "section": "1.1"},
            {"chunk_id": "c2", "document_id": "d2", "title": "标题2", "section": "1.2"},
        ]
        distances = [0.1, 0.2]

        citations = retrieval_chain._build_citations(documents, metadatas, distances)

        assert len(citations) == 2
        assert citations[0].chunk_id == "c1"
        assert citations[0].document_id == "d1"
        assert citations[0].score == 0.9
        assert citations[1].score == 0.8

    def test_build_context(self, retrieval_chain):
        """测试构建上下文"""
        from src.rag.retrieval_chain import Citation

        citations = [
            Citation(chunk_id="c1", document_id="d1", title="标题1", section="1.1", content="内容1", score=0.9),
            Citation(chunk_id="c2", document_id="d2", title="标题2", section="1.2", content="内容2", score=0.8),
        ]

        context = retrieval_chain._build_context(citations)

        assert "【参考资料 1】" in context
        assert "【参考资料 2】" in context
        assert "标题1" in context
        assert "标题2" in context

    def test_calculate_uncertainty(self, retrieval_chain):
        """测试计算不确定性"""
        uncertainty = retrieval_chain._calculate_uncertainty([0.1, 0.2, 0.3])

        assert 0 <= uncertainty <= 1

        uncertainty_zero = retrieval_chain._calculate_uncertainty([])
        assert uncertainty_zero == 1.0


class TestDocumentProcessor:
    """文档处理器测试"""

    @pytest.fixture
    def processor(self):
        return DocumentProcessor(chunk_size=100, chunk_overlap=20)

    def test_split_text(self, processor):
        """测试文本切分"""
        text = "建筑设计规范：建筑物的耐火等级分为四级。一级耐火等级最高，四级最低。"

        chunks = processor.split_text(text, "doc1")

        assert len(chunks) >= 1
        assert chunks[0].content == text.strip()
        assert chunks[0].document_id == "doc1"

    def test_split_long_text(self, processor):
        """测试切分长文本"""
        long_text = "建筑设计规范：" + "这是一段较长的文本内容，用于测试文本切分功能。" * 10

        chunks = processor.split_text(long_text, "doc_long")

        assert len(chunks) > 1
        for chunk in chunks:
            assert len(chunk.content) <= 100

    def test_extract_metadata(self, processor):
        """测试提取元数据"""
        text = "建筑设计防火规范\n\n1.1 总则\n\n本规范适用于各类建筑。"

        metadata = processor.extract_metadata(text)

        assert "title" in metadata
        assert "section" in metadata
        assert "language" in metadata
        assert metadata["language"] == "zh"

    def test_empty_text(self, processor):
        """测试空文本"""
        chunks = processor.split_text("", "doc_empty")

        assert len(chunks) == 0
