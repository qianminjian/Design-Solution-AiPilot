# 施工图全流程 AI 平台设计明灯

## 目标与成功标准
- 建设覆盖前期策划、概念设计、方案设计、扩初设计、施工图、多专业协同、审查、交付与变更的 AI 平台。
- 原始“境外主创草图到方案深化”流程作为首个业务场景，不限定平台最终范围。
- 唯一设计正文为 `deep-research-report.md`，后续详细设计均在该文件内完成。
- 每个板块、组件、模块、接口、流程和界面最终具备可实施、可测试、可追溯的设计。

## 范围边界
**做：** 原始需求澄清、总体设计补充、全流程能力设计、组件技术栈和详细设计任务计划。

**不做：** 当前阶段不编码、不部署、不修改数据库；AI 不替代注册建筑师/工程师的专业审签和监管审批。

## 设计决策
| # | 决策 | 理由 | 日期 |
|---|---|---|---|
| 1 | 维持“施工图全流程 AI 平台”定位 | 原设计初稿已确定，细化不得改变方向 | 2026-07-16 |
| 2 | 总体能力完整设计、实施分阶段推进 | 平衡长期目标与 KISS/YAGNI | 2026-07-16 |
| 3 | 采用 CDE + 工作流 + AI 能力平台 + 专业工具连接器 | 支撑跨阶段、跨专业、跨工具协同 | 2026-07-16 |
| 4 | IFC、IDS、BCF 分别用于模型、信息要求和问题交换 | 遵循 openBIM 标准职责边界 | 2026-07-16 |
| 5 | 所有 AI 结果按风险等级进入人工复核 | 保留专业责任和发布控制 | 2026-07-16 |
| 6 | D01–D46 为条件性设计基线，未通过开工准入前不称 Implementation Ready | Open Decision、精确版本与测试证据仍需实例化 | 2026-07-16 |
| 7 | EVAI、小库 AI、建筑学长默认采用 `ManualHandoff` | 未发现公开 API/Key 控制台；正式自动接入须通过供应商资格与书面授权 | 2026-07-19 |
| 8 | `施工图全流程AI平台综合建设方案.md` 为人读版派生方案 | 支撑汇报和跨团队评审，不建立第二套设计事实源 | 2026-07-19 |
| 9 | V1 技术试点采用通用英文境外、中小型办公、建筑纵向闭环 | 技术验证优先；结构/MEP 先保留交换与协调 | 2026-07-19 |
| 10 | OD-01 首次产品化：通用英文境外，ISO/EN 优先，公制 SI，境外云 Region 厂商待定 | 规范版权清晰；与原始"境外主创草图"业务场景一致；GoldenDataset 标注成本可控 | 2026-07-22 |
| 11 | OD-02 首批建筑类型：中小型办公（5–15 层，框架/框剪），排除超高层和医疗/实验室 | 结构规整、规则集成熟；碰撞场景典型；标注成本可控 | 2026-07-22 |
| 12 | OD-03 首批专业深度：建筑纵向闭环，结构/给排水/暖通/电气交换与协调，专项不纳入 V1 | 与决策 9 一致；建筑验证核心 AI 能力，MEP 保留交换控制成本 | 2026-07-22 |
| 13 | OD-04 工具版本：Revit/AutoCAD 2022/2024、Rhino 7/8、SketchUp 2023/2024 Pro、ArchiCAD 26/27；商用求解器延后至结构闭环 | 双版本覆盖主流客户；版本升级须重跑 D45 金样；V1 结构非闭环故求解器延后 | 2026-07-22 |
| 14 | OD-05 外部 AI：EVAI/小库 AI/建筑学长 V1 维持 ManualHandoff，W3 并行启动供应商资格接触 | V1 不阻塞；B-02 降级为 V2 自动化前置条件；数据处理须境外云+不用于训练+GDPR 兼容 | 2026-07-22 |
| 15 | OD-06 首个生产画像：Hybrid-Site，RPO≤4h/RTO≤8h 初始值待 Pilot 校准 | D29-D33 连接器需本地 Worker 驱动 CAD/BIM，纯 SaaS 无法满足；与 OD-01+OD-04 一致无冲突 | 2026-07-22 |

