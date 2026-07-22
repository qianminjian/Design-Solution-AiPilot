# D33 GIS仿真与工程软件集成

> 来源：@design/INDEX.md | 创建：2026-07-22 | 更新：2026-07-22
> 原始行范围：9822–10169
> 引用约定：同文件内引用使用 §编号，跨文件引用使用 @design/文件名.md

## D33 GIS、仿真与工程软件集成

### D33.1 任务定义

| 项目 | 内容 |
|---|---|
| 任务目标 | 建立 GIS、日照/采光、能耗、CFD、结构和 MEP/电气等工程求解器的输入假设—模型转换—任务执行—质量验证—结果回链框架 |
| 直接产出 | 分析问题/输入/假设/映射/求解器/运行/质量/结果/校准对象、各领域流程、接口、界面、技术栈和验收 |
| 成功对齐物 | 任一分析结论可追溯几何/属性/边界/工况/天气/荷载/网格/求解器版本、收敛/验证和专业签审 |
| 本任务不做 | 不用 AI 替代物理求解器，不把进程退出码/收敛单指标等同结果有效，不自动把仿真结果写回专业模型或签发工程结论 |
| 主能力 | CAP-14.05、CAP-15.02/03，消费 D18/D29/D32，服务 D10–D11/D13–D16/D21/D26 |

### D33.2 标杆依据与平台取舍

- OGC 标准覆盖 GeoPackage、GML/CityGML、3D Tiles、WMS/WFS/OGC API 等；平台区分权威 Feature、栅格/覆盖、城市语义模型和只读 Portrayal，不把 Tile 当源数据。
- CityGML 3.0 面向城市对象的语义/几何/关系/LOD，适合 BIM—城市上下文；IFC 与 CityGML 采用用途映射而非声称无损一对一。
- EnergyPlus 输入模型、天气 EPW、RunPeriod、Schedule/System 等共同决定输出；OpenStudio 可作为建模/Workflow/Measure 适配层。
- CFD 的 residual convergence 只是必要条件，还需质量、守恒、边界、网格/时间步独立性和实验/基准验证。
- 结构/MEP/电气商业软件 API/格式/许可证差异大；平台统一 Run Contract 和证据，具体 Adapter 在项目工具基线确认后 Qualification。

### D33.3 核心原则

1. AnalysisProblem 先于 Solver：目的、适用阶段、问题域、假设、指标、精度和签审责任先定义。
2. 输入不可变：几何、属性、材料、边界、工况、天气/地形、荷载/组合、网格和 Solver 配置全部版本化。
3. Authoring→Analysis 映射显式：简化、理想化、合并、边界/连接和对象映射保存，不直接把 BIM 当分析模型。
4. RunStatus 与 ValidationStatus 分离：Completed 可为 Invalid/Questionable；未收敛/守恒失败/输入缺失不产出可用结论。
5. 多保真和代理模型明确适用域；代理/AI 只能筛选/加速，关键专业判定由批准 Solver/规则/人工完成。
6. 结果不自动写回：先形成 ResultPackage/ImpactProposal，经专业复核后通过 D29 IntegrationPackage。
7. 软件版本、插件、许可证、计算资源、数值精度和平台差异进入 D28 Qualification/兼容矩阵。

### D33.4 分析领域与责任矩阵

| 领域 | 典型输入 | 典型输出 | 专业责任 |
|---|---|---|---|
| GIS/Site | CRS/地形/地块/道路/建筑/遥感/管线/限制 | 场地上下文、空间叠加、地形/城市模型 | GIS/规划/建筑确认来源/CRS/适用性 |
| Solar/Daylight | 几何/材质/遮挡/位置/时区/天气/传感网格 | 日照小时、辐照、照度/眩光/采光指标 | 建筑/幕墙/照明确认模型/标准/时段 |
| BuildingEnergy | 围护/空间/用途/Schedule/HVAC/天气/控制 | 负荷、能耗、峰值、舒适、系统结果 | 暖通/节能签审假设/系统/结果 |
| CFD | 流体域/网格/边界/物性/湍流/热源/时间 | 速度/压力/温度/污染物/烟气/舒适 | 暖通/消防/CFD 专家验证网格/收敛/工况 |
| Structural | 分析模型/材料/截面/支座/荷载/组合/规范 | 内力/位移/反力/模态/稳定/设计比 | 注册结构工程师确认理想化/组合/设计 |
| Hydraulic/Air | 系统拓扑/管径/设备/流量/阻力/控制 | 流量、压降、水力平衡、泵/风机工况 | 给排水/暖通确认系统/工况/设备 |
| Electrical | 单线/负荷/线路/保护/短路参数/接地 | 潮流、压降、短路、选择性/弧闪候选 | 电气工程师确认网络/保护/标准 |
| Fire/Egress | 空间/人员/路径/材料/火源/排烟/边界 | 疏散时间、烟层/温度/能见度、风险场景 | 消防专业/有权机构按适用法规评审 |

