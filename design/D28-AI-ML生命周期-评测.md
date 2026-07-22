# D28 AI与ML生命周期与评测

> 来源：@design/INDEX.md | 创建：2026-07-22 | 更新：2026-07-22
> 原始行范围：8330–8676
> 引用约定：同文件内引用使用 §编号，跨文件引用使用 @design/文件名.md

## D28 AI/ML 生命周期与评测

### D28.1 任务定义

| 项目 | 内容 |
|---|---|
| 任务目标 | 对模型、Embedding、Reranker、Prompt、感知/生成器、规则配置、Agent 与组合式 AI 系统实施数据—实验—评测—发布—灰度—监测—回滚—退役全生命周期治理 |
| 直接产出 | Registry/数据集/评测/Release/Deployment/Experiment/Monitor 对象、能力切片指标、红队、灰度、漂移、事件、接口、界面、技术栈和验收 |
| 成功对齐物 | 任一线上 AI 结果可追溯到完整 ReleaseBundle、评测门槛、部署资格、流量实验和在线健康，并可一键停止新流量/回滚 |
| 本任务不做 | 不自行训练未明确需要的基础模型，不用单一总分替代专业切片，不以线上反馈自动训练并发布 |
| 主能力 | CAP-13.07/08、CAP-15.02/03/05，消费 D20/D24–D27，输出 AIRelease/Qualification/Monitoring/Incident |

### D28.2 标杆依据与平台取舍

- NIST AI RMF 要求在接近部署场景条件下开展可重复 TEVV，覆盖有效可靠、安全、韧性、隐私、透明、解释、公平、环境影响，并持续监测、反馈/申诉、红队、事件和退役。
- MLflow Model Registry 已以 tags/aliases 和环境隔离替代僵化 Stage；平台使用 MLflow 保存实验/模型/Prompt 资产，但资格、审批、流量与业务能力关系由领域控制面管理。
- 通用 Evals 支持数据源 Schema、Criteria、Grader 和跨模型/参数运行；平台进一步固定专业金样、切片、裁判校准和业务门禁。
- 模型不是系统：RAG/Agent/视觉/生成性能由模型、Prompt、工具、检索、规则、数据和运行时共同决定；发布对象必须是组合式 ReleaseBundle。

### D28.3 核心原则

1. Capability-specific：所有评测和发布绑定 D24 CapabilityRevision/部署情境，不存在脱离用途的“全局好模型”。
2. Immutable evidence：数据集、Prompt、模型、代码/镜像、工具、策略、评测和 Release 均固定摘要；Alias 不能替代版本。
3. Slice before average：总指标通过但关键专业/地区/格式/风险切片失败仍阻断。
4. Deterministic before judge：能用结构/规则/数值/几何判定的先用确定性 Grader，LLM Judge 必须经专家金样校准。
5. Offline→Shadow→Canary→Ramp→Active；高风险能力默认人工反馈/观察期，不能直接全量。
6. 持续监测输入、输出、行为、工具、副作用、成本和用户反馈；漂移触发评估，不自动重训/发布。
7. 回滚包含模型、Prompt、工具/策略/索引/数据依赖和缓存；仅改模型别名不一定恢复系统行为。

### D28.4 治理范围与资产类型

| 资产 | 示例 | 版本/评测重点 |
|---|---|---|
| Foundation/Hosted Model | LLM/VLM/Embedding/图像模型 | provider snapshot/alias、条款、能力/安全/漂移 |
| Fine-tuned/Local Model | OCR、符号检测、分类、私有 LLM | 训练代码/数据/权重/镜像/硬件与可复现训练 |
| Prompt/Template | 系统指令、结构输出、Judge rubric | 模板/变量/示例/语言/注入/版本差异 |
| Retrieval Asset | Chunk/Embedding/Index/Reranker | Recall/ACL/引用/更新/索引版本 |
| Generator/Surrogate | D26 生成器/代理 Evaluator | 可行率、偏差、适用域、鲁棒性 |
| Agent System | AgentRevision/Tool/Handoff/Memory | 任务、工具、越权、循环、成本/副作用 |
| Guardrail/Classifier | PII/安全/注入/OOD/置信校准 | 应阻断/误阻断、攻击切片和延迟 |
| Composite Release | 上述资产+运行时/策略组合 | 端到端任务、兼容、故障/回滚和业务门禁 |

