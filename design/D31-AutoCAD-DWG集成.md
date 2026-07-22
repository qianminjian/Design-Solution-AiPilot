# D31 AutoCAD与DWG集成

> 来源：@design/INDEX.md | 创建：2026-07-22 | 更新：2026-07-22
> 原始行范围：9253–9537
> 引用约定：同文件内引用使用 §编号，跨文件引用使用 @design/文件名.md

## D31 AutoCAD/DWG 集成

### D31.1 任务定义

| 项目 | 内容 |
|---|---|
| 任务目标 | 在 D29 框架内建立 AutoCAD 交互插件、侧载 Database、Core Console/APS Automation 和 DWG/DXF/PDF 派生的可追溯集成 |
| 直接产出 | DWG/工具/对象/依赖/标准/出图/Automation 对象、锁/事务、Xref/字体/代理对象、接口、界面、技术栈和验收 |
| 成功对齐物 | 任一查询、校标、批改或出图固定 AutoCAD build/vertical、插件/Engine、DWG 版本、依赖/字体/Plot 配置和事务/输出证据 |
| 本任务不做 | 不以 ODA/第三方解析替代必须由 AutoCAD 验证的语义，不自动 Bind Xref/Purge/Audit 修复或覆盖源 DWG，不假设 AutoCAD LT 支持完整 .NET/ObjectARX |
| 主能力 | CAP-14.01/03、CAP-15.02/03，消费 D29 SDK，服务 D12/D22/D23/D25 和批量出图 |

### D31.2 标杆依据与平台取舍

- AutoCAD .NET modeless、非当前文档、COM/Session 命令写操作需 DocumentLock，数据库修改在 Transaction 中提交/回滚；插件必须尊重宿主命令/文档上下文。
- `.bundle/PackageContents.xml` 支持按产品/版本/平台加载，SECURELOAD/TRUSTEDPATHS 与数字签名是插件供应链基线；LT、Mac 和行业版 API 能力不同。
- Xref 依赖的 Layer/Block/TextStyle/DimStyle 等有独立命名空间，Bind/Insert 改变命名对象；默认只解析/校验引用，不自动绑定。
- APS Automation for AutoCAD 通过 Engine+AppBundle+Activity 调用 `accoreconsole`，适合批处理/出图/校标，但无交互 UI、插件/字体/代理对象/命令支持受限。
- 取舍：原生插件/AutoCAD Engine 负责权威读写；Side Database 用于无 UI 结构任务；ODA/LibreDWG 仅在许可/兼容验证后做预检/转换辅助。

### D31.3 核心原则

1. DWG 是图形数据库而非仅图像；优先读取 Entity/Named Object/Layout/Viewport/Annotation/Xref 结构，PDF/OCR 仅作派生补充。
2. 文档身份固定真实路径/云 Item Version、Database Fingerprint GUID、DWG format、hash 和依赖 Manifest；文件名不足。
3. 写操作需正确 DocumentLock/Transaction/宿主命令上下文；Side Database 与当前 UI Document 能力不混用。
4. 图层/块/样式/单位/坐标/Xref/字体/Plot 都是结果语义的一部分，缺失不能被默认 AutoCAD 环境静默替代。
5. ObjectId/Handle 仅在特定 Database/版本内使用；跨版本映射结合 Handle、Persistent/业务 ID、对象类型/几何候选和平台 ObjectRef。
6. 输出新 DWG/Version 优先；降版/代理对象/字体替代/Bind/Purge 等损失操作必须预览和批准。
7. Desktop、Core Console、APS Automation、Model Derivative 的结果差异通过金样验证，不假设等价。

### D31.4 执行模式与能力矩阵

