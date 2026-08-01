/**
 * Provider 契约与降级决策单元测试（P0-2.4 AI/通知/分析 Provider 契约）
 *
 * 覆盖路线图 P0-2.4 故障场景：
 * - Provider 契约 schema（能力目录/统一响应/错误分类/降级策略）
 * - 错误分类（timeout/network/429/5xx/401/402/4xx）
 * - 可重试判定（429/5xx/network/timeout 可重试，auth/billing/malformed/policy 不可重试）
 * - 有界指数退避（含抖动，防惊群）
 * - 部分响应检测（finish_reason=length/缺负载）
 * - 降级决策（验收：Provider 故障降级不阻断主流程）
 *
 * 权威源：.trae/rules/security.md §12 + testing.md §4.2 + @design/D40-AI-服务.md
 */
import { describe, it, expect } from "vitest";
import {
  classifyProviderError,
  decideFallback,
  detectResponseStatus,
  exponentialBackoffMs,
  fallbackPolicySchema,
  isRetryableCategory,
  providerCapabilitySchema,
  providerErrorSchema,
  providerResponseSchema,
} from "../../../src/providers";

describe("Provider 能力目录 schema", () => {
  it("应通过合法能力声明（capability/model/region）", () => {
    const result = providerCapabilitySchema.safeParse({
      capability: "text-generation",
      model: "deepseek-v4-pro",
      region: "cn-beijing",
      maxInputTokens: 128_000,
      maxOutputTokens: 8_000,
    });
    expect(result.success).toBe(true);
  });

  it("应拒绝非法能力类型", () => {
    const result = providerCapabilitySchema.safeParse({
      capability: "teleport",
      model: "deepseek-v4-pro",
      region: "cn-beijing",
      maxInputTokens: 128_000,
      maxOutputTokens: 8_000,
    });
    expect(result.success).toBe(false);
  });
});

describe("Provider 响应 schema（含 request id）", () => {
  it("应通过合法响应（含 requestId 与用量）", () => {
    const result = providerResponseSchema.safeParse({
      requestId: "req_0198b5a0",
      provider: "deepseek",
      model: "deepseek-v4-pro",
      status: "ok",
      content: "幕墙节点优化建议",
      usage: {
        promptTokens: 120,
        completionTokens: 45,
        totalTokens: 165,
      },
      finishReason: "stop",
    });
    expect(result.success).toBe(true);
  });

  it("应拒绝缺少 requestId 的响应", () => {
    const result = providerResponseSchema.safeParse({
      provider: "deepseek",
      model: "deepseek-v4-pro",
      status: "ok",
      content: "文本",
    });
    expect(result.success).toBe(false);
  });

  it("应拒绝非负 token 用量", () => {
    const result = providerResponseSchema.safeParse({
      requestId: "req_1",
      provider: "deepseek",
      model: "deepseek-v4-pro",
      status: "ok",
      usage: { promptTokens: -1, completionTokens: 0, totalTokens: -1 },
    });
    expect(result.success).toBe(false);
  });
});

describe("Provider 错误 schema", () => {
  it("应通过合法错误（含分类与状态码）", () => {
    const result = providerErrorSchema.safeParse({
      category: "rate_limit",
      statusCode: 429,
      provider: "deepseek",
      requestId: "req_1",
      message: "请求过于频繁",
    });
    expect(result.success).toBe(true);
  });

  it("应拒绝超长错误消息（>512）", () => {
    const result = providerErrorSchema.safeParse({
      category: "server_error",
      statusCode: 500,
      provider: "deepseek",
      message: "x".repeat(513),
    });
    expect(result.success).toBe(false);
  });
});

describe("classifyProviderError（错误分类）", () => {
  it("timeout 类型应分类为 timeout", () => {
    expect(classifyProviderError(0, "timeout")).toBe("timeout");
  });

  it("network 类型应分类为 network", () => {
    expect(classifyProviderError(0, "network")).toBe("network");
  });

  it("401/403 应分类为 auth", () => {
    expect(classifyProviderError(401)).toBe("auth");
    expect(classifyProviderError(403)).toBe("auth");
  });

  it("429 应分类为 rate_limit", () => {
    expect(classifyProviderError(429)).toBe("rate_limit");
  });

  it("402 应分类为 billing（配额不足）", () => {
    expect(classifyProviderError(402)).toBe("billing");
  });

  it("5xx 应分类为 server_error", () => {
    expect(classifyProviderError(500)).toBe("server_error");
    expect(classifyProviderError(503)).toBe("server_error");
  });

  it("其他 4xx 应分类为 policy（合规拦截）", () => {
    expect(classifyProviderError(400)).toBe("policy");
  });
});

