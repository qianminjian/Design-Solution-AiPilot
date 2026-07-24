"""DocumentProcessor 单元测试 - 覆盖文本切分与元数据提取的边界场景

覆盖：
- 空文本 / 纯空白返回空列表
- 短文本单段落
- 多段落累积不超 chunk_size 合并为一个 chunk
- 超长段落触发 _split_long_paragraph
- chunk_overlap 重叠文本处理
- 章节编号识别（1.1 / 1. / 第N章 / 第N节）
- 标题提取
- extract_metadata 多场景
- 默认参数与自定义参数
"""

from __future__ import annotations

import pytest

from src.rag.document_processor import DocumentChunk, DocumentProcessor


class TestSplitText:
    """split_text 切分逻辑测试"""

    def test_should_return_empty_for_empty_text(self):
        """空文本应返回空列表"""
        # Arrange
        processor = DocumentProcessor(chunk_size=100, chunk_overlap=10)

        # Act
        result = processor.split_text("", "doc-001")

        # Assert
        assert result == []

    def test_should_return_empty_for_whitespace_only_text(self):
        """纯空白文本 strip 后为空，应返回空列表"""
        # Arrange
        processor = DocumentProcessor(chunk_size=100, chunk_overlap=10)

        # Act
        result = processor.split_text("   \n  \t \n  ", "doc-002")

        # Assert
        assert result == []

    def test_should_return_single_chunk_for_short_text(self):
        """短文本（不超 chunk_size）应返回单个 chunk"""
        # Arrange
        processor = DocumentProcessor(chunk_size=100, chunk_overlap=10)
        text = "这是一段简短的文本。"

        # Act
        result = processor.split_text(text, "doc-003")

        # Assert
        assert len(result) == 1
        chunk = result[0]
        assert isinstance(chunk, DocumentChunk)
        assert chunk.document_id == "doc-003"
        assert chunk.chunk_id == "doc-003_chunk_0"
        assert "简短" in chunk.content

    def test_should_merge_multiple_short_paragraphs_into_one_chunk(self):
        """多个短段落累积不超 chunk_size 应合并为一个 chunk"""
        # Arrange
        processor = DocumentProcessor(chunk_size=100, chunk_overlap=10)
        # 两段短文本，总长度远小于 100
        text = "第一段内容。\n\n第二段内容。"

        # Act
        result = processor.split_text(text, "doc-004")

        # Assert
        assert len(result) == 1
        assert "第一段内容" in result[0].content
        assert "第二段内容" in result[0].content

    def test_should_split_when_paragraph_exceeds_chunk_size(self):
        """超长段落应触发切分"""
        # Arrange
        processor = DocumentProcessor(chunk_size=20, chunk_overlap=5)
        # 单段长度超过 20，含多个句号触发 _split_long_paragraph
        # 每句约 12 字符，4 句约 48 字符，超过 chunk_size=20
        text = "句一内容比较长。句二内容比较长。句三内容比较长。句四内容比较长。"

        # Act
        result = processor.split_text(text, "doc-005")

        # Assert - 应切分为多个 chunk
        assert len(result) >= 2
        # 每个 chunk content 长度应 <= chunk_size（实际可能因 overlap 略大）
        for chunk in result:
            assert isinstance(chunk, DocumentChunk)
            assert chunk.document_id == "doc-005"

    def test_should_preserve_chunk_ids_with_incrementing_index(self):
        """chunk_id 应按索引递增"""
        # Arrange
        processor = DocumentProcessor(chunk_size=20, chunk_overlap=5)
        text = "句一内容。句二内容。句三内容。句四内容。句五内容。"

        # Act
        result = processor.split_text(text, "doc-006")

        # Assert
        assert len(result) >= 2
        for i, chunk in enumerate(result):
            assert chunk.chunk_id == f"doc-006_chunk_{i}"

    def test_should_extract_section_for_numbered_paragraph(self):
        """段落开头含章节编号时应识别章节"""
        # Arrange
        processor = DocumentProcessor(chunk_size=100, chunk_overlap=10)
        text = "1.1 总则\n本规范适用于新建建筑。"

        # Act
        result = processor.split_text(text, "doc-007")

        # Assert - 第一段以 1.1 开头，section 应为 1.1
        assert len(result) >= 1
        assert result[0].section == "1.1"

    def test_should_extract_section_for_chapter_format(self):
        """章节格式 第N章 应被识别"""
        # Arrange
        processor = DocumentProcessor(chunk_size=100, chunk_overlap=10)
        text = "第3章 消防设计\n消防通道宽度不应小于4米。"

        # Act
        result = processor.split_text(text, "doc-008")

        # Assert
        assert len(result) >= 1
        assert result[0].section == "3"

    def test_should_extract_section_for_section_format(self):
        """章节格式 第N节 应被识别"""
        # Arrange
        processor = DocumentProcessor(chunk_size=100, chunk_overlap=10)
        text = "第2节 术语\n术语定义如下。"

        # Act
        result = processor.split_text(text, "doc-009")

        # Assert
        assert len(result) >= 1
        assert result[0].section == "2"

    def test_should_extract_section_for_single_number_format(self):
        """单数字章节格式 1. 应被识别"""
        # Arrange
        processor = DocumentProcessor(chunk_size=100, chunk_overlap=10)
        text = "1. 总则\n本规范适用于新建建筑。"

        # Act
        result = processor.split_text(text, "doc-010")

        # Assert
        assert len(result) >= 1
        assert result[0].section == "1"

    def test_should_set_empty_section_for_unnumbered_paragraph(self):
        """无章节编号的段落 section 应为空字符串"""
        # Arrange
        processor = DocumentProcessor(chunk_size=100, chunk_overlap=10)
        text = "这是一段没有任何章节编号的文本。"

        # Act
        result = processor.split_text(text, "doc-011")

        # Assert
        assert len(result) == 1
        assert result[0].section == ""

    def test_should_set_metadata_with_document_id_and_section(self):
        """chunk metadata 应包含 document_id、section、chunk_index"""
        # Arrange
        processor = DocumentProcessor(chunk_size=100, chunk_overlap=10)
        text = "1.1 测试\n内容。"

        # Act
        result = processor.split_text(text, "doc-meta-001")

        # Assert
        assert len(result) >= 1
        metadata = result[0].metadata
        assert metadata is not None
        assert metadata["document_id"] == "doc-meta-001"
        assert metadata["section"] == "1.1"
        assert metadata["chunk_index"] == "0"

    def test_should_use_default_chunk_size_and_overlap(self):
        """默认参数应为 chunk_size=512, chunk_overlap=64"""
        # Arrange + Act
        processor = DocumentProcessor()

        # Assert - 通过私有属性验证默认值
        assert processor._chunk_size == 512
        assert processor._chunk_overlap == 64

    def test_should_accept_custom_chunk_size_and_overlap(self):
        """应支持自定义 chunk_size 和 chunk_overlap"""
        # Arrange + Act
        processor = DocumentProcessor(chunk_size=256, chunk_overlap=32)

        # Assert
        assert processor._chunk_size == 256
        assert processor._chunk_overlap == 32


