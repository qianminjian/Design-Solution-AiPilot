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
