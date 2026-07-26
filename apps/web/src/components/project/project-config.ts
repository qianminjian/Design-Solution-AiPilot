/**
 * Project 模块枚举配置与兜底函数
 *
 * 设计原则：
 *  - 与 verification-config / review-config 保持一致的兜底风格
 *  - 未知枚举值（如后端新增状态未同步前端）显示"未知"标签 + Tooltip 提示原始值
 *  - 已知/未知/null/undefined 都不会导致渲染崩溃
 *
 * 权威源：packages/shared/src/contracts/portfolio.contract.ts
 *  - ProjectStatus: active/on_hold/completed/cancelled/archived
 *  - BuildingType: office/residential/commercial/mixed
 *  - StageStatus: planned/active/review_preparing/under_review/conditionally_approved/approved/suspended/cancelled/closed
 *  - GateStatus: pending/decided/cancelled
 *  - GateDecision: approved/conditionally_approved/rework_required/suspended/cancelled
 */

/** 项目状态 */
export type ProjectStatus =
  "active" | "on_hold" | "completed" | "cancelled" | "archived";

/** 建筑类型 */
export type BuildingType = "office" | "residential" | "commercial" | "mixed";

/** 阶段状态 */
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

/** 门禁决策结论 */
export type GateDecision =
  | "approved"
  | "conditionally_approved"
  | "rework_required"
  | "suspended"
  | "cancelled";

/** 兜底配置 */
export interface FallbackConfig {
  label: string;
  color: string;
}

/** 项目状态配置 */
export interface ProjectStatusConfig extends FallbackConfig {
  iconKey:
    "active" | "on_hold" | "completed" | "cancelled" | "archived" | "unknown";
}

/** 建筑类型配置 */
export interface BuildingTypeConfig extends FallbackConfig {
  iconKey: "office" | "residential" | "commercial" | "mixed" | "unknown";
}

/** 阶段状态配置 */
export interface StageStatusConfig extends FallbackConfig {
  iconKey:
    | "planned"
    | "active"
    | "review_preparing"
    | "under_review"
    | "conditionally_approved"
    | "approved"
    | "suspended"
    | "cancelled"
    | "closed"
    | "unknown";
}

/** 门禁状态配置 */
export interface GateStatusConfig extends FallbackConfig {
  iconKey: "pending" | "decided" | "cancelled" | "unknown";
}

/** 门禁决策配置 */
export interface GateDecisionConfig extends FallbackConfig {
  iconKey:
    | "approved"
    | "conditionally_approved"
    | "rework_required"
    | "suspended"
    | "cancelled"
    | "unknown";
}

/** 项目状态配置 */
export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, ProjectStatusConfig> =
  {
    active: { label: "Active", color: "green", iconKey: "active" },
    on_hold: { label: "On Hold", color: "orange", iconKey: "on_hold" },
    completed: { label: "Completed", color: "blue", iconKey: "completed" },
    cancelled: { label: "Cancelled", color: "red", iconKey: "cancelled" },
    archived: { label: "Archived", color: "default", iconKey: "archived" },
  };

/** 项目状态兜底配置 */
export const PROJECT_STATUS_FALLBACK: ProjectStatusConfig = {
  label: "未知",
  color: "default",
  iconKey: "unknown",
};

/** 建筑类型配置 */
export const BUILDING_TYPE_CONFIG: Record<BuildingType, BuildingTypeConfig> = {
  office: { label: "Office", color: "blue", iconKey: "office" },
  residential: { label: "Residential", color: "cyan", iconKey: "residential" },
  commercial: { label: "Commercial", color: "purple", iconKey: "commercial" },
  mixed: { label: "Mixed-use", color: "geekblue", iconKey: "mixed" },
};

/** 建筑类型兜底配置 */
export const BUILDING_TYPE_FALLBACK: BuildingTypeConfig = {
  label: "未知",
  color: "default",
  iconKey: "unknown",
};

/** 阶段状态配置 */
export const STAGE_STATUS_CONFIG: Record<StageStatus, StageStatusConfig> = {
  planned: { label: "Planned", color: "default", iconKey: "planned" },
  active: { label: "Active", color: "processing", iconKey: "active" },
  review_preparing: {
    label: "Review Preparing",
    color: "processing",
    iconKey: "review_preparing",
  },
  under_review: {
    label: "Under Review",
    color: "processing",
    iconKey: "under_review",
  },
  conditionally_approved: {
    label: "Conditionally Approved",
    color: "success",
    iconKey: "conditionally_approved",
  },
  approved: { label: "Approved", color: "success", iconKey: "approved" },
  suspended: { label: "Suspended", color: "warning", iconKey: "suspended" },
  cancelled: { label: "Cancelled", color: "error", iconKey: "cancelled" },
  closed: { label: "Closed", color: "success", iconKey: "closed" },
};

