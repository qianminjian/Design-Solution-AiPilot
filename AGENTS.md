# AGENTS.md

> 施工图全流程 AI 平台 — AI 智能体行为指引

## 项目简介

施工图全流程 AI 辅助平台，V1 技术试点聚焦境外主创草图到方案深化。
TypeScript/Java/Python 多语言 Monorepo，条件性设计基线阶段。

## 关键文件

| 文件 | 作用 |
|------|------|
| `design/INDEX.md` | 文档索引（D00–D46 章节索引表、命名规范、引用约定） |
| `design/D00-D46*.md` | 唯一设计正文，按章节拆分为 47 个独立文件（见 INDEX.md） |
| `design/BEACON.md` | 设计明灯（状态/阻塞/决策日志，含决策 16 拆分记录） |
| `.trae/rules/` | Trae 项目规则（16 个规则文件） |
| `docker/compose.yml` | V0 全栈部署配置 |

> 引用约定：同文件内引用使用 §编号，跨文件引用使用 `@design/Dxx-xxx.md`（如 `@design/D05-全流程阶段-阶段门.md`）

## 核心命令

```bash
pnpm install                              # 安装依赖
pnpm dev                                  # 启动 TS 服务（web + bff）
cd services/core && ./mvnw spring-boot:run  # Java 核心服务
cd services/ai && uvicorn src.main:app     # Python AI 服务
docker compose -f docker/compose.yml up -d # 全栈启动
pnpm test                                 # TS 测试
```

## 行为约束

1. **设计文档权威**：实现前查阅 `design/INDEX.md` 索引定位对应 Dxx 章节文件；冲突时以设计正文为准（D00–D46 共 47 个文件）。
2. **AI 安全红线**：所有 AI 结果进入人工复核；AI 不替代注册建筑师/工程师的专业审签。
3. **决策冻结**：OD-01 至 OD-06 已于 2026-07-22 冻结（见 `design/BEACON.md` 决策 10–15），实现时须遵守。
4. **多语言 Monorepo**：前端/BFF 用 TypeScript（pnpm），核心服务用 Java（Maven），AI 服务用 Python（uv/pip）。
5. **中文交流**：所有回答和代码注释使用中文。

## Trae 规则

项目规则位于 `.trae/rules/`，共 16 个规则文件：5 个始终生效、10 个按文件路径匹配、1 个按场景匹配。

### 始终生效规则（alwaysApply: true）

| 规则文件 | 作用 |
|---------|------|
| `project-overview.md` | 项目定位、技术栈、Monorepo 结构、核心命令 |
| `coding-standards.md` | 通用编码规范、命名约定、核心工程原则、代码风格 |
| `design-constraints.md` | 设计文档权威性、AI 安全红线、R1 决策冻结状态 |
| `security.md` | 密钥管理、PII 分级、JWT/Cookie、AI 安全红线、CI 安全门禁 |
| `testing.md` | 多语言测试统一标准、覆盖率基线、Mock 规范、TDD |

### 按 glob 匹配规则

| 规则文件 | 匹配路径 | 作用 |
|---------|---------|------|
| `frontend.md` | `apps/web/**` | Next.js 15/React 19/Ant Design 5、WCAG 2.2 AA、i18n、性能 SLO |
| `bff.md` | `apps/bff/**` | NestJS 11、JWT/RBAC、限流与熔断、降级策略 |
| `backend-java.md` | `services/core/**` | Java 21/Spring Boot 3.4、构造器注入、Saga/Outbox、ArchUnit |
| `backend-python.md` | `services/ai/**` | Python 3.12/FastAPI、Prompt 结构化、RAG chunking、Guardrails |
| `database.md` | `services/core/**, apps/bff/**` | PostgreSQL 16、审计字段、Flyway 迁移、高风险变更流程 |
| `api-conventions.md` | `apps/bff/**, services/**` | 统一响应格式、双层状态码、业务错误码段、traceId 传播 |
| `observability.md` | `services/**, apps/bff/**` | 结构化日志、RED/USE 指标、OpenTelemetry、Sentry 集成 |
| `deployment.md` | `docker/**, .github/**, services/**` | 灰度发布、回滚、Hybrid-Site 约束、Docker 镜像规范 |
| `code-review.md` | `**` | PR Review 必查项、Conventional Comments、项目特化 Approval |
| `devex.md` | `.vscode/**, *.config.*, package.json, pyproject.toml, pom.xml` | VSCode 扩展、本地服务编排、Husky/lint-staged |

### 按场景匹配规则

| 规则文件 | 场景 | 作用 |
|---------|------|------|
| `git-commit-message.md` | `scene: git_message` | Conventional Commits 格式、分支命名、依赖更新策略 |

## 兼容性

- 本文件（`AGENTS.md`）同时被 Trae 和其他支持 AGENTS.md 的 IDE 读取。
