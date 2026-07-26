/**
 * Solutions 域 Zod Schema 单元测试
 *
 * 验证：
 *  - schema 与 solutions.contract.ts 类型对齐
 *  - 正例：合法 fixture 通过校验
 *  - 负例：缺字段、错误枚举值、空候选列表被拒绝
 *  - AI 安全红线：isAiAssisted=true / requiresHumanReview 必填
 */
import { describe, it, expect } from "vitest";
import {
  solutionRiskLevelSchema,
  solutionVariableSchema,
  generateSolutionRequestSchema,
  solutionCandidateSchema,
  guardrailResultSchema,
  generateSolutionResponseSchema,
} from "../../../src/schemas/solutions.schema";

const validCandidate = {
  name: "方案 A",
  content: "# 方案 A\n塔楼 + 裙房布局",
  risks: ["限高不足"],
  feasibilityNotes: "结构可行",
};

const validUsage = {
  promptTokens: 100,
  completionTokens: 200,
  totalTokens: 300,
};

const validGuardrail = {
  passed: true,
  warnings: ["轻微风险"],
  escalatedReview: false,
};

const validResponse = {
  candidates: [validCandidate],
  rawContent: "原始 LLM 输出",
  model: "gpt-4-turbo",
  usage: validUsage,
  riskLevel: "medium",
  promptTemplateUsed: "concept-generation",
  guardrail: validGuardrail,
  isAiAssisted: true,
  requiresHumanReview: true,
  latencyMs: 1500,
};

// ── 枚举 ──

describe("solutionRiskLevelSchema", () => {
  it("应该接受所有合法枚举值", () => {
    for (const v of ["low", "medium", "high", "critical"]) {
      expect(solutionRiskLevelSchema.safeParse(v).success).toBe(true);
    }
  });

  it("应该拒绝非法枚举值", () => {
    expect(solutionRiskLevelSchema.safeParse("unknown").success).toBe(false);
  });
});

// ── solutionVariableSchema ──

describe("solutionVariableSchema", () => {
  it("应该接受合法的变量键值对", () => {
    const result = solutionVariableSchema.safeParse({
      key: "siteDescription",
      value: "上海某地块",
    });
    expect(result.success).toBe(true);
  });

  it("应该拒绝空 key", () => {
    const result = solutionVariableSchema.safeParse({ key: "", value: "x" });
    expect(result.success).toBe(false);
  });
});

// ── generateSolutionRequestSchema ──

describe("generateSolutionRequestSchema", () => {
  it("应该接受合法的方案生成请求", () => {
    const valid = {
      promptTemplate: "concept-generation",
      variables: [{ key: "siteDescription", value: "上海某地块" }],
      temperature: 0.7,
      maxTokens: 2048,
    };
    const result = generateSolutionRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该接受带 projectId 的请求", () => {
    const valid = {
      promptTemplate: "concept-generation",
      variables: [],
      projectId: "550e8400-e29b-41d4-a716-446655440000",
    };
    const result = generateSolutionRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该拒绝 temperature 超过 2", () => {
    const result = generateSolutionRequestSchema.safeParse({
      promptTemplate: "x",
      variables: [],
      temperature: 3,
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝非正数的 maxTokens", () => {
    const result = generateSolutionRequestSchema.safeParse({
      promptTemplate: "x",
      variables: [],
      maxTokens: 0,
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝非 UUID 的 projectId", () => {
    const result = generateSolutionRequestSchema.safeParse({
      promptTemplate: "x",
      variables: [],
      projectId: "not-uuid",
    });
    expect(result.success).toBe(false);
  });
});

// ── solutionCandidateSchema ──

describe("solutionCandidateSchema", () => {
  it("应该接受合法的方案候选", () => {
    const result = solutionCandidateSchema.safeParse(validCandidate);
    expect(result.success).toBe(true);
  });

  it("应该接受 feasibilityNotes 为 null", () => {
    const result = solutionCandidateSchema.safeParse({
      ...validCandidate,
      feasibilityNotes: null,
    });
    expect(result.success).toBe(true);
  });

  it("应该接受空 risks 数组", () => {
    const result = solutionCandidateSchema.safeParse({
      ...validCandidate,
      risks: [],
    });
    expect(result.success).toBe(true);
  });

  it("应该拒绝空 name", () => {
    const result = solutionCandidateSchema.safeParse({
      ...validCandidate,
      name: "",
    });
    expect(result.success).toBe(false);
  });
});

// ── guardrailResultSchema ──

describe("guardrailResultSchema", () => {
  it("应该接受合法的 Guardrails 结果", () => {
    const result = guardrailResultSchema.safeParse(validGuardrail);
    expect(result.success).toBe(true);
  });

  it("应该接受 escalatedReview=true", () => {
    const result = guardrailResultSchema.safeParse({
      ...validGuardrail,
      escalatedReview: true,
    });
    expect(result.success).toBe(true);
  });

  it("应该拒绝缺失 passed 字段", () => {
    const { passed: _removed, ...rest } = validGuardrail;
    const result = guardrailResultSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ── generateSolutionResponseSchema（AI 安全红线） ──

describe("generateSolutionResponseSchema", () => {
  it("应该接受合法的方案生成响应", () => {
    const result = generateSolutionResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it("AI 安全红线：应该拒绝 isAiAssisted=false", () => {
    const result = generateSolutionResponseSchema.safeParse({
      ...validResponse,
      isAiAssisted: false as never,
    });
    expect(result.success).toBe(false);
  });

  it("AI 安全红线：应该拒绝缺失 isAiAssisted", () => {
    const { isAiAssisted: _removed, ...rest } = validResponse;
    const result = generateSolutionResponseSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("AI 安全红线：应该拒绝缺失 requiresHumanReview", () => {
    const { requiresHumanReview: _removed, ...rest } = validResponse;
    const result = generateSolutionResponseSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("应该拒绝空候选列表", () => {
    const result = generateSolutionResponseSchema.safeParse({
      ...validResponse,
      candidates: [],
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝缺失 riskLevel", () => {
    const { riskLevel: _removed, ...rest } = validResponse;
    const result = generateSolutionResponseSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("应该拒绝非法 riskLevel 枚举值", () => {
    const result = generateSolutionResponseSchema.safeParse({
      ...validResponse,
      riskLevel: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝缺失 guardrail 字段", () => {
    const { guardrail: _removed, ...rest } = validResponse;
    const result = generateSolutionResponseSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
