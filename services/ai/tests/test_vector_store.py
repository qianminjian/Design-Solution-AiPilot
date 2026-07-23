"""向量存储测试 - 使用 in-memory ChromaDB"""

import pytest

from src.rag.vector_store import ChromaVectorStore


class TestChromaVectorStore:
    """ChromaVectorStore 测试类"""

    @pytest.fixture
    def vector_store(self):
        """创建 in-memory 向量存储实例"""
        store = ChromaVectorStore(persist_directory="./data/chroma_test")
        store.reset()
        yield store
        store.reset()

    def test_add_and_query_documents(self, vector_store):
        """测试添加文档并查询"""
        collection_name = "test_collection"
        documents = [
            "建筑设计规范：建筑物的耐火等级分为四级。",
            "建筑设计规范：高层建筑的定义是高度超过27米的住宅建筑。",
            "建筑设计规范：消防通道的宽度不应小于4米。",
        ]

        vector_store.add_documents(collection_name, documents)

        results = vector_store.query(collection_name, ["耐火等级"], n_results=2)

        assert len(results[0]) >= 1
        assert len(results[0][0]) > 0
        assert len(results[1]) >= 1
        assert len(results[2]) >= 1

    def test_list_collections(self, vector_store):
        """测试列出所有集合"""
        vector_store.add_documents("test_col_1", ["测试文档1"])
        vector_store.add_documents("test_col_2", ["测试文档2"])

        collections = vector_store.list_collections()

        assert "test_col_1" in collections
        assert "test_col_2" in collections

    def test_delete_collection(self, vector_store):
        """测试删除集合"""
        collection_name = "test_delete"
        vector_store.add_documents(collection_name, ["待删除文档"])

        assert collection_name in vector_store.list_collections()

        vector_store.delete_collection(collection_name)

        assert collection_name not in vector_store.list_collections()

    def test_get_collection_size(self, vector_store):
        """测试获取集合大小"""
        collection_name = "test_size"

        assert vector_store.get_collection_size(collection_name) == 0

        vector_store.add_documents(collection_name, ["文档1", "文档2", "文档3"])

        assert vector_store.get_collection_size(collection_name) == 3

    def test_query_nonexistent_collection(self, vector_store):
        """测试查询不存在的集合"""
        results = vector_store.query("nonexistent_collection", ["测试查询"])

        assert len(results[0]) == 0
        assert len(results[1]) == 0
        assert len(results[2]) == 0
