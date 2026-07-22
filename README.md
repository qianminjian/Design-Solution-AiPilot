# 施工图全流程 AI 平台

> V1 技术试点 — 建筑专业纵向闭环

覆盖前期策划、概念设计、方案设计、扩初设计、施工图设计、多专业综合校审、
发布交付与反馈变更的全流程 AI 辅助平台。

## 技术栈

| 层 | 技术 |
|----|------|
| Web 工作台 | Next.js + React + TypeScript + Ant Design |
| API BFF | NestJS |
| 核心业务 | Java 21 + Spring Boot 3.4 |
| AI 服务 | Python 3.12 + FastAPI |
| 数据库 | PostgreSQL 16 |
| 基础设施 | Docker Compose（V0） |

## 快速开始

```bash
pnpm install
pnpm dev
```

## AI 开发环境

本项目支持 Trae、Claude Code 等 AI 开发工具：

| 文件 | 作用 | 工具 |
|------|------|------|
| `.trae/rules/` | Trae 项目规则（8 个规则文件，含 YAML frontmatter） | Trae |
| `AGENTS.md` | 轻量级智能体行为指引 | Trae / 通用 |
| `CLAUDE.md` | Claude Code 项目配置（Trae 兼容读取） | Claude Code / Trae |

Trae 规则包含 3 个始终生效规则（项目概述、编码规范、设计约束）和 5 个按文件/场景触发的规则（前端、BFF、Java 后端、Python 后端、Git 提交信息）。

## 文档

完整设计见 `design/INDEX.md`（章节索引）和 `design/D00–D46*.md`（47 个章节文件）以及 `design/BEACON.md`（设计明灯）。

## License

MIT