## 当前状态
- 阶段：总体与 D01–D46 条件性详细设计基线完成；R1 业务决策冻结完成（OD-01 至 OD-06 全部确认并回写至 D01/D02 Scope）；R2 技术基线实例化主体完成（Support Matrix 版本基线冻结 + Contract Catalog 首切片分配 + DeploymentProfile Hybrid-Site 实例化）；业界对标审计补充整合完成（14 个新增章节 + 3 处 R1-R2 冲突适配）；尚未达到 Implementation Ready。
- 最近动作：将 Qoder 项目 `deep-research-report.md` 中以"业界对标审计补充"为主题的 14 个新增章节（795 行）深度分析后整合到本项目唯一设计正文，涵盖快速导航（角色/冲刺阅读指南、D01-D46 首切片相关性标记）、§7 V0/V1 最小可开发范围裁剪（开发聚焦、明确不实现、简化技术栈、ISO 19650 对标、EDTR 基线、Q-01~Q-10 决策表）、D12.23.1 施工图自动化现实性校准（2025-2026 能力矩阵）、D20.21.1 RAG 设计对标 2025 最佳实践、D24.21.1 AI 能力现实性校准（V0 最小 AI 集）、D28.23.1 AI 能力分阶段治理（V0 轻量→V3 企业级）、D33.24.1 CAD/BIM 集成与 openBIM 现实性审计、D34.8.1 V0 最小数据模型、D34.24.1 V0 模块化单体部署架构、D35.15.1 V0 关键 API 契约示例（5 个 OpenAPI）、D40.26.1 OWASP LLM Top 10 与 EU AI Act 对标、D46.7.1 V0 技术选型审计与简化决策、D46.13.1 OD 推荐默认值与阻塞性分析、附录 B V0/V1 首切片开发实施指南（7 节含 Sprint 1-10 开发顺序、3-6 人团队分工、架构演进路线图）。三处与 R1-R2 冲突的内容已适配：①D46.13.1 OD 表新增"R1 冻结值"列，并附差异说明（OD-01 推荐中国+境外并行→冻结为纯境外包；OD-06 推荐SaaS-Managed→冻结为 Hybrid-Site）；②§7.5 Q-01~Q-10 决策表后追加 R1 冻结状态说明，列出 6 项冻结值并引用 R1/R2 交付物；③D46.7.1 V0 技术选型追加 R2 交叉引用，说明 V0 简化技术栈与 Hybrid-Site 生产画像的升级路径关系。原文件 15298 行 → 整合后 16090 行（+792 行）。
- 最近动作：R2 阶段完成四项工作：①将 R1 决策（OD-01 至 OD-06）回写至唯一设计正文 D01.15（待业务决策清单标记 Q-01 至 Q-06 已冻结）和 D02.7/D02.12（版本基线、决策结果表新增冻结状态列）；②输出 R2 Support Matrix 冻结文档（`r2-support-matrix/r2-support-matrix.html`），冻结 5 类工具 10 个版本资格矩阵；③输出 R2 Contract Catalog 分配文档（`r2-contract-catalog/r2-contract-catalog.html`），分配首切片 6 个 API 域 30 个 Operation、18 个 Event Topic、8 个 File Schema 共 48 个契约稳定 ID，定义版本兼容策略和 Consumer Test 计划；④输出 R2 DeploymentProfile 实例化文档（`r2-deployment-profile/r2-deployment-profile.html`），将 OD-06 Hybrid-Site 决策实例化为 Region/Cell/Cluster 冻结参数、9 个信任区流量矩阵、WorkerImageProfile、DR 分层 RPO/RTO、9 个 Registry 冻结状态和 15 项 Runbook Catalog。Gate 4 由"部分满足（契约设计完成待分配）"推进至"部分满足（已分配待 Consumer Test 验证）"；Gate 5 由"未满足"推进至"部分满足（首画像已冻结，Registry 字段待 W4–W8 全量填充）"。
- 下一步：R2 剩余 W4–W8 工作（Region 厂商冻结、WorkerImageProfile 金样 hash、首客户 Site Discovery、Runbook 冻结与桌面演练、首次 DR 演练）；R3 启动 GoldenDataset 建立和 VerificationItem 实例化（W5–W10）；R4 Gate 准入（W9–W12）。
- 阻塞项：B-01 已解除；B-05 标记 V1 不适用；B-02 降级为 V2 前置条件；B-03 部分解除（版本基线冻结，资格验证待 W4–W7）；B-04 Test 物化待 R3 启动；B-06 GoldenDataset 未建立待 R3；B-07 Pre-Impl Gate 6 项中 Gate 1 已满足、Gate 3/4/5 部分满足、Gate 2/6 待 R3/R4；B-08 DeploymentProfile 实例化部分完成，ClusterProfile/StorageProfile 待 W4 厂商冻结；B-09 WorkerImageProfile 待 W5 金样；B-10 DRProfile 待 W8 演练。

