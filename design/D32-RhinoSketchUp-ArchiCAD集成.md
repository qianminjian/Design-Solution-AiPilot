# D32 RhinoSketchUp与ArchiCAD集成

> 来源：@design/INDEX.md | 创建：2026-07-22 | 更新：2026-07-22
> 原始行范围：9538–9821
> 引用约定：同文件内引用使用 §编号，跨文件引用使用 @design/文件名.md

## D32 Rhino/SketchUp/ArchiCAD 集成

### D32.1 任务定义

| 项目 | 内容 |
|---|---|
| 任务目标 | 在 D29 框架下分别实现 Rhino/Grasshopper、SketchUp、ArchiCAD/Teamwork 的原生读写、参数化计算、开放格式交换和损失治理 |
| 直接产出 | 三工具兼容/文档/对象/操作/插件/参数图/Teamwork/IFC 对象、坐标单位、交换损失、接口、界面、技术栈和验收 |
| 成功对齐物 | 每次任务固定工具 build、插件/脚本/库、源文件/团队项目版本、对象身份、单位/容差、事务/预留和交换损失 |
| 本任务不做 | 不把三工具压成最低公分母，不假设 SKP/3DM/PLN/IFC 无损互转，不在无 Teamwork 权限时自动申请/抢占预留 |
| 主能力 | CAP-14.04、CAP-15.02/03，消费 D29 SDK，服务 D09–D11/D17/D18/D22/D26 |

### D32.2 标杆依据与平台取舍

- RhinoCommon 是 Rhino Windows/macOS/Grasshopper 的跨平台 .NET SDK；Grasshopper 图和 Rhino.Compute 可无状态执行几何，但插件、单位/绝对容差和 Core-Hour/服务器许可必须固定。
- SketchUp Ruby API 以 Model/Entities/Definitions/Instances/Groups/Tags/Scenes 为核心，Persistent ID 支持身份；几何操作会合并/拆分，Operation 不可嵌套且负责 Undo。
- SketchUp 扩展需 RBZ/签名/版本适配；Ruby 运行在宿主内，不能作为任意远程脚本执行器。
- ArchiCAD C++ Add-On API 按年版演进，Teamwork 具有连接/在线、权限与 Reserve/Release；IFC、Property/Classification、Hotlink/Library/Layout/Publisher 各有独立语义。
- 取舍：三套 ToolAdapter 独立，平台核心只统一 Document/ObjectRef、Operation/Receipt、Representation/Loss 和 D29 安全协议。

### D32.3 核心原则

1. 原生事实优先：3DM/SKP/PLN 对象、参数/属性/层级与工具 API 是源；IFC/DWG/glTF 等是固定派生。
2. 工具专有事务：Rhino UndoRecord/文档线程、SketchUp Operation、ArchiCAD Undoable Command/Teamwork Reserve 分别实现，不伪造统一 ACID。
3. 对象身份含 DocumentIdentity+原生 GUID/PersistentId+instance path/parent；几何近似仅候选。
4. 单位、绝对/角度容差、坐标轴/地理位置、层/故事/变换链进入每个 Representation。
5. 参数图/脚本/插件/GDL/Library 是可执行供应链，必须签名/hash/依赖/沙箱/许可和版本锁。
6. 交换必须生成 LossReport；Preview-only/Mesh-only 不得冒充可编辑 BIM/参数对象。
7. 用户选择/Teamwork 权限/本地文档状态在执行前重验；Agent 只能经 D27 Tool PEP 创建 D29 Task。

### D32.4 集成能力矩阵