### D33.5 领域对象

| 对象 | 职责 | 关键内容 |
|---|---|---|
| AnalysisProblem | 稳定分析身份 | domain、purpose、stage、owner/reviewer、risk 和 lifecycle |
| AnalysisProblemRevision | 不可变问题契约 | scope、inputs/assumptions/scenarios、solver plan、metrics/quality 和 status |
| AnalysisInputSet | 固定输入集 | model/GIS/weather/material/load/system assets、versions/hash 和 completeness |
| AnalysisAssumption | 假设 | type/value/unit/source/rationale、uncertainty、owner、approval 和 expiry |
| BoundaryConditionSet | 边界/初始条件 | domain/objects/surfaces/nodes、type/value/time/function、source 和 version |
| LoadCaseSet | 工况/荷载 | cases/combinations/scenarios、factors/schedule/probability、basis 和 version |
| AnalysisModelRevision | 求解器分析模型 | topology/geometry/properties/mesh/network、format、tool version 和 hash |
| AuthoringAnalysisMap | BIM/GIS—分析映射 | source objects、analysis nodes/elements/zones、transform、simplification 和 status |
| SimplificationRecord | 理想化/简化 | removed/merged/centerline/equivalent property、reason/error 和 approval |
| SolverDefinition | 稳定求解器身份 | vendor/product/domain、owner、license、risk 和 lifecycle |
| SolverDeployment | 可执行环境 | product/build/module/plugin/OS/hardware/region/license、image/VM 和 health |
| SolverProfileVersion | 运行配置 | algorithms/models/tolerances/iterations/time step/output controls 和 version |
| SimulationScenario | 一次场景定义 | problem/model、assumptions/BC/load、weather/time、solver profile 和 status |
| SimulationRun | 一次求解 | scenario/deployment、input hash、job/attempt、status/log/resource/cost 和 output |
| MeshRevision | 网格/离散化 | method/dimension/cell-element count/quality/zones/refinement、hash 和 validation |
| ConvergenceRecord | 收敛证据 | residuals/iterations/time steps、criteria、mass/energy balance 和 status |
| SimulationResultSet | 原始/规范结果 | fields/tables/time series/extrema、units/location/time、solver output 和 hash |
| ResultQualityAssessment | 结果质量 | input/mesh/convergence/balance/benchmark/sensitivity/coverage、status 和 reviewer |
| AnalysisMetricResult | 业务指标 | metric/value/unit/aggregation/threshold、uncertainty、evidence 和 rule |
| CalibrationRecord | 校准 | measured/reference data、parameters、objective/error、fit/validation 和 version |
| SensitivityScenarioSet | 敏感/不确定性 | variables/distributions/ranges/correlation/sampling、seed 和 budget |
| GISDatasetVersion | GIS 数据集 | source/authority/license/time/CRS/vertical datum/schema/extent/resolution 和 hash |
| CRSDefinition | 坐标参考 | EPSG/WKT/PROJ、axis/order/units、vertical/geoid、epoch/transform grid 和 version |
| WeatherClimateDataset | 天气/气候 | EPW/TRY/TMY/source/station/period/timezone/DST/quality/climate scenario 和 hash |
| SolverResultPackage | 可交付证据包 | inputs/model/config/run/log/results/quality/metrics/report/signatures 和 manifest |
| ResultImpactProposal | 回写候选 | target objects/parameters、source metric、change/risk、preview/approval 和 status |

### D33.6 通用分析生命周期

```text
ProblemDraft → AssumptionsReview → InputReady → ModelBuild → ModelReview
→ ScenarioReady → Queued → Running → Completed/Failed/Cancelled
→ QualityReview → Valid/Questionable/Invalid → ProfessionalReview
→ Accepted/Rejected → ImpactProposal/Archive
```

1. 专业负责人发布 ProblemRevision，明确目的/非目的、适用规则、质量/精度、输出和人工责任。
2. 固定 D18 Federation/专业模型、GIS/天气/材料/荷载/系统输入；完成完整性和许可/CRS/单位检查。
3. 生成 AnalysisModelRevision/AuthoringAnalysisMap/SimplificationRecord；独立专业审查。
4. 固定 Scenario/SolverDeployment/Profile/BC/Load/Mesh，运行 dry-run/small case。
5. D08 调度 Solver，收集原生日志/输出/资源/许可证/成本；失败保留 Attempt。
6. 执行 ResultQualityAssessment；Completed 但 Invalid 不进入业务指标/Gate。
7. 专业人员审签 SolverResultPackage；需要设计变更时生成 ImpactProposal，不直接改模型。

