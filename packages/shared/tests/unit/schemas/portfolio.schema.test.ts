/**
 * Portfolio 域 Zod Schema 单元测试
 *
 * 验证：
 *  - schema 与 portfolio.contract.ts 类型对齐
 *  - 正例：合法 fixture 通过校验
 *  - 负例：缺字段、错误枚举值、负数楼层被拒绝
 *  - 业务不变量：floorsMin 不能大于 floorsMax
 *  - 关键字段：UUID 格式、乐观锁版本号、ISO 日期时间
 */
import { describe, it, expect } from "vitest";
import {
  projectStatusSchema,
  buildingTypeSchema,
  stageStatusSchema,
  gateDecisionSchema,
  stageCodeSchema,
  gateCodeSchema,
  projectDtoSchema,
  stageInstanceDtoSchema,
  gateDecisionDtoSchema,
  projectBaselineDtoSchema,
  createProjectRequestSchema,
  updateProjectRequestSchema,
  listProjectsRequestSchema,
  transitionStageRequestSchema,
  freezeBaselineRequestSchema,
  decideGateRequestSchema,
} from "../../../src/schemas/portfolio.schema";

const validProjectDto = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  tenantId: "550e8400-e29b-41d4-a716-446655440001",
  organizationId: null,
  code: "PJ-001",
  name: "Acme 总部办公楼",
  description: "5-15 层框架办公楼",
  status: "active" as const,
  buildingType: "office" as const,
  floorsMin: 5,
  floorsMax: 15,
  gfa: "12000.50",
  siteArea: "1500.00",
  region: "CN",
  language: "zh",
  classification: "project_record",
  settings: {},
  metadata: {},
  startedAt: null,
  targetCompletionAt: "2027-12-31T00:00:00.000Z",
  createdAt: "2026-07-25T08:00:00.000Z",
  updatedAt: "2026-07-25T08:00:00.000Z",
  createdBy: "550e8400-e29b-41d4-a716-446655440002",
  updatedBy: "550e8400-e29b-41d4-a716-446655440002",
  rowVersion: 1,
};

describe("枚举 schema", () => {
  it("projectStatusSchema 应该接受所有合法值", () => {
    ["active", "on_hold", "completed", "cancelled", "archived"].forEach((v) => {
      expect(projectStatusSchema.safeParse(v).success).toBe(true);
    });
  });

  it("projectStatusSchema 应该拒绝非法值", () => {
    expect(projectStatusSchema.safeParse("invalid").success).toBe(false);
  });

  it("buildingTypeSchema 应该接受所有合法值", () => {
    ["office", "residential", "commercial", "mixed"].forEach((v) => {
      expect(buildingTypeSchema.safeParse(v).success).toBe(true);
    });
  });

  it("stageStatusSchema 应该接受所有 9 种状态", () => {
    [
      "planned",
      "active",
      "review_preparing",
      "under_review",
      "conditionally_approved",
      "approved",
      "suspended",
      "cancelled",
      "closed",
    ].forEach((v) => {
      expect(stageStatusSchema.safeParse(v).success).toBe(true);
    });
  });

  it("gateDecisionSchema 应该接受所有 5 种决策", () => {
    [
      "approved",
      "conditionally_approved",
      "rework_required",
      "suspended",
      "cancelled",
    ].forEach((v) => {
      expect(gateDecisionSchema.safeParse(v).success).toBe(true);
    });
  });

  it("stageCodeSchema 应该接受所有 9 个阶段代码", () => {
    [
      "STG-P0",
      "STG-P1",
      "STG-P2",
      "STG-P3",
      "STG-P4",
      "STG-P5",
      "STG-P6",
      "STG-P7",
      "STG-P8",
    ].forEach((v) => {
      expect(stageCodeSchema.safeParse(v).success).toBe(true);
    });
  });

  it("gateCodeSchema 应该接受所有 9 个门禁代码", () => {
    ["G0", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"].forEach((v) => {
      expect(gateCodeSchema.safeParse(v).success).toBe(true);
    });
  });
});