## 设计演进日志
- 2026-07-22：业界对标审计补充整合完成。将 Qoder 项目 `deep-research-report.md` 中以"业界对标审计补充"为主题的 14 个新增章节（795 行）深度分析后整合到本项目唯一设计正文。整合内容分 6 类：①导航与范围裁剪（快速导航 + §7 V0/V1 最小可开发范围裁剪，含 V0 开发聚焦/明确不实现/简化技术栈/ISO 19650 对标/EDTR 基线/Q-01~Q-10 决策表）；②领域现实性校准（D12.23.1 施工图自动化 2025-2026 能力矩阵、D20.21.1 RAG 对标 2025 最佳实践、D24.21.1 AI 能力 V0 最小集、D28.23.1 AI 能力 V0→V3 分阶段治理、D33.24.1 CAD/BIM 集成与 openBIM 差距审计）；③V0 技术实施（D34.8.1 最小数据模型 6 Schema、D34.24.1 模块化单体部署架构、D35.15.1 五个 V0 关键 API 契约 OpenAPI 示例）；④安全合规对标（D40.26.1 OWASP LLM Top 10 覆盖度 + EU AI Act 风险分类）；⑤V0 选型与决策（D46.7.1 技术选型简化决策表、D46.13.1 OD 推荐默认值与阻塞性分析）；⑥附录 B V0/V1 实施指南（7 节含 Sprint 1-10 开发顺序、3-6 人团队分工、架构演进路线图）。三处与 R1-R2 冲突的内容已适配：D46.13.1 OD 表新增"R1 冻结值"列并附差异说明（OD-01 推荐"中国+境外并行"→冻结为"通用英文境外包"；OD-06 推荐"SaaS-Managed 优先"→冻结为"Hybrid-Site"）；§7.5 Q-01~Q-10 决策表后追加 R1 冻结状态说明；D46.7.1 V0 技术选型追加 R2 交叉引用说明 V0 简化技术栈与 Hybrid-Site 生产画像的升级路径。原文件 15298 行 → 整合后 16090 行（+792 行），D01-D46 共 46 章结构完整。
- 2026-07-22：R2 技术基线实例化继续推进，完成 Contract Catalog 分配和 DeploymentProfile 实例化两项工作：①输出 `r2-contract-catalog/r2-contract-catalog.html`（非权威派生材料），分配首切片 6 个 API 域（IAM、Project、CDE、Design、Coordination、Workflow）30 个 Operation 稳定 ID（如 `iam.tenant.list`、`project.create`、`cde.asset.upload`、`design.option.create`、`coord.finding.create`、`wf.instance.start`）、18 个 Event Topic（CloudEvent type 含 `.v1` 后缀，如 `com.platform.iam.tenant.activated.v1`）、8 个 File Schema（IFC4、IFC2x3、BCF3.0、DWG2018、RVT2024/2022、IDS0.1、PDF/A-2b）共 48 个契约，定义版本兼容矩阵（backward/breaking/deprecation）、双栈 90 天窗口规则、7 维 Consumer Test 计划；7 个未分配 API 域列出原因和计划分配时间线。Gate 4 由"部分满足（契约设计完成待分配）"推进至"部分满足（已分配待 Consumer Test 验证）"。②输出 `r2-deployment-profile/r2-deployment-profile.html`（非权威派生材料），将 OD-06 Hybrid-Site 决策实例化为 10 节内容：冻结概述（OD-06 回写映射至 D44.4/D44.21/D44.23/D01.15/D02.12）、Hybrid-Site 拓扑实例化（Mermaid 物理拓扑图 + 三层架构职责）、Region/Cell/Cluster 冻结参数（Region 层 6 项、Cell 层 6 项、ClusterProfile 13 个组件候选与决策路径）、网络信任区与流量矩阵（9 个信任区实例化 + 13 条关键流量含 Site Connector→Cloud 和 Windows/HPC→License）、Windows Worker 与 Site Connector（WorkerImageProfile 5 类工具 6 行 + Mermaid 时序图 + 5 项断线撤权策略）、数据驻留与 DR 策略（7 个数据层 RPO/RTO 分层 + 9 阶段 Failover/Failback 流程 + 3 类演练计划）、Secret/KMS 与 SiteProfile（6 层 KMS 拓扑 + 9 个 SiteProfile 必需字段）、Runbook 与 Operational Readiness Gate（15 项 Critical Runbook + 10 个运维界面）、Registry 冻结状态总览（9 个 Registry 已冻结约 35% 字段，W4/W5-W6/W8+Pilot 分批冻结）、Gate 5 推进评估（7 个子条件中 2 项已满足、5 项部分满足）。Gate 5 由"未满足"推进至"部分满足"。B-08 部分解除（DeploymentProfile 实例化完成，ClusterProfile/StorageProfile 待 W4）；B-09 待 W5 金样；B-10 待 W8 演练。
- 2026-07-22：R2 技术基线实例化启动，完成两项工作：①将 R1 决策回写至唯一设计正文 D01.15（Q-01 至 Q-06 标记已冻结，含 BEACON 决策号和冻结值）、D02.7.1/7.2/7.3（地区包 R1、建筑类型 B1、专业进入顺序追加冻结说明）、D02.12（决策结果表新增"冻结状态"列，Q-01 至 Q-06 填入冻结值，Q-07 至 Q-10 标记"待 V1 详细规划时冻结"）；②输出 `r2-support-matrix/r2-support-matrix.html`（非权威派生材料），冻结 5 类工具 10 个版本资格矩阵，定义 .NET 4.8 统一运行时、Hybrid-Site Worker 部署拓扑、ExchangeRoundTripSample 验证计划（Rhino 8 Qualified / 其余 8 版本 Pending / 7 版本 NotSupported）、版本治理策略（不自动提升原则）和 5 项风险评估。B-03 阻塞部分解除（版本基线冻结，资格验证待 W4–W7 完成）。
- 2026-07-22：具责主体完成 R1 业务决策推进包 OD-01 至 OD-06 六份决策模板填写确认，决策 10–15 写入决策日志：①OD-01 通用英文境外、ISO/EN 优先、公制 SI、境外云 Region 厂商待定；②OD-02 中小型办公（5–15 层，框架/框剪），排除超高层和医疗/实验室；③OD-03 建筑纵向闭环，结构/给排水/暖通/电气交换与协调，专项不纳入 V1；④OD-04 Revit/AutoCAD 2022/2024、Rhino 7/8、SketchUp 2023/2024 Pro、ArchiCAD 26/27，商用求解器延后至结构闭环（B-05 标记 V1 不适用）；⑤OD-05 EVAI/小库 AI/建筑学长 V1 维持 ManualHandoff，W3 并行启动供应商资格接触，B-02 降级为 V2 前置条件；⑥OD-06 首个画像 Hybrid-Site，RPO≤4h/RTO≤8h 初始值待 Pilot 校准。R1 业务决策冻结完成，B-01 阻塞解除，Gate 1 已满足。下一步：决策回写至 D01/D02 Scope 后启动 R2 技术基线实例化。
- 2026-07-22：输出 R1 业务决策推进包 `r1-decision-package/r1-decision-package.html`（非权威派生材料）。推进包覆盖：①决策总览（3 项指标卡 + OD 汇总表 + Mermaid 依赖图，标注 OD-01 至 OD-06 间的冻结依赖与 B-02/B-03/B-07 阻塞解除路径）；②OD-01 至 OD-06 逐项决策包，每项含决策背景、选项分析表（含利弊对比和推荐项）、下游影响说明、可填写决策模板（具责主体、确认日期、目标参数）；③Pre-Implementation Start Gate 6 项准入清单，逐项标注 pending/partial 状态和所需证据；④决策冻结后 R2 实例化路径（Mermaid 流程图 + R2 工作项表 + ECharts 12 周甘特时间线标注 R1 冻结/R2 完成/R3 完成/Gate 准入 4 个里程碑）。推进包不修改唯一设计正文，决策模板填写后回写至本文件决策日志和 D01/D02 Scope。
- 2026-07-22：基于审计结论对唯一设计正文 `deep-research-report.md` 落实 8 项设计强化，均不依赖业务决策冻结：①D29.10 补充 Revit ExternalEvent 队列与宿主线程模型（HostThreadMarshal、空闲上下文检测、单步超时、队列优先级）；②D18.8 补充 ID 漂移检测阈值与回退策略（Stable<70% 触发 DriftHigh、Unmapped<20% 触发 DriftMedium、根因分类与 Unmapped 锚定）；③D18.14 补充大模型性能预算（S/M/L/XL 四级分级、构建/首屏/帧率预算、XL 强制分片、超预算根因分类）；④D19.5 补充可施工性 AI 边界（AI 仅生成候选提示、必须绑定显式几何包络规则、置信度阈值、source 标记分离统计、AI 输出不直接进入规则/碰撞引擎）；⑤D20.6 补充规范版权来源清单（ISO/GB/JGJ/EN/NFPA/ASHRAE/地方/企业八大规范族许可约束与默认摄取策略、未列入默认 MetadataOnly、版权追溯链完整性）；⑥D42.7 补充 SLO 校准协议（Initial→Validated 流程、28 天采样窗口、偏差阈值决策树、calibrationRecord 完整记录、季度复审）；⑦D45.8 补充多工具交换金样矩阵（ExchangeRoundTripSample、六维信息保真度、往返测试流程、ExchangeLossExceeded 降级机制、版本升级重跑触发）；⑧D44.4 补充 DeploymentProfile 决策框架（决策树输入/路径/冲突处理原则、不预设默认值）。以上强化不改变"条件性设计基线"状态，7 项 P0 阻塞仍需业务/供应商输入。
- 2026-07-21：完成深度审计并输出 `design-audit-report/design-audit-report.html`。审计确认 D01–D46 全部 46 章节达成 100% 完整性（含 EARS、接口/数据模型、完成检查）；识别 10 项关键阻塞（B-01–B-10，其中 7 项 P0/3 项 P1）；对标 Autodesk Forma/Augmenta/Swapp/Bricsys 等 AEC AI 业界最佳实践发现 5 项设计强化建议；规划 4 轮 12 周迭代方案（R1 业务决策冻结 → R2 技术基线实例化 → R3 测试物化 → R4 Gate 准入）；产出 11 项行动项（A-01–A-11，P0/P1/P2 优先级）。审计为非权威派生材料，不修改唯一设计正文。
- 2026-07-19：输出综合建设方案 HTML 阅读版；HTML 与 Markdown 均为非权威派生材料。
- 2026-07-19：生成综合建设方案，明确其为非权威派生材料，冲突时回归唯一设计正文。
- 2026-07-19：新增附录 A；EVAI、小库 AI、建筑学长在正式接口授权和资格通过前统一为人工接力。
- 2026-07-16：深度复审 D01–D46，修正跨域冲突并将状态校准为“条件性设计基线、未达开工准入”。
- 2026-07-16：D45 完成，形成双向追踪、专业金样、AI TEVV、安全/性能/DR、UAT 与验收门禁。
- 2026-07-16：D42–D44 完成，形成 SLO/容量、可观测运营以及多画像部署/网络/GPU/Windows/DR 拓扑。
- 2026-07-16：D39–D41 完成，形成身份多租户、安全隐私威胁、审计与电子证据体系。
- 2026-07-16：D34–D38 完成，形成数据、接口/事件、IA/关键界面、通知协作设计。
- 2026-07-16：D29–D33 完成，形成桌面连接器及 Revit/AutoCAD/Rhino/SketchUp/ArchiCAD/GIS/分析集成。
- 2026-07-16：D24–D28 完成，形成 AI 网关、感知、生成优化、Agent 治理和 AI 生命周期/评测。
- 2026-07-16：D18–D23 完成，形成联邦、碰撞、规范/RAG、规则、一致性和量价辅助。
- 2026-07-16：D09–D17 完成，形成概念/方案/扩初/施工图及建筑、结构、给排水、暖通、电气、专项设计。
- 2026-07-16：D01–D08 完成，冻结北极星、路线、能力、角色、P0–P8、需求、CDE 和任务编排。

