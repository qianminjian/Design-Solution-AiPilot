/**
 * @design-platform/shared — 全平台共享类型与常量
 *
 * 权威源：
 * - @design/D35-API-事件契约.md（API/事件契约）
 * - @design/D34-数据-数据库.md（数据模型）
 * - @design/D39-身份多租户-授权.md（IAM 域）
 * - @design/D05-全流程阶段-阶段门.md（Portfolio 域）
 *
 * 前端/BFF/后端通过此包共享 DTO 与错误码，确保类型一致
 */

// ── 统一响应格式 ──
export type {
  ApiResponse,
  ApiErrorResponse,
  FieldError,
  OffsetPageRequest,
  OffsetPageResponse,
  CursorPageRequest,
  CursorPageResponse,
} from "./api-response";
export { BIZ_CODE, isSuccess } from "./api-response";

// ── 错误码 ──
export {
  ErrorCode,
  ERROR_HTTP_STATUS,
  isRetryable,
  HttpHeader,
} from "./error-codes";
export type {
  ErrorCode as ErrorCodeType,
  HttpHeader as HttpHeaderType,
} from "./error-codes";

// ── CDE 信息容器状态（对齐 ISO 19650） ──
export type { CdeStatus } from "./enums";
export { ApiDomains } from "./enums";
export type { ApiDomain } from "./enums";

// ── IAM 契约 ──
export * from "./contracts/iam.contract";

// ── 认证契约 ──
export * from "./contracts/auth.contract";

// ── Portfolio 契约 ──
export * from "./contracts/portfolio.contract";

// ── Workflow 契约 ──
// 实体 DTO 与枚举从 portfolio 契约复用，workflow 契约补充特有 API 路径与查询请求
export * from "./contracts/workflow.contract";

// ── CDE 契约（V1 简化文档模型） ──
export * from "./contracts/cde.contract";

// ── AI 能力契约（V0 OpenAI 兼容 Provider） ──
export * from "./contracts/ai.contract";

// ── TEVV 契约（金样数据集 + Gate 准入验证） ──
export * from "./contracts/tevv.contract";

// ── Design 契约（设计选项 + 反馈） ──
export * from "./contracts/design.contract";

// ── Solutions 契约（方案生成） ──
export * from "./contracts/solutions.contract";

// ── AI 生成记录契约（审计追溯） ──
export * from "./contracts/ai-generation-record.contract";

// ── 合规规则引擎契约 ──
export * from "./contracts/compliance.contract";

// ── 需求与追踪矩阵契约（V0 前端骨架，后端 API 待 V1 实现） ──
export * from "./contracts/requirement.contract";

// ── 工程分析契约（V0 前端骨架，后端 API 待 V1 实现） ──
export * from "./contracts/analysis.contract";

// ── 工作项聚合契约（D37.5 P01 我的工作，V0 前端骨架，后端 API 待 V1 实现） ──
export * from "./contracts/work-item.contract";

// ── Coordination 域契约（D37.11 P07 协调、碰撞与 Issue 工作台，V0 前端骨架） ──
export * from "./contracts/coordination.contract";

// ── AI Review 域契约（D37.13 P09 AI/Agent 复核中心，V0 前端骨架，后端 API 待 V1 实现） ──
export * from "./contracts/ai-review.contract";

// ── Publication 域契约（D37.15 P11 专业提交、校审与发布向导，V0 前端骨架，后端 API 待 V1 实现） ──
export * from "./contracts/publication.contract";

// ── Change 域契约（D37.16 P12 变更影响与闭环工作台，V0 前端骨架，后端 API 待 V1 实现） ──
export * from "./contracts/change.contract";

// ── Monitoring & Operations 域契约（D37.17 运营中心，V0 前端骨架，后端 API 待 V1 实现） ──
export * from "./contracts/monitoring.contract";

// ── Deployment Profile 契约（P0-1.1 测试环境分级，对齐 D44.5）──
// 6 级环境元数据 + docker compose override 文件映射 + CI 流水线决策辅助
// 用于：CI 流水线选择 compose 文件、D45 验收报告按环境分组、Support Matrix 差异记录
export * from "./contracts/deployment.contract";

// ── Pact 契约测试基础设施（P0-1.3，对齐 D45.11）──
// V1 策略：用 zod schema + Consumer 期望声明实现软验证，BFF/前端调用
// validateResponse 验证响应，失败计数到 monitoring schemaValidation。
// V2 演进：基于 ConsumerExpectation 元数据自动生成 Pact V3 契约文件并 push 到 Broker。
export * from "./contracts/pact";

// ── Zod Schema（契约测试基础设施，P1-2）──
// V1 策略：用 zod 共享 schema 替代完整 Pact Broker，后续 V2 可基于
// schema 自动生成 Pact 契约文件并接入 Pact Broker。
// 用途：BFF 代理层验证响应、前端运行时验证、Core Service 单元测试
export * from "./schemas/auth.schema";
export * from "./schemas/iam.schema";
export * from "./schemas/portfolio.schema";
export * from "./schemas/workflow.schema";
export * from "./schemas/cde.schema";
export * from "./schemas/ai.schema";
export * from "./schemas/tevv.schema";
export * from "./schemas/design.schema";
export * from "./schemas/solutions.schema";
export * from "./schemas/ai-generation-record.schema";
export * from "./schemas/compliance.schema";
export * from "./schemas/review.schema";
export * from "./schemas/monitoring.schema";

// ── Governance 域 Schema（治理中心：Access Review / AI Release /
//   Data Governance / Audit / Backup-Restore，D37.17）──
// V1 策略：从 BFF 透传模式升级为软验证模式，BFF 调用 schema.safeParse
// 校验响应；失败计数到 monitoring schemaValidation，不阻断用户访问。
export * from "./schemas/governance.schema";

// ── 测试运行 ID 工具（P0-1.2 测试数据隔离，对齐 D43 SLO 报表排除规则）──
// CI 流水线注入唯一标识，标记测试产生的审计日志/通知/计量数据，
// 使其在 SLO 报表自动排除或单独计量，避免污染业务指标。
// 多语言共享：TypeScript（BFF/前端）+ Java（Core）+ Python（AI）使用相同常量。
export * from "./testing/test-run-id";
