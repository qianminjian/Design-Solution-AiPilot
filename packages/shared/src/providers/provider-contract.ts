/**
 * Provider 契约（P0-2.4 AI/通知/分析 Provider 契约）
 *
 * 覆盖 DeepSeek / ChromaDB / HuggingFace 等外部 Provider 调用契约：
 *  - ProviderCapability：能力目录（capability/model/region）
 *  - ProviderResponse：统一响应（含 requestId）
 *  - ProviderErrorCategory：错误分类（timeout/429/5xx/partial/malformed/billing）
 *  - FallbackPolicy：降级策略（mock/cache/alternate/block）
 *
 * 验收标准（路线图 P0-2.4）：Provider 故障降级不阻断主流程。
 *
 * 权威源：.trae/rules/security.md §12 AI 安全红线 + §10 第三方 DPA
 *         + @design/D35-API-事件契约.md §D35.10 + @design/D40-AI-服务.md
 */
import { z } from "zod";

/** Provider 名称（V0 支持 OpenAI 兼容端点，含 DeepSeek） */
export const providerNameSchema = z.enum([
  "openai",
  "deepseek",
  "anthropic",
  "chromadb",
  "huggingface",
]);
export type ProviderName = z.infer<typeof providerNameSchema>;

/** Provider 能力类型 */
export const providerCapabilityTypeSchema = z.enum([
  "text-generation",
  "vision",
  "embeddings",
  "vector-store",
  "rerank",
]);
export type ProviderCapabilityType = z.infer<
  typeof providerCapabilityTypeSchema
>;

/** Provider 能力目录（capability/model/region） */
export const providerCapabilitySchema = z.object({
  /** 能力类型 */
  capability: providerCapabilityTypeSchema,
  /** 模型名称（如 deepseek-v4-pro / text-embedding-3-small） */
  model: z.string().min(1),
  /** 服务区域（如 us-east / cn-beijing） */
  region: z.string().min(1),
  /** 支持的输入上下文长度 */
  maxInputTokens: z.number().int().positive(),
  /** 最大输出 token 数 */
  maxOutputTokens: z.number().int().positive(),
});
export type ProviderCapability = z.infer<typeof providerCapabilitySchema>;

/** Provider 响应状态 */
export const providerResponseStatusSchema = z.enum([
  "ok",
  "partial", // 部分响应（finish_reason 异常/内容截断）
  "malformed", // 响应格式损坏
]);
export type ProviderResponseStatus = z.infer<
  typeof providerResponseStatusSchema
>;

/** Provider 调用响应（统一结构，含 request id） */
export const providerResponseSchema = z.object({
  /** Provider 返回的请求 ID（对齐 OpenAI request_id 语义，用于账单/追踪） */
  requestId: z.string().min(1),
  /** Provider 名称 */
  provider: providerNameSchema,
  /** 实际使用的模型 */
  model: z.string().min(1),
  /** 响应状态 */
  status: providerResponseStatusSchema,
  /** 生成内容（text-generation/vision 时存在） */
  content: z.string().optional(),
  /** 向量（embeddings 时存在） */
  embedding: z.array(z.number()).optional(),
  /** Token 用量（账单审计） */
  usage: z
    .object({
      promptTokens: z.number().int().nonnegative(),
      completionTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative(),
    })
    .optional(),
  /** 结束原因（stop/length/error 等，length=部分响应） */
  finishReason: z.string().optional(),
});
export type ProviderResponse = z.infer<typeof providerResponseSchema>;

/** Provider 错误分类（对齐 OpenAI 错误语义 + 现有 LlmClient 异常层级） */
export const providerErrorCategorySchema = z.enum([
  "timeout", // 超时（可重试）
  "network", // 网络错误（可重试）
  "rate_limit", // 429 限流（可重试，退避）
  "server_error", // 5xx 服务端错误（可重试）
  "auth", // 401/403 鉴权失败（不可重试）
  "billing", // 账单/配额不足（不可重试）
  "malformed", // 响应格式损坏（不可重试）
  "policy", // 策略拒绝（内容安全/合规拦截，不可重试）
]);
export type ProviderErrorCategory = z.infer<typeof providerErrorCategorySchema>;

/** Provider 错误详情 */
export const providerErrorSchema = z.object({
  /** 错误分类 */
  category: providerErrorCategorySchema,
  /** HTTP 状态码（0=网络/超时层错误） */
  statusCode: z.number().int().nonnegative(),
  /** Provider 名称 */
  provider: providerNameSchema,
  /** Provider 返回的 request id（账单/追踪关联，可选） */
  requestId: z.string().optional(),
  /** 错误消息（脱敏，不含密钥/敏感内容） */
  message: z.string().max(512),
});
export type ProviderError = z.infer<typeof providerErrorSchema>;

/** 降级策略（验收：Provider 故障降级不阻断主流程） */
export const fallbackPolicySchema = z.enum([
  "mock", // 返回 Mock 结果（本地开发/测试环境，CI 强制）
  "cache", // 使用缓存结果（幂等场景）
  "alternate", // 切换替代 Provider/模型
  "block", // 阻断并进入人工复核（安全红线场景）
]);
export type FallbackPolicy = z.infer<typeof fallbackPolicySchema>;
