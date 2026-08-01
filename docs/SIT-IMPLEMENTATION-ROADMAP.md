# SIT 版本水平端到端测试补齐规划清单

> 版本：V1.0
> 编制日期：2026-08-01
> 基线：D45 测试与验收体系 + D02.6.1 V0 退出门禁 + D02.6.2 V1 退出门禁
> 当前版本：V0 闭环已达成 + Sprint V1.11.3 增量能力已交付
> 目标：达到设计文档 SIT（System Integration Testing）版本水平，可执行端到端测试并通过 V0/V1 退出门禁

---

## 〇、执行环境与自动化实施指导（2026-08-01 更新）

### 0.1 远程验证环境策略

**所有 SIT 验证类专题统一在远程服务器实施，不在本地起容器。**

- **远程环境**：7 个服务（postgres、minio、chromadb、core、ai、bff、web）+ Nginx 反向代理
- **远程资源**：充足，不限制内存，可并行 3-5 个子 agent
- **本地职责**：代码编辑、单元测试（无外部依赖）、lint、typecheck、git 操作
- **远程职责**：集成测试、E2E、性能、安全、Chaos、UAT 等所有验证类专题
- **详细规则**：见 `.trae/rules/remote-verification.md`

### 0.2 自动化实施流程

```
本地：代码编辑 → 单元测试 → lint/typecheck → git commit & push
                                                        ↓
远程：git pull → docker compose up -d --build → 健康检查 → 执行验证套件
                                                        ↓
本地：接收报告 ← 远程：测试报告输出到 MinIO/PostgreSQL ← 远程：收集日志
```

### 0.3 任务分类与执行位置对照

| 任务类型               | 执行位置 | 命令示例                                                 |
| ---------------------- | -------- | -------------------------------------------------------- |
| 单元测试（无外部依赖） | 本地     | `pnpm test` / `mvn test` / `pytest`                      |
| Lint / Typecheck       | 本地     | `pnpm lint` / `pnpm typecheck`                           |
| 集成测试               | 远程     | `docker compose exec bff pnpm test:integration`          |
| E2E 测试               | 远程     | `docker compose exec web pnpm e2e`                       |
| 性能测试               | 远程     | `docker compose exec bff k6 run /tests/perf/baseline.js` |
| 安全测试               | 远程     | `docker compose exec bff owasp-zap -t https://web:3000`  |
| Chaos 测试             | 远程     | Chaos Mesh + Toxiproxy                                   |

### 0.4 子 Agent 并发策略

- **远程任务**：允许并行 3-5 个子 agent，无需检查内存阈值
- **本地任务**：保持原限制（≤3 个子 agent 加载源码，≤6 个执行测试用例）
- **混合模式**：本地编辑 + 远程验证，结果通过日志/报告回传

---

## 一、总体差距评估

### 1.1 当前已具备能力

- 7 个容器服务全栈部署（postgres/minio/chromadb/core/ai/bff/web）
- 13 个业务域 45+ Controller、26 个 BFF 代理、37 个前端页面
- Change 域状态机 + IRREVERSIBLE 双人审批 + stepUpToken 真实 JWT
- Operations 域 Worker/QueueTask/死信队列/自动重试调度
- AI 辅助影响分析（DeepSeek 集成）+ Connector 异步健康检查
- IAM API Token 全生命周期 + Token 自动过期清理
- Flyway V1~V24 迁移基线
- Java 单元测试覆盖率 ≥ 80% + 集成测试 60 用例

### 1.2 SIT 版本水平核心差距（按 D45 测试分层）

| 测试层              | 当前状态                       | SIT 目标                                |
| ------------------- | ------------------------------ | --------------------------------------- |
| Static/Design       | ✅ ESLint/TSC/tsc/Semgrep 基础 | 增加 OpenAPI/Proto lint、IaC policy     |
| Unit/Property       | ✅ 单测覆盖 80%                | 补齐属性测试（Hypothesis/fast-check）   |
| Component           | ⚠️ 部分                        | 补齐 Service+真实 DB（TestContainers）  |
| Contract            | ❌ 未实现                      | **P0：HTTP/OpenAPI Pact + Event 契约**  |
| Integration         | ⚠️ 部分（Change 60 用例）      | 全域集成 + 数据库迁移测试               |
| E2E/Journey         | ❌ 未实现                      | **P0：P01–P12 核心旅程 Playwright**     |
| Professional Golden | ❌ 未实现                      | P1：境外主创草图到方案深化金样          |
| Nonfunctional       | ❌ 未实现                      | **P0：性能/安全/可靠性基础**            |
| UAT/Pilot           | ❌ 未实现                      | P1：SC-01 Pilot 脚本                    |
| TEVV 平台           | ❌ 未实现                      | P2：Quality Cockpit/Trace Matrix 等界面 |

---

## 二、板块一：测试基础设施（P0 — 前置基础）

### 1.1 测试环境分级（对齐 D44 六级环境）

- **任务**：定义 Dev/CI/Staging/Preprod 四级 TestEnvironment 配置
- **输入**：D44 部署拓扑、docker/compose.yml
- **输出**：`docker/compose.ci.yml`、`docker/compose.staging.yml`、`docker/compose.preprod.yml`
- **验收**：每级环境 DeploymentProfile 注册到数据库，记录 Support Matrix 差异
- **优先级**：P0
- **依赖**：无

### 1.2 测试数据隔离与清理

- **任务**：实现 `testRunId` 标记机制，合成租户与测试事件不污染业务通知/审计/账单
- **输入**：D43 SLO 运营报表排除规则
- **输出**：`packages/shared/src/testing/test-run-id.ts` + 各服务中间件读取并注入 traceId
- **验收**：测试数据在 SLO 报表自动排除或单独计量
- **优先级**：P0
- **依赖**：1.1

