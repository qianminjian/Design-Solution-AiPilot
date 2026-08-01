/**
 * Provider 降级决策工具（P0-2.4 AI/通知/分析 Provider 契约）
 *
 * 覆盖 Provider 故障场景（对齐路线图 P0-2.4 输出）：
 *  - timeout/429/5xx/network：可重试错误（有界退避重试）
 *  - auth/billing/malformed/policy：不可重试错误（直接降级）
 *  - partial：部分响应检测（finish_reason=length / 缺字段）
 *  - fallback 决策：mock/cache/alternate/block（验收：降级不阻断主流程）
 *
 * 权威源：.trae/rules/security.md §12 AI 安全红线 + testing.md §4.2 LLM Mock 红线
 *         + @design/D35-API-事件契约.md §D35.10 + @design/D40-AI-服务.md
 */
import type { ProviderError } from "./provider-contract";

/** 可重试的错误分类（429/5xx/network/timeout 有界重试） */
const RETRYABLE_CATEGORIES: ReadonlySet<ProviderError["category"]> = new Set([
  "timeout",
  "network",
  "rate_limit",
  "server_error",
]);

/**
 * 错误分类判定：HTTP 状态码 + 错误类型 → ProviderErrorCategory
 *
 * 对齐现有 LlmClient 异常映射（services/ai/src/llm/openai_client.py）：
 *  - 0 + timeout 类型 → timeout
 *  - 0 + network 类型 → network
 *  - 401/403 → auth
 *  - 429 → rate_limit
 *  - 5xx → server_error
 *  - 402/配额 → billing
 *  - 其他 4xx → policy（内容安全/合规拦截）
 *
 * @param statusCode HTTP 状态码（0 = 网络/超时层错误）
 * @param errorType 错误类型（"timeout" | "network" | 其他）
 * @returns 错误分类
 */
export function classifyProviderError(
  statusCode: number,
  errorType?: "timeout" | "network",
): ProviderError["category"] {
  if (errorType === "timeout") {
    return "timeout";
  }
  if (errorType === "network") {
    return "network";
  }
  if (statusCode === 401 || statusCode === 403) {
    return "auth";
  }
  if (statusCode === 429) {
    return "rate_limit";
  }
  if (statusCode === 402) {
    return "billing";
  }
  if (statusCode >= 500) {
    return "server_error";
  }
  if (statusCode >= 400) {
    return "policy";
  }
  return "network";
}

/**
 * 错误是否可重试
 *
 * @param category 错误分类
 * @returns true = 可重试（有界退避）；false = 不可重试（直接降级）
 */
export function isRetryableCategory(
  category: ProviderError["category"],
): boolean {
  return RETRYABLE_CATEGORIES.has(category);
}

/**
 * 有界指数退避（含抖动，防惊群）
 *
 * @param attempt 当前重试次数（0 = 首次失败）
 * @param baseMs 基础退避（默认 500ms）
 * @param maxMs 最大退避（默认 30s）
 * @returns 退避毫秒数（baseMs × 2^attempt，封顶 maxMs，±20% 抖动）
 */
export function exponentialBackoffMs(
  attempt: number,
  baseMs = 500,
  maxMs = 30_000,
): number {
  const exponent = Math.min(attempt, 6); // 2^6=64 封顶，避免溢出
  const raw = baseMs * 2 ** exponent;
  const capped = Math.min(raw, maxMs);
  // ±20% 抖动（确定性基于 attempt 偏移，便于测试断言范围）
  const jitter = 0.8 + ((attempt * 0.13) % 0.4);
  return Math.round(capped * jitter);
}

/**
 * 部分响应检测（响应完整性）
 *
 * 对齐路线图 P0-2.4 partial 场景：
 *  - finish_reason=length → 内容截断（部分响应）
 *  - 文本生成缺 content → malformed
 *  - embeddings 缺 embedding → malformed
 *
 * @param response Provider 响应（含 status/fields）
 * @returns 响应状态：ok / partial / malformed
 */
export function detectResponseStatus(response: {
  status?: "ok" | "partial" | "malformed";
  content?: string;
  embedding?: number[];
  finishReason?: string;
}): "ok" | "partial" | "malformed" {
  if (response.status === "partial" || response.status === "malformed") {
    return response.status;
  }
  if (response.finishReason === "length") {
    return "partial";
  }
  // 至少提供一种有效负载（文本或向量）
  const hasContent =
    typeof response.content === "string" && response.content.length > 0;
  const hasEmbedding =
    Array.isArray(response.embedding) && response.embedding.length > 0;
  if (!hasContent && !hasEmbedding) {
    return "malformed";
  }
  return "ok";
}

/**
 * 降级决策（验收：Provider 故障降级不阻断主流程）
 *
 * 根据错误分类 + 环境策略选择降级方式：
 *  - 可重试错误（timeout/network/rate_limit/server_error）：建议 alternate 或重试
 *  - 不可重试错误：
 *    - auth/billing/malformed：alternate（切换 Provider）或 block
 *    - policy：block（内容安全/合规拦截必须人工复核，AI 安全红线）
 *
 * @param category 错误分类
 * @param allowMock 是否允许 mock 降级（CI/开发环境 true，生产 false）
 * @param hasAlternate 是否存在替代 Provider/模型
 * @returns 降级策略
 */
export function decideFallback(
  category: ProviderError["category"],
  allowMock: boolean,
  hasAlternate: boolean,
): "mock" | "cache" | "alternate" | "block" {
  if (category === "policy") {
    // 内容安全/合规拦截：必须阻断进入人工复核（AI 安全红线）
    return "block";
  }
  if (allowMock) {
    // CI/开发环境：Mock 降级（testing.md §4.2 红线，禁止真实调用付费 API）
    return "mock";
  }
  if (hasAlternate) {
    return "alternate";
  }
  return "block";
}
