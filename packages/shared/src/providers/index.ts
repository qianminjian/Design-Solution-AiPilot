/**
 * Provider 契约模块统一导出（P0-2.4 AI/通知/分析 Provider 契约）
 *
 * 覆盖：
 *  - Provider 契约 schema（能力目录/统一响应/错误分类/降级策略）
 *  - 降级决策工具（错误分类/可重试/退避/部分响应检测/降级策略选择）
 *
 * 权威源：.trae/rules/security.md §12 AI 安全红线 + testing.md §4.2 LLM Mock 红线
 *         + @design/D35-API-事件契约.md §D35.10 + @design/D40-AI-服务.md
 */
export {
  fallbackPolicySchema,
  providerCapabilitySchema,
  providerCapabilityTypeSchema,
  providerErrorCategorySchema,
  providerErrorSchema,
  providerNameSchema,
  providerResponseSchema,
  providerResponseStatusSchema,
} from "./provider-contract";
export type {
  FallbackPolicy,
  ProviderCapability,
  ProviderCapabilityType,
  ProviderError,
  ProviderErrorCategory,
  ProviderName,
  ProviderResponse,
  ProviderResponseStatus,
} from "./provider-contract";

export {
  classifyProviderError,
  decideFallback,
  detectResponseStatus,
  exponentialBackoffMs,
  isRetryableCategory,
} from "./provider-fallback";
