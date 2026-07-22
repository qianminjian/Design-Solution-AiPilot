# D30 Revit与APS集成

> 来源：@design/INDEX.md | 创建：2026-07-22 | 更新：2026-07-22
> 原始行范围：8948–9252
> 引用约定：同文件内引用使用 §编号，跨文件引用使用 @design/文件名.md

## D30 Revit/APS 集成

### D30.1 任务定义

| 项目 | 内容 |
|---|---|
| 任务目标 | 在 D29 框架内建立 Revit 交互 Add-in、APS Automation、Data Management/Model Derivative/Viewer/AEC Data Model 的版本化集成 |
| 直接产出 | Revit/APS 对象、操作矩阵、事务/工作共享、RVT/RFA/RTE、Automation/Viewer/数据流程、接口、界面、技术栈、计费/限流和验收 |
| 成功对齐物 | 每次读取、自动化或写回均固定 Revit/Engine/Add-in/AppBundle/API/文件版本、工作共享状态、APS 区域和结果证据 |
| 本任务不做 | 不假设 APS 能替代全部 Revit API，不直接修改 AEC Data Model，不自动 Sync/Publish 云模型，不绕 Autodesk 许可证/用户权限 |
| 主能力 | CAP-14.01/02、CAP-15.02/03，消费 D29 SDK，服务 D12–D26 的 Revit/Autodesk 场景 |

### D30.2 标杆依据与平台取舍

- Revit 模型修改必须位于支持的 API workflow 和 Transaction；外部线程/任意 modeless 调用不能直接开启事务，插件使用 ExternalEvent/合法回调切回 Revit 主 API 上下文。
- Worksharing 的本地/中央/Server/Cloud、Workset、元素借用、Reload Latest/Synchronize with Central 和 Detached 状态影响可写性；同步中央是独立高风险操作。
- APS Design Automation 使用 Engine+AppBundle 定义 Activity，WorkItem 提供一次输入/参数/输出并计费；AppBundle/Activity/Engine 版本必须显式固定。
- Model Derivative 将 RVT/复合模型转换为 SVF2/属性等派生，Viewer 负责 Web 展示；派生不是权威 RVT，转换警告/链接丢失需记录。
- AEC Data Model 以 GraphQL 查询发布 Revit 版本的构件/属性，按只读、地区/订阅/版本受限能力使用；字段弃用要求适配层和契约测试。

### D30.3 核心原则

1. 三路径分离：Interactive Add-in 处理用户在场/复杂写回；Design Automation 处理批准的无人值守批任务；APS Data APIs 处理云端只读/派生。
2. 版本不可隐式升级：RVT 主版本、Revit API/.NET、插件、DA Engine/AppBundle/Activity、Viewer/Derivative 和 GraphQL Schema 均进入兼容矩阵。
3. 任何写回固定 DocumentIdentity/AssetVersion/WorksharingContext，并在 TransactionGroup/Transaction 中预览、执行、验证、Undo/回滚。
4. ElementId 不是跨版本唯一事实；使用 Revit UniqueId、External/IFC GUID、平台 ObjectRef 和 D18 IdentityMap 组合。
5. RVT/RFA/RTE 语义分开；Family/Template 变更不能按 Project Model 普通对象处理。
6. APS 区域、Hub/Project/Item/Version、OAuth Principal 和数据驻留固定；不将 OSS URN/Access Token 暴露给无权客户端。
7. 429/5xx/异步状态/计费由 D08/D24 式治理；失败或转换缺失不能返回空集合冒充成功。

### D30.4 集成路径与能力矩阵