| 模式 | 适用 | 读写能力 | 限制 |
|---|---|---|---|
| AutoCAD .NET/ObjectARX Plugin | 当前文档/选择、复杂实体/行业对象、交互预览写回 | 最高，受产品 API | 用户在场、锁/命令/UI/许可证 |
| Side Database | 后台打开普通 DWG、结构提取/轻量修改/另存 | DatabaseServices 子集 | 不依赖 Editor/UI/当前文档；Xref/字体/代理能力验证 |
| AutoCAD Core Console | 本机受控批处理/脚本/AppBundle | 无图形 UI 的命令/API 子集 | 版本/插件/命令/字体/打印环境差异 |
| APS Automation AutoCAD | 云批量校标/修改/转换/出图 | Engine+AppBundle/Activity | 无 UI、输入包完整性、配额/计费/Engine 生命周期 |
| Model Derivative/Viewer | Web 查看/属性/几何派生 | 只读派生 | 转换损失、代理对象/字体/2D 显示差异 |
| Third-party DWG SDK | 预检/索引/转换或非 Autodesk 环境 | 取决许可/版本 | 不作未验证权威写回；兼容/许可证专项评测 |

### D31.5 领域对象

| 对象 | 职责 | 关键内容 |
|---|---|---|
| AutoCADConnectorProfile | AutoCAD Adapter 配置 | operations、document/transaction、standards、plot、mapping 和 version |
| AutoCADCompatibility | 精确兼容项 | product/vertical/LT、year/build、OS/arch、API/.NET/ObjectARX、status |
| AutoCADPluginPackage | `.bundle` 包 | PackageContents、assemblies/ARX/LISP/resources、signature/SBOM 和 channel |
| DWGDocumentIdentity | 图纸身份 | file/cloud version、fingerprint GUID、format year、hash、readOnly/dirty 和 origin |
| DWGDependencyManifest | 依赖清单 | Xref/DGN/PDF/image/font/SHX/plot/standards/data link、path/hash/status |
| DWGDatabaseSnapshot | 数据库快照 | named tables、spaces/layouts、entities、units/coords、metadata 和 coverage |
| DWGOperationRevision | 操作契约 | schema/risk、lock/transaction、selection/scope、preview/validation 和 version |
| DWGTransactionPlan | 锁/事务计划 | document/database mode、transactions、commit/abort、save/backup 和 errors |
| DWGObjectMapping | 对象映射 | platformRef、database/version、Handle/ObjectId/ExtensionDictionary ID、status |
| DWGNamedObject | 命名对象 | Layer/Block/Linetype/Text/Dim/MLeader/Table/PlotStyle/UCS/View、owner/source |
| DWGEntityRecord | 实体事实 | type、space/layout/layer/block、geometry/properties/XData、visibility 和 source |
| DWGBlockDefinition | 块定义 | static/dynamic/anonymous、attributes/parameters/actions、units/nesting 和 version |
| DWGXrefReference | 外部引用 | path/ref type、overlay/attach、nested、transform、loaded/resolved、version 和 bind state |
| DWGFontResource | 字体资源 | TTF/OTF/SHX/bigfont、style mapping、license/hash、availability/substitution |
| DWGProxyRecord | 代理/自定义对象 | class/proxy flags、enabler/product、graphics/data availability 和 risk |
| DWGStandardProfile | 制图标准 | layer/block/style/annotation/unit/naming/plot rules、DWS/reference 和 version |
| DWGCheckRun | 一次标准检查 | document/dependency snapshot、rules/engine、coverage/results 和 report |
| DWGPlotProfile | 出图配置 | layouts/sheets、PageSetup、device/PC3、media、CTB/STB、DPI/quality 和 version |
| DWGPublishSet | 批量出图集 | drawings/layouts/order、DSD、output naming、revisions 和 status |
| DWGExportRun | 导出/发布运行 | input versions、profile/publish set、engine、outputs/log/cost 和 validation |
| AutoCADAppBundleVersion | Automation 包 | engine、plugin/scripts/dependencies/fonts、signature/SBOM、alias/version |
| AutoCADActivityVersion | Automation 定义 | engine/AppBundle、commandLine/script、parameters/timeouts 和 version |
| AutoCADWorkItemRun | 一次云自动化 | Activity、inputs/outputs/args、status/report/cost/callback 和 attempts |

