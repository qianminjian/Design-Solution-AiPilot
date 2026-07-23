"""RAG Router - REST API 接口

D20.16 服务接口：
- POST /knowledge-search：检索查询
- POST /grounded-answers：引证式回答

V0 简化接口：
- POST /api/v1/rag/query：检索问答（输入 question，返回 grounded answer）
- POST /api/v1/rag/knowledge-bases：创建知识库
- GET /api/v1/rag/knowledge-bases：列出知识库
- POST /api/v1/rag/knowledge-bases/{id}/documents：添加文档到知识库
- DELETE /api/v1/rag/knowledge-bases/{id}：删除知识库
"""

import logging
from typing import List, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from src.config import settings
from src.llm.factory import create_llm_client
from src.rag.document_processor import DocumentProcessor
from src.rag.embedding import EmbeddingService
from src.rag.knowledge_base import KnowledgeBaseService
from src.rag.vector_store import ChromaVectorStore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/rag", tags=["RAG"])


class QueryRequest(BaseModel):
    """检索问答请求"""

    knowledge_base_id: str = Field(..., description="知识库 ID")
    question: str = Field(..., description="用户问题")


class CitationSchema(BaseModel):
    """引用来源"""

    chunk_id: str
    document_id: str
    title: str
    section: str
    content: str
    score: float


class GroundedAnswerSchema(BaseModel):
    """引证式回答"""

    conclusion: str
    citations: List[CitationSchema]
    uncertainty: float
    model_version: str
    retrieval_time_ms: int
    requires_human_review: bool = True
    is_ai_assisted: bool = True


class CreateKnowledgeBaseRequest(BaseModel):
    """创建知识库请求"""

    knowledge_base_id: str = Field(..., description="知识库 ID")


class KnowledgeBaseSchema(BaseModel):
    """知识库信息"""

    id: str
    document_count: int


class AddDocumentRequest(BaseModel):
    """添加文档请求"""

    documents: List[Dict[str, str]] = Field(..., description="文档列表")


_rag_services = {}


def get_knowledge_base_service() -> KnowledgeBaseService:
    """获取知识库服务实例（单例模式）"""
    if "knowledge_base_service" not in _rag_services:
        vector_store = ChromaVectorStore(settings.chromadb_persist_directory)
        embedding_service = EmbeddingService(settings.embedding_model)
        document_processor = DocumentProcessor(settings.chunk_size, settings.chunk_overlap)
        llm_client = create_llm_client()

        _rag_services["knowledge_base_service"] = KnowledgeBaseService(
            vector_store=vector_store,
            embedding_service=embedding_service,
            document_processor=document_processor,
            llm_client=llm_client,
            top_k=settings.top_k,
        )

    return _rag_services["knowledge_base_service"]


def get_embedding_service() -> EmbeddingService:
    """获取 Embedding 服务实例（单例模式）"""
    if "embedding_service" not in _rag_services:
        _rag_services["embedding_service"] = EmbeddingService(settings.embedding_model)
    return _rag_services["embedding_service"]


@router.post("/query", response_model=GroundedAnswerSchema, status_code=status.HTTP_200_OK)
async def rag_query(request: QueryRequest, service: KnowledgeBaseService = Depends(get_knowledge_base_service)):
    """检索问答

    输入问题，返回 grounded answer（包含结论、引用来源、不确定性等）。

    D20.12 回答契约：每项事实主张绑定可访问 CitationAnchor。
    """
    try:
        answer = await service.query(request.knowledge_base_id, request.question)

        return GroundedAnswerSchema(
            conclusion=answer.conclusion,
            citations=[
                CitationSchema(
                    chunk_id=c.chunk_id,
                    document_id=c.document_id,
                    title=c.title,
                    section=c.section,
                    content=c.content,
                    score=c.score,
                )
                for c in answer.citations
            ],
            uncertainty=answer.uncertainty,
            model_version=answer.model_version,
            retrieval_time_ms=answer.retrieval_time_ms,
            requires_human_review=answer.requires_human_review,
            is_ai_assisted=answer.is_ai_assisted,
        )
    except Exception as exc:
        logger.error("[RAG] 查询失败", {"error": str(exc), "knowledge_base_id": request.knowledge_base_id})
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/knowledge-bases", status_code=status.HTTP_201_CREATED)
async def create_knowledge_base(
    request: CreateKnowledgeBaseRequest,
    service: KnowledgeBaseService = Depends(get_knowledge_base_service),
):
    """创建知识库"""
    try:
        service.create_knowledge_base(request.knowledge_base_id)
        return {"status": "created", "knowledge_base_id": request.knowledge_base_id}
    except Exception as exc:
        logger.error("[RAG] 创建知识库失败", {"error": str(exc), "knowledge_base_id": request.knowledge_base_id})
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/knowledge-bases", response_model=List[KnowledgeBaseSchema], status_code=status.HTTP_200_OK)
async def list_knowledge_bases(service: KnowledgeBaseService = Depends(get_knowledge_base_service)):
    """列出所有知识库"""
    try:
        kb_ids = service.list_knowledge_bases()
        return [
            KnowledgeBaseSchema(id=kb_id, document_count=service.get_knowledge_base_info(kb_id)["document_count"])
            for kb_id in kb_ids
        ]
    except Exception as exc:
        logger.error("[RAG] 列出知识库失败", {"error": str(exc)})
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/knowledge-bases/{knowledge_base_id}/documents", status_code=status.HTTP_200_OK)
async def add_documents(
    knowledge_base_id: str,
    request: AddDocumentRequest,
    service: KnowledgeBaseService = Depends(get_knowledge_base_service),
):
    """向知识库添加文档"""
    try:
        chunk_count = service.add_documents(knowledge_base_id, request.documents)
        return {"status": "success", "knowledge_base_id": knowledge_base_id, "chunk_count": chunk_count}
    except Exception as exc:
        logger.error("[RAG] 添加文档失败", {"error": str(exc), "knowledge_base_id": knowledge_base_id})
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/knowledge-bases/{knowledge_base_id}", status_code=status.HTTP_200_OK)
async def delete_knowledge_base(
    knowledge_base_id: str,
    service: KnowledgeBaseService = Depends(get_knowledge_base_service),
):
    """删除知识库"""
    try:
        service.delete_knowledge_base(knowledge_base_id)
        return {"status": "deleted", "knowledge_base_id": knowledge_base_id}
    except Exception as exc:
        logger.error("[RAG] 删除知识库失败", {"error": str(exc), "knowledge_base_id": knowledge_base_id})
        raise HTTPException(status_code=500, detail=str(exc))
