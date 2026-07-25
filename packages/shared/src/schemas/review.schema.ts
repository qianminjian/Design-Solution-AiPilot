/**
 * Review 域 Zod Schema（合规复核聚合视图）
 *
 * 权威源：@design/D25-智能审图与复核.md + @design/D24-智能合规引擎.md
 *
 * 用途：
 *  - 前端复核面板运行时验证响应数据结构
 *  - BFF/RAG/BCF 协调问题响应 schema 验证
 *  - 强制 AI 输出标记 isAiAssisted=true（security.md §12 AI 安全红线）
 *
 * 说明：
 *  - 此 schema 对齐 apps/web/src/hooks/use-review.ts 的本地类型
 *  - 后端尚未提供独立 review 域契约时，前端先在 shared 内统一类型与 schema
 */
import { z } from "zod";

// ── 合规检查聚合视图 ──

/** 单条规则检查结果（聚合视图） */
export const complianceCheckResultSchema = z.object({
  id: z.string().min(1),
  ruleName: z.string().min(1),
  ruleCode: z.string().min(1),
  applicableObjects: z.number().int().nonnegative(),
  passCount: z.number().int().nonnegative(),
  failCount: z.number().int().nonnegative(),
  naCount: z.number().int().nonnegative(),
  uncertainCount: z.number().int().nonnegative(),
  status: z.enum(["passed", "failed", "partial", "running"]),
  lastRunAt: z.string().datetime(),
});

/** 合规检查运行聚合视图 */
export const complianceCheckRunViewSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  status: z.enum(["completed", "running", "failed"]),
  totalRules: z.number().int().nonnegative(),
  passedRules: z.number().int().nonnegative(),
  failedRules: z.number().int().nonnegative(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  results: z.array(complianceCheckResultSchema),
});

// ── RAG 问答 ──

/** RAG 检索来源 */
export const ragSourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  snippet: z.string(),
});

/** RAG 问答响应 schema
 * 强制 isAiAssisted=true（security.md §12 AI 安全红线）
 * requiresHumanReview 必填，前端依据此判断是否进入人工复核流程
 */
export const ragQueryResponseSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  answer: z.string(),
  sources: z.array(ragSourceSchema),
  confidence: z.number().min(0).max(1),
  isAiAssisted: z.literal(true),
  requiresHumanReview: z.boolean(),
  latencyMs: z.number().int().nonnegative(),
});

/** RAG 问答请求 schema */
export const ragQueryRequestSchema = z.object({
  projectId: z.string().min(1),
  question: z.string().min(1),
});

// ── 合规发现 ──

/** 发现严重级别 */
export const findingSeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
]);

/** 发现状态 */
export const findingStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "resolved",
]);

/** 合规发现 DTO */
export const complianceFindingSchema = z.object({
  id: z.string().min(1),
  reviewId: z.string().min(1),
  projectId: z.string().min(1),
  ruleName: z.string().min(1),
  ruleCode: z.string().min(1),
  objectName: z.string(),
  objectId: z.string(),
  severity: findingSeveritySchema,
  status: findingStatusSchema,
  confidence: z.number().min(0).max(1),
  description: z.string(),
  codeReference: z.string(),
  suggestedFix: z.string(),
  assignedTo: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ── 门禁决策概览 ──

/** 门禁决策概览 */
export const gateSummarySchema = z.object({
  stageName: z.string().min(1),
  stageCode: z.string().min(1),
  gateCode: z.string().min(1),
  gateName: z.string().min(1),
  passRate: z.number().min(0).max(1),
  pendingItems: z.number().int().nonnegative(),
  totalFindings: z.number().int().nonnegative(),
  criticalFindings: z.number().int().nonnegative(),
  status: z.enum(["pass", "fail", "pending"]),
});

// ── BCF 协调问题 ──

/** BCF 问题状态 */
export const bcfIssueStatusSchema = z.enum([
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

/** BCF 问题优先级 */
export const bcfIssuePrioritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
]);

/** BCF 协调问题 DTO */
export const bcfIssueSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  /** 问题序号（项目内递增） */
  issueIndex: z.number().int().nonnegative(),
  title: z.string().min(1),
  description: z.string(),
  status: bcfIssueStatusSchema,
  priority: bcfIssuePrioritySchema,
  /** 问题类型（如 clash、code_review、design_review） */
  issueType: z.string().min(1),
  /** BCF 视点快照（base64 图片） */
  snapshot: z.string().nullable(),
  /** 关联构件 GUID 列表 */
  relatedElements: z.array(z.string()),
  assignedTo: z.string().nullable(),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** 更新 BCF 问题状态请求 */
export const updateBcfIssueStatusRequestSchema = z.object({
  status: bcfIssueStatusSchema,
});

/** 指派 BCF 问题请求 */
export const assignBcfIssueRequestSchema = z.object({
  assignee: z.string().min(1),
});

// ── 推断类型导出（前端/BFF 共享类型契约） ──

/** 合规检查运行聚合视图 */
export type ComplianceCheckRun = z.infer<typeof complianceCheckRunViewSchema>;
/** 单条规则检查结果 */
export type ComplianceCheckResult = z.infer<typeof complianceCheckResultSchema>;
/** RAG 检索来源 */
export type RagSource = z.infer<typeof ragSourceSchema>;
/** RAG 问答响应 */
export type RagQueryResponse = z.infer<typeof ragQueryResponseSchema>;
/** RAG 问答请求 */
export type RagQueryRequest = z.infer<typeof ragQueryRequestSchema>;
/** 发现严重级别 */
export type FindingSeverity = z.infer<typeof findingSeveritySchema>;
/** 发现状态 */
export type FindingStatus = z.infer<typeof findingStatusSchema>;
/** 合规发现 DTO */
export type ComplianceFinding = z.infer<typeof complianceFindingSchema>;
/** 门禁决策概览 */
export type GateSummary = z.infer<typeof gateSummarySchema>;
/** BCF 问题状态 */
export type BcfIssueStatus = z.infer<typeof bcfIssueStatusSchema>;
/** BCF 问题优先级 */
export type BcfIssuePriority = z.infer<typeof bcfIssuePrioritySchema>;
/** BCF 协调问题 DTO */
export type BcfIssue = z.infer<typeof bcfIssueSchema>;
/** 更新 BCF 问题状态请求 */
export type UpdateBcfIssueStatusRequest = z.infer<
  typeof updateBcfIssueStatusRequestSchema
>;
/** 指派 BCF 问题请求 */
export type AssignBcfIssueRequest = z.infer<typeof assignBcfIssueRequestSchema>;
