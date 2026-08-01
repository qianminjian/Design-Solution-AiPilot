# 施工图全流程 AI 平台 — 系统测试指导手册

> 版本：V0 基线验证版 + Sprint V1.1 ~ V1.11.3 增量能力
> 编制日期：2026-08-01
> 适用对象：测试工程师、运维工程师、产品验收人员
> 文档定位：人读版测试指导，说明版本功能、使用方式、测试路径、依赖关系与配置要求

---

## 1. 版本概述

### 1.1 版本定位

本版本基于 D02 §D02.6.1 V0 基线验证版设计，并在 V0 全栈闭环基础上推进至 Sprint V1.11.3，已实现 SC-01 境外主创方案深化业务闭环和 SC-06 施工图版本发布的最小能力。

**版本边界（V0 已交付）：**

- 项目、团队、地区/语言/单位/模板配置
- 多格式资料上传、需求结构化、缺项、初稿小样和需求冻结
- 草图预处理、识别候选、CAD/初步模型/分析图/汇报材料任务编排
- 外部 AI 的 API、桌面插件或人工接力模式
- 中级校核、高级终审、交付清单、外链、反馈、两轮修改和重大变更记录
- 资产版本、AI 运行证据、基础权限、审计和项目指标

**版本边界（V1 增量已交付关键能力）：**

- Change 域变更请求全状态机（DRAFT→PENDING_APPROVAL→APPROVED→IN_PROGRESS→CLOSED）
- Operations 域 Worker/QueueTask 真实执行链路、死信队列、自动重试调度
- IRREVERSIBLE 动作双人审批（CANCEL/DELETE 等）+ stepUpToken 真实 JWT 二次认证
- AI 辅助影响分析（DeepSeek 集成）
- Connector 注册 + 异步健康检查
- IAM API Token 全生命周期管理（创建/查询/撤销/自动过期清理）
- UserPreferences 用户偏好持久化
- RAG 知识库管理（ChromaDB 集成）

**不在本版本交付：**

- 多专业施工图生产（结构/MEP 闭环）
- 正式规范规则包（仅保留契约和接口）
- 工程量、大型模型联邦
- Token 认证中间件（仅实现 CRUD + 自动过期清理，未实现 Bearer Token 认证流程）
- 远程 E2E 浏览器自动化（部分端到端已通过 Python 脚本验证）

### 1.2 系统架构总览

本平台采用 Monorepo + 微服务架构，由 7 个容器服务组成全栈：