### 1.3 契约测试基础设施（Pact Broker）

- **任务**：搭建 Pact Broker，Consumer-Driven Contract Testing 基础
- **输入**：D45.11 HTTP/OpenAPI/gRPC/AsyncAPI/Webhook/File 契约
- **输出**：
  - `docker/compose.ci.yml` 新增 pact-broker 服务
  - `packages/shared/src/contracts/*.pact.ts` Consumer 端期望声明
  - Core Service / BFF Provider Verification 集成测试
- **验收**：契约变更触发"可否部署"计算，编译通过不等于可部署
- **优先级**：P0
- **依赖**：1.1

### 1.4 测试报告与证据存储

- **任务**：测试证据进入对象存储（MinIO），摘要进入 PostgreSQL
- **输入**：D45.10 TestEvidence 实体定义
- **输出**：
  - Core Service `TestEvidenceController` + `test_evidence` 表
  - 证据 Manifest 包含 type/objectUri/hash/tool/version/raw-summary/retention/classification/signature
  - 关键 AcceptancePackage 沿 D41 WORM/签名/TSA 封存
- **验收**：证据 hash 可校验，签名可验证
- **优先级**：P0
- **依赖**：1.1

---

## 三、板块二：契约测试（P0 — 必做）

### 2.1 HTTP/OpenAPI 契约

- **任务**：覆盖 12 个业务域 HTTP 端点契约
- **输入**：D35 API 契约、BFF 26 个代理 Controller
- **输出**：
  - `apps/bff/tests/contract/*.pact.ts` Consumer 端
  - `services/core/src/test/java/.../contract/*ProviderIT.java` Provider 端
  - 覆盖 schema/example/状态/Problem Details/auth/pagination/ETag/idempotency/rate/size
- **验收**：N/N-1 兼容性测试通过
- **优先级**：P0
- **依赖**：1.3

### 2.2 Event/AsyncAPI 契约

- **任务**：覆盖 Change/Operations/Governance 域事件契约
- **输入**：D35 事件契约、`packages/shared/src/events/*.ts`
- **输出**：
  - 事件 schema 校验 + key/partition/ordering/duplicate/late/out-of-order/retry/DLQ/consumer lag/upcaster 场景测试
  - Outbox→Kafka 注入 crash，验证无事实丢失
- **验收**：乱序/迟到/重放按 D35 语义处理
- **优先级**：P0
- **依赖**：1.3

### 2.3 File/Manifest 契约

- **任务**：覆盖文件上传/下载契约
- **输入**：CDE 文件上传链路
- **输出**：
  - MIME+magic/size/chunk/hash/path/zip bomb/malware/schema/edition/partial upload/round-trip 测试
  - Sandbox 覆盖 polyglot/path traversal/macro/script/parser crash/资源耗尽/CDR bypass
- **验收**：恶意文件不使宿主长驻进程失控
- **优先级**：P0
- **依赖**：1.3

### 2.4 AI/通知/分析 Provider 契约

- **任务**：覆盖 DeepSeek/ChromaDB/HuggingFace Provider 契约
- **输入**：AI Service Provider 集成代码
- **输出**：
  - capability/model/region/timeout/429/5xx/partial/malformed/billing/request id/policy fallback 测试
  - WireMock/MockServer stub 模拟 Provider 故障
- **验收**：Provider 故障降级不阻断主流程
- **优先级**：P0
- **依赖**：1.3

---

## 四、板块三：E2E/Journey 测试（P0 — 必做）

### 3.1 核心用户旅程 Playwright 脚本

- **任务**：实现 P01–P12 核心页面 E2E 旅程
- **输入**：D37 关键界面、前端 37 个页面路由
- **输出**：`apps/web/tests/e2e/*.spec.ts` 覆盖
  - 登录→上传→AI 生成→复核→发布核心流程
  - 变更请求全状态机（含双人审批 UI）
  - 运营中心 Worker/QueueTask/Connector 管理
  - 用户设置（API Token/偏好）
  - 治理中心审计/发布/备份
- **验收**：E2E 核心流程覆盖率 = 100%
- **优先级**：P0
- **依赖**：1.1

### 3.2 页面状态矩阵测试

- **任务**：每页覆盖 9 种状态
- **输入**：D45.13 Normal/Empty/Filtered Empty/Loading/Partial/Error/Unauthorized/Conflict/Offline/Stale
- **输出**：
  - MSW 拦截器模拟各种状态响应
  - 只读/Disabled/长文本/多语言/时区/单位/大数据量场景
- **验收**：状态矩阵报告生成
- **优先级**：P0
- **依赖**：3.1

### 3.3 组件测试覆盖

- **任务**：关键组件 Testing Library 单元测试
- **输入**：D45.13 Form/Grid/Tree/Viewer/Diff/Timeline/AI Review/Gate/Notification
- **输出**：`apps/web/tests/unit/components/*.test.tsx`
- **验收**：组件测试覆盖率 ≥ 85%
- **优先级**：P0
- **依赖**：3.1

### 3.4 跨浏览器与跨设备测试

- **任务**：Playwright 多浏览器配置
- **输入**：Playwright 配置
- **输出**：Chromium/Firefox/WebKit 三浏览器 + 移动端视口
- **验收**：核心旅程三浏览器通过
- **优先级**：P1
- **依赖**：3.1

---

## 五、板块四：UI 可访问性与视觉测试（P1）

### 4.1 WCAG 2.2 AA 自动检查

