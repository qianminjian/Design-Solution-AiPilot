# D24 AI能力目录与网关

> 来源：@design/INDEX.md | 创建：2026-07-22 | 更新：2026-07-22
> 原始行范围：7191–7520
> 引用约定：同文件内引用使用 §编号，跨文件引用使用 @design/文件名.md

## D24 AI 能力目录与网关

### D24.1 任务定义

| 项目 | 内容 |
|---|---|
| 任务目标 | 建立供应商无关、风险分级、数据策略先行、可评测/路由/限流/计费/回退/停用的 AI Capability API 与统一网关 |
| 直接产出 | 能力目录、契约、模型/部署/路由对象、调用流程、预算/配额、可靠性、安全、接口、界面、技术栈和验收条件 |
| 成功对齐物 | 任一 AI 调用可回答“哪个业务能力、为何选该模型、使用何种数据/策略、花费多少、质量如何、如何复现/回退” |
| 本任务不做 | 不在业务模块暴露供应商私有字段，不在本任务定义感知/生成/Agent 算法细节（D25–D27），不替代 D28 模型发布评测 |
| 主能力 | CAP-13.01–06、CAP-15.02/03，服务 D09–D23 及后续 AI 模块，输出 AIInvocation/Usage/PolicyDecision |

### D24.2 标杆依据与平台取舍

- Kong/Envoy 等 AI Gateway 强项是多供应商代理、负载均衡、重试、限流、观测和安全插件；LiteLLM 等可降低供应商 SDK 差异。平台将其放在数据面，不把业务能力语义寄托于网关厂商配置。
- NIST AI RMF 要求明确应用范围、第三方组件风险、部署前测试、持续监测、人工监督、事件/恢复和停用；CapabilityRevision、RiskProfile 与 D28 Release 必须共同决定可路由模型。
- 供应商 API 的 token、错误、流式、工具调用、图像/文件和计费语义并不一致；平台提供 Canonical Contract，同时保存原生请求/响应的安全摘要供诊断。
- 取舍：控制面管理能力/策略/部署/预算，数据面执行认证/路由/适配/流控；同步短请求与异步大任务并存，业务只依赖 capabilityId。

### D24.3 核心原则

1. Capability-first：业务请求能力和质量/风险目标，不指定供应商模型名；仅诊断/评测角色可受控指定部署。
2. Policy-before-route：权限、数据级别、许可、地区、用途和风险硬约束先过滤，再按质量/时延/成本评分。
3. Contract-preserving fallback：回退模型必须满足同一输入/输出和最低质量/安全契约，禁止静默降级。
4. 每次调用固定 Capability/Route/Deployment/Policy/Prompt/Schema 版本，记录不可变 InvocationRun。
5. 幂等、预算、超时和取消由平台统一；供应商重试不得造成重复外部动作或重复计费不可见。
6. 高风险输出始终沿用 D01 自动化等级和人工门禁，网关成功不等于业务结果获批。
7. 密钥、供应商原始错误和敏感内容不进入业务日志；使用最小数据和短期凭证。

### D24.4 能力分类与调用模式

| 能力类 | 示例 | 调用模式 | 关键契约 |
|---|---|---|---|
| TextGeneration | 摘要、说明、解释、结构化草案 | Sync/Stream | JSON Schema、引用、最大输出、拒答 |
| Embedding | 文档/查询/对象语义向量 | BatchAsync/Sync | 维度、距离、语言、规范化和版本 |
| Reranking | 条款/候选二阶段排序 | Sync/Batch | Top-N、分数语义、最大文档长度 |
| VisionUnderstanding | 图纸/照片/模型截图理解 | Async/Sync | 媒体限制、坐标/对象、置信和证据 |
| OCRDocument | 文本/版面/表格/公式识别 | Async | 页/块坐标、置信、语言和结构 |
| ImageGeneration | 概念图/表达图候选 | Async | 尺寸、种子/可复现信息、内容来源和水印 |
| GeometryGeneration | 参数/草图到可编辑几何候选 | Async | 约束、坐标/单位、拓扑、格式和验证 |
| ClassificationExtraction | 需求/构件/材料/Issue 分类抽取 | Sync/Batch | 标签 schema、置信、未知类和证据 |
| ToolPlanning | D27 Agent 的计划/工具选择建议 | Sync/Stream | 工具 schema、循环/预算、审批点 |
| SafetyModeration | 输入/输出安全分类 | Sync | 类别、阈值、阻断/复核和策略版本 |

