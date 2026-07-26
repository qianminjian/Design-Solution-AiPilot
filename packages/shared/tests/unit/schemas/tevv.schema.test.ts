/**
 * TEVV 域 Zod Schema 单元测试
 *
 * 验证：
 *  - schema 与 tevv.contract.ts 类型对齐
 *  - 正例：合法 fixture 通过校验
 *  - 负例：缺字段、错误枚举值、非 UUID/非 ISO datetime 被拒绝
 *  - 风险等级字段强制存在（security.md §12 AI 安全红线）
 */
import { describe, it, expect } from "vitest";
import {
  datasetCategorySchema,
  datasetStatusSchema,
  verificationTypeSchema,
  verificationStatusSchema,
  riskLevelSchema,
  goldenDatasetDtoSchema,
  createGoldenDatasetRequestSchema,
  verificationItemDtoSchema,
  createVerificationItemRequestSchema,
} from "../../../src/schemas/tevv.schema";

const validDataset = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "办公建筑金样 1.0",
  description: "中小型办公建筑金样数据集",
  category: "ARCHITECTURE",
  buildingType: "OFFICE",
  version: 1,
  fileCount: 12,
  status: "FROZEN",
  storageKey: "datasets/office-v1.zip",
  frozenAt: "2026-07-25T08:00:00.000Z",
  createdAt: "2026-07-25T08:00:00.000Z",
  updatedAt: "2026-07-25T08:00:00.000Z",
};

const validVerificationItem = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  datasetId: "550e8400-e29b-41d4-a716-446655440000",
  gateCode: "G2",
  verificationType: "MANUAL",
  riskLevel: "HIGH",
  status: "PENDING",
  description: "G2 方案评审验证项",
  waiverReason: undefined,
  verifiedBy: undefined,
  verifiedAt: undefined,
  createdAt: "2026-07-25T08:00:00.000Z",
};

// ── 枚举 schema ──

describe("datasetCategorySchema", () => {
  it("应该接受所有合法枚举值", () => {
    for (const v of [
      "ARCHITECTURE",
      "STRUCTURE",
      "MEP",
      "INTERIOR",
      "LANDSCAPE",
    ]) {
      expect(datasetCategorySchema.safeParse(v).success).toBe(true);
    }
  });

  it("应该拒绝非法枚举值", () => {
    expect(datasetCategorySchema.safeParse("UNKNOWN").success).toBe(false);
  });
});

describe("datasetStatusSchema", () => {
  it("应该接受所有合法枚举值", () => {
    for (const v of ["DRAFT", "FROZEN", "DEPRECATED"]) {
      expect(datasetStatusSchema.safeParse(v).success).toBe(true);
    }
  });
});

describe("verificationTypeSchema", () => {
  it("应该接受 MANUAL 与 AUTOMATED", () => {
    expect(verificationTypeSchema.safeParse("MANUAL").success).toBe(true);
    expect(verificationTypeSchema.safeParse("AUTOMATED").success).toBe(true);
  });
});

describe("verificationStatusSchema", () => {
  it("应该接受所有合法枚举值", () => {
    for (const v of ["PENDING", "PASSED", "FAILED", "WAIVED"]) {
      expect(verificationStatusSchema.safeParse(v).success).toBe(true);
    }
  });
});

describe("riskLevelSchema", () => {
  it("应该接受所有合法枚举值", () => {
    for (const v of ["LOW", "MEDIUM", "HIGH", "CRITICAL"]) {
      expect(riskLevelSchema.safeParse(v).success).toBe(true);
    }
  });

  it("应该拒绝非法枚举值", () => {
    expect(riskLevelSchema.safeParse("UNKNOWN").success).toBe(false);
  });
});

// ── DTO schema ──

