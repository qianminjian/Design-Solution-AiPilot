/**
 * Review 域 Zod Schema 单元测试
 *
 * 验证：
 *  - schema 与 use-review.ts hooks 中使用的字段对齐
 *  - 正例：合法 fixture 通过校验
 *  - 负例：缺字段、错误枚举值、confidence 越界被拒绝
 *  - AI 安全红线：isAiAssisted=true / requiresHumanReview 必填
 */
import { describe, it, expect } from "vitest";
import {
  complianceCheckResultSchema,
  complianceCheckRunViewSchema,
  ragSourceSchema,
  ragQueryRequestSchema,
  ragQueryResponseSchema,
  findingSeveritySchema,
  findingStatusSchema,
  complianceFindingSchema,
  gateSummarySchema,
  bcfIssueStatusSchema,
  bcfIssuePrioritySchema,
  bcfIssueSchema,
  updateBcfIssueStatusRequestSchema,
  assignBcfIssueRequestSchema,
} from "../../../src/schemas/review.schema";

// ── 公共 fixture ──

const validCheckResult = {
  id: "check-001",
  ruleName: "楼梯净宽",
  ruleCode: "STAIR_WIDTH_001",
  applicableObjects: 10,
  passCount: 8,
  failCount: 2,
  naCount: 0,
  uncertainCount: 0,
  status: "partial",
  lastRunAt: "2026-07-25T08:00:00.000Z",
};

const validRagSource = {
  id: "src-001",
  title: "GB 50016 建筑设计防火规范",
  url: "https://example.com/gb-50016",
  snippet: "楼梯净宽不应小于 1.1m",
};

const validComplianceFinding = {
  id: "finding-001",
  reviewId: "review-001",
  projectId: "proj-001",
  ruleName: "楼梯净宽",
  ruleCode: "STAIR_WIDTH_001",
  objectName: "楼梯-1",
  objectId: "stair-001",
  severity: "high",
  status: "pending",
  confidence: 0.85,
  description: "楼梯净宽不足 1.1m",
  codeReference: "GB 50016 §5.5",
  suggestedFix: "增加楼梯净宽至 1.2m",
  assignedTo: null,
  createdAt: "2026-07-25T08:00:00.000Z",
  updatedAt: "2026-07-25T08:00:00.000Z",
};

const validBcfIssue = {
  id: "bcf-001",
  projectId: "proj-001",
  issueIndex: 1,
  title: "楼梯与管道碰撞",
  description: "楼梯结构梁与给排水管道碰撞",
  status: "open",
  priority: "high",
  issueType: "clash",
  snapshot: null,
  relatedElements: ["elem-001", "elem-002"],
  assignedTo: null,
  createdBy: "user-001",
  createdAt: "2026-07-25T08:00:00.000Z",
  updatedAt: "2026-07-25T08:00:00.000Z",
};

// ── complianceCheckResultSchema ──

