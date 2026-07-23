# 施工图全流程 AI 平台

> V1 技术试点 — 建筑专业纵向闭环 · 条件性设计基线（Conditional Design Baseline）

建设覆盖前期策划、概念设计、方案设计、扩初设计、施工图设计、多专业综合校审、
发布交付与反馈变更的全流程 AI 辅助平台。首个业务场景为 **境外主创草图到方案深化**。

## 核心特性

- **境外英文优先**：V1 锁定通用英文境外、ISO/EN 优先、公制 SI（见 OD-01）。
- **中小型办公建筑**：5–15 层框架/框剪结构，聚焦建筑专业纵向闭环（见 OD-02/OD-03）。
- **多工具版本冻结**：Revit/AutoCAD 2022/2024、Rhino 7/8、SketchUp 2023/2024 Pro、ArchiCAD 26/27（见 OD-04）。
- **A+B 双轨 AI**：通用 LLM API 先行 + 建筑专业 AI 维持 ManualHandoff（见 OD-05）。
- **Hybrid-Site 部署**：云控制面 + 客户站点 Windows Worker，RPO≤4h / RTO≤8h（见 OD-06）。

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
design/            设计文档（BEACON.md + D00–D46 + 派生材料）
docs/              项目级文档（reports / api 等）
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

### 4. 安装依赖

```bash
pnpm install
```

### 5. 全栈启动

```bash
docker compose -f docker/compose.yml up -d
```

将启动所有服务（postgres / minio / core / ai / bff / web），首次启动约 3–5 分钟。

### 6. 分服务开发

```bash
# Web + BFF（前端两层，pnpm workspace 联动）
pnpm dev

# Java 核心服务
cd services/core && ./mvnw spring-boot:run

# Python AI 服务
cd services/ai && uvicorn src.main:app --reload
```

## 核心命令

```bash
# ── TypeScript workspace ──
pnpm dev                  # 启动 web + bff
pnpm build                # 全量构建
pnpm test                 # 运行 vitest 单元测试
pnpm -r lint              # 全量 lint
pnpm -r typecheck         # 全量类型检查
pnpm format               # Prettier 格式化

# ── Java 核心服务 ──
cd services/core
./mvnw spring-boot:run    # 启动 dev 服务
./mvnw test               # 单元测试
./mvnw verify             # 构建并测试（含集成测试，TestContainers）

# ── Python AI 服务 ──
cd services/ai
uvicorn src.main:app --reload   # 启动 dev 服务
pytest                            # 运行测试

# ── 全栈（Docker Compose V0） ──
docker compose -f docker/compose.yml up -d
```

详细命令见 [`.trae/rules/project-overview.md`](.trae/rules/project-overview.md)。

## R1 业务决策冻结（2026-07-22）

| 决策号 | 主题       | 冻结值                                                                         | 引用            |
| ------ | ---------- | ------------------------------------------------------------------------------ | --------------- |
| OD-01  | 地区包     | 通用英文境外，ISO/EN 优先，公制 SI，境外云 Region                              | 决策 10         |
| OD-02  | 建筑类型   | 中小型办公（5–15 层，框架/框剪），排除超高层和医疗/实验室                      | 决策 11         |
| OD-03  | 专业深度   | 建筑纵向闭环，结构/给排水/暖通/电气交换与协调，专项不纳入 V1                   | 决策 12         |
| OD-04  | 工具版本   | Revit/AutoCAD 2022/2024、Rhino 7/8、SketchUp 2023/2024 Pro、ArchiCAD 26/27    | 决策 13         |
| OD-05  | 外部 AI    | A+B 并行：通用 LLM API 先行，建筑专业 AI（EVAI/小库/建筑学长）维持 ManualHandoff | 决策 14         |
| OD-06  | 部署画像   | Hybrid-Site（云控制面 + 客户站点 Windows Worker），RPO≤4h / RTO≤8h              | 决策 15         |

