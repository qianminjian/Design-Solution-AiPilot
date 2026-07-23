# R2 阶段完成报告

> 报告元数据：生成时间 2026-07-23 · 项目阶段 条件性设计基线 → R2 主体完成 · 作者 平台架构组 · 状态 🟡 部分完成（W4–W8 待启动）

## 1. 概述

R2 阶段（技术基线实例化）从 R1 业务决策冻结（2026-07-22）开始启动，目标是把 D00–D46 抽象设计
细化为可指导采购、网络、IaC 编写、CI/CD 配置的具体参数与契约，输出三份核心派生材料：

- **Support Matrix**（`@design/r2-support-matrix/r2-support-matrix.html`）— 5 类工具 10 版本资格矩阵。
- **Contract Catalog**（`@design/r2-contract-catalog/r2-contract-catalog.html`）— 48 个稳定契约 ID 分配。
- **Deployment Profile**（`@design/r2-deployment-profile/r2-deployment-profile.html`）— OD-06 Hybrid-Site 实例化。

在 R2 主体推进的同时，代码骨架同步完成：**4 个服务全部可运行 + 单元测试全通过 + TypeScript 类型检查通过 + Lint 零警告**。
但仍存在三方面缺口：

1. 集成测试待 Docker 启动本地 PostgreSQL 后验证（TestContainers）。
2. GoldenDataset 未建立（R3 启动，W5–W10）。
3. DR 桌面演练未做（R2-W8 计划）。

## 2. 完成项清单

### 2.1 Java 核心服务（services/core，Spring Boot 3.4）

| 指标            | 数量 / 状态                                        |
| --------------- | -------------------------------------------------- |
| 业务模块        | 6（auth / iam / portfolio / cde / workflow / compliance） |
| Controller      | 15（含 OpenAPI 注解）                              |
| Service         | 16（核心业务逻辑）                                 |
| Repository      | 17（Spring Data JPA）                              |
| 域模型 Entity   | 14（含审计字段）                                   |
| DTO             | 35+（含 Record 不可变 DTO）                        |
| Flyway 迁移脚本 | 7（V1–V7，覆盖 IAM、Portfolio、CDE、Workflow、Compliance、Outbox） |
| 单元测试        | 89 用例 🟢 全通过                                  |
| 集成测试        | 14 用例（TestContainers，🟡 待 Docker 环境）        |
| 关键修复        | IdsParser / IdsRuleConverter / AuthServiceTest / DocumentServiceTest / VersionServiceTest（Java 25 Mockito 兼容性） |

### 2.2 BFF 代理层（apps/bff，NestJS 11）

| 指标            | 数量 / 状态                                        |
| --------------- | -------------------------------------------------- |
| 端点            | 6 域（auth / core / ai-capability / ai-prompt / health / debug） |
| Proxy Controller | 5（Core / Auth / AI Capability / AI Prompt / 通用） |
| Middleware      | 3（Logging / TraceId / Proxy Interceptor）         |
| Filter          | 2（HttpException / GlobalException）               |
| 单元测试        | 80 用例 🟢 全通过（Vitest）                        |
| 集成测试        | 20 用例 🟢 全通过（MSW）                           |
| 测试合计        | **100 用例** 🟢 全通过                             |
| Mock 模式       | MSW（拦截真实 HTTP 调用，零网络依赖）             |

### 2.3 Python AI 服务（services/ai，FastAPI）

| 指标            | 数量 / 状态                                        |
| --------------- | -------------------------------------------------- |
| 能力域          | 4（text-generation / vision / embeddings / rag-query） |
| Prompt 模板     | 5（design_system / role-specific / safety / output-format） |
| LLM Client      | 1（OpenAI 兼容 + Mock 双模式）                     |
| RAG 组件        | 3（embedding / vector_store / retrieval_chain）    |
| 单元 + 集成测试 | 53 用例 🟢 全通过（pytest + pytest-asyncio）       |
| Mock 模式       | 依赖注入 + AsyncMock（无真实付费 API 调用）        |
| 健康检查        | `/health/live` + `/health/ready` + LLM 探测 3s 超时 |

### 2.4 前端页面（apps/web，Next.js 15 + Ant Design 5）