### D33.7 GIS 数据与 BIM 定位

- GISDatasetVersion 来源分 Authority/Survey/OpenData/Commercial/ProjectDerived，保存许可、采集/有效时间、分辨率/精度、extent、NoData、schema 和质量。
- CRSDefinition 使用 EPSG/WKT2/PROJ string+轴序/单位/epoch/vertical datum/geoid grid；Web Mercator 仅显示，不作高精测量/工程定位。
- BIM D18 CoordinateReference 与 GIS CRS 通过控制点/测量基准/变换网格建立 CoordinateTransform；至少三个非共线控制点（适用时）和水平/垂直误差。
- 服务类型分 Feature（OGC API Features/WFS）、Map/Tile（WMS/WMTS/Vector Tiles）、Coverage/Raster（COG/WCS）、3D City（CityGML/CityJSON/3D Tiles）、Portable（GeoPackage）。Tile/Map 不能反向当权威 Feature。
- GIS 导入经 bbox/feature/像素/层/属性/CRS/许可限制；服务器端裁剪/简化并保存原始数据版本。

### D33.8 CityGML/3D Tiles 与城市上下文

CityGML 3.0 保存语义类、geometry/topology/appearance、LOD、time/dynamics/ADE；3D Tiles 用于流式 portrayal/selection。BIM→CityGML 映射按用途（规划/能耗/日照/城市分析）定义 LoD/对象/属性，不承诺完整施工图语义。

转换报告 Building/BuildingPart/Storey/Room/Surface/Openings、Terrain/Vegetation/Road/Water、IFC GUID/City object ID、坐标/LOD/几何修复和属性损失。3D Tiles feature IDs 映射源 City/BIM ObjectRef；量测精度取决源/LOD，不由渲染网格推断。

### D33.9 日照、辐照与采光

输入：位置/CRS、true north、timezone/DST、日期/时段/气象天空、周边遮挡/地形、玻璃/反射/透射、空间/开口、sensor grid、view direction 和评价标准。

方法分确定性太阳几何/遮挡、Radiance ray-tracing/annual daylight、简化代理；每个 Metric 指定工具/模型、sampling/rays/ambient settings、grid spacing/height 和适用范围。校验太阳位置/时区/北向、闭合/法向/材质、遮挡完整性和网格收敛/重复性。

输出日照小时、辐照/照度、sDA/ASE/UDI/眩光等仅按具体标准/版本使用；渲染亮度不作为照度证据。极端/反射复杂场景需高保真/人工审查。

### D33.10 建筑能耗与负荷

- AnalysisModel 保存 thermal zones/spaces/surfaces/subsurfaces、construction/material、infiltration/ventilation、occupancy/equipment/lighting schedules、HVAC systems/controls、setpoints、plant、meters 和 sizing。
- WeatherClimateDataset 固定 EPW/设计日/RunPeriod、station/period/timezone/DST、缺测/质量和未来气候情景。
- BIM 空间/围护/设备映射记录简化、相邻/边界、窗墙/热桥、未建模负荷；gbXML/IDF/OSM 导出都生成 LossReport。
- EnergyPlus/OpenStudio Run 保存版本/Measures、timestep/warmup/sizing、errors/warnings、unmet hours、energy balance 和 SQL/ESO/HTML 输出。
- 校准按实测/基准数据、时间对齐、CV(RMSE)/NMBE 等项目标准和 holdout 期；校准良好不证明未来设计唯一正确。

### D33.11 CFD/风环境/排烟

1. 定义 fluid domain、geometry cleanup/simplification、inlets/outlets/walls/openings/symmetry、fluid properties、heat/contaminant/fire sources、turbulence/buoyancy/radiation/species、steady/transient 和 scenario。
2. 生成 MeshRevision：method/cell zones/boundary layers/refinement、skewness/non-orthogonality/aspect ratio/y+ 等质量（按 Solver）。
3. 固定 discretization/solver/coupling/relaxation/time step/CFL/residual/output controls 和 parallel decomposition。
4. 检查 residual、监控点/积分量稳定、质量/能量/物种守恒、时间步/网格独立性、边界合理性和 benchmark/实验。
5. 输出 field/time series/surface/line/probe、comfort/pressure/temperature/smoke metrics；专业审核后用于方案比较/合规证据。

收敛残差低但解振荡、守恒差或边界错误仍 Invalid；未收敛结果只能诊断，不用于门禁。

### D33.12 结构分析集成