| 工具/路径 | 原生能力 | 无人值守/服务端 | 主要边界 |
|---|---|---|---|
| Rhino Plugin | 3DM、NURBS/BRep/Mesh、Layer/Block/UserData、Selection/Command | 用户在场 | 文档线程/Undo、插件/平台差异 |
| Grasshopper | 参数/数据树、组件图、求解/烘焙、优化/分析 | Rhino.Compute 可执行批准图 | 插件依赖、循环/非确定、Bake 副作用 |
| Rhino.Compute | RhinoCommon/Grasshopper 无状态 REST | Windows/Linux server | 许可/Core-Hour、timeout/并发、无桌面上下文 |
| SketchUp Extension | SKP Entities/Components/Tags/Scenes/Materials/Attributes | 用户在场 Ruby/C++ | Operation 非嵌套、几何粘连、版本/签名 |
| SketchUp C SDK/转换 | 受支持文件结构/导入导出辅助 | 批处理能力按 SDK/许可验证 | 不替代 UI/扩展专有行为 |
| ArchiCAD Add-On | PLN/Teamwork Elements/Attributes/Properties/Layouts/Publisher/IFC | 用户/Teamwork 环境 | C++ 年版 ABI、Reserve/Rights、BIMcloud |
| ArchiCAD Python/JSON | 批量属性/命令（按实际 API） | 受限自动化 | 能力子集、需 ArchiCAD 会话，不当通用写引擎 |
| IFC/openBIM | 三工具交换/联邦/Issue | IfcOpenShell 后处理 | MVD/Translator、参数/历史/显示/库损失 |

### D32.5 领域对象

| 对象 | 职责 | 关键内容 |
|---|---|---|
| MultiToolConnectorProfile | 工具 Adapter 总配置 | tool family、operations、representation、mapping、security 和 version |
| ToolBuildCompatibility | 精确兼容项 | product/year/build、OS/arch/runtime/API、plugin/extension、status |
| NativeDocumentIdentity | 原生文档身份 | tool/type、path/cloud/teamwork ID、native GUID、format/build、hash 和 state |
| NativeObjectMapping | 跨版本对象映射 | platformRef、native ID/path、document version、status/confidence 和 relation |
| CoordinateUnitProfile | 坐标单位配置 | model/page/geographic axes、origin/north/elevation、units、tolerances、transform |
| ExchangeProfile | 格式交换契约 | source/target、schema/version/options、mapping、units/coords、purpose 和 version |
| ExchangeRun | 一次交换 | input/output versions、tool/translator、status、warnings/cost 和 validation |
| ExchangeLossReport | 交换损失 | missing/approximated/flattened/renamed/split/merged、scope、severity 和 evidence |
| RhinoDocumentSnapshot | 3DM 事实 | objects/layers/instance defs/views/materials/user data、units/tolerance 和 plugins |
| RhinoObjectRecord | Rhino 对象 | GUID/type、geometry/BRep/Mesh、attributes/layer/groups/user strings 和 parent |
| GrasshopperDefinitionVersion | GH/GHX 图 | inputs/outputs/data trees、components/wires/clusters/scripts/plugins、hash 和 owner |
| GrasshopperSolveRun | 一次求解 | definition、inputs、Rhino/Compute build、seed、status/messages/outputs/cost |
| GrasshopperBakePlan | 烘焙计划 | target document/version、objects/layers/attributes、mapping、preview 和 rollback |
| RhinoPluginPackage | Rhino/GH 包 | RHP/GHA/Yak/dependencies、platform tags、signature/SBOM/license 和 channel |
| SketchUpModelSnapshot | SKP 事实 | entities hierarchy/definitions/instances/tags/scenes/materials/styles/geo/units |
| SketchUpEntityRecord | SketchUp 对象 | persistentId/type/instance path、geometry/transform/tag/material/attributes/hidden |
| SketchUpOperationPlan | Undo 操作 | operation name、target context、steps、commit/abort、object mapping 和 preview |
| SketchUpExtensionPackage | RBZ/extension 包 | Ruby/C extension、loader/dependencies、signature/encryption/SBOM 和 version |
| ArchiCADProjectSnapshot | PLN/Teamwork 事实 | project/stories/elements/attributes/properties/classifications/hotlinks/libraries/layouts |
| ArchiCADElementRecord | ArchiCAD 对象 | GUID/type/story、geometry/parameters/properties/classifications/renovation/hotlink |
| ArchiCADTeamworkContext | 协作状态 | project/server/user、online、rights/reservations/owners、send/receive 和 status |
| ArchiCADOperationPlan | Undo/预留计划 | elements/object sets、rights/reserve、command、commit/release/rollback 和 preview |
| ArchiCADLibraryPackage | GDL/Library 资产 | library parts/objects/macros/textures/dependencies/license、version 和 load status |
| ArchiCADIFCTranslatorVersion | IFC Translator | export/import mapping、schema/MVD、properties/classifications/geometry、version |
| ArchiCADAddOnPackage | Add-On 包 | APX/bundle、DevKit/build/OS、signature/SBOM/dependencies 和 channel |

