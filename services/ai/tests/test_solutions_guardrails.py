"""Guardrails 安全校验单元测试

覆盖 solutions/guardrails.py 的纯函数：
- validate_content: 空内容、超长内容、合法内容
- check_blocked_keywords: 命中黑名单、未命中
- check_escalation_keywords: 命中升级词、未命中
- evaluate: 多候选综合校验、passed 与 escalated_review 状态
- extract_json_array: JSON 数组、JSON 对象、代码块、非法格式

不依赖外部服务，纯函数测试。
"""

import pytest

from src.solutions.guardrails import (
    BLOCKED_KEYWORDS,
    ESCALATION_KEYWORDS,
    MAX_CANDIDATE_CONTENT_LENGTH,
    check_blocked_keywords,
    check_escalation_keywords,
    evaluate,
    extract_json_array,
    validate_content,
)


class TestValidateContent:
    """长度与完整性校验"""

    def test_empty_string_returns_warning(self):
        warnings = validate_content("")
        assert "候选内容为空" in warnings

    def test_whitespace_only_returns_warning(self):
        warnings = validate_content("   \n\t  ")
        assert "候选内容为空" in warnings

    def test_valid_content_returns_no_warnings(self):
        warnings = validate_content("这是一个合法的方案内容")
        assert warnings == []

    def test_overlong_content_returns_warning(self):
        content = "x" * (MAX_CANDIDATE_CONTENT_LENGTH + 1)
        warnings = validate_content(content)
        assert len(warnings) == 1
        assert "候选内容超长" in warnings[0]
        assert str(MAX_CANDIDATE_CONTENT_LENGTH) in warnings[0]

    def test_content_at_limit_returns_no_warnings(self):
        content = "x" * MAX_CANDIDATE_CONTENT_LENGTH
        warnings = validate_content(content)
        assert warnings == []


class TestCheckBlockedKeywords:
    """黑名单关键词检测"""

    def test_no_hit_returns_empty(self):
        hits = check_blocked_keywords("这是一个正常的方案描述")
        assert hits == []

    @pytest.mark.parametrize("keyword", list(BLOCKED_KEYWORDS))
    def test_blocked_keyword_hits(self, keyword: str):
        hits = check_blocked_keywords(f"方案包含 {keyword} 内容")
        assert keyword in hits

    def test_multiple_blocked_keywords_all_returned(self):
        content = "包含 自杀 与 暴力 内容"
        hits = check_blocked_keywords(content)
        assert "自杀" in hits
        assert "暴力" in hits
        assert len(hits) == 2


class TestCheckEscalationKeywords:
    """安全升级关键词检测"""

    def test_no_hit_returns_false(self):
        assert check_escalation_keywords("正常方案内容") is False

    @pytest.mark.parametrize("keyword", list(ESCALATION_KEYWORDS))
    def test_escalation_keyword_hits(self, keyword: str):
        assert check_escalation_keywords(f"这是 {keyword} 内容") is True


class TestEvaluate:
    """多候选综合校验"""

    def test_all_valid_passes(self):
        result = evaluate(["方案 A 内容", "方案 B 内容"])
        assert result.passed is True
        assert result.warnings == []
        assert result.escalated_review is False

    def test_empty_candidate_fails_without_escalation(self):
        result = evaluate(["", "正常内容"])
        assert result.passed is False
        assert any("候选 0" in w for w in result.warnings)
        assert result.escalated_review is False

    def test_blocked_keyword_fails_with_warning(self):
        result = evaluate(["包含 暴力 内容"])
        assert result.passed is False
        assert any("黑名单" in w for w in result.warnings)

    def test_escalation_keyword_triggers_review(self):
        """升级关键词触发 escalated_review=True 与强制人工复核警告

        注：当前 evaluate 实现中 passed=not has_blocked and not all_warnings，
        升级词会产生 warning，因此 passed=False。升级的关键作用是
        escalated_review=True，调用方据此强制 requires_human_review=True。
        """
        result = evaluate(["这是最终施工图版本"])
        assert result.escalated_review is True
        assert any("强制人工复核" in w for w in result.warnings)
        # 升级词产生 warning，passed=False（与 has_blocked 行为一致）
        assert result.passed is False

    def test_mixed_candidates_aggregate_warnings(self):
        result = evaluate([
            "方案 A 正常",  # 合法
            "包含 自杀 内容",  # 黑名单
            "这是最终施工图",  # 升级
        ])
        assert result.passed is False  # 因黑名单未通过
        assert result.escalated_review is True  # 因升级词
        # 警告包含各候选索引
        assert any("[候选 1]" in w for w in result.warnings)
        assert any("[候选 2]" in w for w in result.warnings)


class TestExtractJsonArray:
    """LLM 输出 JSON 提取"""

    def test_valid_json_array_parses(self):
        content = '[{"name": "A"}, {"name": "B"}]'
        result = extract_json_array(content)
        assert result is not None
        assert len(result) == 2
        assert result[0]["name"] == "A"

    def test_json_object_wrapped_as_single_item(self):
        content = '{"name": "A", "content": "塔楼"}'
        result = extract_json_array(content)
        assert result is not None
        assert len(result) == 1
        assert result[0]["name"] == "A"

    def test_json_code_block_extracts_correctly(self):
        content = '''这是方案建议：

```json
[
  {"name": "方案 A", "content": "塔楼"}
]
```

以上为候选。'''
        result = extract_json_array(content)
        assert result is not None
        assert len(result) == 1
        assert result[0]["name"] == "方案 A"

    def test_code_block_without_json_tag_extracts(self):
        content = '''建议如下：

```
[{"name": "A"}]
```'''
        result = extract_json_array(content)
        assert result is not None
        assert result[0]["name"] == "A"

    def test_invalid_json_returns_none(self):
        result = extract_json_array("not a json at all")
        assert result is None

    def test_empty_string_returns_none(self):
        result = extract_json_array("")
        assert result is None

    def test_invalid_json_in_code_block_returns_none(self):
        content = """```json
not valid json
```"""
        result = extract_json_array(content)
        assert result is None