- Authoring→Analysis：中心线/板壳/实体、节点/构件/楼层/支座/释放/刚域/偏心、材料/截面、连接、质量源、diaphragm/constraint、网格和构件 orientation。
- LoadCaseSet：dead/live/wind/seismic/snow/temperature/construction、pattern/case/combination、factor/方向/偶然偏心、规范/参数和单位。
- SolverProfile：线性/二阶/非线性、模态/反应谱/时程、稳定/屈曲、阶段施工、设计模块和容差。
- 质量：模型稳定/机制、节点连接、荷载平衡、单位/质量、模态有效质量、反力平衡、网格/步长、warning/error、手算/基准。
- 结果：node displacement/reaction、element forces/stress、mode/frequency、drift、utilization/design ratio；写回只形成受控对象/参数候选，由结构工程师签审。

具体 ETABS/SAP2000/SAFE/Robot/STAAD/Midas 等 Adapter 需 API/文件格式/许可证/版本 PoC 后启用，不在核心绑定厂商字段。

### D33.13 MEP 水力、风网与电气分析

| 域 | 分析模型 | 质量/结果 |
|---|---|---|
| 给排水水力 | node/link、demand/fixture、pipe length/diameter/roughness/elevation、pump/tank/valve、scenario | 连通/边界/质量守恒、压力/流量/流速/水头损失/泵工况 |
| 暖通风水网 | duct/pipe network、terminal/load、fitting/local loss、fan/pump/coil/control | network balance、压损/流量/速度、设备点/能耗、未满足端点 |
| 电气 | bus/load/source/transformer/cable/protection/switch/ground、operating scenario | 网络连通/基准/设备额定、load flow/voltage drop/short circuit/selectivity/arc flash candidate |

连接器必须保存 BIM 系统/设备/Connector↔分析 node/branch mapping、等效长度/局部阻力/需求多样性/同时系数/负荷因数和来源。开放算法（如 EPANET/Modelica）与商业专业软件结果均需项目规则/工具资格和专业复核；不得用通用图算法替代规范求解器。

### D33.14 场景、敏感性、校准与代理模型

- SimulationScenario 代表固定工况；Base/Design/Peak/Failure/Emergency/FutureClimate/Construction 等通过 Load/BC/Assumption 差异表达。
- SensitivityScenarioSet 由 D26 调度参数范围/分布/相关性/DOE/seed/预算；每个 Run 独立，结果按 scenario/uncertainty 聚合。
- CalibrationRecord 分 calibration/validation 数据，避免同数据拟合/验证；参数物理范围/可辨识性/过拟合和残差模式审查。
- Surrogate/Reduced-order Model 由 D28 管理，绑定训练空间/Solver/Metric/误差/OOD；可用于筛选/优化，但超过适用域或硬约束时回高保真。

### D33.15 Solver 运行、许可证与资源

SolverDeployment 模式：Desktop Plugin、Local Headless/CLI、Container（许可允许）、Vendor Cloud/API、HPC Scheduler。每种固定 executable/image、version/module/plugin、OS/hardware/precision/parallel runtime、license server/features、region 和 data policy。

- License Lease 在 Run 前申请，保存 feature/count/checkout/expiry；失败排队/人工，不绕许可证。
- 输入/输出目录任务隔离、相对路径 Manifest、无任意网络/脚本；Solver 只读输入，输出限额。
- HPC/Cloud jobId、queue/host/resources、scheduler state、stdout/stderr/checkpoint 保存；Cancel 与许可证释放对账。
- 重试仅对基础设施瞬时失败；Solver divergence/input error 不用相同输入无限重试。
- cost=license/core-hour/CPU-GPU/storage/egress/vendor units，预留/结算到项目/Study。

### D33.16 结果质量与专业签审

ResultQualityAssessment 维度：InputCompleteness、Mapping/Simplification、Units/Coordinates、Mesh/Discretization、Convergence、Conservation/Equilibrium、NumericalSensitivity、Benchmark/Calibration、OutputCoverage、SolverWarnings、Reproducibility。

状态：Valid、ValidWithLimitations、Questionable、Invalid。ValidWithLimitations 必须列 Scope/限制/补偿审查；Questionable/Invalid 不进入 D21 Gate/D26 高保真 Objective。专业签审保存 reviewer/资格/决定/未决/限制/签名，AI 摘要不能签审。

### D33.17 结果规范化、可视化与回写

- 原始 SolverResultSet 永存受控对象存储；规范结果采用 ResultField/Series/Table/Scalar，保存 quantity kind/unit、spatial support（node/element/cell/surface/zone）、time/frequency/case、aggregation 和 source variable。
- 坐标/对象映射回 D18 Snapshot，保存 transform/AuthoringAnalysisMap；无法映射的结果保留分析空间，不强贴 BIM。
- Web 可视化使用 2D chart、contour/vector/streamline/iso-surface/deformed shape/animation；色标/范围/单位/变形倍率/时间/Case 固定，防误导。
- ResultImpactProposal 只提出对象/参数/几何变化和证据，D29/专业连接器 Preview/Approval 后新建源模型版本。