| 指标            | 数量 / 状态                                        |
| --------------- | -------------------------------------------------- |
| 页面            | 12（含 dashboard / projects / documents / members / review / stage-gate 等） |
| 业务组件        | 18（含 CDE / Project / Review / Auth / Layout）   |
| Hook            | 7（use-auth / use-projects / use-documents 等）    |
| 路由            | App Router（Route Groups：auth / dashboard）       |
| TypeScript 检查 | 🟢 通过（strict + 7 项严格模式全开）               |
| E2E（Playwright）| 2（auth-login / projects-list）🟡 CI 中执行        |

### 2.5 DevOps

| 指标            | 状态 / 说明                                        |
| --------------- | -------------------------------------------------- |
| GitHub Actions  | 5 Job（java-core / python-ai / node-workspace / build-images / playwright-e2e） |
| Docker Compose  | V0 全栈（postgres + minio + core + ai + bff + web） |
| Docker 镜像     | 4 服务 Dockerfile（多阶段构建 + 非 root 用户）     |
| Husky + lint-staged | pre-commit Prettier / commit-msg commitlint     |
| Conventional Commits | 提交信息格式规范（commitlint.config.js）     |

## 3. 修复的测试失败（R2 关键转折）

| 文件                          | 问题                                          | 修复方案                                              |
| ----------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| `IdsParserTest`               | IDS XML 解析边界（空值 / 非法根元素 / 版本属性）| 补全 5 个边界用例 + 多规则/继承属性解析              |
| `IdsRuleConverterTest`        | IDS 转 ComplianceRule 映射在 min/max 缺失时 NPE | 补全防御性默认值与 null-safe 转换逻辑                |
| `AuthServiceTest`             | Java 25 下 Mockito 无法 mock `Authentication`  | 用匿名内部类替代 Mockito mock（手动 `setupAuthenticatedPrincipal`）|
| `DocumentServiceTest`         | Tenant 上下文解析与文件大小校验边界            | 补全 Multipart 上传边界 + tenant 隔离测试             |
| `VersionServiceTest`          | 版本号生成并发安全与 IFS 散列冲突              | 增加序列号并发测试 + 散列锁                          |

> 5 处修复整体上把 Java 25 + Mockito 的兼容问题（`Cannot mock final class`）收敛到单一解决模式。

## 4. 技术债务与遗留项

| 编号 | 描述                                                          | 影响等级 | 责任方     | 计划完成 |
| ---- | ------------------------------------------------------------- | -------- | ---------- | -------- |
| TD-01 | Java 25 + Mockito 对 `final` 类 mock 仍需手工绕开              | 中       | 后端架构组 | R3 引入 ByteBuddy 或迁移 mockito-inline |
| TD-02 | 集成测试（TestContainers）待 CI 上 Docker 环境验证            | 中       | DevEx 组   | R3-W1    |
| TD-03 | E2E（Playwright）用例数 2，覆盖率不足 30%                     | 中       | 前端组     | R3-W2 补至 8 用例 |
| TD-04 | Region 厂商（AWS / Azure / GCP）未冻结，ClusterProfile 待实例化 | 高     | 架构组     | R2-W4    |
| TD-05 | WorkerImageProfile 金样 hash 待 W5 ExchangeRoundTripSample    | 高       | 桌面组     | R2-W5    |
| TD-06 | DR 桌面演练未做，DRProfile 实际 RPO/RTO 待校准                | 高       | SRE 组     | R2-W8    |
| TD-07 | 30 个 API Operation 仅完成 6 域首切片，剩余 7 域待分配          | 中       | 架构组     | R2-W6    |

## 5. 下一步计划

### 5.1 R2 收尾（W4–W8）

| 周次 | 任务                            | 负责人       | 出口准则                       |
| ---- | ------------------------------- | ------------ | ------------------------------ |
| W4   | Region 厂商冻结（AWS / Azure）  | 架构组 + SRE | ClusterProfile 全量填充        |
| W5   | WorkerImageProfile 金样 hash    | 桌面组       | 5 类工具 × 2 版本 = 10 hash    |
| W6   | 首客户 Site Discovery            | SRE + 售前   | SiteProfile 签字 + 差距清单    |
| W7   | 15 项 Critical Runbook 冻结     | SRE          | Runbook Catalog 100% Owner     |
| W8   | 首次 Cell/Region DR 桌面演练    | SRE + 架构组 | 校准 RPO/RTO 实测值            |

