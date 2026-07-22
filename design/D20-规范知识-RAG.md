# D20 规范知识与RAG

> 来源：@design/INDEX.md | 创建：2026-07-22 | 更新：2026-07-22
> 原始行范围：6037–6369
> 引用约定：同文件内引用使用 §编号，跨文件引用使用 @design/文件名.md

## D20 规范知识与 RAG

### D20.1 任务定义

| 项目 | 内容 |
|---|---|
| 任务目标 | 建立按权威性、地域、版本、有效期、许可、项目适用性和访问权限治理的规范知识与可追溯 RAG 服务 |
| 直接产出 | 来源分级、许可治理、知识对象、摄取/解析/切分、检索/生成、引用、拒答、更新、解释、接口、界面、技术栈和评测 |
| 成功对齐物 | 每个回答和 D21 规则都能定位到获准使用的确切文件版本、条款/页码、适用判断和检索运行 |
| 本任务不做 | 不把 AI 回答视为官方解释或审查结论，不自动把自然语言条文变成生效规则（D21），不擅自复制/向量化无许可标准 |
| 主能力 | CAP-10.01/02、CAP-12.01/03、CAP-15.03，消费 D06 项目/需求和 D07 固定资产版本，输出 KnowledgeBaseline/Citation/RetrievalRun |

### D20.2 标杆事实与设计取舍

- 中国国家标准全文公开系统声明电子文本仅供参考、应以正式标准出版物为准，并限制未经授权的复制、发行、汇编、翻译或网络传播；“公开可读”不等于“可入库供 AI 使用”。
- ISO 官方版权与许可条款要求数字集成、结构化数据库、规则引擎或 AI 使用取得相应许可；平台必须在摄取前而非发布后检查授权。
- Azure AI Search/OpenSearch 的官方实践支持关键词+向量混合检索与二阶段重排；平台采用可替换搜索适配层，并将 ACL/地域/有效期过滤注入所有检索分支。
- OWASP 将 RAG 知识投毒和间接提示注入列为风险；规范正文、用户文件、网页和 OCR 文本一律作为不可信数据，不得被模型当成系统指令。
- 平台取舍：事实源在版本化文档与 Clause，不在向量库；Embedding/索引可重建；生成答案是一次运行产物，不反写规范事实。

### D20.3 来源分级与权威性

来源等级机器枚举为 `SRC-A1/A2/A3/B1/B2/C`，避免与 `AUT-A*` 自动化等级和 `AR-DWG-*` 建筑图包混淆。

| 等级 | 来源 | 用途 | 约束 |
|---|---|---|---|
| A1 法定/官方 | 法律法规、政府公告、强制性工程建设规范、主管部门正式发布 | 项目适用基线、强制要求 | 核对发布机关、文号、实施/废止和官方文本 |
| A2 正式标准 | 经许可的国家/行业/地方/国际标准正式版本及勘误 | 设计依据、规则来源 | 许可、适用地域、采标关系和正式出版物核验 |
| A3 官方解释 | 主管部门答复、审查指南、标准编制组/发布机构解释 | 消歧和实施指导 | 不得越级替代正文，保存适用范围和日期 |
| B1 项目批准 | 业主标准、合同要求、项目技术统一规定、审批意见 | 项目增强/收紧要求 | 来源、批准角色、合同层级和变更受控 |
| B2 企业知识 | 企业标准、校审清单、批准案例、专家解释 | 辅助设计与一致性 | 明示非官方，不能降低 A1/A2/B1 要求 |
| C 参考资料 | 厂商手册、论文、培训、网页、历史项目 | 背景说明/检索线索 | 默认不用于阻断规则，不与规范混合呈现 |

冲突优先级不是简单等级覆盖：先按适用地域/主管权限/法定层级，再按专项优于通用、新法优于旧法、项目收紧而非放宽和合同约定判断；所有冲突进入人工确认并形成 ApplicabilityDecision。

### D20.4 领域对象