### D28.5 领域对象

| 对象 | 职责 | 关键内容 |
|---|---|---|
| AIAsset | 稳定资产身份 | type、owner、用途、许可/来源、风险和生命周期 |
| AIAssetVersion | 不可变资产版本 | artifact URI/hash、signature、source/run、dependencies、metadata |
| PromptVersion | Prompt 专项版本 | messages/template、variables、examples、output schema、language 和 hash |
| DatasetVersion | 数据集版本 | manifest、样本/标签/许可、切片、split、hash 和质量 |
| LabelingProject | 标注/裁决治理 | guideline、roles、agreement、adjudication、quality 和产物 |
| EvalSuite | 稳定评测身份 | capability、purpose、owners、risk 和 lifecycle |
| EvalSuiteVersion | 不可变评测契约 | dataset slices、metrics/graders、thresholds、aggregation、environment |
| GraderVersion | 评分器 | deterministic/rule/human/LLM、rubric、calibration、limits 和 version |
| EvalRun | 一次评测 | release/candidate、suite、environment、seed、status、cost 和 results |
| EvalResult | 指标/样本结果 | slice、metric、value/CI、pass/fail、errors、evidence 和 grader |
| RedTeamCampaign | 对抗评测 | threat scope、attack corpus/actors、success criteria、findings 和 retest |
| AIReleaseBundle | 可发布组合 | model/prompt/index/tool/guardrail/runtime/policy versions、SBOM 和 hash |
| ReleaseQualification | 能力/环境资格 | release、capability/data/region、evals、risk acceptance、expiry 和 status |
| AIEnvironment | 部署环境 | dev/test/staging/prod、region、data class、controls 和 owners |
| AIDeploymentRevision | 实际部署配置 | release、endpoint/model deployment、resources、route/guardrail 和 status |
| TrafficExperiment | shadow/canary/A-B | control/treatment、allocation、eligibility、metrics、duration 和 stop |
| MonitoringPlan | 在线监测契约 | signals、baseline/window/threshold、sampling、alerts、owners 和 action |
| DriftObservation | 漂移事实 | data/concept/performance/behavior/cost、slice、magnitude、evidence 和 state |
| HumanEvaluation | 专家/用户评测 | rubric、blind/randomization、annotators、agreement、decision 和 evidence |
| UserFeedback | 反馈/申诉 | result context、type、severity、comment/correction、status 和 resolution |
| AIIncident | AI 质量/安全事件 | release/capability、impact、detection、containment、recovery 和 RCA |
| ModelSystemCard | 发布说明 | intended/not intended、data/evals/slices、limitations、human controls 和 contacts |
| RetirementRecord | 退役证据 | reason、replacement、traffic/data cleanup、retention 和 residual risk |

### D28.6 数据集与标注治理

DatasetVersion Manifest 必含来源/许可/同意、用途（train/eval/redteam/demo）、租户/地区、敏感级别、抽样框、专业/建筑/工具/格式/语言/质量切片、标签 schema/指南、去重、split 策略、泄漏检查、转换和统计。

- 同项目、同文档/模型家族及其增强/切片不得跨 train/validation/test 泄漏。
- Golden Eval 只允许受控修订；线上失败样本先隔离/去隐私/去重/专家确认，不能直接混入测试或训练。
- 标注者权限/专业资格、双盲/双标、inter-annotator agreement、仲裁和不确定标签显式。
- 数据删除/许可撤销触发影响图：模型、Embedding、Eval、Prompt 示例、报告和 Release；不能仅删源文件。
- 合成数据标注生成器/seed/Prompt/模型并与真实数据分开报告；不以合成通过代替真实部署切片。

### D28.7 评测体系与 Grader 优先级

评测层级：

1. **Schema/Static**：格式、类型、引用、单位、几何有效、工具调用 Schema。
2. **Deterministic/Rule**：精确匹配、数值容差、D21 规则、图拓扑、权限/副作用。
3. **Task Metric**：OCR CER/mAP、检索 Recall/nDCG、分类 F1、Pareto/可行率等。
4. **Expert Human**：专业正确、可用、风险、解释、设计质量；采用 rubric/盲评/一致性。
5. **LLM Judge**：规模化语义评分/成对比较；只在校准范围使用并监测 position/style/self-preference bias。
6. **End-to-end Simulation**：Workflow/Agent/工具/审批/故障/成本和人工接力。

