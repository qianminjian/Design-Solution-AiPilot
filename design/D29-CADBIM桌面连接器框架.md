# D29 CADBIM桌面连接器框架

> 来源：@design/INDEX.md | 创建：2026-07-22 | 更新：2026-07-22
> 原始行范围：8677–8947
> 引用约定：同文件内引用使用 §编号，跨文件引用使用 @design/文件名.md

## D29 CAD/BIM 桌面连接器框架

### D29.1 任务定义

| 项目 | 内容 |
|---|---|
| 任务目标 | 建立云端控制面—本地代理—创作工具插件三层连接器框架，安全执行版本化读取/预览/写回任务并回传可验证成果 |
| 直接产出 | 连接器 SDK、设备/插件/工具/文档会话、任务/租约/事务、离线/升级/诊断、接口、界面、技术栈和验收 |
| 成功对齐物 | 任一桌面操作可追溯用户/设备/插件/工具/文档版本、任务/批准、事务结果和输出哈希，失败可恢复/回滚 |
| 本任务不做 | 插件不保存平台业务事实、不直接连接数据库、不允许任意远程桌面/Shell、不自动升级生产插件或覆盖用户文件 |
| 主能力 | CAP-14.01/02/03、CAP-15.02/03，消费 D07/D08/D24/D27，作为 D30–D33 的统一 SDK/运行时 |

### D29.2 标杆依据与平台取舍

- Revit 通过 `.addin` Manifest 加载 IExternalApplication/IExternalCommand，命令在宿主 API 上下文执行；AutoCAD 使用 `.bundle/PackageContents.xml`、受信路径/SECURELOAD 和数字签名；Rhino Yak 按 Rhino/平台分发标签打包。
- 插件生命周期、线程/事务、文档锁和可用 API 由宿主工具控制，云端不能假设可在任意时刻调用；本地代理负责排队，插件在合法 UI/API 上下文领取执行。
- 桌面登录采用系统浏览器 OAuth 2.0 Authorization Code+PKCE/OIDC；浏览器不可用设备可走批准 Device Code。插件不保存供应商/平台长期密钥。
- 取舍：云端只下发高层签名 OperationPlan；插件实现工具特定 Adapter。通用协议、授权、任务、诊断和升级由 SDK 统一。

### D29.3 核心原则

1. 插件是执行边界，不是事实源；权威状态在平台聚合，工具文档是专业源资产，结果以新 AssetVersion 回传。
2. 用户在场优先：写操作必须在明确文档/版本、合法宿主上下文和批准/预览下执行。
3. Pull+lease：本地代理/插件领取获准任务，不接受互联网任意反向命令或开放监听端口。
4. 高层 operation allowlist：参数化 API 替代 Shell/脚本/SQL/任意文件路径；D27 PEP 仍对所有任务生效。
5. 事务、Undo/备份、输出验证和回执是写回的一部分；“API 返回成功”不等于文件已可靠保存/上传。
6. 插件/代理/依赖/兼容矩阵签名并固定；升级可灰度/回滚，旧版本有明确支持窗口。
7. 离线不扩大权限；只执行已下载、未过期、可离线且无外部高风险副作用的任务。

### D29.4 三层架构与责任

| 层 | 组件 | 责任 | 禁止 |
|---|---|---|---|
| Cloud Control Plane | Connector Registry/Task/Policy/Artifact/Upgrade 服务 | 注册、路由、授权、签名任务、状态/证据和升级策略 | 不直接操作本地文件/宿主 API |
| Local Agent | 守护/托盘应用 | 登录/设备证明、任务 Pull/缓存、插件 IPC、文件/上传、诊断/更新 | 不解析业务审批、不持长期业务事实 |
| Host Plugin | Revit/AutoCAD/Rhino/SU/ArchiCAD 插件 | UI、文档/选择、合法 API/事务、预览/执行/Undo、结果提取 | 不直连云数据库、不运行任意远程代码 |
| Optional Headless Worker | Automation/Compute/命令行宿主 | 无人值守批处理（工具允许时） | 不伪装交互插件，不绕许可证/用户批准 |

### D29.5 领域对象

