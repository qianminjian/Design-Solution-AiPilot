"""知识库管理模块 - 知识库的创建、删除、列出、文档添加与查询

D20.4 领域对象：KnowledgeBase 对应项目的知识基线，包含 DocumentEdition、ApplicabilityDecision 等。
D20.16 服务接口：knowledge-baselines、knowledge-search、grounded-answers。
"""

import logging
from typing import List, Dict, Optional

from src.rag.document_processor import DocumentProcessor, DocumentChunk
from src.rag.embedding import EmbeddingService
from src.rag.retrieval_chain import RetrievalChain, GroundedAnswer
from src.rag.vector_store import ChromaVectorStore
from src.llm.client import LlmClient

logger = logging.getLogger(__name__)


class KnowledgeBaseService:
    """知识库服务

    提供知识库的创建、删除、列出、文档添加与查询功能。
    """

    def __init__(
        self,
        vector_store: ChromaVectorStore,
        embedding_service: EmbeddingService,
        document_processor: DocumentProcessor,
        llm_client: LlmClient,
        top_k: int = 5,
    ):
        self._vector_store = vector_store
        self._embedding_service = embedding_service
        self._document_processor = document_processor
        self._llm_client = llm_client
        self._top_k = top_k
        logger.info("[RAG] KnowledgeBaseService 初始化")

    def create_knowledge_base(self, knowledge_base_id: str) -> None:
        """创建知识库

        Args:
            knowledge_base_id: 知识库 ID
        """
        if knowledge_base_id in self.list_knowledge_bases():
            logger.warning("[RAG] 知识库已存在", {"knowledge_base_id": knowledge_base_id})
            return

        collection = self._vector_store._client.get_or_create_collection(name=knowledge_base_id)
        logger.info("[RAG] 知识库创建完成", {"knowledge_base_id": knowledge_base_id})

    def delete_knowledge_base(self, knowledge_base_id: str) -> None:
        """删除知识库

        Args:
            knowledge_base_id: 知识库 ID
        """
        self._vector_store.delete_collection(knowledge_base_id)
        logger.info("[RAG] 知识库删除完成", {"knowledge_base_id": knowledge_base_id})

    def list_knowledge_bases(self) -> List[str]:
        """列出所有知识库

        Returns:
            知识库 ID 列表
        """
        return self._vector_store.list_collections()

    def add_documents(
        self,
        knowledge_base_id: str,
        documents: List[Dict[str, str]],
    ) -> int:
        """向知识库添加文档

        Args:
            knowledge_base_id: 知识库 ID
            documents: 文档列表，每个文档包含 id、content、title、section 等字段

        Returns:
            添加的文档片段数量
        """
        all_chunks = []
        all_metadatas = []
        all_ids = []

        for doc in documents:
            document_id = doc.get("id", "")
            content = doc.get("content", "")
            title = doc.get("title", "")
            section = doc.get("section", "")

            chunks = self._document_processor.split_text(content, document_id)

            for chunk in chunks:
                all_chunks.append(chunk.content)
                all_metadatas.append({
                    "chunk_id": chunk.chunk_id,
                    "document_id": chunk.document_id,
                    "title": title or chunk.title,
                    "section": section or chunk.section,
                    "start_page": chunk.start_page,
                    "end_page": chunk.end_page,
                })
                all_ids.append(chunk.chunk_id)

        if all_chunks:
            embeddings = self._embedding_service.embed(all_chunks)
            self._vector_store.add_documents(
                collection_name=knowledge_base_id,
                documents=all_chunks,
                embeddings=embeddings,
                metadatas=all_metadatas,
                ids=all_ids,
            )

        logger.info("[RAG] 文档添加完成", {"knowledge_base_id": knowledge_base_id, "chunk_count": len(all_chunks)})
        return len(all_chunks)

    async def query(
        self,
        knowledge_base_id: str,
        question: str,
    ) -> GroundedAnswer:
        """查询知识库

        Args:
            knowledge_base_id: 知识库 ID
            question: 用户问题

        Returns:
            GroundedAnswer 包含结论、引用、不确定性等
        """
        retrieval_chain = RetrievalChain(
            vector_store=self._vector_store,
            embedding_service=self._embedding_service,
            llm_client=self._llm_client,
            top_k=self._top_k,
        )

        return await retrieval_chain.query(knowledge_base_id, question)

    def get_knowledge_base_info(self, knowledge_base_id: str) -> Dict[str, int]:
        """获取知识库信息

        Args:
            knowledge_base_id: 知识库 ID

        Returns:
            包含文档数量的字典
        """
        return {
            "document_count": self._vector_store.get_collection_size(knowledge_base_id),
        }