GraderVersion 保存 rubric、输入/输出 Schema、模型/Prompt/规则、校准集、与专家一致率、阈值和已知限制。高风险最终结论不能只由与被测模型同家族的 Judge 评分。

### D28.8 能力评测矩阵

| 能力 | 质量指标 | 安全/治理指标 | 端到端结果 |
|---|---|---|---|
| D20 RAG | Recall/nDCG、Citation entailment、拒答 | ACL/许可泄漏、注入、旧版引用 | 专家回答正确/可核验 |
| D25 感知 | CER/mAP、拓扑 F1、校准/OOD | 隐藏文本、恶意 PDF、数据许可 | D22/D23 接受精度/复核量 |
| D26 生成 | valid/feasible、Pareto、编辑性/鲁棒性 | 约束绕过、训练/IP、几何攻击 | 专家 Shortlist 质量/写回成功 |
| D27 Agent | task/tool/参数/停止/恢复 | 越权、副作用、循环、注入、记忆污染 | 人工接力/一次成功/事故为零 |
| Embedding/Rerank | retrieval slices、稳定性、延迟 | 跨租户、反演/敏感性、漂移 | 下游答案/规则指标 |
| Guardrail | attack recall、false block、校准 | bypass、多语言/编码/视觉攻击 | 风险阻断且业务可用 |
| Gateway/Route | SLO、Schema、成本/回退质量 | 数据/地区/预算/缓存策略 | Capability SLO/业务成功 |

每个 CapabilityQualityProfile 将指标映射为 Block/Warn/Observe，并规定总体与关键切片阈值、置信区间/最小样本、非劣界限和允许风险接受角色。

### D28.9 实验与可复现

训练/Prompt/配置/路由实验均记录 source commit/镜像、代码/依赖、数据集、特征/预处理、seed、超参、硬件/驱动、环境、输入输出、指标、日志、成本/能耗和父实验。Hosted 模型不可固定时保存 provider alias、observed fingerprint、时间/地区和重复探针结果。

实验比较必须使用同一 EvalSuiteVersion/环境/预算；变更多个组件时先做消融/分步对比，无法隔离则标记 composite change。选择 Candidate 不得只看测试集；调参过多时建立 holdout/盲测和多重比较风险记录。

### D28.10 ReleaseBundle 与资格

AIReleaseBundle Manifest 至少包含：AIAssetVersion（模型/权重）、PromptVersion、检索/Embedding/Reranker/索引、Agent/ToolRevision、Guardrail/Policy、runtime image/SBOM、系统配置、兼容矩阵、数据/许可声明、Eval/RedTeam/回滚和 ModelSystemCard。

状态：Draft→Evaluation→RiskReview→Approved→Qualified→Active→Degraded/Suspended→Retired。Approved 表示治理批准，Qualified 是对具体 CapabilityRevision+环境+数据级别+地区的可路由资格；同一 Release 可在低风险能力 Qualified、高风险能力 NotQualified。

MLflow alias 可表示 `candidate/champion/rollback` 便利指针；AIInvocationRun 必须保存具体版本/hash，不保存 Alias 作为唯一证据。

### D28.11 发布门禁与独立评审

门禁顺序：资产/许可/SBOM→数据质量/泄漏→离线质量/切片→安全/隐私/红队→性能/成本/容量→端到端/故障→专业 Human Eval→风险接受/ModelSystemCard→Shadow/Canary 计划→回滚演练。

职责分离：开发/Prompt 作者、数据/标注负责人、Eval Owner、专业评审、安全/隐私、业务 Owner 和 Release Approver。高风险能力不得由开发者单人定义数据集、Grader、阈值并批准。

失败项不能通过删除切片/改平均方式规避；门槛变化新建 CapabilityQualityProfile/EvalSuite Revision 并进行影响审计。

### D28.12 Shadow、Canary、A/B 与流量提升

