"""RetrievalChain 边界场景与 AI 安全红线专项测试

补充 test_rag_query.py 未覆盖的场景：
- _build_citations: metadata=None、缺字段、content 截断
- _build_prompt: 含 question 与 context
- _build_system_prompt: AI 安全红线关键字（"AI 辅助"、"需专业复核"）
- _calculate_uncertainty: 单元素、极大距离、超 1.0 截断
- GroundedAnswer 默认值：requires_human_review=True、is_ai_assisted=True（AI 安全红线）
- query: documents=[] 与 documents=[[]] 边界
- query: LLM 异常透传
- query: 调用 LLM 时传入正确的 temperature/max_tokens
"""
import pytest
from unittest.mock import MagicMock

from src.llm.client import ChatMessage, ChatResult, LlmError, TokenUsage
from src.rag.retrieval_chain import Citation, GroundedAnswer, RetrievalChain
from tests.conftest import MockLlmClient, make_chat_result


def _build_chat_result(content: str = "回答") -> ChatResult:
    return ChatResult(
        content=content,
        model="mock-model",
        finish_reason="stop",
        usage=TokenUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15),
    )


def _build_vector_store_stub(*, documents=None, metadatas=None, distances=None):
    """构造 stub vector_store，其 query 返回预设结果"""
    store = MagicMock()
    store.query.return_value = (
        documents if documents is not None else [],
        metadatas if metadatas is not None else [],
        distances if distances is not None else [],
    )
    return store


class TestBuildCitationsEdgeCases:
    """_build_citations 边界场景"""

    @pytest.fixture
    def chain(self) -> RetrievalChain:
        return RetrievalChain(
            vector_store=MagicMock(),
            embedding_service=MagicMock(),
            llm_client=MockLlmClient(chat_result=_build_chat_result()),
            top_k=3,
        )

    def test_metadata_none_uses_empty_dict(self, chain):
        """metadata=None 应被替换为空字典，不抛异常"""
        citations = chain._build_citations(
            documents=["内容1"],
            metadatas=[None],
            distances=[0.1],
        )
        assert len(citations) == 1
        assert citations[0].chunk_id == ""
        assert citations[0].document_id == ""
        assert citations[0].title == ""

    def test_partial_metadata_fields_default_empty(self, chain):
        """metadata 仅含部分字段，缺失字段使用空字符串"""
        citations = chain._build_citations(
            documents=["内容"],
            metadatas=[{"title": "仅标题"}],
            distances=[0.2],
        )
        assert citations[0].title == "仅标题"
        assert citations[0].chunk_id == ""
        assert citations[0].section == ""

    def test_content_truncated_to_200_chars(self, chain):
        """content 长度超过 200 应截断"""
        long_doc = "x" * 500
        citations = chain._build_citations(
            documents=[long_doc],
            metadatas=[{}],
            distances=[0.0],
        )
        assert len(citations[0].content) == 200

    def test_score_calculation_with_distance_zero(self, chain):
        """distance=0 时 score=1.0（完全匹配）"""
        citations = chain._build_citations(
            documents=["内容"],
            metadatas=[{}],
            distances=[0.0],
        )
        assert citations[0].score == 1.0

    def test_score_can_be_negative_for_large_distance(self, chain):
        """distance > 1.0 时 score 为负值（当前实现 1.0 - dist，未做 clamp）

        记录此行为：语义上 score 不应为负，但当前实现未 clamp。
        若未来修复，此测试需同步更新。
        """
        citations = chain._build_citations(
            documents=["内容"],
            metadatas=[{}],
            distances=[1.5],
        )
        assert citations[0].score == -0.5  # 当前实现，便于追溯

    def test_empty_lists_return_empty_citations(self, chain):
        """空文档列表应返回空引用列表"""
        citations = chain._build_citations(
            documents=[],
            metadatas=[],
            distances=[],
        )
        assert citations == []


class TestBuildPromptAndSystemPrompt:
    """_build_prompt 与 _build_system_prompt 验证"""

    @pytest.fixture
    def chain(self) -> RetrievalChain:
        return RetrievalChain(
            vector_store=MagicMock(),
            embedding_service=MagicMock(),
            llm_client=MockLlmClient(chat_result=_build_chat_result()),
            top_k=3,
        )

    def test_build_prompt_includes_question_and_context(self, chain):
        prompt = chain._build_prompt("建筑高度限制？", "参考资料 A")
        assert "建筑高度限制？" in prompt
        assert "参考资料 A" in prompt

    def test_build_prompt_contains_citation_instruction(self, chain):
        """提示词应明确要求标注引用来源"""
        prompt = chain._build_prompt("问题", "上下文")
        assert "引用来源" in prompt

    def test_system_prompt_contains_ai_safety_keywords(self, chain):
        """系统提示必须包含 AI 安全红线关键字（security.md §12）"""
        sys_prompt = chain._build_system_prompt()
        # AI 辅助标识
        assert "AI 辅助" in sys_prompt
        # 不作为最终专业判断声明
        assert "专业判断" in sys_prompt or "专业复核" in sys_prompt

    def test_system_prompt_contains_role_and_constraints(self, chain):
        """系统提示应包含 Role 与 Constraints 结构"""
        sys_prompt = chain._build_system_prompt()
        assert "# Role" in sys_prompt
        assert "# Constraints" in sys_prompt

    def test_system_prompt_prohibits_external_knowledge(self, chain):
        """约束项应禁止使用外部知识（防幻觉）"""
        sys_prompt = chain._build_system_prompt()
        assert "外部知识" in sys_prompt or "不编造" in sys_prompt

    def test_system_prompt_prohibits_leaking_instructions(self, chain):
        """约束项应禁止泄露系统指令（防 prompt injection）"""
        sys_prompt = chain._build_system_prompt()
        assert "不泄露" in sys_prompt or "系统指令" in sys_prompt