### D31.6 插件生命周期、命令与文档锁

- `.bundle/PackageContents.xml` 声明 ProductCode/UpgradeCode/AppVersion、RuntimeRequirements、Components/Load reasons；每 AutoCAD/vertical/LT/Mac 组合按能力构建/加载。
- 插件通过 IExtensionApplication/CommandMethod 初始化命令/Palette；启动只注册 UI/服务，不网络阻塞或动态加载未签代码。
- 当前普通 command context 修改当前文档可按 API 规则执行；modeless Palette、Session 命令、非当前文档和 COM/外部调用必须持有 DocumentLock。
- DocumentCollection 事件/DocumentActivated/CommandWillStart/Ended/Database save 等仅做轻量状态/调度；命令中/模态/Plot 时暂停任务。
- D29 ConnectorTask 必须绑定确切 Document/Database；用户切换 MDI 文档后重新验证，禁止误写当前文档。

### D31.7 Database Transaction 与保存策略

1. 读取使用 OpenMode.ForRead，最小范围 UpgradeOpen；写入在 Transaction/ OpenCloseTransaction 中，异常 Abort。
2. Side Database 使用 ReadDwgFile/CloseInput 等正确共享模式；不与 UI Document 同时无协调写同一文件。
3. Transaction 内记录新增/更新/删除 Handle、Named Object 和实际值；Commit 后重新打开验证。
4. 写前创建副本/备份；默认 `SaveAs` 新文件/新 DWG Version，显式选择目标 DWG format。
5. 保存后重新读取 header/依赖/实体计数、AUDIT 只读报告（或批准修复）、文件 hash/MIME/可打开性和 Plot smoke test。

跨多个 DWG 不宣称 ACID；每文件独立 Receipt，D08 Saga 聚合。AutoCAD Undo 仅交互会话内辅助，文件备份/新版本才是平台回滚证据。

### D31.8 DWG 版本、产品与降版

AutoCADCompatibility 精确到基础 AutoCAD/Architecture/MEP/Civil 3D 等 vertical、LT、year/build、Windows/macOS、语言、API runtime 和 object enabler。行业对象需对应 vertical/DBX；普通 AutoCAD 打开产生 Proxy 不等于完整可编辑。

- 打开旧版并保存到新版可能升级数据库；源文件保留，新版本记录升级 Engine/报告。
- SaveAs 降版可能代理化、丢字段/实体/注释比例/材质/行业对象；先 dry-run + semantic diff/可打开/Plot 比较。
- AutoCAD LT 的 .NET/ObjectARX/LISP 能力按实际版本矩阵，不通过产品名猜测。
- DWG/DXF 互转明确版本/编码/单位/代理/字体/对象损失；DXF 不作为无损通用中间格式。

### D31.9 图层、命名对象与标准

DWGStandardProfile 规则：命名/非法字符、Layer state/on/freeze/lock/plot/color/linetype/lineweight/transparency、ByLayer/ByBlock、0/Defpoints、Block/Style/UCS/View/PageSetup、重复/未使用和 Xref-dependent 对象。

标准检查区分 Local、XrefDependent、Override、MissingDependency；Xref 的 `xref|name` 不与本地图层合并。修复方案为 Rename/Map/Create/SetProperty/MoveEntity/Merge（高风险）候选，展示受影响实体/块/Xref/Plot，不自动 PURGE 或合并。

DWS/企业 Profile 是规则来源之一，但平台保存其 AssetVersion/解析器和差异；AutoCAD Standards Check 原生结果可作证据，不替代统一 Finding。

### D31.10 块、属性、动态块与字段