- Shadow：复制合规输入给 Treatment，不返回结果/执行工具；比较质量/时延/成本/安全，敏感数据需额外许可。
- Canary：按租户/项目/用户/任务风险的确定性 eligibility 小流量返回；高风险写工具先只读/提议模式。
- A/B：用于真实可比较体验/质量，预注册假设、主/护栏指标、样本/时长和停止条件；避免同项目跨版本污染专业协作。
- Ramp：1%→5%→20%→50%→100% 为示例，实际按风险/容量；每阶段最小样本/观察窗通过并由策略/角色批准。
- Immediate Stop：安全/权限/严重专业错误/未知副作用/成本失控/供应商事件触发自动停 Treatment，新流量回 Champion/禁用。

TrafficExperiment 保存分配算法/seed、控制/处理具体 Release、eligibility、暴露、指标、异常和决定；缓存/会话/Agent Memory 按 Release 隔离。

### D28.13 在线监测与反馈闭环

MonitoringPlan 信号：输入 schema/语言/专业/格式/质量/OOD；输出 schema/置信/拒答/引用/几何；任务/工具/副作用；Guardrail/Policy；时延/错误/容量；token/GPU/成本；人工覆盖/纠正/申诉/复开；供应商/版本指纹。

监测采用无内容/脱敏优先的统计与抽样；内容采样需 Policy/权限/保留。延迟标签场景将 UserFeedback/HumanEvaluation/D19–D23 下游结果回链 AIInvocationRun，但防止幸存者偏差和只看用户主动投诉。

反馈状态 New→Triaged→Linked→Resolved/Rejected；修正业务结果不自动写入训练数据。高频错误形成 Dataset Candidate、Eval Case、Rule/Prompt/模型改进和 Incident/KnowledgeUpdate。

### D28.14 漂移、阈值与响应

| 漂移 | 检测 | 响应 |
|---|---|---|
| Data Drift | 输入分布/语言/格式/专业/质量/OOD | 切片评测、扩大人工复核、限制适用域 |
| Concept/Label Drift | 专业标签/需求/规范/用户偏好变化 | 新标注/知识/规则/模型评估，不自动学习 |
| Performance Drift | 延迟标签、Human Override、下游失败 | Canary 停止/Degraded/Suspended、根因分析 |
| Behavior Drift | Hosted 模型指纹、输出风格/工具/拒答变化 | 冻结路由、回滚/供应商确认、全套回归 |
| Retrieval Drift | Index/Chunk/Embedding/知识更新 | D20 金样、引用/ACL 回归和缓存失效 |
| Cost/Latency Drift | token/步骤/GPU/价格/错误变化 | 预算/Route 调整、容量/Prompt 优化后再评测 |
| Safety Drift | 注入/越权/泄漏/Guardrail bypass | Kill Switch、Incident、红队/修复/复测 |

阈值由 baseline window、最小样本、统计/业务显著性和连续窗口组成，避免单点误报；Critical 安全事件不要求等待统计显著。自动响应只能降低风险（降流/切只读/停用），恢复/扩流需验证和授权。

### D28.15 红队与安全评测

RedTeamCampaign 覆盖：直接/间接/视觉 Prompt Injection、知识投毒、越权/跨租户/数据外泄、工具误用/过度自主、审批绕过、路径/URL/参数注入、循环/资源耗尽、恶意文件、模型/插件供应链、版权/训练数据复现、拒绝服务、规避 Guardrail、多语言/编码/图片隐写和社会工程。

攻击集区分公开基准、内部历史、专业场景和外部独立红队；攻击成功判据与风险绑定。Finding 进入 D40 威胁/事件，修复后原攻击+变体+邻近能力回归；不得删除失败样本使报告变绿。

### D28.16 回滚、停用与退役

- 回滚目标是经过演练的完整 ReleaseBundle/Route/Policy/Index/Tool 组合；保存 rollback alias 只是加速定位。
- 回滚前评估会话/缓存/Agent Run/Embedding 维度/数据 schema/工具副作用兼容；不兼容时采用停用/人工模式而非强切。
- 自动触发可冻结新流量；人工/策略确认回滚后 D24 Route 原子更新，清理/隔离 treatment cache/session，验证金丝雀。
- 在途高风险 Run 按 StopPolicy 取消/人工接力；已产生副作用不回滚模型即可撤销，需 D27 对账/补偿。
- RetirementRecord 确认无新 Route、存量项目/历史回放、权重/数据/缓存/密钥/许可证处理、保留和替代说明。

### D28.17 服务接口与事件

