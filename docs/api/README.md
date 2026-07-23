# AiPilot API 文档总览

> 施工图全流程 AI 平台 V0 关键 API 契约文档
>
> 权威源：`@design/D35-API-事件契约.md` + `@design/r2-contract-catalog/`
>
> 创建：2026-07-23 | 版本：v1.0.0

## 目录结构

```
docs/api/
├── README.md          # 本文件：API 文档总览
├── common.yaml        # 通用 Schema、Header、Parameter、Response（其他域通过 $ref 引用）
├── iam.yaml           # 身份与多租户（Auth + Principal + Organization + Membership + Grant）
├── portfolio.yaml     # 项目 Portfolio（Project + Stage + Member）
├── cde.yaml           # 公共数据环境（Document + Version + Checkout/Checkin）
├── design.yaml        # 设计（DesignOption + Feedback）
├── coordination.yaml  # 校审协调（Finding + BCF Issue）
└── workflow.yaml      # 工作流（Baseline + Gate + Stage Transition）

apps/bff/openapi/
└── bff-api.yaml       # BFF 端 OpenAPI（聚合所有代理端点）
```

## 6 个 API 域快速导航

| 域               | 文档                | 主要端点前缀                                                                          | 业务错误码段 | Owner                     |
| ---------------- | ------------------- | ------------------------------------------------------------------------------------- | ------------ | ------------------------- |
| **IAM**          | `iam.yaml`          | `/api/v1/auth/*` `/api/v1/principals/*`                                               | 1xxx         | Identity Service          |
| **Project**      | `portfolio.yaml`    | `/api/v1/projects/*`                                                                  | 2xxx         | Portfolio Service         |
| **CDE**          | `cde.yaml`          | `/api/v1/documents/*`                                                                 | 3xxx         | CDE Service               |
| **Design**       | `design.yaml`       | `/api/v1/design-options/*`                                                            | 4xxx         | Design/Discipline Service |
| **Coordination** | `coordination.yaml` | `/api/v1/findings/*` `/api/v1/bcf/issues`                                             | 5xxx         | Coordination Service      |
| **Workflow**     | `workflow.yaml`     | `/api/v1/workflow/baselines/*` `/api/v1/workflow/gates/*` `/api/v1/workflow/stages/*` | 6xxx         | Workflow Service          |

## 通用约定（Cross-cutting）

### 1. 认证与授权

- **浏览器 → BFF**：httpOnly + Secure + SameSite=Strict Cookie（refresh token）
- **BFF → Core Service**：Bearer JWT access token（≤ 15 分钟）
- **服务间**：workload identity / mTLS，Token 不落 URL/日志
- 详见 `iam.yaml` → `/api/v1/auth/login`、`/refresh`、`/logout`

### 2. 双层状态码

| 场景         | HTTP            | 业务 code               | 含义                                 |
| ------------ | --------------- | ----------------------- | ------------------------------------ |
| 成功         | 200 / 201 / 204 | 0                       | 业务处理成功                         |
| 请求格式错误 | 400             | 4001（REQUEST_INVALID） | 语法错误、Header 缺失                |
| 未认证       | 401             | 4011                    | Token 无效或过期                     |
| 无权限       | 403             | 4031 / 4032             | 作用域拒绝 / 数据驻留拒绝            |
| 资源不存在   | 404             | 4041                    | 资源不存在或按防枚举隐藏             |
| 状态冲突     | 409             | 4091+                   | 状态机非法、并发冲突                 |
| 业务规则失败 | 422             | 4221+                   | 字段校验失败、IDEMPOTENCY_KEY_REUSED |
| 限流         | 429             | 4291 / 4292             | RATE_LIMITED / BUDGET_EXHAUSTED      |
| 服务端错误   | 500-599         | 9500+                   | INTERNAL_ERROR / DEPENDENCY_FAILED   |

权威源：`@design/D35-API-事件契约.md §D35.9` + `api-conventions.md §3`

### 3. 幂等与并发

#### 幂等键（`Idempotency-Key`）

- 所有 POST / PATCH 写命令必须携带
- 作用域：`(tenant, stableClientId, operation, idempotencyKey)`
- 同一键 + 同指纹 → 返回首次响应
- 同一键 + 不同指纹 → `422 IDEMPOTENCY_KEY_REUSED`
- 缺失 → `400 IDEMPOTENCY_KEY_REQUIRED`
- 详见 D35.8

#### 乐观锁（`If-Match`）

- 所有 PATCH / DELETE 资源必须携带
- 缺失 → `428 PRECONDITION_REQUIRED`
- 不匹配 → `412 REVISION_CONFLICT` + 当前 ETag

### 4. traceId 全链路传播

- 请求进入网关时生成 UUIDv7 traceId
- 通过 `x-trace-id` header 透传 BFF → Core → AI 全链路
- 响应头回传，前端可用于问题排查
- 详见 `api-conventions.md §7`

### 5. 业务错误码段常量

