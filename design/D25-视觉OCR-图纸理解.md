# D25 视觉OCR与图纸理解

> 来源：@design/INDEX.md | 创建：2026-07-22 | 更新：2026-07-22
> 原始行范围：7521–7778
> 引用约定：同文件内引用使用 §编号，跨文件引用使用 @design/文件名.md

## D25 视觉/OCR/图纸理解

### D25.1 任务定义

| 项目 | 内容 |
|---|---|
| 任务目标 | 将 PDF/扫描图/图片中的页面、视口、文字、图元、符号、标注和拓扑转换为带坐标、置信、血缘和人工校正的结构化 Drawing Understanding Graph |
| 直接产出 | 感知对象、坐标/比例、分层流水线、图纸本体、置信/复核、接口、界面、技术栈、数据集和验收条件 |
| 成功对齐物 | 任一识别对象能回到原文件/页/像素或 PDF 坐标、模型/参数版本、候选证据和人工校正记录 |
| 本任务不做 | 不替代可用的 Revit/DWG/PDF 原生结构，不自动认定施工图专业正确，不直接写回权威模型/图纸 |
| 主能力 | CAP-13.02/03、CAP-11.03、CAP-15.03，消费 D07 AssetVersion/D24 Capability，服务 D20/D22/D23/D26 |

### D25.2 标杆依据与设计取舍

- PaddleOCR/PP-Structure 的方向校正、版面分析、OCR、表格/公式识别说明文档理解应采用可组合模块，并返回区域坐标/置信，而非单一端到端文本。
- OpenCV 的透视变换、阈值、形态学、Hough 直线/轮廓适合校正、图框/线条/圆弧候选等确定性前后处理。
- 通用文档模型主要识别标题、段落、表格、图像等，无法直接覆盖施工图语义；平台建立 AEC 图纸本体并使用项目符号/字体/图层/专业规则适配。
- 原生 PDF 矢量/文本和 CAD/BIM 元数据精度高于栅格识别；处理优先级为 NativeStructure→VectorPDF→RasterCV/OCR→VLM 候选→人工。

### D25.3 核心原则

1. 每一级产物都绑定固定源 AssetVersion、页、坐标系、模型/算法版本和参数；派生不覆盖原件。
2. 文本、图元、对象、关系和专业解释分层；OCR 字符正确不代表对象/拓扑正确。
3. 优先确定性解析和几何约束，学习模型负责难以规则化的检测/识别/分类候选。
4. 坐标变换链、比例和单位必须可逆/可验证；无法校准时禁止用于 D22 尺寸或 D23 数量。
5. 置信度按阶段校准并传播，不能简单相乘或用单一模型分数冒充系统可信度。
6. 人工纠错形成新 Revision，并反哺评测/训练候选；不静默改写历史 AI 结果。
7. 低置信、冲突、越界和跨页断链进入 ReviewQueue，不通过默认值补齐。

### D25.4 领域对象

| 对象 | 职责 | 关键内容 |
|---|---|---|
| PerceptionJob | 一次感知任务 | capability、源资产/页范围、Profile、优先级、状态和预算 |
| PerceptionProfile | 流水线配置 | 格式/专业/语言、模块/模型/阈值、规则和版本 |
| PageRepresentation | 页面派生 | PDF page/vector/raster、DPI、尺寸、旋转、颜色和哈希 |
| CoordinateTransform | 坐标变换 | Source/PDF/Pixel/View/Sheet/Model 坐标、矩阵、误差和验证点 |
| ScaleCalibration | 比例/单位校准 | 标称/实测比例、参考尺寸/轴网、单位、误差和状态 |
| LayoutRegion | 页面/视口区域 | 图框、标题栏、视口、明细、说明、图例、索引和边界 |
| TextSpan | OCR/原生文本 | 内容、字符/词/行、语言、字体候选、bbox/polygon 和置信 |
| GraphicPrimitive | 基础图元 | line/polyline/arc/circle/hatch/fill/image、几何和来源 |
| SymbolInstance | 符号实例 | 类型候选、模板/模型、位置/方向/尺度、属性和置信 |
| AnnotationEntity | 标注实体 | Dimension/Tag/Leader/Keynote/Grid/Level/Callout 及关联候选 |
| DrawingObject | AEC 图纸对象 | Wall/Door/Window/Room/Equipment/Pipe/Duct/Circuit 等候选 |
| TopologyNode | 图关系节点 | 端点、交点、空间、设备、标注、对象和外部引用 |
| TopologyEdge | 图关系边 | connects、bounds、contains、labels、dimensions、references、crosses |
| DrawingUnderstandingGraph | 一页/图纸结构图 | 对象/关系/坐标/版本、质量和完整性 |
| RecognitionCandidate | 多模型候选 | 类型/值、来源模型、分数、特征、冲突组和排序 |
| PerceptionConfidence | 校准置信 | stage、raw/calibrated score、切片、阈值、原因和状态 |
| HumanCorrection | 人工校正 | 原候选、新值/几何/关系、原因、操作者、时间和依据 |
| ReviewQueueItem | 复核任务 | 风险、低置信/冲突类型、上下文、SLA、责任和状态 |
| PerceptionDataset | 数据集版本 | 样本/许可、专业/格式/难例切片、标注、划分和血缘 |
| PerceptionEvaluation | 评测运行 | 模型/Profile、数据集、指标、切片、错误和批准结论 |