### D33.18 服务接口与事件

| 接口 | 关键输入 | 输出/约束 |
|---|---|---|
| `POST /analysis-problems/{id}/revisions` | domain/scope、inputs/assumptions/scenarios、solver/quality/metrics | 不可变 Revision |
| `POST /analysis-input-sets` | asset/model/GIS/weather/material/load refs、manifest | 完整性/许可/坐标报告 |
| `POST /analysis-models` | problem/input、adapter/profile、mapping/simplification | 异步 ModelRevision/Review |
| `POST /simulation-scenarios` | model、assumptions/BC/load/weather、solver profile | Draft Scenario/静态验证 |
| `POST /simulation-runs` | scenario、deployment、resource/budget、idempotencyKey | 异步 Run/job/license/cost |
| `GET /simulation-runs/{id}` | runId、log/result/quality mode | 状态、收敛/资源/输出/成本 |
| `POST /simulation-runs/{id}:cancel` | expectedRevision、reason | Scheduler/Solver/License 取消对账 |
| `POST /result-quality-assessments` | run/results、checks/benchmarks、reviewer | Quality status/limitations/evidence |
| `POST /solver-result-packages` | run/input/model/results/quality/metrics/signatures | 不可变 Manifest/交付包 |
| `POST /result-impact-proposals` | result metrics、target objects/version、changes/risk | Draft 回写候选 |
| `POST /gis-datasets` | source/license/time/CRS/schema/extent/assets | DatasetVersion/quality |
| `POST /coordinate-transformations:validate` | source/target CRS、control points/grids、tolerance | 变换/误差/状态 |
| `POST /calibration-runs` | model/scenarios、measured data、parameters/objective | 校准/验证结果 |
| `POST /sensitivity-scenario-sets` | problem/variables/distributions/method/seed/budget | D26 Study/Run 集 |
| `GET /analysis-mappings` | authoring/analysis versions、object/status | mapping/simplification/loss 分页 |

事件：`AnalysisProblemPublished`、`InputSetValidated/Rejected`、`AnalysisModelBuilt/Reviewed`、`SimulationRunQueued/Started/Completed/Failed/Cancelled`、`ConvergenceFailed`、`ResultQualityAssessed`、`SolverResultPackageAccepted/Rejected`、`ResultImpactProposed/Integrated`、`GISDatasetUpdated`、`SolverLicenseUnavailable`。

### D33.19 界面与交互详细设计

| 界面 | 主区 | 关键操作 | 防错/反馈 |
|---|---|---|---|
| 分析问题工作室 | 目的/非目的、输入/假设、场景、Solver/质量/指标、责任 | 建模、静态校验、提交专业评审 | 假设/硬边界/签审责任必填 |
| GIS/坐标工作台 | 图层/来源/时间/许可、CRS/垂直基准/轴序、控制点/误差、BIM Overlay | 裁剪、变换验证、固定 Dataset | Tile/WebMercator/未知高程不可当权威测量 |
| Authoring→Analysis 映射 | BIM/GIS 3D、分析节点/单元/Zone/Network、简化/损失、属性 | 确认/修正/拆并映射、专业签审 | 几何近似/未映射/等效属性醒目 |
| Scenario/Solver 配置 | BC/Load/Weather/Material、Mesh、算法/容差/输出、资源/许可/成本 | DryRun、提交、克隆场景 | 单位/缺边界/不兼容 Solver 阻断 |
| Run 监控 | DAG/job/host/license、日志/残差/监控量/资源、状态/成本 | 取消、查看 checkpoint、基础设施重试 | Completed 与 Valid 分开；divergence 禁自动重试 |
| 结果/质量审查 | 2D/3D field/chart、case/time/color scale、输入/网格/收敛/守恒/benchmark | 比较、标限制、专业签审 | 变形倍率/色标/单位固定显示，Invalid 水印 |
| 场景/敏感/校准 | 多场景矩阵、分布/区间、参数效应、fit/validation、代理 OOD | 比较、校准、启动高保真复核 | 同数据拟合验证/超适用域警告 |
| Solver/许可运营 | Adapter/版本/部署/模块/许可、队列/容量/成本/错误/弃用 | Qualification、维护/停用、扩容/对账 | 不展示 license key；工具更新需回归 |

### D33.20 组件技术栈方案