| 段   | 含义            | 示例                                                        |
| ---- | --------------- | ----------------------------------------------------------- |
| 1xxx | IAM 域          | 1001 INVALID_CREDENTIALS、1012 DUPLICATE_EMAIL              |
| 2xxx | Project 域      | 2001 PROJECT_NOT_FOUND、2002 PROJECT_DUPLICATE_CODE         |
| 3xxx | CDE 域          | 3001 DOCUMENT_NOT_FOUND、3002 DOCUMENT_CHECKED_OUT_BY_OTHER |
| 4xxx | Design 域       | 4001 DESIGN_OPTION_NOT_FOUND                                |
| 5xxx | Coordination 域 | 5001 FINDING_NOT_FOUND                                      |
| 6xxx | Workflow 域     | 6001 TASK_NOT_FOUND、6010 WORKFLOW_DEADLINE_EXCEEDED        |
| 7xxx | Compliance 域   | 7001 RULE_NOT_FOUND（V0 未覆盖）                            |
| 9xxx | System          | 9001 RATE_LIMITED、9500 INTERNAL_ERROR                      |

完整枚举见 `common.yaml#/components/schemas/BusinessErrorCode`

## 版本兼容策略

### v1 版本固定

- 当前 OpenAPI 全部以 `/api/v1` 路径前缀
- v1 视为稳定契约，破坏性变更需要新 major 版本（`/api/v2`）
- 维护期：旧版本至少并行 6 个月后下线

### 弃用通知（Deprecation）

弃用旧版本时通过响应头传递：

```http
Deprecation: true
Sunset: Wed, 31 Dec 2026 23:59:59 GMT
Link: </api/v2/projects>; rel="successor-version"
```

### 兼容变更分类

| 类型                            | 处理                                      |
| ------------------------------- | ----------------------------------------- |
| 新增 optional 字段              | 不需升版本                                |
| 新增 endpoint / enum 值         | 不需升版本（客户端容忍 unknown）          |
| 删除字段 / 改义 / 收紧 required | 必须升 major（`/v2` 或新 `OpenAPI` 文档） |
| 修改错误码语义                  | 必须升 major                              |

详见 `@design/D35-API-事件契约.md §D35.18`

## 与 r2-contract-catalog 的引用关系

本目录的 OpenAPI 文档与 `design/r2-contract-catalog/` 中分配的 **30 个 Operation 稳定 ID** 一一对应：

| Operation ID 段          | 域           | 文档                | 说明                                         |
| ------------------------ | ------------ | ------------------- | -------------------------------------------- |
| `iam.auth.*`             | IAM          | `iam.yaml`          | 认证 6 端点                                  |
| `iam.principal.*`        | IAM          | `iam.yaml`          | 主体 4 端点（list/get/create/update/delete） |
| `iam.organization.*`     | IAM          | （V0 未覆盖）       | 后续补齐                                     |
| `project.*`              | Project      | `portfolio.yaml`    | 项目 5 端点 + member 2 端点                  |
| `cde.document.*`         | CDE          | `cde.yaml`          | 文档 4 端点 + checkout/checkin               |
| `cde.version.*`          | CDE          | `cde.yaml`          | 版本 2 端点                                  |
| `design.option.*`        | Design       | `design.yaml`       | 选项 2 端点 + feedback                       |
| `coordination.finding.*` | Coordination | `coordination.yaml` | 3 端点                                       |
| `coordination.bcf.*`     | Coordination | `coordination.yaml` | 1 端点                                       |
| `workflow.baseline.*`    | Workflow     | `workflow.yaml`     | list + get + create + freeze                 |
| `workflow.gate.*`        | Workflow     | `workflow.yaml`     | list + create + decide                       |
| `workflow.stage.*`       | Workflow     | `workflow.yaml`     | list + transition                            |

修改 API 路径前必须查阅 `design/r2-contract-catalog/`，确认是否影响已注册的稳定 ID。

## 验证与发布

### 本地校验

```bash
# 安装 Redocly CLI（推荐）
npm install -g @redocly/cli

# 校验 BFF 主文档
redocly lint apps/bff/openapi/bff-api.yaml

# 校验所有域
for f in docs/api/*.yaml apps/bff/openapi/*.yaml; do
  echo "Linting $f"
  redocly lint "$f"
done

# 生成 HTML 预览
redocly preview-docs apps/bff/openapi/bff-api.yaml
```

### CI 门禁

- PR 触发 OpenAPI lint（Redocly / Spectral）
- 必须通过 schema 校验、Operation ID 唯一性、tag 一致性
- 与 `design/r2-contract-catalog/` 中已注册 ID 必须一致

## 参考资料

- `@design/D35-API-事件契约.md` — API/事件契约权威源
- `@design/D39-身份多租户-授权.md` — 身份与多租户设计
- `@design/D05-全流程阶段-阶段门.md` — 阶段、门禁、基线
- `@design/D07-CDE领域-版本.md` — CDE 文档与版本管理
- `@design/r2-contract-catalog/` — 30 个 Operation 稳定 ID
- `.trae/rules/api-conventions.md` — 跨语言 API 统一约定
- `.trae/rules/security.md` — 安全与 PII 脱敏

---

## 变更日志

| 日期       | 版本  | 变更                                         |
| ---------- | ----- | -------------------------------------------- |
| 2026-07-23 | 1.0.0 | V0 首切片：6 域 + BFF 聚合 8 个 OpenAPI 文档 |