| 路径 | 适用 | 读 | 写 | 用户/成本边界 |
|---|---|---|---|---|
| Revit Add-in | 当前打开模型、选择、预览、细粒度事务、交互修复 | 完整 Revit API（受文档/权限） | Transaction/ExternalEvent | 用户在场；占用桌面/许可证 |
| APS Design Automation for Revit | 批量检查、参数化修改、导出、族/模板处理 | Engine 支持的 Revit API/输入包 | 输出新文件，不原地改云权威版本 | 无 UI；WorkItem 计费/配额/Engine 限制 |
| Data Management | Hub/Project/Folder/Item/Version/上传下载 | 文件/版本元数据与内容 | 新版本/文件（受 OAuth） | 不理解 Revit 内部对象 |
| Model Derivative | Web viewable、属性、几何、导出派生 | RVT/复合包翻译 | 仅生成派生 | 异步、计量/限流、转换损失 |
| APS Viewer | 2D/3D 查看、选择、剖切、Markup/Issue 上下文 | SVF/SVF2/属性 | 不写 RVT；Markup 另存平台对象 | 短期 Token、前端数据暴露控制 |
| AEC Data Model | 发布 Revit 版本构件/属性查询/版本比较 | GraphQL 只读 | 当前不作为写路径 | Revit/地区/订阅/激活/Schema 限制 |

### D30.5 领域对象

| 对象 | 职责 | 关键内容 |
|---|---|---|
| RevitConnectorProfile | Revit Adapter 配置 | operation 集、transaction/worksharing、export、mapping 和版本 |
| RevitCompatibility | 精确兼容项 | Revit edition/year/build、API/.NET、OS、Add-in/DA Engine 和 status |
| RevitAddInPackage | 插件包 | `.addin`、assemblies/dependencies、signature/SBOM、channel 和 hash |
| RevitHostContext | 宿主执行上下文 | application/document/view/selection、command/event、UI/idle 和 capabilities |
| RevitDocumentIdentity | 文档身份 | type、path/cloud GUID/item/version、central/local、fingerprint 和 format year |
| WorksharingContext | 协作状态 | mode、central/cloud、worksets、ownership/checkout、latest/sync、detached 和 user |
| RevitOperationRevision | Revit 操作契约 | command、input/output、risk、prerequisites、transaction、validation 和 mapping |
| RevitTransactionPlan | 事务计划 | group/transactions/subtransactions、failure handling、commit/rollback 和 preview |
| RevitElementMapping | 对象映射 | platformRef、UniqueId/ElementId/IFC GUID、document version、status 和 confidence |
| RevitFailureRecord | Revit Failure 处理 | definition/severity、elements、resolution policy、user decision 和 outcome |
| RevitExportProfile | 导入/导出配置 | IFC/DWG/PDF/NWC/gbXML/image、view/sheet、units/coords、options 和 version |
| RevitFamilyPackage | RFA 资产 | category/family/type、parameters/connectors、host/behavior、preview、version 和 approval |
| RevitTemplatePackage | RTE/模板资产 | units/styles/views/filters/schedules/families/standards、version 和 approval |
| APSProjectBinding | 平台—Autodesk 项目绑定 | account/hub/project/folder、region、tenant、principal policy 和 status |
| APSItemVersionRef | Docs 文件版本引用 | project/item/version URN、name/type、createdBy/At、storage、hash 和 lineage |
| DAAppBundleVersion | Automation 包 | engine、bundle/code/dependencies、alias/version、signature/SBOM 和 status |
| DAActivityVersion | Automation 函数定义 | engine/AppBundle、commandLine、parameters、settings、timeouts 和 version |
| DAWorkItemRun | 一次 Automation | Activity、input/args/output URLs、status、report、cost、callback 和 retries |
| DerivativeJob | Model Derivative 任务 | input URN/root file、formats/views、region、status、warnings 和 cost |
| DerivativeManifest | 派生清单 | SVF2/2D/metadata/properties/exports、status、hash、translator 和 losses |
| AECDataSnapshot | AEC Data 查询基线 | project/design/elementGroup/version、schema/query、cursor、result hash 和 coverage |
| APSViewerSession | Viewer 会话 | derivative/version、token scope/expiry、extensions、state、markup/selection 和 user |
| APSUsageRecord | Autodesk API 用量 | service/operation、units、subscription/price revision、cost、project 和 requestId |

### D30.6 Revit Add-in 生命周期与线程模型