- **任务**：axe-core 集成到 Playwright
- **输入**：D45.13 WCAG 2.2 AA 成功准则
- **输出**：`apps/web/tests/e2e/accessibility.spec.ts` 每页 axe 扫描
- **验收**：零 Critical 违规
- **优先级**：P1
- **依赖**：3.1

### 4.2 人工可访问性矩阵

- **任务**：执行人工矩阵测试
- **输入**：D45.13 人工矩阵
- **输出**：测试报告覆盖
  - 仅键盘操作
  - 焦点顺序/可见性
  - 快捷键冲突
  - VoiceOver+Safari
  - NVDA+Chrome/Edge
  - 200% 文本和 400% zoom
  - 对比度/非颜色提示
  - 动态状态宣告
  - Grid/Tree/Viewer 替代路径
  - 错误恢复
  - 触控目标
- **验收**：人工证据归档到 TestEvidence
- **优先级**：P1
- **依赖**：4.1

### 4.3 视觉差异测试

- **任务**：Playwright 视觉截图基线
- **输入**：D45.13 Design Token/Viewport/主题/locale 固定
- **输出**：
  - `apps/web/tests/e2e/visual/*.spec.ts` 截图基线
  - 抗锯齿噪声小阈值
  - 关键状态/文字溢出/遮挡/像素级图纸标注不可被大范围 mask
- **验收**：视觉差异报告
- **优先级**：P1
- **依赖**：3.1

---

## 六、板块五：GoldenDatasetRelease 与专业金样（P1）

### 5.1 GoldenDatasetRelease 框架

- **任务**：实现 8 类数据集的版本化发布
- **输入**：D45.8 数据集分类
- **输出**：
  - Core Service `GoldenDatasetController`（TEVV 域已存在）
  - 每数据集保存原始/派生文件 hash、许可/隐私、来源、标注指南、双人/专家仲裁、切片统计、train/dev/test 隔离、已知不确定性、oracle 类型和适用 DeploymentProfile
- **验收**：8 类数据集至少各 1 个 Release
- **优先级**：P1
- **依赖**：1.4

### 5.2 Requirement/Standard 数据集

- **任务**：规范条文 + IDS + 变更/冲突/引用
- **输入**：D20 规范知识 RAG
- **输出**：版本差/地区/语言/过期条文/否定/例外/OCR 噪声切片
- **优先级**：P1
- **依赖**：5.1

### 5.3 Sketch/Drawing 数据集

- **任务**：手绘/扫描/PDF/DWG + 图层/文字/尺寸/符号
- **输入**：D25 视觉 OCR
- **输出**：倾斜/低分辨率/遮挡/多比例/字体缺失/恶意文件切片
- **优先级**：P1
- **依赖**：5.1

### 5.4 BIM/Federation 数据集

- **任务**：RVT/IFC/BCF + 专业模型 + 坐标/阶段/LOD
- **输入**：D18 多联邦
- **输出**：IFC edition/错轴/单位/缺构件/重复 GUID/大模型/代理对象切片
- **优先级**：P1
- **依赖**：5.1

### 5.5 Professional 数据集

- **任务**：建筑/结构/给排水/HVAC/电气图纸与计算
- **输入**：D12–D16 各专业
- **输出**：正常/边界/违规/Unknown/多系统/多建筑类型/地区切片
- **优先级**：P1
- **依赖**：5.1

### 5.6 AI/Agent 数据集

- **任务**：Prompt/Context/Tool/expected rubric
- **输入**：D24 AI 能力目录、D27 Agent 治理
- **输出**：注入/越权/泄漏/含糊/知识边界/多语言/长上下文/拒答切片
- **优先级**：P1
- **依赖**：5.1

### 5.7 Security/Privacy 数据集

- **任务**：文件/请求/身份/租户/数据权利
- **输入**：D40 安全隐私
- **输出**：OWASP payload/跨租户/撤权/SSRF/zip bomb/PII/secret 切片
- **优先级**：P1
- **依赖**：5.1

### 5.8 Performance 数据集

- **任务**：项目/文件/并发/队列/事件生成器
- **输入**：D42 容量模型
- **输出**：P50/P95/max 包络/突发/长稳/故障后积压切片
- **优先级**：P1
- **依赖**：5.1

### 5.9 UI/Accessibility 数据集

- **任务**：角色/语言/主题/分辨率/状态
- **输入**：D37 关键界面
- **输出**：键盘/读屏/200%/400%/错误/空/部分/离线/RTL 切片
- **优先级**：P1
- **依赖**：5.1

---

## 七、板块六：多工具往返测试（P1）

### 6.1 ExchangeRoundTripSample 矩阵

- **任务**：建立工具对交换金样矩阵
- **输入**：D45.8 多工具交换金样矩阵
- **输出**：
  - Revit↔IFC、AutoCAD↔IFC、ArchiCAD↔IFC、Rhino↔IFC、Solibri↔IFC、Navisworks↔IFC 等
  - 每对定义允许损失清单 + 禁止损失清单
  - 六维信息保真度：IFC/原生/BCF/坐标/属性/对象 ID
- **验收**：损失超出阈值标记 `ExchangeLossExceeded`
- **优先级**：P1
- **依赖**：5.4

### 6.2 Revit 集成测试

- **任务**：Revit↔平台往返测试
- **输入**：D30 Revit/APS 集成、D45.14
- **输出**：文档/事务/元素 UniqueId/参数/单位/Worksharing/Family/视图/Sheet/失败回滚 测试
- **优先级**：P1
- **依赖**：6.1

### 6.3 AutoCAD 集成测试