### D25.5 坐标、页面、比例与单位

坐标链：源文件对象坐标（可用时）→PDF User Space→渲染像素→页面标准坐标（原点/方向统一）→视口局部坐标→图纸物理坐标→模型/项目坐标候选。CoordinateTransform 保存 3×3 单应/仿射矩阵、源/目标单位、控制点、重投影误差和可逆性。

- PDF page box 区分 Media/Crop/Trim/Rotate；渲染 DPI 不改变 PDF 物理尺寸。
- 扫描件先检测旋转、偏斜、透视/非线性畸变；仅有可靠控制点时校正，原图保留。
- 比例来源优先：原生 View 元数据→图签/视图比例文本→两个以上已知尺寸/轴网控制点→人工校准。
- 同页多视口可有不同/无比例；详图、示意图、系统图分别标识。
- ScaleCalibration 状态 Valid、Approximate、Unknown、Conflicted；只有 Valid 可进入确定性长度/面积提取。

### D25.6 施工图理解本体

| 层 | 典型类型 |
|---|---|
| 页面/组织 | TitleBlock、SheetNumber/Name、Revision、Viewport、Legend、Notes、Schedule、DetailIndex |
| 基准/定位 | Grid、GridBubble、Level、ElevationMark、NorthArrow、Coordinate、Section/Elevation/Callout |
| 建筑 | Wall、Door、Window、Room、Stair、Ramp、Railing、Finish、Opening、Furniture |
| 结构 | Column、Beam、Slab、Foundation、Brace、RebarMark、SectionMark、Load/MemberTag |
| 给排水/暖通 | Pipe/Duct、Fitting、Valve/Damper、Equipment、Terminal、FlowArrow、SystemLabel、Riser |
| 电气 | Panel、Circuit、CableTray/Conduit、Fixture、Device、Switch、Socket、Symbol/Loop |
| 标注/关系 | Dimension、Tag、Leader、Keynote、MaterialNote、Boundary、Centerline、Connection |

专业包 D17 可扩展类型/属性/关系，但必须映射核心 DrawingObject/Annotation/Topology 契约；项目符号库版本化，不以单张图的视觉相似建立全局标准。

### D25.7 分层处理流水线

1. **接收与安全**：验证 AssetVersion/权限/MIME/魔数/恶意文件/页数/大小/许可，创建 PerceptionJob。
2. **原生提取**：读取 PDF 字符、路径、图像、字体/编码和 Optional Content；若有 RVT/DWG 血缘，消费 D22 原生结构。
3. **页面渲染**：按 Profile 生成多 DPI/颜色 PageRepresentation，保存渲染器/字体/参数和哈希。
4. **几何校正**：方向、deskew、透视、去噪/二值化/增强；生成 CoordinateTransform 和质量报告。
5. **版面分割**：图框/标题栏/视口/表格/说明/图例/索引，规则+检测模型融合。
6. **文字识别**：原生文本优先，OCR 检测/方向/识别；专业词典、字体和语言模型仅做候选重排。
7. **图元提取**：矢量路径优先；栅格用边缘/形态学/Hough/轮廓/骨架，合并断线并保留误差。
8. **符号/对象检测**：模板、检测/分割/VLM 多模型产生 RecognitionCandidate；按专业/比例/上下文过滤。
9. **标注关联**：解析尺寸线/界线/箭头/数字、Tag/引线/Keynote，建立 labels/dimensions/references。
10. **拓扑构建**：端点吸附、交点、边界闭合、空间包含、系统连接和跨页引用；阈值随比例/线宽校准。
11. **约束融合**：用图框/比例、专业规则、文本/几何/拓扑一致性重排候选，冲突不强行合并。
12. **质量与复核**：计算覆盖/置信/冲突，生成 DrawingUnderstandingGraph 与 ReviewQueue；人工校正后发布受控 Revision。