- BlockDefinition/Reference 分离；保存嵌套、循环、单位、插入 transform、normal/scale/rotation、visibility、attribute definitions/references。
- Dynamic Block 同时记录 dynamic/anonymous definition、property name/type/allowed/value、visibility state 和 actions；写入前验证可接受值/regen。
- Attribute 的 tag/prompt/value/position/constant/invisible/mtext/field 与 Block 版本关联；重定义 Block 不应静默删除/重排属性。
- Fields/DataLinks 记录表达式/源/评估状态；外部链接不可用时不把显示缓存当最新事实。
- WBLOCK/INSERT/Clone 使用 DuplicateRecordCloning 策略和 Named Object 冲突报告；跨图导入先预览依赖/单位/样式。

### D31.11 Xref 与外部依赖

DWGDependencyManifest 解析 Attach/Overlay、nested、relative/full/no path、resolved/unresolved/unloaded/orphaned/circular、transform 和实际文件 hash/version。平台工作包使用安全相对路径，禁止搜索全盘/未批准网络位置。

- Reload/Unload/Detach 是受控 Operation；目标版本/路径/下游影响预览。
- Bind/Insert 将引用和 Named Object 纳入当前数据库，改变命名与文件体积/责任边界，定义为高风险 T4，默认禁止自动执行。
- PDF/DGN/Image underlay、Excel DataLink、Point Cloud 等依赖分别声明下载/访问/许可/版本；缺失时 Plot/检查标 Partial。
- Xref 对象身份保存 parent chain+source document/version+Handle，不能用 host Handle 单独映射。

### D31.12 字体、文字、标注与多语言

- Font Manifest 保存 TextStyle→font/bigfont、实际文件/版本/hash/license、字符覆盖、fallback/substitution 和 host availability。
- TTF/OTF/SHX/Bigfont 分开；缺字体时 AutoCAD 替代可能改变字宽/换行/符号，任何批量出图先做 missing glyph/font substitution 检查。
- Text/MText 保存 raw content、format codes、style/height/width/rotation/annotation scale、background/columns 和 field；不把渲染文字反写 raw。
- Dimension 保存 measurement、override text、associativity、DimStyle/overrides、units/tolerance/scale 和 extension targets；显示值与几何测量并列供 D22。
- MLeader/Table/Annotative Object/Scale context 纳入解析；同一对象在不同 viewport scale 显示不同需按 Layout/View 检查。

### D31.13 Layout、Viewport 与批量出图

DWGPlotProfile 固定 Layout/Model、PageSetup、device/PC3、media size/orientation、plot area/scale/offset/center、CTB/STB、shade/quality/DPI、lineweight/transparency、font、output path/naming 和 Engine/build。

1. 验证 PublishSet 的 DWG/Layouts/顺序/Revision、PageSetup/PC3/CTB-STB/字体/外参/打印机资源。
2. 每 Layout 校验 viewport on/locked、view target/twist/scale、annotation scale、layer overrides、标题栏/图号和 plot area。
3. 在隔离输出目录用 Desktop/Core Console/APS Automation 执行 PUBLISH/Plot API/DSD（按认证路径）。
4. 收集每页日志/错误/耗时；验证 PDF 页数/尺寸/文本/字体嵌入/空白/裁切/文件 hash，并抽样渲染像素差。
5. 完整通过后生成 OutputPackage；Partial 页不合并成“成功全套”。

### D31.14 对象身份、坐标与单位

- `INSUNITS/MEASUREMENT`、UCS/WCS、GeoLocation、Block units、Xref insertion units、Layout paper units 分开记录；无单位/缩放异常阻断确定性量测。
- Entity 几何规范化到 WCS 并保留 ECS/OCS/Block/Xref transform chain；2D/3D elevation、normal 和 Z 异常不压平。
- ObjectId 仅进程/Database 内；Handle 在同一 DWG 版本链较稳定但可能重用/改变；XData/ExtensionDictionary/业务 GUID 可增强身份。
- 跨版本先按平台业务 ID/Handle+类型/owner path，再按几何/属性候选；Block/Xref explode/bind 产生 Split/Merged，需人工确认。

### D31.15 Proxy/行业对象与 Object Enabler