- IExternalApplication OnStartup 注册 Ribbon/ExternalEvent/事件订阅；OnShutdown 注销并释放资源。启动阶段不下载/执行动态代码，不阻塞 Revit。
- IExternalCommand 用于用户明确发起的同步命令；modeless 面板请求经 ExternalEvent 排队，在 Revit 合法 API 上下文执行。
- 后台线程只能做不访问 Revit API 的网络、解析和计算；传入后台的数据是不可变 DTO/几何副本，返回后重新验证文档/元素 Revision。
- DocumentOpened/Closing/Saved/Synchronized/Idling 等事件只记录轻量状态/调度，不在回调内长耗时或隐式修改模型。
- 一次 ConnectorTask 绑定 HostApplicationSession+DocumentSession；用户切换文档/视图或进入模态命令时暂停/重新验证。

### D30.7 Transaction 与 Failure Handling

| 情况 | 事务策略 |
|---|---|
| 只读查询/预览 | 不开 Transaction；必要时 temporary transaction 必须 RollBack |
| 单原子修改 | 一个 Transaction，失败全回滚 |
| 多批可独立修改 | TransactionGroup + 多 Transaction；预设 all-or-nothing 或 partial policy |
| 局部尝试/几何探测 | SubTransaction，结果不合格立即回滚 |
| 跨文档修改 | 每文档独立事务/Receipt，不宣称跨文档 ACID；D08 Saga/补偿 |

FailurePreprocessor 只能对批准的可预测 Warning 执行确定性处理；Error/未知 Warning 保存 RevitFailureRecord 并回滚/用户决定。禁止全局删除 Warning。Commit 后再读取对象/文档状态、Regenerate（必要时）和 D21/D22 适用验证。

### D30.8 工作共享与云模型

- 打开时识别 Standalone、Local/Central、Revit Server、Cloud Workshared、Detached、Transmitted；不同模式使用不同 DocumentIdentity/保存策略。
- 写前检查 IsModifiable/ReadOnly、元素/Workset ownership、EditableWorksets、out-of-date/central access、用户身份和 Sync 权限。
- 默认只 Checkout 目标元素/Workset 最小集合；借用失败返回具体 owner/object，不自动接管。
- Reload Latest/Synchronize with Central 是独立 T4 Operation，需要影响预览/用户批准、Relinquish 策略、评论、超时/锁处理和回执；一般写 Task 不能隐式 Sync。
- Detached/临时副本输出不得上传覆盖 Central/Cloud Item；作为新 Draft AssetVersion 并明确来源。
- Cloud Model 使用 Autodesk Project/Model GUID 与 Docs Item/Version 映射；本地缓存路径不是身份。

### D30.9 元素、参数与对象映射

- 参数标识优先 ForgeTypeId/BuiltInParameter/Shared Parameter GUID/Definition+Group；仅本地化显示名不稳定。
- 记录 Instance/Type、StorageType、Spec/Unit、raw internal value、display value、readOnly/formula、source 和 document version。
- Element 映射优先 Revit UniqueId+DocumentIdentity；ElementId 仅会话/版本内辅助；IFC GUID/企业 ID/ExternalId 与平台 ObjectRef 并列。
- Copy/Monitor、Groups、Design Options、Phases、Linked RVT、Parts、Assemblies、Fabrication、系统/连接器、临时/视图相关元素声明支持边界。
- 删除/重建、Group/Array、Type change 产生 Replaced/Split/Merged/Ambiguous；几何相似不能自动继承 Issue/Quantity 身份。

### D30.10 RVT 项目模型处理

RVT 读取范围：项目/场地/坐标、Levels/Grids、Categories/Types/Instances、Rooms/Spaces、Systems/Connectors、Materials、Phases/Options、Links、Views/Sheets/Schedules/Annotations、Worksets/Warnings 和 ProjectInfo。

写操作白名单按阶段逐步开放：设置已批准参数→创建/更新受控类型/实例→生成 View/Sheet/Schedule/Annotation→应用 IntegrationPackage→批量 Export。每类 Operation 定义对象上限、Transaction、Failure、Preview 和回滚。

保存策略：SaveAs 新文件/新 Docs Version 优先；覆盖/Sync 需独立批准。升级旧 RVT 主版本是不可逆语义变化，必须复制、固定目标 Revit Engine、生成升级报告/备份，不覆盖源。