```
┌──────────────────────────────────────────────────────────┐
│                    用户浏览器 (Next.js Web)               │
│                    http://localhost:3000                  │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP / Cookie (JWT)
┌────────────────────────▼─────────────────────────────────┐
│                  BFF 代理层 (NestJS 11)                   │
│                  http://localhost:3001                    │
│  - TraceId 传播 / Auth Cookie 注入 / 日志 / 指标          │
│  - 26 个代理 Controller 转发到 Core Service / AI Service  │
└──────────┬─────────────────────────┬─────────────────────┘
           │                          │
           │                          │
┌──────────▼──────────┐    ┌──────────▼────────────────────┐
│ Core Service (Java) │    │   AI Service (Python)          │
│ http://localhost:8080│   │   http://localhost:8001        │
│ - 45+ Controller     │   │   - LLM text-generation        │
│ - 13 个业务域        │   │   - RAG 检索 (ChromaDB)          │
│ - Spring Boot 3.4    │   │   - Embeddings (HuggingFace)    │
│ - JPA + Flyway       │   │   - FastAPI                     │
└──────────┬───────────┘   └──────┬─────────────────────────┘
           │                      │
           │                      │
┌──────────▼──────────────────────▼─────────────────────────┐
│              基础设施层                                    │
│  ┌────────────┐  ┌──────────┐  ┌──────────────────────┐    │
│  │ PostgreSQL │  │  MinIO  │  │      ChromaDB         │    │
│  │  :5432     │  │  :9000  │  │      :8000            │    │
│  │  业务数据   │  │  对象存储│  │  向量数据库（RAG）    │    │
│  │            │  │  :9001  │  │                       │    │
│  │            │  │  控制台  │  │                       │    │
│  └────────────┘  └──────────┘  └──────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

### 1.3 技术栈版本

| 层           | 技术                                          | 版本                    |
| ------------ | --------------------------------------------- | ----------------------- |
| Web 前端     | Next.js + React + Ant Design + TanStack Query | 15.1 / 19 / 5.22 / 5.62 |
| BFF 代理     | NestJS + @nestjs/axios                        | 11 / 最新               |
| Core Service | Java + Spring Boot                            | 21 / 3.4.0              |
| AI Service   | Python + FastAPI                              | 3.12 / 0.115+           |
| 数据库       | PostgreSQL                                    | 16-alpine               |
| 对象存储     | MinIO                                         | latest                  |
| 向量数据库   | ChromaDB                                      | latest                  |
| 容器编排     | Docker Compose                                | V0                      |
| Monorepo     | pnpm workspace + Turborepo                    | 9.15.0 / 2.4.0          |

---

## 2. 已实现功能清单

### 2.1 后端 Core Service（Java）— 13 个业务域 / 45+ Controller

| 域             | 主要 Controller                                                                                                                                        | 关键能力                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **Auth**       | AuthController                                                                                                                                         | 登录 / 登出 / 刷新 Token / step-up 二次认证（JWT HS256）          |
| **IAM**        | PrincipalController, OrganizationController, MembershipController, AccessGrantController, UserPreferencesController, ApiTokenController                | 用户/组织/成员/权限授予/用户偏好/API Token 全生命周期             |
| **Portfolio**  | ProjectController, StageController, GateController, BaselineController                                                                                 | 项目/阶段/阶段门/基线                                             |
| **CDE**        | DocumentController, VersionController, CheckoutController                                                                                              | 文档/版本/检出                                                    |
| **Workflow**   | WorkflowController                                                                                                                                     | 工作流任务编排                                                    |
| **Design**     | DesignOptionController                                                                                                                                 | 设计方案选项                                                      |
| **Analysis**   | AnalysisProblemController, AnalysisScenarioController, SimulationRunController, AnalysisResultController, SolverProfileController                      | 工程分析问题/场景/求解/结果                                       |
| **Change**     | ChangeRequestController, AffectedItemController, TaskPlanItemController, ClosureEvidenceController, ChangeOperationController                          | 变更请求/影响项/任务计划/关闭证据/变更操作（5 子域完整 DDD 五层） |
| **Compliance** | ComplianceRuleController, RuleSetController, ComplianceCheckController, FindingController                                                              | 合规规则/规则集/检查运行/发现项                                   |
| **TEVV**       | GoldenDatasetController, VerificationItemController                                                                                                    | 金标准数据集/验证项                                               |
| **Governance** | AuditLogController, DataAssetController, ReleaseController, BackupController, RestoreDrillController, EvidencePackageController, AccessGrantController | 审计日志/数据资产/发布/备份/恢复演练/证据包/访问授权              |
| **Operations** | ConnectorController, WorkerController, QueueTaskController, OperationsActionController, SloController, OperationsOverviewController                    | 连接器/Worker/队列任务/危险动作/SLO/运营总览                      |
| **AI**         | AiGenerationRecordController                                                                                                                           | AI 生成记录（用于影响分析等场景的 AI 调用审计）                   |

### 2.2 BFF 代理层（NestJS）— 26 个代理 Controller

完整覆盖 12 个域的 API 透传：

- **认证域**：AuthProxyController（含 Cookie 服务）
- **AI 域**：AiCapabilityProxyController / AiPromptProxyController / SolutionsProxyController / AiGenerationRecordProxyController / RagProxyController（RAG 知识库）
- **TEVV 域**：GoldenDatasetProxyController / VerificationItemProxyController
- **设计域**：DesignOptionProxyController
- **工作流域**：WorkflowProxyController
- **合规域**：ComplianceRuleProxyController / ComplianceCheckProxyController / RuleSetProxyController / FindingProxyController
- **CDE 域**：CdeDocumentProxyController / CdeVersionProxyController / CdeUploadController（文件上传）
- **IAM 域**：IamProxyController / OrganizationProxyController / MembershipProxyController / RoleBindingProxyController / AccessGrantProxyController / UserPreferencesProxyController / ApiTokenProxyController
- **治理域**：GovernanceProxyController（access-grants / releases / data-assets / audit-logs / evidence-packages / backups / restore-drills）
- **变更域**：ChangeProxyController（5 子域完整端点透传）
- **运营中心**：OperationsProxyController（workers / connectors / queue-tasks / actions / slo）
- **工程分析**：AnalysisProxyController
- **通用代理**：ProxyController（兜底 `@All("*splat")` 路由）
- **健康检查**：HealthController / HealthModule（独立 `/api/v1/health`）
- **指标**：MetricsController / MetricsModule（独立 `/api/v1/metrics`）

### 2.3 前端 Web（Next.js 15）— 37 个页面

| 模块          | 路由                                                                                                | 功能                                                           |
| ------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 认证          | `/login`                                                                                            | 用户登录（用户名密码）                                         |
| 首页          | `/dashboard`                                                                                        | 我的工作台                                                     |
| 项目管理      | `/projects` / `/projects/[id]`                                                                      | 项目列表 / 项目详情                                            |
| 项目子页      | `/projects/[id]/{requirements,coordination,documents,design-options,ai-generation,ai/runs/[runId]}` | 需求追踪/协调/文档/设计选项/AI 生成/AI 运行详情                |
| CDE 资产库    | `/documents` / `/viewer/[assetVersionId]`                                                           | 文档列表 / 资产版本查看器                                      |
| 阶段门        | `/stage-gate` / `/stage-gate/[projectId]`                                                           | 阶段门列表 / 项目阶段门详情                                    |
| 合规规则      | `/compliance-rules`                                                                                 | 合规规则管理                                                   |
| 合规检查      | `/compliance-checks` / `/compliance-results/[id]`                                                   | 检查运行列表 / 检查结果详情                                    |
| AI/Agent 复核 | `/review` / `/review/[projectId]`                                                                   | 复核中心 / 项目复核                                            |
| 变更管理      | `/changes` / `/changes/[changeId]`                                                                  | 变更列表 / 变更详情（含双人审批 UI）                           |
| 治理中心      | `/governance/{audit,data-governance,backup-restore,ai-release,access-review}`                       | 审计/数据治理/备份恢复/AI 发布/访问评审                        |
| 运营中心      | `/monitoring`                                                                                       | SLO/Worker/QueueTask/Connector 管理 + 待审批 Tab + 双人审批 UI |
| 工程分析      | `/analysis` / `/analysis/problems/[problemId]`                                                      | 分析问题列表 / 问题详情                                        |
| 金标准数据集  | `/golden-datasets` / `/golden-datasets/[id]`                                                        | 数据集列表 / 数据集详情                                        |
| 用户与设置    | `/members` / `/settings`                                                                            | 成员管理 / 用户设置（含 API Token 管理、用户偏好）             |
| 发布交付      | `/publications` / `/publications/new` / `/publications/[id]`                                        | 发布清单 / 新建发布 / 发布详情                                 |
| 设计选项详情  | `/projects/[id]/design-options/[optionId]`                                                          | 设计选项详情                                                   |

### 2.4 数据库迁移基线（Flyway）

V1 ~ V24 已稳定迁移，覆盖：

- V1~V5：基础 IAM / Portfolio / CDE / Workflow 表
- V6~V10：Design / Analysis / Compliance / TEVV 表
- V11~V15：Governance 域 7 张表
- V16~V17：Operations 域（Worker / QueueTask / Connector / SLO）
- V18：Change 域 5 张表
- V19：Worker 心跳字段
- V20：IAM 用户偏好表
- V21：QueueTask 死信队列字段（next_retry_at / retry_reason / dead_lettered_at / dead_letter_reason）+ 部分索引
- V22：OperationsAction 双人审批字段（reviewer1/reviewer2/dual_approval_status）+ 3 个索引
- V23：IAM 用户偏好持久化表
- V24：IAM API Token 表

---

## 3. 环境准备

### 3.1 主机要求

| 资源           | 最低要求                           | 推荐                        |
| -------------- | ---------------------------------- | --------------------------- |
| CPU            | 4 核                               | 8 核                        |
| 内存           | 8 GB                               | 16 GB                       |
| 磁盘           | 30 GB 可用空间                     | 50 GB SSD                   |
| 操作系统       | macOS 13+ / Linux（Ubuntu 22.04+） | macOS 14+ / Ubuntu 24.04    |
| Docker         | Docker Desktop 4.30+               | 最新稳定版                  |
| Docker Compose | v2.20+                             | 最新稳定版                  |
| Node.js        | ≥ 20                               | 20 LTS                      |
| pnpm           | ≥ 9.15.0                           | 9.15.0                      |
| Java JDK       | 21                                 | 21 LTS（OpenJDK / Temurin） |
| Python         | 3.12（≥ 3.12, < 3.14）             | 3.12                        |

> ⚠️ **内存管控红线**：本机 16GB 内存时，禁止并行启动超过 3 个子 Agent 加载大型源码；Docker Compose 全栈启动峰值约 2.5 GB，请确保主机可用内存 ≥ 4 GB。

### 3.2 第三方依赖要求

| 依赖                   | 用途                                | 版本要求                   | 配置项                                                                             |
| ---------------------- | ----------------------------------- | -------------------------- | ---------------------------------------------------------------------------------- |
| PostgreSQL             | 业务数据存储                        | 16-alpine                  | `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`                      |
| MinIO                  | 对象存储（设计文件、AI 模型、备份） | latest                     | `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET_NAME` / `S3_REGION` |
| ChromaDB               | 向量数据库（RAG 检索）              | latest                     | `CHROMADB_URL` / `CHROMADB_AUTH_CREDENTIALS`                                       |
| DeepSeek LLM           | AI 文本生成（影响分析、方案生成）   | API 兼容 OpenAI v1         | `LLM_API_KEY`（必填）/ `LLM_API_BASE` / `LLM_MODEL` / `LLM_TIMEOUT`                |
| HuggingFace Embeddings | 文本向量化（RAG 索引）              | sentence-transformers 2.7+ | `EMBEDDING_MODEL_PATH`（可选，绕过 HF Hub 网络限制）                               |
| HuggingFace 镜像       | 国内加速模型下载                    | hf-mirror.com              | `HF_ENDPOINT=https://hf-mirror.com`（国内网络必填）                                |

### 3.3 外部依赖配置要求

#### 3.3.1 LLM API Key 配置（必填）