| 对象 | 职责 | 关键内容 |
|---|---|---|
| ConnectorDefinition | 稳定连接器身份 | tool family、owner、capabilities、risk 和 lifecycle |
| ConnectorRevision | 不可变 SDK/能力契约 | operations、protocol/schema、compatibility、security、status 和 hash |
| ToolCompatibility | 工具兼容项 | product/edition、OS/arch、version/update、API/runtime、locale 和 status |
| PluginPackage | 可分发包 | binary/manifest/dependencies、platform tag、signature/SBOM、channel 和 hash |
| LocalAgentPackage | 本地代理包 | OS/arch、service/UI components、signature/SBOM、channel 和 version |
| DeviceRegistration | 设备身份 | deviceId、tenant/user/org、certificate/public key、posture 和 status |
| ConnectorInstallation | 安装事实 | device、package、tool compatibility、path/channel、health 和 lastSeen |
| UserConnectorSession | 用户连接会话 | principal、device、OAuth grant、Scope、start/expiry 和 status |
| HostApplicationSession | 宿主会话 | tool/version/process、plugin、capabilities、UI state 和 heartbeat |
| DocumentSession | 文档会话 | canonical path/fileId、AssetVersion、document GUID、read/write/dirty/lock 和 user |
| ConnectorTask | 云端任务 | operation、inputs、target version、risk/approval、deadline、status 和 result |
| TaskLease | 领取租约 | task、installation/session、lease token、expiry、attempt 和 heartbeat |
| InputPackage | 本地输入包 | asset refs、hash、Scope、encryption、dependencies、expiry 和 cache policy |
| OperationPlan | 确定性操作计划 | connector/operation revision、normalized args、preconditions、steps 和 digest |
| UserConsentRecord | 本地用户确认 | preview/action digest、document、scope、user、time/expiry 和 decision |
| ConnectorTransaction | 宿主事务 | document state、operations、undo/backup、commit/rollback 和 errors |
| OperationReceipt | 执行回执 | actual changes、object mappings、warnings、host journal、duration 和 signature |
| OutputPackage | 输出包 | files/data/objects/logs、hash、schema、validation、encryption 和 upload |
| OfflineQueue | 离线队列 | allowed tasks/events、local encrypted state、expiry、order 和 status |
| DiagnosticBundle | 诊断包 | versions/config/health/redacted logs/minidump consent、hash 和 retention |
| UpgradeCampaign | 升级活动 | package/channel/cohort、prerequisites、rollout/stop/rollback 和 metrics |
| ConnectorRevocation | 撤销事实 | device/install/package/session/cert、reason、scope、time 和 cleanup |

### D29.6 连接器能力与 Operation Contract

统一能力：HostInfo、DocumentOpen/Save/Export、SelectionRead/Highlight、ObjectQuery、View/SheetQuery、PreviewChanges、ApplyChanges、ValidateDocument、CreateOutput、Diagnostics。各 ConnectorRevision 声明实际支持和限制。

OperationRevision 必须包含严格 input/output JSON Schema、riskClass（D27 T0–T5）、read/write Scope、host/UI/document prerequisites、thread/transaction model、idempotency、dryRun/preview、max objects/files、timeout/cancel、undo/backup、error mapping、expected outputs 和 telemetry。工具私有字段放在命名空间 Adapter，不污染统一核心。

写操作必须支持 `expectedDocumentIdentity/AssetVersion/documentFingerprint`；目标不匹配返回 Conflict，不自动对“当前打开文档”执行。

### D29.7 身份、设备与会话

- 安装后本地代理生成设备密钥/证书，DeviceRegistration 经用户/组织批准、设备姿态和条件访问；私钥存 OS Keychain/TPM，不导出。
- 用户通过系统浏览器 OIDC Authorization Code+PKCE 登录；Token 由受支持身份库保存在 OS 安全存储，插件通过本地代理获取短期会话能力，不见 Refresh Token。
- 后台无人值守 Worker 使用 Workload Identity/证书和专门服务主体，不复用用户 Token。
- UserConnectorSession 与 HostApplicationSession/DocumentSession 分离；用户注销/权限撤销立即停止新任务并清除缓存/短期令牌。
- Local Agent↔Plugin 使用命名管道/Unix Domain Socket，双向进程/包签名验证、会话 nonce 和最小本地 ACL；不监听公网 TCP。

### D29.8 任务状态机与租约

