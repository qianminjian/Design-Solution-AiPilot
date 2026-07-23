"""Prompt 模板管理器

提供 get_template / list_templates 接口，集中管理所有 Prompt 模板。
V0 阶段从 BUILTIN_TEMPLATES 读取，后续可扩展为数据库 + 缓存。
"""

from src.prompts.models import PromptTemplate
from src.prompts.templates import BUILTIN_TEMPLATES


class PromptManager:
    """Prompt 模板管理器

    所有 Prompt 调用须通过本管理器获取，禁止直接引用模板常量（便于版本管理）。
    """

    def __init__(self, templates: dict[str, PromptTemplate] | None = None):
        """初始化

        Args:
            templates: 自定义模板注册表，默认使用 BUILTIN_TEMPLATES
        """
        self._templates = dict(templates) if templates else dict(BUILTIN_TEMPLATES)

    def get_template(self, name: str) -> PromptTemplate:
        """按名称获取模板

        Args:
            name: 模板唯一标识

        Returns:
            PromptTemplate 实例

        Raises:
            KeyError: 模板不存在
        """
        if name not in self._templates:
            raise KeyError(f"Prompt 模板不存在: {name}")
        return self._templates[name]

    def list_templates(self) -> list[PromptTemplate]:
        """列出所有模板"""
        return list(self._templates.values())

    def has_template(self, name: str) -> bool:
        """判断模板是否存在"""
        return name in self._templates


# 全局单例（线程安全：frozen dataclass + 只读 dict）
_default_manager: PromptManager | None = None


def get_prompt_manager() -> PromptManager:
    """获取全局 PromptManager 单例"""
    global _default_manager
    if _default_manager is None:
        _default_manager = PromptManager()
    return _default_manager
