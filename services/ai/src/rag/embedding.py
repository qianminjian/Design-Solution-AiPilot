"""Embedding 模块 - 基于 sentence-transformers 的文本向量化

D20.18 技术栈方案：可版本化多语种 Embedding Gateway，候选模型以项目语料评测选择。
与 LLM Client 解耦，使用本地 sentence-transformers 模型生成向量。
"""

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Embedding 服务

    使用 sentence-transformers 生成文本向量，支持懒加载模型。
    """

    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        model_path: str = "",
    ):
        """初始化 Embedding 服务

        Args:
            model_name: 模型名称（用于日志和默认加载）
            model_path: 模型绝对路径。非空时直接从路径加载，避免 huggingface_hub 缓存查找
        """
        self._model_name = model_name
        # 路径优先：设置后直接从路径加载，绕过 huggingface_hub 缓存机制
        self._model_path = model_path
        self._model = None
        self._dimensions = None
        logger.info(
            "[RAG] EmbeddingService 初始化",
            {"model_name": model_name, "model_path": model_path or "(none)"},
        )

    def _ensure_model(self) -> None:
        """确保模型已加载（懒加载）"""
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer

                # 路径优先：避免 huggingface_hub 在离线模式下找不到模型缓存
                load_target = self._model_path or self._model_name
                logger.info(
                    "[RAG] 加载 Embedding 模型",
                    {"load_target": load_target, "from_path": bool(self._model_path)},
                )
                self._model = SentenceTransformer(load_target)
                self._dimensions = self._model.get_sentence_embedding_dimension()
                logger.info("[RAG] Embedding 模型加载完成", {"dimensions": self._dimensions})
            except Exception as exc:
                logger.error("[RAG] Embedding 模型加载失败", {"error": str(exc)})
                raise

    def embed(self, texts: List[str]) -> List[List[float]]:
        """生成文本向量

        Args:
            texts: 待向量化的文本列表

        Returns:
            向量列表，每个向量是 float 列表
        """
        self._ensure_model()

        if not texts:
            return []

        try:
            embeddings = self._model.encode(texts)
            logger.info("[RAG] 向量生成完成", {"count": len(texts), "dimensions": self._dimensions})
            return embeddings.tolist() if hasattr(embeddings, "tolist") else embeddings
        except Exception as exc:
            logger.error("[RAG] 向量生成失败", {"error": str(exc)})
            raise

    def embed_single(self, text: str) -> List[float]:
        """生成单个文本向量

        Args:
            text: 待向量化的文本

        Returns:
            向量（float 列表）
        """
        result = self.embed([text])
        return result[0] if result else []

    @property
    def model_name(self) -> str:
        """获取模型名称"""
        return self._model_name

    @property
    def dimensions(self) -> Optional[int]:
        """获取向量维度

        Returns:
            向量维度，模型未加载时返回 None
        """
        if self._model is None:
            self._ensure_model()
        return self._dimensions

    def is_loaded(self) -> bool:
        """检查模型是否已加载"""
        return self._model is not None