| 对象 | 职责 | 关键内容 |
|---|---|---|
| AuthoritySource | 发布/解释主体 | 机构、法域、级别、官网、验证方式和信任状态 |
| KnowledgeDocument | 文献身份 | 标准号/文号、题名、类型、语种、发布者和家族关系 |
| DocumentEdition | 确切版本 | 发布/实施/失效日期、修订/勘误、文件 AssetVersion、哈希和状态 |
| LicenseGrant | 内容使用授权 | 权利人、许可类型、允许用途/用户/地域、复制/AI/向量化权利、期限和证据 |
| ApplicabilityProfile | 适用条件模型 | 法域、项目类型、建筑属性、专业、阶段、触发条件和排除 |
| ApplicabilityDecision | 项目适用决定 | 项目/版本、适用/不适用/条件适用、依据、批准和有效期 |
| Clause | 最小权威语义单元 | 层级编号、标题、正文/受限摘要、强制性、页码、边界和稳定锚点 |
| ClauseRelation | 条款关系 | refersTo、amends、supersedes、exceptionTo、definitionOf、table/figure/annex |
| CitationAnchor | 可显示引用锚点 | Edition、Clause、页码/坐标、允许摘录和来源深链 |
| IngestionRun | 摄取处理运行 | 来源、许可决策、解析器/OCR、校验、错误、产物和审批 |
| KnowledgeChunk | 检索片段 | Clause 边界、父上下文、术语、元数据、权限 Scope 和文本摘要 |
| EmbeddingRecord | 向量派生 | chunkId、模型/维度、输入摘要、语言、状态和索引版本 |
| SearchIndexVersion | 可重建索引基线 | 文档/Chunk 集、schema、分析器、Embedding、构建和验证摘要 |
| RetrievalRun | 一次可审计检索 | 用户/项目/问题、过滤、查询变体、候选、分数、重排和阈值 |
| GroundedAnswer | 引证式回答 | 结论、逐句 Citation、适用假设、冲突、不确定性、拒答和模型版本 |
| InterpretationRecord | 专家解释 | 问题、条款、解释、边界、审签人、有效期和替代关系 |
| KnowledgeUpdate | 变更传播 | 新发布/修订/废止/勘误、影响对象、项目/规则/回答和通知状态 |
| LegalHold | 保留控制 | 涉诉/审计对象、范围、原因、授权和解除，覆盖普通删除策略 |

DocumentEdition、Clause、CitationAnchor 是权威链；KnowledgeChunk、EmbeddingRecord、SearchIndexVersion 均为可删除重建的派生层。

### D20.5 文档与版本生命周期

```text
Discovered → RightsReview → Acquired → Quarantined → Parsed → Validated → ExpertReview
→ Approved → Active → Superseded / Withdrawn / Expired → Archived
```

- Discovered 只保存题录/来源，不保存未经许可正文。
- RightsReview 明确“可存储、可 OCR、可切分、可向量化、可生成摘要、可向哪些用户展示、可否跨境处理”。
- Quarantined 内容完成恶意文件、签名/哈希、来源和格式检查前不可进入检索。
- Approved 要求解析结构、条款编号、页码锚点、文本抽样、适用元数据和许可均通过。
- Superseded/Withdrawn 不从历史项目消失；停止新项目默认采用，但既有 KnowledgeBaseline 仍可按审计权限重放。
- 无权继续使用时撤销正文/向量/缓存访问，保留法律允许的题录、哈希和审计证据。

### D20.6 许可与版权控制

| 许可能力 | 值例 | 控制 |
|---|---|---|
| Store | None/MetadataOnly/EncryptedFullText | 决定是否保存正文及存储位置 |
| Transform | OCR/Parse/Translate/Summarize | 每类派生用途单独授权 |
| AIUse | None/RetrievalOnly/Prompt/Embedding/RuleAuthoring | 未明示则拒绝 AI 处理 |
| Display | CitationOnly/Excerpt/FullText | 限制前端和导出展示范围 |
| Audience | NamedUser/Team/Enterprise/External | 与 D04 身份/组织绑定 |
| Geography | Allowed Regions/Data Residency | 控制 Worker、模型和索引区域 |
| Term | Start/End/Revocable | 到期自动停用并触发影响分析 |

License Policy Enforcement Point 位于上传、解析、索引、检索、生成、导出和 API 每个阶段；前端隐藏不是许可控制。授权证据缺失时只允许 MetadataOnly，禁止通过用户上传绕过机构许可。