| 接口 | 关键输入 | 输出/约束 |
|---|---|---|
| `POST /ai-assets` | type、owner、purpose、license/source | Draft AIAsset |
| `POST /ai-assets/{id}/versions` | artifactRef/hash、sourceRun、dependencies、metadata | 不可变 Version、签名/SBOM 检查 |
| `POST /dataset-versions` | manifest、assets/labels、slices/splits、license | DatasetVersion 和泄漏/质量报告 |
| `POST /eval-suite-versions` | capability、datasets/slices、metrics/graders/thresholds | 不可变 Suite、静态验证 |
| `POST /eval-runs` | candidate/release、suite、environment、seed | 异步 EvalRun/Results |
| `POST /red-team-campaigns` | release/capability、threat scope、corpus/actors | Campaign、Findings 和复测 |
| `POST /ai-release-bundles` | component versions、runtime/policy、rollback | Draft Bundle 和 Manifest hash |
| `POST /release-qualifications` | release、capability/environment/data/region、evidence | 审批工作流、资格/期限 |
| `POST /traffic-experiments` | control/treatment、mode、eligibility/allocation、metrics/stop | Shadow/Canary/A-B Experiment |
| `POST /traffic-experiments/{id}/commands` | pause/ramp/stop/complete、reason | 受控流量决定和审计 |
| `POST /monitoring-plans` | release/capability、signals/baselines/thresholds/actions | Active 监测契约 |
| `POST /user-feedback` | invocation/result context、type/severity、correction | 反馈/申诉，不自动进训练 |
| `POST /ai-incidents` | release/capability、impact/evidence | 隔离/恢复/RCA 工作流 |
| `POST /ai-release-bundles/{id}:rollback` | targetRelease、scope、reason、approval | D24 原子降流/回滚计划 |

事件：`AIAssetVersionRegistered`、`DatasetVersionApproved/Revoked`、`EvalRunCompleted/Failed`、`EvalRegressionDetected`、`RedTeamFindingOpened/Closed`、`ReleaseApproved/Qualified/Activated/Degraded/Suspended/Retired`、`TrafficExperimentStarted/Ramped/Stopped`、`DriftDetected`、`AIIncidentOpened/Contained/Resolved`、`ReleaseRolledBack`。

### D28.18 界面与交互详细设计

| 界面 | 主区 | 关键操作 | 防错/反馈 |
|---|---|---|---|
| AI 资产/Registry | 资产树、版本/alias/tag、来源/许可/SBOM、依赖/使用者 | 注册、比较、停用、影响查询 | Alias 与具体 hash 并列；受限资产不可下载 |
| 数据集与标注 | Manifest、样本/切片/split、许可、标签/一致性、泄漏 | 建版、抽样、仲裁、批准/撤销 | 同源泄漏/用途无许可阻断 |
| Eval 工作室 | Suite/数据切片、Metric/Grader/阈值、环境、版本差异 | 配置 Draft、校准 Judge、提交评审 | 关键切片和置信区间必填；门槛变更留痕 |
| Eval/错误分析 | 总体+切片结果、样本证据、control/treatment、错误聚类 | 对比、标注根因、创建回归/Issue | 不用平均值遮盖切片失败 |
| Release/Risk Review | Bundle Manifest、依赖/SBOM、Evals/RedTeam、限制/人控、回滚 | 评审、批准/拒绝、生成 System Card | 缺组件/回滚/独立评审阻断 |
| 灰度实验中心 | Shadow/Canary/A-B、eligibility/流量、指标/护栏、事件 | 启停、扩流、回滚 | 显示具体 Release；Critical 护栏自动停 |
| 在线监测 | 输入/输出/行为/质量/成本/漂移切片、反馈/下游结果 | 调查、降流/停用、创建 Eval/Incident | 内容默认不展示；小样本/延迟标签提示 |
| Incident/回滚/退役 | 时间线、影响 Run/项目、隔离/目标 Bundle、恢复验证、清理 | Kill/回滚、恢复、复盘、退役 | 仅模型回滚不足时列依赖冲突 |

### D28.19 组件技术栈方案

