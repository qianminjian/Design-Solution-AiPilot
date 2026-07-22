# D27 Agent与工具调用治理

> 来源：@design/INDEX.md | 创建：2026-07-22 | 更新：2026-07-22
> 原始行范围：8056–8329
> 引用约定：同文件内引用使用 §编号，跨文件引用使用 @design/文件名.md

## D27 Agent 与工具调用治理

### D27.1 任务定义

| 项目 | 内容 |
|---|---|
| 任务目标 | 建立受业务工作流、最小权限、工具白名单、预算、审批、沙箱、记忆边界和停止策略约束的可审计 Agent 执行体系 |
| 直接产出 | Agent/工具/Run/Plan/Call/Approval/Memory/Handoff 对象、运行状态机、授权/审批、循环停止、接口、界面、技术栈和验收 |
| 成功对齐物 | 任一 Agent 动作可证明“代表谁、为何行动、看到什么、调用什么、谁批准、改变什么、何时停止、如何恢复” |
| 本任务不做 | 不赋予 Agent 独立业务身份或额外权限，不让 Agent 直接专业签审/发布/监管决策，不替代确定性 D08 工作流 |
| 主能力 | CAP-13.06、CAP-14.01–05、CAP-15.02/03，消费 D20/D24–D26，输出 AgentRun/ToolCall/Approval/Trace |

### D27.2 标杆依据与平台取舍

- Agent SDK 通常提供 loop、tools、handoffs、guardrails、sessions、human-in-the-loop 和 tracing；平台复用 SDK 执行能力，但不把授权/审批/审计委托给 SDK 内存状态。
- 部分 SDK 的 Guardrail 仅覆盖特定 function tool，托管工具、内置执行工具、Agent-as-tool 或 Handoff 可能走不同管线；平台在所有工具/转交外侧统一强制 Policy Enforcement。
- OWASP/NIST Agentic 风险聚焦 Tool Misuse、Excessive Agency、权限扩大、资源耗尽、不安全 Agent 间协议和供应链；工具 Scope、版本锁、沙箱、监测和 blast radius（影响半径）必须显式。
- 取舍：可预测跨系统流程用 D08 Workflow；Agent 处理不确定的解释/规划/候选步骤。关键状态迁移仍由确定性命令/API 完成。

### D27.3 核心原则

1. Agent 没有独立业务权限：有效权限=发起人/服务委托 Scope∩AgentRevision Scope∩ToolGrant∩当前项目策略。
2. Tool-first least privilege：按 Run 动态暴露最小工具/操作/资源，不把整个工具目录放进上下文。
3. Every action mediated：MCP、托管、本地、计算机操作、子 Agent/Handoff 均经过统一 PEP，不信任 SDK 默认覆盖。
4. Read→Propose→Approve→Execute→Verify 分层；高风险写操作不可在同一次模型输出中自批自执。
5. 计划是候选，不是权限；审批绑定规范化参数、目标版本和有效期，参数变化使批准失效。
6. 记忆是受 Scope/来源/TTL 管理的数据，不是隐式永久上下文；工具结果/外部文档均不可信。
7. 每个 Run 有步数、时间、token、工具、成本、并发和重复动作上限，以及明确成功/失败/停止条件。

### D27.4 Agent 使用场景与禁止边界

| 场景 | 允许 | 必须人工/确定性控制 |
|---|---|---|
| RequirementAssistant | 汇总、澄清候选、追踪建议 | 正式需求/基线批准 |
| DesignAssistant | 生成 D26 Problem/Study/候选、比较摘要 | 约束解释、候选选定和写回 |
| CoordinationAssistant | 聚类/路由 D19/D22 Finding、会议议题 | 严重度降低、豁免、关闭高风险 Issue |
| ComplianceAssistant | D20 检索、D21 规则草案/证据解释 | Rule 发布、合规 Decision、监管判断 |
| DeliveryAssistant | 检查清单、收集缺项、生成发布候选 | G5/G6/G7 门禁与签章发布 |
| OperationsAssistant | 诊断、查询监控、建议重试/扩容 | 生产变更、密钥、数据删除、事故关闭 |