DeepSeek API Key 用于 AI 辅助影响分析、方案生成等功能。未配置时 AI 调用失败但不阻断主流程（降级保留手动输入）。

```bash
# .env 中配置
LLM_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LLM_API_BASE=https://api.deepseek.com/v1
LLM_MODEL=deepseek-v4-pro
LLM_TIMEOUT=30
```

> 安全红线：LLM_API_KEY 严禁硬编码到源码 / 配置文件 / 注释 / 日志，必须通过环境变量读取。`.env` 必须在 `.gitignore` 中。

#### 3.3.2 JWT Secret 配置（必填）

JWT 签名密钥用于用户认证 Token 签发与校验。

```bash
# .env 中配置（生产环境必须 ≥ 32 字符随机字符串）
JWT_SECRET=your-strong-random-secret-at-least-32-chars-long
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d
```

> 安全红线：JWT_SECRET 缺失时应用启动失败；密钥 90 天轮换一次，轮换期间新旧密钥并行 7 天。

#### 3.3.3 stepUpToken Salt 配置（生产环境必填）

stepUpToken 二次认证使用 SHA-256 + 盐哈希存储，盐值必须通过环境变量注入。

```bash
# .env 中配置（生产环境必须 ≥ 32 字符随机字符串）
STEPUP_TOKEN_SALT=your-random-salt-at-least-32-chars
```

> 缺失时应用仍可启动（仅开发环境），生产环境强烈建议配置。

#### 3.3.4 Token 自动过期清理配置（可选）

Core Service 定时任务扫描并批量更新过期 API Token 状态。

```bash
# 默认值（无需配置即可生效）
TOKEN_CLEANUP_FIXED_DELAY_SECONDS=3600   # 调度间隔，默认 1 小时
TOKEN_CLEANUP_INITIAL_DELAY_SECONDS=60   # 首次执行延迟，默认 60s
TOKEN_CLEANUP_BATCH_SIZE=500             # 单批最大处理量，默认 500
```

#### 3.3.5 异步线程池配置（可选）

Core Service 异步任务（ConnectorHealthChecker / AsyncAuditWriter）使用显式 ThreadPoolTaskExecutor，避免 SimpleAsyncTaskExecutor 资源耗尽。

```bash
# 默认值（适配单机 16GB 内存场景）
ASYNC_CORE_POOL_SIZE=2
ASYNC_MAX_POOL_SIZE=4
ASYNC_QUEUE_CAPACITY=40
ASYNC_THREAD_NAME_PREFIX=async-
ASYNC_KEEP_ALIVE_SECONDS=60
```

> 默认值最多 44 个并发任务，远低于系统资源上限。生产环境可按需调整。

#### 3.3.6 CORS 配置

```bash
# 前端访问 BFF 的跨域配置
CORS_ORIGIN=http://localhost:3000
```

> 安全红线：禁止 `Access-Control-Allow-Origin: *`，必须指定白名单域名。

#### 3.3.7 AI Service 网络加速配置（国内环境必填）

HuggingFace 模型下载国内受限，必须配置镜像加速。

```bash
# AI Service 容器环境变量
HF_ENDPOINT=https://hf-mirror.com
EMBEDDING_MODEL_PATH=/opt/models/sentence-transformers  # 可选，本地模型路径
```

---

## 4. 部署与启动

### 4.1 部署架构

V0 采用单机 Docker Compose 部署，Hybrid-Site 部署画像的简化版（云控制面 + 客户站点合并部署）。生产画像见 D44 §D44.4 Hybrid-Site。

### 4.2 启动流程

#### 4.2.1 克隆代码并准备环境变量

```bash
git clone <repository-url>
cd Design-Solution-AiPilot

# 复制环境变量模板
cp docker/.env.example docker/.env

# 编辑 .env 填入真实值（必填项：JWT_SECRET、LLM_API_KEY）
vi docker/.env
```

#### 4.2.2 构建与启动全栈

```bash
# 进入 docker 目录
cd docker

# 启动所有服务（首次会构建镜像，约 10-15 分钟）
docker compose --env-file .env up -d

# 查看服务状态
docker compose ps

# 期望输出：7 个服务均为 healthy 状态
# Name                 Status
# aidesign-postgres    Up (healthy)
# aidesign-minio       Up (healthy)
# aidesign-chromadb    Up (healthy)
# aidesign-core        Up (healthy)
# aidesign-ai          Up (healthy)
# aidesign-bff         Up (healthy)
# aidesign-web         Up (healthy)
```

#### 4.2.3 验证启动成功

```bash
# 1. 验证 Flyway 数据库迁移
docker exec aidesign-postgres psql -U platform -d design_platform -c "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;"

# 期望输出：V1 ~ V24 全部 success=t

# 2. 验证 Core Service 健康
curl -s http://localhost:8080/actuator/health | jq .
# 期望：{"status":"UP","components":{...}}

# 3. 验证 BFF 代理
curl -s http://localhost:3001/api/v1/health | jq .
# 期望：{"status":"UP",...}

# 4. 验证 AI Service
curl -s http://localhost:8001/health/live | jq .
# 期望：{"status":"UP",...}

# 5. 验证 Web 前端
curl -sI http://localhost:3000 | head -1
# 期望：HTTP/1.1 200 OK

# 6. 验证 ChromaDB
curl -s http://localhost:8000/api/v2/heartbeat | jq .
# 期望：{"nanosecond heartbeat":...}

# 7. 验证 MinIO 控制台
# 浏览器访问 http://localhost:9001
# 用户名/密码：minioadmin / minioadmin
```

### 4.3 停止与清理

```bash
# 停止所有服务（保留数据卷）
docker compose down

# 停止并删除数据卷（⚠️ 清空所有数据，慎用）
docker compose down -v

# 仅重建某个服务镜像
docker compose build --no-cache core-service
docker compose up -d core-service
```

---

## 5. 系统测试路径

### 5.1 测试账号

默认创建的管理员账号（Flyway 初始化数据）：

| 字段    | 值                                     |
| ------- | -------------------------------------- |
| 用户名  | `admin`                                |
| 密码    | `admin123`                             |
| 租户 ID | `00000000-0000-0000-0000-000000000001` |

测试用其他账号（建议手动创建）：

| 用户 ID（UUID 后 12 位） | 角色       | 用途                   |
| ------------------------ | ---------- | ---------------------- |
| ...000000000010          | OPERATOR   | 发起 IRREVERSIBLE 动作 |
| ...000000000011          | REVIEWER_1 | 审批人 1               |
| ...000000000012          | REVIEWER_2 | 审批人 2               |

### 5.2 核心测试场景

#### 场景 1：用户登录与认证链路

**测试目标**：验证 JWT 认证、Cookie 注入、traceId 传播。

**测试步骤**：

1. 浏览器访问 `http://localhost:3000/login`
2. 输入用户名 `admin` / 密码 `admin123`
3. 点击登录，预期：
   - 跳转至 `/dashboard`
   - 浏览器 Cookie 中可见 `access_token`（httpOnly + Secure + SameSite=Strict）
   - BFF 日志输出 traceId
4. 刷新页面，预期：保持登录状态（refresh token 自动刷新）

**API 验证**：

```bash
# 登录获取 Token
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq .

# 期望响应：
# {
#   "code": 0,
#   "message": "success",
#   "data": {
#     "accessToken": "eyJ...",
#     "refreshToken": "...",
#     "tokenType": "Bearer",
#     "expiresIn": 900
#   },
#   "traceId": "..."
# }
```