规范版权来源清单：以下规范发布机构的已知许可约束作为摄取前授权检查基线，RightsReview 必须逐条确认后再进入正文处理。清单不替代具体合同条款；机构政策变更时以官方公告为准并触发 KnowledgeBaseline 影响

| 规范族 | 典型发布机构 | 已知许可约束 | 默认摄取策略 |
|---|---|---|---|
| ISO/IEC | ISO/IEC Geneva | 数字集成、结构化数据库、规则引擎、AI 使用须取得相应许可；无许可不得存储正文 | MetadataOnly；获许可后按 LicenseGrant 分级 |
| 国家标准（GB） | 国家标准委 | 强制性标准全文公开（gb688.cn）；推荐性标准部分公开，商用引用需确认 | 强制性标准可 Metadata+检索；推荐性标准按授权 |
| 行业标准（JGJ/CJJ等） | 住建部/行业归口 | 强制性条文公开，全文使用需注明来源和版本 | 强制性条文可检索；全文按授权 |
| 欧洲/国际（EN/ISO EN） | CEN/CENELEC/ISO | 版权所有，数字使用需许可 | MetadataOnly；获许可后处理 |
| 美国（NFPA/ASHRAE/ICC） | NFPA/ASHRAE/ICC | 版权所有，标准全文购买许可；AI 检索/嵌入需商业授权 | MetadataOnly；禁止未授权正文摄取 |
| 地方/省级标准 | 各省住建厅 | 公开程度不一，需按发布机关确认 | 逐源确认；默认 MetadataOnly |
| 企业标准/内部规程 | 企业自有 | 版权归企业，但可能含第三方引用 | 按企业授权；第三方引用单独追溯 |

未列入清单的规范来源默认采用 MetadataOnly 策略，RightsReview 确认授权后方可提升到正文处理。企业自建标准库引用第三方规范时，版权追溯链必须完整记录到 RightsReview.licenseChain，不能以"企业内部使用"为由跳过第三方授权。

### D20.7 地域、时间与项目适用性

ApplicabilityProfile 至少描述：国家/地区/城市、主管机关、项目所在地与报审地、建筑用途、规模/高度/层数、耐火等级、结构/机电特征、保护/特殊设施、设计阶段、合同日期和过渡政策。

项目在 P0/P1 形成 KnowledgeBaseline：固定适用 DocumentEdition、ApplicabilityDecision、企业/项目增补、解释记录和冲突清单。后续新发布不会静默替换；KnowledgeUpdate 先判定法定过渡期、项目阶段和合同要求，再由授权角色接受“立即迁移、下一阶段迁移、保持原基线或专项评估”。

日期语义分离：发布日期、实施日期、废止日期、检索日期、项目适用日期和基线批准日期；禁止只以文件名年份推断现行有效。

### D20.8 摄取、OCR 与结构解析

1. 注册 AuthoritySource/KnowledgeDocument 和题录，验证官方入口、发布者、标准号/文号。
2. 执行 LicenseGrant 决策；不许可正文处理时终止于 MetadataOnly。
3. 文件进入隔离区，校验 MIME/魔数、大小、病毒、PDF 活动内容、签名/水印、哈希和重复版本。
4. 原生文本优先；扫描件按页 OCR，保存字符/词置信度、版面坐标和原图引用。
5. 解析目录、章/节/条/款/项、表格、公式、图、注、附录、术语和页眉页脚，恢复阅读顺序。
6. 构建 Clause/ClauseRelation/CitationAnchor；交叉引用解析到确切 Edition/Clause，未解析引用进入错误队列。
7. 自动检查编号连续性、目录一致、页数、乱码、低置信页、表格跨页、公式和强制性标记。
8. 专家按风险抽样/全检；批准后创建 SearchIndexVersion，Active 前运行金样检索和引用回跳测试。

OCR 文本不能覆盖原文件；人工纠错形成 Correction Revision，并保留原 OCR、修改人和依据。翻译是派生版本，回答默认引用法定/正式语言原文并并列显示获准译文。

### D20.9 条款、表格、图形与公式表达