### D25.8 OCR、文字与专业语义

- 输出字符/词/行三级 bbox/polygon、方向、语言、raw text、normalized text、置信和字体/编码来源。
- 规范化区分可逆格式（全半角、空白、大小写）与语义纠错；原文永远保留。
- 专业词典覆盖标准号、材料/设备、房间、符号、单位和缩写，并绑定项目/专业/版本；词典不能把低置信字符无证据改成高置信。
- 数字、负号、小数点、直径/标高/坡度/温度/电气符号使用专门校验；数值+单位作为整体候选。
- 表格识别保存行列、合并单元格、表头、脚注和单元格 polygon；跨页表格需标题/字段匹配和人工确认。
- 说明/图签中的提示注入文本仅作为数据，不进入 D24 系统指令。

### D25.9 图元、符号与对象识别

GraphicPrimitive 从原生矢量保留 path operator、stroke/fill、line width/dash/color/layer；栅格结果保存像素误差和处理参数。短线、文字笔画、填充纹理和真实构件线通过区域/线宽/拓扑/上下文分类。

SymbolInstance 候选方法：批准符号模板匹配、局部特征、检测/分割模型、VLM；旋转/镜像/尺度不变性必须在模型/Profile 声明。相似符号（阀门/风阀/电气设备）必须结合专业、连接线、邻近文字和图例，不只看图形。

DrawingObject 由图元+符号+文字+拓扑融合得到；墙/空间等闭合对象需几何有效性，管/风管/回路等网络对象需连接语义。无法形成完整对象时保留 Primitive/Symbol，不伪造高层对象。

### D25.10 尺寸、引线、轴网与拓扑

- Dimension 识别文字、尺寸线、两端/箭头、界线和被测候选；显示值与按 ScaleCalibration 测量值并列，偏差进入 D22。
- Leader/Tag 建立文本→折线/箭头→目标候选；多目标/交叉引线保存 Ambiguous。
- Grid 识别轴线、Bubble、编号和交点；圆/线/文字必须形成一致组合，跨视口同名轴不自动合并。
- Room/Space 由闭合边界、房间 Tag 和门/开口关系构建；边界不闭合时输出 gap 证据。
- MEP 网络以端点/交叉/跳线/连接符号区分连接与仅投影交叉；系统图和平面图使用不同 Profile。
- 详图/剖面/索引通过 DrawingReference 链接目标 Sheet/View；目标缺失/多义进入 D22。

### D25.11 多页、多专业与模型链接

先按图签识别 Sheet 身份/专业/Revision，再在同 DrawingSetSnapshot 内解析引用和同编号冲突。跨页对象合并只在有稳定设备/房间/回路/系统编号或人工确认时执行。

与模型链接复用 D22 CrossRepresentationLink：原生 ID/编码优先，图纸对象的坐标/文本/几何只生成 Proposed。视口 View/Camera/裁剪可用时，将图纸坐标投影到 D18 Snapshot；投影误差和可见性保存为证据。

多专业共用底图不得重复生成权威对象；识别结果标注 `authoritative/underlay/reference` 候选，由 MappingProfile/人工确认。

### D25.12 置信、冲突与人工复核

PerceptionConfidence 按 Page/Layout/Text/Primitive/Symbol/Object/Relation/Graph 分层校准。系统置信综合模型校准分数、输入质量、几何/拓扑约束、词典命中、跨模型一致性和 OOD（分布外）检测；规则冲突可降低/阻断，不能提升原始证据不存在的候选。

| 级别 | 处理 |
|---|---|
| AutoAccept | 高于专业/类型阈值且无冲突，只进入派生 Graph；下游仍按风险复核 |
| ReviewSample | 高置信但高影响/新切片，按抽样策略复核 |
| ReviewRequired | 中低置信、多模型冲突、关系/比例不确定，必须人工确认 |
| Reject/Unknown | 低于阈值/OOD/不可解析，保留未知和证据 |