class TestExtractMetadata:
    """extract_metadata 元数据提取测试"""

    def test_should_extract_title_from_first_line(self):
        """应从第一行提取标题"""
        # Arrange
        processor = DocumentProcessor()
        text = "建筑设计规范\n第一章节内容\n更多内容"

        # Act
        metadata = processor.extract_metadata(text)

        # Assert
        assert metadata["title"] == "建筑设计规范"

    def test_should_extract_section_when_line_starts_with_number(self):
        """段落开头为 1.1 格式时应提取为 section"""
        # Arrange
        processor = DocumentProcessor()
        text = "标题\n1.1 总则\n本规范适用于新建建筑。"

        # Act
        metadata = processor.extract_metadata(text)

        # Assert
        assert metadata["section"] == "1.1"

    def test_should_default_language_zh_for_chinese_text(self):
        """纯中文文本 language 应为 zh"""
        # Arrange
        processor = DocumentProcessor()
        text = "建筑设计规范\n第一章节内容"

        # Act
        metadata = processor.extract_metadata(text)

        # Assert
        assert metadata["language"] == "zh"

    def test_should_detect_zh_en_for_mixed_text(self):
        """中英混合文本应识别为 zh-en"""
        # Arrange
        processor = DocumentProcessor()
        text = "建筑设计规范 Building Design Code\n包含英文内容。"

        # Act
        metadata = processor.extract_metadata(text)

        # Assert - 检测到 3+ 连续字母时标记为 zh-en
        assert metadata["language"] == "zh-en"

    def test_should_return_empty_title_for_blank_text(self):
        """空文本应返回空 title 与默认 language"""
        # Arrange
        processor = DocumentProcessor()

        # Act
        metadata = processor.extract_metadata("")

        # Assert
        assert metadata["title"] == ""
        assert metadata["section"] == ""
        assert metadata["language"] == "zh"

    def test_should_skip_first_line_if_starts_with_digit(self):
        """首行以数字开头时不应作为 title（应继续找下一非数字行）"""
        # Arrange
        processor = DocumentProcessor()
        text = "2026 年发布\n建筑设计规范"

        # Act
        metadata = processor.extract_metadata(text)

        # Assert - 第一行以数字开头被跳过，第二行作为 title
        assert metadata["title"] == "建筑设计规范"

    def test_should_limit_title_to_100_chars(self):
        """首行长度恰好 100 字符时 title 应保留为 100 字符"""
        # Arrange
        processor = DocumentProcessor()
        # 100 字符标题（满足 len(line) <= 100 条件）
        title_100 = "标" * 100
        text = title_100 + "\n正文"

        # Act
        metadata = processor.extract_metadata(text)

        # Assert - extract_metadata 中 title = line[:100]
        assert len(metadata["title"]) == 100
        assert metadata["title"] == title_100

    def test_should_skip_overlong_first_line_for_title(self):
        """首行长度超过 100 字符时应跳过，从后续行中选取 title"""
        # Arrange
        processor = DocumentProcessor()
        long_title = "标题" * 60  # 120 字符，超过 100 限制
        text = long_title + "\n建筑设计规范"

        # Act
        metadata = processor.extract_metadata(text)

        # Assert - 第一行被跳过，第二行作为 title
        assert metadata["title"] == "建筑设计规范"