| 组件 | 推荐技术栈 | 职责 | 约束/替代 |
|---|---|---|---|
| Experiment/Registry | MLflow Tracking/Model Registry（aliases/tags） | 实验、模型/Prompt/Artifact、基础比较 | 领域资格/审批不依赖 MLflow Stage |
| 领域控制面 | Java 21 + Spring Boot 4.1 + PostgreSQL | Dataset/Eval/Release/Qualification/Experiment/Monitor/Incident | 不可变 Revision、SoD、审计/Outbox |
| 数据版本 | 对象存储+Manifest/hash；DVC/lakeFS 可选 | 数据/标签/切片/转换血缘 | 首期 Manifest 优先，规模证明后引入 lakeFS |
| Eval Harness | Python + pytest/自研 runner + OpenAI Evals/DeepEval/Ragas 适配 | 确定性/任务/Judge/端到端评测 | 业务 Schema/证据自持，避免框架锁定 |
| Human Eval | 平台评审 UI + Label Studio/CVAT 适配 | 盲评、rubric、一致性和仲裁 | 专业资格/权限、顺序随机化 |
| LLMOps Trace | D24/D27 OpenTelemetry Trace + MLflow Tracing 适配 | Prompt/model/tool/RAG/Agent 运行和样本回链 | 敏感内容采样受策略/保留控制 |
| Monitoring/Drift | Prometheus/Grafana + Evidently/WhyLabs/自研统计适配 | SLO、数据/性能/行为/成本漂移 | 阈值/切片领域化，不靠单一平台 |
| Feature/Serving | D24 Gateway、vLLM/Triton/云 Endpoint | 部署、路由、影子/灰度和 Usage | 只接受 Qualified Bundle/Deployment |
| Workflow | D08 Workflow/队列 | Eval、审批、灰度观察、事件/回滚和退役 | 幂等、等待/超时、人工接力 |
| Security/Supply Chain | Cosign/Sigstore、Syft/Grype/Trivy、Vault/KMS | 签名、SBOM、漏洞/密钥/镜像治理 | 权重/Prompt/插件/数据均入 AIBOM |
| Analytics | PostgreSQL/ClickHouse/对象存储按规模 | 样本/指标/Trace 聚合、切片和长期趋势 | 内容与指标分权、保留/删除可执行 |

技术取舍：MLflow 管实验/资产，平台控制面管业务资格/风险/发布；统一 Dataset/Eval/Release/Monitor 契约覆盖 D20/D25–D27，落实 DRY；工具适配器与环境隔离落实 SOLID；首期先建固定金样、切片、灰度/回滚，不自动重训闭环，落实 KISS/YAGNI。

### D28.20 权限、安全与异常

- Dataset/Prompt/权重/Trace/反馈按许可/敏感/项目/用途分权；评测者只取所需盲样，供应商不能读取无权金样答案。
- 生产 Test Set、红队语料、Guardrail 规则和 System Prompt 防止泄露/污染；访问/导出水印/审计/最小化。
- Release 组件签名/hash/SBOM/依赖/模型来源和许可证验证；未知 pickle/任意代码模型在沙箱扫描，不直接加载。
- Eval/Monitor 服务不能使用生产写工具；Agent 安全评测的外部动作全 Mock/沙箱，禁止真实消息/付费 API/文件写回。

| 异常 | 处理 |
|---|---|
| Eval Runner/Grader 失败 | EvalRun Failed/Partial，不把缺失切片计通过 |
| LLM Judge 漂移/偏差 | 冻结 GraderVersion、重新专家校准和重评受影响 Run |
| Hosted 模型静默更新 | BehaviorDrift、停止扩流/回 Champion、供应商确认和回归 |
| 标签延迟/样本不足 | 显示不确定性，延长观察或加强人工，不提前宣称通过 |
| 数据/许可撤销 | Suspended、影响图、停止 Route/训练/评测并执行删除/保留策略 |
| Canary 指标/安全失败 | 自动 Stop Treatment，隔离会话/缓存并 Incident/回滚 |
| 回滚 Bundle 不兼容 | 停新流量/只读人工模式，执行迁移/验证而非强切 |
| 监测系统不可用 | 高风险能力降流/停用或人工模式，不在无监测下长期运行 |

### D28.21 指标与治理门禁