#### 场景 2：stepUpToken 二次认证

**测试目标**：验证高风险动作的 step-up 认证流程（JWT HS256 签名，5 分钟有效期，含 purpose claim）。

**测试步骤**：

1. 用户已登录（持有 access_token）
2. 调用 `POST /api/v1/auth/step-up`，请求体：`{"currentPassword": "admin123"}`
3. 预期响应：返回 stepUpToken（JWT 格式，HS256 签名，5 分钟有效期）
4. 使用 stepUpToken 调用高风险端点（如变更批准）

**API 验证**：

```bash
# 申请 stepUpToken
curl -s -X POST http://localhost:3001/api/v1/auth/step-up \
  -H "Content-Type: application/json" \
  -H "Cookie: access_token=eyJ..." \
  -d '{"currentPassword":"admin123"}' | jq .

# 期望响应：data.stepUpToken 为 JWT 字符串
```

**安全红线验证**：

- 错误密码返回 `code=4011 BAD_CREDENTIALS`
- mock-token 字符串被拒绝（`code=4015 STEP_UP_TOKEN_INVALID`）
- stepUpToken 不能用于普通 API 认证（仅接受 type=step_up 的 JWT）

#### 场景 3：变更请求全状态机流转

**测试目标**：验证 Change 域状态机（DRAFT→PENDING_APPROVAL→APPROVED→IN_PROGRESS→CLOSED）+ 职责分离约束。

**测试步骤**：

1. **创建变更请求**：`POST /api/v1/changes`（用户 A 为发起人）
2. **提交影响评估**：`POST /api/v1/changes/{id}/submit-impact`
   - 预期：自动调用 AI 辅助影响分析，填充 `aiAssistedAnalysis` 字段
   - AI 调用失败时降级保留手动输入
3. **批准变更**（用户 B 为批准人，不可与发起人相同）：`POST /api/v1/changes/{id}/approve` + stepUpToken
4. **生成处置任务**：`POST /api/v1/changes/{id}/task-plans/:generate`
5. **验证关闭**（用户 C 为关闭人，不可与发起人/批准人相同）：`POST /api/v1/changes/{id}/verify-closure`

**职责分离验证**：

- 发起人尝试批准 → `code=4220 BUSINESS_RULE_VIOLATION`
- 批准人尝试关闭 → `code=4220 BUSINESS_RULE_VIOLATION`

#### 场景 4：IRREVERSIBLE 动作双人审批

**测试目标**：验证 Operations 域 IRREVERSIBLE 动作（CANCEL / DELETE）的双人审批流程。

**测试步骤**（以 DELETE Worker 为例）：

1. **注册 Worker**：`POST /api/v1/operations/workers/register`
2. **PAUSE Worker**（MEDIUM 风险）：`POST /api/v1/operations/action` actionType=PAUSE
   - 预期：Worker 状态 IDLE→STOPPED，无需 stepUpToken
3. **发起 DELETE**（IRREVERSIBLE 风险）：`POST /api/v1/operations/action` actionType=DELETE
   - 必填：stepUpToken + impactPreviewAcknowledged=true + reason
   - 预期：返回 `dualApprovalStatus=PENDING_REVIEW1` + `status=QUEUED`（不立即执行）
4. **审批人 1 批准**：`POST /api/v1/operations/action/{actionId}/review1/approve`
   - 必填：stepUpToken（审批人 1 的）+ comment（1-1000 字符）
   - 校验：审批人 1 ≠ 发起人，否则 `code=4220`
   - 预期：`dualApprovalStatus=PENDING_REVIEW2`
5. **等待 5 秒**（审批间隔校验，<5s 返回 `code=4220`）
6. **审批人 2 批准**：`POST /api/v1/operations/action/{actionId}/review2/approve`
   - 校验：审批人 2 ≠ 审批人 1 ≠ 发起人
   - 预期：`dualApprovalStatus=APPROVED` + `status=COMPLETED` + Worker 硬删除

**前端验证**：

- 运营中心 `/monitoring` 页面 → 待审批 Tab 可见待审批列表
- 点击"审批"按钮 → 弹出 DualApprovalModal
- 输入密码获取 stepUpToken → 填写审批意见 → 审批人 2 倒计时 ≥ 5s

#### 场景 5：Connector 注册 + 异步健康检查

**测试目标**：验证 Connector 幂等注册 + AI_PROVIDER 类型强制 ManualHandoff + 异步健康检查。

**测试步骤**：

1. **注册 LLM 连接器**：

   ```
   POST /api/v1/operations/connectors/register
   {
     "connectorCode": "deepseek-llm-001",
     "name": "DeepSeek LLM",
     "type": "LLM",
     "endpointUrl": "https://api.deepseek.com",
     "isManualHandoff": false
   }
   ```
   - 预期：`status=UNKNOWN` + `isManualHandoff=false`
   - 异步触发健康检查：HTTP GET `{endpointUrl}/v1/models`
   - 健康检查完成后（约 5s）：`status` 更新为 `CONNECTED` / `DISCONNECTED` / `DEGRADED`

2. **注册 AI_PROVIDER 类型**：

   ```
   POST /api/v1/operations/connectors/register
   {
     "connectorCode": "eviai-001",
     "type": "AI_PROVIDER",
     "isManualHandoff": false  # 即使传 false 也强制覆盖为 true
   }
   ```
   - 预期：`isManualHandoff=true`（OD-05 红线落实）
   - 跳过实际健康检查保持 `status=UNKNOWN`（V1 不主动调用建筑 AI Provider API）

3. **幂等注册**：相同 connectorCode 重复调用
   - 预期：更新 name/endpointUrl 等字段，保持 status / callCount1h 等监控指标不变

#### 场景 6：IAM API Token 全生命周期

**测试目标**：验证 API Token 创建、查询、撤销、自动过期清理。

**测试步骤**：

1. **创建 Token**：`POST /api/v1/iam/api-tokens`
   - 请求体：`{"name": "test-token", "expiresInDays": 7}`
   - 预期：返回 token 明文（仅本次返回，后续不可见）+ tokenHash + tokenSalt
2. **查询 Token 列表**：`GET /api/v1/iam/api-tokens`
   - 预期：返回 token 元信息（不含明文）
3. **撤销 Token**：`POST /api/v1/iam/api-tokens/{id}/revoke`
   - 预期：`status=revoked`
4. **自动过期清理**：等待 Token 过期 + 调度任务执行（默认 1 小时）
   - 预期：`status` 自动从 `active` 流转为 `expired`
   - 日志输出：`expiredCount + batchSize + now`（不打印 tokenHash 明文）

**安全红线验证**：

- Token 哈希存储（SHA-256 + 盐）
- 过期 Token 不可用于认证（部分索引 `WHERE status='active' AND expires_at < now` 自动排除）
- 审计日志脱敏

#### 场景 7：AI 辅助影响分析

**测试目标**：验证 AI Service 调用 DeepSeek 生成结构化影响分析。

**测试步骤**：

1. 配置 `LLM_API_KEY` 环境变量
2. 创建变更请求并提交影响评估
3. 预期：Core Service 调用 AI Service `/text-generation` 端点
4. 响应中 `aiAssistedAnalysis` 字段包含：
   - `content`：LLM 生成的 JSON 内容
   - `model`：使用的模型名
   - `requiresHumanReview=true`（强制人工复核）
   - `isAiAssisted=true`