| 组件 | 推荐技术栈 | 职责 | 约束/替代 |
|---|---|---|---|
| GIS 核心 | GDAL/OGR、PROJ、GEOS、PostGIS、QGIS Server/OGC API Adapter | 格式/CRS/栅格/矢量/空间查询/服务 | grid/vertical datum/license/version 固定 |
| 城市/三维 GIS | CityGML/CityJSON、Cesium 3D Tiles、CesiumJS | 城市语义/LOD/流式可视 | 3D Tiles 为派生；对象 ID/精度/Loss |
| 日照/采光 | Radiance/Ladybug Tools/Honeybee、批准商业 Adapter | 太阳/辐照/照度/眩光分析 | 天气/材质/参数/许可证/专业金样 |
| 能耗 | EnergyPlus + OpenStudio SDK/CLI/Measures | thermal model、workflow、simulation/output | OSM/IDF/EPW/Measure/version/错误固定 |
| CFD | OpenFOAM Adapter；Fluent/STAR-CCM+/FDS 等项目批准 Adapter | 网格/求解/场/排烟 | Solver/模型/许可证/API/HPC 按项目 Qualification |
| 结构 | OpenSees/CalculiX 适配；ETABS/SAP/SAFE/Robot/STAAD/Midas Adapter | 分析模型、荷载/求解/结果 | 商业 API/格式/设计模块/规范版本确认 |
| MEP 水力/系统 | EPANET/Modelica/OpenModelica 与专业商业软件 Adapter | network/system calculation | 领域规则/设备数据/许可证和专业验证 |
| 电气 | pandapower/OpenDSS 辅助；ETAP/SKM/EasyPower 等 Adapter | network/load flow/short circuit/保护候选 | 不用开源辅助替代法定/项目指定工具 |
| Analysis Adapter SDK | D29 SDK + CLI/REST/File/HPC connectors + D21 Result contract | Input/Job/Log/Result/Quality/Mapping | 无任意命令；高层 SolverProfile/Schema |
| 领域控制面 | Java 21 + Spring Boot 4.1 + PostgreSQL/PostGIS/Timescale/对象存储 | Problem/Input/Model/Run/Result/Quality/Calibration | 原始大结果对象存储、元数据/索引分离 |
| Workflow/HPC | D08 Workflow、Kubernetes/Slurm/PBS/Vendor Cloud Adapter | 队列/资源/许可/checkpoint/取消/预算 | 幂等、未知 Job 对账、数据驻留 |
| 可视化/观测 | VTK/ParaView 服务适配、Cesium/xeokit/Plotly、OpenTelemetry | field/chart/3D、Run/资源/成本追踪 | 色标/单位/倍率固定；敏感模型裁剪 |

统一 AnalysisProblem/Input/Scenario/Run/Quality/Result 契约避免每个求解器重复，落实 DRY；领域 Adapter 和 SolverDeployment 依赖倒置，落实 SOLID；不自研求解器，落实 KISS；只有项目确定且完成 PoC/许可证的商业工具才启用，落实 YAGNI。

### D33.21 安全、异常与恢复

| 异常/威胁 | 处理 |
|---|---|
| 恶意 GIS/模型/脚本/Measure/Case | MIME/路径/压缩/脚本 allowlist、沙箱/签名/SBOM |
| CRS/单位/垂直基准缺失 | Input Invalid，禁止空间合并/量测/求解 |
| Solver/Plugin/License 不兼容 | CapabilityUnavailable/排队/人工，不换未批准工具 |
| Mesh/Analysis Model 无效 | Run 前阻断或 Result Invalid，保留映射/质量 Finding |
| Divergence/NaN/非物理解 | 停止/Invalid，保存 residual/fields/log，不填默认值 |
| Solver 正常退出但守恒/平衡/输出缺失 | Completed+Invalid，禁止业务指标/Gate |
| Job/Worker/HPC 网络中断/状态未知 | scheduler/jobId/checkpoint/output 对账，基础设施失败有界恢复 |
| 输出超大/磁盘满 | 预估/配额、分区/采样/压缩；不丢必需原始证据 |
| 许可证/成本耗尽 | 队列/预算停止新 Run，安全取消/释放并报告 Partial Study |
| 商业 Solver 文件/API 弃用 | Compatibility/契约测试/迁移，旧结果可重放/只读 |
| 结果可视化色标/单位误导 | 固定 metadata/水印/验证，客户端不能改权威截图无标识导出 |
| 写回目标版本变化 | ImpactProposal Conflict，重新映射/预览，不自动覆盖 |

### D33.22 指标与发布门禁

