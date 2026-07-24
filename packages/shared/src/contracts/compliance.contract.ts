/**
 * 合规规则引擎域 API 契约
 *
 * 规则管理：CRUD + 修订历史 + 激活 + IDS 导入
 * 检查运行：创建 + 执行 + 查询 + 结果列表
 *
 * 权威源：@design/D23-规范合规化与检查.md + @design/D24-智能合规引擎.md
 */

// ── API 端点定义 ──

export const ComplianceApiPaths = {
  // 规则管理
  rules: "/api/v1/compliance-rules",
  ruleDetail: (id: string) => `/api/v1/compliance-rules/${id}`,
  ruleRevisions: (id: string) => `/api/v1/compliance-rules/${id}/revisions`,
  activateRevision: (revisionId: string) =>
    `/api/v1/compliance-rules/revisions/${revisionId}/activate`,
  revisionDetail: (revisionId: string) =>
    `/api/v1/compliance-rules/revisions/${revisionId}`,
  importIds: "/api/v1/compliance-rules/import-ids",

  // 检查运行
  checkRuns: "/api/v1/compliance-checks",
  executeCheckRun: (id: string) => `/api/v1/compliance-checks/${id}/execute`,
  checkRunDetail: (id: string) => `/api/v1/compliance-checks/${id}`,
  checkResults: (executionId: string) =>
    `/api/v1/compliance-checks/executions/${executionId}/results`,
} as const;

// ── DTO ──

/** 合规规则 */
export interface ComplianceRuleDto {
  id: string;
  tenantId: string;
  ruleCode: string;
  name: string;
  category: string;
  owner?: string | null;
  status: string;
  description?: string | null;
  basis?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  rowVersion: number;
}

/** 规则修订 */
export interface RuleRevisionDto {
  id: string;
  tenantId: string;
  ruleId: string;
  revisionNo: number;
  dslJson?: string | null;
  parametersJson?: string | null;
  basis?: string | null;
  engineProfile?: string | null;
  status: string;
  createdAt: string;
  createdBy?: string | null;
  rowVersion: number;
}

/** 规则执行统计 */
export interface RuleExecutionDto {
  id: string;
  tenantId: string;
  runId: string;
  revisionId: string;
  applicabilityCount: number;
  passCount: number;
  failCount: number;
  notApplicableCount: number;
  indeterminateCount: number;
  errorCount: number;
  manualReviewCount: number;
  status: string;
  durationMs?: number | null;
  logs?: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

/** 合规检查运行 */
export interface ComplianceCheckRunDto {
  id: string;
  tenantId: string;
  projectId?: string | null;
  ruleSetId?: string | null;
  status: string;
  outcomeSummary?: string | null;
  executions?: RuleExecutionDto[];
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  rowVersion: number;
}

/** 检查结果（单条） */
export interface CheckResultDto {
  id: string;
  tenantId: string;
  executionId: string;
  objectId?: string | null;
  objectType?: string | null;
  /**
   * 校验结论，严格状态分离（project_memory 强制要求）：
   * - PASS：通过
   * - FAIL：未通过
   * - NOT_APPLICABLE：不适用
   * - INDETERMINATE：无法判定
   * - ERROR：执行异常
   * - MANUAL_REVIEW：需人工复核
   */
  outcome:
    | "PASS"
    | "FAIL"
    | "NOT_APPLICABLE"
    | "INDETERMINATE"
    | "ERROR"
    | "MANUAL_REVIEW";
  measuredValue?: string | null;
  threshold?: string | null;
  explanation?: string | null;
  evidenceJson?: string | null;
  createdAt: string;
  createdBy?: string | null;
  rowVersion: number;
}

/** 创建规则请求 */
export interface CreateRuleRequest {
  ruleCode: string;
  name: string;
  category: string;
  owner?: string;
  description?: string;
  basis?: Record<string, unknown>;
}

/** 创建检查运行请求 */
export interface CreateCheckRunRequest {
  ruleSetId: string;
  projectId?: string;
  parameters?: Record<string, unknown>;
  idempotencyKey?: string;
}

/** 创建规则修订请求 */
export interface CreateRuleRevisionRequest {
  dslJson?: string;
  parametersJson?: string;
  basis?: string;
  engineProfile?: string;
}

/** IDS 导入请求 */
export interface IdsImportRequest {
  xmlContent: string;
}

/** IDS 导入响应 */
export interface IdsImportResponse {
  importedCount: number;
  failedCount: number;
  errors: string[];
}

// ── 枚举与展示工具 ──

/** 检查结果状态显示名 */
export const OUTCOME_LABEL: Record<CheckResultDto["outcome"], string> = {
  PASS: "通过",
  FAIL: "未通过",
  NOT_APPLICABLE: "不适用",
  INDETERMINATE: "无法判定",
  ERROR: "执行异常",
  MANUAL_REVIEW: "需人工复核",
};

/** 检查结果状态颜色 */
export const OUTCOME_TAG_COLOR: Record<CheckResultDto["outcome"], string> = {
  PASS: "success",
  FAIL: "error",
  NOT_APPLICABLE: "default",
  INDETERMINATE: "warning",
  ERROR: "error",
  MANUAL_REVIEW: "warning",
};

/** 规则状态显示名 */
export const RULE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  ACTIVE: "已启用",
  DEPRECATED: "已弃用",
  ARCHIVED: "已归档",
};

/** 规则状态颜色 */
export const RULE_STATUS_TAG_COLOR: Record<string, string> = {
  DRAFT: "default",
  ACTIVE: "success",
  DEPRECATED: "warning",
  ARCHIVED: "default",
};

/** 检查运行状态显示名 */
export const CHECK_RUN_STATUS_LABEL: Record<string, string> = {
  PENDING: "待执行",
  RUNNING: "执行中",
  COMPLETED: "已完成",
  FAILED: "失败",
  CANCELLED: "已取消",
};

/** 检查运行状态颜色 */
export const CHECK_RUN_STATUS_TAG_COLOR: Record<string, string> = {
  PENDING: "default",
  RUNNING: "processing",
  COMPLETED: "success",
  FAILED: "error",
  CANCELLED: "default",
};
