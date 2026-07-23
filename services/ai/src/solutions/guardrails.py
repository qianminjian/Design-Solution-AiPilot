"""方案生成 Guardrails

V0 最小化安全校验：
1. 长度校验：候选内容非空且 < 上限
2. 关键词黑名单：检测高危/不安全词
3. 安全关键词升级：含"最终施工图"/"已审签"/"安全结论"等触发人工复核升级

不引入重型 NLP，V2 升级为 LLM-as-judge 或规则引擎集成。
"""

import re

from src.solutions.schemas import GuardrailResult

# 候选内容长度上限（字符数）
MAX_CANDIDATE_CONTENT_LENGTH = 20000

# 高危关键词黑名单（命中即不通过）
# V0 仅列极少词，正式投产后须由安全团队评审扩充
BLOCKED_KEYWORDS: tuple[str, ...] = (
    "自杀",
    "自残",
    "暴力",
    "恐怖袭击",
)

# 安全关键词：命中后升级人工复核（不阻断，但强制双人复核）
# 这些词在 AI 输出中出现意味着 AI 越权给出了专业审签级结论
ESCALATION_KEYWORDS: tuple[str, ...] = (
    "最终施工图",
    "已审签",
    "安全结论",
    "结构安全计算",
    "已通过验收",
    "可直接施工",
)


def validate_content(content: str) -> list[str]:
    """校验候选内容长度与基本完整性

    Args:
        content: 候选内容字符串

    Returns:
        警告列表（空列表表示通过）
    """
    warnings: list[str] = []
    if not content or not content.strip():
        warnings.append("候选内容为空")
        return warnings
    if len(content) > MAX_CANDIDATE_CONTENT_LENGTH:
        warnings.append(
            f"候选内容超长: {len(content)} > {MAX_CANDIDATE_CONTENT_LENGTH}",
        )
    return warnings


def check_blocked_keywords(content: str) -> list[str]:
    """检测黑名单关键词

    Args:
        content: 待检测文本

    Returns:
        命中的关键词列表（空列表表示无命中）
    """
    hits: list[str] = []
    for keyword in BLOCKED_KEYWORDS:
        if keyword in content:
            hits.append(keyword)
    return hits


def check_escalation_keywords(content: str) -> bool:
    """检测安全升级关键词

    命中则升级人工复核（requiresHumanReview 强制 true）。

    Args:
        content: 待检测文本

    Returns:
        是否触发升级
    """
    return any(keyword in content for keyword in ESCALATION_KEYWORDS)


def evaluate(contents: list[str]) -> GuardrailResult:
    """对一组候选内容执行 Guardrails 校验

    Args:
        contents: 候选内容列表

    Returns:
        GuardrailResult，passed=False 表示校验未通过（应阻断响应或标记降级）
    """
    all_warnings: list[str] = []
    has_blocked = False
    has_escalation = False

    for idx, content in enumerate(contents):
        # 长度与完整性
        all_warnings.extend(
            f"[候选 {idx}] {w}" for w in validate_content(content)
        )
        # 黑名单
        blocked_hits = check_blocked_keywords(content)
        if blocked_hits:
            has_blocked = True
            all_warnings.append(
                f"[候选 {idx}] 命中黑名单关键词: {','.join(blocked_hits)}",
            )
        # 升级关键词
        if check_escalation_keywords(content):
            has_escalation = True
            all_warnings.append(
                f"[候选 {idx}] 命中安全升级关键词，强制人工复核",
            )

    return GuardrailResult(
        passed=not has_blocked and not all_warnings,
        warnings=all_warnings,
        escalated_review=has_escalation,
    )


def extract_json_array(content: str) -> list[dict[str, object]] | None:
    """尝试从 LLM 输出中提取 JSON 数组

    LLM 输出可能包含 ```json 代码块或纯 JSON，本函数做容错提取。

    Args:
        content: LLM 原始输出

    Returns:
        解析后的字典列表；解析失败返回 None
    """
    # 优先尝试直接解析
    try:
        import json

        parsed = json.loads(content)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            return [parsed]
    except json.JSONDecodeError:
        pass

    # 尝试从 ```json ... ``` 代码块中提取
    match = re.search(r"```(?:json)?\s*\n?(.+?)\n?```", content, re.DOTALL)
    if match:
        try:
            import json

            parsed = json.loads(match.group(1))
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, dict):
                return [parsed]
        except json.JSONDecodeError:
            pass

    return None