| 指标 | 定义/用途 |
|---|---|
| Input/Assumption Completeness | 必需输入/已批准假设/工况覆盖 |
| Authoring-Analysis Mapping | Stable/Reviewed/Unmapped/Simplified 对象/系统比例 |
| Model/Mesh Quality | 领域检查/网格质量/无效模型和修复时长 |
| Run Success vs Validity | Completed、Valid/Questionable/Invalid 分布，禁止合并 |
| Convergence/Balance | 收敛、守恒/平衡、warning 和独立性通过率 |
| Benchmark/Calibration | 基准/实测误差、holdout 结果和适用域 |
| Reproducibility | 相同输入/Solver/环境在容差内结果一致率 |
| Result Coverage/Mapping | 必需变量/Case/time/空间结果与 BIM 映射覆盖 |
| Professional Review Lead | 质量审查/签审/退回时长和一次通过率 |
| Queue/License/Utilization | 排队、许可等待、CPU/GPU/HPC 利用率和失败 |
| Run Cost/Efficiency | 场景/指标单位成本、代理筛选节省和浪费 |
| Security/Data Incident | 恶意输入/脚本/跨区/许可证/泄漏事件，目标 0 |

SolverAdapter/Profile 发布门禁：工具/OS/hardware/plugin/license、输入 Schema/单位/CRS、官方/行业 benchmark、失败/收敛/守恒/网格/时间步、版本重放、并发/取消/checkpoint、恶意输入/脚本、数据驻留/成本、结果映射/可视化/签审和回滚测试通过。

### D33.23 D33 验收条件（EARS）

- When AnalysisProblemRevision 发布, the 平台 shall 固定目的/非目的、输入/假设、场景、Solver、质量/指标和专业责任。
- When AnalysisInputSet 创建, the 平台 shall 保存模型/GIS/天气/材料/荷载/系统的版本/hash、许可、单位/CRS 和完整性。
- When Authoring 模型转换为 AnalysisModel, the Adapter shall 保存对象映射、简化/理想化、等效属性、变换和专业审查。
- When GIS/BIM 坐标转换, the 模块 shall 固定 CRS/轴序/单位/垂直基准/epoch/grid 和控制点误差。
- When SimulationScenario 创建, the 模块 shall 固定 AnalysisModel、Assumption/BC/Load/Weather、Mesh 和 SolverDeployment/Profile。
- When SolverRun 执行, the 平台 shall 保存 job/attempt、工具/版本/插件/许可、资源/环境、原生日志/输出和成本。
- When Solver 进程完成, the 平台 shall 分别评估输入、映射、网格、收敛、守恒/平衡、敏感性、benchmark 和输出覆盖。
- When residual 达标但守恒/监控量/网格独立性失败, the 平台 shall 标记 Questionable/Invalid，不自动接受。
- When 结果包含 NaN/Inf/缺变量/缺 Case/未收敛, the 模块 shall 禁止以默认值生成业务指标。
- When 代理模型用于筛选/优化, the 平台 shall 验证 D28 Qualification/适用域/OOD，并对关键候选运行高保真 Solver。
- When 校准执行, the 模块 shall 分离 calibration/validation 数据、保存参数范围/目标/误差和过拟合/可辨识性评审。
- When SolverResultPackage 被接受, the 平台 shall 包含全部输入/假设/模型/配置/Run/日志/结果/质量/指标和专业签名。
- When ResultImpactProposal 创建, the 模块 shall 固定目标模型版本、对象/参数/风险和预览，不直接写回。
- When Solver/HPC/许可证状态未知, the 平台 shall 先按 job/license/output 对账再恢复，禁止重复求解/收费。
- When 历史分析重放, the 平台 shall 使用保存的输入/Solver/环境/依赖或返回明确不可复现原因/差异。

### D33.24 D33 完成检查与下游约束

| 检查项 | 结果 |
|---|---|
| 是否覆盖 GIS/CRS/城市模型、日照采光、能耗、CFD、结构、MEP/电气/消防 | 是 |
| 是否形成输入假设—分析映射—场景—求解—质量—专业签审链 | 是 |
| 是否区分运行完成/收敛/结果有效并覆盖校准、敏感性、代理和写回 | 是 |
| 是否定义接口、事件、界面、技术栈、安全、指标和门禁 | 是 |

D33 对下游的强制约束：D34 持久化 Analysis/GIS/Solver/Run/Result/Quality；D35 固化 CLI/REST/File/HPC/Result 契约；D37 实现 GIS/映射/Run/结果质量界面；D40 覆盖恶意模型/脚本/求解器/HPC/跨境威胁；D42 建立网格/场景/CPU-GPU/HPC/许可容量成本模型；D44 提供各领域 Worker/HPC 资格环境，D45 执行 benchmark/收敛/守恒/故障测试并验证签名 Solver Adapter/Profile；D46 运营许可证、队列、版本/校准和专业支持。