### D32.6 Rhino 文档、几何与事务

- 3DM Snapshot 读取 ModelUnitSystem、Absolute/Angle/Relative tolerance、EarthAnchor/ConstructionPlane、Layers、Groups、InstanceDefinitions/References、Objects、Views/NamedViews、Materials、Hatch/Dim/Text Styles、UserData/UserStrings 和 plugin data。
- RhinoObject GUID 在文档内稳定；InstanceReference 对象身份包含 definition+instance chain+transform。复制/布尔/拆分/Join 产生 Replaced/Split/Merged。
- RhinoDoc 修改仅在宿主/文档线程和批准 UndoRecord/command context 进行；后台只计算 GeometryBase 副本，回主线程重验对象/文档 serial。
- BRep/NURBS、SubD、Mesh、Extrusion、Curve/PointCloud 分开；转换/meshing 保存参数、容差和拓扑损失。
- 保存新 3DM/版本优先；SaveAs 年版/格式转换和插件 UserData 缺失生成 LossReport。

### D32.7 Grasshopper Definition 与 Solve

Definition Manifest：GH/GHX hash、Rhino/GH build、component GUID/version、clusters/user objects、script language/code hash、plugin/package/assembly dependencies、input/output Schema+data tree、units/tolerance、random seed、solver settings、side effects 和 license。

流程：静态扫描/依赖解析→隔离 Rhino/Compute 小样→结构化输入校验→禁用 UI/文件/网络未声明组件→Solve→收集 runtime messages/solution state→输出 geometry/data tree hash/质量→D26 Evaluator/候选。

Pure Definition 不访问 ActiveDoc/文件/网络、不 Bake；Impure Definition 单独风险级，默认不在 Compute。DataTree path/branch/item 结构是契约，不扁平化。递归/循环/过大几何/失控优化器受 timeout、solution iterations、内存和输出大小限制。

### D32.8 Rhino.Compute

- ComputeDeployment 固定 Rhino/Compute build、OS、RhinoCommon、Grasshopper/插件、license/core-hour、image/VM、max request/timeout/concurrency 和 region。
- 请求只接受批准 Definition/operation ID+结构化输入/Asset refs，不暴露任意 RhinoCommon method/script/URL。
- 无状态请求创建隔离 HeadlessDoc（需时），显式单位/容差，完成销毁；插件全局状态/缓存不得跨租户污染。
- 大任务异步/分片，D08 管理队列/取消/重试/预算；结果按 Definition+input+deployment hash 缓存。
- 桌面与 Compute 对同一金样的几何/数据树/消息/性能回归；不一致的 Definition 只能限定执行路径。

### D32.9 Grasshopper Bake 与 Rhino 写回

BakePlan 固定 Target 3DM Version、candidate/solve、对象类型/attributes/layer/material/name/user data、existing mapping 和 create/update/delete policy。Preview 在副本/临时对象组生成几何/Layer/Object diff。

执行在 Rhino Plugin UndoRecord 中：创建/替换对象→保存 old/new GUID mapping→验证几何/单位/Layer/数量→用户确认 SaveAs 新版本。Bake 不把 Mesh preview 伪装为 BRep，不删除用户对象；更新仅作用于既有平台-owned mapping 且 expected hash 匹配。

### D32.10 SketchUp 模型与对象语义