- Clause 以语义边界切分，不跨越未声明的条款；保存完整祖先标题路径和前置定义。
- 表格保存标题、表头层级、单元格行列/合并关系、脚注和单位；检索返回相关行时同时返回表头和脚注。
- 图形保存图号、标题、页码、区域、OCR/说明和关联条款；AI 不从不可读图示推断尺寸要求。
- 公式保存原始图/MathML 或 LaTeX 派生、变量定义、单位和适用条件；数值计算由 D21 确定性规则实现。
- “应/必须/不得/宜/可”等规范用语按文种与来源词典标注，但强制性最终由发布文本和专家确认。

### D20.10 切分、术语与索引

KnowledgeChunk 优先一条/一款一个片段；过长条款按项/表格行块拆分并以 `parentClauseId` 聚合，过短条款与定义/上文仅在检索时扩展，不物理拼成失真文本。每个 Chunk 携带：Edition、ClausePath、标题链、法域、有效期、来源等级、专业、建筑属性、语言、强制性、许可 Scope、访问 Scope 和哈希。

术语库保存正式词、简称、旧称、同义词、专业歧义、双语映射和来源条款；查询扩展可使用同义词，但标准号、条款号、数值、单位和专有名词保留精确查询。索引同时维护 BM25/倒排、向量、条款关系和元数据过滤字段。

### D20.11 RAG 检索与回答流程

1. 认证用户并获取 D04 Scope；选择项目时加载固定 KnowledgeBaseline 和当前任务上下文。
2. 对问题做意图分类：条款定位、要求解释、冲突比较、项目适用、计算依据或无法支持；抽取法域/专业/建筑属性/日期。
3. 在查询前生成强制过滤：tenant/project、LicenseGrant、Audience/Geography、访问 Scope、KnowledgeBaseline、Edition 状态和适用日期。
4. 并行执行条款号/标准号精确检索、BM25 关键词检索和向量检索；所有分支使用同一强制过滤，禁止仅在结果展示时裁剪。
5. 以 RRF/归一化融合，按交叉编码器/语义重排；加入权威性、适用性、条款完整性、来源多样性和新旧版本冲突特征。
6. 展开命中条款的定义、表头/脚注、引用条款和有限父上下文；每个上下文块带不可改写的 CitationAnchor。
7. Answerability Gate 检查证据相关性、覆盖度、适用性、冲突和许可；不足则返回拒答/澄清问题/可核验来源，不调用生成或限制为定位结果。
8. LLM 只依据授权上下文生成结构化草案；逐项主张绑定 Citation，未绑定主张删除或标记“推断”。
9. 后处理核验引用存在、原文蕴含、数字/单位/否定词、版本/有效期、敏感信息和输出许可。
10. 保存 RetrievalRun/GroundedAnswer；高风险解释进入专家复核，供 D21 使用时必须引用 Approved Interpretation 或 Clause。

### D20.12 回答契约与拒答策略

GroundedAnswer 固定展示：直接结论、适用前提、依据条款列表、冲突/例外、不确定性、项目基线版本、检索时间和“非官方解释/需专业复核”声明。每个事实性句子关联一到多个 CitationAnchor；引用点击回到授权范围内的原页/条款高亮。

拒答类型：NoAuthorizedSource、NoApplicableEdition、InsufficientEvidence、ConflictingAuthorities、AmbiguousProjectContext、UnsupportedInterpretation、LowOCRConfidence、LicenseRestricted。拒答不能用模型常识补齐；应提示缺失字段、可查询题录或需要哪个角色确认。

对于“给出完整标准”“绕过许可”“隐藏引用”“按已废止版本给当前项目结论”等请求，系统拒绝相应部分并记录策略原因。

### D20.13 引用、解释与证据等级

| 输出 | 最低证据 | 是否可进入 D21 |
|---|---|---|
| 条款定位 | Active/基线 Edition + CitationAnchor | 可作为规则候选来源 |
| 直接摘述 | 许可允许的 Clause 原文且锚点有效 | 可，需规则建模 |
| 跨条款归纳 | 多个适用 Clause，逐句引用且无未解冲突 | 专家复核后可 |
| 项目适用判断 | ApplicabilityDecision + Clause/官方依据 | Approved 后可 |
| 专业解释 | Approved InterpretationRecord | 可作为解释/例外依据，不替代条文 |
| 模型推断 | 明示推断、证据和置信度 | 不可作为阻断规则唯一依据 |

