"""文档处理模块 - 文本切分与元数据提取

D20.8 摄取流程：解析目录、章/节/条/款/项，构建 Clause/ClauseRelation/CitationAnchor。
D20.10 切分策略：按语义边界切分，每个 Chunk 携带 Edition、ClausePath、标题链等元数据。
"""

import logging
import re
from dataclasses import dataclass
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class DocumentChunk:
    """文档切分片段

    D20.4 KnowledgeChunk：检索片段，包含 Clause 边界、父上下文、术语、元数据等。
    """

    content: str
    chunk_id: str
    document_id: str
    title: str
    section: str
    start_page: int = 0
    end_page: int = 0
    metadata: Optional[Dict[str, str]] = None


class DocumentProcessor:
    """文档处理器

    提供文本切分（按 chunk_size/chunk_overlap）、元数据提取功能。
    """

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 64):
        self._chunk_size = chunk_size
        self._chunk_overlap = chunk_overlap
        logger.info("[RAG] 文档处理器初始化", {"chunk_size": chunk_size, "chunk_overlap": chunk_overlap})

    def split_text(self, text: str, document_id: str) -> List[DocumentChunk]:
        """切分文本为多个片段

        D20.10 切分策略：优先按语义边界切分，过长时按 chunk_size 切分。

        Args:
            text: 原始文本
            document_id: 文档 ID

        Returns:
            切分后的文档片段列表
        """
        chunks = []
        text = text.strip()

        if not text:
            return chunks

        paragraphs = self._split_by_paragraphs(text)
        chunk_content = ""
        chunk_section = ""
        chunk_start_page = 1
        chunk_index = 0

        for para in paragraphs:
            if len(chunk_content) + len(para) <= self._chunk_size:
                chunk_content += para + "\n"
                if not chunk_section:
                    chunk_section = self._extract_section(para)
            else:
                if chunk_content.strip():
                    chunks.append(self._create_chunk(chunk_content, document_id, chunk_section, chunk_start_page, chunk_index))
                    chunk_index += 1

                chunk_content = para[-self._chunk_overlap:] if len(para) > self._chunk_overlap else para
                chunk_section = self._extract_section(para)

        if chunk_content.strip():
            chunks.append(self._create_chunk(chunk_content, document_id, chunk_section, chunk_start_page, chunk_index))

        logger.info("[RAG] 文本切分完成", {"document_id": document_id, "chunk_count": len(chunks)})
        return chunks

    def _split_by_paragraphs(self, text: str) -> List[str]:
        """按段落切分文本

        优先按换行符切分，再按标点符号切分过长段落。
        """
        paragraphs = re.split(r"\n\n+", text)
        result = []

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            if len(para) <= self._chunk_size:
                result.append(para)
            else:
                result.extend(self._split_long_paragraph(para))

        return result

    def _split_long_paragraph(self, text: str) -> List[str]:
        """切分过长段落

        按标点符号和空白符切分，保持语义完整性。
        """
        sentences = re.split(r"(?<=[。！？；])", text)
        chunks = []
        current_chunk = ""

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            if len(current_chunk) + len(sentence) <= self._chunk_size:
                current_chunk += sentence
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = sentence[-self._chunk_overlap:] if len(sentence) > self._chunk_overlap else sentence

        if current_chunk:
            chunks.append(current_chunk)

        return chunks

    def _extract_section(self, text: str) -> str:
        """从文本中提取章节信息

        匹配常见的章节编号格式，如：1.1、2.1.1、第1章、1. 等。
        """
        patterns = [
            r"^(\d+(\.\d+)+)\s+",
            r"^(\d+)\.\s+",
            r"^第(\d+)章\s+",
            r"^第(\d+)节\s+",
        ]

        for pattern in patterns:
            match = re.match(pattern, text)
            if match:
                return match.group(1)

        return ""

    def _create_chunk(self, content: str, document_id: str, section: str, start_page: int, index: int) -> DocumentChunk:
        """创建文档片段对象"""
        chunk_id = f"{document_id}_chunk_{index}"
        title = self._extract_title(content)

        return DocumentChunk(
            content=content.strip(),
            chunk_id=chunk_id,
            document_id=document_id,
            title=title,
            section=section,
            start_page=start_page,
            end_page=start_page,
            metadata={
                "document_id": document_id,
                "section": section,
                "chunk_index": str(index),
            },
        )

    def _extract_title(self, text: str) -> str:
        """从文本中提取标题

        取文本前 50 个字符作为标题。
        """
        lines = text.split("\n")
        for line in lines:
            stripped = line.strip()
            if stripped and len(stripped) <= 100:
                return stripped[:50]

        return ""

    def extract_metadata(self, text: str) -> Dict[str, str]:
        """从文本中提取元数据

        提取标题、章节、关键词等信息。

        Args:
            text: 原始文本

        Returns:
            元数据字典
        """
        lines = text.split("\n")[:20]

        title = ""
        section = ""
        language = "zh"

        for line in lines:
            line = line.strip()
            if not title and len(line) > 0 and len(line) <= 100:
                if not line[0].isdigit():
                    title = line[:100]
            if not section:
                section_match = re.match(r"^(\d+(\.\d+)+)\s+", line)
                if section_match:
                    section = section_match.group(1)

        if re.search(r"[a-zA-Z]{3,}", text):
            language = "zh-en"

        return {
            "title": title,
            "section": section,
            "language": language,
        }
