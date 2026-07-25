/**
 * AI 生成记录域 Zod Schema — 审计追溯 + 人工复核闭环
 *
 * 权威源：@design/D35-统一身份作用域通用字段.md（审计字段） + security.md §12（AI 安全红线）
 * 对齐：packages/shared/src/contracts/ai-generation-record.contract.ts
 *
 * 用途：
 *  - BFF 代理层验证 AI Service 与 Core Service 之间的 AI 生成记录创建请求与响应
 *  - 强制人工复核状态流转校验（PENDING → APPROVED/REJECTED/RETURNED）
 *  - 高风险（high/critical）记录须双人复核 + 注册师签章（security.md §12）
 *  - 前端运行时验证复核决策请求体
 */
import { z } from "zod";
import { tokenUsageDtoSchema } from "./ai.schema";

// 复用 ai.schema 的风险等级 schema（小写形式）
export const aiRecordRiskLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

// ── 复核枚举 ──

/**
 * AI 生成记录人工复核状态 schema
 * - PENDING：待复核（requiresHumanReview=true 时默认值）
 * - APPROVED：复核通过
 * - REJECTED：复核驳回
 * - RETURNED：退回重生成
 */
export const aiReviewStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "RETURNED",
]);

/**
 * AI 生成记录人工复核决策动作 schema
 * 与 AiReviewStatus 后三项对应（不含 PENDING，因 PENDING 不能由用户选择）
 */
export const aiReviewDecisionSchema = z.enum([
  "APPROVED",
  "REJECTED",
  "RETURNED",
]);

// ── 复核请求 DTO ──

/**
 * 提交人工复核决策请求 schema
 *
 * 用于对 requiresHumanReview=true 的 AI 生成记录提交复核结论。
 * 风险等级 high/critical 须双人复核 + 注册师签章（security.md §12），
 * 在 decisionContext 中提供 secondReviewer 与 signer 信息。
 */
export const submitReviewRequestSchema = z.object({
  /** 决策：APPROVED / REJECTED / RETURNED */
  decision: aiReviewDecisionSchema,
  /** 复核意见 */
  comment: z.string().optional(),
  /**
   * 决策上下文（双人复核签章、注册师信息等）
   * 高风险（high/critical）记录须提供：
   * - secondReviewer: 第二复核人 ID
   * - signer: 注册师签章信息（姓名 / 证书号 / 签章时间）
   */
  decisionContext: z.record(z.unknown()).optional(),
});

// ── DTO ──

/** Guardrails 结果 schema（与 solutions.schema 一致，独立定义避免循环依赖） */
const guardrailResultSchema = z.object({
  passed: z.boolean(),
  warnings: z.array(z.string()),
  escalatedReview: z.boolean(),
});

/** 创建 AI 生成记录请求 schema */
export const createAiGenerationRecordRequestSchema = z.object({
  projectId: z.string().uuid(),
  designOptionId: z.string().uuid().optional(),
  promptTemplate: z.string().min(1),
  variables: z.record(z.unknown()).optional(),
  renderedPrompt: z.string(),
  rawContent: z.string(),
  candidates: z.record(z.unknown()),
  model: z.string().min(1),
  tokenUsage: tokenUsageDtoSchema,
  riskLevel: aiRecordRiskLevelSchema,
  guardrailResult: guardrailResultSchema,
  requiresHumanReview: z.boolean().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  traceId: z.string().optional(),
});

/** AI 生成记录响应 schema */
export const aiGenerationRecordDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  projectId: z.string().uuid(),
  designOptionId: z.string().uuid().nullable().optional(),
  promptTemplate: z.string().min(1),
  variables: z.record(z.unknown()).optional(),
  renderedPrompt: z.string(),
  rawContent: z.string(),
  candidates: z.record(z.unknown()),
  model: z.string().min(1),
  tokenUsage: tokenUsageDtoSchema,
  riskLevel: aiRecordRiskLevelSchema,
  guardrailResult: guardrailResultSchema,
  requiresHumanReview: z.boolean(),
  latencyMs: z.number().int().nonnegative(),
  traceId: z.string().optional(),
  /** 人工复核状态：PENDING / APPROVED / REJECTED / RETURNED */
  reviewStatus: aiReviewStatusSchema,
  /** 复核人 ID */
  reviewerId: z.string().uuid().nullable().optional(),
  /** 复核意见 */
  reviewComment: z.string().nullable().optional(),
  /** 复核时间（ISO 字符串） */
  reviewedAt: z.string().datetime().nullable().optional(),
  /** 复核决策上下文（双人复核签章、注册师信息等） */
  reviewDecision: z.record(z.unknown()).nullable().optional(),
  createdBy: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  rowVersion: z.number().int().nonnegative(),
});