### D30.11 RFA 族处理

RevitFamilyPackage Manifest：Family/Category/Template/host type、type catalog、parameters/shared GUID、formulas、materials、connectors、nested/shared families、visibility/LOD、units、origin/reference planes、version/size/performance 和 license。

流程：隔离打开→版本/模板/类别/损坏检查→类型/参数/连接器/几何/嵌套提取→D21 企业规则/金样→生成预览/性能报告→批准入库。LoadIntoProject 前比较同名 Family/Type/Shared Parameter；覆盖策略 KeepExisting、AddMissing、ApprovedReplace，禁止默认覆盖所有类型/参数。

族生成/修改优先参数化模板和确定性 Revit API/Dynamo/DA；AI 只建议参数/几何候选。RFA 升级和项目加载分别产生 Receipt/ObjectMapping。

### D30.12 RTE 模板与项目标准

RTE 包含单位、对象样式、线型/填充、材料、视图模板、Filter、Browser Organization、Sheet/Titleblock、Schedule、Project/Shared Parameters、Families、Phases、Export Setup 等。

模板不直接“应用”到既有项目：生成 TemplateDiff，按可迁移资源分类 Copy/Map/Manual/Unsupported，识别同名不同 GUID/定义/依赖。新项目创建固定 RTE Version；既有项目标准迁移使用独立 IntegrationPackage/Transaction/验证，不全量覆盖。

模板发布需空项目创建、专业样例、升级、语言/单位、工作共享、打印/导出和性能回归。

### D30.13 APS Design Automation

1. 发布签名 DAAppBundleVersion：Revit Add-in/依赖/PackageContents，扫描 SBOM/许可证并在目标 Engine 测试。
2. 发布不可变 DAActivityVersion：Engine alias/具体版本、AppBundle、commandLine、input/output JSON/File 参数、timeout 和 settings。
3. 创建 DAWorkItemRun，使用短期受限 Input/Output URL、固定 Activity Version/args/idempotency；预估/预留用量。
4. APS 异步执行；使用 callback/webhook+签名/幂等，轮询仅作恢复；收集 status/report/时间/资源。
5. 下载输出前校验 hash/MIME/大小/文件内部版本，运行 Revit/业务验证；成功才创建 AssetVersion。
6. 429/5xx/timeout 有界重试；WorkItem 是否已执行不明时先按 run/request ID 对账，避免重复收费/副作用。

Automation 不依赖 UI、当前选择或用户桌面；输入包必须含全部链接/族/字体/参数文件/配置。需要 Central/Cloud Sync、交互对话或未支持 API 的任务转 Add-in。

### D30.14 Data Management 与 Docs 版本

- APSProjectBinding 将平台 tenant/project 与 Autodesk account/hub/project/folder/region 一对一/受控多绑定，记录管理员批准和 OAuth Principal 模式。
- 用户代理访问用 3-legged/OBO（实际支持范围按 APS）；后台服务用 2-legged 且只授应用被授权项目/Scope。Token 由服务端持有。
- Item 是逻辑文件，Version 是不可变版本；平台 AssetVersion 绑定具体 APSItemVersionRef，不绑定“Item 最新”。
- 上传新版本采用 storage/upload→create version 的幂等流程，保存 requestId/URN/hash/creator；并发目标版本变化进入 Conflict。
- Webhook 事件只作变更提示，服务端回查版本/权限；去重、乱序、重放和失联补偿由 SyncCursor/定期 reconciliation 处理。

### D30.15 Model Derivative 与复合 Revit

DerivativeJob 固定 input version URN、region、rootFilename/压缩包 Manifest、output formats（SVF2/IFC/DWG 等按支持能力）、views/advanced options 和 translator version/observed fingerprint。

复合 RVT 需打包 root+linked RVT/依赖，安全相对路径和 hash 完整；缺链接、坐标/单位、未解析外部引用和转换 warning 进入 DerivativeManifest。不能用 viewer 里“看起来正常”证明全部对象/属性已转换。

异步状态 Submitted/InProgress/Success/Partial/Failed；Manifest item 级 Success/Failure/Warning。Partial 不进入 D18/D22 确定性用途，除非用途策略明确接受并列缺失范围。