### D24.5 领域对象

| 对象 | 职责 | 关键内容 |
|---|---|---|
| AICapability | 稳定业务能力身份 | 编码、名称、用途、所有者、能力类和生命周期 |
| CapabilityRevision | 不可变能力契约 | input/output schema、SLO、风险、评测门槛、允许模式和状态 |
| CapabilityRiskProfile | 风险与人工控制 | 影响、自动化等级、禁止用途、复核角色和停止条件 |
| CapabilityQualityProfile | 质量目标 | 指标、最低阈值、数据切片、置信/拒答和降级边界 |
| DataHandlingPolicy | 数据处理约束 | 分类、许可、驻留、保留、训练使用、日志/缓存和脱敏 |
| ModelProvider | 供应商身份 | 法人/服务、合同、地区、DPA、状态和支持渠道 |
| ModelDefinition | 模型身份 | 家族/版本、能力、上下文、输入模态、许可证和已知限制 |
| ModelDeployment | 可调用部署 | provider/model、region、endpointRef、容量、价格、状态和健康 |
| DeploymentQualification | 能力—部署资格 | capabilityRevision、D28 release/eval、数据切片、阈值和有效期 |
| RoutingPolicy | 路由规则 | 硬过滤、评分、粘性、负载、回退、熔断和版本 |
| GuardrailPolicy | 输入/输出控制 | schema、内容安全、PII、注入、引用/事实、动作和版本 |
| BudgetPolicy | 预算与配额 | tenant/project/user/capability 维度、周期、软硬限额和审批 |
| AIInvocationRequest | 规范化请求 | capability、project/context、payload refs、SLO、幂等和调用者 |
| AIInvocationRun | 一次不可变执行 | 路由决策、部署、策略、尝试、状态、时延、摘要和结果引用 |
| InvocationAttempt | 单次供应商尝试 | request/response 摘要、错误、token/媒体、成本、退避和时间 |
| AIUsageRecord | 可对账使用量 | 计量维度、数量、供应商账单键、估算/实收成本和归属 |
| AIResultArtifact | 规范化结果 | schema、内容/文件引用、置信、provenance、guardrail 和有效期 |
| ResponseCacheEntry | 安全缓存 | 语义/精确键、Scope、模型/策略版本、TTL 和失效原因 |
| ProviderIncident | 供应商/部署事件 | 范围、开始/恢复、影响能力、缓解、复盘和状态 |
| RoutingDecisionTrace | 可解释路由 | 候选、过滤原因、分数、预算/健康和最终选择 |

### D24.6 Capability Contract

每个 CapabilityRevision 必须定义：

- `inputSchema/outputSchema`：JSON Schema/OpenAPI；大文件使用 D07 AssetVersion 引用，不内嵌任意路径/URL。
- `supportedModes`：sync、stream、async、batch；最大 payload、页数、像素、token、对象数和超时。
- `qualityProfile`：任务指标、门槛、拒答/低置信行为和适用数据切片。
- `riskProfile`：D01 自动化等级、允许用途、人工审批、禁止自动动作和申诉/覆盖路径。
- `dataPolicy`：分类、租户/项目 Scope、地区、保留、缓存、训练使用、供应商日志和子处理方。
- `errorContract`：Validation、PolicyDenied、BudgetExceeded、NoQualifiedRoute、RateLimited、Timeout、ProviderError、GuardrailBlocked、SchemaInvalid、Cancelled。
- `provenance`：能力/部署/策略/模板/工具版本、来源资产、成本和结果哈希。