- SKP Snapshot：Model GUID/format/version、units/precision/axes/geolocation、Entities hierarchy、Groups、ComponentDefinitions/Instances、Persistent IDs、Tags/Folders、Materials/Textures、Scenes/Pages、Styles、SectionPlanes、Dimensions/Text、Classifications 和 AttributeDictionaries。
- Tag 是可见性分类，几何 Edge/Face 应遵循项目建模规则（通常 Untagged、容器打 Tag）；规则不把 Tag 当 CAD Layer 几何容器。
- Instance identity=PersistentId+full InstancePath+Definition；同 Definition 多实例共享 geometry，修改 Definition 影响全部实例，必须 Preview 影响范围。
- Loose geometry 会粘连/切割/合并 Edge/Face，生成工具优先在新 Group/Component 内创建；实体拓扑变化后映射按 Split/Merged 候选。
- Hidden、Tag visibility、Scene style/camera/shadow/section 与实际对象分开记录。

### D32.11 SketchUp Operation、Extension 与写回

- 所有模型修改在 `start_operation`→commit/abort；Operation 不嵌套，Observer 内透明 operation 需谨慎，异常确保关闭/回滚。
- 插件只在 SketchUp UI/Ruby 主上下文访问 API；后台 Thread 不操作 Model。Observer 回调轻量防递归/重复通知。
- ExtensionPackage 使用最小 loader namespace、RBZ/Extension Warehouse 签名（按分发策略）、版本/SketchUp/Ruby/C API/OS compatibility、依赖/资源和 SBOM。
- 不接受云端任意 Ruby；OperationRevision 映射为预注册 Ruby 方法/Schema。C Extension 仅性能必要且签名/架构矩阵完整。
- 写回固定 SKP/Model state/active_entities/active_path/selection，预览新 Group/Component；commit 后保存新 SKP、Persistent ID mapping、几何/Scene/Tag 验证。

### D32.12 SketchUp 导入导出与表达损失

ExchangeProfile 覆盖 SKP year、DWG/DXF/IFC/3DS/OBJ/glTF/DAE 等实际支持格式、units/origin/axes、faces/edges/materials/textures/scenes/tags/components/classifications。导出器/许可证/平台能力按 Compatibility 固定。

常见损失：NURBS→Mesh、BIM property/classification 部分、动态组件行为、Scene/Style/Section、Texture path/UV、Tag folder、soft/smooth edges、geolocation、组件层级/实例共享。导入后检查反面、非流形、重复面/边、微小面、坐标离群和单位。

### D32.13 ArchiCAD 项目与对象语义

- 文件/项目：PLN、PLA（含库归档）、TPL、BIMcloud Teamwork；DocumentIdentity 固定 Project GUID/Teamwork server/project/user、file version/build 和 hash。
- Snapshot：Stories、Elements GUID/type/home story/renovation、Attributes（Layer/Material/Composite/Profile/Pen/Line/Fill）、Properties/Classifications、Zones、MEP、Hotlinks/Xrefs、Libraries/GDL、Views/Layouts/Publisher/Schedules、IFC mapping。
- Element GUID 是首选身份；Hotlink element 含 module/instance chain，不能当本地可编辑对象。Morph/LibraryPart/MEP/自定义对象能力按 API 显式。
- Attribute index/name 可能跨项目不同；用类型+GUID/稳定属性/映射版本，导入前做冲突/依赖分析。

### D32.14 ArchiCAD Teamwork 与 Undoable Command

1. 校验 Teamwork connection/online、用户 rights 和目标 element/object set lock status。
2. Preview 目标 Elements/Attributes/Layouts/Publisher/Hotlink/Library 及 owner；最小 Reserve。
3. 在 `ACAPI_CallUndoableCommand`/对应 API 事务中执行批准 Operation；失败抛错回滚。
4. 读取验证并生成 old/new GUID/property/attribute mapping；按 Operation 策略 Release reservation。
5. Send/Receive 不是普通写操作的隐式步骤，需独立用户批准/权限/回执；离线 Teamwork 任务限制为本地 Draft。

不得抢占其他用户预留或批量 Reserve 全项目。Attribute/Library/Publisher 等 lockable object set 与 Elements 权限分别检查。

### D32.15 ArchiCAD Library、Hotlink、Layout 与 Publisher