### D30.16 APS Viewer

- Viewer Token 由后端签发最小 `viewables:read/data:read` 类 Scope（按 APS 实际权限），短期且绑定用户/项目/Version；不把 client secret/长期 Token 放前端。
- Viewer Session 固定 DerivativeManifest/SVF2，不解析 Item 最新；加载前服务端鉴权，外部分享使用 D39 独立策略。
- 扩展：selection/isolation、section、measure、property、model browser、2D/3D、Markup/Issue/BCF、D18 Federation/D19/D22 Overlay。扩展版本固定并通过 CSP/SRI/供应链审查。
- Viewer dbId 只在具体 derivative 内有效；映射 APS externalId/Revit UniqueId/平台 ObjectRef，跨版本用 D18 Map。
- Measure/截图/Markup 是派生协作数据，保存单位/精度/相机/选择/Version；不能修改 RVT。

### D30.17 AEC Data Model API

- 用途：固定发布 Revit 版本的 element/property definitions、分类/参数查询、唯一值、缺失/异常和版本分析；不作为写回或完整几何/标注替代。
- AECDataSnapshot 保存 GraphQL document/hash、variables、design/elementGroup/version、schema/field mapping version、cursor pages、coverage、errors 和 result hash。
- 查询采用字段 allowlist、复杂度/分页/超时/速率限制；禁止将用户任意 GraphQL 直接透传。
- Revit Element ID 等弃用字段经 Adapter 规范化到 alternative identifiers；字段/Schema 变化触发契约测试和 ConnectorRevision。
- 服务未激活、地区/订阅/Revit 版本不支持时明确 CapabilityUnavailable，回退到 Add-in/Derivative/DA 必须重新评估数据/成本，不静默切换。

### D30.18 版本、区域、限流与成本

| 维度 | 控制 |
|---|---|
| Revit | 年版+完整 Build/API/.NET，升级文件不可逆；维护 N/N-1 由项目基线决定 |
| DA Engine | 具体 Engine alias/version 与 AppBundle/Activity 兼容，alias 解析结果入 Run |
| APS API | endpoint/API version/region/schema/弃用日期，适配层契约测试 |
| Viewer | SDK/extension/SVF2 版本和浏览器矩阵 |
| Region | US/EU/AU 等按服务实际支持；URN/endpoint/数据驻留不跨区混用 |
| Rate Limit | 读取响应 header/Retry-After，token bucket+队列+指数退避/jitter；禁止并发重试风暴 |
| Cost | DA WorkItem、Derivative asset、Data/Viewer/存储/流量等按当前合同 Usage Meter 记录 |

APSUsageRecord 使用供应商 request/workitem/manifest ID 对账；项目预算预留→实收结算。定价和免费额度不得硬编码在业务逻辑，作为版本化 PricePolicy/合同配置。

### D30.19 服务接口与事件

| 接口 | 关键输入 | 输出/约束 |
|---|---|---|
| `POST /revit-operations/{id}/revisions` | schema/risk/transaction/worksharing/mapping/validation | 不可变 OperationRevision |
| `POST /revit-tasks` | operation、document/asset version、inputs、approval | D29 ConnectorTask/Add-in 或 DA 路由建议 |
| `POST /revit-family-packages` | RFA AssetVersion、manifest/profile | 质检/预览/审批流程 |
| `POST /revit-template-packages` | RTE AssetVersion、manifest/profile | 模板差异/金样/审批流程 |
| `POST /revit-export-jobs` | document version、views/sheets、exportProfile | Add-in/DA 异步任务和成果 |
| `POST /aps-project-bindings` | tenant/project、account/hub/project/folder/region、principal | 管理员审批绑定 |
| `POST /aps-item-versions:import` | binding、item/version URN、purpose | 平台 AssetVersion/权限/血缘 |
| `POST /aps-item-versions:upload` | binding/folder/item、assetVersion、expectedTargetVersion | 新 Version 或 Conflict |
| `POST /aps-da-workitems` | activityVersion、inputs/args/outputs、idempotencyKey | 异步 DAWorkItemRun/Usage |
| `GET /aps-da-workitems/{id}` | runId | 状态/report/cost/output/validation |
| `POST /aps-derivative-jobs` | itemVersion/URN、root/dependencies、formats/options | DerivativeJob |
| `GET /aps-derivative-jobs/{id}/manifest` | jobId、用途 | item 级状态/损失/表示 |
| `POST /aps-viewer-sessions` | item/derivative version、user/purpose/extensions | 短期 Session/token config |
| `POST /aps-aec-data-queries` | binding/version、approved query id/variables/cursor | AECDataSnapshot page/Run |
| `GET /aps-usage` | project/service/time/operation | 用量/成本/限流/对账分页 |