/** 阶段状态兜底配置 */
export const STAGE_STATUS_FALLBACK: StageStatusConfig = {
  label: "未知",
  color: "default",
  iconKey: "unknown",
};

/** 门禁状态配置 */
export const GATE_STATUS_CONFIG: Record<GateStatus, GateStatusConfig> = {
  pending: { label: "Pending", color: "default", iconKey: "pending" },
  decided: { label: "Decided", color: "processing", iconKey: "decided" },
  cancelled: { label: "Cancelled", color: "error", iconKey: "cancelled" },
};

/** 门禁状态兜底配置 */
export const GATE_STATUS_FALLBACK: GateStatusConfig = {
  label: "未知",
  color: "default",
  iconKey: "unknown",
};

/** 门禁决策配置 */
export const GATE_DECISION_CONFIG: Record<GateDecision, GateDecisionConfig> = {
  approved: { label: "Approved", color: "success", iconKey: "approved" },
  conditionally_approved: {
    label: "Conditionally Approved",
    color: "warning",
    iconKey: "conditionally_approved",
  },
  rework_required: {
    label: "Rework Required",
    color: "warning",
    iconKey: "rework_required",
  },
  suspended: { label: "Suspended", color: "warning", iconKey: "suspended" },
  cancelled: { label: "Cancelled", color: "error", iconKey: "cancelled" },
};

/** 门禁决策兜底配置 */
export const GATE_DECISION_FALLBACK: GateDecisionConfig = {
  label: "未知",
  color: "default",
  iconKey: "unknown",
};

/** 安全访问项目状态配置 */
export function getProjectStatusConfig(
  status: ProjectStatus | string | undefined | null,
): ProjectStatusConfig {
  return status && status in PROJECT_STATUS_CONFIG
    ? PROJECT_STATUS_CONFIG[status as ProjectStatus]
    : PROJECT_STATUS_FALLBACK;
}

/** 安全访问建筑类型配置 */
export function getBuildingTypeConfig(
  type: BuildingType | string | undefined | null,
): BuildingTypeConfig {
  return type && type in BUILDING_TYPE_CONFIG
    ? BUILDING_TYPE_CONFIG[type as BuildingType]
    : BUILDING_TYPE_FALLBACK;
}

/** 安全访问阶段状态配置 */
export function getStageStatusConfig(
  status: StageStatus | string | undefined | null,
): StageStatusConfig {
  return status && status in STAGE_STATUS_CONFIG
    ? STAGE_STATUS_CONFIG[status as StageStatus]
    : STAGE_STATUS_FALLBACK;
}

/** 安全访问门禁状态配置 */
export function getGateStatusConfig(
  status: GateStatus | string | undefined | null,
): GateStatusConfig {
  return status && status in GATE_STATUS_CONFIG
    ? GATE_STATUS_CONFIG[status as GateStatus]
    : GATE_STATUS_FALLBACK;
}

/** 安全访问门禁决策配置 */
export function getGateDecisionConfig(
  decision: GateDecision | string | undefined | null,
): GateDecisionConfig {
  return decision && decision in GATE_DECISION_CONFIG
    ? GATE_DECISION_CONFIG[decision as GateDecision]
    : GATE_DECISION_FALLBACK;
}

/** 判断值是否为已知项目状态 */
export function isKnownProjectStatus(
  status: ProjectStatus | string | undefined | null,
): status is ProjectStatus {
  return !!status && status in PROJECT_STATUS_CONFIG;
}

/** 判断值是否为已知建筑类型 */
export function isKnownBuildingType(
  type: BuildingType | string | undefined | null,
): type is BuildingType {
  return !!type && type in BUILDING_TYPE_CONFIG;
}

/** 判断值是否为已知阶段状态 */
export function isKnownStageStatus(
  status: StageStatus | string | undefined | null,
): status is StageStatus {
  return !!status && status in STAGE_STATUS_CONFIG;
}

/** 判断值是否为已知门禁状态 */
export function isKnownGateStatus(
  status: GateStatus | string | undefined | null,
): status is GateStatus {
  return !!status && status in GATE_STATUS_CONFIG;
}

/** 判断值是否为已知门禁决策 */
export function isKnownGateDecision(
  decision: GateDecision | string | undefined | null,
): decision is GateDecision {
  return !!decision && decision in GATE_DECISION_CONFIG;
}
