"""AI 服务入口 — Python 3.12 + FastAPI

按 D24 AI 能力目录设计，提供统一 Capability API：
- 文本生成、视觉识别、向量检索、规则检查
- 通过 LLM 网关的 Provider Adapter 路由到具体模型供应商
"""

from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="AI Service",
    description="施工图全流程 AI 平台 — AI 能力服务",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}