InterpretationRecord 必须说明问题、原文、推理、适用范围、反例/边界、审签角色和失效触发器；新的解释以 supersedes 关联旧记录，不能覆盖历史回答。

### D20.14 更新、废止与影响传播

- 监测官方目录/公告、许可方通知和人工录入；网页抓取只产生 Discovered 候选，不自动发布。
- 以文号/标准号、Edition 关系和内容摘要识别新发布、修订、局部修正、勘误、废止和许可变化。
- 条款级差异区分新增/删除/措辞/数值/范围/引用变化；低质量 PDF/OCR 差异必须人工复核。
- KnowledgeUpdate 影响图覆盖 KnowledgeBaseline、ApplicabilityDecision、Interpretation、D21 Rule、回答缓存、项目 Requirement/Issue 和已发布成果。
- 新 Edition Active 后旧索引停止新默认检索，但历史基线查询明确显示“非当前版”；缓存按 Edition/Chunk/Policy 摘要精准失效。
- 紧急法规/强制性更新可触发项目级风险广播和门禁复核，但平台不替代责任人判断追溯适用性。

### D20.15 安全、知识投毒与隐私

- 来源信任：官方连接器使用域名/证书/签名/哈希/发布者校验；用户上传不能冒充 A1/A2。
- 内容隔离：文档中的“忽略指令、调用工具、泄露数据”等均标记为数据；模型系统指令与检索内容使用结构化边界，不执行内容指令。
- 摄取审批与发布职责分离；高权威来源变更要求双人复核，所有更正和删除可审计。
- 检索权限在搜索引擎前/查询内强制执行，向量、缓存、日志、评测集和模型上下文同样继承 Scope。
- 对用户查询、项目属性和答案执行最小化与保留策略；外部 LLM 仅在许可、数据驻留和 D40 策略允许时调用。
- 对抗测试覆盖恶意 PDF 元数据、白色/隐藏文字、OCR 注入、相似标准号欺骗、检索过滤绕过、引用伪造和跨租户缓存。

### D20.16 服务接口与事件

| 接口 | 关键输入 | 输出/约束 |
|---|---|---|
| `POST /knowledge-documents` | 题录、来源、文件引用、licenseGrantId | 创建 Discovered/MetadataOnly，不越过 RightsReview |
| `POST /knowledge-editions/{id}/commands` | expectedRevision、验证/批准/停用/撤回命令 | 受控生命周期迁移和审计 |
| `POST /ingestion-runs` | editionId、parserProfile、idempotencyKey | 异步解析运行、质量报告和产物引用 |
| `POST /knowledge-baselines` | projectId、edition/decision 集、理由 | 固定项目基线并进入审批 |
| `POST /knowledge-search` | query、projectId、filters、purpose | 授权结果、分数分解和 CitationAnchor |
| `POST /grounded-answers` | query、projectId、purpose、responseMode | GroundedAnswer/拒答，返回 retrievalRunId |
| `POST /interpretations` | question、clauseIds、analysis、scope | Draft 解释，需专家审签 |
| `POST /knowledge-updates/{id}/impact-analysis` | updateId、scope | 受影响基线/规则/项目/回答清单 |
| `GET /citations/{id}` | citationId、显示模式 | 权限/许可裁剪后的条款、页图或题录 |

事件：`KnowledgeDiscovered/RightsApproved/Acquired/Parsed/ValidationFailed/Activated/Superseded/Withdrawn`、`KnowledgeBaselineApproved`、`RetrievalCompleted/AnswerRefused`、`InterpretationApproved/Superseded`、`KnowledgeUpdateDetected/ImpactAssessed`、`LicenseExpiring/Revoked`。

### D20.17 界面与交互详细设计

