"""方案生成模块

面向业务的方案生成能力，集成 prompt 模板 + LLM 调用 + Guardrails + 人工复核输出。
对齐 V1 业务"境外主创草图到方案深化"（OD-03 决策 12）与 D09/D10/D26 设计阶段。

入口端点：POST /api/v1/solutions/generate
"""