事件：`RevitHostConnected/DocumentOpened/DocumentConflict`、`RevitOperationPreviewed/Committed/RolledBack/Failed`、`FamilyPackageApproved/Rejected`、`TemplatePackageApproved`、`APSBindingActivated/Revoked`、`APSItemVersionImported/Created`、`DAWorkItemStarted/Completed/Failed`、`DerivativeCompleted/Partial/Failed`、`AECDataSnapshotCreated/Unavailable`、`APSRateLimitReached/UsageReconciliationFailed`。

### D30.20 界面与交互详细设计

| 界面 | 主区 | 关键操作 | 防错/反馈 |
|---|---|---|---|
| Revit Add-in 面板 | 项目/文档/Worksharing/dirty、任务、选择/对象、版本/风险 | 查询、预览、确认、定位、取消/诊断 | Central/Cloud/Detached、owner/锁/过期醒目 |
| Revit 变化/失败预览 | Transaction 操作树、对象/参数/视图差异、Failure/Warning、回滚 | 筛选/定位、选择允许项、确认/拒绝 | 未知 Warning/Sync/升级不可逆阻断 |
| 族库与加载预览 | Family/Type/参数/连接器/嵌套、项目同名差异、质量/性能 | 批准、AddMissing/Replace、加载任务 | 禁止默认覆盖所有类型/共享参数 |
| 模板/项目标准差异 | RTE↔项目资源、GUID/名称/依赖、Copy/Map/Manual | 生成迁移包、选择/批准 | 明示模板不能直接应用既有项目 |
| Autodesk 绑定中心 | account/hub/project/folder/region、Principal/Scope、Webhook/健康 | 绑定、测试、暂停/撤销、重同步 | 跨 tenant/region/权限不符阻断 |
| Automation/Derivative 运维 | Engine/Bundle/Activity、WorkItem/Derivative 状态、report/成本/限流 | 启停、受控重试、下载/验证、事件 | Partial/未知执行/计费醒目，不直接重派 |
| APS Viewer 协调页 | 2D/3D、模型/版本、属性/选择/剖切、Issue/Overlay、转换警告 | 查看、Markup/Issue、回源 Revit | dbId/Version/Derivative 固定；无权属性不下发 |
| AEC Data/Usage 控制台 | approved query、字段/版本/分页、覆盖/错误、Schema/弃用、Usage | 查询、比较、导出授权数据、看影响 | 不允许任意 GraphQL；服务不可用不显示空结果 |

### D30.21 组件技术栈方案