#### D33.24.1 CAD/BIM 集成、openBIM 与多专业协同现实性审计（业界对标审计补充）

 **审计依据：** buildingSMART openBIM 实施指南 2025、Autodesk APS 2025–2026 API 文档、IFC4x3 vs IFC2x3 采用现状、行业多专业协同实践调研。本节覆盖 D29–D33（CAD/BIM 集成）、D18–D19（IFC/BCF）和 D13–D16（多专业）的现实性审计。

**CAD/BIM 集成可行性审计（D29–D33）：**

| 连接器 | 2025–2026 实际可行性 | 关键约束 | V0 策略 |
|---|---|---|---|
| Revit Add-in (D30) | ✅ 成熟 | Revit API 稳定，但受 Revit 版本/许可证约束；桌面操作需 Windows | V0 不实现，V1 优先验证 |
| APS 云端 (D30) | ✅ 可用 | API 限流（并发任务数）、计费（按使用量）、模型大小限制；Design Automation 需 Windows 引擎 | V0 不实现，V1 评估 |
| AutoCAD (D31) | ✅ 成熟 | DWG 格式稳定，.NET API 成熟；但施工图场景逐渐被 Revit 替代 | V0 不实现，V2 按需 |
| Rhino/GH (D32) | ✅ 可用 | Rhino.Inside.Revit 可联动；但参数化设计场景 V0 不需要 | V0 不实现，V2+ |
| GIS (D33) | ✅ 可用 | CityGML/3D Tiles 标准成熟；但 V0 无场地分析需求 | V0 不实现，V2+ |
| 桌面连接器框架 (D29) | ⚠️ 过度（V0） | 完整框架（设备证书、离线队列、升级签名）对 V0 过度 | V0 不实现，V1 按需简化 |

**V0 工具集成策略：** V0 不实现任何 CAD/BIM 连接器。V0 的输入是上传的文件（PDF/图片/DWG），不是实时工具集成。这符合 D02 V0 “基线验证”定位。

**IFC/IDS/BCF 实施差距审计（D18–D19）：**

| 标准 | 设计覆盖 | 实际工具兼容性 | 补充建议 |
|---|---|---|---|
| IFC4x3 | D18 已设计 | ⚠️ 行业主流仍为 IFC2x3；IFC4x3 工具支持不完整（Revit 2025 部分支持，ArchiCAD 较好） | V2 实现时优先支持 IFC2x3 交换，IFC4x3 作为增强 |
| IFC2x3 | D18 已设计 | ✅ 行业主流，所有工具支持 | 保持 |
| IDS (Information Delivery Specification) | D06/D18 已设计 | ⚠️ buildingSMART IDS 标准 2024 发布，工具支持初期（Solibri、bimspot） | V2 实现，V0/V1 不需要 |
| BCF (BIM Collaboration Format) | D19 已设计 | ✅ 成熟，Navisworks/Solibri/Revizto 支持 | V2 实现（D19 碰撞检测上线时） |
| 碰撞检测 | D19 已设计 | ✅ 成熟工具（Navisworks/Solibri）已商用 | V0 不自建，V2 评估自建 vs 集成 |

**关键审计发现：**
1. D18–D19 设计完整且符合 openBIM 标准，但 V0/V1 不需要实现（无多专业协调场景）。
2. 碰撞检测建议 V2 优先集成成熟工具（Navisworks/Solibri API），而非完全自建——降低技术风险。
3. IFC 版本策略：V2 实现时以 IFC2x3 为基线交换格式，IFC4x3 作为增强选项。
**多专业协同现实性（D13–D16）：**

| 专业模块 | V0 必要性 | 实现策略 | 渐进接入验证标准 |
|---|---|---|---|
| 建筑 (D12) | V0 场景核心（方案阶段） | V0 只到方案比选，不深入施工图 | — |
| 结构 (D13) | V0 不需要 | V2 接入 | 建筑→结构条件接口验证通过 |
| 给排水 (D14) | V0 不需要 | V2 接入 | 结构→MEP 条件接口 + 碰撞检测可用 |
| 暖通 (D15) | V0 不需要 | V2 接入 | 同上 |
| 电气 (D16) | V0 不需要 | V2+ 接入 | 同上 + 电气规范规则集就绪 |

**V0 明确只做建筑专业纵向闭环：** 从草图输入→识别→方案比选→最小审校→发布。其他专业保留接口设计（D13–D16 文档不删除），但不进入 V0 开发。专业模块渐进接入的验证标准为：

1. 建筑→专业条件接口（DesignCondition）已定义并通过单元测试
2. 碰撞检测/协调工具已可用（D19 或外部工具集成）
3. 专业规则集已建立并通过专家验证
4. 试点项目有真实多专业数据

