"""向量存储模块 - 基于 ChromaDB 的文档向量管理

D20.18 技术栈方案：使用 ChromaDB 作为向量存储，支持持久化本地存储。
V0 不依赖外部向量数据库，使用 persistent local 存储。
"""

import logging
from typing import List, Optional, Tuple
import uuid

import chromadb
from chromadb.api.types import Embedding, Documents, Metadatas
from chromadb.config import Settings
from chromadb.errors import InvalidCollectionException

logger = logging.getLogger(__name__)


class ChromaVectorStore:
    """ChromaDB 向量存储封装

    提供文档添加、查询、删除集合、列出集合等基础操作。
    """

    def __init__(self, persist_directory: str):
        self._client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(allow_reset=True),
        )
        logger.info("[RAG] ChromaDB 初始化完成", {"persist_directory": persist_directory})

    def add_documents(
        self,
        collection_name: str,
        documents: Documents,
        embeddings: Optional[List[Embedding]] = None,
        metadatas: Optional[Metadatas] = None,
        ids: Optional[List[str]] = None,
    ) -> None:
        """向集合添加文档

        Args:
            collection_name: 集合名称
            documents: 文档内容列表
            embeddings: 文档向量（可选，未提供时自动生成）
            metadatas: 文档元数据（可选）
            ids: 文档 ID（可选，未提供时自动生成）
        """
        collection = self._client.get_or_create_collection(name=collection_name)

        if ids is None:
            ids = [str(uuid.uuid4()) for _ in range(len(documents))]

        collection.add(
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids,
        )
        logger.info("[RAG] 文档添加完成", {"collection_name": collection_name, "count": len(documents)})

    def query(
        self,
        collection_name: str,
        query_texts: List[str],
        n_results: int = 5,
        embedding: Optional[Embedding] = None,
        where: Optional[dict] = None,
    ) -> Tuple[List[Documents], List[Metadatas], List[List[float]]]:
        """查询相似文档

        Args:
            collection_name: 集合名称
            query_texts: 查询文本列表
            n_results: 返回结果条数
            embedding: 查询向量（可选，未提供时自动生成）
            where: 元数据过滤条件（可选）

        Returns:
            (documents, metadatas, distances) 元组
        """
        try:
            collection = self._client.get_collection(name=collection_name)
        except InvalidCollectionException:
            logger.warning("[RAG] 集合不存在", {"collection_name": collection_name})
            return [], [], []

        if collection is None:
            logger.warning("[RAG] 集合不存在", {"collection_name": collection_name})
            return [], [], []

        results = collection.query(
            query_texts=query_texts,
            n_results=n_results,
            query_embeddings=embedding,
            where=where,
        )

        if isinstance(results, dict):
            return results.get("documents", []), results.get("metadatas", []), results.get("distances", [])
        return [], [], []

    def delete_collection(self, collection_name: str) -> None:
        """删除集合

        Args:
            collection_name: 集合名称
        """
        try:
            self._client.delete_collection(name=collection_name)
            logger.info("[RAG] 集合删除完成", {"collection_name": collection_name})
        except (ValueError, InvalidCollectionException):
            logger.warning("[RAG] 集合不存在，跳过删除", {"collection_name": collection_name})

    def list_collections(self) -> List[str]:
        """列出所有集合名称

        Returns:
            集合名称列表
        """
        collections = self._client.list_collections()
        if isinstance(collections, list):
            if len(collections) > 0 and isinstance(collections[0], str):
                return collections
            return [col.name for col in collections if hasattr(col, "name")]
        return []

    def get_collection_size(self, collection_name: str) -> int:
        """获取集合中文档数量

        Args:
            collection_name: 集合名称

        Returns:
            文档数量，集合不存在时返回 0
        """
        try:
            collection = self._client.get_collection(name=collection_name)
            return collection.count() if collection else 0
        except (ValueError, InvalidCollectionException):
            return 0

    def reset(self) -> None:
        """重置所有数据（仅用于测试）"""
        self._client.reset()
        logger.warning("[RAG] 所有数据已重置")