## 待解决问题
- ~~Revit/AutoCAD/Rhino/SketchUp/ArchiCAD 的版本与许可证基线。~~ 已由 OD-04 决策 13 冻结（2026-07-22）。
- ~~EVAI、小库 AI、建筑学长是否提供企业私有 API，以及其商用授权、凭据和数据处理条款（按附录 A 对接）。~~ 已由 OD-05 决策 14 确定策略：V1 维持 ManualHandoff，W3 启动供应商资格接触（2026-07-22）。
- ~~V1 技术试点采用 SaaS、混合站点还是私有化，以及相应 Region、网络、数据驻留和 RPO/RTO。~~ 已由 OD-06 决策 15 冻结为 Hybrid-Site，RPO≤4h/RTO≤8h（2026-07-22）。
- ~~R1 决策回写至 D01/D02 Scope。~~ 已完成（2026-07-22）。
- W4 Region 厂商资质评估与冻结（AWS/Azure/GCP 候选），触发 ClusterProfile/StorageProfile/NetworkProfile 批量冻结。
- W5 WorkerImageProfile 金样 hash 冻结（D45.8 ExchangeRoundTripSample，5 类工具 10 版本）。
- W6 首客户 Site Discovery，输出签字 SiteProfile 和差距清单。
- W7 15 项 Critical Runbook 冻结（Owner/On-call/覆盖时段/触发信号/诊断/止损/恢复/验证/升级时限/演练）。
- W8 首次 Cell/Region DR 桌面演练，校准 DRProfile 实际 RPO/RTO。
- W3 启动的 EVAI/小库 AI/建筑学长供应商资格接触结果（V2 自动化前置）。
- Support Matrix 冻结后的具体工具版本资格验证（R2 阶段 W4–W7）。