describe("projectDtoSchema", () => {
  it("应该接受合法的项目 DTO", () => {
    expect(projectDtoSchema.safeParse(validProjectDto).success).toBe(true);
  });

  it("应该拒绝负数 floorsMin", () => {
    const invalid = { ...validProjectDto, floorsMin: -1 };
    expect(projectDtoSchema.safeParse(invalid).success).toBe(false);
  });

  it("应该拒绝非 UUID 的 id", () => {
    const invalid = { ...validProjectDto, id: "not-uuid" };
    expect(projectDtoSchema.safeParse(invalid).success).toBe(false);
  });

  it("应该拒绝非法 status 枚举值", () => {
    const invalid = { ...validProjectDto, status: "invalid" };
    expect(projectDtoSchema.safeParse(invalid).success).toBe(false);
  });

  it("应该拒绝非 ISO 日期时间格式的 createdAt", () => {
    const invalid = { ...validProjectDto, createdAt: "2026-07-25" };
    expect(projectDtoSchema.safeParse(invalid).success).toBe(false);
  });

  it("应该接受 organizationId 为 null", () => {
    const valid = { ...validProjectDto, organizationId: null };
    expect(projectDtoSchema.safeParse(valid).success).toBe(true);
  });

  it("应该接受 UUID 格式的 organizationId", () => {
    const valid = {
      ...validProjectDto,
      organizationId: "550e8400-e29b-41d4-a716-446655440003",
    };
    expect(projectDtoSchema.safeParse(valid).success).toBe(true);
  });
});