复核优先级=业务影响×不确定性×传播范围×截止时间；批量确认仅允许同模型/类型/上下文且提供抽样预览。HumanCorrection 类型为 Accept、Reject、Relabel、EditGeometry、EditText、Relink、Split/Merge、MarkUnknown，并保存原因码。

### D25.13 数据集、标注与评测

PerceptionDataset 按来源许可、项目/地区、专业、图纸类型、阶段、语言、字体、DPI、扫描质量、比例和工具切片；同项目/同图纸派生页不能跨 train/validation/test 泄漏。受限客户图纸不进入通用训练集，训练/评测/演示权利分开。

标注规范定义本体、polygon/line/keypoint、文字、关系、遮挡、未知类和裁决；双人标注/专家仲裁覆盖高风险类型。金样包含清晰/低质、旋转/透视、重叠文字、密集管线、相似符号、不同字体/中英双语和对抗隐藏文本。

| 层级 | 主要指标 |
|---|---|
| Page/Layout | region mAP/IoU、漏检、reading order |
| OCR | CER/WER、数字/单位/标准号准确率 |
| Primitive | line/arc endpoint error、precision/recall、拓扑断点 |
| Symbol/Object | mAP、class precision/recall、unknown/OOD recall |
| Relation/Topology | edge F1、连接/包含/标注关联准确率、graph validity |
| Calibration | ECE/Brier、各置信区间真实准确率 |
| End-to-end | Sheet 字段、尺寸、房间/设备/网络、D22 Link 和 D23 数量任务准确率 |

### D25.14 服务接口与事件

| 接口 | 关键输入 | 输出/约束 |
|---|---|---|
| `POST /perception-jobs` | assetVersion/pageRange、profileRevision、purpose、idempotencyKey | 异步 Job、固定源与 D24 Invocation |
| `GET /perception-jobs/{id}` | jobId、stage/page 过滤 | 进度、质量、错误、成本和产物引用 |
| `POST /perception-jobs/{id}:cancel` | expectedRevision、reason | 取消及已完成页/费用状态 |
| `GET /drawing-graphs/{id}` | graphId、region/type/confidence | 权限裁剪的 Graph Revision/分页 |
| `POST /drawing-graphs/{id}/corrections` | expectedRevision、target、operation、value/geometry、reason | HumanCorrection 和新 Graph Revision |
| `POST /scale-calibrations` | page/view、method、controlPoints/value/unit | 校准候选/误差，需确认后 Valid |
| `POST /representation-links:from-perception` | graph objects、model/drawing scope | D22 Proposed Links，不直接确认 |
| `GET /review-queue` | project/profile/risk/confidence/SLA | 权限过滤复核任务 |
| `POST /review-queue/{id}/commands` | assign/accept/reject/escalate | 审计化复核迁移 |
| `POST /perception-evaluations` | datasetVersion、profile/model revisions、slices | 异步评测和发布建议 |
| `GET /perception-evidence/{id}` | evidenceId、overlay mode | 原页/候选/模型/变换/置信证据 |

事件：`PerceptionJobAccepted/StageCompleted/Completed/Partial/Failed/Cancelled`、`ScaleCalibrationConfirmed/Invalidated`、`DrawingGraphPublished/Superseded`、`LowConfidenceDetected/ReviewAssigned/CorrectionApplied`、`PerceptionEvaluationCompleted/RegressionDetected`。

### D25.15 界面与交互详细设计

| 界面 | 主区 | 关键操作 | 防错/反馈 |
|---|---|---|---|
| 感知任务中心 | 文件/页、流水线阶段、GPU/成本、质量、错误 | 新建、取消、重跑失败页 | 固定源/Profile；Partial 不标完成 |
| 页面校准台 | 原图/增强图、旋转/透视、控制点、比例/单位、误差 | 自动候选、拖点、确认/撤销 | Approximate/Unknown 不允许量测输出 |
| 图纸理解工作台 | 页面、图层开关、文本/图元/符号/对象/关系 Overlay、属性 | 查看候选、筛选、局部重跑 | 原始与校正 Revision 可切换；置信图例 |
| 文字/表格复核 | 原图、OCR 行/字符、词典候选、表格网格、低置信列表 | 纠字、合拆行列、确认单位 | 原文保留；批量替换预览影响 |
| 符号/对象复核 | 候选画框/掩码、图例/模板、上下文、模型差异 | 接受/拒绝/重标/拆并 | 相似类和 OOD 醒目；不可一键全确认 |
| 拓扑图编辑 | 2D Overlay+关系图、断点/冲突/闭合检查 | 连/断边、Relink、标未知 | 编辑生成 HumanCorrection，不改 AI 原结果 |
| 复核队列 | 风险×置信×SLA 排序、专业/人员/批次 | 指派、抽样、升级、完成 | 高影响项禁止仅抽样自动通过 |
| 数据集与评测台 | 数据切片、许可/划分、指标/校准、错误画廊、版本对比 | 建集、标注质检、评测、发布建议 | 项目泄漏/许可/切片退化阻断 |