DWGProxyRecord 保存原 class/DXF name、application/product/version、proxy graphics/data、可擦除/变换/复制 flags、Object Enabler 需求和对象范围。Proxy graphics 只证明可显示，不证明可读取语义/编辑/提量。

- 有批准且签名的 Object Enabler/vertical 时在兼容环境处理；依赖进入 PluginPackage/SBOM。
- 无 Enabler：允许 Viewer/Plot（经金样）或标 Uninterpretable；D22/D23 对相关范围 Indeterminate。
- Explode/ExportToAutoCAD 等降级会丢语义，必须新文件、损失报告、对象映射和批准，禁止覆盖源。

### D31.16 Core Console 与 APS Automation

本地 Core Console 和 APS AutoCAD Engine 共用签名 AppBundle/高层命令，但分别有 ToolCompatibility/Eval。Activity 固定 Engine/AppBundle/commandLine/script/input-output 参数/timeout；script 只调用 allowlisted AppBundle command，不接收任意用户命令文本。

流程：完整 InputPackage（DWG+Xrefs+fonts+PC3/CTB/STB+DWS/resources）→WorkItem→`accoreconsole` 加载 AppBundle→结构化 JSON 参数→事务操作/Plot→report/output→hash/可打开/语义/Plot 验证→AssetVersion。

Automation 无 UI/对话；FILEDIA/CMDDIA 等环境需 Activity 固定，所有命令使用国际化安全的 API/命令形式。未知执行/timeout/429/5xx按 D30 对账/有界重试；计费入 APSUsageRecord。

### D31.17 标准检查与修复闭环

检查组：FileHealth、Version/Units/Coordinates、Dependencies、Layers/NamedObjects、Blocks/Attributes、Text/Fonts、Dimensions/Annotations、Layouts/Viewports/Plot、Proxy/CustomObjects、Geometry/duplicates、Metadata/Revision、D22 cross-representation。

结果复用 D21 Outcome/ComplianceFinding；AUDIT/PURGE/OVERKILL 等只先运行分析/报告或在副本 dry-run，修复计划列每项对象、预期变化和风险。专业人员确认后在新版本执行，复查 FileHealth、对象数/Handle mapping、Xrefs、Plot 和 D22 一致性。

### D31.18 服务接口与事件

| 接口 | 关键输入 | 输出/约束 |
|---|---|---|
| `POST /autocad-operations/{id}/revisions` | schema/risk/lock/transaction/compat/validation | 不可变 OperationRevision |
| `POST /dwg-snapshots` | assetVersion、mode/profile、dependency policy | DatabaseSnapshot/Manifest/coverage |
| `POST /dwg-check-runs` | snapshot、standardProfile/rules、engine | 异步检查/Finding/证据 |
| `POST /dwg-fix-plans` | findings、target version、operations | Draft Preview/impact，不直接执行 |
| `POST /dwg-fix-plans/{id}:execute` | approval/consent、connector/engine、idempotency | D29 Task/Automation Run |
| `POST /dwg-xref-operations` | document/ref/version、reload/unload/detach/bind、policy | 高风险预览/任务 |
| `POST /dwg-block-packages` | source block/asset、dependencies、mapping | 可复用块包/质检 |
| `POST /dwg-publish-sets` | drawings/layouts/order/revisions、plotProfile | Draft PublishSet/静态验证 |
| `POST /dwg-export-runs` | publishSet/profile、engine、idempotencyKey | 异步 PDF/DWG/DXF/OutputPackage |
| `GET /dwg-export-runs/{id}` | runId、sheet/error filters | 页级状态/log/outputs/validation/cost |
| `POST /autocad-appbundles` | engine/plugin/resources/signature refs | AppBundle Version/资格 |
| `POST /autocad-workitems` | activityVersion、inputPackage/args/output | APS WorkItem/Usage |
| `GET /dwg-object-mappings` | base/target asset versions、scope/status | 稳定/候选对象映射分页 |
| `GET /dwg-evidence/{id}` | evidenceId、view mode | 权限裁剪对象/布局/依赖/Plot 证据 |