## 引用文件
- `deep-research-report.md` — 唯一设计正文。
- `design-audit-report/design-audit-report.html` — 深度审计报告（非权威派生材料），覆盖完整性评估、业界对标、阻塞分析、4 轮迭代方案、11 项行动项。
- `r1-decision-package/r1-decision-package.html` — R1 业务决策推进包（非权威派生材料），覆盖 OD-01 至 OD-06 选项分析与可填写决策模板、Pre-Implementation Start Gate 6 项准入清单、R2 实例化路径与 12 周甘特时间线。
- `r2-support-matrix/r2-support-matrix.html` — R2 Support Matrix 冻结文档（非权威派生材料），覆盖 5 类工具 10 个版本资格矩阵、API 与运行时兼容性、许可证模型与 Hybrid-Site Worker 部署、ExchangeRoundTripSample 验证计划、版本治理策略和风险评估。
- `r2-contract-catalog/r2-contract-catalog.html` — R2 Contract Catalog 分配文档（非权威派生材料），覆盖首切片 48 个契约稳定 ID 分配（30 API + 18 Event + 8 File Schema）、版本兼容策略、Consumer Test 计划和 Gate 4 推进评估。
- `r2-deployment-profile/r2-deployment-profile.html` — R2 DeploymentProfile 实例化文档（非权威派生材料），覆盖 OD-06 Hybrid-Site 决策实例化为 Region/Cell/Cluster 参数、9 信任区流量矩阵、WorkerImageProfile、DR 分层 RPO/RTO、9 个 Registry 冻结状态、15 项 Runbook Catalog 和 Gate 5 推进评估。
- `施工图全流程AI平台综合建设方案.md` — 面向人阅读的派生综合方案，非第二事实源。
- `施工图全流程AI平台综合建设方案.html` — 综合方案的单页阅读版。
- `海外AI辅助设计流程.docx` — 首个业务场景的原始需求。
