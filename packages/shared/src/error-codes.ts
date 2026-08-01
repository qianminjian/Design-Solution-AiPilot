/**
 * D35 稳定错误码定义
 * 权威源：@design/D35-API-事件契约.md §D35.9
 *
 * 规则：
 * - 错误码为字符串形式，机器可读，不本地化
 * - 与 HTTP 状态码一一对应
 * - 4xx 业务错误不重试；429/502/503/504 可重试
 */

/**
 * 稳定错误码枚举
 */
export const ErrorCode = {
  // ── 400 Bad Request ──
  /** 请求语法/Header/幂等键缺失 */
  REQUEST_INVALID: "REQUEST_INVALID",
  /** 缺少必需幂等键 */
  IDEMPOTENCY_KEY_REQUIRED: "IDEMPOTENCY_KEY_REQUIRED",

  // ── 401 Unauthorized ──
  /** 未认证或 Token 无效 */
  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",

  // ── 403 Forbidden ──
  /** 已认证但作用域/政策拒绝 */
  ACCESS_DENIED: "ACCESS_DENIED",
  /** 数据驻留策略拒绝（跨境） */
  DATA_RESIDENCY_DENIED: "DATA_RESIDENCY_DENIED",

  // ── 404 Not Found ──
  /** 资源不存在或按防枚举策略隐藏 */
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",

  // ── 409 Conflict ──
  /** 状态/依赖/锁/业务冲突 */
  STATE_CONFLICT: "STATE_CONFLICT",
  /** 基线未冻结 */
  BASELINE_NOT_FROZEN: "BASELINE_NOT_FROZEN",

  // ── 412 Precondition Failed ──
  /** ETag 不匹配（If-Match 失败） */
  REVISION_CONFLICT: "REVISION_CONFLICT",

  // ── 413 Payload Too Large ──
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",

  // ── 415 Unsupported Media Type ──
  FORMAT_UNSUPPORTED: "FORMAT_UNSUPPORTED",

  // ── 422 Unprocessable Entity ──
  /** 语义/字段错误 */
  VALIDATION_FAILED: "VALIDATION_FAILED",
  /** 同 Idempotency-Key 与不同请求指纹重用 */
  IDEMPOTENCY_KEY_REUSED: "IDEMPOTENCY_KEY_REUSED",

  // ── 428 Precondition Required ──
  /** 缺 If-Match 前置条件 */
  PRECONDITION_REQUIRED: "PRECONDITION_REQUIRED",

  // ── 429 Too Many Requests ──
  RATE_LIMITED: "RATE_LIMITED",
  BUDGET_EXHAUSTED: "BUDGET_EXHAUSTED",

  // ── 500 Internal Server Error ──
  INTERNAL_ERROR: "INTERNAL_ERROR",

  // ── 502/503/504 下游错误 ──
  DEPENDENCY_FAILED: "DEPENDENCY_FAILED",
  CAPABILITY_UNAVAILABLE: "CAPABILITY_UNAVAILABLE",
  DEADLINE_EXCEEDED: "DEADLINE_EXCEEDED",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * 错误码与 HTTP 状态码映射
 */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.REQUEST_INVALID]: 400,
  [ErrorCode.IDEMPOTENCY_KEY_REQUIRED]: 400,
  [ErrorCode.AUTHENTICATION_REQUIRED]: 401,
  [ErrorCode.ACCESS_DENIED]: 403,
  [ErrorCode.DATA_RESIDENCY_DENIED]: 403,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.STATE_CONFLICT]: 409,
  [ErrorCode.BASELINE_NOT_FROZEN]: 409,
  [ErrorCode.REVISION_CONFLICT]: 412,
  [ErrorCode.PAYLOAD_TOO_LARGE]: 413,
  [ErrorCode.FORMAT_UNSUPPORTED]: 415,
  [ErrorCode.VALIDATION_FAILED]: 422,
  [ErrorCode.IDEMPOTENCY_KEY_REUSED]: 422,
  [ErrorCode.PRECONDITION_REQUIRED]: 428,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.BUDGET_EXHAUSTED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DEPENDENCY_FAILED]: 502,
  [ErrorCode.CAPABILITY_UNAVAILABLE]: 503,
  [ErrorCode.DEADLINE_EXCEEDED]: 504,
};

/**
 * 判断错误是否可重试
 * 仅 429/502/503/504 可重试
 */
export function isRetryable(errorCode: ErrorCode): boolean {
  const status = ERROR_HTTP_STATUS[errorCode];
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * 通用 HTTP Header 常量
 * 权威源：D35.4
 */
export const HttpHeader = {
  /** W3C Trace Context */
  TRACEPARENT: "traceparent",
  TRACESTATE: "tracestate",
  /** 单次请求 UUIDv7 */
  X_REQUEST_ID: "x-request-id",
  /** traceId 传播（实现层兼容） */
  X_TRACE_ID: "x-trace-id",
  /** 租户 ID 路由提示 */
  X_TENANT_ID: "x-tenant-id",
  /** 用户 ID 路由提示（A-61 P0-1 修复：由 BFF 从 JWT 解析后强制注入，禁止客户端直接传入） */
  X_USER_ID: "x-user-id",
  /** 项目上下文提示 */
  X_PROJECT_ID: "x-project-id",
  /** 幂等键 */
  IDEMPOTENCY_KEY: "idempotency-key",
  /** 并发控制 */
  IF_MATCH: "if-match",
  ETAG: "etag",
  IF_NONE_MATCH: "if-none-match",
  /** 认证 */
  AUTHORIZATION: "authorization",
  /** 本地化 */
  ACCEPT_LANGUAGE: "accept-language",
  CONTENT_LANGUAGE: "content-language",
  /** 重试建议 */
  RETRY_AFTER: "retry-after",
  /**
   * 测试运行 ID（P0-1.2 测试数据隔离）
   *
   * 用途：CI 流水线注入唯一标识，标记测试产生的审计日志、通知、计量数据，
   * 使其在 SLO 报表自动排除或单独计量，避免污染业务指标。
   *
   * 取值：
   *  - 未设置或 "untracked"：未标记（生产或本地开发默认值）
   *  - UUID 或 `${github.run_id}-${github.run_attempt}` 格式：CI 流水线注入
   *
   * 权威源：@design/D43-SLO-运营报表.md §测试数据排除规则
   */
  X_TEST_RUN_ID: "x-test-run-id",
} as const;

export type HttpHeader = (typeof HttpHeader)[keyof typeof HttpHeader];
