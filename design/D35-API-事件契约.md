# D35 API与事件契约

> 来源：@design/INDEX.md | 创建：2026-07-22 | 更新：2026-07-22
> 原始行范围：10674–11191
> 引用约定：同文件内引用使用 §编号，跨文件引用使用 @design/文件名.md

## D35 API 与事件契约

### D35.1 任务定义

| 项目 | 内容 |
|---|---|
| 任务目标 | 为 D03–D34 的跨组件交互建立统一的资源、命令、长任务、文件、gRPC、领域事件和 Webhook 契约 |
| 直接产出 | API 分类/目录、URI/字段/状态、错误、幂等、并发、分页、上传、Webhook、gRPC、事件、版本兼容、治理、技术栈和验收 |
| 成功对齐物 | 任一跨组件调用均能识别责任方、调用方、授权作用域、输入输出 Schema、同步/异步语义、失败恢复、幂等和兼容策略 |
| 本任务不做 | 不把内部数据库表直接暴露为 API，不为每个界面创建专用无治理接口，不用事件替代查询或用同步 RPC 维持跨服务事务 |
| 主能力 | CAP-15.01/02/03，承载 D03–D34，服务 D36–D46 |

### D35.2 标杆依据与平台取舍

| 标杆 | 采用内容 | 平台取舍 |
|---|---|---|
| [OpenAPI 3.2.0](https://spec.openapis.org/oas/v3.2.0.html) | JSON Schema 对齐、Path/Operation、Callback/Webhook、Link、security | V0/V1 新契约采用 3.2.0；若关键生成器尚未兼容，可在 Support Matrix 中暂用 3.1.2，禁止继续新建 3.1.1 契约 |
| [HTTP Semantics RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) | 方法、状态、ETag、If-Match、Range、Retry-After、缓存 | 资源读取遵循 HTTP；有业务副作用的动作使用显式 Command，不滥用 PUT/PATCH |
| [Problem Details RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) | `application/problem+json`、type/title/status/detail/instance | 统一错误外壳 + 稳定 `error_code`/字段错误；不返回堆栈、SQL、路径和敏感输入 |
| [CloudEvents](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md) | 统一 event id/source/type/specversion/subject/time/data | 领域事件 Envelope 采用 1.0 语义；业务 schema 另行版本化 |
| [AsyncAPI 3.1.0](https://www.asyncapi.com/docs/reference/specification/latest) | Channel、Message、Operation、Reply、Protocol Binding | Kafka/Webhook/WebSocket 契约统一登记；发送方/接收方 Application 文档分别生成和验证 |
| [gRPC Deadline/Retry](https://grpc.io/docs/guides/deadlines/) | deadline/cancellation propagation、显式安全重试 | 内部高频/流式调用使用 gRPC；所有客户端设 deadline，只有无副作用或幂等 RPC 可重试 |
| [Protobuf 演进](https://protobuf.dev/programming-guides/proto3/) | field number 稳定、保留删除字段、兼容解析 | 禁止重用 tag/enum number，删除字段 `reserved`，破坏变更升级 package major |
| [HTTP Message Signatures RFC 9421](https://www.rfc-editor.org/rfc/rfc9421.html) + [Digest Fields RFC 9530](https://www.rfc-editor.org/rfc/rfc9530.html) | 签名请求组件、Content-Digest、created/expires/keyid | 高信任 Webhook/API 回调覆盖 method/target/content-digest/time/key，配合重放窗口 |
| [Idempotency-Key 草案](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header) | 客户端唯一键、请求指纹、重复响应 | 采用语义但视为工作草案；本平台冻结自有 TTL、作用域、指纹和冲突错误 |

### D35.3 协议选择与责任边界

| 交互 | 协议 | 适用 | 不适用 |
|---|---|---|---|
| Public/Frontend Resource API | HTTPS/JSON、OpenAPI | CRUD 查询、表单、看板、治理操作 | 大二进制传输、内部高频流 |
| Command/LRO API | HTTPS/JSON + Operation Resource | 运行、发布、导出、联邦、检查、求解等长任务 | 客户端保持长 HTTP 连接等待完成 |
| Internal RPC | gRPC/Protobuf over mTLS | 内部低延迟、强类型、服务端/双向流 | 浏览器公开 API、跨组织开放集成默认入口 |
| Domain Event | Kafka/Redpanda + CloudEvents/AsyncAPI | 已发生事实、派生、解耦流程 | 直接要求同步返回、跨服务分布式事务 |
| Webhook | HTTPS POST + CloudEvents + 签名 | 外部系统订阅已发生事实/任务状态 | 平台内部唯一投递方式、未签名敏感数据 |
| Realtime UI | WebSocket/SSE Gateway | 任务进度、presence、通知提示、只读增量 | 权威状态写入；断线后必须 REST 回补 |
| File Transfer | 控制面 API + 预签名对象 URL/分片 | 模型、图纸、日志、结果、证据包 | API Gateway 转发超大文件正文 |
| Adapter Job | D29 Job Contract：REST/gRPC/File/Queue | 桌面插件、Windows Worker、专业工具 | 任意命令执行或插件直连业务数据库 |

### D35.4 API 共同上下文与 Header

| Header/字段 | 方向 | 规则 |
|---|---|---|
| `Authorization` | Request | OAuth/OIDC access token；不在 URL/日志；服务间使用 workload identity/mTLS |
| `X-Tenant-Id` | Request | 仅作为路由提示，必须与 token/授权上下文一致；不可信客户端不能切换未授权租户 |
| `X-Project-Id` | Request | 可选项目上下文提示；资源 URI/Token/权限三方校验 |
| `Idempotency-Key` | Command | 必需于 POST/PATCH 有副作用命令；tenant+stableClient+operation 作用域，actor 变化不重置业务去重 |
| `If-Match`/`ETag` | Both | 可变资源强并发控制；ETag 由 row_version/representation 生成 |
| `traceparent`/`tracestate` | Both | W3C Trace Context；网关生成/校验，不信任外部 baggage 权限信息 |
| `X-Request-Id` | Both | 单次请求 UUIDv7；重复调用不等同幂等键 |
| `Accept-Language`/`Content-Language` | Both | 人类 title/detail/标签本地化；稳定 code/enum 不本地化 |
| `Retry-After` | Response | 429/503/异步轮询建议；秒或 HTTP-date，客户端加抖动 |
| `Sunset`/`Deprecation`/`Link` | Response | 弃用、迁移指南和下线日期；按网关支持冻结 Profile |
| `Content-Digest`/`Signature-*` | Webhook | SHA-256 摘要、RFC 9421 签名、时间/keyid/replay nonce |

服务不得从 Body 接受 tenant/principal 作为授权事实；Body 中同名字段只能表达业务归属并必须与认证上下文一致。

### D35.5 URI、资源与字段规范

1. 根路径 `/api/v1`；资源使用复数 kebab-case，稳定 ID，不在 URI 编码名称、状态、阶段或层级路径之外的业务含义。
2. 项目级资源优先 `/projects/{projectId}/assets/{assetId}`；跨项目治理资源使用 `/tenants/{tenantId}/...`，作用域不同时禁止同一 endpoint 隐式切换。
3. GET 无副作用；POST 创建资源/命令；PUT 仅完整替换且幂等；PATCH 采用 JSON Merge Patch 或明确 command schema，不能混用；DELETE 只发起受控删除或删除允许的草稿。
4. JSON 使用 `camelCase`，ID 为字符串 UUID，时间 RFC 3339 UTC，Decimal/大整数以字符串或有精度 Schema 表达，单位/币种/CRS 独立字段。
5. 枚举未知值必须可前向处理；客户端不得因新增 enum 崩溃，服务端拒绝不支持的写入值并返回稳定错误。
6. 响应包含 `id`, `status`, `revision`, `createdAt`, `updatedAt`, `links` 的适用子集；嵌入关系有大小上限，复杂关联通过 Link/expand 白名单。
7. 不返回 null 与缺失的混合歧义：Schema 明确 required/nullable；PATCH 明确删除字段与“不修改”语义。
8. API 只暴露领域 DTO，不暴露 ORM、数据库列名、对象存储 bucket/key、内部 worker 地址和供应商密钥。

### D35.6 资源读取、筛选与分页

| 能力 | 契约 |
|---|---|
| List | `{items, pageInfo:{nextCursor,hasNextPage}, links}`；默认/最大 page size 按资源登记 |
| Cursor | 不透明、签名、含稳定 sort/key/作用域/过期；客户端不得解析或跨查询复用 |
| Sort | `sort=-updatedAt,id` 白名单；总是附稳定 tie-breaker `id` |
| Filter | `filter[status]=...`、`filter[discipline]=...` 等登记白名单；复杂查询 POST `/...:search` 但仍只读 |
| Search | 返回 source revision、highlight/score 和授权后资源链接；不将 score 当业务结论 |
| Fields/Expand | `fields=`/`expand=` 白名单、深度/数量预算；默认最小表示 |
| Conditional GET | ETag + If-None-Match；304 不含过期权限结果，私有缓存按用户/租户 Vary/Cache-Control |
| Count | 精确总数仅在成本可控时返回；否则 `estimatedCount/countRelation`，不阻塞首屏 |

Offset 仅用于小且稳定的管理字典；项目资产、Issue、Run、Audit 等使用 keyset cursor，避免深分页和并发插入导致重复/遗漏。

### D35.7 命令与长任务 Operation

| 对象 | 关键字段 | 规则 |
|---|---|---|
| Command Request | commandId、targetId/revision、reason、parameters、clientContext | commandId/幂等键绑定请求指纹；高风险含审批/职责分离信息 |
| Operation | id、type、subject、status、progress、phase、submitted/started/finished、result/error、links | `Queued/Running/Waiting/Succeeded/Failed/Cancelled/Expired/ReconciliationRequired` |
| Operation Step | name、attempt、status、percent、messageCode、started/finished | percent 可未知；不伪造线性进度 |
| Result | resource link/manifest/summary | 大结果只返回 Manifest/下载链接，不嵌入正文 |
| Cancellation | requestedBy/at/reason、cancellable、effect | 取消是请求；返回最终 `Cancelled` 或已提交不可取消说明 |

长任务创建返回 `202 Accepted + Location: /operations/{id}`；快速完成仍可返回 201/200，但同一操作不得在不同调用随机改变语义。客户端按 `Retry-After` 轮询或订阅事件；Operation 到期后保留审计摘要与结果引用。

Canonical Run Contract：`Operation` 是所有长任务的统一外部状态；领域聚合保留结果语义而不复制 Operation 状态机。规范名为 `AIInvocationRun`（废止 `AIRun` 作为对外名）、`AgentRun`、`IntegrationJob`（`ConnectorTask` 是其执行子类型）、`SimulationRun`。领域的 Completed 只映射 Operation `Succeeded`，但同时保存 `AIResultStatus/AgentOutcome/ConnectorEffectStatus/SimulationValidityStatus`；进程成功而结果 Invalid 不计业务成功。原 Unknown/UnknownEffect/NeedsRecovery 统一映射 `ReconciliationRequired`，对账后才能进入终态。事件统一使用 `<CanonicalRunName>Started/Completed/Failed/ReconciliationRequired`，旧别名不得创建新 Topic。

### D35.8 幂等、并发与安全重试

1. 普通命令幂等记录键为 `(tenant, stableClientId, operation, idempotencyKey)`，保存 canonical request fingerprint、首次响应/Operation、状态和 expiry；principal/actor 只进入审计。
2. 同键同指纹：处理中返回同 Operation，完成后重放原语义响应；同键不同指纹返回 `422 IDEMPOTENCY_KEY_REUSED`。
3. 缺少必需键返回 `400 IDEMPOTENCY_KEY_REQUIRED`。只读/可安全重建普通命令可在登记 TTL 后过期；发布、撤销、删除准备、外部发送、付费 AI/求解、CAD/BIM 写回等高副作用命令额外要求 `businessCommandId`，数据库约束 `UNIQUE(tenantId, commandType, targetStableId, businessCommandId)`，至少保留到业务对象终结、外部对账完成和争议期结束，不因技术 TTL 过期重放。
4. GET/HEAD/PUT/DELETE 的 HTTP 幂等性不代表业务可无限重试；DELETE 发布证据等操作仍由领域政策决定。
5. POST/PATCH 和 gRPC Command 只有服务声明幂等后才能由 SDK 重试；网络超时先查询 Operation/按同键重试，禁止换键猜测。
6. 乐观并发更新强制 `If-Match`；缺失返回 `428 PRECONDITION_REQUIRED`，不匹配返回 `412 REVISION_CONFLICT` + 当前 ETag/差异链接。
7. 仅 429/502/503/504 或 gRPC UNAVAILABLE/RESOURCE_EXHAUSTED 等登记瞬态错误可重试，使用指数退避、抖动、上限、deadline 和 retry budget；4xx 业务错误不重试。

### D35.9 状态码与统一错误

| HTTP | 典型语义 | 稳定错误例 |
|---|---|---|
| 400 | 语法/Header/幂等键缺失 | `REQUEST_INVALID`、`IDEMPOTENCY_KEY_REQUIRED` |
| 401 | 未认证/Token 无效 | `AUTHENTICATION_REQUIRED` |
| 403 | 已认证但作用域/政策拒绝 | `ACCESS_DENIED`、`DATA_RESIDENCY_DENIED` |
| 404 | 不存在或按防枚举策略隐藏 | `RESOURCE_NOT_FOUND` |
| 409 | 状态/依赖/锁/业务冲突 | `STATE_CONFLICT`、`BASELINE_NOT_FROZEN` |
| 412/428 | ETag 不匹配/缺前置条件 | `REVISION_CONFLICT`、`PRECONDITION_REQUIRED` |
| 413/415 | 过大/媒体类型不支持 | `PAYLOAD_TOO_LARGE`、`FORMAT_UNSUPPORTED` |
| 422 | 语义/字段/幂等指纹错误 | `VALIDATION_FAILED`、`IDEMPOTENCY_KEY_REUSED` |
| 429 | 限流/配额 | `RATE_LIMITED`、`BUDGET_EXHAUSTED` |
| 500 | 未分类内部错误 | `INTERNAL_ERROR`，不泄漏实现 |
| 502/503/504 | 下游/暂不可用/超时 | `DEPENDENCY_FAILED`、`CAPABILITY_UNAVAILABLE`、`DEADLINE_EXCEEDED` |

Problem Details 扩展固定为 `errorCode`, `correlationId`, `errors[{code,pointer,parameter,resourceId}]`, `retryable`, `retryAfter`, `supportRef`；`detail` 可本地化且不得被客户端分支判断。批量请求按项返回结果/Problem，不用单个 200 隐藏整体失败。

### D35.10 文件上传、下载与内容协商

```text
POST upload-sessions → policy/parts/expiry
PUT parts to object store → checksums
POST upload-sessions/{id}:complete → Quarantine
scan + MIME/format/hash → VerifiedManifest
POST asset-versions with manifestId → bind exact content
```

| 环节 | 契约控制 |
|---|---|
| Session | expected size/hash/media/format/classification/project、part size/count、expiry、allowed headers |
| Upload | 预签名最小权限；Content-Length/Checksum；禁止客户端选择 bucket/key/KMS key |
| Complete | 幂等；验证所有 part/总 hash/大小；返回 Operation/Manifest，不直接视为业务资产 |
| Download | API 授权后短时预签名；Content-Disposition 安全文件名、Range/ETag、审计/水印策略 |
| Package | `manifest.json` 固定 schema/version/hash/entries/relationships/toolchain；压缩炸弹/路径穿越限制 |
| Preview/Tile | 只读派生、source revision/generator version；URL 过期后重新授权获取 |

### D35.11 Webhook 订阅与投递

| 对象/流程 | 设计 |
|---|---|
| Subscription | tenant/project scope、event type/filter、endpoint、secret/key ref、data minimization、status、expiry |
| Endpoint Verify | challenge/响应或受控管理员验证；仅 HTTPS，DNS/IP/重定向/私网 SSRF 检查 |
| Delivery | CloudEvent structured JSON；deliveryId/eventId/attempt；Content-Digest + HTTP Message Signature |
| Retry | 2xx 成功；408/429/5xx 有界退避/Retry-After；其他 4xx 停止或人工；最大期限后 Dead Letter |
| Replay | 按 event/delivery 范围授权重放，保持 eventId、新 deliveryId；接收方以 eventId 幂等 |
| Secret Rotation | 新旧 key 短暂重叠、keyid 指示、失效时间；密钥只显示一次且可撤销 |
| Data Protection | allowlist 字段、对象链接短时授权；不发送模型正文、Token、个人隐私或跨项目内容 |

签名覆盖 `@method`, `@target-uri`, `content-digest`, `content-type`, `ce-id`, `ce-type` 与 created/keyid；校验时间窗、digest、key 状态和 eventId 重放缓存后再处理。

### D35.12 gRPC 内部契约

| 项目 | 规则 |
|---|---|
| Package | `aipilot.<domain>.v1`；Service 按领域能力，不建全平台 God Service |
| Message | 明确 presence/oneof；Decimal/Unit/CRS 使用共享 value object；时间用 well-known Timestamp/Duration |
| Metadata | auth workload/tenant/project/trace/idempotency；业务字段仍在 Message，授权上下文不可由调用方伪造 |
| Deadline | 每个调用方显式设置并向下传播；服务检查 cancellation，长任务返回 Operation 而非占用 RPC |
| Retry | 仅登记幂等方法；per-method Service Config、指数退避/抖动/retry throttle；禁止写命令透明多次副作用 |
| Streaming | 大列表/进度/日志只读流，具 flow control/上限/checkpoint；权威文件仍走对象存储 |
| Error | canonical status + `google.rpc.Status` details/稳定 domain code；网关映射 RFC 9457 |
| Compatibility | 不重用 field/enum number；删除 reserved；新增 optional；breaking change 新 major package |
| Security | mTLS/workload identity、服务/方法/租户授权；reflection 仅受控环境；消息大小与压缩预算 |

### D35.13 CloudEvent Envelope 与 Topic 规则

| 字段 | 规则 |
|---|---|
| `specversion` | `1.0` |
| `id` | event UUIDv7；全局唯一，重投不变 |
| `source` | `/services/{service}/{domain}` 稳定 URI-reference |
| `type` | `com.aipilot.<domain>.<aggregate>.<fact>.v1`；事实用过去式语义 |
| `subject` | `tenants/{tenant}/projects/{project}/<aggregate>/<id>`；不含敏感名称 |
| `time` | 领域事实发生时间 UTC；Broker 时间另记录 |
| `datacontenttype` | `application/json` 或登记的 Protobuf/Avro |
| `dataschema` | Schema Registry 不可变版本 URI |
| Extensions | tenantId、projectId、aggregateId/version、correlationId、causationId、traceparent、classification |
| `data` | 最小事实与变化摘要；大/敏感内容使用授权后的资源/Manifest 引用 |

Topic 采用 `aipilot.<env>.<domain>.events.v1`，按 tenant/aggregateId 组合 key 保持单聚合有序；环境/驻留区隔离在 Broker/Namespace，不靠消息字段过滤。消费组按应用能力命名，禁止共享组造成不同业务消费者互相抢消息。

### D35.14 领域事件目录

| 领域 | 必需事件 | 主要消费者 |
|---|---|---|
| IAM | TenantActivated、MembershipChanged、AccessGranted/Revoked、PrincipalDisabled | 所有授权缓存、审计、通知 |
| Portfolio | ProjectCreated、StageChanged、GateDecided、BaselineFrozen | 工作流、CDE、报表、通知 |
| Requirement | RequirementRevisionCreated、TraceChanged、RequirementBaselineApproved | 设计、规则、Gate、追踪视图 |
| Workflow | WorkflowStarted、TaskAssigned/Completed/Failed、SLAEscalated、WorkflowCompensated | 通知、运营、项目工作台 |
| CDE | AssetVersionVerified、BaselineCreated、TransmittalIssued、PublicationCreated | 预览、搜索、规则、集成、审计 |
| Design | OptionRevisionCreated、ProfessionalSubmissionCreated/Accepted、ConditionIssued | 协调、Gate、联邦、通知 |
| Coordination | FindingCreated、IssueCreated/Changed/Closed、WaiverDecided | BCF、专业工作台、Gate |
| Rule | RuleSetReleased、RuleExecutionCompleted、ComplianceResultChanged、ExceptionDecided | Gate、问题、证据、通知 |
| Quantity | TakeoffCompleted、CostPlanRevisionCreated、RateSnapshotChanged | 方案比选、变更、报表 |
| AI | AIInvocationRunStarted/Completed/Failed/ReconciliationRequired、AIAssetReleased/RolledBack、GuardrailTriggered | 复核、运营、审计、成本 |
| Integration | ConnectorQualified、IntegrationJobChanged、ArtifactImported、ConflictDetected | CDE、桌面端、运营 |
| Analysis | ScenarioCreated、SimulationRunChanged、ResultQualityDecided、ImpactProposed | 专业工作台、设计变更、Gate |
| Governance | ApprovalDecided、LegalHoldChanged、DeletionVerified、EvidenceSealed | CDE、存储、审计、通知 |
| Platform | SchemaReleased、ProjectionLagged/Rebuilt、DataQualityFailed、RestoreVerified | 运维/治理台、告警 |

事件名称表达已经发生的事实；`RunRequested` 等意图若走消息必须定义为 Command Channel，与 Event Topic 分离、具 reply/deadline/idempotency，不伪装成事件。

### D35.15 HTTP API 总目录

| API 域 | 资源查询 | 主要命令/长任务 | Owner |
|---|---|---|---|
| IAM/Organization | tenants、organizations、principals、memberships、grants | invite、grant/revoke、disable、external-access | Identity Service |
| Project/Stage | projects、stages、gates、baselines、delivery-strategies | transition-stage、freeze-baseline、decide-gate | Portfolio Service |
| Requirement | sources、requirements、revisions、trace-links、information-requirement-sets | ingest、clarify、approve-baseline、analyze-impact | Requirement Service |
| Workflow/Task | definitions、instances、work-packages、tasks、attempts、operations | start、claim、complete、retry、compensate、cancel | Workflow Service |
| CDE/Asset | assets、versions、renditions、federations、transmittals、publications | upload、normalize、federate、freeze、issue、publish | CDE Service |
| Design/Professional | briefs、options、packages、sheets、submissions、conditions | generate-candidate、compare、submit、accept/return | Design/Discipline Services |
| Coordination | findings、clash-runs、consistency-runs、issues、viewpoints、waivers | run-check、cluster、create-issue、resolve、decide-waiver | Coordination Service |
| Rule/Knowledge | sources、editions、clauses、rule-sets、executions、results、exceptions | ingest、release-rule-set、execute、verify、decide-exception | Rule/Knowledge Service |
| Quantity/Cost | takeoffs、measurements、classifications、cost-plans、rate-snapshots | calculate、reconcile、compare、approve-snapshot | Quantity Service |
| AI/Agent | capabilities、routes、ai-assets、runs、evaluations、agents、tool-calls | execute、approve-tool、release、rollback、stop/resume | AI Platform |
| Integration | connectors、deployments、devices、sessions、jobs、artifacts、mappings | qualify、dispatch、cancel、reconcile、write-back | Integration Service |
| GIS/Analysis | datasets、crs-definitions、problems、scenarios、runs、results、quality | transform、prepare-model、solve、validate、calibrate、propose-impact | Analysis Service |
| Governance | approvals、evidence、retention-policies、legal-holds、deletion-cases | approve/reject、seal、hold/release、archive、delete | Governance Service |
| Platform/Ops | schema-releases、dictionary、quality-findings、projections、backups、restore-drills | migrate、rebuild、repair、restore-verify | Platform Control |

每个表格中的资源/命令在实施前必须有单独 Operation ID、OpenAPI Path、scope、request/response Schema、错误、幂等、SLO 和 Owner；总目录是完整责任边界，不授权省略 D03–D34 中已定义的子资源。

#### D35.15.1 V0 首切片关键 API 契约示例（业界对标审计补充）

 **审计依据：** OpenAPI 3.2 最佳实践、Google API Design Guide、Stripe API 设计模式。以下为首切片核心流程的 5 个关键 API 示例，开发团队可直接作为 OpenAPI Spec 起点。

**示例 1：创建项目**

```
POST /api/v1/projects
Idempotency-Key: {client-uuid}
Authorization: Bearer {token}

Request:
{
  "name": "境外主创方案深化-某某项目",
  "clientOrganizationId": "uuid",
  "regionProfileId": "uuid",       // 地区配置（语言/单位/图层）
  "buildingType": "office",        // 建筑类型
  "disciplines": ["architecture"], // V0 仅建筑
  "stages": ["STG-P0","STG-P1","STG-P2","STG-P5","STG-P6","STG-P7"]
}

Response 201:
{
  "id": "uuid",
  "name": "...",
  "status": "active",
  "currentStage": "STG-P0",
  "createdAt": "2026-07-21T10:00:00Z",
  "createdBy": "uuid"
}

Errors: 400(validation), 403(forbidden), 409(duplicate name in tenant)
```

**示例 2：上传资产（分步）**

```
// Step 1: 创建上传会话
POST /api/v1/projects/{projectId}/assets:upload
{
  "fileName": "sketch-v1.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 5242880,
  "containerId": "uuid",          // 信息容器
  "discipline": "architecture",
  "stage": "STG-P1"
}
Response 200: { "uploadSessionId": "uuid", "uploadUrl": "presigned-s3-url", "expiresAt": "..." }

// Step 2: 客户端直传对象存储（PUT uploadUrl）

// Step 3: 确认上传
POST /api/v1/projects/{projectId}/assets:commitUpload
{ "uploadSessionId": "uuid", "sha256": "hex-hash" }
Response 201: { "assetId": "uuid", "versionId": "uuid", "status": "quarantine" }

// 异步：安全扫描通过后自动转为 WIP
```

**示例 3：触发 AI 能力（草图识别）**

```
POST /api/v1/projects/{projectId}/ai-runs
Idempotency-Key: {client-uuid}
{
  "capabilityId": "sketch-recognition",  // AI 能力标识
  "inputAssetVersionId": "uuid",          // 输入资产版本
  "parameters": {
    "outputFormat": "structured-json",
    "confidenceThreshold": 0.7,
    "language": "en"
  }
}

Response 202 (LRO):
{
  "operationId": "uuid",
  "status": "running",
  "runId": "uuid",
  "pollUrl": "/api/v1/operations/{operationId}",
  "estimatedSeconds": 30
}

// 轮询: GET /api/v1/operations/{operationId}
// 完成后: runId 关联输出资产、置信度、证据和人工复核状态
```

**示例 4：创建审校任务**

```
POST /api/v1/projects/{projectId}/tasks
{
  "type": "review",                  // 任务类型
  "title": "概念方案小样审校",
  "assigneeId": "uuid",              // 审校人
  "inputAssetVersionIds": ["uuid"],  // 待审资产
  "dueAt": "2026-07-25T18:00:00Z",
  "stage": "STG-P1",
  "instructions": "请确认风格方向、比例和图层表达"
}

Response 201: { "taskId": "uuid", "status": "pending", ... }

// 完成审校: POST /api/v1/projects/{projectId}/tasks/{taskId}:complete
// { "decision": "approved", "comments": [...], "signatureEvidence": {...} }
```

**示例 5：发布交付**

```
POST /api/v1/projects/{projectId}/publications
Idempotency-Key: {client-uuid}
{
  "baselineId": "uuid",              // 已冻结基线
  "purpose": "client-review",        // 发布用途
  "recipients": [
    { "principalId": "uuid", "channel": "secure-link" }
  ],
  "formats": ["pdf", "original"],
  "expiryAt": "2026-08-21T00:00:00Z"
}

Response 202 (LRO):
{ "operationId": "uuid", "status": "preparing", "publicationId": "uuid" }

// 完成后生成不可变发布集 + Transmittal + 签收链接
```

以上示例遵循 D35 统一规则：UUIDv7 标识、Idempotency-Key、ETag/row_version 并发控制、RFC 9457 错误格式、LRO Operation 模式。V0 开发团队应基于这些示例生成 OpenAPI 3.2 Spec，并在 Contract Catalog 中登记。

### D35.16 批量、导入导出与查询预算

| 场景 | 设计 |
|---|---|
| 小批量读取 | `POST /<resources>:batchGet`，ID 上限、保持输入顺序、逐项 notFound/denied |
| 小批量命令 | 每项独立 idempotency/ETag，返回 207 或 BatchOperation；默认非原子，原子能力必须显式声明 |
| 大批导入 | 上传 Manifest→validate Operation→preview→commit Operation→result/error artifact |
| 大批导出 | 创建 ExportOperation，固定 query/snapshot/fields/classification/watermark，生成加密短时下载 |
| 复杂图查询 | 预定义 query template + depth/node/time budget；不提供任意 GraphQL/SQL 穿透 |
| 报表 | 按精确 Baseline/时间水位生成；长任务化，结果含数据新鲜度和过滤范围 |

部分成功必须提供 per-item status、稳定错误、retryable 和 continuation；不得因一个坏文件无限重跑整批，也不得把跨聚合批量包装成无法补偿的数据库大事务。

### D35.17 授权、数据最小化与代理调用

1. 网关认证，服务端按 resource/action/tenant/project/discipline/stage/classification 做 PEP；“能列出”不代表“能读取详情/内容/导出”。
2. List/Search 在事实源授权后过滤；不得先查全量再由前端隐藏。404/403 防枚举策略按资源分类统一。
3. 用户委托 Agent/Workflow 调用携带 actor、delegated client、purpose、scope、expiry、approval/step；ToolCall 不能继承超出用户/任务的权限。
4. 服务账号只获具体 API/Topic/项目作用域；Broker ACL、Schema Registry、Object URL 与 API scope 一致。
5. 响应/事件/Webhook 使用字段 allowlist 和 classification；敏感字段的 field mask/脱敏由服务端执行。
6. 导出、分享、发布、删除、专业签审等高风险命令携 reason/purpose，执行职责分离和 Step-up；审计不依赖客户端自报 actor。

### D35.18 版本、弃用与兼容策略

| 契约 | 非破坏变更 | 破坏变更/处理 |
|---|---|---|
| HTTP/OpenAPI | 新 optional 字段/endpoint/enum（客户端容忍 unknown） | 删除/改义/改类型/收紧 required→`/v2` 或新媒体版本 |
| Event | 新 optional data/extension、兼容 Schema | 改事实语义/删除字段/改 key/order→event type major v2 + 双发/迁移 |
| Protobuf | 新 field/service/method、reserved-aware | tag 类型/语义、重用 number、required 行为→package v2 |
| Webhook | 新 optional 字段/event type | 签名 profile/Envelope 破坏变更→subscription version 升级 |
| File Manifest | 新 optional entry/metadata | hash/路径/关系语义变化→manifest schema major |

兼容策略：Schema Registry backward/transitive 检查 + consumer contract；至少提前一个支持窗口发布弃用公告、迁移指南、调用方清单和实际流量；Sunset 前阻断新接入旧版，未完成消费者有明确责任人/例外。版本不按日期或内部发布号随意增长。

### D35.19 限流、配额、超时与降级

| 控制维度 | 规则 |
|---|---|
| Rate limit | tenant/principal/client/IP/operation 加权 token bucket；读写/上传/AI/求解独立额度 |
| Quota/Budget | 存储、项目、并发任务、GPU/Token/许可证/导出；返回 remaining/reset 或治理链接 |
| Timeout | 网关、服务、DB、外部工具均小于上游 deadline；长任务不靠延长 HTTP timeout |
| Circuit breaker | 仅对外部/非关键依赖；打开时返回能力不可用和可恢复路径，不伪造成功 |
| Bulkhead | 租户/任务类型/高成本能力隔离队列和并发，防止大模型/大文件拖垮元数据 API |
| Degradation | 搜索不可用回源受限查询；预览不可用仍可下载授权原件；通知失败不丢业务任务 |

Retry-After、quota 和降级状态必须机器可读；限流发生在鉴权后以正确作用域计量，同时在鉴权前保留 DDoS/连接保护。

### D35.20 契约开发、发布与门户

```text
Design Contract → Lint/Breaking Check → Mock/Review → Provider Test
→ Consumer Contract/Security Test → Gateway/Registry Publish
→ Canary/Observe → General Availability → Deprecate/Sunset
```

| 产物 | 门禁 |
|---|---|
| OpenAPI | operationId 唯一、Owner/scope、Schema/examples、Problem、分页/幂等/ETag、无敏感字段 |
| AsyncAPI | producer/consumer、channel/key/order、CloudEvent/schema、retry/DLQ/replay、classification |
| Protobuf | lint/breaking、reserved、deadline/retry policy、auth metadata、message size |
| SDK | 生成类型 + 手写领域封装；默认 deadline/retry/trace；不隐藏幂等/冲突 |
| Developer Portal | 版本、环境、认证、配额、示例、错误目录、事件/Webhook、变更/下线、状态页 |
| Contract Catalog | API/Event/RPC/File owner、消费者、SLO、数据分类、部署/版本、测试和最后使用 |

契约是源代码级受控资产，但唯一产品设计正文仍为本文；生成的 OpenAPI/AsyncAPI/Proto 属实施产物，不另建第二份设计正文。

### D35.21 技术栈与组件边界

| 组件 | 明确方案 | 责任 | 边界 |
|---|---|---|---|
| HTTP Contract | OpenAPI 3.2.0；工具兼容例外可暂用 3.1.2 + JSON Schema | Public/Frontend API 定义、生成、Mock | 不从 ORM 自动暴露生产契约；例外登记 Owner/退出 Gate |
| Async Contract | AsyncAPI 3.1.0 + CloudEvents 1.0 | Kafka/Webhook/WebSocket 消息与操作 | Event schema/version 独立于 Envelope，发送/接收契约不互相推导 |
| Internal RPC | gRPC + Protobuf Editions/Proto3 | 内部低延迟/流式调用 | mTLS、deadline、兼容和大小预算 |
| API Gateway | Envoy Gateway + Kubernetes Gateway API | TLS、认证、路由、限流、WAF、观测 | 业务授权/状态机仍在领域服务；企业网关仅作合格 Profile 前置层 |
| Service Framework | Java 21 + Spring Boot 4.1；BFF 使用 TypeScript + NestJS | OpenAPI/gRPC、validation、Problem mapping | Domain Service 不混用语言栈；Python 只用于 AI/几何/求解 Worker |
| Event Broker | Kafka（SaaS 托管或私有化 Strimzi） | 持久事件、分区有序、消费组、重放 | 不承载同步事务和超大 payload；替代实现需契约/恢复资格 |
| Schema Registry | Apicurio Registry | JSON Schema/Protobuf/Avro 版本兼容 | 与 D34 Kafka 基线统一；托管 Kafka 可用兼容 Registry Adapter |
| Contract Tooling | Spectral/Redocly、Buf、AsyncAPI CLI、OpenAPI Diff | lint、breaking、docs、SDK/test generation | 规则版本化，例外有期限/Owner |
| Webhook | 自建 Delivery Service + RFC 9421/9530 库 | 订阅、签名、重试、DLQ、重放 | 禁止自创密码算法；SSRF/重放控制 |
| Realtime | SSE 优先；协作 presence/双向需求再用 WebSocket Gateway | UI 增量/进度 | 断线 REST 回补，不存事实 |
| File Control | CDE Upload API + S3 Multipart/Presigned URL | 会话、校验、Manifest、下载授权 | 大文件不穿 Gateway |
| Observability | OpenTelemetry HTTP/gRPC/Kafka instrumentation | operation/event/correlation/attempt 指标与追踪 | payload/Token/签名/敏感字段不采集 |

### D35.22 安全、异常与恢复

| 异常/威胁 | 处理 |
|---|---|
| BOLA/跨租户资源 ID | 每次回源对象授权 + tenant/project scope；不依赖不可猜 UUID |
| Mass assignment/隐藏字段写入 | request DTO allowlist、unknown/readonly 字段拒绝、Schema 验证 |
| JSON/Proto/压缩炸弹 | body/message/depth/field/count/compression ratio 上限，解析超时和内存预算 |
| 重放/重复副作用 | Idempotency-Key、request hash、event/inbox id、Webhook 时间窗/nonce |
| SSRF Webhook/导入 URL | HTTPS allow policy、DNS/IP 重解析、私网/metadata 阻断、重定向限制 |
| Webhook 伪造/篡改 | Content-Digest + HTTP Message Signature + key rotation + constant-time verify |
| Event poison/Schema 不兼容 | Registry 校验、隔离 Topic/DLQ、暂停消费者、修复后受控重放 |
| Event 丢失/乱序 | D34 Outbox、aggregate version、gap detect、回源/补发、分区 key |
| RPC deadline/cancel 未传播 | Interceptor 强制、下游预算、worker 检查 cancellation；长任务 Operation 化 |
| Retry storm | retry budget/throttle、jitter、circuit/bulkhead、服务端 Retry-After |
| 搜索/实时流陈旧 | 响应携水位/source revision，写命令回源；断线 cursor 回补 |
| 敏感错误/日志泄漏 | RFC 9457 allowlist、异常映射、参数/header/payload 脱敏 |
| 版本提前下线 | consumer inventory/traffic、双栈窗口、Sunset 门禁和批准例外 |
| 文件 URL 泄漏 | 短 TTL、单对象/动作/范围、可选一次性/水印、撤权和访问审计 |

### D35.23 指标与发布门禁

| 指标 | 定义/用途 |
|---|---|
| Contract Coverage | 跨组件交互有 OpenAPI/AsyncAPI/Proto/File Schema、Owner、消费者比例 |
| Compatibility | breaking check/consumer contract 通过率、破坏变更和例外数 |
| API Reliability | operation 可用率、成功率、p50/p95/p99、5xx/timeout/cancel |
| Error Quality | RFC 9457 覆盖、unknown 500、可操作 error code、敏感泄漏数 |
| Idempotency | duplicate 命中、key reuse、重复副作用、记录延迟/容量 |
| Concurrency | 412/428、冲突解决时长、错误覆盖写事件 |
| Event Delivery | outbox/broker/inbox lag、重复、gap、DLQ、replay 成功率 |
| Webhook | 投递成功/延迟/重试/DLQ、签名失败、endpoint 停用率 |
| File Transfer | session/part/complete 成功率、hash/MIME/scan 失败、吞吐和孤儿 |
| Security | BOLA/越权/SSRF/重放/Schema 攻击/敏感泄漏，目标 0 |
| Quota/Retry | 429、budget exhaustion、retry amplification、circuit open 时长 |
| Freshness | Search/Realtime/Projection source revision lag 和回补成功率 |
| Deprecation | 旧版调用量、剩余消费者、迁移时长、Sunset 例外 |
| Developer Experience | 首次成功调用时间、契约/SDK 缺陷、文档新鲜度 |

API/事件发布门禁：lint、breaking、示例/Mock、Provider/Consumer/契约测试、认证授权、租户负向、幂等并发、错误映射、分页/预算、deadline/retry、事件顺序/重复/重放/DLQ、Webhook 签名/SSRF、文件攻击、敏感信息、容量/性能、观测、版本迁移和回滚测试通过。

### D35.24 D35 验收条件（EARS）

- When 新跨组件交互设计, the 平台 shall 指定协议、Owner、调用方、授权作用域、Schema、错误、SLO、幂等和版本策略。
- When 客户端创建有副作用的 Command, the API shall 要求 Idempotency-Key 并将其绑定租户、调用方、operation 和请求指纹。
- When 同一 Idempotency-Key 与相同指纹重试, the API shall 返回原 Operation/响应，不重复副作用。
- When 同一 Idempotency-Key 与不同指纹重用, the API shall 返回 422 `IDEMPOTENCY_KEY_REUSED`。
- When 客户端更新可变资源, the API shall 要求 If-Match；版本不一致时返回 412 和当前 ETag/差异链接。
- When 请求验证或业务失败, the API shall 返回 RFC 9457 Problem Details、稳定 errorCode 和 correlationId，不泄漏内部实现。
- When 操作不能在同步 SLO 内完成, the API shall 返回 202/Operation、Location 和 Retry-After，并允许查询/订阅最终状态。
- When 列表规模可增长, the API shall 使用签名不透明 cursor、稳定排序和最大页限制，不使用深 offset。
- When 上传完成, the File API shall 校验 part、大小、MIME、恶意内容和 hash 后才返回 VerifiedManifest。
- When 下载模型/图纸/证据, the API shall 在当前授权检查后签发短时、最小范围 URL 并记录访问。
- When gRPC 调用发起, the 客户端 shall 设置并传播 deadline；服务端 shall 响应 cancellation 并停止不必要工作。
- When RPC 被配置重试, the 契约 shall 证明方法无副作用或幂等，并规定状态码、退避、抖动、attempt 和 retry budget。
- When 领域事实提交, the Producer shall 通过 D34 Outbox 发布 CloudEvent，包含 aggregate version、correlation/causation 和最小数据。
- When 消费者收到重复或乱序事件, the Consumer shall 去重并按 aggregate version 检测缺口，不跳过处理。
- When Event Schema 破坏兼容, the 平台 shall 创建 major event type 并完成双发/消费者迁移，禁止原地改义。
- When Webhook 投递, the Delivery Service shall 包含 Content-Digest 和 HTTP Message Signature，并执行有界重试/DLQ。
- When Webhook endpoint 注册或重定向, the 平台 shall 验证 HTTPS、DNS/IP 和私网/metadata 限制，防止 SSRF。
- When 实时连接断开重连, the UI Gateway shall 通过 cursor/watermark 回补或指示 REST 刷新，不假设消息完整。
- When API/事件准备下线, the 治理流程 shall 提供调用方清单、实际流量、迁移指南、弃用/Sunset 日期和例外责任人。
- When 契约发布, the 门禁 shall 阻止缺少 Owner、scope、错误、示例、兼容、测试、分类或观测的接口。

### D35.25 D35 完成检查与下游约束

| 检查项 | 结果 |
|---|---|
| 是否形成 HTTP/Command/LRO/gRPC/Event/Webhook/Realtime/File 的统一边界 | 是 |
| 是否覆盖 D03–D34 API 域、领域事件、错误、幂等、分页、批量和上传下载 | 是 |
| 是否明确授权、重试、限流、版本兼容、治理门户和技术栈 | 是 |
| 是否形成安全、异常、指标、发布门禁和 EARS 验收 | 是 |

D35 对下游的强制约束：D36 将所有业务任务映射到 API/Operation/Event 支撑的页面入口；D37 为分页、冲突、长任务、部分成功、上传、实时断线和 Problem 状态设计交互；D38 消费 Workflow/Issue/Gate/Run/Publication 事件且不以通知投递替代任务事实；D39 固化 OAuth/OIDC scope、delegation、service identity 和网关/服务 PEP；D40 覆盖 BOLA、Mass Assignment、SSRF、重放、文件/Schema、Webhook 和供应链威胁；D41 将 request/command/event/delivery/actor/trace 与证据链关联；D42 为 API、上传、Broker、Webhook、RPC 和 Operation 建立容量/SLO；D43 统一 operationId/event type/consumer/delivery/trace 指标；D44 部署 Gateway、Broker、Registry、Webhook、Realtime 和 mTLS；D45 生成契约/消费者/安全/混沌/性能测试；D46 审计每个跨组件流程均有唯一责任方和契约。