事件：`DWGSnapshotCreated/Partial/Failed`、`DWGDependencyMissing/Changed`、`DWGCheckCompleted`、`DWGFixPreviewed/Committed/RolledBack/Conflict`、`XrefReloaded/Detached/Bound`、`DWGPublishStarted/SheetCompleted/Completed/Partial/Failed`、`AutoCADWorkItemCompleted/Failed`、`DWGProxyDetected`、`FontSubstitutionDetected`。

### D31.19 界面与交互详细设计

| 界面 | 主区 | 关键操作 | 防错/反馈 |
|---|---|---|---|
| AutoCAD 插件面板 | 当前 DWG 身份/版本/dirty/lock/product、任务/选择、依赖/标准状态 | 查询、检查、预览、执行/取消 | MDI 目标/vertical/proxy/缺依赖醒目 |
| DWG 结构浏览器 | Layer/Block/Style/Layout/Entity/Xref 树、属性/owner/来源 | 筛选、定位/高亮、导出证据 | Local/Xref/Proxy 分层，不扁平合并 |
| 标准检查工作台 | 规则树、Finding、对象/布局定位、严重度/修复候选 | 分诊、批量选择、生成 FixPlan | AUDIT/PURGE/合并仅预览，不一键自动修复 |
| 修复影响预览 | Named Object/实体/块/Xref/字体/Plot 前后、Handle/Object mapping | 选择操作、确认/回滚 | Bind/Explode/降版/删除高风险双确认 |
| Xref/依赖中心 | 引用图、nested graph、path/version/hash/status/transform、字体/Plot 资源 | 打包、重定位、Reload/Detach 预览 | 禁止全盘搜索/自动 Bind；循环/越界高亮 |
| 块与样式库 | Block 动态属性/嵌套、Layer/Text/Dim/MLeader/TableStyle、冲突 | 比较、打包、Clone 策略/导入 | 同名≠同定义；单位/属性/字段损失显示 |
| 出图中心 | PublishSet、Layout/PageSetup/Viewport、PC3/CTB-STB/字体、页级状态 | DryRun、发布、重试失败页、下载 | 缺资源/Partial 不生成全套成功声明 |
| Automation/兼容运维 | product/build/Engine/AppBundle/Activity、WorkItem/report/cost、VM 金样 | 发布、灰度、受控重试、停用 | Desktop/Core/APS 差异和计费醒目 |

### D31.20 组件技术栈方案

| 组件 | 推荐技术栈 | 职责 | 约束/替代 |
|---|---|---|---|
| AutoCAD Plugin | C#/.NET AutoCAD API；ObjectARX C++ 仅必要能力 | Palette/Command、Document/Database/Editor、Lock/Transaction、Plot | 年版/vertical/LT/Mac 独立兼容；优先 .NET |
| Adapter/SDK | D29 .NET SDK + DWGOperation Registry | Task/Preview/Receipt/ObjectMapping | 不直连业务 DB/任意命令 |
| Side DB/Core | AutoCAD DatabaseServices + AccoreConsole | 无 UI 结构/批处理/另存/出图 | 支持命令/插件/环境金样验证 |
| APS Automation | APS Automation API AutoCAD Engine/AppBundle/Activity/WorkItem | 云批处理/校标/转换/发布 | Engine/配额/计费/输入包/无 UI |
| DWG 辅助 SDK | ODA Drawings SDK（商用许可/认证后）或只读预检 Adapter | 非 Autodesk 环境索引/转换辅助 | 不作未验证权威写回；许可证/SBOM |
| PDF/Viewer | AutoCAD Plot/Publish、Model Derivative SVF2/Viewer、D25 | 2D/3D 派生/查看/OCR 补充 | 字体/Plot/代理/转换损失报告 |
| 标准/规则 | D21 DSL + AutoCAD Standards API/DWS Adapter | 图层/块/样式/标注/布局/健康规则 | 规则版本/对象证据、无任意 LISP |
| 领域控制面 | Java 21 + Spring Boot 4.1 + PostgreSQL/PostGIS + 对象存储 | Snapshot/Manifest/Profile/Run/Mapping/Package | 不可变版本、空间/图关系、Outbox |
| Workflow/Rate | D08 Workflow/队列、D30 APS rate/cost | 批处理、页级重试、回调/对账/预算 | 写任务效果未知不重派 |
| Package/Secret | Autodesk `.bundle`/MSI、签名/SBOM、Vault/KMS | 插件/AppBundle/字体/Plot 包和凭据 | SECURELOAD/TRUSTEDPATHS、无明文 Token |
| Observability/Test | OpenTelemetry、AutoCAD VM/vertical/locale/plot matrix | 命令/事务/崩溃/WorkItem/Plot/成本回归 | 图纸路径/文字/合同数据脱敏 |