**降级验证**：

- 断开 AI Service 或 LLM_API_KEY 失效
- 提交影响评估仍成功，但 `aiAssistedAnalysis` 为空 + `isAiAssisted=false`

#### 场景 8：文件上传链路

**测试目标**：验证 BFF 接收 multipart 文件 → 本地磁盘存储 → 转发 JSON 到 Core 创建文档/版本。

**测试步骤**：

1. 上传设计文件（.rvt / .3dm / .skp / .dwg / .rfa / .dxf）：
   ```bash
   curl -X POST http://localhost:3001/api/v1/cde/documents/upload \
     -H "Cookie: access_token=eyJ..." \
     -F "file=@test.rvt" \
     -F "documentName=测试文件"
   ```
2. 预期：返回 documentId + versionId
3. 通过 `/documents` 页面查看上传的文档
4. 通过 `/viewer/[assetVersionId]` 查看资产版本

**安全红线验证**：

- 文件类型白名单（仅允许设计文件格式）
- 服务端二次校验 MIME 与文件头魔数
- 路径穿越防护（`path.resolve` 校验在允许根目录内）

#### 场景 9：RAG 知识库管理

**测试目标**：验证 AI Service RAG 端点（ChromaDB 集成）。

**测试步骤**：

1. **创建知识库**：`POST /api/v1/ai/rag/knowledge-bases`
2. **添加文档**：`POST /api/v1/ai/rag/knowledge-bases/{id}/documents`
3. **检索问答**：`POST /api/v1/ai/rag/query`
   - 预期：返回相关文档片段 + 相似度分数

**字段格式验证**：API 同时兼容 camelCase 和 snake_case（响应包装为 `ApiResponse<T>` 格式）

#### 场景 10：Worker / QueueTask 执行链路

**测试目标**：验证 Operations 域真实执行链路 + 自动重试 + 死信队列。

**测试步骤**：

1. **注册 Worker**：`POST /api/v1/operations/workers/register`
2. **创建 QueueTask**：`POST /api/v1/operations/queue-tasks`
3. **Worker 领取任务**：`POST /api/v1/operations/workers/{id}/claim`
   - 预期：任务状态 QUEUED→RUNNING
4. **Worker 完成任务**：`POST /api/v1/operations/workers/{id}/complete`
   - 预期：任务状态 RUNNING→COMPLETED
5. **失败重试链路**：
   - Worker 上报失败 → 任务状态 RUNNING→RETRY_SCHEDULED
   - 等待 2^retryCount 秒 → WorkerScheduler 自动重置为 QUEUED
   - 达到 maxRetries 阈值 → 转入 DEAD_LETTER 状态
6. **死信队列管理**：
   - `GET /api/v1/operations/queue-tasks/dead-letter` 查询死信任务
   - `POST /api/v1/operations/queue-tasks/{id}/replay` 重放
   - `DELETE /api/v1/operations/queue-tasks/{id}` 硬删除

### 5.3 非功能性测试

#### 5.3.1 健康检查

| 端点                 | 方法 | 预期                                         |
| -------------------- | ---- | -------------------------------------------- |
| `/actuator/health`   | GET  | Core Service 返回 `{"status":"UP"}`          |
| `/api/v1/health`     | GET  | BFF 返回 `{"status":"UP"}`                   |
| `/health/live`       | GET  | AI Service 返回 `{"status":"UP"}`            |
| `/api/v2/heartbeat`  | GET  | ChromaDB 返回 `{"nanosecond heartbeat":...}` |
| `/minio/health/live` | GET  | MinIO 返回 200                               |
| `pg_isready`         | CMD  | PostgreSQL 返回 0                            |

#### 5.3.2 可观测性验证

- **结构化日志**：所有服务输出 JSON 格式日志（含 traceId / userId / tenantId 字段）
- **traceId 传播**：前端 → BFF → Core 全链路 traceId 一致
- **审计日志**：IRREVERSIBLE 动作记录 reviewer1/reviewer2/comment 字段
- **日志脱敏**：手机号 / 邮箱 / 身份证号 / 银行卡号 / 设计文件路径自动脱敏

#### 5.3.3 安全测试

| 测试项                       | 验证方法                                        |
| ---------------------------- | ----------------------------------------------- |
| JWT 失效                     | 使用过期 access_token 访问 → 返回 401           |
| refresh token 撤销           | 修改数据库 refresh_token → 刷新失败             |
| stepUpToken 不可用于普通 API | 使用 stepUpToken 调用 `/api/v1/projects` → 拒绝 |
| 跨租户隔离                   | 租户 A 的 access_token 访问租户 B 资源 → 403    |
| 文件类型校验                 | 上传 .exe → 拒绝                                |
| SQL 注入                     | 输入 `' OR 1=1 --` → 参数化查询拦截             |
| XSS                          | 富文本输入 `<script>` → DOMPurify 消毒          |

---

## 6. 测试用例执行清单

### 6.1 单元测试

```bash
# TypeScript 单元测试（apps/web + apps/bff + packages/shared）
pnpm test

# Java 单元测试（services/core）
cd services/core
/opt/homebrew/bin/mvn test  # 或 ./mvnw test

# Python 单元测试（services/ai）
cd services/ai
pytest --cov=src --cov-fail-under=80
```

**期望结果**：

- TypeScript：所有包测试通过，覆盖率 ≥ 80%
- Java：335 文件编译成功，单元测试 0 失败
- Python：覆盖率 ≥ 80%

### 6.2 集成测试

```bash
# Java 集成测试（*IT.java，使用 TestContainers）
cd services/core
/opt/homebrew/bin/mvn verify -DskipUnitTests=false
```

**期望结果**：Change 域 60 个集成测试用例 0 失败（Schema IT + Repository IT 17 + Service IT 29 + Controller API IT 14）

### 6.3 E2E 测试

```bash
# 前端 Playwright E2E
cd apps/web
pnpm e2e:install  # 首次安装浏览器
pnpm e2e
```

> V0 E2E 覆盖：登录 → 上传 → AI 生成 → 复核 → 发布核心流程，待 Playwright 用例补齐。

### 6.4 端到端验证脚本

项目提供 Python 端到端验证脚本（位于 `.scratch/` 目录）：

| 脚本                                  | 用途                                                 |
| ------------------------------------- | ---------------------------------------------------- |
| `verify-v19-dual-approval.py`         | IRREVERSIBLE 双人审批全流程（9 个场景）              |
| `verify-v1101-pause-resume-delete.py` | PAUSE / RESUME / DELETE 动作（6 大场景 23 个验证点） |
| `verify-v1101-connector-delete.py`    | Connector DELETE 全流程（7 大场景 22 个验证点）      |
| `verify-v1102-register-host.py`       | Connector 注册端点（7 大场景）                       |

**执行方式**：

```bash
cd .scratch
python3 verify-v19-dual-approval.py
```

---

## 7. 依赖关系说明

### 7.1 服务间依赖

```
postgres ────────► core-service ────────► bff ────────► web
                   ▲                     ▲
                   │                     │
minio ────────────┘                     │
                                        │
chromadb ─────────► ai-service ─────────┘
```