业务 Schema 由平台拥有；供应商新增字段先在 Adapter 映射或通过受控 `providerExtensions` 诊断区暴露，不能污染主契约。

### D24.7 模型与部署资格

ModelDefinition 与 ModelDeployment 分离：同一模型可在不同供应商/地区/硬件/量化版本部署，其质量、时延、容量、价格和数据条款不同。DeploymentQualification 只有在 D28 对该 CapabilityRevision、目标数据切片、地区和配置评测通过后才 Active。

部署状态：Candidate→Qualified→Active→Degraded→Suspended→Retired。模型别名更新不得自动指向未知快照；不能固定底层版本的服务要记录 providerAlias、observedVersion/响应指纹并加强漂移检测。

资格到期、模型/系统提示/安全策略/量化/区域/供应商条款变化触发重新评测。Degraded 可继续低风险流量；Critical 能力只路由 Active 且容量有保障的部署。

### D24.8 路由决策流程

1. 验证调用身份、CapabilityRevision、项目状态、payload schema、幂等键和 Asset 引用权限。
2. DataHandlingPolicy 判定数据分类、许可、地区/驻留、供应商训练/保留、模态和用途；不合规部署硬排除。
3. 过滤未 Qualified、非 Active/允许 Degraded、能力/上下文/文件限制不满足、Guardrail 不兼容和无容量部署。
4. 预算预授权并估算最大成本；超硬限额拒绝，软限额按策略降级/审批，但不得降低安全/质量底线。
5. 对候选按质量、数据切片表现、健康/容量、时延、成本、区域、缓存命中和供应商集中度评分。
6. 应用项目粘性/一致性策略，生成 RoutingDecisionTrace；锁定 Deployment/Adapter/Policy 版本。
7. 执行请求、流控、Guardrail、Schema 校验和 Usage 记账；失败按错误分类决定重试、回退或结束。
8. 返回 AIResultArtifact/Run ID；异步通过事件/回调通知，业务工作流按自身门禁消费。

### D24.9 重试、回退、熔断与降级

| 情况 | 行为 |
|---|---|
| 4xx/Schema/Policy | 不重试；返回可修正错误，防止无效费用 |
| 429/容量不足 | 尊重 Retry-After，指数退避+jitter，在截止时间内同部署/同区域重试 |
| 5xx/网络/瞬时超时 | 有界重试；若请求可能已执行，先按幂等/供应商请求 ID 查询/对账 |
| 内容安全/Guardrail | 不换模型绕过；按策略拒绝或人工复核 |
| 输出 Schema 无效 | 同部署有限修复/重试；仍失败才走合资格回退 |
| 质量/置信低 | 返回低置信/拒答或路由批准的更高质量部署，不静默接受 |
| 供应商事件 | 熔断受影响部署，按 RoutePlan 转移并记录 Incident 影响 |

FallbackPlan 明确顺序、触发错误、最大尝试/总时限、成本上限、质量差异和用户提示。无满足资格的回退时返回 NoQualifiedRoute；不得把云模型故障自动回退到未经评测本地模型。

### D24.10 幂等、异步与流式语义

- `idempotencyKey` 唯一作用域为 `(tenantId, stableClientId, capabilityRevisionId, idempotencyKey)`；`payloadDigest` 仅保存为 `requestFingerprint`。同键同指纹返回原 Run，不重复计费；同键不同指纹报冲突。actor/principal 进入审计但不作为主要去重键，避免用户→Workflow/Agent 身份切换绕过幂等。
- Sync 仅用于可在网关截止时间内完成的小请求；文档/图像/几何/大批量使用 Async Job，支持状态、进度、取消和结果 TTL。
- Streaming 先发送固定 Run/Deployment/Policy 元数据，内容增量视为 provisional；完成 Guardrail/Schema/引用检查后发 `final`，中断流不能进入业务批准。
- Cancel 是尽力而为；供应商已执行产生的成本仍记账并标记 cancelledAfterDispatch。回调使用签名、重放保护和事件幂等。

### D24.11 预算、配额与成本对账