禁止：替用户签名/审批、绕过 SoD、修改/删除已发布证据、直接执行任意 Shell/SQL/文件路径、凭内容指令扩大工具、向外部发送未批准数据、循环自委派规避预算/审批。

### D27.5 领域对象

| 对象 | 职责 | 关键内容 |
|---|---|---|
| AgentDefinition | 稳定 Agent 身份 | 名称、用途、所有者、场景、风险和生命周期 |
| AgentRevision | 不可变执行契约 | instructions、Capability、工具策略、Context/Memory、预算、停止和输出 Schema |
| AgentRun | 一次执行 | 发起身份、委托、目标、输入基线、Revision、状态、预算和结果 |
| AgentTurn | 单轮模型交互 | 输入摘要、模型 Run、输出、工具/审批意图、token 和时间 |
| AgentPlan | 计划候选 | goal、steps、依赖、预期工具/产物、风险、状态和 Revision |
| AgentStep | 可执行步骤 | 前置/完成条件、工具/Agent、输入输出、尝试和状态 |
| ToolDefinition | 稳定工具身份 | provider、用途、owner、riskClass、协议和生命周期 |
| ToolRevision | 不可变工具契约 | input/output schema、sideEffect、idempotency、权限、错误和版本 |
| ToolGrant | 一次授权能力 | principal、run/step、tool/operation、resource Scope、条件、TTL 和签名 |
| ToolCall | 单次调用事实 | normalized args、target version、policy、approval、attempt、result 和 effect |
| ActionApproval | 人工/策略批准 | actionDigest、参数/资源、风险、批准人、有效期、条件和状态 |
| ContextSnapshot | 本轮受控上下文 | sources、版本、Scope、摘要、token、redaction 和有效期 |
| MemoryRecord | 显式记忆 | fact/preference/decision/summary、source、Scope、confidence、TTL 和状态 |
| HandoffRecord | Agent 间转交 | from/to Revision、任务、最小上下文、工具/预算、理由和结果 |
| AgentBudget | 资源额度 | turns、tokens、time、tool calls、cost、parallelism、external effects |
| StopPolicy | 停止/中断规则 | success、failure、loop、budget、risk、human wait、kill switch |
| SandboxSession | 隔离执行环境 | image/manifest、filesystem/network/secret Scope、资源和销毁证据 |
| AgentArtifact | Agent 产物 | type、schema、AssetVersion、provenance、review 和业务状态 |
| AgentTrace | 全链追踪 | model/tool/handoff/guardrail/approval spans、redaction 和 retention |
| AgentIncident | 异常事件 | prompt/tool/权限/泄漏/循环/成本、影响、隔离、恢复和复盘 |

### D27.6 AgentRevision 契约

每个 Revision 定义：目标/非目标、允许项目/阶段/角色、D24 CapabilityRevision、系统指令来源、输入/输出 Schema、可发现 Tool 集/操作、每工具风险/审批策略、Context Builder、Memory Policy、Handoff Allowlist、AgentBudget、StopPolicy、人工接力和 D28 评测门槛。

指令分层且不可由低层覆盖：平台安全/法律→项目/业务策略→AgentRevision→Run 目标→用户输入/检索/工具结果（不可信数据）。动态指令必须由确定性函数基于已授权上下文生成并进入 Trace；不得从文档中的“系统提示”直接拼接。

### D27.7 Tool Contract 与风险分级

| 风险级 | 工具行为 | 默认策略 |
|---|---|---|
| T0 PureRead | 读取已授权、无副作用、低敏数据 | 可自动，仍校验 Scope/速率/输出 |
| T1 SensitiveRead/Compute | 敏感查询、模型/规范读取、昂贵计算 | Run Grant+预算；内容最小化/审计 |
| T2 CreateDraft | 创建 Draft/候选/任务，不改变批准事实 | 可策略批准；返回新 stableId/Revision |
| T3 UpdateControlled | 修改在途对象、分派、状态候选、写回预览 | 人工/策略批准+目标 Revision+幂等 |
| T4 ExternalEffect | 发消息、外部同步、文件写回、部署/采购动作 | 明确人工批准、影响预览、回执/补偿 |
| T5 Irreversible/Regulated | 删除、发布、签章、监管/专业决定、密钥 | Agent 禁止或仅准备人工执行包 |

