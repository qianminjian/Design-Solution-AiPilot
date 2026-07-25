/**
 * AI 域 Zod Schema
 *
 * 权威源：@design/D24-AI能力目录-网关.md + @design/D35-API-事件契约.md
 * 对齐：packages/shared/src/contracts/ai.contract.ts
 *
 * 用途：
 *  - BFF 代理层验证 AI Service 返回的文本生成/视觉/embedding 响应结构
 *  - 强制 isAiAssisted=true 标注与 requiresHumanReview 风险等级（security.md §12）
 *  - 前端运行时验证 AI 输出结构，防止 Provider 漂移导致前端崩溃
 */
import { z } from "zod";

// ── 文本生成 DTO ──

/**
 * 文本生成请求 schema
 * 对应契约：ai.capability.text-generation（POST /api/v1/capabilities/text-generation）
 */
export const textGenerationRequestSchema = z.object({
  /** 用户 prompt（必填） */
  prompt: z.string().min(1),
  /** 系统指令（可选，用于注入角色/约束） */
  system: z.string().optional(),
  /** 采样温度 0.0–2.0，默认 0.7 */
  temperature: z.number().min(0).max(2).optional(),
  /** 最大生成 token 数，默认 1024 */
  maxTokens: z.number().int().positive().optional(),
  /** 调用方使用的 Prompt 模板名（可选，用于追踪） */
  promptTemplate: z.string().optional(),
});

/** Token 用量明细 schema */
export const tokenUsageDtoSchema = z.object({
  /** 输入 token 数 */
  promptTokens: z.number().int().nonnegative(),
  /** 输出 token 数 */
  completionTokens: z.number().int().nonnegative(),
  /** 总 token 数 */
  totalTokens: z.number().int().nonnegative(),
});

/**
 * 文本生成响应 schema
 * 标记 isAiAssisted=true，前端须按风险等级进入人工复核（security.md §12）
 */
export const textGenerationResponseSchema = z.object({
  /** 生成的文本内容 */
  content: z.string(),
  /** 实际使用的模型名（来自 Provider 响应） */
  model: z.string().min(1),
  /** 完成原因：stop / length / content_filter / tool_calls */
  finishReason: z.string().min(1),
  /** Token 用量 */
  usage: tokenUsageDtoSchema,
  /** 是否为 AI 辅助输出（恒为 true，满足安全红线标注） */
  isAiAssisted: z.literal(true),
  /** 是否需要人工复核（按 risk_profile 决定，V0 默认 true） */
  requiresHumanReview: z.boolean(),
  /** LLM 调用耗时（毫秒） */
  latencyMs: z.number().int().nonnegative(),
});

// ── 视觉理解 DTO ──

/**
 * 视觉理解请求 schema
 * 对应契约：ai.capability.vision（POST /api/v1/capabilities/vision）
 */
export const visionRequestSchema = z.object({
  /** 图片 URL（公网可访问或对象存储预签名） */
  imageUrl: z.string().url(),
  /** 针对图片的提问 prompt */
  prompt: z.string().min(1),
  /** 系统指令（可选） */
  system: z.string().optional(),
  /** 采样温度，默认 0.3（视觉理解倾向确定性） */
  temperature: z.number().min(0).max(2).optional(),
  /** 最大生成 token 数 */
  maxTokens: z.number().int().positive().optional(),
});

/**
 * 视觉理解响应 schema
 * 结构与 TextGenerationResponse 一致，附带图片来源标记
 */
export const visionResponseSchema = z.object({
  /** 生成的文本描述/回答 */
  content: z.string(),
  /** 实际使用的模型名 */
  model: z.string().min(1),
  /** 完成原因 */
  finishReason: z.string().min(1),
  /** Token 用量 */
  usage: tokenUsageDtoSchema,
  /** 是否为 AI 辅助输出 */
  isAiAssisted: z.literal(true),
  /** 是否需要人工复核（视觉结果默认进入人工复核） */
  requiresHumanReview: z.boolean(),
  /** LLM 调用耗时（毫秒） */
  latencyMs: z.number().int().nonnegative(),
});

// ── 向量化 DTO ──

/**
 * 文本向量化请求 schema
 * 对应契约：ai.capability.embeddings（POST /api/v1/capabilities/embeddings）
 */
export const embeddingRequestSchema = z.object({
  /** 待向量化的文本（单条） */
  input: z.string().min(1),
  /** 指定模型（可选，默认走配置 LLM_MODEL） */
  model: z.string().optional(),
});

/**
 * 向量化响应 schema
 * V0 阶段维度可能为 stub（待 embedding 模型配置后启用真实维度）
 */
export const embeddingResponseSchema = z.object({
  /** 向量数据（float32） */
  embedding: z.array(z.number()),
  /** 向量维度 */
  dimensions: z.number().int().positive(),
  /** 实际使用的模型名 */
  model: z.string().min(1),
  /** Token 用量（embedding 仅统计 promptTokens） */
  usage: tokenUsageDtoSchema,
  /** LLM 调用耗时（毫秒） */
  latencyMs: z.number().int().nonnegative(),
});

// ── Prompt 模板 DTO ──

/**
 * Prompt 模板风险等级 schema（小写形式：low/medium/high/critical）
 * 与 tevv.schema.ts 的 riskLevelSchema（大写形式）不同，重命名避免冲突
 */
export const promptRiskLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

/**
 * Prompt 模板 DTO schema
 * 对应 Python services/ai/src/prompts/models.py:PromptTemplate
 */
export const promptTemplateDtoSchema = z.object({
  /** 模板唯一标识（如 rule-check / drawing-review） */
  name: z.string().min(1),
  /** 模板版本号（如 v1） */
  version: z.string().min(1),
  /** 模板描述（中文） */
  description: z.string(),
  /** 模板内容（含占位符 {{var}}） */
  template: z.string().min(1),
  /** 占位符变量列表 */
  variables: z.array(z.string()),
  /** 风险等级（low / medium / high / critical） */
  riskLevel: promptRiskLevelSchema,
  /** 是否需要人工复核 */
  requiresHumanReview: z.boolean(),
});