| 指标 | 定义/用途 |
|---|---|
| Reproducible Eval | 相同 Bundle/Suite/环境重跑在容差内一致率 |
| Critical Slice Pass | 全部阻断切片达到门槛比例，目标 100% |
| Grader-Human Agreement | Judge 与专家一致/偏差/校准，按切片 |
| Eval Coverage | Capability 风险/Failure Mode 有测试和证据覆盖 |
| RedTeam Closure | 阻断 Finding 修复/复测比例与平均时长 |
| Canary Guardrail | Treatment 相对 Control 的质量/安全/成本护栏达成 |
| Drift Detection/MTTD | 已知漂移检出率、误报和发现时间 |
| Feedback/Override | 纠正/申诉/覆盖率、根因和闭环时长 |
| Incident/MTTR | AI 事故数量、影响、隔离/恢复时间和复发 |
| Rollback Readiness | 可回滚 Bundle/能力覆盖及演练成功率 |
| Qualified Asset Freshness | 资格/评测/红队/条款在有效期内比例 |
| Model/Provider Concentration | 关键能力单模型/供应商/地区风险 |

Qualification 门禁：完整 Manifest/AIBOM、关键切片/置信、独立专业评审、安全/隐私/红队、性能/成本/容量、端到端/故障、System Card、灰度/监测/回滚计划和演练全部满足；风险接受必须有 Scope/期限/补偿，不能覆盖零容忍泄漏/越权。

V0/V1 默认禁止把客户项目数据、用户反馈、专业纠正或运行日志用于模型训练/微调；仅允许经独立、可撤回的 Opt-in 同意后进入受治理 DatasetVersion。撤回同意或数据权利请求发生时，平台停止未来训练/评测使用并删除可删除的源数据与派生副本；若数据已进入权重，删除源文件不等于完成“模型遗忘”，必须暂停受影响 Release 的新增路由，执行影响分析并选择退役、从合规快照重训或经验证的 Unlearning，保存残留风险、验证结果和批准证据。无法证明隔离或遗忘效果时不得继续把该权重用于相关租户/目的。

### D28.22 D28 验收条件（EARS）

- When AIAssetVersion 注册, the 平台 shall 保存 artifact/hash、来源实验、依赖、许可、签名/SBOM 和用途。
- When DatasetVersion 创建, the 平台 shall 验证来源/许可、切片、标签、去重/split 和同源泄漏。
- When EvalSuiteVersion 发布, the 平台 shall 固定数据切片、指标/Grader、阈值、聚合、环境、最小样本和置信要求。
- When LLM Judge 用于门禁, the 平台 shall 保存 GraderVersion 并证明其与独立专业金样的校准/一致性和限制。
- When EvalRun 部分失败或关键切片缺失, the 平台 shall 标记 Partial/Failed，禁止按总体平均通过。
- When AIReleaseBundle 创建, the 平台 shall 固定模型/Prompt/索引/工具/Guardrail/runtime/policy 具体版本和 Manifest hash。
- When ReleaseQualification 批准, the 平台 shall 绑定 CapabilityRevision、环境、数据级别、地区、评测/红队、风险接受和有效期。
- When D24 路由请求部署, the 平台 shall 只使用目标情境下 Active Qualification，不以 Alias 代替具体版本证据。
- When Shadow/Canary/A-B 执行, the 平台 shall 固定 control/treatment、eligibility、流量、指标、观察窗和停止条件。
- When Critical 安全/权限/专业错误或成本失控出现, the 平台 shall 自动停止 Treatment 新流量并触发 Incident/回滚评估。
- When 在线监测, the 平台 shall 按能力/专业/地区/格式/风险切片关联输入、输出、行为、成本、人工反馈和下游结果。
- When 漂移或 Hosted 模型行为变化检测, the 平台 shall 降流/停用或扩大人工复核，不自动训练/扩流。
- When 用户反馈/专业纠正进入系统, the 平台 shall 先分诊、去隐私/去重/标注，不直接成为训练或评测真值。
- When 数据主体或客户撤回训练同意, the 平台 shall 停止该数据未来使用、传播删除到 Dataset/Feature/Checkpoint，并对已受影响权重执行暂停路由、退役、重训或经验证的 Unlearning，禁止以删除源文件宣称模型已遗忘。
- When 回滚执行, the 平台 shall 切换完整兼容 ReleaseBundle/Route/Policy/依赖并处理在途 Run、缓存/会话和副作用。
- When AI 资产退役, the 平台 shall 停止新 Route、保留历史重放、处理权重/数据/缓存/密钥/许可并生成 RetirementRecord。

### D28.23 D28 完成检查与下游约束