describe("complianceCheckResultSchema", () => {
  it("应该接受合法的检查结果", () => {
    const result = complianceCheckResultSchema.safeParse(validCheckResult);
    expect(result.success).toBe(true);
  });

  it("应该拒绝 status 非法枚举值", () => {
    const result = complianceCheckResultSchema.safeParse({
      ...validCheckResult,
      status: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝 lastRunAt 非 ISO datetime", () => {
    const result = complianceCheckResultSchema.safeParse({
      ...validCheckResult,
      lastRunAt: "2026-07-25 08:00:00",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝负数的 failCount", () => {
    const result = complianceCheckResultSchema.safeParse({
      ...validCheckResult,
      failCount: -1,
    });
    expect(result.success).toBe(false);
  });
});

// ── complianceCheckRunViewSchema ──

describe("complianceCheckRunViewSchema", () => {
  it("应该接受合法的运行聚合视图", () => {
    const valid = {
      id: "run-001",
      projectId: "proj-001",
      status: "completed",
      totalRules: 10,
      passedRules: 8,
      failedRules: 2,
      startedAt: "2026-07-25T08:00:00.000Z",
      completedAt: "2026-07-25T08:05:00.000Z",
      results: [validCheckResult],
    };
    const result = complianceCheckRunViewSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该接受 completedAt 为 null（运行中）", () => {
    const valid = {
      id: "run-002",
      projectId: "proj-001",
      status: "running",
      totalRules: 10,
      passedRules: 0,
      failedRules: 0,
      startedAt: "2026-07-25T08:00:00.000Z",
      completedAt: null,
      results: [],
    };
    const result = complianceCheckRunViewSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该拒绝 status 非法枚举值", () => {
    const invalid = {
      id: "run-001",
      projectId: "proj-001",
      status: "unknown",
      totalRules: 10,
      passedRules: 8,
      failedRules: 2,
      startedAt: "2026-07-25T08:00:00.000Z",
      completedAt: null,
      results: [],
    };
    const result = complianceCheckRunViewSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ── ragSourceSchema ──

describe("ragSourceSchema", () => {
  it("应该接受合法的 RAG 检索来源", () => {
    const result = ragSourceSchema.safeParse(validRagSource);
    expect(result.success).toBe(true);
  });

  it("应该拒绝非 URL 的 url 字段", () => {
    const result = ragSourceSchema.safeParse({
      ...validRagSource,
      url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

// ── ragQueryRequestSchema ──

describe("ragQueryRequestSchema", () => {
  it("应该接受合法的 RAG 问答请求", () => {
    const valid = { projectId: "proj-001", question: "楼梯净宽要求？" };
    const result = ragQueryRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该拒绝空 question", () => {
    const invalid = { projectId: "proj-001", question: "" };
    const result = ragQueryRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ── ragQueryResponseSchema（AI 安全红线） ──

describe("ragQueryResponseSchema", () => {
  const validResponse = {
    id: "rag-001",
    question: "楼梯净宽要求？",
    answer: "根据 GB 50016，楼梯净宽不应小于 1.1m",
    sources: [validRagSource],
    confidence: 0.92,
    isAiAssisted: true,
    requiresHumanReview: true,
    latencyMs: 1200,
  };

  it("应该接受合法的 RAG 问答响应", () => {
    const result = ragQueryResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it("AI 安全红线：应该拒绝 isAiAssisted=false", () => {
    const invalid = { ...validResponse, isAiAssisted: false };
    const result = ragQueryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("AI 安全红线：应该拒绝缺失 isAiAssisted", () => {
    const { isAiAssisted: _removed, ...invalid } = validResponse;
    const result = ragQueryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("AI 安全红线：应该拒绝缺失 requiresHumanReview", () => {
    const { requiresHumanReview: _removed, ...invalid } = validResponse;
    const result = ragQueryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("应该拒绝 confidence 超过 1", () => {
    const invalid = { ...validResponse, confidence: 1.5 };
    const result = ragQueryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("应该拒绝 confidence 小于 0", () => {
    const invalid = { ...validResponse, confidence: -0.1 };
    const result = ragQueryResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ── 枚举 schema ──

describe("findingSeveritySchema", () => {
  it("应该接受所有合法枚举值", () => {
    for (const v of ["critical", "high", "medium", "low"]) {
      expect(findingSeveritySchema.safeParse(v).success).toBe(true);
    }
  });

  it("应该拒绝非法枚举值", () => {
    expect(findingSeveritySchema.safeParse("unknown").success).toBe(false);
  });
});

describe("findingStatusSchema", () => {
  it("应该接受所有合法枚举值", () => {
    for (const v of ["pending", "approved", "rejected", "resolved"]) {
      expect(findingStatusSchema.safeParse(v).success).toBe(true);
    }
  });
});

// ── complianceFindingSchema ──

describe("complianceFindingSchema", () => {
  it("应该接受合法的合规发现", () => {
    const result = complianceFindingSchema.safeParse(validComplianceFinding);
    expect(result.success).toBe(true);
  });

  it("应该接受 assignedTo 为 null", () => {
    const result = complianceFindingSchema.safeParse({
      ...validComplianceFinding,
      assignedTo: null,
    });
    expect(result.success).toBe(true);
  });

  it("应该拒绝 severity 非法枚举值", () => {
    const result = complianceFindingSchema.safeParse({
      ...validComplianceFinding,
      severity: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝缺失 createdAt", () => {
    const { createdAt: _removed, ...invalid } = validComplianceFinding;
    const result = complianceFindingSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ── gateSummarySchema ──

describe("gateSummarySchema", () => {
  const valid = {
    stageName: "方案设计",
    stageCode: "SCHEME",
    gateCode: "G2",
    gateName: "方案评审",
    passRate: 0.85,
    pendingItems: 2,
    totalFindings: 10,
    criticalFindings: 1,
    status: "pass",
  };

  it("应该接受合法的门禁决策概览", () => {
    const result = gateSummarySchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该拒绝 passRate 超过 1", () => {
    const result = gateSummarySchema.safeParse({ ...valid, passRate: 1.5 });
    expect(result.success).toBe(false);
  });

  it("应该拒绝 status 非法枚举值", () => {
    const result = gateSummarySchema.safeParse({
      ...valid,
      status: "unknown",
    });
    expect(result.success).toBe(false);
  });
});

// ── BCF 枚举 ──

describe("bcfIssueStatusSchema", () => {
  it("应该接受所有合法枚举值", () => {
    for (const v of ["open", "in_progress", "resolved", "closed"]) {
      expect(bcfIssueStatusSchema.safeParse(v).success).toBe(true);
    }
  });
});

describe("bcfIssuePrioritySchema", () => {
  it("应该接受所有合法枚举值", () => {
    for (const v of ["critical", "high", "medium", "low"]) {
      expect(bcfIssuePrioritySchema.safeParse(v).success).toBe(true);
    }
  });
});

// ── bcfIssueSchema ──

describe("bcfIssueSchema", () => {
  it("应该接受合法的 BCF 问题", () => {
    const result = bcfIssueSchema.safeParse(validBcfIssue);
    expect(result.success).toBe(true);
  });

  it("应该接受 snapshot 为 null", () => {
    const result = bcfIssueSchema.safeParse({
      ...validBcfIssue,
      snapshot: null,
    });
    expect(result.success).toBe(true);
  });

  it("应该拒绝 status 非法枚举值", () => {
    const result = bcfIssueSchema.safeParse({
      ...validBcfIssue,
      status: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝负数的 issueIndex", () => {
    const result = bcfIssueSchema.safeParse({
      ...validBcfIssue,
      issueIndex: -1,
    });
    expect(result.success).toBe(false);
  });
});

// ── updateBcfIssueStatusRequestSchema ──

describe("updateBcfIssueStatusRequestSchema", () => {
  it("应该接受合法的状态更新请求", () => {
    const result = updateBcfIssueStatusRequestSchema.safeParse({
      status: "in_progress",
    });
    expect(result.success).toBe(true);
  });

  it("应该拒绝非法 status 枚举值", () => {
    const result = updateBcfIssueStatusRequestSchema.safeParse({
      status: "unknown",
    });
    expect(result.success).toBe(false);
  });
});

// ── assignBcfIssueRequestSchema ──

describe("assignBcfIssueRequestSchema", () => {
  it("应该接受合法的指派请求", () => {
    const result = assignBcfIssueRequestSchema.safeParse({
      assignee: "user-001",
    });
    expect(result.success).toBe(true);
  });

  it("应该拒绝空 assignee", () => {
    const result = assignBcfIssueRequestSchema.safeParse({
      assignee: "",
    });
    expect(result.success).toBe(false);
  });
});
