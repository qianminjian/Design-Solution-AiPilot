/**
 * 合规规则引擎域 Zod Schema
 *
 * 权威源：@design/D23-规范合规化与检查.md + @design/D24-智能合规引擎.md
 * 对齐：packages/shared/src/contracts/compliance.contract.ts
 *
 * 用途：
 *  - BFF 代理层验证规则管理 CRUD 与检查运行 DTO 结构
 *  - 强制 CheckResultDto.outcome 严格状态分离（project_memory 要求）
 *  - 前端运行时验证规则创建/检查运行请求体
 *  - IDS 导入请求体校验（XML 内容非空）
 */
import { z } from "zod";

// ── 枚举 ──

/**
 * 检查结果状态 schema
 * 严格状态分离（project_memory 强制要求）：
 * - PASS：通过
 * - FAIL：未通过
 * - NOT_APPLICABLE：不适用
 * - INDETERMINATE：无法判定
 * - ERROR：执行异常
 * - MANUAL_REVIEW：需人工复核
 */
export const checkOutcomeSchema = z.enum([
  "PASS",
  "FAIL",
  "NOT_APPLICABLE",
  "INDETERMINATE",
  "ERROR",
  "MANUAL_REVIEW",
]);

/** 规则状态 schema */
export const ruleStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "DEPRECATED",
  "ARCHIVED",
]);

/** 检查运行状态 schema */
export const checkRunStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

// ── DTO ──

/** 合规规则 schema */
export const complianceRuleDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  ruleCode: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  owner: z.string().nullable().optional(),
  status: z.string().min(1),
  description: z.string().nullable().optional(),
  // basis 在数据库为 TEXT 列，Java 返回字符串；兼容未来可能的结构化对象
  basis: z
    .union([z.string(), z.record(z.unknown())])
    .nullable()
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().uuid().nullable().optional(),
  updatedBy: z.string().uuid().nullable().optional(),
  rowVersion: z.number().int().nonnegative(),
});

/** 规则修订 schema */
export const ruleRevisionDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  ruleId: z.string().uuid(),
  revisionNo: z.number().int().nonnegative(),
  dslJson: z.string().nullable().optional(),
  parametersJson: z.string().nullable().optional(),
  basis: z.string().nullable().optional(),
  engineProfile: z.string().nullable().optional(),
  status: z.string().min(1),
  createdAt: z.string().datetime(),
  createdBy: z.string().uuid().nullable().optional(),
  rowVersion: z.number().int().nonnegative(),
});

/** 规则执行统计 schema */
export const ruleExecutionDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  runId: z.string().uuid(),
  revisionId: z.string().uuid(),
  applicabilityCount: z.number().int().nonnegative(),
  passCount: z.number().int().nonnegative(),
  failCount: z.number().int().nonnegative(),
  notApplicableCount: z.number().int().nonnegative(),
  indeterminateCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  manualReviewCount: z.number().int().nonnegative(),
  status: z.string().min(1),
  durationMs: z.number().int().nonnegative().nullable().optional(),
  logs: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  rowVersion: z.number().int().nonnegative(),
});

/** 合规检查运行 schema */
export const complianceCheckRunDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  ruleSetId: z.string().uuid().nullable().optional(),
  status: z.string().min(1),
  outcomeSummary: z.string().nullable().optional(),
  executions: z.array(ruleExecutionDtoSchema).optional(),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().uuid().nullable().optional(),
  updatedBy: z.string().uuid().nullable().optional(),
  rowVersion: z.number().int().nonnegative(),
});

/** 检查结果（单条） schema */
export const checkResultDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  executionId: z.string().uuid(),
  objectId: z.string().nullable().optional(),
  objectType: z.string().nullable().optional(),
  /**
   * 校验结论，严格状态分离（project_memory 强制要求）
   */
  outcome: checkOutcomeSchema,
  measuredValue: z.string().nullable().optional(),
  threshold: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(),
  evidenceJson: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  createdBy: z.string().uuid().nullable().optional(),
  rowVersion: z.number().int().nonnegative(),
});

// ── 请求 DTO ──

/** 创建规则请求 schema */
export const createRuleRequestSchema = z.object({
  ruleCode: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  owner: z.string().optional(),
  description: z.string().optional(),
  basis: z.record(z.unknown()).optional(),
});

/** 创建检查运行请求 schema */
export const createCheckRunRequestSchema = z.object({
  ruleSetId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  parameters: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().optional(),
});

/** 创建规则修订请求 schema */
export const createRuleRevisionRequestSchema = z.object({
  dslJson: z.string().optional(),
  parametersJson: z.string().optional(),
  basis: z.string().optional(),
  engineProfile: z.string().optional(),
});

/** IDS 导入请求 schema */
export const idsImportRequestSchema = z.object({
  xmlContent: z.string().min(1),
});

/** IDS 导入响应 schema */
export const idsImportResponseSchema = z.object({
  importedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  errors: z.array(z.string()),
});

/** 更新规则请求 schema（部分字段更新） */
export const updateRuleRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  owner: z.string().optional(),
});

// ── 推断类型导出（前端/BFF 共享类型契约） ──

/** 更新规则请求 */
export type UpdateRuleRequest = z.infer<typeof updateRuleRequestSchema>;