| 组件 | 推荐技术栈 | 职责 | 约束/替代 |
|---|---|---|---|
| Revit Add-in | C#/.NET（按 Revit 年版）+ Revit API、WPF/兼容 UI | Ribbon/modeless、ExternalEvent、文档/事务/对象/导出 | 每年版独立 build/compat；不后台调用 Revit API |
| Revit Adapter | D29 .NET SDK + RevitOperation Registry | Task/Preview/Receipt/ObjectMapping | 核心协议复用，不直连业务 DB |
| Dynamo | Dynamo for Revit/Player/图定义适配 | 批量参数化/生成辅助 | Graph/包/版本/输入输出固定，非任意脚本 |
| Design Automation | APS Automation API for Revit、AppBundle/Activity/WorkItem | 无人值守 RVT/RFA/RTE/Export | Engine/计费/配额/API/UI 限制 |
| APS Data | Authentication、Data Management/Docs、Webhooks | Hub/Project/Item/Version/上传下载/事件 | 2/3-legged Scope、region、幂等/乱序 |
| Derivative/Viewer | Model Derivative SVF2 + APS Viewer SDK | Web 派生/2D/3D/属性/协同 | 转换损失、SDK/extension/Token 供应链 |
| AEC Data | AEC Data Model GraphQL Adapter | 固定版本构件/属性查询 | 只读、approved queries、schema/rate/region/订阅 |
| APS 控制面 | Java 21 + Spring Boot 4.1 + PostgreSQL/对象存储 | Binding/Ref/DA/Derivative/Snapshot/Usage | Autodesk 凭据只在后端/Vault |
| Workflow/Rate | D08 Workflow/队列、Valkey token bucket | 异步回调/轮询恢复、限流/重试/预算 | 429 Retry-After、幂等和未知执行对账 |
| Secret/Identity | APS OAuth、OIDC/OBO 适配、Vault/KMS | 用户/应用 Token、回调/Webhook 验证 | 不入浏览器/插件日志/数据库明文 |
| Observability/Test | OpenTelemetry、APS request IDs、Revit Journal/VM 矩阵 | 全链、用量/错误/兼容/事务回归 | Journal/模型内容脱敏、官方 Sandbox/Mock |

沿用 D29 SDK/Task/Receipt，Revit/APS 只实现 Adapter，落实 DRY；Add-in/DA/Data/Viewer 各自接口隔离，落实 SOLID；AEC Data 只读、Viewer 只展示，避免能力幻想，落实 KISS/YAGNI；每个项目基线只支持明确 Revit 年版，不无限兼容。

### D30.22 安全、异常与恢复

| 异常/威胁 | 处理 |
|---|---|
| Add-in/DA Bundle 篡改/恶意依赖 | 签名/SBOM/allowlist/沙箱，停用 Revision/Incident |
| 非法线程/事务/模态状态 | 排队 ExternalEvent/合法 context，不强行调用 |
| Worksharing ownership/central 锁 | Conflict/owner/等待或用户处理，不接管/无限等待 |
| Revit Failure/崩溃/损坏 | 回滚/恢复副本、保存 Failure/Journal/diagnostic，不上传未验证文件 |
| RVT 升级失败/不可逆 | 保留源/备份，输出独立失败报告，不覆盖 |
| DA WorkItem timeout/unknown status | 用 APS ID/report/callback 对账后再重试；计费标 Pending |
| APS 429/5xx/Token 过期 | 刷新短期 Token、有界 Retry-After/退避；4xx 不重试 |
| Derivative Partial/缺 links/properties | Manifest 明确缺失，不用于要求完整性的 D18/D22 |
| Webhook 重放/乱序/丢失 | 签名/sequence/idempotency+定期版本 reconciliation |
| AEC Data Schema/field 弃用 | 契约告警/兼容 Adapter/切换 Revision，不静默丢字段 |
| Viewer Token/URN 泄露 | 短期最小 Scope、后端授权、撤销/日志检测；无 client secret |
| APS 区域/驻留不匹配 | PolicyDenied，不跨区复制/回退未批准服务 |

### D30.23 指标与发布门禁

| 指标 | 定义/用途 |
|---|---|
| Compatibility Coverage | 项目 Revit build/OS/API 对 Active Add-in/DA/导出支持率 |
| Add-in Task/Transaction | 成功、回滚、Failure、宿主崩溃/影响和耗时 |
| Worksharing Conflict | 借用/锁/out-of-date/Sync 冲突及解决时长 |
| Element Mapping Stability | UniqueId/ObjectRef Stable/Replaced/Split/Merged/Unmapped |
| RFA/RTE Quality | 族/模板金样、加载/迁移、性能和覆盖失败率 |
| DA Success/Queue/Cost | WorkItem 成功、排队/执行 P95、重试和单位成本 |
| Derivative Completeness | 完整派生/目标 views/objects/properties、Partial/警告比例 |
| Viewer Load/Mapping | 首屏/交互 P95、dbId↔ObjectRef 映射成功率 |
| AEC Data Coverage | 固定版本查询成功、字段/对象/页覆盖和 Schema 兼容 |
| APS Rate/Availability | 429/5xx、回退/恢复和服务可用性 |
| Usage Reconciliation | 平台 APS Usage 与供应商账单一致率 |
| Security/Data Residency | Token/URN/Bundle/跨区/越权事件，目标 0 |