| 界面 | 主区 | 关键操作 | 防错/反馈 |
|---|---|---|---|
| 来源与许可台账 | 来源树、Edition 时间线、License 能力矩阵、证据附件 | 登记、权利评审、续期/撤销 | 未授权能力红色阻断；不展示受限正文 |
| 摄取质检台 | 页缩略图、原文/OCR 对照、条款树、低置信/结构错误 | 纠错、重解析、抽样/全检、批准 | 修改留 Revision；页码/编号断裂阻断 |
| 规范浏览器 | 文档树、条款正文/页图、关系、版本差异、适用状态 | 搜索、引用、比较、加入基线 | 显示来源等级、有效期、许可和非当前版警告 |
| 项目知识基线 | 适用清单、ApplicabilityDecision、冲突、更新影响 | 评审、批准、迁移/保持决定 | 不允许无依据排除强制来源 |
| 引证式问答 | 问题、上下文条件、结构化答案、逐句引用、拒答卡 | 追问、打开原文、提交专家解释 | 引用缺失不显示确定结论；标识推断/非官方解释 |
| 更新影响中心 | 新旧 Edition 差异、影响图、项目/规则/Issue 队列 | 分派评估、接受迁移、通知 | OCR 差异与正式变更分开；批量决定需权限 |
| 检索评测台 | 金样问题、候选/排名、过滤/分数、答案与引用对比 | 标注相关性、回归、版本发布 | 评测集按许可和 Scope 隔离 |

所有引用支持键盘定位、复制受许可控制；数值/单位/否定词在差异和答案中视觉强调，但不只用颜色表达状态。

### D20.18 组件技术栈方案

| 组件 | 推荐技术栈 | 职责 | 替代/约束 |
|---|---|---|---|
| 文件与题录 | S3 兼容对象存储 + PostgreSQL | 原件/页图、对象/版本/关系/审计 | 对象锁/LegalHold；正文与元数据分权 |
| 文档解析 | Apache Tika、Unstructured；PDFBox/pdfplumber 辅助 | MIME、文本、版面、表格和结构 | 解析器版本固定，复杂表格需质检 |
| OCR | PaddleOCR/Tesseract 私有化；Azure Document Intelligence 适配 | 中英扫描件、版面和置信度 | 外部服务受许可/驻留约束，原页永存 |
| 搜索 | OpenSearch BM25+k-NN+RRF/重排；Azure AI Search 作为托管替代 | 混合检索、过滤、分面和索引版本 | ACL 必须注入全文/向量每个分支 |
| 关系/元数据 | PostgreSQL（关系表+递归查询），必要时 OpenSearch 邻接字段 | ClauseRelation、适用和影响图 | 首期不引入独立图数据库，符合 KISS/YAGNI |
| Embedding | 可版本化多语种 Embedding Gateway，候选模型以项目语料评测选择 | Chunk/查询向量 | 不以厂商锁定字段；许可撤销可精准删除重建 |
| Reranker | 可私有部署 cross-encoder 或经批准托管语义重排 | Top-N 二阶段相关性排序 | 记录模型/分数，不能绕过强制过滤 |
| LLM 网关 | D26 模型网关+结构化输出/引用校验 | 受证据约束的答案生成 | 提供商、区域、数据保留和预算策略化 |
| 策略与权限 | D39 OPA/Rego PDP/PEP | License、ACL、地域、用途决策 | 默认拒绝；策略版本进入 RetrievalRun，不建立第二策略引擎 |
| 工作流/观测 | D08 持久化 Workflow、OpenTelemetry | 摄取、索引、回答、更新/重试和全链追踪 | 幂等、可取消、失败不发布半成品 |

技术决策采用“PostgreSQL 权威元数据+对象存储原件+可重建搜索索引”的简单三层；搜索和模型均通过接口适配，落实 SOLID；统一 Clause/Citation/Policy 避免各专业重复建设，落实 DRY；不在首期引入知识图谱数据库和全自动规则生成，落实 YAGNI。

### D20.19 评测、指标与发布门禁

评测集按法域/专业/建筑类型/问题类型/语言/版本冲突/拒答/权限构建，专家标注 Relevant Clause、适用判断、可接受答案要点和必须拒答条件；受限文本不得进入无许可共享评测集。