- **任务**：AutoCAD↔平台往返测试
- **输入**：D31 AutoCAD/DWG 集成、D45.14
- **输出**：DWG 版本/handle/layer/block/xref/font/proxy/layout/plot/锁与事务 测试
- **优先级**：P1
- **依赖**：6.1

### 6.4 Rhino/SketchUp/ArchiCAD 集成测试

- **任务**：其他设计工具往返测试
- **输入**：D32 Rhino/SketchUp/ArchiCAD 集成、D45.14
- **输出**：
  - Rhino: geometry tolerance/unit/layer/user text/GH definition/version/plugin/determinism
  - SketchUp: entity persistent id/component/material/tag/scene/unit/geo/extension
  - Archicad: element GUID/classification/property/hotlink/teamwork reserve/GDL/安全脚本
- **优先级**：P1
- **依赖**：6.1

### 6.5 IFC/IDS/BCF 校验

- **任务**：IFC schema/spec 标准化校验
- **输入**：D45.2 buildingSMART IFC Validation Service
- **输出**：
  - schema/spec/MVD/edition/GUID/geometry/property/classification
  - IDS pass/fail
  - BCF viewpoint/topic
- **验收**：联合多 validator，不以单一 validator 代替全部质量
- **优先级**：P1
- **依赖**：6.1

### 6.6 GIS/Analysis 集成测试

- **任务**：GIS 与分析工具集成测试
- **输入**：D33 GIS/仿真/工程软件集成、D45.14
- **输出**：CRS/vertical datum/mesh/node mapping/unit/assumption/solver convergence/result write-back 测试
- **优先级**：P2
- **依赖**：6.1

---

## 八、板块七：AI TEVV 测试（P1）

### 7.1 AI 质量指标基线

- **任务**：建立 AI Release TEVV 评测体系
- **输入**：D45.16 AI/Agent/感知 TEVV、D28 AI/ML 生命周期
- **输出**：
  - Task Quality: precision/recall/F1/IoU/数值误差/Rubric/constraint satisfaction
  - Calibration: confidence bin/ECE/Brier/coverage-risk
  - Robustness: 扫描噪声/旋转/遮挡/语言/Prompt 改写/工具/Provider 故障
  - Safety/Security: injection/jailbreak/数据外泄/越权工具/恶意文件/资源耗尽
  - Grounding: Citation/Clause/Asset/Version 可验证
  - Human Oversight: 发现率/纠正率/复核时间/automation bias/handoff
  - Fairness/Language: 地区/语言/建筑类型/图纸风格/质量切片差异
  - Privacy: memorization/extraction/PII/secret/retention/deletion/Provider usage
  - Efficiency: latency/token/GPU/energy/cost per accepted outcome
  - Drift: input/output/acceptance/error/slice/provider/model shift
- **验收**：每 AI Release 报告上述指标 + 切片 + CI + 不确定性 + 局限
- **优先级**：P1
- **依赖**：5.6

### 7.2 Prompt Injection 红队测试

- **任务**：LLMSVS 专项验证
- **输入**：D45.2 OWASP LLMSVS、D45.17 AI/Agent 安全
- **输出**：
  - Prompt Injection（直接 + 间接）
  - 数据泄漏
  - 工具滥用
  - 过度代理
  - 模型/向量供应链
  - 不安全输出
- **验收**：Critical exploit 零容忍；防护旁路独立红队
- **优先级**：P1
- **依赖**：7.1

### 7.3 Agent 工具调用治理测试

- **任务**：Agent 测试使用 Tool Simulator
- **输入**：D27 Agent 工具调用治理、D45.16
- **输出**：
  - 计划生成/参数约束/PEP allow/deny/obligation
  - 预算/递归/死循环/记忆污染/跨任务泄漏
  - 用户撤回/工具 partial/timeout/Handoff/emergency stop
- **验收**：测试 Agent 不对生产项目或外部人员产生真实写入/通知
- **优先级**：P1
- **依赖**：7.1

### 7.4 AI 漂移监测

- **任务**：建立 Drift 检测机制
- **输入**：D45.16 Drift 维度
- **输出**：
  - input/output/acceptance/error/slice/provider/model shift 监控
  - 超阈 Shadow/回滚/再评测
  - 生产标签延迟显式
- **验收**：漂移超阈自动告警
- **优先级**：P2
- **依赖**：7.1

---

## 九、板块八：安全与隐私验证（P0 — 必做）

### 8.1 ASVS 5.0.0 验证

- **任务**：覆盖 OWASP ASVS 5.0.0 全部要求
- **输入**：D45.17 ASVS、D40 安全隐私
- **输出**：
  - SecurityControl/TestCase 保存 `v5.0.0-x.y.z` 映射
  - 架构/编码/认证/会话/授权/输入/密码学/API/文件/日志/配置 11 大类
  - 高风险能力按目标 Level 加项目威胁用例
- **验收**：ASVS Level 达标
- **优先级**：P0
- **依赖**：1.1

### 8.2 IAM/多租户安全测试

- **任务**：身份与多租户安全验证
- **输入**：D39 身份多租户、D45.17
- **输出**：
  - IDOR/角色/属性/关系组合/跨租户推测/缓存/分享/SCIM/撤权/break-glass 测试
  - Token 认证中间件（V0 差距①）实现 + 测试
- **验收**：跨租户隔离 100% 生效
- **优先级**：P0
- **依赖**：8.1

### 8.3 文件沙箱测试

- **任务**：文件上传安全测试
- **输入**：D45.17 File/Sandbox
- **输出**：
  - polyglot/zip bomb/path traversal/macro/script/parser crash/资源耗尽/CDR bypass 测试
  - 文件类型白名单 + 服务端 MIME + 文件头魔数二次校验