- LibraryPackage 保存 GDL object/macro、embedded/external/BIMcloud library、textures、subtypes、parameters、license/hash/compat；Missing/Duplicate Library Part 单独报告。
- GDL 是可执行/参数化内容，签名/来源/脚本静态审查和沙箱金样；不从不可信项目自动提取发布到企业库。
- Hotlink Module 固定 source/version、instance transform/stories、nested/missing/modified 和 owner；Update/Break/Relink 高风险预览，默认不自动打散。
- View Map/Layout Book/Publisher Set 分层；View settings、Drawing links、Master Layout、Pen Set、Publisher format/naming/target 固定。批量发布页级验证，不以 Publisher 命令成功代替输出完整。

### D32.16 ArchiCAD IFC 与开放协同

ArchiCADIFCTranslatorVersion 固定 IFC schema/MVD、Type/Property/Class mapping、Classification、Geometry conversion、Space boundary、Material、Story/Zone、ID/GUID、export filters 和 import conflict policy。按当前 DevKit 使用受支持 IFC API，弃用/删除接口进入 Compatibility/迁移。

IFC 导出后用 IfcOpenShell/D18 Health 验证 schema、GUID、坐标/单位、对象/属性/材料、空间/系统、几何和报告；导入先 sandbox/new file/Hotlink 候选，不直接合并权威 PLN。BCF Issue 通过 D19，不嵌入私有 IFC 属性替代问题系统。

### D32.17 跨工具交换与 LossReport

| 转换 | 首选 | 必须报告 |
|---|---|---|
| Rhino↔Revit | Rhino.Inside/Revit（批准版本）或 IFC/SAT/DWG | 参数/历史、类别/族、NURBS/BRep、对象 ID、单位/坐标 |
| Rhino↔ArchiCAD | IFC/DWG/3DM 支持路径 | BIM 属性、Layer/Story、BRep/Mesh、材料/对象层级 |
| SketchUp↔Revit/ArchiCAD | IFC/分类优先，SKP 作为表达参考 | Face/Edge→BIM Object、组件/Tag、属性、坐标/材质 |
| 三工具→Web | glTF/3D Tiles/SVF2/xeokit 派生 | Mesh/LOD、属性/对象映射、纹理和测量精度 |

Loss 类型：Dropped、Flattened、Tessellated、Approximated、Renamed、UnitConverted、CoordinateTransformed、PropertyMapped、Split/Merged、ReferenceOnly、Unsupported。每项绑定对象/属性/范围/严重度/可逆性和替代策略；高损失不进入 D18/D22/D23 确定性用途。

### D32.18 服务接口与事件

| 接口 | 关键输入 | 输出/约束 |
|---|---|---|
| `POST /multitool-connectors/{id}/revisions` | operations/compat/representations/mapping/security | 不可变 Revision |
| `POST /rhino-snapshots` | 3dm assetVersion、profile | Snapshot/objects/plugins/quality |
| `POST /grasshopper-definitions` | gh/ghx asset、manifest/dependencies/schema | DefinitionVersion/静态验证 |
| `POST /grasshopper-solve-runs` | definition、inputs、desktop/compute deployment、idempotency | 异步 Solve/outputs/messages/cost |
| `POST /grasshopper-bake-plans` | solve/candidate、target 3dm/version、mapping/policy | Preview/Task |
| `POST /sketchup-snapshots` | skp assetVersion、profile | Snapshot/entities/quality |
| `POST /sketchup-operation-plans` | target version、operation/objects、approval | Preview/D29 Task |
| `POST /archicad-snapshots` | PLN/Teamwork binding/version、profile | Snapshot/Teamwork/library/hotlink quality |
| `POST /archicad-operation-plans` | target project/version、elements/objects、reserve/release policy | Preview/D29 Task |
| `POST /archicad-library-packages` | library assets/manifest/compat/license | Quality/approval package |
| `POST /archicad-ifc-runs` | project/version、translatorRevision、scope | import/export Run/Loss/validation |
| `POST /exchange-runs` | source asset、target format/profile、engine | 异步 OutputPackage/LossReport |
| `GET /exchange-runs/{id}` | runId、loss/object filters | status/output/mapping/loss/cost |
| `GET /native-object-mappings` | tool/base/target versions、scope/status | 稳定/候选映射分页 |

