/**
 * Portfolio 域 Zod Schema
 *
 * 权威源：@design/D08-项目-计划-任务编排.md + @design/D05-全流程阶段-阶段门.md + @design/D34-数据-数据库.md §D34.5
 * 对齐：packages/shared/src/contracts/portfolio.contract.ts
 *
 * 用途：
 *  - BFF 代理层验证 Core Service 返回的项目/阶段/门禁/基线 DTO 结构
 *  - 前端运行时验证 fetch 响应，防止 API 漂移导致运行时错误
 *  - Core Service 单元测试使用 schema 验证 DTO 字段类型与必填性
 */
import { z } from "zod";

// ── 枚举 ──

/** 项目状态 schema */
export const projectStatusSchema = z.enum([
  "active",
  "on_hold",
  "completed",
  "cancelled",
  "archived",
]);

/** 建筑类型 schema（OD-02 默认办公） */
export const buildingTypeSchema = z.enum([
  "office",
  "residential",
  "commercial",
  "mixed",
]);

/** 阶段状态 schema（D05.4.1 状态机） */
export const stageStatusSchema = z.enum([
  "planned",
  "active",
  "review_preparing",
  "under_review",
  "conditionally_approved",
  "approved",
  "suspended",
  "cancelled",
  "closed",
]);

/** 门禁状态 schema */
export const gateStatusSchema = z.enum(["pending", "decided", "cancelled"]);

/** 门禁决策结论 schema（D05.4.2） */
export const gateDecisionSchema = z.enum([
  "approved",
  "conditionally_approved",
  "rework_required",
  "suspended",
  "cancelled",
]);

/** 基线修订状态 schema（D34.7） */
export const revisionStatusSchema = z.enum(["draft", "frozen", "superseded"]);

/** 阶段代码 schema（D01 §155 + D05.18 V0 裁剪） */
export const stageCodeSchema = z.enum([
  "STG-P0",
  "STG-P1",
  "STG-P2",
  "STG-P3",
  "STG-P4",
  "STG-P5",
  "STG-P6",
  "STG-P7",
  "STG-P8",
]);

/** 门禁代码 schema */
export const gateCodeSchema = z.enum([
  "G0",
  "G1",
  "G2",
  "G3",
  "G4",
  "G5",
  "G6",
  "G7",
  "G8",
]);

// ── 实体 DTO ──

/** 项目 DTO schema */
export const projectDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  status: projectStatusSchema,
  buildingType: buildingTypeSchema,
  floorsMin: z.number().int().nonnegative(),
  floorsMax: z.number().int().nonnegative(),
  /** 总建筑面积 GFA（m²，字符串避免精度丢失） */
  gfa: z.string().nullable(),
  /** 占地面积（m²，字符串避免精度丢失） */
  siteArea: z.string().nullable(),
  region: z.string().min(2),
  language: z.string().min(2),
  classification: z.string().min(1),
  settings: z.record(z.unknown()),
  metadata: z.record(z.unknown()),
  startedAt: z.string().datetime().nullable(),
  targetCompletionAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid(),
  /** 乐观锁版本号 */
  rowVersion: z.number().int().nonnegative(),
});

/** 阶段实例 DTO schema */
export const stageInstanceDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  projectId: z.string().uuid(),
  stageCode: stageCodeSchema,
  stageName: z.string().min(1),
  stageOrder: z.number().int().nonnegative(),
  status: stageStatusSchema,
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  rowVersion: z.number().int().nonnegative(),
});

/** 门禁决策 DTO schema */
export const gateDecisionDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  projectId: z.string().uuid(),
  stageId: z.string().uuid().nullable(),
  gateCode: gateCodeSchema,
  gateName: z.string().min(1),
  status: gateStatusSchema,
  decision: gateDecisionSchema.nullable(),
  decidedAt: z.string().datetime().nullable(),
  decidedBy: z.string().uuid().nullable(),
  /** 关联基线（核心不变量：只能引用冻结基线） */
  baselineId: z.string().uuid().nullable(),
  comment: z.string().nullable(),
  evidence: z.array(z.unknown()),
  metadata: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  rowVersion: z.number().int().nonnegative(),
});

/** 项目基线 DTO schema */
export const projectBaselineDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  projectId: z.string().uuid(),
  revisionNo: z.number().int().nonnegative(),
  name: z.string().min(1),
  status: revisionStatusSchema,
  frozenAt: z.string().datetime().nullable(),
  frozenBy: z.string().uuid().nullable(),
  description: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  rowVersion: z.number().int().nonnegative(),
});

// ── 请求 DTO ──

/**
 * 创建项目请求 schema
 * 对应契约：project.create（POST /api/v1/projects）
 * 需要 Idempotency-Key 头
 */
export const createProjectRequestSchema = z
  .object({
    name: z.string().min(1),
    code: z.string().min(1),
    organizationId: z.string().uuid().nullable().optional(),
    description: z.string().optional(),
    buildingType: buildingTypeSchema.optional(),
    floorsMin: z.number().int().nonnegative().optional(),
    floorsMax: z.number().int().nonnegative().optional(),
    gfa: z.string().nullable().optional(),
    siteArea: z.string().nullable().optional(),
    region: z.string().min(2).optional(),
    language: z.string().min(2).optional(),
    /** V0 阶段集，默认裁剪为 STG-P0/P1/P2/P5/P6/P7 */
    stages: z.array(stageCodeSchema).optional(),
    settings: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
    startedAt: z.string().datetime().optional(),
    targetCompletionAt: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      // floorsMin 应不大于 floorsMax
      if (
        data.floorsMin !== undefined &&
        data.floorsMax !== undefined &&
        data.floorsMin > data.floorsMax
      ) {
        return false;
      }
      return true;
    },
    { message: "floorsMin 不能大于 floorsMax" },
  );

/** 更新项目请求 schema（支持部分更新，需要 If-Match 头） */
export const updateProjectRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    status: projectStatusSchema.optional(),
    buildingType: buildingTypeSchema.optional(),
    floorsMin: z.number().int().nonnegative().optional(),
    floorsMax: z.number().int().nonnegative().optional(),
    gfa: z.string().nullable().optional(),
    siteArea: z.string().nullable().optional(),
    settings: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
    startedAt: z.string().datetime().nullable().optional(),
    targetCompletionAt: z.string().datetime().nullable().optional(),
  })
  .refine(
    (data) => {
      if (
        data.floorsMin !== undefined &&
        data.floorsMax !== undefined &&
        data.floorsMin > data.floorsMax
      ) {
        return false;
      }
      return true;
    },
    { message: "floorsMin 不能大于 floorsMax" },
  );

/** 查询项目列表请求 schema */
export const listProjectsRequestSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  status: projectStatusSchema.optional(),
  keyword: z.string().optional(),
});

/**
 * 阶段流转请求 schema
 * 对应契约：project.stage.transition
 */
export const transitionStageRequestSchema = z.object({
  /** 目标状态 */
  targetStatus: stageStatusSchema,
  /** 流转原因/备注 */
  comment: z.string().optional(),
});

/**
 * 冻结基线请求 schema
 * 对应契约：project.baseline.freeze
 */
export const freezeBaselineRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * 门禁决策请求 schema
 * 对应契约：project.gate.decide
 */
export const decideGateRequestSchema = z.object({
  decision: gateDecisionSchema,
  /** 决策意见 */
  comment: z.string().min(1),
  /** 关联基线 ID（仅引用冻结基线） */
  baselineId: z.string().uuid().optional(),
  /** 证据列表 */
  evidence: z.array(z.unknown()).optional(),
});