ToolRevision 必须声明 sideEffect、read/write resource types、ABAC attributes、idempotency/retry、dryRun、preview、compensation、max batch、timeout、rate/cost、sensitive fields 和 audit fields。无 Schema/副作用声明的工具不能进入生产目录。

### D27.8 统一工具调用 PEP

1. Agent 输出结构化 `ToolIntent`，运行时不执行自由文本命令。
2. 解析 ToolRevision，规范化/严格校验参数，拒绝额外字段、任意 URL/路径/SQL/Shell。
3. 根据委托身份重算 D04 Policy；校验 ToolGrant、资源 Scope、目标 Revision/状态、D24 数据/预算。
4. 执行输入 Guardrail：提示注入、敏感数据、批量大小、业务不变量、风险和冲突。
5. 生成 actionDigest；按风险决定 AutoApprove、HumanApproval、Deny。审批前展示影响预览和不可逆性。
6. 批准后、执行前再次校验参数摘要、权限、版本、TTL、预算和 kill switch，防止 TOCTOU（检查与使用时差）。
7. 在沙箱/受控 Adapter 调用，保存 Attempt、幂等键、供应商请求 ID、超时和成本。
8. 输出 Guardrail 校验 Schema、权限/敏感内容、回执和实际副作用；将不可信结果封装为 Observation。
9. Agent 只能消费裁剪后的 Observation；领域事实由目标服务持久化，Agent 不直接改数据库。

### D27.9 计划、执行状态机与恢复

```text
Created → ContextReady → Planning → PlanReview(optional) → Running
→ WaitingApproval / WaitingHuman / WaitingExternal
→ Running → Verifying → Completed
任一活动态 → Pausing → Paused → Resuming
任一活动态 → Cancelling → Cancelled / Failed / Terminated
```

AgentPlan 支持运行中修订，但必须解释偏离、重新评估风险/预算；已批准 Step 参数变化需要新批准。D08 Workflow 拥有长期业务状态，AgentRun 是其中可重放的受控活动；等待超过 Run TTL 时持久化 ContextSnapshot 并释放计算资源。

恢复固定 AgentRevision、模型/工具版本和已完成副作用；先对账 ToolCall 回执/幂等键，再继续，避免重复写操作。

### D27.10 审批与职责分离

ActionApproval 绑定 agentRunId、stepId、toolRevision、normalizedArgsDigest、resource IDs/expectedRevision、影响预览、有效期和批准条件。`approve similar` 只能生成明确规则/Scope/次数/时限的 Policy Grant，不能永久放行自由参数。

| 动作 | 审批要求 |
|---|---|
| 只读/低敏计算 | 满足政策可自动，审计抽样 |
| 创建 Draft/候选 | 项目策略自动或责任人批量批准 |
| 修改状态/责任/模型预览 | 对象所有者/专业角色批准，绑定 Revision |
| 外部通知/BCF/CDE 写入 | 内容/收件人/附件/目标系统预览后批准 |
| 候选写回、例外、严重度降低、关闭 | 专业/治理角色按 D19–D26 原流程批准 |
| 发布、删除、签章、监管/密钥 | Agent 不执行，仅准备操作包 |

Agent 自己、同一模型生成的 Reviewer Agent 或工具返回不得充当人工批准。审批拒绝/超时进入替代计划、人工接力或停止，不允许改写参数反复诱导批准。

### D27.11 Context 与 Memory 治理

Context Builder 按任务检索最小必要内容：固定 Requirement/Knowledge/Model/Drawing/Issue/Study 版本、用户输入和工具 Observation；保存来源引用与裁剪原因。上下文窗口不足时优先保留系统/政策、当前目标/计划、已批准决定、未完成副作用和证据，摘要不能丢失否定/数值/权限。