describe("stageInstanceDtoSchema", () => {
  const validStageInstance = {
    id: "550e8400-e29b-41d4-a716-446655440010",
    tenantId: "550e8400-e29b-41d4-a716-446655440001",
    projectId: "550e8400-e29b-41d4-a716-446655440000",
    stageCode: "STG-P0",
    stageName: "前期策划",
    stageOrder: 0,
    status: "planned",
    startedAt: null,
    completedAt: null,
    metadata: {},
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:00.000Z",
    rowVersion: 1,
  };

  it("应该接受合法的阶段实例", () => {
    expect(stageInstanceDtoSchema.safeParse(validStageInstance).success).toBe(
      true,
    );
  });

  it("应该拒绝负数 stageOrder", () => {
    const invalid = { ...validStageInstance, stageOrder: -1 };
    expect(stageInstanceDtoSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("gateDecisionDtoSchema", () => {
  const validGateDecision = {
    id: "550e8400-e29b-41d4-a716-446655440020",
    tenantId: "550e8400-e29b-41d4-a716-446655440001",
    projectId: "550e8400-e29b-41d4-a716-446655440000",
    stageId: null,
    gateCode: "G0",
    gateName: "前期策划与需求门",
    status: "pending",
    decision: null,
    decidedAt: null,
    decidedBy: null,
    baselineId: null,
    comment: null,
    evidence: [],
    metadata: {},
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:00.000Z",
    rowVersion: 1,
  };

  it("应该接受合法的门禁决策", () => {
    expect(gateDecisionDtoSchema.safeParse(validGateDecision).success).toBe(
      true,
    );
  });

  it("应该接受已决策状态与决策结论", () => {
    const valid = {
      ...validGateDecision,
      status: "decided",
      decision: "approved",
      decidedAt: "2026-07-25T10:00:00.000Z",
      decidedBy: "550e8400-e29b-41d4-a716-446655440002",
    };
    expect(gateDecisionDtoSchema.safeParse(valid).success).toBe(true);
  });
});

describe("projectBaselineDtoSchema", () => {
  const validBaseline = {
    id: "550e8400-e29b-41d4-a716-446655440030",
    tenantId: "550e8400-e29b-41d4-a716-446655440001",
    projectId: "550e8400-e29b-41d4-a716-446655440000",
    revisionNo: 1,
    name: "V1 基线",
    status: "frozen",
    frozenAt: "2026-07-25T10:00:00.000Z",
    frozenBy: "550e8400-e29b-41d4-a716-446655440002",
    description: "首次冻结",
    metadata: {},
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:00.000Z",
    rowVersion: 1,
  };

  it("应该接受合法的项目基线", () => {
    expect(projectBaselineDtoSchema.safeParse(validBaseline).success).toBe(
      true,
    );
  });
});

describe("createProjectRequestSchema", () => {
  it("应该接受合法的创建项目请求", () => {
    const valid = {
      name: "Acme 总部办公楼",
      code: "PJ-001",
    };
    expect(createProjectRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝 floorsMin > floorsMax（业务不变量）", () => {
    const invalid = {
      name: "Acme",
      code: "PJ-001",
      floorsMin: 20,
      floorsMax: 10,
    };
    expect(createProjectRequestSchema.safeParse(invalid).success).toBe(false);
  });

  it("应该接受 floorsMin <= floorsMax", () => {
    const valid = {
      name: "Acme",
      code: "PJ-001",
      floorsMin: 5,
      floorsMax: 15,
    };
    expect(createProjectRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("应该接受可选 stages 数组", () => {
    const valid = {
      name: "Acme",
      code: "PJ-001",
      stages: ["STG-P0", "STG-P1", "STG-P5"],
    };
    expect(createProjectRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝非法 stages 代码", () => {
    const invalid = {
      name: "Acme",
      code: "PJ-001",
      stages: ["INVALID"],
    };
    expect(createProjectRequestSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("updateProjectRequestSchema", () => {
  it("应该接受部分更新请求", () => {
    const valid = { name: "新名称" };
    expect(updateProjectRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("应该接受空对象（无字段更新）", () => {
    const valid = {};
    expect(updateProjectRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝 floorsMin > floorsMax", () => {
    const invalid = { floorsMin: 20, floorsMax: 10 };
    expect(updateProjectRequestSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("listProjectsRequestSchema", () => {
  it("应该接受合法的分页查询参数", () => {
    const valid = {
      page: 1,
      pageSize: 20,
      sort: "createdAt",
      order: "desc" as const,
      status: "active" as const,
      keyword: "Acme",
    };
    expect(listProjectsRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝 pageSize > 100", () => {
    const invalid = { pageSize: 200 };
    expect(listProjectsRequestSchema.safeParse(invalid).success).toBe(false);
  });

  it("应该拒绝 page 非正数", () => {
    const invalid = { page: 0 };
    expect(listProjectsRequestSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("transitionStageRequestSchema", () => {
  it("应该接受合法的流转请求", () => {
    const valid = { targetStatus: "active", comment: "开始阶段" };
    expect(transitionStageRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝非法的 targetStatus", () => {
    const invalid = { targetStatus: "invalid" };
    expect(transitionStageRequestSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("freezeBaselineRequestSchema", () => {
  it("应该接受合法的冻结请求", () => {
    const valid = { name: "V2 基线", description: "修订版" };
    expect(freezeBaselineRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝空 name", () => {
    const invalid = { name: "" };
    expect(freezeBaselineRequestSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("decideGateRequestSchema", () => {
  it("应该接受合法的门禁决策请求", () => {
    const valid = {
      decision: "approved",
      comment: "通过",
      baselineId: "550e8400-e29b-41d4-a716-446655440030",
    };
    expect(decideGateRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("应该拒绝缺少 comment", () => {
    const invalid = { decision: "approved" };
    expect(decideGateRequestSchema.safeParse(invalid).success).toBe(false);
  });

  it("应该拒绝非法 decision", () => {
    const invalid = { decision: "invalid", comment: "x" };
    expect(decideGateRequestSchema.safeParse(invalid).success).toBe(false);
  });

  it("应该拒绝非 UUID 的 baselineId", () => {
    const invalid = {
      decision: "approved",
      comment: "通过",
      baselineId: "not-uuid",
    };
    expect(decideGateRequestSchema.safeParse(invalid).success).toBe(false);
  });
});