> 详细背景与下游影响见 [`@design/BEACON.md`](design/BEACON.md#设计决策)。

## R2 技术基线实例化进度

| 任务块       | 状态     | 关键交付物                                                                  | 下一步     |
| ------------ | -------- | --------------------------------------------------------------------------- | ---------- |
| Support Matrix    | 🟢 已冻结 | 5 类工具 10 版本资格矩阵、Hybrid-Site Worker 部署参数、ExchangeRoundTripSample | W4–W7 资格验证 |
| Contract Catalog  | 🟡 部分冻结 | 48 个稳定 ID（30 API + 18 Event + 8 File Schema）已分配 | W4–W8 Consumer Test 验证 |
| Deployment Profile | 🟡 部分冻结 | OD-06 实例化为 Region/Cell/Cluster 参数、9 信任区流量矩阵、WorkerImageProfile、DR 分层 RPO/RTO | W4 厂商冻结、W5 金样、W8 DR 演练 |
| Trae 规则库   | 🟢 已冻结 | 16 个规则文件（5 始终 + 10 glob + 1 场景）                                  | 持续维护   |
| 实施代码骨架 | 🟢 已交付 | 4 服务全部可运行 + 单元测试通过                                              | R3 GoldenDataset |

> 状态图例：🟢 满足 / 🟡 部分满足 / 🔴 阻塞。详细 R2 完成度见 [`docs/reports/r2-completion-report.md`](docs/reports/r2-completion-report.md)。

## 测试覆盖度（截至 2026-07-23）

| 服务             | 测试类型            | 用例数 | 状态      |
| ---------------- | ------------------- | ------ | --------- |
| services/core    | 单元测试（Mock）    | 89     | 🟢 全通过 |
| services/core    | 集成测试（TestContainers） | 14 | 🟡 待 Docker 环境 |
| apps/bff         | 单元 + 集成测试     | 100    | 🟢 全通过 |
| services/ai      | 单元 + 集成测试     | 53     | 🟢 全通过 |
| apps/web         | TypeScript 类型检查 | —      | 🟢 通过   |
| apps/web         | E2E（Playwright）   | 2      | 🟡 CI 中  |

## AI 安全红线

- **设计文档权威**：唯一设计正文为 `design/D00–D46`，冲突时以设计正文为准，详见 [`.trae/rules/design-constraints.md`](.trae/rules/design-constraints.md)。
- **AI 人工复核**：所有 AI 输出按风险等级（低/中/高/极高）进入人工复核流程，AI 不替代注册建筑师/工程师的专业审签和监管审批。
- **外部 AI 隔离**：建筑专业 AI（EVAI/小库/建筑学长）在 V1 维持 ManualHandoff，V1 不自动接入。
- **数据处理合规**：LLM API 提交数据须不进入模型训练，跨境传输须满足法律评估、安全评估、用户同意和加密传输（见 [`.trae/rules/security.md`](.trae/rules/security.md)）。

## 文档导航

| 入口                                 | 用途                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| [`design/INDEX.md`](design/INDEX.md) | 文档索引（D00–D46 章节表、命名规范、引用约定）                                |
| [`design/BEACON.md`](design/BEACON.md) | 设计明灯（状态/阻塞/决策日志）                                              |
| [`design/D00–D46`](design/)          | 唯一设计正文，按章节拆分为 47 个独立文件                                     |
| [`design/decisions/`](design/decisions/) | ADR 决策记录                                                                |
| [`design/r2-*/`](design/)            | R2 派生材料：Support Matrix / Contract Catalog / Deployment Profile           |
| [`docs/reports/`](docs/reports/)     | 阶段报告（如 R2 完成报告）                                                    |
| [`docs/api/`](docs/api/)             | API 文档总览                                                                  |
| [`.trae/rules/`](.trae/rules/)       | Trae 项目规则（16 个规则文件：编码/安全/测试/部署等）                         |
| [`AGENTS.md`](AGENTS.md)              | AI 智能体行为指引（项目规则速查）                                             |

## 贡献指南

### 提交规范

- 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 格式（见 [`.trae/rules/git-commit-message.md`](.trae/rules/git-commit-message.md)）。
- 提交前由 Husky + lint-staged 自动执行 Prettier 格式化。
- 提交信息须包含 `type(scope): subject` 三段式结构，scope 限定在 `web / bff / core / ai / design / docs / rules` 等。

### 分支策略

- `main`：受保护分支，仅接受 PR 合入。
- `feature/<scope>-<desc>`：功能开发分支。
- `fix/<scope>-<desc>`：Bug 修复分支。
- `hotfix/<desc>`：生产紧急修复分支（须双签 Review）。

### PR 流程

1. 从 `main` 拉取最新代码后创建功能分支。
2. 提交前运行 `pnpm test` / `cd services/core && ./mvnw test` / `cd services/ai && pytest` 确保测试通过。
3. PR 大小建议 ≤ 500 行（含测试），强制 ≤ 1500 行。
4. Reviewer 必查项见 [`.trae/rules/code-review.md`](.trae/rules/code-review.md)，含 AI 人工复核路径、Hybrid-Site 特殊约束、契约变更须 2 人 Review 等。
5. CI 全部 5 个 Job 通过后（typecheck / lint / 单测 / Docker 构建 / E2E）方可合并。

### Trae 规则

- 始终生效：`project-overview` / `coding-standards` / `design-constraints` / `security` / `testing`。
- 按文件路径匹配：`frontend` / `bff` / `backend-java` / `backend-python` / `database` / `api-conventions` / `observability` / `deployment` / `code-review` / `devex`。
- 按场景匹配：`git-commit-message`（仅在生成提交信息时生效）。

## License

Private / 私有项目，保留所有权利。未经具责主体书面授权，禁止复制、修改、分发或商用。