事件：`RhinoSnapshotCreated`、`GrasshopperDefinitionApproved/SolveCompleted/SolveFailed/BakeCommitted`、`SketchUpSnapshotCreated/OperationCommitted/RolledBack`、`ArchiCADSnapshotCreated/ReservationConflict/OperationCommitted/PublishCompleted`、`LibraryPackageApproved/Revoked`、`IFCTranslatorPublished`、`ExchangeCompleted/Partial/Failed/LossThresholdExceeded`。

### D32.19 界面与交互详细设计

| 界面 | 主区 | 关键操作 | 防错/反馈 |
|---|---|---|---|
| 多工具兼容中心 | 工具/build/OS/API、插件/包/库/translator、支持 operation/格式 | 发布/停用、查看矩阵、影响分析 | WIP/未测/弃用接口醒目标识 |
| Rhino/GH 面板 | 3DM 文档/单位容差、Definition/依赖/输入、Solve/消息/对象 | 快照、Solve、Preview Bake、取消 | ActiveDoc/Compute、Pure/Impure、插件缺失区分 |
| GH Definition 审查 | 图/组件/Cluster/Script、I/O DataTree、依赖/许可、测试/性能 | 静态审查、金样、批准/撤销 | 任意脚本/文件/网络/副作用阻断 |
| SketchUp 面板 | SKP/active path/selection、Entities/Definitions/Tags/Scenes、任务 | 快照、预览、Operation 执行/Abort | Definition 共享影响/loose geometry/PersistentId 显示 |
| ArchiCAD 面板 | PLN/Teamwork online/rights/reservations、Element/Attribute/Library/Hotlink | Reserve Preview、执行/Release、Publish | owner/离线/对象集权限/Send-Receive 独立提示 |
| Library/Plugin 供应链 | Rhino/GH/Yak、RBZ/Ruby/C、APX/GDL/Library、签名/SBOM/许可 | 上传、扫描、兼容评测、灰度/撤销 | 不可信脚本/宏/依赖禁止运行 |
| Exchange/Loss 工作台 | 源/目标 2D/3D/对象树、Profile、Mapping、Loss 分类/热图 | DryRun、比较、批准输出、关联修复 | Mesh/PreviewOnly/高损失禁止标可编辑 |
| 批处理/运营 | Solve/Compute/Exchange/Publish 队列、资源/许可/成本、错误/版本 | 取消、受控重试、扩容/停用 | 未知执行/计费/部分输出不重复任务 |

### D32.20 组件技术栈方案

| 组件 | 推荐技术栈 | 职责 | 约束/替代 |
|---|---|---|---|
| Rhino Plugin | C#/.NET RhinoCommon + Eto UI；C++ SDK 仅必要 | 3DM/Object/Command/Undo/Selection/Export | Rhino Windows/macOS/build 矩阵 |
| Grasshopper | Grasshopper SDK/GH_IO、批准组件/Cluster/UserObject | Definition/Param/DataTree/Solve/Bake | 插件/脚本/seed/副作用版本化 |
| Rhino.Compute | Rhino.Compute/Rhino.Inside、Hops Adapter | Stateless RhinoCommon/GH Server Solve | 许可/Core-Hour/OS/插件/资源/隔离 |
| SketchUp Extension | Ruby API+HtmlDialog；C API/Extension 仅性能必要 | SKP Entities/Operations/Scenes/Export | Ruby/SketchUp/OS、签名、主线程/非嵌套 Operation |
| SketchUp SDK | SketchUp C SDK（许可/能力验证） | 文件转换/结构辅助 | 不替代 UI Extension/专有行为 |
| ArchiCAD Add-On | Graphisoft C++ DevKit/API、DG UI | Elements/Attributes/Teamwork/Layout/Publisher/IFC | 每 ArchiCAD/OS build 独立编译/签名 |
| ArchiCAD Automation | Python API/JSON Command Adapter（受支持子集） | 批量属性/命令/报告 | 需宿主会话；不作通用无人值守写引擎 |
| openBIM/Geometry | IfcOpenShell/OpenCascade/CGAL、BCF | IFC 验证、中立几何/联邦/Issue | schema/MVD/tolerance/Loss 明确 |
| Adapter/SDK | D29 多语言 SDK Binding + Operation Registry | Task/Receipt/Identity/Transfer/Diagnostics | 各工具 Adapter 不复制 Cloud Control |
| 领域控制面 | Java 21 + Spring Boot 4.1 + PostgreSQL/PostGIS/对象存储 | Snapshots/Definition/Solve/Library/Exchange/Loss/Mapping | 不可变 Revision、Outbox、空间索引 |
| Workflow/Compute | D08 Workflow、容器/VM Worker、许可/队列/预算 | Solve/Exchange/Publish、重试/取消/成本 | 工具许可/并发、未知效果对账 |
| Observability/Test | OpenTelemetry、工具 VM/OS/build/locale/plugin matrix | 事务/求解/预留/交换/崩溃/成本回归 | 文件路径/模型/脚本/凭据脱敏 |