Memory Scope：Run（默认）、Task/Workflow、Project、UserPreference、OrganizationKnowledge。写入 Project/Organization 需提议→来源校验→人工/策略批准；个人偏好不能覆盖项目规范。MemoryRecord 状态 Proposed、Verified、Active、Superseded、Expired、Revoked。

禁止记忆密钥、Token、未脱敏个人/合同数据、模型隐藏推理、未经确认工具输出和外部注入指令。来源撤销/权限变化触发 Memory 失效和受影响 Run 评估。

### D27.12 Handoff 与多 Agent 协作

- Handoff 目标必须在 AgentRevision Allowlist 且具有独立用途/工具/评测；不动态创建任意高权限 Agent。
- 传递最小任务包：goal、完成/停止条件、已固定来源、允许 Scope、预算、已完成副作用、未决审批和输出 Schema；不默认转发全部会话/工具结果。
- 接收 Agent 重新执行权限/数据策略；Handoff 不继承超出目标 Revision 的 ToolGrant。
- 父子预算守恒，子 Agent 消耗计入父 Run；深度、并发、往返次数和同目标重复转交有限制。
- Manager/Reviewer Agent 只能提出质量意见；高风险专业审批仍由人类角色。

### D27.13 循环检测、停止与 Kill Switch

StopPolicy 至少包含：maxTurns、maxModelCalls、maxToolCalls、maxSameToolArgs、maxHandoffDepth、maxWallTime、maxCost、maxExternalEffects、noProgressTurns、deadline 和 success/failure predicates。

循环指纹由 AgentRevision+goal/step+toolRevision+normalizedArgsDigest+targetRevision+ObservationDigest 构成。相同/等价调用重复、A↔B Handoff、计划反复改写无新证据、错误后只改措辞均触发 no-progress。处理顺序：提示自纠一次→切换确定性恢复/人工→停止；不能靠增加预算无限重试。

Kill Switch 分 Deployment/Capability/AgentRevision/Tool/tenant/project/global 层级；触发后拒绝新调用、取消安全可取消任务、冻结外部副作用、保留证据并转事件响应。

### D27.14 沙箱、本地工具与副作用

SandboxSession 使用批准镜像/manifest；默认只读临时文件系统、无网络、无宿主设备/剪贴板/凭据。按 ToolCall 挂载最小 Asset 副本、允许域名/端口、CPU/GPU/内存/磁盘/进程/时间，完成后销毁并保存产物哈希。

Shell/SQL/浏览器/桌面自动化不作为通用工具暴露；由参数化高层 Tool 封装（如 `validate_ifc(assetVersionId)`、`preview_revit_integration(packageId)`）。确需计算机操作时限定应用/窗口/文件/操作，录像/截图受隐私策略，任何外部提交前审批。

副作用工具采用 Preview→Approval→Execute→Receipt→Verify/Compensate；补偿不是回滚保证，工具需声明不可逆部分。

### D27.15 服务接口与事件

| 接口 | 关键输入 | 输出/约束 |
|---|---|---|
| `POST /agent-definitions` | identity、purpose、owner、risk | Draft Definition |
| `POST /agent-definitions/{id}/revisions` | instructions、capability/tools/context/memory/budget/stop/schema | 不可变 Revision 和静态验证 |
| `POST /agent-runs` | agentRevision、delegation、goal、inputs、idempotencyKey | 异步 Run、固定身份/基线/预算 |
| `GET /agent-runs/{id}` | runId、trace/detail mode | 状态、计划、步骤、预算、审批和产物 |
| `POST /agent-runs/{id}/commands` | expectedRevision、pause/resume/cancel/terminate | 受控运行命令和原因 |
| `POST /agent-runs/{id}/messages` | message、attachments、expectedState | 等待人工时补充，不直接改计划权限 |
| `POST /tool-definitions/{id}/revisions` | schema、sideEffect、auth/idempotency/approval/compensation | 不可变 ToolRevision |
| `POST /tool-grants` | principal/run/step、tool/operation/resources、conditions/ttl | 签名最小授权 |
| `POST /tool-calls:preview` | run/step、toolRevision、args | actionDigest、影响/风险/审批要求 |
| `POST /action-approvals/{id}/commands` | approve/reject/revoke、conditions | 授权角色决定、TTL 和签名 |
| `GET /agent-traces/{id}` | traceId、redaction/detail mode | 权限/保留裁剪的 spans/事件 |
| `POST /memory-records/{id}/commands` | verify/activate/supersede/revoke | 记忆治理，不直接接受模型写入 |
| `POST /agent-incidents` | run/tool/provider、type/severity/evidence | 隔离/kill switch/响应工作流 |

