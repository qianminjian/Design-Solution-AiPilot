/**
 * Portfolio 域 API 契约
 * 权威源：@design/D08-项目-计划-任务编排.md + @design/D05-全流程阶段-阶段门.md + @design/D34-数据-数据库.md §D34.5
 *
 * 聚合根：Project + ProjectBaseline
 * 核心不变量：项目作用域固定；Gate 只能引用冻结基线
 *
 * V0 阶段裁剪（D05.18）：G0、G1、轻量 G2、G5、G6、G7
 */

// ── 枚举 ──

/** 项目状态 */
export type ProjectStatus =
  "active" | "on_hold" | "completed" | "cancelled" | "archived";

/** 建筑类型（OD-02 默认办公） */
export type BuildingType = "office" | "residential" | "commercial" | "mixed";

/** 阶段状态（D05.4.1 状态机） */
export type StageStatus =
  | "planned"
  | "active"
  | "review_preparing"
  | "under_review"
  | "conditionally_approved"
  | "approved"
  | "suspended"
  | "cancelled"
  | "closed";

/** 门禁状态 */
export type GateStatus = "pending" | "decided" | "cancelled";

/** 门禁决策结论（D05.4.2） */
export type GateDecision =
  | "approved"
  | "conditionally_approved"
  | "rework_required"
  | "suspended"
  | "cancelled";

/** 基线修订状态（D34.7） */
export type RevisionStatus = "draft" | "frozen" | "superseded";

/** 阶段代码（D01 §155 + D05.18 V0 裁剪） */
export const StageCode = {
  P0: "STG-P0", // 前期策划与需求门
  P1: "STG-P1", // 概念设计门
  P2: "STG-P2", // 方案设计门（V0 轻量）
  P3: "STG-P3", // 扩初设计门（V0 嵌入 G2）
  P4: "STG-P4", // 施工图设计门（V0 嵌入 G2）
  P5: "STG-P5", // 综合校审门
  P6: "STG-P6", // 发布与交付门
  P7: "STG-P7", // 反馈与变更门
  P8: "STG-P8", // 项目关闭与归档门
} as const;

export type StageCode = (typeof StageCode)[keyof typeof StageCode];

/** 门禁代码 */
export const GateCode = {
  G0: "G0",
  G1: "G1",
  G2: "G2",
  G3: "G3",
  G4: "G4",
  G5: "G5",
  G6: "G6",
  G7: "G7",
  G8: "G8",
} as const;

export type GateCode = (typeof GateCode)[keyof typeof GateCode];

// ── 实体 DTO ──

/** 项目 DTO */
export interface ProjectDto {
  id: string;
  tenantId: string;
  organizationId: string | null;
  code: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  buildingType: BuildingType;
  floorsMin: number;
  floorsMax: number;
  /** 总建筑面积 GFA（m²，字符串避免精度丢失） */
  gfa: string | null;
  /** 占地面积（m²，字符串避免精度丢失） */
  siteArea: string | null;
  region: string;
  language: string;
  classification: string;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  startedAt: string | null;
  targetCompletionAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  /** 乐观锁版本号 */
  rowVersion: number;
}

/** 阶段实例 DTO */
export interface StageInstanceDto {
  id: string;
  tenantId: string;
  projectId: string;
  stageCode: StageCode;
  stageName: string;
  stageOrder: number;
  status: StageStatus;
  startedAt: string | null;
  completedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

/** 门禁决策 DTO */
export interface GateDecisionDto {
  id: string;
  tenantId: string;
  projectId: string;
  stageId: string | null;
  gateCode: GateCode;
  gateName: string;
  status: GateStatus;
  decision: GateDecision | null;
  decidedAt: string | null;
  decidedBy: string | null;
  /** 关联基线（核心不变量：只能引用冻结基线） */
  baselineId: string | null;
  comment: string | null;
  evidence: unknown[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

/** 项目基线 DTO */
export interface ProjectBaselineDto {
  id: string;
  tenantId: string;
  projectId: string;
  revisionNo: number;
  name: string;
  status: RevisionStatus;
  frozenAt: string | null;
  frozenBy: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

// ── 请求 DTO ──

/**
 * 创建项目请求
 * 对应契约：project.create（POST /api/v1/projects）
 * 需要 Idempotency-Key 头
 */
export interface CreateProjectRequest {
  name: string;
  code: string;
  organizationId?: string | null;
  description?: string;
  buildingType?: BuildingType;
  floorsMin?: number;
  floorsMax?: number;
  gfa?: string | null;
  siteArea?: string | null;
  region?: string;
  language?: string;
  /** V0 阶段集，默认裁剪为 STG-P0/P1/P2/P5/P6/P7 */
  stages?: StageCode[];
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  startedAt?: string;
  targetCompletionAt?: string;
}

/** 更新项目请求（支持部分更新，需要 If-Match 头） */
export interface UpdateProjectRequest {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  buildingType?: BuildingType;
  floorsMin?: number;
  floorsMax?: number;
  gfa?: string | null;
  siteArea?: string | null;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  startedAt?: string | null;
  targetCompletionAt?: string | null;
}

/** 查询项目列表请求 */
export interface ListProjectsRequest {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: "asc" | "desc";
  status?: ProjectStatus;
  keyword?: string;
}

/**
 * 阶段流转请求
 * 对应契约：project.stage.transition
 */
export interface TransitionStageRequest {
  /** 目标状态 */
  targetStatus: StageStatus;
  /** 流转原因/备注 */
  comment?: string;
}

/**
 * 冻结基线请求
 * 对应契约：project.baseline.freeze
 */
export interface FreezeBaselineRequest {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 门禁决策请求
 * 对应契约：project.gate.decide
 */
export interface DecideGateRequest {
  decision: GateDecision;
  /** 决策意见 */
  comment: string;
  /** 关联基线 ID（仅引用冻结基线） */
  baselineId?: string;
  /** 证据列表 */
  evidence?: unknown[];
}

// ── API 端点定义 ──

/**
 * Portfolio API 端点
 * 基础路径：/api/v1
 * 稳定契约 ID 见 @design/r2-contract-catalog/
 */
export const PortfolioApiPaths = {
  // 项目
  projects: "/api/v1/projects",
  project: (id: string) => `/api/v1/projects/${id}`,
  // 阶段
  stages: (projectId: string) => `/api/v1/projects/${projectId}/stages`,
  stageTransition: (projectId: string, stageId: string) =>
    `/api/v1/projects/${projectId}/stages/${stageId}:transition`,
  // 门禁
  gates: (projectId: string) => `/api/v1/projects/${projectId}/gates`,
  gateDecide: (projectId: string, gateId: string) =>
    `/api/v1/projects/${projectId}/gates/${gateId}:decide`,
  // 基线
  baselines: (projectId: string) => `/api/v1/projects/${projectId}/baselines`,
  baseline: (projectId: string, baselineId: string) =>
    `/api/v1/projects/${projectId}/baselines/${baselineId}`,
} as const;
