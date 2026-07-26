/**
 * AI 生成记录域 Zod Schema 单元测试
 *
 * 验证：
 *  - schema 与 ai-generation-record.contract.ts 类型对齐
 *  - 正例：合法 fixture 通过校验
 *  - 负例：缺字段、错误枚举值、非 UUID 被拒绝
 *  - AI 安全红线：风险等级、复核状态字段强制存在
 */
import { describe, it, expect } from "vitest";
import {
  aiRecordRiskLevelSchema,
  aiReviewStatusSchema,
  aiReviewDecisionSchema,
  submitReviewRequestSchema,
  createAiGenerationRecordRequestSchema,
  aiGenerationRecordDtoSchema,
} from "../../../src/schemas/ai-generation-record.schema";

const validUsage = {
  promptTokens: 100,
  completionTokens: 200,
  totalTokens: 300,
};

const validGuardrail = {
  passed: true,
  warnings: [],
  escalatedReview: false,
};

const validCreateRequest = {
  projectId: "550e8400-e29b-41d4-a716-446655440000",
  promptTemplate: "concept-generation",
  renderedPrompt: "Prompt 内容",
  rawContent: "原始 LLM 输出",
  candidates: { a: "候选 A" },
  model: "gpt-4-turbo",
  tokenUsage: validUsage,
  riskLevel: "medium",
  guardrailResult: validGuardrail,
};

const validRecord = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  tenantId: "550e8400-e29b-41d4-a716-446655440002",
  projectId: "550e8400-e29b-41d4-a716-446655440000",
  promptTemplate: "concept-generation",
  renderedPrompt: "Prompt",
  rawContent: "raw",
  candidates: { a: "候选 A" },
  model: "gpt-4-turbo",
  tokenUsage: validUsage,
  riskLevel: "high",
  guardrailResult: validGuardrail,
  requiresHumanReview: true,
  latencyMs: 1200,
  reviewStatus: "PENDING",
  createdAt: "2026-07-25T08:00:00.000Z",
  updatedAt: "2026-07-25T08:00:00.000Z",
  rowVersion: 1,
};

// ── 枚举 ──

describe("aiRecordRiskLevelSchema", () => {
  it("应该接受所有合法枚举值", () => {
    for (const v of ["low", "medium", "high", "critical"]) {
      expect(aiRecordRiskLevelSchema.safeParse(v).success).toBe(true);
    }
  });
});

describe("aiReviewStatusSchema", () => {
  it("应该接受所有合法枚举值", () => {
    for (const v of ["PENDING", "APPROVED", "REJECTED", "RETURNED"]) {
      expect(aiReviewStatusSchema.safeParse(v).success).toBe(true);
    }
  });

  it("应该拒绝非法枚举值", () => {
    expect(aiReviewStatusSchema.safeParse("DRAFT").success).toBe(false);
  });
});

describe("aiReviewDecisionSchema", () => {
  it("应该接受 APPROVED/REJECTED/RETURNED", () => {
    for (const v of ["APPROVED", "REJECTED", "RETURNED"]) {
      expect(aiReviewDecisionSchema.safeParse(v).success).toBe(true);
    }
  });

  it("应该拒绝 PENDING（用户不能直接提交 PENDING）", () => {
    expect(aiReviewDecisionSchema.safeParse("PENDING").success).toBe(false);
  });
});

// ── submitReviewRequestSchema ──

describe("submitReviewRequestSchema", () => {
  it("应该接受合法的复核决策请求", () => {
    const result = submitReviewRequestSchema.safeParse({
      decision: "APPROVED",
      comment: "通过",
      decisionContext: { secondReviewer: "user-002" },
    });
    expect(result.success).toBe(true);
  });

  it("应该接受无 comment 与 decisionContext 的简略形式", () => {
    const result = submitReviewRequestSchema.safeParse({
      decision: "REJECTED",
    });
    expect(result.success).toBe(true);
  });

  it("应该拒绝缺失 decision", () => {
    const result = submitReviewRequestSchema.safeParse({
      comment: "通过",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝 PENDING 决策（不能直接提交 PENDING）", () => {
    const result = submitReviewRequestSchema.safeParse({
      decision: "PENDING",
    });
    expect(result.success).toBe(false);
  });
});

// ── createAiGenerationRecordRequestSchema ──

describe("createAiGenerationRecordRequestSchema", () => {
  it("应该接受合法的创建请求", () => {
    const result =
      createAiGenerationRecordRequestSchema.safeParse(validCreateRequest);
    expect(result.success).toBe(true);
  });

  it("应该接受可选 designOptionId", () => {
    const result = createAiGenerationRecordRequestSchema.safeParse({
      ...validCreateRequest,
      designOptionId: "550e8400-e29b-41d4-a716-446655440099",
    });
    expect(result.success).toBe(true);
  });

  it("应该拒绝非 UUID 的 projectId", () => {
    const result = createAiGenerationRecordRequestSchema.safeParse({
      ...validCreateRequest,
      projectId: "not-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝缺失 riskLevel", () => {
    const { riskLevel: _removed, ...rest } = validCreateRequest;
    const result = createAiGenerationRecordRequestSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("应该拒绝缺失 guardrailResult", () => {
    const { guardrailResult: _removed, ...rest } = validCreateRequest;
    const result = createAiGenerationRecordRequestSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ── aiGenerationRecordDtoSchema ──

describe("aiGenerationRecordDtoSchema", () => {
  it("应该接受合法的 AI 生成记录", () => {
    const result = aiGenerationRecordDtoSchema.safeParse(validRecord);
    expect(result.success).toBe(true);
  });

  it("应该接受 designOptionId 为 null", () => {
    const result = aiGenerationRecordDtoSchema.safeParse({
      ...validRecord,
      designOptionId: null,
    });
    expect(result.success).toBe(true);
  });

  it("应该接受 reviewerId 为 null 与 reviewComment 为 null", () => {
    const result = aiGenerationRecordDtoSchema.safeParse({
      ...validRecord,
      reviewerId: null,
      reviewComment: null,
      reviewedAt: null,
      reviewDecision: null,
    });
    expect(result.success).toBe(true);
  });

  it("应该接受 APPROVED 状态与完整复核信息", () => {
    const result = aiGenerationRecordDtoSchema.safeParse({
      ...validRecord,
      reviewStatus: "APPROVED",
      reviewerId: "550e8400-e29b-41d4-a716-446655440099",
      reviewComment: "通过",
      reviewedAt: "2026-07-25T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("AI 安全红线：应该拒绝缺失 riskLevel", () => {
    const { riskLevel: _removed, ...rest } = validRecord;
    const result = aiGenerationRecordDtoSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("AI 安全红线：应该拒绝缺失 requiresHumanReview", () => {
    const { requiresHumanReview: _removed, ...rest } = validRecord;
    const result = aiGenerationRecordDtoSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("应该拒绝缺失 reviewStatus", () => {
    const { reviewStatus: _removed, ...rest } = validRecord;
    const result = aiGenerationRecordDtoSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("应该拒绝非法 reviewStatus 枚举值", () => {
    const result = aiGenerationRecordDtoSchema.safeParse({
      ...validRecord,
      reviewStatus: "UNKNOWN",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝非 ISO datetime 的 createdAt", () => {
    const result = aiGenerationRecordDtoSchema.safeParse({
      ...validRecord,
      createdAt: "2026-07-25 08:00:00",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝负数 rowVersion", () => {
    const result = aiGenerationRecordDtoSchema.safeParse({
      ...validRecord,
      rowVersion: -1,
    });
    expect(result.success).toBe(false);
  });
});