| 指标 | 定义/门禁 |
|---|---|
| Citation Recall@K | 金样必需 Clause 被检回比例 |
| Retrieval nDCG/MRR | 相关条款排名质量，按查询类型分层 |
| ACL/License Leakage | 越权或超许可检索/显示次数，目标为 0 |
| Edition Accuracy | 回答所用 Edition 与项目基线/适用日期一致率 |
| Citation Entailment | 引用是否支持对应主张的专家/模型双检通过率 |
| Unsupported Claim Rate | 无引用或引用不支持的事实主张比例 |
| Refusal Precision/Recall | 应拒答与不应拒答样本上的准确性 |
| OCR/Structure Accuracy | 字符、条款编号、表格/页锚点准确率 |
| Freshness/Update SLA | 官方变更发现到影响评估/发布的时间 |
| Answer Latency/Cost P95 | 按检索/重排/生成分解的时延与成本 |
| Expert Override Rate | 专家修改结论/适用/引用比例，用于回归改进 |

发布门禁：权限泄漏或引用伪造为零容忍；关键标准条款/表格金样、版本冲突、许可撤销、拒答和提示注入测试全部通过；模型/Embedding/索引任一版本变化均执行离线回归与小流量灰度。

### D20.20 D20 验收条件（EARS）

- When 新知识来源登记, the 模块 shall 验证发布主体、官方入口、题录、法域和来源等级。
- While LicenseGrant 未允许存储/解析/Embedding/Prompt 用途, when 对应处理被请求, the 模块 shall 默认拒绝。
- When 文件摄取, the 模块 shall 隔离检查类型、恶意内容、哈希、签名/水印并保留原始 AssetVersion。
- When 扫描页 OCR, the 模块 shall 保存页图、版面坐标、置信度、解析器版本和人工纠错 Revision。
- When Clause 生成, the 模块 shall 保存层级编号、祖先标题、Edition、页码锚点、关系和文本摘要。
- When 项目知识基线批准, the 模块 shall 固定 DocumentEdition、ApplicabilityDecision、解释和冲突决定，不引用“最新规范”。
- When 混合检索执行, the 模块 shall 在精确、BM25、向量和重排所有分支应用一致的许可、ACL、法域、有效期和项目基线过滤。
- When 证据相关性、适用性或覆盖不足, the 模块 shall 返回明确拒答/澄清，不以模型常识补齐。
- When GroundedAnswer 生成, the 模块 shall 使每项事实主张绑定可访问 CitationAnchor，并核验数字、单位、否定和版本。
- When 引用内容受 Display 许可限制, the 模块 shall 仅返回允许摘录或题录，不因用户有答案权限而扩大正文权限。
- When 检索内容包含指令性文本, the 模块 shall 将其视为不可信数据，不改变系统指令、权限或工具调用。
- When 专家解释批准, the 模块 shall 保存条款、推理、适用边界、审签人、有效期和替代关系。
- When 新版/勘误/废止或许可变化发现, the 模块 shall 生成 KnowledgeUpdate 和条款级影响清单，不静默替换项目基线。
- When 历史项目重放, the 模块 shall 使用当时 KnowledgeBaseline、索引/模型/策略版本或返回可解释的重建差异。
- When 任一发布候选存在权限泄漏、引用伪造或关键拒答回归失败, the 模块 shall 阻断上线。

### D20.21 D20 完成检查与下游约束

| 检查项 | 结果 |
|---|---|
| 是否覆盖来源权威性、地域、版本、有效期、许可和项目适用性 | 是 |
| 是否形成文档—Edition—Clause—Citation—Baseline 权威链 | 是 |
| 是否细化摄取/OCR/结构/切分/混合检索/重排/生成/拒答 | 是 |
| 是否覆盖更新废止、专家解释、知识投毒、权限和评测 | 是 |
| 是否定义接口、事件、界面和可替换组件技术栈 | 是 |

D20 对下游的强制约束：D21 的每个 RuleRevision 必须引用 Clause/Citation、KnowledgeBaseline 和批准解释；D26/27 执行回答契约、许可/ACL 和提示注入边界；D28 使用 RetrievalRun/评测集治理模型与索引版本；D35 固化知识事件与稳定 ID；D37 实现许可台账、质检、规范浏览器、基线、问答和更新界面；D40 将知识投毒、版权、跨境和数据保留纳入威胁模型。