事件：`AgentRevisionPublished/Suspended`、`AgentRunCreated/Started/Paused/WaitingApproval/Completed/Failed/Cancelled/Terminated`、`PlanRevised`、`ToolCallProposed/Approved/Denied/Started/Completed/Failed/Compensated`、`HandoffStarted/Completed/Rejected`、`MemoryProposed/Activated/Revoked`、`LoopDetected/BudgetExceeded/KillSwitchActivated`。

### D27.16 界面与交互详细设计

| 界面 | 主区 | 关键操作 | 防错/反馈 |
|---|---|---|---|
| Agent 目录 | Agent/Revision、用途/非目标、风险、工具/权限、评测/消费者 | 查看、复制 Draft、提交发布 | 能力与业务权限分开展示；Active 只读 |
| 工具与授权目录 | Tool/Revision、Schema、副作用、风险、审批/幂等/补偿、使用者 | 注册、测试、停用、授予 Scope | T5 禁止标识；无副作用声明禁发布 |
| Run 控制台 | 目标、计划/步骤、模型/工具/Handoff 时间线、预算、状态 | 暂停/恢复/取消/终止、人工消息 | 显示“代表谁”和有效 Scope；内容脱敏 |
| 审批收件箱 | 动作/参数/资源/目标版本、影响预览、风险、相似历史、TTL | 批准/拒绝/条件批准/撤销 | 参数变化自动失效；禁止模糊“全部允许” |
| ToolCall 追踪 | PEP 决策、输入/输出 Guardrail、Attempt、回执/副作用/补偿 | 诊断、受控重试、关联事件 | 原始敏感值默认隐藏；重试新审计记录 |
| Context/Memory 检视 | 本轮来源/摘要/裁剪、Memory Scope/来源/TTL/状态 | 验证、纠正、撤销、查看影响 | 不展示隐藏推理；注入/未验证醒目标记 |
| Agent 图与 Handoff | 父子 Agent/预算/工具/上下文流、深度/循环 | 查看、停止子 Run、重分派人工 | 权限不随边扩张；循环路径高亮 |
| 事件与 Kill Switch | 循环/越权/泄漏/成本/工具异常、影响 Run、隔离/恢复 | 激活/解除、调查、恢复演练 | 解除需双人授权和健康验证 |

### D27.17 组件技术栈方案