BudgetPolicy 可按 tenant/project/workPackage/user/capability/provider/deployment 和日/月/阶段设置请求数、token、图像、页面、GPU 秒和货币额度。预算采用 Reserve→Consume/Release；并发请求先预留最大估算，完成后按 UsageRecord 结算。

软限额：告警、要求理由、切换同质量低成本路线或项目审批；硬限额：拒绝新调用。Critical 修复/安全任务可使用受审批应急额度，不允许业务通过拆请求绕过。

UsageRecord 保存供应商计量、平台标准化计量、单价版本、币种、税费、估算/实收、账单请求 ID 和成本归属；每日/账期与供应商账单对账，差异进入财务/运营队列。

### D24.12 缓存与批处理

- 仅 DataHandlingPolicy 允许时缓存；键包含 Capability/Deployment/Prompt/Schema/Guardrail Revision、规范化输入摘要和授权 Scope。
- 不跨租户/项目复用受限内容；权限/许可/模型/策略/知识基线/源资产撤销时精准失效。
- 生成式高风险任务默认不语义缓存；Embedding/OCR/确定性抽取可按内容哈希精确缓存。
- Batch 将同 Capability/Policy/Deployment 的独立项分组，保留 item 级幂等、错误、Usage 和结果；部分失败不覆盖成功项，也不把批次标为全成功。

### D24.13 Guardrail 与数据边界

输入链：文件安全/媒体限制→授权/许可→PII/敏感工程信息识别→提示注入/恶意内容标记→大小/Schema。输出链：内容安全→Schema/类型→引用/来源→敏感信息→动作/URL/文件→业务质量门槛。

Guardrail 结果为 Allow、Transform、Review、Block；Transform 仅执行批准的脱敏/格式修复并保存前后摘要，不改变专业数值/事实。用户输入、检索文本、图纸文字均是不可信数据；不能通过“忽略规则”改变路由、工具或权限。

供应商 `trainingOptOut/retentionDays/region/subprocessors` 进入 DataHandlingPolicy 资格判断；不能验证的声明按最不利处理。

### D24.14 服务接口与事件

| 接口 | 关键输入 | 输出/约束 |
|---|---|---|
| `POST /ai-capabilities` | identity、owner、class | Draft Capability，不直接路由 |
| `POST /ai-capabilities/{id}/revisions` | schemas、quality/risk/data policy、SLO | 不可变 Revision 和校验报告 |
| `POST /model-deployments` | provider/model/region/endpointRef、capacity/price | Candidate Deployment，不接收明文密钥 |
| `POST /deployment-qualifications` | deployment、capabilityRevision、D28 release/eval | Draft/Active 资格和有效期 |
| `POST /routing-policies` | filters、scores、fallback/circuit | Draft Policy、模拟/评审后发布 |
| `POST /ai-invocations` | capabilityRevision、context、payload refs、SLO、idempotencyKey | Sync/Stream/Async Run；不接受任意 endpoint |
| `GET /ai-invocations/{id}` | runId | 状态、进度、安全摘要、Usage 和结果引用 |
| `POST /ai-invocations/{id}:cancel` | expectedRevision、reason | 取消状态及供应商处理结果 |
| `GET /ai-capabilities/{id}/routes:explain` | project/data/risk/slo 模拟上下文 | 候选过滤/评分，不暴露密钥/敏感价格 |
| `POST /budget-policies/{id}/adjustments` | scope、amount、period、reason | 审批工作流，不直接放大额度 |
| `POST /provider-incidents` | provider/deployment、scope、severity | 事件、熔断/恢复和影响分析 |
| `GET /ai-usage` | project/capability/provider/time、分页 | 权限裁剪的使用/成本/对账数据 |

事件：`CapabilityRevisionPublished/Suspended`、`DeploymentQualified/Degraded/Suspended/Recovered`、`RoutingPolicyPublished`、`AIInvocationAccepted/Started/Completed/Failed/Cancelled/GuardrailBlocked`、`BudgetThresholdReached/Exceeded`、`ProviderIncidentOpened/Resolved`、`UsageReconciliationFailed`。

