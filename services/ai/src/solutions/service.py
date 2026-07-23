"""方案生成业务逻辑

串联 prompt 模板渲染 → LLM 调用 → Guardrails 校验 → 响应组装。
所有 AI 输出强制标记 is_ai_assisted=true，按风险等级进入人工复核（security.md §12）。
"""

import logging

from src.llm.client import ChatMessage, LlmClient, LlmError
from src.prompts.models import PromptTemplate
from src.prompts.templates import BUILTIN_TEMPLATES
from src.solutions.guardrails import evaluate, extract_json_array
from src.solutions.schemas import (
    GenerateSolutionRequest,
    GenerateSolutionResponse,
    GuardrailResult,
    SolutionCandidate,
    TokenUsageSchema,
)

logger = logging.getLogger(__name__)


class SolutionGenerationError(Exception):
    """方案生成业务异常"""

    def __init__(self, message: str, *, code: str = "SOLUTION_GENERATION_FAILED"):
        super().__init__(message)
        self.code = code


class SolutionService:
    """方案生成服务

    封装 prompt 模板渲染、LLM 调用、Guardrails 校验与响应组装。
    依赖 LlmClient 抽象，便于测试 mock。
    """

    def __init__(self, llm_client: LlmClient):
        self._llm = llm_client

    async def generate(self, request: GenerateSolutionRequest) -> GenerateSolutionResponse:
        """生成方案候选

        Args:
            request: 方案生成请求

        Returns:
            GenerateSolutionResponse，含候选列表与 Guardrails 结果

        Raises:
            SolutionGenerationError: 模板不存在/变量缺失/LLM 调用失败
        """
        # 1. 解析 prompt 模板
        template = self._resolve_template(request.prompt_template)

        # 2. 渲染 prompt
        variables_dict = {v.key: v.value for v in request.variables}
        try:
            rendered_prompt = template.render(**variables_dict)
        except KeyError as exc:
            raise SolutionGenerationError(
                f"Prompt 模板变量缺失: {exc}",
                code="MISSING_TEMPLATE_VARIABLE",
            ) from exc

        # 3. 调用 LLM
        # LlmError 不在此捕获，由 router 统一映射为 HTTP 状态码（504/502）
        messages = [ChatMessage(role="user", content=rendered_prompt)]
        try:
            result = await self._llm.chat(
                messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
            )
        except LlmError:
            # 仅记录日志后 re-raise，状态码映射由 router 负责
            logger.error(
                "[Solution] LLM 调用失败",
                extra={"template": request.prompt_template},
            )
            raise

        # 4. 解析候选
        candidates = self._parse_candidates(result.content)

        # 5. Guardrails 校验
        contents = [c.content for c in candidates]
        guardrail = evaluate(contents)

        # 6. 风险等级决定是否强制人工复核
        # template.requires_human_review 或 Guardrail 升级时强制 true
        requires_human_review = (
            template.requires_human_review or guardrail.escalated_review
        )

        logger.info(
            "[Solution] 方案生成完成",
            extra={
                "template": request.prompt_template,
                "candidate_count": len(candidates),
                "risk_level": template.risk_level,
                "guardrail_passed": guardrail.passed,
                "escalated": guardrail.escalated_review,
            },
        )

        return GenerateSolutionResponse(
            candidates=candidates,
            raw_content=result.content,
            model=result.model,
            usage=TokenUsageSchema(
                prompt_tokens=result.usage.prompt_tokens,
                completion_tokens=result.usage.completion_tokens,
                total_tokens=result.usage.total_tokens,
            ),
            risk_level=template.risk_level,
            prompt_template_used=template.name,
            guardrail=guardrail,
            is_ai_assisted=True,
            requires_human_review=requires_human_review,
            latency_ms=0,  # 由 router 注入实际耗时
        )

    def _resolve_template(self, name: str) -> PromptTemplate:
        """从内置注册表解析 prompt 模板

        Args:
            name: 模板名称

        Returns:
            PromptTemplate

        Raises:
            SolutionGenerationError: 模板不存在
        """
        template = BUILTIN_TEMPLATES.get(name)
        if template is None:
            available = ",".join(sorted(BUILTIN_TEMPLATES.keys()))
            raise SolutionGenerationError(
                f"Prompt 模板不存在: {name}（可用: {available}）",
                code="TEMPLATE_NOT_FOUND",
            )
        return template

    def _parse_candidates(self, raw_content: str) -> list[SolutionCandidate]:
        """从 LLM 原始输出解析候选列表

        优先尝试 JSON 数组解析；解析失败时回退为单个候选（content=raw_content）。

        Args:
            raw_content: LLM 原始输出

        Returns:
            候选列表（至少 1 项）
        """
        parsed = extract_json_array(raw_content)
        if parsed:
            candidates: list[SolutionCandidate] = []
            for idx, item in enumerate(parsed):
                if not isinstance(item, dict):
                    continue
                name = str(item.get("name") or item.get("candidateName") or f"候选 {idx + 1}")
                # content 优先取 content/description/summary，否则整个 JSON 字符串
                content = (
                    item.get("content")
                    or item.get("description")
                    or item.get("summary")
                    or item.get("massingConcept")
                )
                if not content:
                    # 若整个 dict 无可读字段，用 JSON 字符串
                    import json

                    content = json.dumps(item, ensure_ascii=False)
                risks = item.get("risks") or item.get("keyRisks") or []
                if isinstance(risks, list):
                    risks = [str(r) for r in risks]
                else:
                    risks = [str(risks)]
                feasibility_notes = (
                    item.get("feasibilityNotes")
                    or item.get("feasibility_notes")
                    or item.get("notes")
                )
                candidates.append(
                    SolutionCandidate(
                        name=name,
                        content=str(content),
                        risks=risks,
                        feasibility_notes=(
                            str(feasibility_notes) if feasibility_notes else None
                        ),
                    ),
                )
            if candidates:
                return candidates

        # 回退：原始文本作为单个候选
        return [
            SolutionCandidate(
                name="LLM 原始输出",
                content=raw_content,
                risks=[],
                feasibility_notes=None,
            ),
        ]
