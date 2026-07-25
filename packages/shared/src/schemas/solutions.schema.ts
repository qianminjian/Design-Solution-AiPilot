/**
 * 方案生成域 Zod Schema
 *
 * 权威源：@design/D09-概念阶段.md + @design/D10-方案深化.md + @design/D26-方案决策.md
 * 对齐：packages/shared/src/contracts/solutions.contract.ts
 *
 * 用途：
 *  - BFF 代理层验证 AI Service 返回的方案生成响应结构
 *  - 强制 isAiAssisted=true 标注与风险等级（security.md §12）
 *  - 验证 Guardrails 校验结果与升级人工复核触发条件
 *  - 前端运行时验证方案候选数据结构
 */
import { z } from "zod";
import { tokenUsageDtoSchema } from "./ai.schema";

// 复用 ai.schema 的风险等级 schema（小写形式：low/medium/high/critical）
export const solutionRiskLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

// ── 方案生成 DTO ──

/**
 * Prompt 模板变量键值对 schema
 */
export const solutionVariableSchema = z.object({
  /** 变量名（如 siteDescription） */
  key: z.string().min(1),
  /** 变量值 */
  value: z.string(),
});

/**
 * 方案生成请求 schema
 * 对应契约：solutions.generate（POST /api/v1/solutions/generate）
 */
export const generateSolutionRequestSchema = z.object({
  /** Prompt 模板名称（如 concept-generation） */
  promptTemplate: z.string().min(1),
  /** 模板变量键值对 */
  variables: z.array(solutionVariableSchema),
  /** 关联项目 ID（可选，用于审计与 traceId 关联） */
  projectId: z.string().uuid().optional(),
  /** 草图文档 ID（CDE 文档，AI 通过 presigned URL 取图） */
  sketchDocumentId: z.string().uuid().optional(),
  /** 采样温度 0.0–2.0，默认 0.7 */
  temperature: z.number().min(0).max(2).optional(),
  /** 最大生成 token 数，默认 2048 */
  maxTokens: z.number().int().positive().optional(),
});

/**
 * 方案候选 schema
 */
export const solutionCandidateSchema = z.object({
  /** 候选名称 */
  name: z.string().min(1),
  /** 候选内容（Markdown/JSON 字符串） */
  content: z.string(),
  /** 风险点列表 */
  risks: z.array(z.string()),
  /** 可行性注记 */
  feasibilityNotes: z.string().nullable().optional(),
});

/**
 * Guardrails 校验结果 schema
 */
export const guardrailResultSchema = z.object({
  /** 是否通过校验 */
  passed: z.boolean(),
  /** 警告信息 */
  warnings: z.array(z.string()),
  /** 是否升级人工复核（触发安全关键词） */
  escalatedReview: z.boolean(),
});

/**
 * 方案生成响应 schema
 * 标记 isAiAssisted=true，按风险等级进入人工复核（security.md §12）
 */
export const generateSolutionResponseSchema = z.object({
  /** 方案候选列表（至少 1 项） */
  candidates: z.array(solutionCandidateSchema).min(1),
  /** LLM 原始输出（未解析，用于审计追溯） */
  rawContent: z.string(),
  /** 实际调用的 LLM 模型名 */
  model: z.string().min(1),
  /** Token 用量（复用 ai.schema.ts 中的 schema） */
  usage: tokenUsageDtoSchema,
  /** 风险等级（继承自 prompt 模板） */
  riskLevel: solutionRiskLevelSchema,
  /** 实际使用的 prompt 模板名 */
  promptTemplateUsed: z.string().min(1),
  /** Guardrails 校验结果 */
  guardrail: guardrailResultSchema,
  /** 是否为 AI 辅助输出（恒为 true） */
  isAiAssisted: z.literal(true),
  /** 是否需要人工复核 */
  requiresHumanReview: z.boolean(),
  /** LLM 调用耗时（毫秒） */
  latencyMs: z.number().int().nonnegative(),
});