- **postgres**：无依赖，最先启动
- **minio**：无依赖，最先启动（minio-init 任务创建 bucket）
- **chromadb**：无依赖，最先启动
- **core-service**：依赖 postgres（healthy）+ minio-init（completed）
- **ai-service**：依赖 postgres（healthy）+ chromadb（healthy）+ minio-init（completed）
- **bff**：依赖 core-service（healthy）+ ai-service（healthy）
- **web**：依赖 bff（healthy）

### 7.2 外部依赖链

```
DeepSeek API ──► ai-service (text-generation)
                    │
                    ▼
HuggingFace ──► ai-service (embeddings)
                    │
                    ▼
               ChromaDB (向量存储)
```

- **DeepSeek API**：必须可达，超时 30s，失败降级不阻断主流程
- **HuggingFace**：国内网络需配置镜像 `HF_ENDPOINT=https://hf-mirror.com`
- **ChromaDB**：本地容器，无外部依赖

### 7.3 配置依赖矩阵

| 配置项                      | 必填     | 默认值                  | 影响范围   |
| --------------------------- | -------- | ----------------------- | ---------- |
| `JWT_SECRET`                | ✅       | 无（缺失启动失败）      | Core / BFF |
| `LLM_API_KEY`               | ⚠️       | 空（AI 功能降级）       | AI Service |
| `DB_PASSWORD`               | ✅       | `platform_dev`          | Core / AI  |
| `S3_SECRET_KEY`             | ✅       | `minioadmin`            | Core / AI  |
| `CHROMADB_AUTH_CREDENTIALS` | ✅       | `chroma:chromasecret`   | AI         |
| `STEPUP_TOKEN_SALT`         | 生产必填 | 空                      | Core       |
| `CORS_ORIGIN`               | ✅       | `http://localhost:3000` | BFF        |
| `HF_ENDPOINT`               | 国内必填 | 空                      | AI         |

---

## 8. 常见问题排查

### 8.1 容器启动失败

**问题**：core-service 容器反复重启

**排查**：

```bash
# 查看日志
docker logs aidesign-core --tail 200

# 常见原因
# 1. JWT_SECRET 缺失 → 配置 .env
# 2. postgres 未就绪 → 检查 healthcheck
# 3. Flyway 迁移失败 → 检查 V1~V24 迁移日志
docker exec aidesign-postgres psql -U platform -d design_platform -c "SELECT * FROM flyway_schema_history WHERE success=false;"
```

### 8.2 AI 调用失败

**问题**：AI 辅助影响分析未生成内容

**排查**：

```bash
# 1. 检查 LLM_API_KEY 配置
docker exec aidesign-ai env | grep LLM

# 2. 测试 DeepSeek API 连通性
docker exec aidesign-ai curl -s -X POST $LLM_API_BASE/chat/completions \
  -H "Authorization: Bearer $LLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-pro","messages":[{"role":"user","content":"test"}]}'

# 3. 查看 AI Service 日志
docker logs aidesign-ai --tail 100 | grep -i error
```

**降级行为**：AI 调用失败时，业务流程不阻断，`aiAssistedAnalysis` 字段为空，`isAiAssisted=false`。

### 8.3 ChromaDB 健康检查失败

**问题**：chromadb 容器 healthcheck 显示 unhealthy

**原因**：chromadb 镜像不含 curl，原 healthcheck 失败。

**解决方案**：已修复 healthcheck 命令使用 `apt-get install curl` 临时安装。如果仍失败，可改为：

```yaml
healthcheck:
  test:
    [
      "CMD-SHELL",
      "bash -c 'exec 3<>/dev/tcp/localhost/8000 && echo -e \"GET /api/v2/heartbeat HTTP/1.1\r\nHost: localhost\r\n\r\n\" >&3 && cat <&3 | head -1 | grep -q 200'",
    ]
```

### 8.4 HuggingFace 模型下载超时

**问题**：AI Service 启动时加载 Embeddings 模型超时

**解决方案**：

1. 配置国内镜像：`HF_ENDPOINT=https://hf-mirror.com`
2. 或预下载模型到本地，配置 `EMBEDDING_MODEL_PATH=/opt/models/sentence-transformers`
3. 挂载到 AI Service 容器：`-v /path/to/models:/opt/models`

### 8.5 内存不足导致系统重启

**问题**：macOS `vm-compressor-space-shortage` 错误，系统强制重启

**原因**：16GB 内存主机并行启动多个子 Agent 或大型构建。

**解决方案**：

1. 限制并行子 Agent 数量 ≤ 3
2. 单次 Read 文件 ≤ 3 个
3. 使用串行模式执行任务
4. 监控内存：`vm_stat | grep free`
5. 可用内存 < 4GB 时暂停所有 Agent 启动

### 8.6 数据库迁移失败

**问题**：Flyway 迁移报错 `Validate failed: Migration checksum mismatch`

**解决方案**：

```bash
# 1. 查看迁移历史
docker exec aidesign-postgres psql -U platform -d design_platform -c "SELECT * FROM flyway_schema_history;"

# 2. 修复方式（开发环境）
docker exec aidesign-postgres psql -U platform -d design_platform -c "DELETE FROM flyway_schema_history WHERE success=false;"
# 然后重启 core-service
```

---

## 9. 测试通过标准

### 9.1 功能性测试通过标准

- ✅ 7 个容器服务全部 healthy
- ✅ Flyway V1~V24 全部迁移成功
- ✅ 用户登录 + Cookie 认证链路通
- ✅ 12 个业务域 API 端到端可用（IAM / CDE / Portfolio / Workflow / TEVV / Compliance / Governance / Change / Operations / Analysis / AI / Auth）
- ✅ stepUpToken 真实 JWT 校验通过
- ✅ IRREVERSIBLE 动作双人审批全流程通过
- ✅ Connector 注册 + 异步健康检查通过
- ✅ AI 辅助影响分析 LLM 集成通过
- ✅ Worker / QueueTask / 死信队列全状态机通过
- ✅ 前端 24+ 页面 200 OK

### 9.2 非功能性测试通过标准

- ✅ 单元测试覆盖率 ≥ 80%
- ✅ Java 集成测试 0 失败
- ✅ traceId 全链路传播一致
- ✅ 审计日志结构化输出（JSON 格式）
- ✅ 敏感信息日志脱敏（手机号 / 邮箱 / 文件路径等）
- ✅ JWT 失效后返回 401
- ✅ 跨租户隔离生效
- ✅ 文件类型白名单校验生效

### 9.3 安全红线落实标准

- ✅ 所有 AI 输出标记为"AI 辅助"，强制 `requiresHumanReview=true`
- ✅ IRREVERSIBLE 动作双人审批 + 三人不同原则 + 审批间隔 ≥ 5 秒
- ✅ stepUpToken 真实 JWT HS256 校验（不可伪造）
- ✅ AI_PROVIDER 类型强制 `isManualHandoff=true`（OD-05 红线）
- ✅ Token 哈希存储（SHA-256 + 盐）
- ✅ 过期 Token 自动清理（90 天轮换对齐）
- ✅ 密钥通过环境变量读取（无硬编码）
- ✅ 数据库参数化查询（防 SQL 注入）
- ✅ 路径穿越防护（`path.resolve` 校验）
- ✅ CORS 白名单（非 `*`）

---

## 10. 版本功能边界与已知差距

### 10.1 V0 已知差距（V1.12+ 推进）

