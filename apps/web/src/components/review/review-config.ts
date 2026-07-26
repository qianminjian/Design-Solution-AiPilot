/**
 * Review 模块枚举配置与兜底函数
 *
 * 设计原则：
 *  - 与 verification-config 保持一致的兜底风格
 *  - 未知枚举值（如后端新增状态未同步前端）显示"未知"标签 + Tooltip 提示原始值
 *  - 已知/未知/null/undefined 都不会导致渲染崩溃
 *
 * 权威源：packages/shared/src/schemas/review.schema.ts
 *  - FindingSeverity: critical/high/medium/low
 *  - FindingStatus: pending/approved/rejected/resolved
 *  - CheckResultStatus: passed/failed/partial/running
 */

/** 发现严重级别 */
export type FindingSeverity = "critical" | "high" | "medium" | "low";

/** 发现状态 */
export type FindingStatus = "pending" | "approved" | "rejected" | "resolved";

/** 检查结果状态 */
export type CheckResultStatus = "passed" | "failed" | "partial" | "running";

/** 兜底配置 */
export interface FallbackConfig {
  label: string;
  color: string;
}

/** 严重级别配置（含图标 key，由 Badge 组件映射为 antd 图标） */
export interface SeverityConfig extends FallbackConfig {
  iconKey: "critical" | "high" | "medium" | "low" | "unknown";
  bgColor: string;
}

/** 状态配置（含图标 key） */
export interface StatusConfig extends FallbackConfig {
  iconKey: "pending" | "approved" | "rejected" | "resolved" | "unknown";
}

/** 检查结果状态配置（含图标 key） */
export interface CheckResultStatusConfig extends FallbackConfig {
  iconKey: "passed" | "failed" | "partial" | "running" | "unknown";
}

/** 严重级别配置 */
export const SEVERITY_CONFIG: Record<FindingSeverity, SeverityConfig> = {
  critical: {
    label: "严重",
    color: "red",
    iconKey: "critical",
    bgColor: "#fff1f0",
  },
  high: {
    label: "高",
    color: "orange",
    iconKey: "high",
    bgColor: "#fffbe6",
  },
  medium: {
    label: "中",
    color: "gold",
    iconKey: "medium",
    bgColor: "#f6ffed",
  },
  low: {
    label: "低",
    color: "blue",
    iconKey: "low",
    bgColor: "#e6f7ff",
  },
};

/** 严重级别兜底配置 */
export const SEVERITY_FALLBACK: SeverityConfig = {
  label: "未知",
  color: "default",
  iconKey: "unknown",
  bgColor: "#f5f5f5",
};

/** 发现状态配置 */
export const FINDING_STATUS_CONFIG: Record<FindingStatus, StatusConfig> = {
  pending: { label: "待处理", color: "orange", iconKey: "pending" },
  approved: { label: "已批准", color: "green", iconKey: "approved" },
  rejected: { label: "已拒绝", color: "red", iconKey: "rejected" },
  resolved: { label: "已解决", color: "blue", iconKey: "resolved" },
};

/** 发现状态兜底配置 */
export const FINDING_STATUS_FALLBACK: StatusConfig = {
  label: "未知",
  color: "default",
  iconKey: "unknown",
};

/** 检查结果状态配置 */
export const CHECK_RESULT_STATUS_CONFIG: Record<
  CheckResultStatus,
  CheckResultStatusConfig
> = {
  passed: { label: "通过", color: "green", iconKey: "passed" },
  failed: { label: "失败", color: "red", iconKey: "failed" },
  partial: { label: "部分通过", color: "orange", iconKey: "partial" },
  running: { label: "运行中", color: "blue", iconKey: "running" },
};

/** 检查结果状态兜底配置 */
export const CHECK_RESULT_STATUS_FALLBACK: CheckResultStatusConfig = {
  label: "未知",
  color: "default",
  iconKey: "unknown",
};

/**
 * 安全访问严重级别配置
 *
 * @param severity 后端返回的严重级别（可能为未知枚举值或 undefined/null）
 * @returns 配置对象，未知值返回兜底配置
 */
export function getSeverityConfig(
  severity: FindingSeverity | string | undefined | null,
): SeverityConfig {
  return severity && severity in SEVERITY_CONFIG
    ? SEVERITY_CONFIG[severity as FindingSeverity]
    : SEVERITY_FALLBACK;
}

/**
 * 安全访问发现状态配置
 */
export function getFindingStatusConfig(
  status: FindingStatus | string | undefined | null,
): StatusConfig {
  return status && status in FINDING_STATUS_CONFIG
    ? FINDING_STATUS_CONFIG[status as FindingStatus]
    : FINDING_STATUS_FALLBACK;
}

/**
 * 安全访问检查结果状态配置
 */
export function getCheckResultStatusConfig(
  status: CheckResultStatus | string | undefined | null,
): CheckResultStatusConfig {
  return status && status in CHECK_RESULT_STATUS_CONFIG
    ? CHECK_RESULT_STATUS_CONFIG[status as CheckResultStatus]
    : CHECK_RESULT_STATUS_FALLBACK;
}

/** 判断值是否为已知严重级别 */
export function isKnownSeverity(
  severity: FindingSeverity | string | undefined | null,
): severity is FindingSeverity {
  return !!severity && severity in SEVERITY_CONFIG;
}

/** 判断值是否为已知发现状态 */
export function isKnownFindingStatus(
  status: FindingStatus | string | undefined | null,
): status is FindingStatus {
  return !!status && status in FINDING_STATUS_CONFIG;
}

/** 判断值是否为已知检查结果状态 */
export function isKnownCheckResultStatus(
  status: CheckResultStatus | string | undefined | null,
): status is CheckResultStatus {
  return !!status && status in CHECK_RESULT_STATUS_CONFIG;
}