| 检查项 | 结果 |
|---|---|
| 是否覆盖模型/Prompt/数据集/Grader/Agent/组合 Release 全生命周期 | 是 |
| 是否定义切片评测、专家/Judge 校准、红队和独立发布门禁 | 是 |
| 是否覆盖 Shadow/Canary/A-B、在线监测、漂移、反馈、事故和回滚 | 是 |
| 是否定义接口、事件、界面、技术栈、安全、异常和退役 | 是 |

D28 对下游的强制约束：D29–D33 工具/插件/模型/仿真版本进入 AIBOM/Release 兼容评测；D35 固化 Asset/Eval/Release/Experiment/Incident 契约；D37 实现 Registry/Eval/Release/灰度/监测界面；D40 消费 RedTeam/Incident 并定义零容忍风险；D42 按 Eval/Shadow/Canary/监测容量规划；D44 提供各 Capability 的资格环境与回滚落位，D45 定义金样、切片、故障和 AI Release CI/CD Gate；D46 运营资格续期、漂移和退役。

#### D28.23.1 AI 能力分阶段治理（业界对标审计补充）

 **审计依据：** Google MLOps 成熟度模型（Level 0→1→2）、NIST AI RMF 比例原则、EU AI Act 风险分级。D27 Agent 治理和 D28 ML 生命周期是完整平台的正确设计，但 V0 实际 AI 能力仅 3 项（OCR + 视觉理解 + 文本生成），不需要完整治理基础设施。

**AI 治理分阶段路线：**

| 阶段 | AI 能力范围 | 治理要求 | 实现方式 |
|---|---|---|---|
| **V0（轻量治理）** | OCR、视觉理解、文本生成、Embedding（可选） | 输入输出审计 + 人工复核 + 基本 Guardrail | AIInvocationRun 记录 + 人工接受/拒绝 + 内容安全过滤 |
| **V1（基础治理）** | + RAG 检索、图像生成、分类抽取 | + 质量评测 + 版本管理 + 成本跟踪 | + D28 基本 Release 流程 + 评测金样 + 成本对账 |
| **V2（完整治理）** | + Agent、参数化生成、多供应商 | + 完整 MLflow + A/B + 漂移监测 + 红队 | D27/D28 完整实现 + KServe + MLflow |
| **V3（企业治理）** | + 多专业 Agent、自训练模型 | + 合规审计 + EU AI Act 对齐 + 第三方审计 | 完整治理 + 外部审计接口 |

**V0 轻量治理具体实现（替代 D27/D28 完整流程）：**

```text
V0 AI 治理最小实现：

1. 运行记录（已包含在 D34 ai.run 表）：
   - 输入资产版本、参数、模型版本、输出资产版本
   - 开始/结束时间、token 消耗、估算成本
   - 人工接受/修改/拒绝状态

2. 人工复核门禁（对应 D01 自动化等级 A1/A2）：
   - OCR/视觉结果：置信度 < 阈值 → 强制人工确认
   - 文本生成：高风险用途（规范解释、合规判断）→ 强制专家复核
   - 所有 AI 输出标记为“AI 建议”，不自动成为专业结论

3. 基本 Guardrail（对应 D24 GuardrailPolicy 简化）：
   - 输入：文件大小/格式校验 + 敏感内容检测
   - 输出：Schema 校验 + 内容安全过滤 + PII 检测
   - 异常：超时/错误记录 + 人工接力路径

V0 不需要：
- D27 Agent 状态机/工具白名单/多 Agent 协作/Kill Switch
- D28 完整 ReleaseBundle/Shadow/Canary/A-B/漂移监测
- MLflow 实验跟踪/模型注册中心
- 红队测试/对抗评测
- 独立评审委员会/合规审计接口
```

**升级触发条件：**

| 触发条件 | 升级动作 | 目标阶段 |
|---|---|---|
| AI 能力 >5 种且需版本管理 | 引入 D28 基本 Release 流程 | V1 |
| 需要 A/B 测试或灰度发布 | 引入 Shadow/Canary 机制 | V2 |
| 引入 Agent/工具调用 | 实现 D27 完整治理 | V2 |
| 自托管模型或微调 | 引入 MLflow + 模型注册 | V2 |
| 客户合同要求合规审计 | 实现 EU AI Act 对齐 + 审计接口 | V3 |