### D24.15 界面与交互详细设计

| 界面 | 主区 | 关键操作 | 防错/反馈 |
|---|---|---|---|
| AI 能力目录 | 能力树、Revision、业务消费者、风险/质量/SLO、状态 | 查看、复制 Draft、提交评审 | 区分能力与模型；Active 只读 |
| 供应商/部署台账 | Provider/Model/Region/容量/价格/条款/健康、资格矩阵 | 注册、停用、维护窗口、查看限制 | 密钥只显示引用/轮换状态，不可回显 |
| 路由策略工作室 | 硬过滤、评分、粘性、回退、熔断、流量模拟 | 编辑 Draft、离线回放、灰度、发布 | 无合资格路线/静默降质规则阻断 |
| 调用追踪台 | Run 时间线、路由解释、Attempt、Guardrail、Usage、结果摘要 | 诊断、取消、受控重放、关联事件 | 内容默认脱敏；重放新建 Run/预算 |
| 预算与配额中心 | 层级预算、消耗/预测、软硬阈值、Top 消费者、对账 | 调整申请、冻结、导出 | 金额/币种/账期明确；禁止拆分绕过提示 |
| Guardrail 策略台 | 输入/输出控制、数据分类、测试样本、阻断/复核 | 测试、差异、发布/回滚 | 安全策略不能被普通路由降级 |
| 供应商事件中心 | 健康、错误率/时延、熔断、影响能力/项目、恢复步骤 | 宣告事件、切流、恢复验证、复盘 | 恢复前先健康+金丝雀，不手工改业务配置 |
| 使用与成本分析 | token/页/图/GPU/金额、质量/时延/缓存/回退 | 分析、预算预测、供应商对账 | 区分估算/实收、缓存节省与失败成本 |

### D24.16 组件技术栈方案

| 组件 | 推荐技术栈 | 职责 | 约束/替代 |
|---|---|---|---|
| AI 数据面网关 | Envoy AI Gateway；需要 OpenAI-compatible 归一化时在 Provider Adapter 后使用受控 LiteLLM Adapter | 供应商代理、流控、重试、流式和指标 | 每个 Profile 只有一个主数据面；业务策略不写死网关插件 |
| 能力控制面 | Java 21 + Spring Boot 4.1 + PostgreSQL | Capability/Deployment/Qualification/Route/Policy/Budget | 不可变 Revision、审计、乐观锁和 Outbox |
| Provider Adapter SDK | 平台 Canonical Adapter + OpenAPI/JSON Schema | 文本/视觉/图像/Embedding 等供应商映射 | 错误/token/流式/工具语义显式适配 |
| 本地推理 | vLLM/TGI/ONNX Runtime/Triton 按模型类型适配 | 私有/驻留/低时延部署 | 仅 Qualified 模型；GPU 配额和供应链扫描 |
| 策略引擎 | D39 OPA/Rego PDP | 数据/地区/用途/风险/预算硬决策 | 默认拒绝、策略版本入 Run；不并行引入 Cedar |
| Guardrail | 自研确定性校验 + PII/安全分类器 + D20 引用校验 | 输入/输出安全与契约 | 多层组合，不依赖单一 LLM 自审 |
| 异步编排 | D08 Workflow/队列、对象存储回调 | 大任务、批处理、取消、补偿和结果 TTL | item 级幂等和固定输入 |
| 密钥/身份 | Vault/KMS、云 Workload Identity、mTLS | 供应商凭据、轮换和服务身份 | 禁止业务数据库/日志存明文 Key |
| 缓存/限流 | Valkey 8.x（临时）+ 网关本地/分布式限流 | 精确缓存、幂等锁、令牌桶/并发 | 数据 Scope 入键；缓存非事实源 |
| 可观测 | OpenTelemetry、Prometheus/Grafana、日志/Trace 后端 | SLO、路由、尝试、成本和事件 | Prompt/响应默认不落日志，采样受策略控制 |
| FinOps | Usage Ledger + Price Revision + 账单导入适配 | 预留/结算/预测/对账 | Decimal、币种/税和供应商账单键 |

