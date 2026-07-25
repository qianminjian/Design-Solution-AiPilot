/**
 * 合规规则引擎域 Zod Schema 单元测试
 *
 * 验证：
 *  - schema 与 compliance.contract.ts 类型对齐
 *  - 严格状态分离（project_memory 要求）：6 种 outcome
 *  - 规则状态 / 检查运行状态枚举
 *  - IDS 导入请求 xmlContent 必填
 *  - 关键字段：UUID 格式、乐观锁版本号
 */
import { describe, it, expect } from "vitest";
import {
  checkOutcomeSchema,
  ruleStatusSchema,
  checkRunStatusSchema,
  complianceRuleDtoSchema,
  ruleRevisionDtoSchema,
  ruleExecutionDtoSchema,
  complianceCheckRunDtoSchema,
  checkResultDtoSchema,
  createRuleRequestSchema,
  createCheckRunRequestSchema,
  createRuleRevisionRequestSchema,
  idsImportRequestSchema,
  idsImportResponseSchema,
} from "../../../src/schemas/compliance.schema";

describe("枚举 schema", () => {
  it("checkOutcomeSchema 应该接受所有 6 种状态（严格状态分离）", () => {
    [
      "PASS",
      "FAIL",
      "NOT_APPLICABLE",
      "INDETERMINATE",
      "ERROR",
      "MANUAL_REVIEW",
    ].forEach((v) => {
      expect(checkOutcomeSchema.safeParse(v).success).toBe(true);
    });
  });

  it("checkOutcomeSchema 应该拒绝非法值", () => {
    expect(checkOutcomeSchema.safeParse("WARNING").success).toBe(false);
  });

  it("ruleStatusSchema 应该接受所有 4 种规则状态", () => {
    ["DRAFT", "ACTIVE", "DEPRECATED", "ARCHIVED"].forEach((v) => {
      expect(ruleStatusSchema.safeParse(v).success).toBe(true);
    });
  });

  it("checkRunStatusSchema 应该接受所有 5 种运行状态", () => {
    ["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"].forEach((v) => {
      expect(checkRunStatusSchema.safeParse(v).success).toBe(true);
    });
  });
});

describe("complianceRuleDtoSchema", () => {
  const validRule = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    tenantId: "550e8400-e29b-41d4-a716-446655440001",
    ruleCode: "R-001",
    name: "楼梯最小宽度",
    category: "ARCHITECTURE",
    owner: null,
    status: "ACTIVE",
    description: "楼梯最小宽度不小于 1.2m",
    basis: { standard: "GB 50352", clause: "5.7.1" },
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:00.000Z",
    createdBy: null,
    updatedBy: null,
    rowVersion: 1,
  };

  it("应该接受合法的规则 DTO", () => {
    expect(complianceRuleDtoSchema.safeParse(validRule).success).toBe(true);
  });

  it("应该拒绝空 ruleCode", () => {
    const invalid = { ...validRule, ruleCode: "" };
    expect(complianceRuleDtoSchema.safeParse(invalid).success).toBe(false);
  });

  it("应该接受 basis 为 null", () => {
    const valid = { ...validRule, basis: null };
    expect(complianceRuleDtoSchema.safeParse(valid).success).toBe(true);
  });
});

describe("ruleRevisionDtoSchema", () => {
  const validRevision = {
    id: "550e8400-e29b-41d4-a716-446655440010",
    tenantId: "550e8400-e29b-41d4-a716-446655440001",
    ruleId: "550e8400-e29b-41d4-a716-446655440000",
    revisionNo: 1,
    dslJson: '{"condition":"<","threshold":1.2}',
    parametersJson: null,
    basis: "GB 50352 §5.7.1",
    engineProfile: "default",
    status: "ACTIVE",
    createdAt: "2026-07-25T08:00:00.000Z",
    createdBy: null,
    rowVersion: 1,
  };

  it("应该接受合法的规则修订", () => {
    expect(ruleRevisionDtoSchema.safeParse(validRevision).success).toBe(true);
  });
});