- **验收**：恶意文件零绕过
- **优先级**：P0
- **依赖**：8.1

### 8.4 API/Egress 安全测试

- **任务**：API 出口安全
- **输入**：D45.17 API/Egress
- **输出**：
  - injection/SSRF/redirect/DNS rebinding/request smuggling/rate/size/replay/webhook forgery 测试
- **验收**：OWASP Top 10 全覆盖
- **优先级**：P0
- **依赖**：8.1

### 8.5 供应链安全

- **任务**：SCA + SBOM + 签名/provenance
- **输入**：D45.17 Supply Chain、CI 安全门禁
- **输出**：
  - SAST（Semgrep）/SCA（npm audit/pip-audit/mvn dependency-check）/license/secret（gitleaks/trufflehog）/IaC/image/model/SBOM/signature/provenance
  - dependency confusion 检查
  - Trivy 容器镜像扫描
- **验收**：CVSS ≥ 7.0 阻断 CI 合并
- **优先级**：P0
- **依赖**：8.1

### 8.6 DAST/IAST 渗透测试

- **任务**：动态安全测试
- **输入**：D45.17 Runtime
- **输出**：
  - OWASP ZAP/Nuclei/Burp 专业测试
  - 渗透测试 Rules of Engagement
  - 业务逻辑/组合攻击/社会工程边界/专业成果篡改/证据链破坏 人工红队
- **验收**：Critical/High 发现发布前关闭并独立复测
- **优先级**：P1
- **依赖**：8.1

### 8.7 隐私权利验证

- **任务**：GDPR/CCPA 用户权利
- **输入**：D40 安全隐私、D45.17 Privacy
- **输出**：
  - Inventory/目的/最小化
  - DSAR（访问/更正/删除/限制/可携带/反对）
  - 删除/保留传播可验证
  - 日志/Telemetry 脱敏
  - 跨境/Provider 条款
  - 重识别测试
- **验收**：8 项用户权利全部可执行
- **优先级**：P1
- **依赖**：8.1

---

## 十、板块九：性能、容量与成本测试（P0 — 必做基础）

### 9.1 性能测试基础设施

- **任务**：搭建 k6 + Prometheus + Grafana 性能测试平台
- **输入**：D42 容量模型、D45.18
- **输出**：
  - `tests/performance/k6/*.js` 性能脚本
  - Grafana Dashboard 模板
  - workload model/生成器位置/资源/版本/warm-up 配置
- **验收**：可生成 P50/P95/max 分位数报告
- **优先级**：P0
- **依赖**：1.1

### 9.2 Baseline 与 Load 测试

- **任务**：建立基线 + 负载测试
- **输入**：D42 Journey/Resource/Cell 包络
- **输出**：
  - Baseline: 单组件/旅程固定资源版本对比
  - Load: P50/P95 业务并发/文件模型尺寸/队列/Provider 配额满足 SLO
- **验收**：SLO 达标
- **优先级**：P0
- **依赖**：9.1

### 9.3 Stress 与 Spike 测试

- **任务**：压力与突发测试
- **输入**：D45.18
- **输出**：
  - Stress: 找到吞吐拐点/过载保护/恢复
  - Spike: 登录/上传/发布/AI 突发时限流/队列/优先级有效
- **验收**：过载保护生效
- **优先级**：P0
- **依赖**：9.1

### 9.4 Soak 测试

- **任务**：长稳测试
- **输入**：D45.18
- **输出**：8/24/72h 按风险发现连接/内存/临时盘/句柄/许可证泄漏/成本漂移
- **验收**：长稳无泄漏
- **优先级**：P1
- **依赖**：9.1

### 9.5 Scalability 与 Volume 测试

- **任务**：扩缩容与规模测试
- **输入**：D45.18
- **输出**：
  - HPA/KEDA/node/GPU/Windows warm pool 扩缩斜率/冷启动/稳定窗口
  - 最大项目/对象/版本/Event/审计/搜索/向量/备份/恢复规模
- **验收**：扩缩容稳定
- **优先级**：P1
- **依赖**：9.1

### 9.6 Degradation 与 Cost 测试

- **任务**：降级与成本测试
- **输入**：D45.18
- **输出**：
  - DB/Provider/网络/许可证变慢时 deadline/熔断/降级/队列边界
  - 每旅程/成果/AI accepted outcome/GPU hour/egress/DR 成本包络
- **验收**：降级路径生效，成本在包络内
- **优先级**：P1
- **依赖**：9.1

---

## 十一、板块十：可靠性、Chaos 与 DR 测试（P1）

### 10.1 Fault Injection 基础

- **任务**：搭建 Chaos Mesh + Toxiproxy
- **输入**：D45.19
- **输出**：
  - 从 dependency stub → 非生产 Pod/node → zone/Region 演练
  - blast radius/停止条件/观察项/回滚
- **验收**：故障注入可观察
- **优先级**：P1
- **依赖**：1.1

### 10.2 D44 故障矩阵覆盖

- **任务**：覆盖 D44 故障矩阵
- **输入**：D44 故障矩阵
- **输出**：
  - Pod/node/zone
  - PostgreSQL/Object/Kafka/Valkey/Search
  - IAM/OPA
  - KMS/Vault/TSA
  - Provider/GPU/Windows/Site/license
  - Telemetry/GitOps/Backup
- **验收**：每故障场景有恢复验证
- **优先级**：P1
- **依赖**：10.1

### 10.3 Backup Restore Test

- **任务**：备份恢复测试
- **输入**：D45.19
- **输出**：
  - 隔离目标 + 独立 KMS 恢复
  - 抽样 + 季度全链恢复
  - 不只校验备份文件存在