选型结论：控制面自建以承载项目/专业语义；默认数据面为 Envoy AI Gateway，LiteLLM 仅作为经资格验证的 Provider 协议适配器，不与 Envoy 并列承担业务控制面。Canonical Adapter/Policy/Usage 复用所有业务，落实 DRY；供应商和网关依赖倒置，落实 SOLID；首期不建设自研通用模型服务编排平台，落实 KISS/YAGNI。

### D24.17 安全、隐私与供应链

- Payload 使用 Asset 引用和短期签名访问；网关先验证 Scope，禁止服务器任意 URL 抓取、路径穿越和跨项目引用。
- Provider SDK/模型镜像/网关插件锁定版本、签名/SBOM/漏洞/许可证审计；升级先 D28 回归和灰度。
- Prompt/响应、Embedding 和缓存按敏感数据管理；生产调试内容访问需工单/审批/脱敏和短期保留。
- 防止模型路由越权、预算旁路、租户缓存污染、错误回显密钥、回调伪造、流式未审内容落库、供应商训练使用和跨境违规。
- 供应商退出/条款变化具备数据删除证明、结果/Usage 导出、Deployment Suspended 和替代评测计划。

### D24.18 可观测性、SLO 与异常恢复

追踪链：`tenant/project/workflow/task/capabilityRevision/invocationRun/attempt/deployment/policy`。核心 SLI：可用率、TTFT、完成时延、schema/guardrail/质量通过率、429/5xx、回退/熔断、token/媒体、单位成本、缓存和取消。

| 异常 | 处理 |
|---|---|
| 无满足数据策略的部署 | PolicyDenied/NoQualifiedRoute，不放宽地区/保留要求 |
| 预算预留失败 | BudgetExceeded；释放未消费预留并提示审批路径 |
| 多次超时/5xx | 有界重试→合资格回退→失败；记录总截止时间 |
| 流式中断/Schema 失败 | 结果 provisional/invalid，不进入业务工作流 |
| Usage 回执缺失 | Run 可完成但成本标 PendingReconciliation，追踪账单 |
| Provider 价格/条款变化 | 冻结新 Price/Policy Revision，影响分析后生效 |
| 资格/评测过期 | 从候选路线移除，存量 Run 按固定版本完成/取消 |
| 网关控制面不可用 | 数据面使用有期限已签名配置；过期后 fail closed |

### D24.19 指标与发布门禁

| 指标 | 定义/用途 |
|---|---|
| Qualified Route Coverage | 各能力/数据级别/SLO 有合资格路线比例 |
| Policy Denial Accuracy | 应拒/误拒样本上的策略准确性 |
| Invocation Success | 业务有效完成/接受调用，排除仅 HTTP 200 |
| Schema/Guardrail Pass | 最终结果契约与安全通过率 |
| Quality SLO Attainment | D28 在线代理/抽检达到 Capability 阈值比例 |
| Availability/Latency | 能力级成功、TTFT/完成 P50/P95/P99 |
| Retry/Fallback/Circuit | 重试、回退、熔断率及成功/质量/成本影响 |
| Budget Forecast Accuracy | 预测与实收成本偏差 |
| Usage Reconciliation | 平台 Usage 与供应商账单一致率 |
| Cache Hit/Savings | 合规缓存命中、时延/成本节省和失效准确性 |
| Data Policy Incident | 跨区、超保留、越权、训练使用等事件，目标为 0 |
| Provider Concentration | 关键能力单供应商/地区依赖风险 |

发布门禁：至少一条合资格主路线和经过演练的回退/明确不可用策略；权限/数据/地区/保留/缓存、幂等、429/5xx/超时、流式中断、预算、成本对账、密钥和供应商退出测试通过。

### D24.20 D24 验收条件（EARS）