| 差距项                                             | 影响                                | 临时方案                      |
| -------------------------------------------------- | ----------------------------------- | ----------------------------- |
| Token 认证中间件未实现                             | API Token 无法用于 Bearer 认证      | 仅使用 Cookie + JWT 认证      |
| 远程 E2E 浏览器自动化未覆盖                        | 前端 UI 端到端验证仅本地            | 使用 Python 脚本验证后端 API  |
| 设计工具类型（REVIT/RHINO/SKETCHUP）健康检查未联动 | 设计工具 Connector 状态保持 UNKNOWN | V1.11+ 接入 Worker 心跳后联动 |
| 前端 Connector 列表健康状态实时刷新未实现          | 健康检查完成后需手动刷新页面        | 30s staleTime 自动刷新        |
| ShedLock 多实例调度未引入                          | 多实例部署时调度任务可能重复        | 单实例部署避免重复            |
| 合规规则种子数据未导入                             | 合规检查页面空状态                  | 手动创建规则                  |

### 10.2 V1+ 待实现能力

- 多专业施工图生产（结构/MEP 闭环）
- 正式规范规则包
- 工程量、大型模型联邦
- 多租户 SSO / SCIM
- 多地区规则包和数据驻留
- 专项专业和外部生态接口

---

## 附录 A：环境变量完整清单

### A.1 数据库（PostgreSQL）

| 变量          | 默认值            | 说明             |
| ------------- | ----------------- | ---------------- |
| `DB_HOST`     | `postgres`        | 数据库主机       |
| `DB_PORT`     | `5432`            | 数据库端口       |
| `DB_NAME`     | `design_platform` | 数据库名         |
| `DB_USER`     | `platform`        | 用户名           |
| `DB_PASSWORD` | `platform_dev`    | 密码             |
| `DB_POOL_MAX` | `20`              | 连接池最大连接数 |
| `DB_POOL_MIN` | `5`               | 连接池最小连接数 |

### A.2 对象存储（MinIO）

| 变量             | 默认值              | 说明       |
| ---------------- | ------------------- | ---------- |
| `S3_ENDPOINT`    | `http://minio:9000` | MinIO 端点 |
| `S3_ACCESS_KEY`  | `minioadmin`        | 访问密钥   |
| `S3_SECRET_KEY`  | `minioadmin`        | 秘密密钥   |
| `S3_BUCKET_NAME` | `platform-data`     | 存储桶名   |
| `S3_REGION`      | `us-east-1`         | 区域       |

### A.3 向量数据库（ChromaDB）

| 变量                        | 默认值                 | 说明          |
| --------------------------- | ---------------------- | ------------- |
| `CHROMADB_URL`              | `http://chromadb:8000` | ChromaDB 端点 |
| `CHROMADB_AUTH_CREDENTIALS` | `chroma:chromasecret`  | 认证凭证      |

### A.4 AI Service

| 变量                   | 默认值                      | 说明                         |
| ---------------------- | --------------------------- | ---------------------------- |
| `LLM_API_KEY`          | （空）                      | LLM API 密钥（必填）         |
| `LLM_API_BASE`         | `https://api.openai.com/v1` | LLM API 基础 URL             |
| `LLM_MODEL`            | `gpt-4o`                    | 默认模型                     |
| `LLM_TIMEOUT`          | `30`                        | 调用超时（秒）               |
| `AI_SERVICE_PORT`      | `8001`                      | AI 服务端口                  |
| `DB_POOL_SIZE`         | `10`                        | 数据库连接池大小             |
| `DB_MAX_OVERFLOW`      | `20`                        | 连接池溢出上限               |
| `CORS_ORIGINS`         | `["http://localhost:3000"]` | CORS 白名单                  |
| `HF_ENDPOINT`          | （空）                      | HuggingFace 镜像（国内必填） |
| `EMBEDDING_MODEL_PATH` | （空）                      | 本地 Embeddings 模型路径     |

### A.5 BFF

| 变量               | 默认值                     | 说明             |
| ------------------ | -------------------------- | ---------------- |
| `NODE_ENV`         | `development`              | Node 环境        |
| `PORT`             | `3001`                     | BFF 端口         |
| `CORE_SERVICE_URL` | `http://core-service:8080` | Core Service URL |
| `AI_SERVICE_URL`   | `http://ai-service:8001`   | AI Service URL   |
| `CORS_ORIGIN`      | `http://localhost:3000`    | CORS 白名单      |

### A.6 JWT 与认证

| 变量                           | 默认值   | 说明                           |
| ------------------------------ | -------- | ------------------------------ |
| `JWT_SECRET`                   | （必填） | JWT 签名密钥（≥ 32 字符）      |
| `JWT_ACCESS_TOKEN_EXPIRES_IN`  | `15m`    | access token 有效期            |
| `JWT_REFRESH_TOKEN_EXPIRES_IN` | `7d`     | refresh token 有效期           |
| `STEPUP_TOKEN_SALT`            | （空）   | stepUpToken 哈希盐（生产必填） |

### A.7 Core Service

| 变量                     | 默认值                  | 说明              |
| ------------------------ | ----------------------- | ----------------- |
| `SPRING_PROFILES_ACTIVE` | `docker`                | Spring Profile    |
| `LOG_LEVEL`              | `info`                  | 日志级别          |
| `AI_SERVICE_URL`         | `http://localhost:8000` | AI Service URL    |
| `AI_TIMEOUT_SECONDS`     | `120`                   | AI 调用超时（秒） |
| `AI_RETRY_ATTEMPTS`      | `1`                     | AI 调用重试次数   |

### A.8 Token 自动过期清理

| 变量                                  | 默认值 | 说明               |
| ------------------------------------- | ------ | ------------------ |
| `TOKEN_CLEANUP_FIXED_DELAY_SECONDS`   | `3600` | 调度间隔（秒）     |
| `TOKEN_CLEANUP_INITIAL_DELAY_SECONDS` | `60`   | 首次执行延迟（秒） |
| `TOKEN_CLEANUP_BATCH_SIZE`            | `500`  | 单批最大处理量     |

### A.9 异步线程池

| 变量                       | 默认值   | 说明             |
| -------------------------- | -------- | ---------------- |
| `ASYNC_CORE_POOL_SIZE`     | `2`      | 核心线程数       |
| `ASYNC_MAX_POOL_SIZE`      | `4`      | 最大线程数       |
| `ASYNC_QUEUE_CAPACITY`     | `40`     | 队列容量         |
| `ASYNC_THREAD_NAME_PREFIX` | `async-` | 线程名前缀       |
| `ASYNC_KEEP_ALIVE_SECONDS` | `60`     | 空闲线程存活秒数 |

---

## 附录 B：API 端点快速索引

### B.1 认证 API

| 端点                   | 方法 | 用途             |
| ---------------------- | ---- | ---------------- |
| `/api/v1/auth/login`   | POST | 用户登录         |
| `/api/v1/auth/logout`  | POST | 用户登出         |
| `/api/v1/auth/refresh` | POST | 刷新 Token       |
| `/api/v1/auth/step-up` | POST | 申请 stepUpToken |

### B.2 IAM API

| 端点                                 | 方法     | 用途           |
| ------------------------------------ | -------- | -------------- |
| `/api/v1/iam/principals`             | GET/POST | 用户主体管理   |
| `/api/v1/iam/organizations`          | GET/POST | 组织管理       |
| `/api/v1/iam/memberships`            | GET/POST | 成员关系管理   |
| `/api/v1/iam/access-grants`          | GET/POST | 权限授予       |
| `/api/v1/iam/user-preferences`       | GET/PUT  | 用户偏好       |
| `/api/v1/iam/api-tokens`             | GET/POST | API Token 管理 |
| `/api/v1/iam/api-tokens/{id}/revoke` | POST     | 撤销 Token     |