### 5.2 R3 GoldenDataset（W5–W10）

- 建立 ≥ 30 个建筑专业人工标注的输入输出（Golden Set）。
- 每次发现 Bug 加入 Regression Set。
- CI 自动跑 Golden Set 评估，新版 prompt/模型必须不回归。

### 5.3 R4 Gate 准入（W9–W12）

- Gate 1–6 全部满足（当前 2/6 已满足，4/6 部分满足）。
- Pre-Implementation Start Gate 准入门禁。
- Pilot 客户接入与上线演练。

## 6. 风险评估

| 风险                                                       | 等级 | 缓解                                                                 |
| ---------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| Region 厂商冻结延迟（W4 未完成）                          | 🟡 中 | 并行评估 AWS / Azure 2 家，预留 GCP 备选                            |
| 工具版本资格验证（W4–W7）需采购许可证                      | 🟡 中 | 用免费 Trial 许可证先跑 ExchangeRoundTripSample                       |
| DR 桌面演练（W8）涉及客户站点，准备周期长                  | 🟡 中 | 先做内网 Cell 演练，W10 再做跨 Region 演练                          |
| Java 25 兼容性问题扩散至更多 `final` 类 mock               | 🟢 低 | 已收敛至单一模式，TD-01 跟踪                                        |
| 集成测试 CI 启动慢（TestContainers 拉镜像）                | 🟢 低 | 缓存镜像 + 并发执行 Job                                              |
| E2E 覆盖率不足                                             | 🟡 中 | TD-03 R3-W2 补至 8 用例                                              |

## 7. 经验教训

1. **设计 → 代码的引用约定要尽早统一**。本次 R2 推进中，3 处冲突（OD-01/OD-06 推荐值 vs 冻结值）通过追加"R1 冻结状态列"和交叉引用解决。后续 R3 启动前，应固化"派生材料必须包含与唯一设计正文的引用对照"为铁律。
2. **Java 25 + Mockito 不兼容是隐性技术债**。5 个测试文件需要手工绕开 `final` 类 mock，是 V1 才暴露的问题。建议在 V2 启动前完成 mockito-inline / ByteBuddy 切换。
3. **多服务测试金字塔要分层清晰**。本次 BFF 用 80 单测 + 20 集成（100 总）覆盖代理 + 鉴权 + 追踪链路，密度合理；AI 服务用 53 测覆盖 4 能力 + 异常路径，比例与 backend-python 规则一致。
4. **支持 Mock 优先于打桩**。LLM 调用统一通过 `app.dependency_overrides` / `vi.mock` 注入，CI 扫描禁止真实付费 API URL 出现，避免烧钱 + 测试不收敛。
5. **Hybrid-Site 的复杂度被低估**。OD-06 实例化为 Deployment Profile 时，发现 Region/Cell/Cluster 三层 × Worker/Connector/HPC/Desktop 四类组件 + 9 信任区 + 13 关键流量 = 数十个参数，单纯一份文档难以覆盖全，建议 R3 引入 IaC 模板（Terraform / Pulumi）。

## 8. 引用文件

- [`@design/BEACON.md`](../../design/BEACON.md) — 设计明灯（决策 10–16）
- [`@design/r2-support-matrix/`](../../design/r2-support-matrix/) — Support Matrix 冻结
- [`@design/r2-contract-catalog/`](../../design/r2-contract-catalog/) — Contract Catalog 分配
- [`@design/r2-deployment-profile/`](../../design/r2-deployment-profile/) — DeploymentProfile 实例化
- [`@design/D35-API-事件契约.md`](../../design/D35-API-事件契约.md) — API 契约权威
- [`@design/D44-部署网络-环境拓扑.md`](../../design/D44-部署网络-环境拓扑.md) — 部署设计权威
- [`@design/D45-测试-验收体系.md`](../../design/D45-测试-验收体系.md) — 测试体系权威
- [`.trae/rules/testing.md`](../../.trae/rules/testing.md) — 多语言测试规范
- [`.trae/rules/security.md`](../../.trae/rules/security.md) — AI 安全红线

## 9. 报告状态

🟡 **R2 主体完成，W4–W8 收尾中**。Gate 4（契约）由"部分满足"推进至"已分配待 Consumer Test"，Gate 5（部署）由"未满足"推进至"部分满足"。下一步：W4 启动 Region 厂商评估。
