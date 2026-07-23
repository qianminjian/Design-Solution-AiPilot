"""Prompt 模板管理

集中存放所有生产 Prompt，禁止"野生 Prompt"散落代码（backend-python.md §Prompt 工程）。
V0 内置 3 个占位模板，后续按 D24.6 CapabilityRevision 走版本化评审流程。
"""

from src.prompts.manager import PromptManager, get_prompt_manager
from src.prompts.models import PromptTemplate, RiskLevel
from src.prompts.templates import (
    RULE_CHECK_PROMPT,
    DRAWING_REVIEW_PROMPT,
    DESIGN_SUMMARY_PROMPT,
)

__all__ = [
    "PromptManager",
    "get_prompt_manager",
    "PromptTemplate",
    "RiskLevel",
    "RULE_CHECK_PROMPT",
    "DRAWING_REVIEW_PROMPT",
    "DESIGN_SUMMARY_PROMPT",
]
