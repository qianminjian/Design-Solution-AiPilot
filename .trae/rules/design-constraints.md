---
alwaysApply: true
description: 设计文档权威性、AI 安全约束、业务决策冻结状态——确保实现与设计一致
---

# 设计文档与 AI 安全约束

## 设计文档体系

| 文件 | 角色 | 权威性 |
|------|------|--------|
| `design/INDEX.md` | 文档索引（D00–D46 章节索引表、命名规范、引用约定） | **权威** |
| `design/D00-D46*.md` | 唯一设计正文，按章节拆分为 47 个独立文件（原 `deep-research-report.md` 已归档至 `his_bak/`） | **权威** |
| `design/BEACON.md` | 设计明灯（状态/阻塞/决策日志，含决策 16 拆分记录） | **权威** |
| `design/decisions/` | ADR 决策记录 | **权威** |
| `design/r1-decision-package/` | R1 业务决策冻结包 | 非权威派生 |
| `design/r2-support-matrix/` | R2 工具版本资格矩阵 | 非权威派生 |
| `design/r2-contract-catalog/` | R2 契约稳定 ID 分配 | 非权威派生 |
| `design/r2-deployment-profile/` | R2 Hybrid-Site 部署实例化 | 非权威派生 |
| `design/audit-report/` | 深度审计报告 | 非权威派生 |

**冲突时回归唯一设计正文（D00–D46 各章节文件），见 `design/INDEX.md` 章节索引。**

## 设计约束红线

- 所有 AI 结果按风险等级进入人工复核。
- AI 不替代注册建筑师/工程师的专业审签和监管审批。
- 外部 AI Provider（EVAI/小库 AI/建筑学长）在 V1 维持 ManualHandoff，未获正式 API/许可不得自动接入。
- 设计文档与代码不一致时，默认代码缺失，不是设计过时。

## R1 业务决策冻结状态（2026-07-22）

以下 6 项决策已由具责主体冻结，实现时须遵守：

| 决策 | 冻结值 | BEACON |
|------|--------|--------|
| OD-01 地区/规范/语言/单位 | 通用英文境外包：ISO/EN 优先，英文，公制 SI，境外云 Region | 决策 10 |
| OD-02 建筑类型 | 中小型办公建筑（5–15 层，框架/框剪），排除超高层/医疗/实验室 | 决策 11 |
| OD-03 专业深度 | 建筑纵向闭环 + 结构/MEP 交换与协调；专项设计不纳入 V1 | 决策 12 |
| OD-04 工具版本 | Revit/AutoCAD 2022/2024、Rhino 7/8、SketchUp 2023/2024 Pro、ArchiCAD 26/27 | 决策 13 |
| OD-05 外部 AI | A+B 并行：通用 LLM API 先行 + W3 启动供应商接触 | 决策 14 |
| OD-06 部署画像 | Hybrid-Site：云控制面 + 客户站点 Windows Worker，RPO≤4h/RTO≤8h | 决策 15 |

## 实现与设计一致性

- 新增功能前先查阅设计文档对应章节（D01–D46）。
- 修改涉及契约（API/Event/File Schema）时，参考 `design/r2-contract-catalog/`。
- 修改涉及部署时，参考 `design/r2-deployment-profile/`。
- 修改涉及工具版本时，参考 `design/r2-support-matrix/`。
- 实现过程中发现设计缺陷，在 `design/BEACON.md` 记录后反馈，不直接修改设计正文。