统一 D29 协议和 ExchangeLoss/ObjectMapping 复用三工具，落实 DRY；工具 Adapter/事务/表示明确隔离，落实 SOLID；不建设自有通用 CAD 内核，落实 KISS；先支持项目确认版本/关键格式，不无限兼容，落实 YAGNI。

### D32.21 安全、异常与恢复

| 异常/威胁 | 处理 |
|---|---|
| 恶意 RHP/GHA/Ruby/C/APX/GDL/脚本 | 签名/SBOM/allowlist/静态+沙箱测试，撤销/Incident |
| Rhino/GH 插件/组件缺失/版本不匹配 | Solve Failed/Compatibility，禁止替换近似组件后宣称等价 |
| Grasshopper non-converge/循环/输出爆炸 | solution/iteration/time/memory/output limit，保存 messages/停止 |
| Rhino Desktop/Compute 差异 | Conformance Finding，限定路径/升级/修复，不择优隐藏 |
| SketchUp Operation/Observer 递归/崩溃 | Abort/透明 Operation 规则、暂停 Observer、恢复副本 |
| SketchUp loose geometry ID 重建 | Split/Merged/Ambiguous mapping，人工复核下游 Issue |
| ArchiCAD Teamwork 无权/预留冲突/离线 | Conflict/owner/人工处理，不抢占；仅本地 Draft |
| ArchiCAD Library/Hotlink 缺失/版本变化 | Partial/阻断 Publish/IFC，固定 Package/Source Version |
| IFC/3DM/SKP/DWG 交换高损失 | LossThresholdExceeded，限制 Preview/ReferenceOnly 用途 |
| 单位/坐标/容差不一致 | 阻断几何合并/量测，要求 Profile/控制点确认 |
| 工具/Worker 崩溃/网络中断 | D29 租约/Receipt 对账、Undo/备份/新文件恢复，不重复写 |
| 许可/Core-Hour/并发耗尽 | 队列/预算/人工模式；不绕许可证/启动未批准实例 |

### D32.22 指标与发布门禁

| 指标 | 定义/用途 |
|---|---|
| Compatibility Coverage | 三工具/OS/build/API/插件/库/格式 Active 覆盖 |
| Snapshot Completeness | 原生对象/属性/层级/依赖/视图/协作状态覆盖 |
| Native Mapping Stability | GUID/PersistentId/instance path Stable/Split/Merged/Unmapped |
| GH Solve Success/Repro | Desktop/Compute 成功、重放/数据树/几何一致率 |
| Compute Queue/Cost | 排队/执行 P95、并发/Core-Hour/单位成本 |
| SketchUp Operation Health | Commit/Abort、Undo、ID 重建、宿主崩溃/性能 |
| Teamwork Reservation | 权限/Reserve 冲突、等待/释放/失败和恢复时长 |
| Library/Hotlink Health | 缺失/重复/版本/许可/可加载/发布完整率 |
| IFC/Exchange Conformance | schema/GUID/property/geometry/coords/可打开与工具金样 |
| Loss Severity/Coverage | 交换对象/属性/几何损失和可编辑等级分布 |
| Publish/Writeback Success | 写回/发布/新版本/回滚和下游验证通过率 |
| Security/License Incident | 插件/脚本/库/路径/跨区/许可事件，目标 0 |