- **验收**：恢复后业务事实完整
- **优先级**：P1
- **依赖**：10.1

### 10.4 Region Failover/Failback

- **任务**：跨 Region 故障切换演练
- **输入**：D45.19
- **输出**：
  - 半年演练一次
  - last consistent point/fencing/Unknown operation/DNS/容量/用户沟通
- **验收**：RPO ≤ 4h，RTO ≤ 8h（对齐 OD-06）
- **优先级**：P2
- **依赖**：10.1

---

## 十二、板块十一：可观测性验收（P1）

### 11.1 Telemetry Contract Test

- **任务**：语义一致性校验
- **输入**：D43 可观测性、D45.20
- **输出**：
  - Semantic Registry 校验
  - 单位/低基数/禁止 user/tenant/project/file/prompt 进入 metric label
  - 故意断开 Collector/backend，确认盲区自身告警
- **验收**：telemetry contract 100% 通过
- **优先级**：P1
- **依赖**：1.1

### 11.2 Synthetic 监控

- **任务**：合成监控关键旅程
- **输入**：D45.20
- **输出**：
  - Trace/Baggage 清理
  - HTTP/gRPC/Event/Workflow/Worker/Provider Context 连续
  - RED/USE/Queue/AI/质量/成本指标
  - 结构化脱敏日志
  - tail sampling
  - Collector buffer/drop
  - Dashboard watermark
  - 多窗口 burn alert
- **验收**：关键旅程 Synthetic 通过
- **优先级**：P1
- **依赖**：11.1

### 11.3 告警与 Runbook

- **任务**：告警链路验证
- **输入**：D45.20
- **输出**：
  - Pager 去重/路由/ack/escalation
  - Runbook 定位
  - Incident 时间线
- **验收**：告警链路完整
- **优先级**：P1
- **依赖**：11.1

---

## 十三、板块十二：UAT/Pilot 准备（P1）

### 12.1 UAT 场景脚本

- **任务**：编写 UAT Scenario Script
- **输入**：D45.21 UAT、D02.6.1 V0 退出门禁
- **输出**：
  - 前置/输入→动作→期望业务/专业结果→人工判断点→证据→残余问题
  - 至少包含：建筑师/各专业工程师/BIM/CAD/校审审定/项目经理/外部协作者/平台运维/安全运维/可访问性用户 角色
- **验收**：UAT 脚本评审通过
- **优先级**：P1
- **依赖**：3.1

### 12.2 SC-01 境外主创方案深化 Pilot

- **任务**：首场景 Pilot 端到端验证
- **输入**：D02.6.1 V0、D45.21
- **输出**：验证 7 个子项
  1. 草图/PDF 摄取、尺度/坐标/需求澄清和版本基线
  2. 候选方案生成/比选、AI 局限和建筑师可编辑性
  3. Rhino/SketchUp/ArchiCAD/Revit/AutoCAD 实际启用工具往返损失
  4. 场地/气候/能耗等启用分析的假设、映射和结果证据
  5. 图纸/模型/PPT 发布集、需求追踪、校审签批和 Transmittal
  6. 多语言/单位/地区规范、外部协作、数据驻留和 Provider 条款
  7. 时间/返工/质量/成本对照基线，以及未覆盖专业/阶段的明确边界
- **验收**：至少一个真实或等价脱敏项目完成端到端闭环
- **优先级**：P1
- **依赖**：12.1

### 12.3 V0 退出门禁验证

- **任务**：验证 V0 退出门禁 5 项
- **输入**：D02.6.1 V0 退出门禁
- **输出**：
  1. 至少一个真实或等价脱敏项目完成端到端闭环
  2. OR-01–OR-16 均有系统路径或受控人工接力路径
  3. 发布资产证据完整率 M-10 达到 100%
  4. 严重问题逃逸率未高于人工基线
  5. 已验证至少一条 CAD/模型工具链和一个 AI Provider 的合法接入方式
- **验收**：5 项门禁全部通过
- **优先级**：P1
- **依赖**：12.2

---

## 十四、板块十三：缺陷治理与质量门禁（P0）

### 13.1 Finding/Defect 闭环

- **任务**：实现 Finding 全生命周期
- **输入**：D45.22 缺陷治理、D45.25 Finding API
- **输出**：
  - `FindingController` 实现
  - severity（Critical/High/Medium/Low）/category/repro/affected requirement/artifact/root state/owner/SLA/fix/verification
  - `POST /findings/{id}:retest`
  - 4 等级发布规则落实
- **验收**：Critical 必须修复并独立复测；High 默认阻断
- **优先级**：P0
- **依赖**：1.4

### 13.2 Flaky Case 治理

- **任务**：Flaky 隔离与替代
- **输入**：D45.22
- **输出**：
  - Flaky 检测机制（连续重复不稳定即隔离）
  - 对应 Requirement 变为 Coverage Gap
  - 保留替代确定性 TestCase 才可不阻断
  - 修复必须有最小回归样本和根因分类
- **验收**：Flaky Case 率 < 5%
- **优先级**：P0
- **依赖**：13.1

### 13.3 TestException 管理

- **任务**：风险接受与例外管理
- **输入**：D45.22、D45.25
- **输出**：
  - `TestExceptionController` 实现
  - scope/reason/risk/compensation/approvers/expiry/retest trigger/residual risk
  - Conditional Pass 到期自动撤销
  - 版本升级不自动继承
- **验收**：例外有签署 + 到期撤销
- **优先级**：P0
- **依赖**：13.1

### 13.4 质量门禁签署

