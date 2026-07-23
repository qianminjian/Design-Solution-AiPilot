# 施工图全流程 AI 平台

> V1 技术试点 — 建筑专业纵向闭环

覆盖前期策划、概念设计、方案设计、扩初设计、施工图设计、多专业综合校审、
发布交付与反馈变更的全流程 AI 辅助平台。首个业务场景为境外主创草图到方案深化。

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

## 目录结构

```
apps/web/          Next.js 前端（React 19 + Ant Design 5）
apps/bff/          NestJS BFF（API 聚合层）
packages/shared/   TypeScript 共享类型契约
services/core/     Java 核心业务服务（Spring Boot 3.4）
services/ai/       Python AI 服务（FastAPI）
docker/            Docker Compose 与 Dockerfile
design/            设计文档（BEACON.md + decisions/ + D00–D46 各章节）
.trae/rules/       Trae 项目规则（16 个规则文件）
.github/workflows/ CI 流水线（GitHub Actions）
```

## 前置条件

| 工具    | 版本要求        | 用途                   |
| ------- | --------------- | ---------------------- |
| JDK     | 21              | Java 核心服务          |
| Python  | >= 3.12, < 3.14 | AI 服务                |
| Node.js | >= 20           | Web 与 BFF             |
| pnpm    | >= 9.15.0       | Monorepo 依赖管理      |
| Docker  | 最新稳定版      | 本地基础设施与全栈启动 |
| Git     | >= 2.30         | 代码版本控制           |

## 快速启动

### 1. 克隆仓库

```bash
git clone <repo-url> Design-Solution-AiPilot
cd Design-Solution-AiPilot
```

### 2. 配置环境变量

```bash
cp .env.example .env

# 生成 JWT 密钥（至少 32 字符），替换 .env 中的 JWT_SECRET
openssl rand -base64 48
```

### 3. 启动基础设施（PostgreSQL + MinIO）

```bash
docker compose -f docker/compose.yml up -d
```

启动后访问：

- MinIO Console: http://localhost:9001（账号见 `.env`，默认 `minioadmin/minioadmin`）
- PostgreSQL: `localhost:5432`（默认库名 `design_platform`，用户 `platform`）

### 4. 安装依赖

```bash
pnpm install
```

### 5. 全栈启动（推荐）

```bash
docker compose -f docker/compose.yml up -d
```

将启动所有服务（postgres / minio / core / ai / bff / web），首次启动约 3–5 分钟。

### 6. 分服务开发启动

仅启动基础设施后，按需启动各应用服务（便于热重载调试）：

```bash
# Web + BFF（前端两层，pnpm workspace 联动）
pnpm dev

# Java 核心服务（新终端）
cd services/core && mvn spring-boot:run

# Python AI 服务（新终端）
cd services/ai && uvicorn src.main:app --reload
```

## 访问地址

| 服务             | 地址                  | 健康检查                              |
| ---------------- | --------------------- | ------------------------------------- |
| Web（前端）      | http://localhost:3000 | http://localhost:3000                 |
| BFF（API 聚合）  | http://localhost:3001 | http://localhost:3001/api/health/live |
| Core（核心业务） | http://localhost:8080 | http://localhost:8080/health/ready    |
| AI（AI 服务）    | http://localhost:8000 | http://localhost:8000/health/live     |
| PostgreSQL       | localhost:5432        | `pg_isready -h localhost -p 5432`     |
| MinIO Console    | http://localhost:9001 | —                                     |

## 开发命令

```bash
# ── TypeScript workspace（apps/web + apps/bff + packages/shared） ──
pnpm dev                  # 启动 web + bff（dev 模式）
pnpm build                # 全量构建
pnpm test                 # 运行 vitest 单元测试
pnpm -r lint              # 全量 lint
pnpm -r typecheck         # 全量类型检查
pnpm format               # Prettier 格式化

# ── Java 核心服务 ──
cd services/core
mvn spring-boot:run               # 启动 dev 服务
mvn test                          # 单元测试
mvn verify                        # 构建并测试（含集成测试，TestContainers）
mvn -B -ntp verify                # 非交互模式（CI 用）

# ── Python AI 服务 ──
cd services/ai
uvicorn src.main:app --reload     # 启动 dev 服务
pytest                           # 运行测试
pytest -q                        # 安静模式

# ── 全栈（Docker Compose V0） ──
docker compose -f docker/compose.yml up -d        # 后台启动
docker compose -f docker/compose.yml logs -f      # 查看日志
docker compose -f docker/compose.yml down          # 停止并清理
```

## CI 流水线

GitHub Actions 流水线定义在 `.github/workflows/ci.yml`，包含 5 个并行 Job：

| Job                  | 触发      | 内容                                       |
| -------------------- | --------- | ------------------------------------------ |
| Java 核心服务        | push / PR | Maven verify（含 TestContainers 集成测试） |
| Python AI 服务       | push / PR | pytest 单元测试                            |
| TypeScript workspace | push / PR | typecheck + lint + vitest 单测             |
| Docker 镜像构建校验  | 仅 push   | 校验各 Dockerfile 构建不破                 |
| 前端 E2E             | 仅 push   | Playwright（chromium）                     |

PR 失败即阻断合并；E2E 与镜像构建仅在 push 到 main 时执行，避免阻塞 PR。

## AI 开发环境

本项目支持 Trae、Claude Code 等 AI 开发工具：

| 文件           | 作用                                                | 工具        |
| -------------- | --------------------------------------------------- | ----------- |
| `.trae/rules/` | Trae 项目规则（16 个规则文件，含 YAML frontmatter） | Trae        |
| `AGENTS.md`    | 智能体行为指引（项目规则速查 + 设计文档索引）       | Trae / 通用 |

Trae 规则包含 5 个始终生效规则（项目概述、编码规范、设计约束、安全、测试）和 11 个按文件/场景触发的规则（前端、BFF、Java 后端、Python 后端、数据库、API 约定、可观测性、部署、Code Review、DevEx、Git 提交信息）。

## 文档

完整设计见：

- `design/INDEX.md` — 文档索引（D00–D46 章节索引表）
- `design/D00–D46*.md` — 47 个设计正文章节
- `design/BEACON.md` — 设计明灯（状态/阻塞/决策日志）
- `design/decisions/` — ADR 决策记录
- `.trae/rules/` — 项目规则（编码/测试/安全/部署等）

## License

MIT