describe("isRetryableCategory（可重试判定）", () => {
  it("timeout/network/rate_limit/server_error 应可重试", () => {
    expect(isRetryableCategory("timeout")).toBe(true);
    expect(isRetryableCategory("network")).toBe(true);
    expect(isRetryableCategory("rate_limit")).toBe(true);
    expect(isRetryableCategory("server_error")).toBe(true);
  });

  it("auth/billing/malformed/policy 应不可重试", () => {
    expect(isRetryableCategory("auth")).toBe(false);
    expect(isRetryableCategory("billing")).toBe(false);
    expect(isRetryableCategory("malformed")).toBe(false);
    expect(isRetryableCategory("policy")).toBe(false);
  });
});

describe("exponentialBackoffMs（有界指数退避）", () => {
  it("首次失败应返回 baseMs 附近（±20% 抖动）", () => {
    const backoff = exponentialBackoffMs(0, 500);
    expect(backoff).toBeGreaterThanOrEqual(400);
    expect(backoff).toBeLessThanOrEqual(600);
  });

  it("退避应随 attempt 指数增长", () => {
    const b0 = exponentialBackoffMs(0, 500);
    const b1 = exponentialBackoffMs(1, 500);
    const b2 = exponentialBackoffMs(2, 500);
    expect(b1).toBeGreaterThan(b0);
    expect(b2).toBeGreaterThan(b1);
  });

  it("退避应封顶 maxMs 防无限增长", () => {
    const backoff = exponentialBackoffMs(10, 500, 30_000);
    expect(backoff).toBeLessThanOrEqual(30_000);
  });
});

describe("detectResponseStatus（部分响应检测）", () => {
  it("finish_reason=length 应判定为 partial（内容截断）", () => {
    expect(
      detectResponseStatus({ content: "部分内容", finishReason: "length" }),
    ).toBe("partial");
  });

  it("显式 status=partial 应透传", () => {
    expect(detectResponseStatus({ status: "partial" })).toBe("partial");
  });

  it("缺内容与向量应判定为 malformed", () => {
    expect(detectResponseStatus({})).toBe("malformed");
    expect(detectResponseStatus({ content: "" })).toBe("malformed");
  });

  it("正常文本响应应判定为 ok", () => {
    expect(
      detectResponseStatus({ content: "完整内容", finishReason: "stop" }),
    ).toBe("ok");
  });

  it("正常向量响应应判定为 ok", () => {
    expect(detectResponseStatus({ embedding: [0.1, 0.2, 0.3] })).toBe("ok");
  });
});

describe("decideFallback（降级决策，验收：故障降级不阻断主流程）", () => {
  it("policy 错误必须阻断（AI 安全红线）", () => {
    expect(decideFallback("policy", false, true)).toBe("block");
    expect(decideFallback("policy", true, true)).toBe("block");
  });

  it("CI/开发环境可重试错误应 mock 降级（testing.md §4.2 红线）", () => {
    expect(decideFallback("rate_limit", true, false)).toBe("mock");
    expect(decideFallback("server_error", true, true)).toBe("mock");
  });

  it("生产环境有替代 Provider 应 alternate 降级", () => {
    expect(decideFallback("server_error", false, true)).toBe("alternate");
    expect(decideFallback("billing", false, true)).toBe("alternate");
  });

  it("生产环境无替代 Provider 应 block（不阻断降级为阻断）", () => {
    expect(decideFallback("server_error", false, false)).toBe("block");
  });

  it("fallbackPolicySchema 应包含 4 种降级策略", () => {
    expect(fallbackPolicySchema.options).toEqual([
      "mock",
      "cache",
      "alternate",
      "block",
    ]);
  });
});