发布门禁：目标 Revit build/工作共享/RVT-RFA-RTE、事务/Failure/Undo/崩溃、旧版升级、Add-in/DA 等价性、链接/坐标/导出、APS OAuth/region/429/5xx/callback、Derivative Partial、Viewer 权限、AEC Schema 弃用、成本对账和回滚测试通过。

### D30.24 D30 验收条件（EARS）

- When Revit Host 连接, the Adapter shall 验证完整 Revit build、API/.NET、Add-in 签名/Revision 和 RevitCompatibility。
- When modeless/后台请求访问 Revit API, the Add-in shall 通过 ExternalEvent/支持的回调进入合法 API 上下文。
- When Revit 写操作执行, the Add-in shall 固定 DocumentIdentity/AssetVersion/WorksharingContext 并在批准 TransactionPlan 内完成。
- When 未知 Revit Failure/Error 或 Commit 后验证失败, the Add-in shall 回滚/恢复并保存 FailureRecord，不静默删除警告。
- When Workshared/Cloud Model 写入, the Add-in shall 检查元素/Workset ownership、latest/lock/权限；Sync Central 需独立批准。
- When 元素跨版本映射, the 平台 shall 使用 DocumentIdentity+UniqueId/External/IFC GUID/ObjectRef，不以 ElementId 单独认定身份。
- When RFA 加载, the 模块 shall 比较 Category/Family/Type/参数 GUID/连接器/嵌套和同名冲突，禁止默认全覆盖。
- When RTE 用于既有项目, the 模块 shall 生成资源/依赖差异和 IntegrationPackage，不宣称模板可直接应用。
- When DAWorkItem 创建, the 平台 shall 固定 Engine/AppBundle/Activity、输入/参数/输出、URL Scope/TTL、预算和幂等键。
- When DAWorkItem 状态/副作用未知, the 平台 shall 按 APS WorkItem/requestId/report 对账，不直接重发产生重复计费/输出。
- When APS Item 被引用, the 平台 shall 保存具体 hub/project/item/version/region/Principal，不引用“最新”。
- When Composite RVT 翻译, the 模块 shall 固定 root/link Manifest、hash、坐标/单位和转换 options，并报告缺失/损失。
- When DerivativeManifest 为 Partial/Failed, the 平台 shall 不将其用于要求完整性的联邦/一致性检查。
- When Viewer/AEC Data 请求, the 平台 shall 服务端校验用户/项目/Version，签发最小短期权限并使用 approved query/字段适配。
- When APS 限流/计费发生, the 平台 shall 按 Retry-After/有界重试记录 service/request/unit/price revision/cost 并完成账单对账。

### D30.25 D30 完成检查与下游约束

| 检查项 | 结果 |
|---|---|
| 是否区分 Add-in、Automation、Data Management、Derivative/Viewer、AEC Data 路径 | 是 |
| 是否覆盖事务/线程/Failure、工作共享、元素映射和 RVT/RFA/RTE | 是 |
| 是否固定 APS 版本/区域/OAuth/限流/计费、派生损失和失败恢复 | 是 |
| 是否定义接口、事件、界面、技术栈、安全、指标和门禁 | 是 |

D30 对下游的强制约束：D34 持久化 Revit/APS Binding/Run/Manifest/Usage；D35 固化 Revit Operation、APS callback/webhook/GraphQL Adapter 契约；D37 实现 Add-in/族模板/APS/Viewer 界面；D40 覆盖 Autodesk OAuth、Bundle、RVT 文件/链接、跨区威胁；D42 规划桌面/DA/Derivative/AEC API 容量和成本；D44 建立 Revit 年版 VM/DA/APS 资格环境，D45 执行故障测试并验证签名 Add-in/AppBundle/Activity 灰度发布；D46 运营兼容/弃用/用量/许可证。