describe("ruleExecutionDtoSchema", () => {
  const validExecution = {
    id: "550e8400-e29b-41d4-a716-446655440020",
    tenantId: "550e8400-e29b-41d4-a716-446655440001",
    runId: "550e8400-e29b-41d4-a716-446655440030",
    revisionId: "550e8400-e29b-41d4-a716-446655440010",
    applicabilityCount: 10,
    passCount: 8,
    failCount: 1,
    notApplicableCount: 1,
    indeterminateCount: 0,
    errorCount: 0,
    manualReviewCount: 0,
    status: "COMPLETED",
    durationMs: 1500,
    logs: null,
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:00.000Z",
    rowVersion: 1,
  };

  it("应该接受合法的执行统计", () => {
    expect(ruleExecutionDtoSchema.safeParse(validExecution).success).toBe(true);
  });

  it("应该拒绝负数 passCount", () => {
    const invalid = { ...validExecution, passCount: -1 };
    expect(ruleExecutionDtoSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("complianceCheckRunDtoSchema", () => {
  const validCheckRun = {
    id: "550e8400-e29b-41d4-a716-446655440030",
    tenantId: "550e8400-e29b-41d4-a716-446655440001",
    projectId: null,
    ruleSetId: "550e8400-e29b-41d4-a716-446655440040",
    status: "COMPLETED",
    outcomeSummary: "10/12 通过",
    executions: [],
    startedAt: "2026-07-25T08:00:00.000Z",
    completedAt: "2026-07-25T08:00:30.000Z",
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:30.000Z",
    createdBy: null,
    updatedBy: null,
    rowVersion: 1,
  };

  it("应该接受合法的检查运行", () => {
    expect(complianceCheckRunDtoSchema.safeParse(validCheckRun).success).toBe(
      true,
    );
  });
});

describe("checkResultDtoSchema", () => {
  const validResult = {
    id: "550e8400-e29b-41d4-a716-446655440050",
    tenantId: "550e8400-e29b-41d4-a716-446655440001",
    executionId: "550e8400-e29b-41d4-a716-446655440020",
    objectId: null,
    objectType: null,
    outcome: "PASS" as const,
    measuredValue: "1.5m",
    threshold: "1.2m",
    explanation: "楼梯宽度 1.5m 满足最小 1.2m 要求",
    evidenceJson: null,
    createdAt: "2026-07-25T08:00:00.000Z",
    createdBy: null,
    rowVersion: 1,
  };

  it("应该接受合法的检查结果", () => {
    expect(checkResultDtoSchema.safeParse(validResult).success).toBe(true);
  });

  it("应该接受 MANUAL_REVIEW 状态（触发人工复核）", () => {
    const valid = { ...validResult, outcome: "MANUAL_REVIEW" };
    expect(checkResultDtoSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝非 6 种状态的 outcome（严格状态分离）", () => {
    const invalid = { ...validResult, outcome: "WARNING" };
    expect(checkResultDtoSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("createRuleRequestSchema", () => {
  it("应该接受合法的创建规则请求", () => {
    const valid = {
      ruleCode: "R-001",
      name: "楼梯最小宽度",
      category: "ARCHITECTURE",
    };
    expect(createRuleRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝空 ruleCode", () => {
    const invalid = { ruleCode: "", name: "x", category: "x" };
    expect(createRuleRequestSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("createCheckRunRequestSchema", () => {
  it("应该接受合法的创建检查运行请求", () => {
    const valid = {
      ruleSetId: "550e8400-e29b-41d4-a716-446655440040",
      projectId: "550e8400-e29b-41d4-a716-446655440000",
    };
    expect(createCheckRunRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝非 UUID 的 ruleSetId", () => {
    const invalid = { ruleSetId: "not-uuid" };
    expect(createCheckRunRequestSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("createRuleRevisionRequestSchema", () => {
  it("应该接受合法的修订请求（全可选字段）", () => {
    const valid = {
      dslJson: '{"condition":"<","threshold":1.5}',
      basis: "GB 50352 §5.7.1",
    };
    expect(createRuleRevisionRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("应该接受空对象", () => {
    const valid = {};
    expect(createRuleRevisionRequestSchema.safeParse(valid).success).toBe(true);
  });
});

describe("idsImportRequestSchema", () => {
  it("应该接受非空 xmlContent", () => {
    const valid = { xmlContent: "<ids>...</ids>" };
    expect(idsImportRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝空 xmlContent", () => {
    const invalid = { xmlContent: "" };
    expect(idsImportRequestSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("idsImportResponseSchema", () => {
  it("应该接受合法的导入响应", () => {
    const valid = {
      importedCount: 10,
      failedCount: 2,
      errors: ["第 3 行 XML 解析失败", "第 7 行规格缺失"],
    };
    expect(idsImportResponseSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝负数 importedCount", () => {
    const invalid = {
      importedCount: -1,
      failedCount: 0,
      errors: [],
    };
    expect(idsImportResponseSchema.safeParse(invalid).success).toBe(false);
  });
});