- When 业务请求 AI, the 网关 shall 接收 CapabilityRevision 和规范化 Schema，不要求业务传供应商模型名。
- When 数据分类、许可、地区、保留或用途不满足, the 路由 shall 硬排除部署且不得由成本/时延评分覆盖。
- When ModelDeployment 未具有目标能力/数据切片的 Active Qualification, the 路由 shall 不向其发送生产请求。
- When 路由决策完成, the 网关 shall 保存候选、过滤原因、评分、预算/健康和最终 Deployment/Policy Revision。
- When 同一 idempotencyKey 与同一 payloadDigest 重试, the 网关 shall 返回原 Run/结果，不重复发起供应商调用。
- When 同一 idempotencyKey 携带不同 payloadDigest, the 网关 shall 返回冲突并拒绝执行。
- When 4xx/Policy/Schema 错误发生, the 网关 shall 不自动重试；when 429/5xx/瞬时网络错误发生, the 网关 shall 按有界退避/截止时间处理。
- When Guardrail 阻断, the 网关 shall 不通过切换供应商绕过并返回策略化拒绝/复核结果。
- When Fallback 触发, the 网关 shall 只选择满足相同契约/质量/数据策略的 Qualified Deployment，并向调用方标明回退。
- When 流式响应未完成最终 Schema/Guardrail 校验, the 平台 shall 标记 provisional，禁止其进入批准或外部动作。
- When 预算调用开始/结束, the 平台 shall 先预留后按标准化 Usage/价格版本结算或释放，并保存账单键。
- When 缓存命中, the 网关 shall 验证租户/项目 Scope、权限、资产/模型/策略版本和 TTL，不跨 Scope 复用。
- When ProviderIncident 或资格过期, the 控制面 shall 移除新路由、评估在途 Run 并按演练方案回退/失败。
- When AIInvocation 完成, the 平台 shall 保存能力、部署、策略、尝试、使用量、成本、Guardrail、结果/输入摘要和追踪 ID。
- When 高风险 AI 结果返回, the 平台 shall 保留既定人工复核/专业门禁，网关成功不得自动批准业务成果。

### D24.21 D24 完成检查与下游约束

| 检查项 | 结果 |
|---|---|
| 是否建立供应商无关 Capability Contract 与模型/部署资格 | 是 |
| 是否覆盖数据策略、路由、预算、限流、幂等、重试/回退/熔断 | 是 |
| 是否覆盖同步/流式/异步/批量、Guardrail、Usage 与成本对账 | 是 |
| 是否定义接口、事件、界面、技术栈、安全、SLO 和异常恢复 | 是 |

D24 对下游的强制约束：D25–D27 通过 Capability API 调用，不绑定供应商；D28 产生 DeploymentQualification 和质量阈值；D29 提供本地工具能力但不绕过网关审计；D35 固化 Invocation/Usage/Policy 事件；D37 实现能力/部署/路由/调用/预算/事件界面；D40 覆盖模型供应链、密钥、跨境、缓存和提示注入；D42 按能力 SLO/容量/成本规划；D44 提供故障注入与对账环境，D45 覆盖故障、幂等、策略和对账测试。

#### D24.21.1 AI 能力现实性校准（业界对标审计补充）

 **审计依据：** 2025–2026 建筑 AI 实际落地案例（Autodesk Forma AI、Hypar、Swapp、Kaedim、Pype AI、OpenSpace AI）、LLM 能力边界（GPT-4o/Claude 3.5 多模态）、附录 A 外部工具状态（均为 ManualHandoff）。以下不删除 D24 能力目录任何条目，仅为 V0 开发团队标注实际可用性。

**D24.4 能力类现实性分级：**