| 组件 | 推荐技术栈 | 职责 | 约束/替代 |
|---|---|---|---|
| Agent Runtime | LangGraph（单 Run 内执行图）+ Temporal（跨小时/人工等待业务流程） | loop、结构输出、工具、Handoff、暂停恢复 | 授权/审批/事实不依赖 SDK 内存；其他 SDK 仅作资格替代，不并行运行 |
| Agent 控制面 | Java 21 + Spring Boot 4.1 + PostgreSQL | Definition/Run/Plan/Grant/Approval/Memory/Incident | 不可变 Revision、状态机、审计/Outbox |
| LLM/能力 | D24 Capability API | 模型路由、预算、Guardrail、Usage | Agent 不直接持供应商 Key/模型名 |
| Tool Gateway/PEP | 独立 Tool Dispatcher + D39 OPA/Rego PDP | Schema、授权、审批、幂等、执行/输出 Guardrail | 覆盖 MCP/Hosted/Local/Handoff 全部路径 |
| Tool Protocol | OpenAPI/JSON Schema、gRPC；MCP 作为受控 Adapter | 工具发现/调用/结果 | 服务器/工具 allowlist、版本/身份/Scope 固定 |
| Workflow | D08 持久化 Workflow/队列 | 长期状态、等待审批、重试/补偿、人工接力 | Agent 是 Activity，不拥有业务 Saga |
| Sandbox | 可信确定性任务使用 restricted container；不可信 Parser/代码/第三方模型使用 Kata Containers MicroVM Profile | 本地代码/文件/浏览器隔离 | 未知可执行内容禁止只用普通容器；最小挂载/网络/密钥、资源限额 |
| Secret/Identity | Vault/KMS、Workload Identity、mTLS、短期委托令牌 | Tool 身份和凭据 | Agent/Prompt/Trace 不见明文凭据 |
| Context/RAG | D20 检索+版本化 Context Builder | 最小来源、引用、摘要和权限裁剪 | 外部内容不可信、ACL 每次重算 |
| Memory | PostgreSQL+搜索索引（仅显式 MemoryRecord） | Scope/来源/TTL/撤销和检索 | 向量库非事实源，不存隐藏推理/密钥 |
| Tracing/Policy | OpenTelemetry + Agent span adapter + 审计存储 | model/tool/handoff/approval/成本和事件 | 敏感 Trace 默认关闭内容或脱敏 |
| Eval/安全 | D28 MLflow/Eval Harness + Agent 场景模拟器 | 任务成功、工具选择、越权、循环、注入和恢复 | 发布前/在线抽检、独立红队 |

首期以 D08 Workflow+单 Agent Runtime+统一 Tool PEP 为主，不建设自由自治多 Agent 网络；统一 Grant/Approval/Trace/Memory 避免 SDK 各自实现，落实 DRY；Runtime/Tool/MCP 均适配隔离，落实 SOLID；限制高层工具和短链路，落实 KISS/YAGNI。

### D27.18 安全、异常与恢复

| 异常/攻击 | 处理 |
|---|---|
| Prompt/Tool Output 注入 | 标记不可信、结构隔离、PEP 重验；不能新增工具/权限 |
| Tool 参数越权/路径/URL 注入 | Schema+Scope+allowlist 拒绝并记录 Incident |
| 审批后参数/目标变化 | actionDigest 不匹配，批准失效并重新预览 |
| 重复/未知副作用 | 查幂等/回执；ToolCall 结果为 UnknownEffect 时将外部 Operation 标记 ReconciliationRequired，冻结后续依赖并人工对账 |
| Agent 循环/no-progress | 自纠一次→人工/确定性恢复→StopPolicy 终止 |
| 预算/截止时间耗尽 | 停止新模型/工具，保存 Context/部分产物并接力 |
| Handoff 深度/往返超限 | 拒绝转交，回父 Agent/人工并解释 |
| Memory 污染/来源撤销 | Revoked、重建 Context、影响 Run/决定审计 |
| Runtime/Worker 崩溃 | 从持久状态恢复、对账副作用后续跑，不重放已完成写调用 |
| 越权/泄漏/异常外部动作 | Kill Switch、撤销 Grant/凭据、隔离 Run、事件响应和通知 |

### D27.19 指标与发布门禁

| 指标 | 定义/用途 |
|---|---|
| Task Success/Quality | 场景金样完成且业务验证通过比例 |
| Tool Selection Accuracy | 应选/不应选工具与参数正确率 |
| Policy/Approval Accuracy | 应拒/应批/误拒/误批样本准确性 |
| Unauthorized Effect | 未授权/超 Scope 副作用次数，目标 0 |
| Human Escalation Quality | 正确时机、完整上下文和一次解决率 |
| Loop/No-progress Rate | 循环触发、平均停止步数和误报 |
| Budget/SLA Attainment | turns/token/time/tool/cost 和截止目标达成 |
| Tool Error/Unknown Effect | 调用失败、未知副作用、补偿/对账成功率 |
| Handoff Success/Depth | 转交成功、上下文遗漏、平均深度/往返 |
| Memory Precision/Freshness | 被验证有用/错误/过期/撤销 Memory 比例 |
| Trace Completeness | model/tool/approval/handoff/副作用完整记录率 |
| Incident/Recovery | 越权/注入/泄漏/成本事件及发现/隔离/恢复时长 |

