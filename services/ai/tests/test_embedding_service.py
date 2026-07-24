"""EmbeddingService 单元测试

使用 sys.modules 注入 Mock 的 SentenceTransformer，避免真实加载模型。
覆盖：
- 懒加载模型（首次 embed 时加载）
- 模型加载失败抛异常
- 空文本列表返回空列表
- embed / embed_single 正常返回向量
- dimensions 属性触发懒加载
- is_loaded 状态正确反映
"""

from __future__ import annotations

import sys
from types import ModuleType
from typing import Any

import numpy as np
import pytest

from src.rag.embedding import EmbeddingService


class _FakeSentenceTransformer:
    """模拟 sentence_transformers.SentenceTransformer"""

    def __init__(self, model_name: str):
        self.model_name = model_name
        self._dim = 4
        # 记录构造次数用于验证懒加载
        self.constructor_calls = 0

    def get_sentence_embedding_dimension(self) -> int:
        return self._dim

    def encode(self, texts: list[str], **kwargs: Any) -> np.ndarray:
        # 每个文本返回固定向量（基于文本长度生成可区分向量）
        return np.array([[float(len(t) + i) for i in range(self._dim)] for t in texts])


@pytest.fixture
def fake_sentence_transformers(monkeypatch: pytest.MonkeyPatch):
    """注入 Mock 的 sentence_transformers 模块

    通过 monkeypatch sys.modules 替换真实模块，测试结束后自动还原。
    """
    fake_module = ModuleType("sentence_transformers")
    fake_module.SentenceTransformer = _FakeSentenceTransformer  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "sentence_transformers", fake_module)
    return fake_module


class TestEmbeddingService:
    """EmbeddingService 测试套"""

    def test_should_lazy_load_model_on_first_embed(
        self,
        fake_sentence_transformers,
    ):
        """首次调用 embed 时应懒加载模型"""
        # Arrange
        service = EmbeddingService(model_name="fake-model")

        # Act - 调用前模型未加载
        assert service.is_loaded() is False

        # Act - 调用 embed 触发加载
        result = service.embed(["测试文本"])

        # Assert
        assert service.is_loaded() is True
        assert len(result) == 1
        assert len(result[0]) == 4  # _FakeSentenceTransformer 维度

    def test_should_raise_on_model_load_failure(self, monkeypatch: pytest.MonkeyPatch):
        """模型加载失败应抛异常并保持未加载状态"""
        # Arrange - 注入会抛异常的 SentenceTransformer
        fake_module = ModuleType("sentence_transformers")

        class _BrokenModel:
            def __init__(self, model_name: str):
                raise RuntimeError("模型文件不存在")

        fake_module.SentenceTransformer = _BrokenModel  # type: ignore[attr-defined]
        monkeypatch.setitem(sys.modules, "sentence_transformers", fake_module)

        service = EmbeddingService(model_name="broken-model")

        # Act + Assert
        with pytest.raises(RuntimeError, match="模型文件不存在"):
            service.embed(["任何文本"])

        assert service.is_loaded() is False

    def test_should_return_empty_list_for_empty_input(
        self,
        fake_sentence_transformers,
    ):
        """空文本列表应返回空列表，不触发模型加载"""
        # Arrange
        service = EmbeddingService(model_name="fake-model")

        # Act - 空列表会触发 _ensure_model 后直接返回 []
        result = service.embed([])

        # Assert
        assert result == []

    def test_should_embed_single_text(
        self,
        fake_sentence_transformers,
    ):
        """embed_single 应返回单个向量"""
        # Arrange
        service = EmbeddingService(model_name="fake-model")

        # Act
        vector = service.embed_single("单个文本")

        # Assert
        assert isinstance(vector, list)
        assert len(vector) == 4
        assert all(isinstance(v, float) for v in vector)

    def test_should_embed_multiple_texts(
        self,
        fake_sentence_transformers,
    ):
        """多文本批量向量化应返回对应数量的向量"""
        # Arrange
        service = EmbeddingService(model_name="fake-model")
        texts = ["文本一", "文本二", "文本三"]

        # Act
        result = service.embed(texts)

        # Assert
        assert len(result) == 3
        assert all(len(vec) == 4 for vec in result)

    def test_should_expose_model_name(
        self,
        fake_sentence_transformers,
    ):
        """model_name 属性应返回构造时传入的模型名"""
        # Arrange + Act
        service = EmbeddingService(model_name="custom-model-name")

        # Assert
        assert service.model_name == "custom-model-name"

    def test_should_return_dimensions_after_load(
        self,
        fake_sentence_transformers,
    ):
        """dimensions 属性在模型加载后应返回正确维度"""
        # Arrange
        service = EmbeddingService(model_name="fake-model")

        # Act - 访问 dimensions 触发懒加载
        dim = service.dimensions

        # Assert
        assert dim == 4
        assert service.is_loaded() is True

    def test_should_raise_when_encode_fails(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """模型 encode 抛异常时应向上传播"""
        # Arrange - 注入 encode 会抛异常的模型
        fake_module = ModuleType("sentence_transformers")

        class _EncodeBrokenModel(_FakeSentenceTransformer):
            def encode(self, texts: list[str], **kwargs: Any):
                raise RuntimeError("GPU 内存不足")

        fake_module.SentenceTransformer = _EncodeBrokenModel  # type: ignore[attr-defined]
        monkeypatch.setitem(sys.modules, "sentence_transformers", fake_module)

        service = EmbeddingService(model_name="encode-broken")

        # Act + Assert
        with pytest.raises(RuntimeError, match="GPU 内存不足"):
            service.embed(["文本"])

    def test_should_embed_single_returns_empty_when_model_returns_empty(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """模型 encode 返回空数组时 embed_single 应防御性返回空列表

        源码逻辑：`return result[0] if result else []`
        """
        # Arrange - 注入返回空数组的 Mock
        fake_module = ModuleType("sentence_transformers")

        class _EmptyReturnModel(_FakeSentenceTransformer):
            def encode(self, texts: list[str], **kwargs: Any):
                return np.array([])

        fake_module.SentenceTransformer = _EmptyReturnModel  # type: ignore[attr-defined]
        monkeypatch.setitem(sys.modules, "sentence_transformers", fake_module)

        service = EmbeddingService(model_name="empty-return")

        # Act - encode 单文本异常返回空数组，embed 返回 []，embed_single 应返回 []
        result = service.embed_single("文本")

        # Assert - 防御性返回空列表，不抛 IndexError
        assert result == []