### D25.16 组件技术栈方案

| 组件 | 推荐技术栈 | 职责 | 约束/替代 |
|---|---|---|---|
| PDF/矢量解析 | PDFium 或 MuPDF 适配、PDFBox 辅助 | 页、文字、路径、图像、字体和坐标 | 许可证/沙箱；原生对象优先 |
| 图像处理 | OpenCV、libvips | 渲染后处理、deskew/透视、阈值/形态学/线条轮廓 | 参数/Profile 版本化、可逆坐标 |
| OCR/版面/表格 | PaddleOCR/PP-Structure/PaddleX 适配 | 方向、文本、版面、表格/公式候选 | AEC 数据再训练/评测；不直接信通用类别 |
| 检测/分割 | Detectron2/MMDetection/Ultralytics 适配后单选训练栈 | 符号/对象/区域检测分割 | D28 锁模型/许可证；避免多训练栈长期并存 |
| 几何/拓扑 | GEOS/JTS、OpenCV、图算法库 | 图元合并、吸附、边界、空间/网络关系 | Decimal/容差/比例显式，确定性金样 |
| VLM | D24 VisionUnderstanding Capability | 难例分类、上下文候选、图例辅助 | 不直接写 Graph 权威关系；受提示注入控制 |
| 感知服务 | Python Worker + FastAPI/gRPC 内部接口 | 模型推理/流水线执行 | 领域事实由控制面持久化，不在 Worker 本地 |
| 控制面/存储 | Java 21 + Spring Boot 4.1 + PostgreSQL/PostGIS + 对象存储 | Job/Profile/Graph/Correction/Dataset/Eval | 不可变 Revision、空间索引、Outbox；Python 只执行感知 Worker |
| 标注/复核 | CVAT/Label Studio 适配 + 平台复核 UI | 金样标注、校正和任务分发 | 项目权限/许可、审计和导出控制 |
| GPU/编排 | D08 Workflow + Kubernetes GPU Worker/NVIDIA Triton 可选 | 分页/分区、批量、资源/模型加载 | 配额、取消、显存隔离、版本固定 |
| 可观测/模型 | OpenTelemetry + D28 MLflow/数据版本 | 阶段时延/错误/成本、模型/数据血缘 | 不记录未授权页图/文字正文 |

技术取舍：原生解析+模块化 CV/OCR 为主，VLM 为受控补充；统一 Graph/坐标/置信/Correction 避免各下游重复视觉处理，落实 DRY；模型/解析器适配器落实 SOLID；首期聚焦高价值图框、文字、视口、轴网、尺寸、房间/门窗/设备/管线，不追求所有专业符号，落实 KISS/YAGNI。

### D25.17 安全、性能与异常恢复

- PDF/图片在无网络沙箱解析；限制页数、像素、压缩炸弹、嵌入文件/脚本、字体/ICC、解码资源和处理时长。
- OCR/VLM 输入继承项目权限/许可/驻留；训练使用单独授权，供应商不得默认保留或训练。
- Page/Graph/Correction/数据集按对象权限裁剪；截图/Overlay/导出不得泄露无权图层/文本。
- 大图按页/视口/瓦片并行，低 DPI 预检后对文字/符号区域高 DPI 重识别；缓存键包含源哈希/Profile/模型/渲染器。