发布门禁：正常/失败/审批拒绝/超时/崩溃恢复；直接/间接提示注入、工具输出注入、参数/路径/URL、越权/跨租户、审批 TOCTOU、重复副作用、循环/Handoff 逃逸、预算/kill switch、Memory 污染和敏感 Trace 测试全部通过。

### D27.20 D27 验收条件（EARS）

- When AgentRun 创建, the 平台 shall 固定 AgentRevision、委托身份/Scope、目标、输入版本、预算、StopPolicy 和 D24 Capability/Policy。
- When Agent 发现工具, the 平台 shall 仅暴露当前 Run/Step 获准的 ToolRevision/operation，不返回全局目录。
- When 任一 MCP/托管/本地/子 Agent 工具调用, the 平台 shall 经统一 PEP 执行 Schema、权限、Grant、审批、幂等、预算和 Guardrail。
- When Agent 提出工具调用, the 平台 shall 规范化参数并绑定目标资源/expectedRevision 后生成 actionDigest。
- When 审批后的参数、资源、版本、权限或 TTL 变化, the 平台 shall 使批准失效并重新预览/审批。
- When T4/T5 或项目定义高风险动作被请求, the 平台 shall 要求明确人工批准或拒绝 Agent 执行。
- When ToolCall 重试, the 平台 shall 使用幂等键/回执先对账副作用；效果未知时冻结依赖步骤。
- When 工具结果/文档包含指令, the 平台 shall 将其视为不可信 Observation，不改变 AgentRevision、权限或停止策略。
- When Handoff 发生, the 平台 shall 校验目标 allowlist、重新计算权限、传递最小上下文并保持父子预算守恒。
- When Agent 重复等价调用、往返 Handoff 或无新证据改写计划, the 平台 shall 触发 no-progress/loop 处理并有界停止。
- When 预算、截止、最大副作用或 Kill Switch 触发, the 平台 shall 停止新动作、保存状态/证据并安全取消或人工接力。
- When MemoryRecord 提议跨 Run/项目保存, the 平台 shall 要求来源、Scope、置信、TTL 和验证，不保存密钥/隐藏推理/未验证指令。
- When Runtime 恢复 AgentRun, the 平台 shall 固定版本并先对账已执行 ToolCall，禁止重复外部副作用。
- When Agent 生成专业决定/候选写回/发布建议, the 平台 shall 只创建 Draft/审批请求，不绕过 D05/D19–D26 的人工门禁。
- When AgentRun 结束, the 平台 shall 保存计划/偏离、model/tool/handoff/approval、预算/Usage、产物、停止原因和裁剪 Trace。

### D27.21 D27 完成检查与下游约束

| 检查项 | 结果 |
|---|---|
| 是否定义 Agent/Plan/Tool/Grant/Approval/Context/Memory/Handoff/Trace | 是 |
| 是否覆盖统一 PEP、工具风险、审批/SoD、幂等/副作用和沙箱 | 是 |
| 是否覆盖预算、循环/停止、Kill Switch、恢复和人工接力 | 是 |
| 是否定义接口、事件、界面、技术栈、安全和发布门禁 | 是 |

D27 对下游的强制约束：D28 评测 Agent 任务/工具/安全/成本并灰度发布；D29–D33 的本地/专业工具只能经 ToolRevision/PEP；D35 固化 Agent/Tool/Approval/Trace 事件；D37 实现 Run/审批/Trace/Memory/事件界面；D38 发送等待审批/SLA/事件通知；D40 覆盖 Agentic Threat Model；D42 规划模型/工具/沙箱容量；D44 提供隔离执行环境，D45 建立 Agent 场景、注入、副作用与恢复测试。