describe("goldenDatasetDtoSchema", () => {
  it("应该接受合法的金样数据集", () => {
    const result = goldenDatasetDtoSchema.safeParse(validDataset);
    expect(result.success).toBe(true);
  });

  it("应该接受无可选字段的最简形式", () => {
    const minimal = {
      id: validDataset.id,
      name: "最小数据集",
      category: "ARCHITECTURE",
      buildingType: "OFFICE",
      version: 1,
      fileCount: 0,
      status: "DRAFT",
      createdAt: "2026-07-25T08:00:00.000Z",
    };
    const result = goldenDatasetDtoSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it("应该拒绝非 UUID 的 id", () => {
    const result = goldenDatasetDtoSchema.safeParse({
      ...validDataset,
      id: "not-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝非法 category 枚举值", () => {
    const result = goldenDatasetDtoSchema.safeParse({
      ...validDataset,
      category: "UNKNOWN",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝负数的 fileCount", () => {
    const result = goldenDatasetDtoSchema.safeParse({
      ...validDataset,
      fileCount: -1,
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝非 ISO datetime 的 createdAt", () => {
    const result = goldenDatasetDtoSchema.safeParse({
      ...validDataset,
      createdAt: "2026-07-25 08:00:00",
    });
    expect(result.success).toBe(false);
  });
});

describe("createGoldenDatasetRequestSchema", () => {
  it("应该接受合法的创建请求", () => {
    const valid = {
      name: "新数据集",
      description: "描述",
      category: "ARCHITECTURE",
      buildingType: "OFFICE",
      storageKey: "datasets/new.zip",
    };
    const result = createGoldenDatasetRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该接受无 description 的简略形式", () => {
    const minimal = {
      name: "新数据集",
      category: "ARCHITECTURE",
      buildingType: "OFFICE",
      storageKey: "datasets/new.zip",
    };
    const result = createGoldenDatasetRequestSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it("应该拒绝缺失 storageKey", () => {
    const { storageKey: _removed, ...rest } = {
      name: "新数据集",
      category: "ARCHITECTURE",
      buildingType: "OFFICE",
      storageKey: "datasets/new.zip",
    };
    const result = createGoldenDatasetRequestSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe("verificationItemDtoSchema", () => {
  it("应该接受合法的验证项", () => {
    const result = verificationItemDtoSchema.safeParse(validVerificationItem);
    expect(result.success).toBe(true);
  });

  it("应该接受 WAIVED 状态与 waiverReason", () => {
    const result = verificationItemDtoSchema.safeParse({
      ...validVerificationItem,
      status: "WAIVED",
      waiverReason: "客户豁免",
    });
    expect(result.success).toBe(true);
  });

  it("应该接受 PASSED 状态与 verifiedBy/verifiedAt", () => {
    const result = verificationItemDtoSchema.safeParse({
      ...validVerificationItem,
      status: "PASSED",
      verifiedBy: "550e8400-e29b-41d4-a716-446655440099",
      verifiedAt: "2026-07-25T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("风险等级红线：应该拒绝缺失 riskLevel", () => {
    const { riskLevel: _removed, ...rest } = validVerificationItem;
    const result = verificationItemDtoSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("应该拒绝非法 riskLevel 枚举值", () => {
    const result = verificationItemDtoSchema.safeParse({
      ...validVerificationItem,
      riskLevel: "UNKNOWN",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝非 UUID 的 datasetId", () => {
    const result = verificationItemDtoSchema.safeParse({
      ...validVerificationItem,
      datasetId: "not-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("createVerificationItemRequestSchema", () => {
  it("应该接受合法的创建请求", () => {
    const valid = {
      datasetId: "550e8400-e29b-41d4-a716-446655440000",
      gateCode: "G2",
      verificationType: "AUTOMATED",
      riskLevel: "MEDIUM",
      description: "自动化验证项",
    };
    const result = createVerificationItemRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该拒绝缺失 riskLevel", () => {
    const { riskLevel: _removed, ...rest } = {
      datasetId: "550e8400-e29b-41d4-a716-446655440000",
      gateCode: "G2",
      verificationType: "AUTOMATED",
      riskLevel: "MEDIUM",
      description: "自动化验证项",
    };
    const result = createVerificationItemRequestSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
