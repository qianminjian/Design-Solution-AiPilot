"""Prompt 模板 API 路由

GET /api/v1/prompts — 列出所有可用模板
"""

from fastapi import APIRouter, Depends, HTTPException, status

from src.middleware.trace import get_trace_id
from src.prompts.manager import PromptManager, get_prompt_manager

router = APIRouter(prefix="/api/v1", tags=["prompts"])


@router.get("/prompts")
async def list_templates(
    manager: PromptManager = Depends(get_prompt_manager),
) -> dict[str, object]:
    """列出所有 Prompt 模板

    Returns:
        包含 templates 列表与 trace_id 的响应
    """
    templates = [t.to_dto() for t in manager.list_templates()]
    return {
        "templates": templates,
        "traceId": get_trace_id(),
    }


@router.get("/prompts/{name}")
async def get_template(
    name: str,
    manager: PromptManager = Depends(get_prompt_manager),
) -> dict[str, object]:
    """按名称获取单个 Prompt 模板"""
    try:
        template = manager.get_template(name)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt 模板不存在: {name}",
        )
    return {
        "template": template.to_dto(),
        "traceId": get_trace_id(),
    }