```text
Created → PolicyChecked → Ready → Leased → Downloading → AwaitingHost
→ Previewing → AwaitingConsent → Executing → Validating → Uploading → Completed
任一执行前状态 → Expired/Cancelled
执行后异常 → Operation Failed / ReconciliationRequired；ConnectorEffectStatus 保存 Conflict / UnknownEffect / RolledBack / NeedsRecovery
```

- 云端创建任务时固定 Connector/Operation Revision、InputPackage、目标版本、actionDigest、D27 Grant/Approval 和截止时间。
- Agent Pull 时按安装/工具/版本/用户/文档/能力路由；TaskLease 有短 TTL/heartbeat，同任务同一活动租约。
- 租约丢失不立即重派写任务；先等待客户端回执/对账，避免重复副作用。
- 进度事件幂等且单调；客户端时钟不作权威顺序，使用 server sequence。
- 完成需 OperationReceipt+OutputPackage 校验/上传/新 AssetVersion 创建；无法确认效果时 ConnectorEffectStatus=UnknownEffect，Operation=ReconciliationRequired 并进入人工恢复。

### D29.9 文档身份、文件与锁

DocumentIdentity 由工具原生 GUID/云文档 ID、规范化真实路径、文件系统 ID（适用）、内容/中央模型指纹、版本/工作共享信息组合；仅文件名不足。macOS/Windows 路径解析使用真实路径/大小写/符号链接规范化，防止路径穿越。

- 打开前校验 InputPackage hash、依赖/Xref/Link/字体/族/插件，工作目录为任务专属。
- 读取任务可对当前未保存文档运行时，结果标记 dirty/unsaved fingerprint，默认不能形成发布证据。
- 写任务要求目标文档权限/锁/checkout/工作集和 expected version；用户正在编辑/命令中时等待合法 idle context。
- 不覆盖源文件：优先工具 Transaction/Undo+新 SaveAs/云版本；必须原地修改时先备份并经策略/用户确认。
- 上传完成前本地输出加密；成功/过期/撤销后按保留策略安全清理。

### D29.10 Preview、事务、执行与回滚

1. 插件验证 OperationPlan 签名/hash、版本、Schema、Grant/Approval 和 Host/Document prerequisites。
2. 在只读分析/临时 Transaction/文档副本生成 Preview：对象/参数/图层/视图/文件变化、警告、不可逆项和预计时间。
3. 本地用户确认绑定 previewDigest/actionDigest；云端高风险审批在执行前重验。
4. 在宿主允许线程/事件/Transaction 中分批执行；每批保存 operation index/object mapping/错误。
5. 失败按工具能力回滚 Transaction/Undo/恢复备份；部分不可逆则停止，保存 ConnectorEffectStatus=UnknownEffect/NeedsRecovery，并把 Operation 转为 ReconciliationRequired。
6. Commit 后重查对象/文档状态、运行验证/保存/导出；生成 Receipt 和 OutputPackage。
7. 云端校验并创建新 AssetVersion/映射/事件；后续专业检查由 D18–D26 触发。

用户手工 Undo/修改在上传前发生时，插件重新计算结果指纹；与 Receipt 不一致则 Conflict，不上传"计划结果"。

宿主线程模型与 ExternalEvent 队列：CAD/BIM 宿主 API 普遍要求模型修改在主线程同步执行，不允许后台线程直接调用。插件采用 HostThreadMarshal 模式：Agent/Plugin 进程将 OperationPlan 分解为 HostOpStep 序列，通过 ExternalEvent 队列投递到宿主主线程，由注册的 IExternalEventHandler（Revit）/ ContextTransactionManager（AutoCAD .NET）/ ACAPI 回调（ArchiCAD）逐条执行，每步完成后回传 StepResult 和对象映射。队列必须支持取消、优先级（Preview > Execute > Validate > Export）、空闲上下文检测（等待宿主不在命令/对话框/弹窗中）和单步超时（默认 30s，可按 OperationProfile 覆盖）。当宿主进入模态对话框或长时间命令时，队列暂停并通知 Agent，不因超时强制中断导致文档损坏。Revit 场景下 IExternalEventHandler.Raise 必须在合法 Revit API 上下文内触发；插件不得通过 Windows 消息钩子或计时器绕过 ExternalEvent 机制直接修改模型。

### D29.11 文件/对象传输与缓存