统一 D29 SDK 与 D21/D22 结果模型，落实 DRY；Plugin/SideDB/Core/APS/Third-party Adapter 隔离，落实 SOLID；默认不引入 ObjectARX/ODA，只有 .NET 无法满足且收益明确时采用，落实 KISS/YAGNI。

### D31.21 安全、异常与恢复

| 异常/威胁 | 处理 |
|---|---|
| 未签插件/LISP/ARX/DBX/Enabler | SECURELOAD/allowlist/签名/SBOM 拒绝，隔离 Incident |
| DocumentLock/Transaction 冲突 | 等待合法 context/Abort，禁止强写/锁泄漏 |
| DWG 损坏/AUDIT 错误 | 只读报告/副本修复，源保留；失败不上传权威版本 |
| Xref/underlay/path 越界/循环 | realpath 根白名单、Manifest、循环检测，不全盘/网络搜索 |
| 缺字体/PC3/CTB-STB | 标 Partial/阻断发布，不静默 fallback 后宣称一致 |
| Proxy/行业对象无 Enabler | Indeterminate/Viewer-only 或兼容环境重跑，不 explode 源 |
| 降版/DXF/Bind/Explode 损失 | 新文件+LossReport+批准+对象映射，不覆盖源 |
| Core/APS 命令等待对话/挂起 | Activity 超时/环境固定，禁止 UI 命令；保存 report |
| WorkItem/网络状态未知 | APS ID/日志/Output 对账后重试，不重复计费/写出 |
| Plot 页缺失/空白/裁切 | 页级失败，保留成功页但 PublishSet Partial |
| 用户在执行后手工修改/Undo | 重新 fingerprint，Receipt 冲突，不上传计划结果 |
| 批量操作资源超限/崩溃 | 分图/分页/对象批次，回滚当前文件并续跑未执行项 |

### D31.22 指标与发布门禁

| 指标 | 定义/用途 |
|---|---|
| Compatibility Coverage | AutoCAD/vertical/LT/OS/build 对 Active Plugin/Engine 覆盖 |
| Snapshot Completeness | Named Object/Entity/Layout/Dependency/Proxy 结构提取覆盖 |
| Check/Fix Precision | 标准 Finding 误报漏报、修复成功/回滚/副作用 |
| Lock/Transaction Conflict | 文档锁/命令/事务冲突和恢复时长 |
| Xref/Dependency Health | resolved/version/hash/path/font/plot 依赖完整率 |
| Object Mapping Stability | Handle/业务 ID Stable/Replaced/Split/Merged/Unmapped |
| Proxy/Font Risk | 代理对象/字体替代影响对象/图纸比例和关闭时长 |
| Publish Completeness | 页数/尺寸/字体/Plot/空白/裁切/命名验证通过率 |
| Desktop-Core-APS Conformance | 三模式金样语义/Plot 差异和可接受率 |
| Automation Success/Cost | WorkItem 成功、排队/执行、重试和单位成本 |
| Host Crash/Performance | 插件/Core 崩溃、启动/操作/大图性能影响 |
| Security Incident | 插件/脚本/路径/依赖/Token/跨租户事件，目标 0 |

