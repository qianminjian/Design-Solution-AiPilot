/**
 * AI 域 Zod Schema 单元测试
 *
 * 验证：
 *  - schema 与 ai.contract.ts 类型对齐
 *  - AI 安全红线（security.md §12）：
 *    - isAiAssisted 恒为 true（z.literal(true)）
 *    - requiresHumanReview 字段强制存在
 *  - 温度范围 0.0-2.0
 *  - Token 用量非负数
 *  - 风险等级枚举
 */
import { describe, it, expect } from "vitest";
import {
  textGenerationRequestSchema,
  tokenUsageDtoSchema,
  textGenerationResponseSchema,
  visionRequestSchema,
  visionResponseSchema,
  embeddingRequestSchema,
  embeddingResponseSchema,
  promptRiskLevelSchema,
  promptTemplateDtoSchema,
} from "../../../src/schemas/ai.schema";

describe("textGenerationRequestSchema", () => {
  it("应该接受合法的文本生成请求", () => {
    const valid = {
      prompt: "生成一段方案描述",
      system: "你是建筑师助手",
      temperature: 0.7,
      maxTokens: 1024,
    };
    expect(textGenerationRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝空 prompt", () => {
    const invalid = { prompt: "" };
    expect(textGenerationRequestSchema.safeParse(invalid).success).toBe(false);
  });

  it("应该拒绝温度 > 2.0", () => {
    const invalid = { prompt: "x", temperature: 2.5 };
    expect(textGenerationRequestSchema.safeParse(invalid).success).toBe(false);
  });

  it("应该拒绝负温度", () => {
    const invalid = { prompt: "x", temperature: -0.1 };
    expect(textGenerationRequestSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("tokenUsageDtoSchema", () => {
  it("应该接受合法的 Token 用量", () => {
    const valid = {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    };
    expect(tokenUsageDtoSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝负数 token 数", () => {
    const invalid = {
      promptTokens: -1,
      completionTokens: 50,
      totalTokens: 49,
    };
    expect(tokenUsageDtoSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("textGenerationResponseSchema", () => {
  const validResponse = {
    content: "方案描述...",
    model: "gpt-4",
    finishReason: "stop",
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
    isAiAssisted: true as const,
    requiresHumanReview: true,
    latencyMs: 1200,
  };

  it("应该接受合法的响应", () => {
    expect(textGenerationResponseSchema.safeParse(validResponse).success).toBe(
      true,
    );
  });

  it("安全红线：应该拒绝 isAiAssisted=false（必须为 true）", () => {
    const invalid = { ...validResponse, isAiAssisted: false };
    expect(textGenerationResponseSchema.safeParse(invalid).success).toBe(false);
  });

  it("安全红线：应该拒绝缺少 requiresHumanReview", () => {
    const { ...rest } = validResponse;
    const { requiresHumanReview: _, ...withoutReview } = rest;
    expect(textGenerationResponseSchema.safeParse(withoutReview).success).toBe(
      false,
    );
  });

  it("应该接受 requiresHumanReview=false（低风险场景）", () => {
    const valid = { ...validResponse, requiresHumanReview: false };
    expect(textGenerationResponseSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝负数 latencyMs", () => {
    const invalid = { ...validResponse, latencyMs: -1 };
    expect(textGenerationResponseSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("visionRequestSchema", () => {
  it("应该接受合法的视觉理解请求", () => {
    const valid = {
      imageUrl: "https://example.com/image.png",
      prompt: "请描述这张图片",
    };
    expect(visionRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝非 URL 的 imageUrl", () => {
    const invalid = { imageUrl: "not-a-url", prompt: "x" };
    expect(visionRequestSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("visionResponseSchema", () => {
  const validResponse = {
    content: "图片描述...",
    model: "gpt-4-vision",
    finishReason: "stop",
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
    isAiAssisted: true as const,
    requiresHumanReview: true,
    latencyMs: 1500,
  };

  it("应该接受合法的视觉响应", () => {
    expect(visionResponseSchema.safeParse(validResponse).success).toBe(true);
  });

  it("安全红线：应该拒绝 isAiAssisted=false", () => {
    const invalid = { ...validResponse, isAiAssisted: false };
    expect(visionResponseSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("embeddingRequestSchema", () => {
  it("应该接受合法的向量化请求", () => {
    const valid = { input: "文本内容" };
    expect(embeddingRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝空 input", () => {
    const invalid = { input: "" };
    expect(embeddingRequestSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("embeddingResponseSchema", () => {
  it("应该接受合法的向量化响应", () => {
    const valid = {
      embedding: [0.1, 0.2, 0.3],
      dimensions: 3,
      model: "text-embedding-3-small",
      usage: {
        promptTokens: 10,
        completionTokens: 0,
        totalTokens: 10,
      },
      latencyMs: 100,
    };
    expect(embeddingResponseSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝 dimensions 非正数", () => {
    const invalid = {
      embedding: [],
      dimensions: 0,
      model: "x",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latencyMs: 0,
    };
    expect(embeddingResponseSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("promptRiskLevelSchema", () => {
  it("应该接受所有 4 个风险等级", () => {
    ["low", "medium", "high", "critical"].forEach((v) => {
      expect(promptRiskLevelSchema.safeParse(v).success).toBe(true);
    });
  });

  it("应该拒绝非法值", () => {
    expect(promptRiskLevelSchema.safeParse("INVALID").success).toBe(false);
  });
});

describe("promptTemplateDtoSchema", () => {
  const validTemplate = {
    name: "concept-generation",
    version: "v1",
    description: "概念生成模板",
    template: "请根据 {{siteDescription}} 生成方案",
    variables: ["siteDescription"],
    riskLevel: "medium" as const,
    requiresHumanReview: true,
  };

  it("应该接受合法的 Prompt 模板", () => {
    expect(promptTemplateDtoSchema.safeParse(validTemplate).success).toBe(true);
  });

  it("应该拒绝缺少 requiresHumanReview", () => {
    const { ...rest } = validTemplate;
    const { requiresHumanReview: _, ...without } = rest;
    expect(promptTemplateDtoSchema.safeParse(without).success).toBe(false);
  });

  it("应该拒绝非法 riskLevel", () => {
    const invalid = { ...validTemplate, riskLevel: "INVALID" };
    expect(promptTemplateDtoSchema.safeParse(invalid).success).toBe(false);
  });
});