- 大文件采用分块上传/下载、内容 hash、断点续传、预签名短期 URL、并发/带宽限制和端到端加密；URL 限定对象/方法/大小/hash/TTL。
- InputPackage Manifest 列出主文件、依赖、相对安全路径、hash、size、MIME、版本和必需性；解包后 realpath 必须在任务根目录。
- 对象级 payload 使用稳定 ObjectRef/IFC GUID/工具 UniqueId；插件返回新旧映射、Split/Merged/Deleted/Unmapped。
- 本地缓存以 tenant/project/asset/hash Scope 隔离并加密，只是可删除副本而非权威证据；Legal Hold 仅约束服务端事实与证据保存，不能阻止终端在撤权、任务到期、用户退出或设备隔离时擦除本地缓存。离线授权携带绝对到期时间和撤权水位，缓存 TTL 不得超过授权/任务/设备证书中的最短期限；重连后先同步撤权水位再允许读取。
- 插件不扫描全盘寻找文件/字体/族；缺依赖只在批准目录/Package/工具库中解析。

### D29.12 离线与断网恢复

离线允许：查看已缓存授权资产、执行明确 `offlineAllowed` 的只读/本地 Draft 任务、保存本地结果/事件。离线禁止：新权限决定、高风险写回/外部发布、过期 Grant/Approval、跨项目数据、需云端最新锁/基线的操作。

OfflineQueue 加密并按 server sequence/idempotencyKey 同步。重连顺序：刷新身份/设备姿态→撤销/权限/任务状态→上传事件/回执→处理版本冲突→上传产物。云端 Task 已取消/过期时本地结果作为 UnattachedDraft，不能自动写入权威项目。

### D29.13 插件 SDK 与适配器接口

SDK 模块：IdentityClient、TaskClient、HostAdapter、DocumentAdapter、SelectionAdapter、OperationRegistry、TransactionAdapter、ArtifactTransfer、Telemetry/Diagnostics、UpdateClient、UI Components。

HostAdapter 必须实现：`getHostInfo()`、`getCapabilities()`、`getSessionState()`、`invokeOnValidContext()`、`subscribeLifecycle()`；DocumentAdapter 实现 identity/fingerprint、open/dirty/lock、query/selection、preview/apply/validate/save/export/undo。实际方法以 D35 契约定义，禁止插件绕过 Task/PEP 暴露远程任意调用。

扩展 Operation 需 Manifest、Schema、风险/权限、兼容矩阵、金样、事务/错误/诊断和 D28 Qualification；专业包 D17 通过注册扩展，不修改 SDK Core。

### D29.14 升级、兼容与撤销

- Package 采用语义版本+构建 hash+签名；ToolCompatibility 精确到产品/主次版本/更新/OS/架构/.NET/Python/插件依赖。
- Release channel：Internal→Pilot→Stable→LTS；UpgradeCampaign 分 cohort，先 Agent 再/后 Plugin 的顺序由协议兼容范围决定。
- 更新下载签名 Manifest/包，验证发行者证书/hash/SBOM；安装前确认宿主关闭/可热更能力，保存旧包用于回滚。
- 强制更新仅用于已评估 Critical 安全风险，经批准维护窗执行；普通更新由用户/IT 管理确认，不在工具运行时静默替换。
- 协议支持 N-1/N 范围；不兼容版本停止新写任务但保留诊断/安全退出。
- 撤销设备/证书/包/版本后拒绝新租约、终止会话、清 Token/缓存，保留审计和恢复说明。

### D29.15 诊断、隐私与支持

默认 Telemetry：版本/能力、状态/错误码、耗时/资源、Task/Trace ID、对象计数和 hash；不采集模型几何、图纸文字、文件路径/用户名、命令历史和截图。需要内容/崩溃转储时展示范围、脱敏、用户同意、工单、TTL 和上传目标。

DiagnosticBundle 分 Basic/Extended/Crash，包含配置摘要、兼容/签名/依赖、健康检查、经脱敏日志、宿主 Journal 引用和复现步骤；敏感字段本地预览/删除。Support 只能通过短期授权访问已上传 Bundle，不能远程浏览设备文件。

### D29.16 服务接口与事件