- **任务**：6 级 Gate 落实
- **输入**：D45.23
- **输出**：
  - PR/Merge: static/unit/property/component + 覆盖/质量 + 安全快速扫描
  - Integration: contract/integration/migration + 关键 Golden smoke
  - Release Candidate: 全回归 + 专业金样 + AI TEVV + 安全/性能/可靠性 + 兼容
  - Preprod: 生产等价 E2E + 升级/回滚 + restore + canary + 运维演练
  - Pilot/UAT: 场景脚本 + 用户/专业结论 + 培训支持 + 残余风险
  - Production Promotion: Critical Verification Trace Coverage=100% + 签名 Bundle + Go/No-Go
- **验收**：每 Gate 签署角色落实，AI 不代签
- **优先级**：P0
- **依赖**：13.1

---

## 十五、板块十四：TEVV 平台界面与接口（P2）

### 14.1 Quality Cockpit 界面

- **任务**：实现质量驾驶舱
- **输入**：D45.24
- **输出**：`apps/web/src/app/(dashboard)/quality/` 页面
  - Release/Profile/Gate + coverage + pass/fail/blocked/inconclusive + risk + freshness
  - 下钻差距/阻断/Owner
- **验收**：不只显示总绿灯
- **优先级**：P2
- **依赖**：13.1

### 14.2 Trace Matrix 界面

- **任务**：双向追踪矩阵
- **输入**：D45.24
- **输出**：`apps/web/src/app/(dashboard)/quality/trace-matrix/` 页面
  - Requirement/Risk/Control↔Case↔Run/Evidence↔Finding↔Decision
  - 双向筛选/影响分析/孤儿检测/导出
- **验收**：无孤儿 Case
- **优先级**：P2
- **依赖**：14.1

### 14.3 Test Case Studio

- **任务**：测试用例工作室
- **输入**：D45.24
- **输出**：`apps/web/src/app/(dashboard)/quality/test-cases/` 页面
  - objective/steps/oracle/data/env/negative/boundary/version/reviewer
  - compare/approve/deprecate
  - 高风险变更双人复核
- **优先级**：P2
- **依赖**：14.1

### 14.4 测试接口实现

- **任务**：D45.25 接口实现
- **输入**：D45.25
- **输出**：
  - `GET/POST/PATCH /verification-items`
  - `GET/POST/PATCH /test-cases` + `POST /test-cases/{id}:approve`
  - `GET/POST /test-data-releases`
  - `GET/POST /test-plans` + `POST /test-runs`
  - `POST /test-runs/{id}/evidence` + `/complete`
  - `GET /trace-matrix` + `GET /coverage`
  - `GET/POST/PATCH /findings` + `POST /findings/{id}:retest`
  - `GET/POST/PATCH /test-exceptions` + `POST /test-exceptions/{id}:revoke`
  - `GET/POST /evaluation-runs` + `GET/evaluation-comparisons`
  - `GET/POST /acceptance-decisions` + `POST /acceptance-packages`
- **优先级**：P2
- **依赖**：14.1

### 14.5 测试事件契约

- **任务**：实现测试治理事件
- **输入**：D45.25
- **输出**：
  - `VerificationGapDetected` / `TestCaseApproved`
  - `TestRunStarted` / `TestRunCompleted` / `TestRunBlocked`
  - `GoldenDatasetReleased` / `GoldenDatasetRevoked` / `GoldenDatasetLeakageDetected`
  - `FindingOpened` / `FindingSeverityChanged` / `FindingVerified` / `FindingRegressed`
  - `EvaluationThresholdBreached` / `DriftReevaluationRequired`
  - `AcceptanceRequested` / `AcceptanceGranted` / `AcceptanceRejected` / `AcceptanceExpired`
- **优先级**：P2
- **依赖**：14.4

---

## 十六、板块十五：质量指标与覆盖报告（P1）

### 15.1 17 项质量指标实现

- **任务**：实现 D45.27 质量指标
- **输入**：D45.27
- **输出**：
  - Requirement/Risk Coverage（按 criticality）
  - Trace Orphan Rate
  - Evidence Freshness
  - First-pass/Regression
  - Defect Escape
  - Flaky/Blocked/Inconclusive
  - Test Duration/Feedback
  - Golden Slice Coverage
  - AI Quality/Calibration
  - Human Review Quality
  - Contract Compatibility
  - Security Verification
  - Accessibility
  - Performance/Capacity
  - Resilience/Recovery
  - Environment Fidelity
  - UAT/Pilot
  - Test Cost/Efficiency
- **验收**：指标自动采集与展示
- **优先级**：P1
- **依赖**：14.1

### 15.2 双向追踪与覆盖门禁

- **任务**：追踪门禁落实
- **输入**：D45.4
- **输出**：
  - Critical: 100% requirement/control execution + pass，无例外
  - High: 100% 执行，例外需风险 Owner + 专业/安全责任人 + 有期限
  - Medium/Low: 按变更影响抽样，但核心旅程和回归集不得抽掉
- **验收**：门禁阻断生效
- **优先级**：P1
- **依赖**：15.1

---

## 十七、板块十六：当前 V0 差距闭环（P0）

### 16.1 Token 认证中间件

- **任务**：实现 Bearer Token 认证流程
- **输入**：A-63 V0 差距记录②
- **输出**：
  - 解析 Authorization: Bearer 头
  - 查询 tokenHash
  - 校验 status=active + 未过期
  - 更新 last_used_at
  - 注入 SecurityContext
- **验收**：API Token 可用于 Bearer 认证
- **优先级**：P0
- **依赖**：无

### 16.2 远程 E2E 验证

- **任务**：远程环境端到端验证
- **输入**：A-64 V0 差距记录①
- **输出**：
  - 远程服务启动
  - 30 分钟稳定性观察
  - 调度任务每 1 小时执行确认