#### D20.21.1 RAG 设计对标 2025 最佳实践（业界对标审计补充）

 **审计依据：** 2025 RAG 最佳实践（LlamaIndex/LangChain 架构指南、Anthropic RAG Cookbook、Azure AI Search 混合检索）、建筑规范检索特殊性（条款精确性 > 语义模糊性）、pgvector 0.7 能力边界。

**D20 设计与 2025 RAG 最佳实践对标：**

| 2025 RAG 最佳实践 | D20 当前设计 | 对标结果 | 补充建议 |
|---|---|---|---|
| 混合检索（BM25 + 向量 + 元数据过滤） | D20.11 步骤 4 已设计三路并行检索 | ✅ 已对齐 | 无需补充 |
| 语义重排（Cross-Encoder/Reranker） | D20.11 步骤 5 已设计 RRF + 交叉编码器 | ✅ 已对齐 | V0 可用简单 RRF 替代 Cross-Encoder |
| 条款级切分（非固定 token 窗口） | D20.10 按一条/一款切分 + parentClauseId | ✅ 已对齐（优于通用实践） | 建筑规范条款级切分是正确决策 |
| 查询改写/扩展 | D20.11 步骤 2 意图分类 + 术语库扩展 | ✅ 已对齐 | 无需补充 |
| 拒答/不确定性表达 | D20.12 Answerability Gate + 拒答类型 | ✅ 已对齐（优于多数实现） | 无需补充 |
| 引用溯源（Citation） | D20.13 CitationAnchor + 证据等级 | ✅ 已对齐 | 无需补充 |
| **评估框架（Eval）** | D20.19 有指标但缺具体评估基准 | ⚠️ 需补充 | 见下方“建筑规范 RAG 评估基准” |
| **Agentic RAG / 多步检索** | 未设计 | ⚠️ 设计预留 | V2+ 引入，V0 不需要 |
| **Graph RAG / 知识图谱增强** | 未设计 | ⚠️ 设计预留 | 规范引用关系图可在 V1 作为条款关系索引增强 |

**建筑规范 RAG 评估基准设计（补充）：**

| 评估维度 | 指标 | 目标值（V1 基线） | 测量方法 |
|---|---|---|---|
| 检索精确率 | 返回条款中实际相关的比例（Precision@5） | ≥ 0.80 | 专家标注 50 个典型问题集 |
| 检索召回率 | 相关条款被返回的比例（Recall@10） | ≥ 0.90 | 同上 |
| 引用准确率 | 生成回答中引用实际支持主张的比例 | ≥ 0.95 | 专家逐句核验 |
| 拒答正确率 | 应该拒答时正确拒答的比例 | ≥ 0.90 | 构造无答案/越权/过期问题集 |
| 幻觉率 | 生成内容中无来源支持的主张比例 | ≤ 0.05 | 专家比对 + 自动蕴含检查 |
| 版本正确性 | 返回条款为当前有效版本的比例 | ≥ 0.99 | 自动有效期校验 |
| 响应时延 | P95 端到端响应时间 | ≤ 5s | 自动测试 |

**评估数据集构建要求：**
- 初始评估集：≥50 个问题，覆盖条款定位、要求解释、跨条款比较、项目适用、无答案/拒答 5 类场景
- 每个问题标注：期望条款、期望答案要点、难度等级、专业/法域标签
- 每次索引/模型/Prompt 变更后运行回归评测，结果记入 D28 RetrievalRun

**向量数据库选型审计（pgvector vs 专用向量库）：**

| 维度 | pgvector（V0/V1 推荐） | 专用向量库（Milvus/Qdrant/Weaviate） |
|---|---|---|
| 建筑规范场景充分性 | ✅ 规范文档 <10万 chunks，HNSW 索引足够 | 过度（百万级向量才体现优势） |
| 混合检索 | ✅ pgvector + tsvector 同库联合查询 | 需额外 BM25 引擎 + 融合层 |
| 事务一致性 | ✅ 与业务数据同事务 | 需额外同步机制 |
| 运维成本 | ✅ 无额外组件 | 增加独立集群运维 |
| 升级触发 | 向量 >100万 或需 GPU 加速检索 | — |

结论：建筑规范检索场景下，pgvector 在 V0/V1 完全充分。D20.18 技术栈中“pgvector 起步”的决策正确，无需修改。