| 接口 | 关键输入 | 输出/约束 |
|---|---|---|
| `POST /connector-definitions/{id}/revisions` | operations/protocol/compat/security、package refs | 不可变 Revision/校验 |
| `POST /connector-devices:register` | device key/posture、user/org proof | Pending/Active Registration 和证书 |
| `POST /connector-sessions` | device/user OAuth、agent/plugin/host info | 短期 Session/允许能力 |
| `POST /connector-sessions/{id}/heartbeats` | state、host/document summaries、health | 租约/撤销/升级指令摘要 |
| `POST /connector-tasks` | connector/operation、inputs/target、grant/approval、deadline | 签名 Task/OperationPlan |
| `POST /connector-tasks:lease` | installation/session/capabilities、max tasks | TaskLease 或空，不泄露其他任务 |
| `POST /connector-task-leases/{id}/events` | sequence、state/progress/error/receipt refs | 幂等单调事件 |
| `POST /connector-tasks/{id}:cancel` | reason、expectedRevision | 取消意图/客户端确认 |
| `POST /connector-output-packages` | task/lease、manifest/hash/schema | 分块上传会话和校验结果 |
| `POST /connector-tasks/{id}:complete` | receipt/outputPackage/validation | 完成或返回 ConnectorEffectStatus=Conflict/UnknownEffect；外部 Operation 映射 ReconciliationRequired |
| `POST /connector-diagnostics` | installation/session、level、consent/manifest | 短期上传与 Support Scope |
| `POST /upgrade-campaigns` | packages/cohort/channel/rollout/stop/rollback | Draft 活动和审批 |
| `POST /connector-revocations` | target/scope/reason/effectiveAt | 撤销和清理指令 |

事件：`ConnectorRevisionPublished`、`DeviceRegistered/Revoked`、`InstallationSeen/Unhealthy`、`HostSessionStarted/Ended`、`DocumentSessionOpened/Changed/Closed`、`IntegrationJobQueued/Started/Completed/Failed/ReconciliationRequired/Cancelled`、`ConnectorEffectRecorded/Reconciled`、`OutputPackageAccepted/Rejected`、`UpgradeStarted/Paused/RolledBack/Completed`。`ConnectorTask` 只作为 IntegrationJob 的执行子类型，不再建立平行外部事件状态机。

### D29.17 界面与交互详细设计

| 界面 | 主区 | 关键操作 | 防错/反馈 |
|---|---|---|---|
| 插件内任务面板 | 登录/项目、当前文档身份/版本/dirty/lock、任务队列/风险 | 领取、打开详情、预览、同意/拒绝、取消 | 文档/目标版本不符禁执行；高风险醒目标识 |
| 插件内变化预览 | 对象/参数/视图/文件差异、警告/不可逆、事务/回滚 | 过滤、定位对象、确认/返回修改 | actionDigest/审批/本地确认绑定；禁止模糊全选 |
| 插件内状态/诊断 | Agent/Plugin/Host/Session、网络/缓存、进度/错误、支持 | 重试安全步骤、导出/上传诊断、注销 | 内容采集单独同意；显示离线/过期权限 |
| 连接器管理台 | Definition/Revision、Operation/风险、兼容矩阵、包/签名/SBOM | 注册、测试、发布/停用 | 无金样/签名/事务语义禁发布 |
| 设备/安装中心 | 设备/用户/姿态、安装/工具/版本、会话/最后在线、撤销 | 批准、隔离、撤销、要求更新 | 不回显设备密钥；跨用户/租户分离 |
| 任务运维台 | Task/Lease/文档/状态/进度、Attempt/Receipt/Output、错误 | 取消、对账、人工恢复/关联 Incident | 写任务租约丢失不直接重派 |
| 升级活动中心 | channel/cohort、兼容/前置、部署/健康/崩溃、停/回滚 | 灰度、暂停、扩组、回滚 | 宿主运行/维护窗/签名失败阻断 |
| 支持诊断中心 | Bundle level/同意/脱敏、版本/依赖/日志/崩溃、TTL | 分派、查看授权内容、关闭/删除 | 禁止远程浏览设备；访问到期自动失效 |

### D29.18 组件技术栈方案