| 异常 | 处理 |
|---|---|
| 加密/损坏/恶意 PDF | 隔离失败，禁止降级到不安全解析器 |
| 缺字体/编码/矢量异常 | 保留原对象并渲染 OCR 对照，标记来源冲突 |
| 透视/比例无法校准 | 图理解可继续，尺寸/数量输出禁用 |
| 页/视口超大或 GPU OOM | 自适应瓦片/批量重试，保持 overlap 与坐标合并证据 |
| 多模型候选冲突 | 保存冲突组并送 ReviewRequired，不按最高分强选 |
| 拓扑不闭合/交叉多义 | 输出 gap/ambiguous edge，不自动补线 |
| 在途模型/Profile 被停用 | 固定 Run 完成或按安全策略取消，不自动切版本 |
| 人工校正与新 AI Run 冲突 | 三方差异合并，人工 Correction 不被静默覆盖 |

### D25.18 指标与发布门禁

除 D25.13 模型指标外，运营指标包括：Structured Native Reuse、Valid Scale Coverage、AutoAccept/Review/Unknown Mix、Review Queue Age、Human Correction Rate、Correction Reuse、Page Throughput/Latency P95、GPU/页成本、Partial/Failure Rate、Downstream D22/D23 Accepted Precision。

发布门禁：许可/数据划分无泄漏；关键专业/格式/低质切片达到阈值；数字/单位、尺寸、轴网、Tag/引线、关键符号和拓扑金样通过；置信校准、OOD、提示注入、恶意 PDF、坐标回映、瓦片边界和人工校正回归通过。

### D25.19 D25 验收条件（EARS）

- When PerceptionJob 创建, the 模块 shall 固定源 AssetVersion、页范围、PerceptionProfile、模型/解析器和 D24 Capability/Policy 版本。
- When 原生 PDF/CAD/BIM 结构可用, the 流水线 shall 优先保留并使用其文字/路径/关系，不以栅格 OCR 覆盖。
- When 页面旋转/透视/比例校准, the 模块 shall 保存变换矩阵、控制点、单位、误差、状态并支持回映原页。
- While ScaleCalibration 非 Valid, when 尺寸/面积/数量输出被请求, the 模块 shall 拒绝确定性量测并返回校准缺口。
- When OCR/对象/关系候选生成, the 模块 shall 保存 bbox/polygon、模型/参数、raw/calibrated confidence 和源页证据。
- When 文本规范化/专业词典纠错, the 模块 shall 保留 raw text 并标记变换，不伪造原 OCR 高置信。
- When 相似符号分类, the 模块 shall 结合专业、图例、连接、邻近文本和上下文；证据冲突时送人工复核。
- When Dimension 识别, the 模块 shall 关联显示值、尺寸/界线/端点、目标候选和按比例测量值。
- When 管线/回路在投影中交叉, the 模块 shall 依据连接符号/拓扑判定；证据不足时标记 Ambiguous 而非 Connected。
- When DrawingUnderstandingGraph 发布, the 模块 shall 包含对象、关系、坐标、版本、覆盖、未知和质量摘要。
- When 人工纠错, the 模块 shall 保存原候选、操作、新值/几何/关系、原因、操作者并生成新 Revision。
- When AI 新运行与既有人工纠错冲突, the 模块 shall 进入差异合并，不静默覆盖人工结果。
- When 数据集划分, the 模块 shall 防止同项目/同源图纸派生泄漏并验证训练/评测许可。
- When Profile/模型发布, the 模块 shall 在专业/格式/质量/语言/比例切片验证指标、校准、OOD 和下游任务门槛。
- When 识别结果供 D22/D23 使用, the 模块 shall 传递源版本、坐标/比例状态、置信、人工复核和未知范围，不只返回值。

### D25.20 D25 完成检查与下游约束

| 检查项 | 结果 |
|---|---|
| 是否覆盖原生/矢量/栅格、页面校准、OCR、图元、符号、对象和拓扑 | 是 |
| 是否建立施工图本体、坐标变换、比例/单位和跨页/模型链接 | 是 |
| 是否定义分层置信、冲突、人工纠错、数据集和切片评测 | 是 |
| 是否定义接口、事件、界面、技术栈、安全、性能和门禁 | 是 |

D25 对下游的强制约束：D26 只消费带坐标/置信/复核状态的草图/图纸约束；D27 通过复核队列而非直接修改 Graph；D28 管理感知模型/数据/评测/漂移；D35 固化 Job/Graph/Correction/Eval 契约；D37 实现校准/Overlay/复核界面；D40 覆盖恶意文档、视觉提示注入、训练许可和图纸隐私；D42 规划页/像素/GPU 容量；D44 覆盖坐标、切片、置信、拓扑和人工纠错回归。