- **验收**：远程环境稳定运行
- **优先级**：P0
- **依赖**：1.1

### 16.3 ShedLock 多实例调度

- **任务**：多实例部署分布式锁
- **输入**：A-64 V0 差距记录⑤
- **输出**：
  - ShedLock 依赖引入
  - @SchedulerLock 注解
  - 分布式锁配置
- **验收**：多实例不重复调度
- **优先级**：P1
- **依赖**：无

### 16.4 合规规则种子数据

- **任务**：导入企业基础规则集
- **输入**：D21 规则合规检查
- **输出**：
  - V25 迁移：基础规则集种子数据
  - 至少 10 条 Critical 规则 + Pass/Fail/边界样本
- **验收**：合规检查页面非空状态
- **优先级**：P1
- **依赖**：无

---

## 十八、优先级与依赖关系总览

### 18.1 P0 任务（必做，SIT 基础）

- 板块一：测试基础设施（4 项）
- 板块二：契约测试（4 项）
- 板块三：E2E/Journey 测试（3 项）
- 板块八：安全验证（5 项 P0）
- 板块九：性能测试（3 项 P0）
- 板块十三：缺陷治理（4 项）
- 板块十六：V0 差距闭环（2 项 P0）

**P0 任务合计：约 27 项**

### 18.2 P1 任务（重要，SIT 完整能力）

- 板块四：UI 可访问性（3 项）
- 板块五：GoldenDatasetRelease（9 项）
- 板块六：多工具往返（5 项）
- 板块七：AI TEVV（3 项 P1）
- 板块八：安全验证（2 项 P1）
- 板块九：性能测试（3 项 P1）
- 板块十：可靠性 Chaos（4 项）
- 板块十一：可观测性（3 项）
- 板块十二：UAT/Pilot（3 项）
- 板块十五：质量指标（2 项）
- 板块十六：V0 差距闭环（2 项 P1）

**P1 任务合计：约 39 项**

### 18.3 P2 任务（增强，TEVV 平台完整化）

- 板块六：GIS/Analysis 集成（1 项）
- 板块七：AI 漂移监测（1 项）
- 板块十：Region Failover（1 项）
- 板块十四：TEVV 平台界面与接口（5 项）

**P2 任务合计：约 8 项**

### 18.4 依赖关系图

```
P0 基础设施（板块一）
├── 契约测试（板块二）
├── E2E 测试（板块三）
│   ├── UI 可访问性（板块四）
│   └── UAT/Pilot（板块十二）
├── 安全验证（板块八）
├── 性能测试（板块九）
├── Chaos（板块十）
└── 可观测性（板块十一）

P1 数据基础
├── GoldenDatasetRelease（板块五）
│   ├── 多工具往返（板块六）
│   └── AI TEVV（板块七）
└── 质量指标（板块十五）

P0 缺陷治理（板块十三）
└── TEVV 平台界面（板块十四 P2）

V0 差距闭环（板块十六）
├── Token 认证中间件（P0）
├── 远程 E2E（P0）
├── ShedLock（P1）
└── 合规规则种子（P1）
```

---

## 十九、建议执行顺序

### 阶段一：SIT 基础设施（2-3 周）

1. 完成板块一（测试环境分级、数据隔离、Pact Broker、证据存储）
2. 完成板块十六 P0 项（Token 认证中间件、远程 E2E）
3. 启动板块二（契约测试，按域分批）

### 阶段二：SIT 核心能力（3-4 周）

1. 完成板块三（E2E/Journey）
2. 完成板块八 P0（ASVS/IAM/File/API/Supply Chain）
3. 完成板块九 P0（性能基线 + Load + Stress/Spike）
4. 完成板块十三 P0（Finding 闭环 + Flaky + Exception + Gate）

### 阶段三：专业能力（4-6 周）

1. 完成板块五（GoldenDatasetRelease 8 类数据集）
2. 完成板块六（多工具往返，按工具对分批）
3. 完成板块七（AI TEVV）
4. 完成板块十二（UAT Pilot）

### 阶段四：完整化（按需推进）

1. 完成板块四（UI 可访问性）
2. 完成板块十（Chaos + DR）
3. 完成板块十一（可观测性）
4. 完成板块十五（质量指标）
5. 完成板块十四（TEVV 平台界面 P2）

---

## 二十、V0 退出门禁对照（D02.6.1）

| 门禁项                                                           | 当前状态                             | 补齐任务                      |
| ---------------------------------------------------------------- | ------------------------------------ | ----------------------------- |
| ① 至少一个真实或等价脱敏项目完成端到端闭环                       | ⚠️ 需远程 E2E 验证                   | 板块十六 16.2 + 板块十二 12.2 |
| ② OR-01–OR-16 均有系统路径或受控人工接力路径                     | ⚠️ 待核对                            | 板块十二 12.1                 |
| ③ 发布资产证据完整率 M-10 达到 100%                              | ❌ 未实现                            | 板块一 1.4 + 板块十三 13.1    |
| ④ 严重问题逃逸率未高于人工基线                                   | ❌ 未度量                            | 板块十三 13.1 + 板块十五 15.1 |
| ⑤ 已验证至少一条 CAD/模型工具链和一个 AI Provider 的合法接入方式 | ⚠️ AI Provider ✅，CAD/模型工具链 ❌ | 板块六 6.2/6.3/6.4            |

---

**文档版本**：V1.0
**最后更新**：2026-08-01
**维护者**：开发团队
**配套文件**：`docs/SIT-TASK-TRACKER.md`（任务跟踪列表，用于逐步勾选实施进度）