| 组件 | 推荐技术栈 | 职责 | 约束/替代 |
|---|---|---|---|
| SDK Core | 宿主指定 .NET/Framework 适配 Windows 工具；C++/Python/JS/Ruby 绑定按宿主 | 协议、身份、任务、传输、诊断、UI 契约 | Revit/AutoCAD 等插件严格跟随厂商 Support Matrix；Core 不引用业务领域 |
| Local Agent | 独立 Windows Agent 默认 .NET 10 LTS/WinUI 3；macOS Swift/.NET 适配 | OAuth/设备、Pull/IPC、缓存/传输、更新/诊断 | 宿主内插件可保留厂商要求的 .NET 8/Framework；不开公网端口、不持长期业务事实 |
| Host Plugin | Revit/AutoCAD .NET，RhinoCommon，SketchUp Ruby/C++，ArchiCAD C++ | 宿主 UI/API/事务/对象映射 | D30–D32 逐工具固定版本/线程模型 |
| IPC | Named Pipes/Unix Domain Socket + protobuf/gRPC framing | Agent↔Plugin 本地双向通信 | OS ACL、nonce、包/进程身份、消息限额 |
| Cloud Control | Java 21 + Spring Boot 4.1 + PostgreSQL/Valkey/对象存储 | Registry/Device/Session/Task/Lease/Upgrade/Receipt | Valkey 仅租约/限流，事实入 PostgreSQL |
| API/Event | D35 REST/gRPC/Event + JSON Schema/Protobuf | 云/Agent/Plugin 契约和兼容 | version negotiation、幂等、签名 |
| Identity/Secret | OIDC/OAuth PKCE、Device Code、mTLS、OS Keychain/TPM、Vault/KMS | 用户/设备/服务身份和短期令牌 | 禁止嵌入 client secret/长期 Token |
| Artifact Transfer | S3 multipart/presigned URL、AES-GCM、hash | 大文件/包/诊断断点续传 | Scope/method/size/hash/TTL 限定 |
| Package/Update | MSIX/MSI/Autodesk Bundle/Rhino Yak/平台签名 Manifest | 分发、channel、升级/回滚 | 用户/IT 策略、签名/SBOM、维护窗 |
| Observability | OpenTelemetry、本地结构日志/崩溃收集适配 | Task/IPC/Host/传输/升级追踪 | 默认无模型/路径/截图/Token |
| Test Harness | 宿主版本 VM 矩阵、假 Host Adapter、契约/回放/故障注入 | SDK/插件/协议/事务/升级回归 | 外部 API Mock、金样文档隔离 |

统一 SDK/Task/Receipt/Package 协议避免每个工具重复建设，落实 DRY；HostAdapter/Operation 扩展隔离，落实 SOLID；Local Agent 不承担业务流程，落实 KISS；只实现 D30–D32 确认工具，避免假设所有 CAD，落实 YAGNI。

### D29.19 安全、异常与恢复

| 异常/威胁 | 处理 |
|---|---|
| 假冒 Agent/Plugin/设备 | mTLS/设备证书+包/进程签名+会话 nonce，拒绝并 Incident |
| Task/Plan 篡改或重放 | 签名/hash/nonce/expiry/idempotency/actionDigest 校验 |
| 路径穿越/符号链接/Xref 越界 | realpath 双侧归一化+任务根白名单+Manifest 路径 |
| 宿主忙/命令中/模态窗口 | 等待合法 API context/用户操作，不注入 UI 线程 |
| 文档版本/锁/dirty 冲突 | Conflict/等待/SaveAs 预览，不强制覆盖 |
| 插件/Agent 崩溃 | 任务租约对账、宿主 Transaction/Undo/备份恢复、诊断 |
| 网络断开/上传中断 | 分块续传、OfflineQueue；写结果不重复执行 |
| 更新包签名/兼容失败 | 阻断安装、保留旧版本、暂停 Campaign |
| 输出/回执与实际文档不一致 | ConnectorEffectStatus=UnknownEffect/NeedsRecovery、Operation=ReconciliationRequired，冻结下游并人工核验 |
| 设备丢失/用户离职/凭据泄露 | 撤销证书/Session/Installation、清缓存/Token、影响审计 |

### D29.20 指标与发布门禁