class TestCalculateUncertaintyEdgeCases:
    """_calculate_uncertainty 边界场景"""

    @pytest.fixture
    def chain(self) -> RetrievalChain:
        return RetrievalChain(
            vector_store=MagicMock(),
            embedding_service=MagicMock(),
            llm_client=MockLlmClient(chat_result=_build_chat_result()),
            top_k=3,
        )

    def test_empty_distances_returns_one(self, chain):
        """空距离列表返回 1.0（完全不确定）"""
        assert chain._calculate_uncertainty([]) == 1.0

    def test_single_distance(self, chain):
        """单元素距离列表应正确计算"""
        uncertainty = chain._calculate_uncertainty([0.3])
        assert uncertainty == 0.6  # 0.3 * 2

    def test_large_distance_clamped_to_one(self, chain):
        """平均距离 * 2 > 1.0 应截断为 1.0"""
        # 当前实现 uncertainty = min(1.0, avg * 2)
        uncertainty = chain._calculate_uncertainty([0.6, 0.7])
        avg = (0.6 + 0.7) / 2  # 0.65
        assert uncertainty == min(1.0, avg * 2)

    def test_zero_distances_returns_zero(self, chain):
        """所有距离为 0 表示完全匹配，不确定性为 0"""
        assert chain._calculate_uncertainty([0.0, 0.0, 0.0]) == 0.0

    def test_uncertainty_always_in_zero_to_one(self, chain):
        """不确定性分数应在 [0, 1] 区间"""
        for distances in [[], [0.1], [0.5], [1.0], [2.0], [0.1, 0.2, 0.3]]:
            u = chain._calculate_uncertainty(distances)
            assert 0.0 <= u <= 1.0


class TestGroundedAnswerAiSafetyDefaults:
    """GroundedAnswer 默认值必须满足 AI 安全红线（security.md §12）

    所有 AI 输出必须：
    - requires_human_review=True（默认进入人工复核流程）
    - is_ai_assisted=True（标记 AI 辅助）
    """

    def test_grounded_answer_defaults_to_human_review(self):
        """GroundedAnswer 默认 requires_human_review=True"""
        answer = GroundedAnswer(
            conclusion="结论",
            citations=[],
            uncertainty=0.5,
            model_version="mock",
            retrieval_time_ms=0,
        )
        assert answer.requires_human_review is True
        assert answer.is_ai_assisted is True

    def test_grounded_answer_explicit_disable_review_still_marks_ai(self):
        """显式关闭复核时仍标记为 AI 辅助"""
        # 注意：实际生产中不应关闭复核，此处仅验证字段语义
        answer = GroundedAnswer(
            conclusion="结论",
            citations=[],
            uncertainty=0.5,
            model_version="mock",
            retrieval_time_ms=0,
            requires_human_review=False,
            is_ai_assisted=True,
        )
        assert answer.requires_human_review is False
        assert answer.is_ai_assisted is True

    def test_citation_is_immutable(self):
        """Citation 为 frozen dataclass，应不可变"""
        citation = Citation(
            chunk_id="c1",
            document_id="d1",
            title="标题",
            section="1.1",
            content="内容",
            score=0.9,
        )
        with pytest.raises(Exception):
            citation.chunk_id = "modified"  # type: ignore[misc]

    def test_grounded_answer_is_immutable(self):
        """GroundedAnswer 为 frozen dataclass，应不可变"""
        answer = GroundedAnswer(
            conclusion="结论",
            citations=[],
            uncertainty=0.5,
            model_version="mock",
            retrieval_time_ms=0,
        )
        with pytest.raises(Exception):
            answer.conclusion = "modified"  # type: ignore[misc]


