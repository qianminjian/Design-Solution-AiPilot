"""Prompt 模板数据模型"""

from dataclasses import dataclass
from typing import Literal

# 风险等级（对齐 security.md §12 AI 安全红线）
RiskLevel = Literal["low", "medium", "high", "critical"]


@dataclass(frozen=True)
class PromptTemplate:
    """Prompt 模板（不可变）

    所有生产 Prompt 必须有结构（role / constraints / output format），
    禁止野生 Prompt 散落代码（backend-python.md §Prompt 工程）。
    """

    name: str
    version: str
    description: str
    template: str
    variables: list[str]
    risk_level: RiskLevel
    requires_human_review: bool

    def render(self, **kwargs: str) -> str:
        """渲染模板，将 {{var}} 占位符替换为实际值

        Args:
            **kwargs: 占位符变量键值对

        Returns:
            渲染后的 prompt 字符串

        Raises:
            KeyError: 缺少必要变量
        """
        rendered = self.template
        for var in self.variables:
            if var not in kwargs:
                raise KeyError(f"Prompt 模板 {self.name} 缺少变量: {var}")
            rendered = rendered.replace(f"{{{{{var}}}}}", kwargs[var])
        return rendered

    def to_dto(self) -> dict[str, object]:
        """转换为对外 DTO（与 ai.contract.ts PromptTemplateDto 对齐）"""
        return {
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "template": self.template,
            "variables": list(self.variables),
            "riskLevel": self.risk_level,
            "requiresHumanReview": self.requires_human_review,
        }