发布门禁：目标工具/OS/build/locale、事务/Undo/Teamwork、对象身份/单位/坐标/容差、GH 数据树/插件/Compute 等价、SketchUp loose geometry/scene/tag、ArchiCAD library/hotlink/layout/publisher/IFC、格式交换/Loss、恶意插件/脚本、许可/崩溃/回滚测试通过。

### D32.23 D32 验收条件（EARS）

- When 任一工具 Host 连接, the Adapter shall 验证 product/build/OS/API/runtime、插件签名和 ToolBuildCompatibility。
- When 原生文档快照创建, the 模块 shall 固定 DocumentIdentity、对象/层级、单位/坐标/容差、依赖/插件/库和版本。
- When 跨版本对象映射, the 平台 shall 使用文档身份+GUID/PersistentId/instance path/业务 ID，几何仅生成候选。
- When Grasshopper Definition 注册, the 模块 shall 保存 I/O DataTree、组件/Cluster/Script/插件依赖、单位/seed/副作用和 hash。
- When Rhino.Compute Solve, the 平台 shall 固定 Deployment/插件/许可/单位/容差并隔离租户状态、资源和输出。
- When Grasshopper Bake, the Plugin shall 固定目标 3DM Version、对象/属性/Layer mapping，在 UndoRecord 内预览/执行并验证可编辑几何。
- When SketchUp 模型修改, the Extension shall 在非嵌套 Operation 内执行；异常 Abort，并记录 PersistentId/instance path 的 Split/Merged 变化。
- When 修改 ComponentDefinition, the SketchUp Adapter shall 预览所有受影响 Instances，不把共享定义当单一对象修改。
- When ArchiCAD Teamwork 写入, the Add-On shall 检查 online/rights/owner 并最小 Reserve 目标 Elements/Object Sets，不抢占他人。
- When ArchiCAD Operation 执行, the Add-On shall 使用 Undoable Command/批准计划并独立处理 Send/Receive/Release。
- When GDL/Library/Hotlink 更新, the 模块 shall 固定 source/version/dependencies/license，预览影响并禁止默认打散/覆盖。
- When IFC 导入/导出, the 模块 shall 固定 Translator/schema/MVD/mapping/units/coords，并验证 GUID/属性/几何和 LossReport。
- When 交换产生高严重度 Dropped/Flattened/Tessellated/Unsupported, the 平台 shall 限制输出用途为 Preview/ReferenceOnly 或阻断。
- When 工具任务状态/副作用未知, the 平台 shall 对账宿主 Operation/Receipt/文件 hash 后恢复，不直接重执行。
- When 集成结果完成, the 平台 shall 保存工具/插件/文档、事务/预留、对象映射、表示/损失、输出验证、Usage 和 Trace。

### D32.24 D32 完成检查与下游约束

| 检查项 | 结果 |
|---|---|
| 是否分别覆盖 Rhino/GH/Compute、SketchUp、ArchiCAD/Teamwork 原生语义 | 是 |
| 是否覆盖参数图/烘焙、组件/场景、Library/Hotlink/Layout/Publisher/IFC | 是 |
| 是否明确对象身份、单位坐标容差、交换损失、可编辑性和恢复 | 是 |
| 是否定义接口、事件、界面、技术栈、安全、指标和门禁 | 是 |

D32 对下游的强制约束：D33 可调用 GH/专业工具但固定计算假设；D34 持久化 Snapshot/Definition/Solve/Exchange/Loss/Mapping；D35 固化多语言插件/Compute/Teamwork/Exchange 契约；D37 实现三工具插件/损失/运营界面；D40 覆盖脚本/GDL/插件/库/Teamwork/许可威胁；D42 规划 Compute/桌面/BIMcloud/发布容量成本；D44 建立三工具/OS/build/插件/IFC 资格环境，D45 执行金样并验证签名包/图/Translator 灰度；D46 运营兼容/许可/支持。