class TestQueryEdgeCases:
    """query 方法边界场景"""

    @pytest.fixture
    def llm_client(self) -> MockLlmClient:
        return MockLlmClient(chat_result=_build_chat_result())

    @pytest.fixture
    def chain(self, llm_client) -> RetrievalChain:
        return RetrievalChain(
            vector_store=MagicMock(),
            embedding_service=MagicMock(),
            llm_client=llm_client,
            top_k=3,
        )

    @pytest.mark.asyncio
    async def test_query_empty_documents_list_returns_unable_answer(self, chain):
        """documents=[]（外层空）应返回"未能找到"回答"""
        store = _build_vector_store_stub(documents=[], metadatas=[], distances=[])
        chain._vector_store = store

        answer = await chain.query("kb1", "问题")

        assert answer.citations == []
        assert answer.uncertainty == 1.0
        assert "未能从知识库中找到" in answer.conclusion
        # 不应调用 LLM
        assert len(chain._llm.chat_calls) == 0

    @pytest.mark.asyncio
    async def test_query_inner_empty_documents_returns_unable_answer(self, chain):
        """documents=[[]]（内层空）应返回"未能找到"回答"""
        store = _build_vector_store_stub(
            documents=[[]], metadatas=[[]], distances=[[]]
        )
        chain._vector_store = store

        answer = await chain.query("kb1", "问题")

        assert answer.citations == []
        assert answer.uncertainty == 1.0
        assert "未能从知识库中找到" in answer.conclusion
        assert len(chain._llm.chat_calls) == 0

    @pytest.mark.asyncio
    async def test_query_passes_correct_llm_params(self, chain):
        """query 调用 LLM 时应使用 temperature=0.3、max_tokens=1024"""
        store = _build_vector_store_stub(
            documents=[["文档内容"]],
            metadatas=[[{"title": "标题"}]],
            distances=[[0.1]],
        )
        chain._vector_store = store

        await chain.query("kb1", "问题")

        assert len(chain._llm.chat_calls) == 1
        call = chain._llm.chat_calls[0]
        assert call["temperature"] == 0.3
        assert call["max_tokens"] == 1024

    @pytest.mark.asyncio
    async def test_query_builds_system_and_user_messages(self, chain):
        """query 应构造 system + user 两条消息"""
        store = _build_vector_store_stub(
            documents=[["文档内容"]],
            metadatas=[[{"title": "标题", "section": "1.1"}]],
            distances=[[0.1]],
        )
        chain._vector_store = store

        await chain.query("kb1", "问题")

        messages = chain._llm.chat_calls[0]["messages"]
        assert len(messages) == 2
        assert messages[0].role == "system"
        assert messages[1].role == "user"
        assert "问题" in messages[1].content
        assert "标题" in messages[1].content

    @pytest.mark.asyncio
    async def test_query_llm_exception_propagates(self, chain):
        """LLM 异常应透传，不吞异常"""
        store = _build_vector_store_stub(
            documents=[["文档"]],
            metadatas=[[{}]],
            distances=[[0.1]],
        )
        chain._vector_store = store
        chain._llm._chat_exception = LlmError("LLM timeout", provider="mock")

        with pytest.raises(LlmError):
            await chain.query("kb1", "问题")

    @pytest.mark.asyncio
    async def test_query_returns_grounded_answer_with_ai_safety_flags(self, chain):
        """成功查询返回的 GroundedAnswer 必须满足 AI 安全红线"""
        store = _build_vector_store_stub(
            documents=[["文档"]],
            metadatas=[[{"title": "标题"}]],
            distances=[[0.1]],
        )
        chain._vector_store = store

        answer = await chain.query("kb1", "问题")

        # AI 安全红线：默认 requires_human_review=True、is_ai_assisted=True
        assert answer.requires_human_review is True
        assert answer.is_ai_assisted is True
        # 引用、结论与不确定性
        assert len(answer.citations) == 1
        assert answer.conclusion == "回答"
        assert 0.0 <= answer.uncertainty <= 1.0

    @pytest.mark.asyncio
    async def test_query_uses_provider_name_when_no_results(self, chain):
        """空结果时 model_version 应为 LLM provider_name"""
        store = _build_vector_store_stub(documents=[], metadatas=[], distances=[])
        chain._vector_store = store

        answer = await chain.query("kb1", "问题")

        assert answer.model_version == "mock"

    @pytest.mark.asyncio
    async def test_query_uses_llm_result_model_when_success(self, chain):
        """成功查询时 model_version 应来自 LLM 返回的 model"""
        store = _build_vector_store_stub(
            documents=[["文档"]],
            metadatas=[[{}]],
            distances=[[0.1]],
        )
        chain._vector_store = store

        answer = await chain.query("kb1", "问题")

        assert answer.model_version == "mock-model"

    @pytest.mark.asyncio
    async def test_query_citation_content_truncated(self, chain):
        """检索到的文档超 200 字符，citation.content 应截断"""
        long_doc = "y" * 500
        store = _build_vector_store_stub(
            documents=[[long_doc]],
            metadatas=[[{}]],
            distances=[[0.1]],
        )
        chain._vector_store = store

        answer = await chain.query("kb1", "问题")

        assert len(answer.citations[0].content) == 200