| 指标 | 定义/用途 |
|---|---|
| Installation/Session Health | 兼容安装、在线会话、心跳/错误比例 |
| Task Success/Lead Time | 按 operation/tool/version 的完整成功和耗时 |
| Preview-to-Execute | 预览后批准/拒绝/修改、误预览比例 |
| Conflict/Unknown Effect | 版本/锁/文档/副作用不确定比例，目标持续降低 |
| Transaction Rollback | 执行失败后的回滚/恢复成功率 |
| Artifact Integrity | 输入/输出 hash/schema/版本校验通过率 |
| Lease/Idempotency | 租约丢失、重复领取/执行/副作用防止率 |
| Offline Sync | 离线任务成功、冲突、过期和同步时长 |
| Crash/Host Impact | 插件/代理崩溃和宿主启动/性能影响 |
| Upgrade Adoption/Failure | channel 覆盖、安装/回滚/崩溃和协议兼容 |
| Diagnostic Resolution | 一次诊断解决率、Bundle 生成/脱敏/TTL 合规 |
| Security Incident | 签名/路径/身份/越权/凭据/数据泄漏事件，目标 0 |

ConnectorRevision/Package 发布门禁：签名/SBOM/许可证、工具/OS/更新兼容矩阵、认证/撤销、协议 N-1/N、文档/锁/事务/Undo、崩溃/断网/租约/幂等、路径/Xref/恶意包、离线、升级/回滚、性能和诊断隐私测试通过。

### D29.21 D29 验收条件（EARS）

- When 设备/安装首次连接, the 平台 shall 验证用户/组织、设备密钥/姿态、Agent/Plugin 签名和 ToolCompatibility 后创建短期会话。
- When 桌面用户登录, the 连接器 shall 使用系统浏览器 Authorization Code+PKCE/OIDC 或批准 Device Code，不嵌入长期 client secret。
- When ConnectorTask 创建, the 平台 shall 固定 Connector/Operation Revision、输入/目标版本、Grant/Approval、actionDigest、截止和幂等键。
- When 本地代理领取任务, the 平台 shall 校验安装/会话/工具/文档/能力并签发短期单一活动 TaskLease。
- When 写操作执行前, the 插件 shall 验证文档身份/fingerprint、权限/锁/dirty、Plan 签名、审批/同意和 Host context。
- When Preview 与执行参数/目标版本变化, the 插件 shall 使 UserConsent/Approval 失效并重新预览。
- When 宿主工具支持事务/Undo, the 插件 shall 在受控 Transaction 中执行并保存 commit/rollback/对象映射和错误。
- When 租约/网络在写操作后中断, the 平台 shall 先对账 Receipt/幂等/文档效果，不直接重派任务。
- When 输出上传, the 连接器 shall 使用受限分块会话校验 Manifest、hash、size、schema、加密和来源 Task/Lease。
- When 实际文档状态与 OperationReceipt 不一致, the 平台 shall 保存 ConnectorEffectStatus=Conflict/UnknownEffect、将 Operation 标记 ReconciliationRequired，并禁止创建已验证成果。
- When 离线, the 连接器 shall 只执行未过期 `offlineAllowed` 任务，不执行需最新权限/锁/高风险外部副作用的操作。
- When 插件/代理升级, the 系统 shall 验证签名/SBOM/兼容/维护窗并灰度发布，失败时保留/回滚旧包。
- When 设备/包/证书/会话撤销, the 系统 shall 拒绝新租约、终止会话、清短期令牌/缓存并保留审计。
- When 诊断内容超出基础元数据, the 插件 shall 获取用户同意、展示/脱敏范围、设置工单/TTL 并禁止远程浏览设备。
- When ConnectorTask 完成, the 平台 shall 保存设备/用户/工具/插件/文档、Plan/Consent/Transaction/Receipt/Output、验证和 Trace。

### D29.22 D29 完成检查与下游约束

| 检查项 | 结果 |
|---|---|
| 是否定义 Cloud—Local Agent—Host Plugin 三层和统一 SDK | 是 |
| 是否覆盖设备/用户/宿主/文档会话、Task/Lease/事务/回执 | 是 |
| 是否覆盖文件/对象传输、离线、升级/回滚、撤销和诊断 | 是 |
| 是否定义接口、事件、界面、技术栈、安全、异常和门禁 | 是 |

D29 对下游的强制约束：D30–D33 复用 SDK/Task/Receipt，仅实现工具 Adapter；D34 持久化连接器聚合/租约/审计；D35 固化云—代理—插件协议；D37 实现插件/运维/升级/支持界面；D40 覆盖设备、插件供应链、文件/IPC/路径/凭据威胁；D42 规划文件/任务/许可证/桌面并发；D44 建立工具版本 VM 与资格环境，D45 执行事务/断网/升级测试并验证签名包和灰度 Campaign；D46 运营兼容、健康和支持。