| 能力类 | 2025–2026 实际可用性 | V0 实现策略 | 实证/依据 |
|---|---|---|---|
| OCRDocument | ✅ 成熟可用 | V0 核心实现 | Azure Document Intelligence、AWS Textract、PaddleOCR 已在建筑图纸场景商用 |
| VisionUnderstanding | ✅ 基本可用（需人工复核） | V0 核心实现 | GPT-4o/Claude 3.5 可识别平面图元素，但置信度不稳定，必须 A1 建议辅助 |
| TextGeneration | ✅ 成熟可用 | V0 核心实现 | 摘要、说明生成、结构化草案已广泛商用 |
| Embedding | ✅ 成熟可用 | V0 可选（RAG 基础） | text-embedding-3-large、Cohere embed v3 等已成熟 |
| Reranking | ✅ 可用 | V1 引入 | Cohere Rerank、BGE-Reranker 等已商用，V0 可用简单相似度替代 |
| ClassificationExtraction | ✅ 基本可用 | V0 可选 | 构件/材料分类抽取在规范场景可行，但需训练数据 |
| ImageGeneration | ⚠️ 可用但质量不稳定 | V1 引入 | DALL-E 3/Midjourney/FLUX 可生成概念图，但建筑专业精度不足，仅作意向参考 |
| GeometryGeneration | ⚠️ 早期探索 | **设计预留，V2+** | Hypar/TestFit 可生成简单体量，但施工图级几何生成未成熟 |
| ToolPlanning (Agent) | ⚠️ 早期探索 | **设计预留，V2+** | 建筑领域 Agent 无成熟商用案例；D27 完整设计保留但 V0 不实现 |
| SafetyModeration | ✅ 成熟可用 | V0 轻量实现 | OpenAI Moderation、Azure Content Safety 可直接调用 |

**V0 AI 能力最小实现集：**

```text
V0 必须实现（3 项核心 AI 能力）：
1. OCRDocument —— 图纸/文档 OCR + 版面解析（D25 核心）
2. VisionUnderstanding —— 平面图元素识别 + 置信度（D25 + D09 场景）
3. TextGeneration —— 摘要/说明/结构化输出（全流程辅助）

V0 可选实现（1 项）：
4. Embedding + 基础检索 —— 规范 RAG（D20，不阻塞主链）

V0 明确不实现（设计预留）：
- ImageGeneration、GeometryGeneration、ToolPlanning、Reranking
- D24 中的完整路由/预算/多供应商切换/熔断机制
- D27 Agent 治理、D28 ML 生命周期完整流程
```

**V0 AI 网关简化实现（D24 裁剪）：**

D24 完整设计包含 20+ 领域对象和复杂路由策略。V0 只需实现：

| V0 实现 | V0 不实现（设计预留） |
|---|---|
| AICapability + CapabilityRevision（能力注册） | RoutingPolicy 复杂评分/粘性/负载 |
| AIInvocationRun + InvocationAttempt（运行记录） | BudgetPolicy 多维度预算/配额 |
| DataHandlingPolicy（数据策略基本字段） | DeploymentQualification 完整评测流程 |
| GuardrailPolicy（输入输出基本校验） | ResponseCacheEntry 语义缓存 |
| 单一 Provider 路由（无多供应商切换） | ProviderIncident 完整事件管理 |
| 人工复核门禁（高风险输出必须确认） | 自动熔断/降级/回退策略 |

**2025–2026 建筑 AI 实际可落地能力清单（基于公开案例）：**

| 能力 | 成熟度 | 典型产品/案例 | 本平台对应 |
|---|---|---|---|
| 图纸 OCR + 结构化解析 | 商用 | Azure DI、Pype AI、PlanGrid | D25 |
| 规范/标准 RAG 检索 | 商用 | ICC AI、UpCodes、高灯规范 AI | D20 |
| 设计摘要/报告生成 | 商用 | GPT-4o、Claude、通用 LLM | D24 TextGeneration |
| 平面图元素检测/分割 | 商用（需复核） | Maket、Swapp、 research | D25 + D09 |
| 概念图像生成 | 可用（非专业精度） | DALL-E 3、Midjourney、FLUX | D26（V1） |
| 碰撞检测/规则检查 | 成熟（非 AI） | Navisworks、Solibri、IDS | D19/D21（V2） |
| 参数化体量生成 | 早期 | TestFit、Hypar、Autodesk Forma | D26（V2+） |
| 施工图自动生成 | 研究阶段 | 无成熟商用产品 | D12（V3+） |
| 多专业协调 Agent | 概念阶段 | 无商用案例 | D27（V3+） |