发布门禁：目标产品/vertical/LT/Mac/locale、DWG 年版/降版、Lock/Transaction/Undo/崩溃、Layer/Block/Dynamic/Field、Xref/路径、字体/SHX、多语言标注、Layout/Viewport/PC3/CTB-STB/PDF、Proxy/Enabler、Desktop/Core/APS 等价、恶意包/脚本、限流/计费/回滚全部通过。

### D31.23 D31 验收条件（EARS）

- When AutoCAD Host 连接, the Adapter shall 验证 product/vertical/LT、完整 build、OS/API、Plugin 签名和 AutoCADCompatibility。
- When modeless/Session/非当前文档写操作, the Plugin shall 获取目标 DocumentLock 并在 Database Transaction 内执行。
- When DWG 打开/保存, the 模块 shall 固定 DocumentIdentity、format year、hash、units/coords、DependencyManifest 和 Engine/build。
- When 旧版升级或降版/DXF 导出, the 模块 shall 保留源文件、生成独立输出和 LossReport，不覆盖源。
- When Named Object 标准检查, the 模块 shall 区分 Local/XrefDependent/Override/Missing，不把同名对象自动合并。
- When Block 导入/重定义, the 模块 shall 比较动态属性、Attributes、嵌套、单位、样式/字段依赖并声明 DuplicateRecordCloning 策略。
- When Xref Reload/Detach/Bind 请求, the 模块 shall 验证 parent chain/path/version/transform/依赖；Bind/Insert 需高风险批准。
- When 字体/SHX/bigfont/PC3/CTB-STB 缺失或替代, the 模块 shall 标记影响范围并阻断要求一致性的发布。
- When Dimension/Annotation 校验, the 模块 shall 保存测量值、override、关联目标、样式/单位/比例和布局/视口上下文。
- When Proxy/自定义对象无适配 Enabler, the 模块 shall 输出 Indeterminate/ViewerOnly，不以 proxy graphics 认定可编辑/可提量。
- When PublishSet 执行, the 模块 shall 固定每个 DWG/Layout/Revision、PageSetup/Viewport、Plot/字体资源和 Engine，并做页级输出验证。
- When Core Console/APS Activity 运行, the 模块 shall 只调用签名 AppBundle allowlisted command/结构化参数，不执行任意用户脚本文本。
- When WorkItem/批任务状态未知或中断, the 平台 shall 先对账日志/输出/事务回执，禁止重复执行写操作。
- When FixPlan 执行后, the 模块 shall 重开输出验证 Database/依赖/对象映射/Plot/D22 一致性后创建 AssetVersion。
- When 连接器结果返回, the 平台 shall 保存产品/Engine/插件/操作/文件/依赖、Transaction/Receipt、输出/损失、Usage 和 Trace。

### D31.24 D31 完成检查与下游约束

| 检查项 | 结果 |
|---|---|
| 是否覆盖 Plugin/SideDB/Core/APS/Viewer/第三方模式边界 | 是 |
| 是否覆盖 Lock/Transaction、DWG 年版、图层/块/Xref/字体/代理对象 | 是 |
| 是否覆盖 Layout/Viewport/Plot/批量出图、标准校验/修复和对象映射 | 是 |
| 是否定义接口、事件、界面、技术栈、安全、指标和门禁 | 是 |

D31 对下游的强制约束：D34 持久化 DWG Snapshot/Dependency/Run/Mapping；D35 固化 DWG Operation/Automation/Publish 契约；D37 实现插件/标准/Xref/块/出图界面；D40 覆盖脚本/插件/路径/Xref/字体/代理对象威胁；D42 规划 DWG/页/Engine/Plot 容量成本；D44 建立产品/年版/vertical/字体/Plot/Automation 矩阵；D45 签名 Plugin/AppBundle/标准包灰度；D46 运营兼容/资源/成本/支持。

