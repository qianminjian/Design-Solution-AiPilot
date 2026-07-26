/**
 * Design 域 Zod Schema 单元测试
 *
 * 验证：
 *  - schema 与 design.contract.ts 类型对齐
 *  - 正例：合法 fixture 通过校验
 *  - 负例：缺字段、错误枚举值、rating 越界被拒绝
 */
import { describe, it, expect } from "vitest";
import {
  designOptionStatusSchema,
  designDisciplineSchema,
  designOptionDtoSchema,
  createDesignOptionRequestSchema,
  designFeedbackDtoSchema,
  designFeedbackRequestSchema,
} from "../../../src/schemas/design.schema";

const validOption = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  tenantId: "550e8400-e29b-41d4-a716-446655440001",
  projectId: "550e8400-e29b-41d4-a716-446655440002",
  title: "方案 A",
  status: "DRAFT",
  discipline: "ARCHITECTURE",
  createdAt: "2026-07-25T08:00:00.000Z",
  updatedAt: "2026-07-25T08:00:00.000Z",
  rowVersion: 1,
};

const validFeedback = {
  id: "550e8400-e29b-41d4-a716-446655440003",
  optionId: "550e8400-e29b-41d4-a716-446655440000",
  authorId: "550e8400-e29b-41d4-a716-446655440099",
  comment: "方案合理",
  rating: 4,
  createdAt: "2026-07-25T10:00:00.000Z",
};

// ── 枚举 ──

describe("designOptionStatusSchema", () => {
  it("应该接受所有合法枚举值", () => {
    for (const v of [
      "DRAFT",
      "CANDIDATE",
      "SUBMITTED",
      "ACCEPTED",
      "RETURNED",
      "ARCHIVED",
    ]) {
      expect(designOptionStatusSchema.safeParse(v).success).toBe(true);
    }
  });

  it("应该拒绝非法枚举值", () => {
    expect(designOptionStatusSchema.safeParse("UNKNOWN").success).toBe(false);
  });
});

describe("designDisciplineSchema", () => {
  it("应该接受所有合法枚举值", () => {
    for (const v of [
      "ARCHITECTURE",
      "STRUCTURE",
      "MEP",
      "LANDSCAPE",
      "INTERIOR",
    ]) {
      expect(designDisciplineSchema.safeParse(v).success).toBe(true);
    }
  });
});

// ── designOptionDtoSchema ──

describe("designOptionDtoSchema", () => {
  it("应该接受合法的设计选项", () => {
    const result = designOptionDtoSchema.safeParse(validOption);
    expect(result.success).toBe(true);
  });

  it("应该接受含 description 与 metadata 的完整形式", () => {
    const result = designOptionDtoSchema.safeParse({
      ...validOption,
      description: "塔楼 + 裙房",
      metadata: { area: 5000 },
    });
    expect(result.success).toBe(true);
  });

  it("应该拒绝非法 status 枚举值", () => {
    const result = designOptionDtoSchema.safeParse({
      ...validOption,
      status: "UNKNOWN",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝负数 rowVersion", () => {
    const result = designOptionDtoSchema.safeParse({
      ...validOption,
      rowVersion: -1,
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝非 UUID 的 thumbnailDocumentId", () => {
    const result = designOptionDtoSchema.safeParse({
      ...validOption,
      thumbnailDocumentId: "not-uuid",
    });
    expect(result.success).toBe(false);
  });
});

// ── createDesignOptionRequestSchema ──

describe("createDesignOptionRequestSchema", () => {
  it("应该接受合法的创建请求", () => {
    const valid = {
      projectId: "550e8400-e29b-41d4-a716-446655440002",
      title: "方案 A",
    };
    const result = createDesignOptionRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该接受含 discipline 的请求", () => {
    const result = createDesignOptionRequestSchema.safeParse({
      projectId: "550e8400-e29b-41d4-a716-446655440002",
      title: "方案 A",
      discipline: "STRUCTURE",
    });
    expect(result.success).toBe(true);
  });

  it("应该拒绝非 UUID 的 projectId", () => {
    const result = createDesignOptionRequestSchema.safeParse({
      projectId: "not-uuid",
      title: "方案 A",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝空 title", () => {
    const result = createDesignOptionRequestSchema.safeParse({
      projectId: "550e8400-e29b-41d4-a716-446655440002",
      title: "",
    });
    expect(result.success).toBe(false);
  });
});

// ── designFeedbackDtoSchema ──

describe("designFeedbackDtoSchema", () => {
  it("应该接受合法的反馈", () => {
    const result = designFeedbackDtoSchema.safeParse(validFeedback);
    expect(result.success).toBe(true);
  });

  it("应该接受无 rating 的反馈", () => {
    const { rating: _removed, ...rest } = validFeedback;
    const result = designFeedbackDtoSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("应该拒绝 rating 超过 5", () => {
    const result = designFeedbackDtoSchema.safeParse({
      ...validFeedback,
      rating: 6,
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝 rating 小于 0", () => {
    const result = designFeedbackDtoSchema.safeParse({
      ...validFeedback,
      rating: -1,
    });
    expect(result.success).toBe(false);
  });
});

// ── designFeedbackRequestSchema ──

describe("designFeedbackRequestSchema", () => {
  it("应该接受合法的反馈请求", () => {
    const result = designFeedbackRequestSchema.safeParse({
      comment: "合理",
      rating: 5,
    });
    expect(result.success).toBe(true);
  });

  it("应该接受无 rating 的请求", () => {
    const result = designFeedbackRequestSchema.safeParse({
      comment: "合理",
    });
    expect(result.success).toBe(true);
  });

  it("应该拒绝空 comment", () => {
    const result = designFeedbackRequestSchema.safeParse({
      comment: "",
    });
    expect(result.success).toBe(false);
  });
});
