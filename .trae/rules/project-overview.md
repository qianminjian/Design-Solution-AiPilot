---
alwaysApply: true
description: 项目概述、技术栈、Monorepo 结构与核心命令——所有对话始终生效
---

# 施工图全流程 AI 平台 — 项目概述

## 项目定位

建设覆盖前期策划、概念设计、方案设计、扩初设计、施工图设计、多专业综合校审、
发布交付与反馈变更的全流程 AI 辅助平台。首个业务场景为境外主创草图到方案深化。

V1 技术试点聚焦：通用英文境外、中小型办公建筑、建筑专业纵向闭环、Revit 主链、Hybrid-Site 部署。

## 技术栈

| 层            | 技术                                                  | 语言       |
| ------------- | ----------------------------------------------------- | ---------- |
| Web 工作台    | Next.js 15 + React 19 + Ant Design 5 + TanStack Query | TypeScript |
| API BFF       | NestJS 11                                             | TypeScript |
| 核心业务服务  | Java 21 + Spring Boot 3.4                             | Java       |
| AI 服务       | Python 3.12 + FastAPI                                 | Python     |
| 数据库        | PostgreSQL 16 + Flyway                                | —          |
| 对象存储      | S3 API（MinIO 开发环境）                              | —          |
| 容器编排      | Docker Compose（V0）→ K8s（V2+）                      | —          |
| Monorepo 工具 | pnpm workspace + Turborepo                            | —          |

## 项目结构

```
apps/web/          Next.js 前端（React 19 + Ant Design 5）
apps/bff/          NestJS BFF（API 聚合层）
packages/shared/   TypeScript 共享类型
services/core/     Java 核心业务服务（Spring Boot 3.4）
services/ai/       Python AI 服务（FastAPI）
docker/            Docker Compose 与 Dockerfile
design/            设计文档（BEACON.md + decisions/ + 各阶段产物）
.trae/rules/       Trae 项目规则（本目录）
```

## 核心命令

```bash
# 安装依赖
pnpm install

# 开发（TypeScript 服务）
pnpm dev                    # 启动 web + bff

# Java 核心服务
cd services/core && ./mvnw spring-boot:run

# Python AI 服务
cd services/ai && uvicorn src.main:app --reload

# 全栈（Docker Compose V0）
docker compose -f docker/compose.yml up -d

# 测试
pnpm test                   # TypeScript 单元测试
cd services/core && ./mvnw test    # Java 测试
cd services/ai && pytest           # Python 测试

# 代码质量
pnpm lint                   # ESLint
pnpm typecheck              # TypeScript 类型检查
pnpm format                 # Prettier 格式化
```

## Node 版本要求

- Node.js >= 20
- pnpm >= 9.15.0（由 packageManager 字段锁定）
- Java 21
- Python >= 3.12, < 3.14

## 当前阶段

条件性设计基线（Conditional Design Baseline），尚未达到 Implementation Ready。
R1 业务决策已冻结（OD-01 至 OD-06），R2 技术基线实例化主体完成，R3 GoldenDataset 待启动。

## 远程验证环境（2026-08-01 起）

本项目已部署远程验证环境，所有验证类专题统一在远程服务器实施。

- **远程环境**：7 个服务（postgres、minio、chromadb、core、ai、bff、web）+ Nginx 反向代理
- **本地职责**：代码编辑、单元测试、lint、typecheck、git 操作
- **远程职责**：集成测试、E2E、性能、安全、Chaos、UAT 等所有验证类专题
- **资源策略**：远程资源充足，不限制内存，可并行 3-5 个子 agent
- **详细规则**：见 `.trae/rules/remote-verification.md`