### B.3 Change 域 API

| 端点                                        | 方法     | 用途                         |
| ------------------------------------------- | -------- | ---------------------------- |
| `/api/v1/changes`                           | GET/POST | 变更请求管理                 |
| `/api/v1/changes/{id}`                      | GET      | 变更详情                     |
| `/api/v1/changes/{id}/submit-impact`        | POST     | 提交影响评估（触发 AI 辅助） |
| `/api/v1/changes/{id}/approve`              | POST     | 批准变更（需 stepUpToken）   |
| `/api/v1/changes/{id}/reject`               | POST     | 拒绝变更                     |
| `/api/v1/changes/{id}/recall`               | POST     | 撤回变更                     |
| `/api/v1/changes/{id}/task-plans/:generate` | POST     | 生成处置任务                 |
| `/api/v1/changes/{id}/verify-closure`       | POST     | 验证关闭                     |
| `/api/v1/changes/{id}/affected-items`       | GET/POST | 影响项                       |
| `/api/v1/changes/{id}/task-plans`           | GET/POST | 任务计划                     |
| `/api/v1/changes/{id}/closure-evidences`    | GET/POST | 关闭证据                     |

### B.4 Operations 域 API

| 端点                                             | 方法     | 用途                                                              |
| ------------------------------------------------ | -------- | ----------------------------------------------------------------- |
| `/api/v1/operations/workers/register`            | POST     | 注册 Worker                                                       |
| `/api/v1/operations/workers`                     | GET      | Worker 列表                                                       |
| `/api/v1/operations/workers/{id}`                | GET      | Worker 详情                                                       |
| `/api/v1/operations/workers/{id}/claim`          | POST     | 领取任务                                                          |
| `/api/v1/operations/workers/{id}/complete`       | POST     | 完成任务                                                          |
| `/api/v1/operations/workers/{id}/heartbeat`      | POST     | 心跳上报                                                          |
| `/api/v1/operations/connectors/register`         | POST     | 注册 Connector                                                    |
| `/api/v1/operations/connectors`                  | GET      | Connector 列表                                                    |
| `/api/v1/operations/queue-tasks`                 | GET/POST | 队列任务管理                                                      |
| `/api/v1/operations/queue-tasks/dead-letter`     | GET      | 死信队列                                                          |
| `/api/v1/operations/queue-tasks/{id}/replay`     | POST     | 重放死信                                                          |
| `/api/v1/operations/action`                      | POST     | 发起动作（PAUSE/RESUME/DELETE/CANCEL/ISOLATE/FAILOVER/RECONCILE） |
| `/api/v1/operations/action/pending`              | GET      | 待审批列表                                                        |
| `/api/v1/operations/action/{id}`                 | GET      | 动作详情                                                          |
| `/api/v1/operations/action/{id}/review1/approve` | POST     | 审批人 1 批准                                                     |
| `/api/v1/operations/action/{id}/review1/reject`  | POST     | 审批人 1 拒绝                                                     |
| `/api/v1/operations/action/{id}/review2/approve` | POST     | 审批人 2 批准                                                     |
| `/api/v1/operations/action/{id}/review2/reject`  | POST     | 审批人 2 拒绝                                                     |
| `/api/v1/operations/slo`                         | GET      | SLO 指标                                                          |
| `/api/v1/operations/overview`                    | GET      | 运营总览                                                          |

### B.5 CDE 域 API

| 端点                                  | 方法     | 用途                  |
| ------------------------------------- | -------- | --------------------- |
| `/api/v1/cde/documents`               | GET/POST | 文档管理              |
| `/api/v1/cde/documents/upload`        | POST     | 文件上传（multipart） |
| `/api/v1/cde/documents/{id}/versions` | GET/POST | 版本管理              |
| `/api/v1/cde/checkout`                | POST     | 检出                  |

### B.6 Governance 域 API

| 端点                                   | 方法     | 用途     |
| -------------------------------------- | -------- | -------- |
| `/api/v1/governance/audit-logs`        | GET      | 审计日志 |
| `/api/v1/governance/data-assets`       | GET/POST | 数据资产 |
| `/api/v1/governance/releases`          | GET/POST | 发布管理 |
| `/api/v1/governance/backups`           | GET/POST | 备份管理 |
| `/api/v1/governance/restore-drills`    | GET/POST | 恢复演练 |
| `/api/v1/governance/evidence-packages` | GET/POST | 证据包   |

### B.7 AI 域 API

| 端点                                            | 方法     | 用途        |
| ----------------------------------------------- | -------- | ----------- |
| `/api/v1/ai/capabilities`                       | GET      | AI 能力目录 |
| `/api/v1/ai/prompts`                            | POST     | AI 提示词   |
| `/api/v1/ai/solutions`                          | POST     | 方案生成    |
| `/api/v1/ai/generation-records`                 | GET      | AI 生成记录 |
| `/api/v1/ai/rag/knowledge-bases`                | GET/POST | RAG 知识库  |
| `/api/v1/ai/rag/knowledge-bases/{id}/documents` | POST     | 添加文档    |
| `/api/v1/ai/rag/query`                          | POST     | RAG 检索    |

### B.8 健康与指标

| 端点               | 方法 | 用途              |
| ------------------ | ---- | ----------------- |
| `/actuator/health` | GET  | Core Service 健康 |
| `/api/v1/health`   | GET  | BFF 健康          |
| `/health/live`     | GET  | AI Service 健康   |
| `/api/v1/metrics`  | GET  | BFF 指标          |

---

## 附录 C：参考资料

### C.1 设计文档

- `design/INDEX.md` — 设计文档索引
- `design/D00-D46*.md` — 唯一设计正文（47 个章节文件）
- `design/BEACON.md` — 设计明灯（状态 / 阻塞 / 决策日志 / 设计演进日志）
- `design/decisions/` — ADR 决策记录

### C.2 项目规则

- `.trae/rules/project-overview.md` — 项目概述与技术栈
- `.trae/rules/coding-standards.md` — 通用编码规范
- `.trae/rules/design-constraints.md` — 设计文档与 AI 安全约束
- `.trae/rules/security.md` — 安全与隐私核心规则
- `.trae/rules/testing.md` — 多语言测试统一规范
- `.trae/rules/agent-memory-management.md` — 子 Agent 内存管控规则

### C.3 部署相关

- `docker/compose.yml` — Docker Compose 配置
- `docker/.env.example` — 环境变量模板
- `apps/bff/Dockerfile` — BFF 镜像构建
- `apps/web/Dockerfile` — Web 镜像构建
- `services/core/Dockerfile` — Core Service 镜像构建
- `services/ai/Dockerfile` — AI Service 镜像构建

### C.4 测试相关

- `apps/web/tests/` — 前端测试目录
- `apps/bff/tests/` — BFF 测试目录
- `services/core/src/test/java/` — Java 测试目录
- `services/ai/tests/` — Python 测试目录
- `.scratch/verify-*.py` — 端到端验证脚本

---

**文档版本**：V1.0
**最后更新**：2026-08-01
**维护者**：开发团队
**反馈渠道**：提交 issue 至项目仓库
