/**
 * TEVV 验证项枚举配置与兜底函数
 *
 * 设计原则：
 *  - BFF 端已通过 zod schema 严格阻断未知枚举值（详见 shared schema）
 *  - 前端防御性兜底：避免后端返回未知枚举值（如新增等级未同步前端）导致渲染崩溃
 *  - 兜底场景下显示"未知"标签 + Tooltip 展示原始值，便于排查契约漂移
 *
 * 权威源：.trae/rules/security.md §12 AI 安全红线（前端兜底与后端严格验证互补）
 */

/** 验证类型 */
export type VerificationType = "MANUAL" | "AUTOMATED";

/** 验证状态 */
export type VerificationStatus = "PENDING" | "PASSED" | "FAILED" | "WAIVED";

/** 风险等级 */
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** 兜底配置（未知枚举值统一展示） */
export interface FallbackConfig {
  label: string;
  color: string;
}

/** 风险等级配置 */
export const RISK_CONFIG: Record<RiskLevel, FallbackConfig> = {
  LOW: { label: "低", color: "green" },
  MEDIUM: { label: "中", color: "orange" },
  HIGH: { label: "高", color: "red" },
  CRITICAL: { label: "严重", color: "magenta" },
};

/** 风险等级兜底配置 */
export const RISK_FALLBACK: FallbackConfig = {
  label: "未评估",
  color: "default",
};

/** 状态兜底配置 */
export interface StatusConfig extends FallbackConfig {
  iconKey: "pending" | "passed" | "failed" | "waived" | "unknown";
}

/** 验证状态配置 */
export const STATUS_CONFIG: Record<VerificationStatus, StatusConfig> = {
  PENDING: { label: "待验证", color: "default", iconKey: "pending" },
  PASSED: { label: "通过", color: "success", iconKey: "passed" },
  FAILED: { label: "未通过", color: "error", iconKey: "failed" },
  WAIVED: { label: "豁免", color: "warning", iconKey: "waived" },
};

/** 状态兜底配置 */
export const STATUS_FALLBACK: StatusConfig = {
  label: "未知",
  color: "default",
  iconKey: "unknown",
};

/** 验证类型配置 */
export const TYPE_CONFIG: Record<VerificationType, FallbackConfig> = {
  MANUAL: { label: "手动验证", color: "blue" },
  AUTOMATED: { label: "自动验证", color: "cyan" },
};

/** 验证类型兜底配置 */
export const TYPE_FALLBACK: FallbackConfig = {
  label: "未知",
  color: "default",
};

/** 风险等级选项（用于 Form Select） */
export const RISK_OPTIONS: { value: RiskLevel; label: string }[] = [
  { value: "LOW", label: "低" },
  { value: "MEDIUM", label: "中" },
  { value: "HIGH", label: "高" },
  { value: "CRITICAL", label: "严重" },
];

/** 验证类型选项（用于 Form Select） */
export const TYPE_OPTIONS: { value: VerificationType; label: string }[] = [
  { value: "MANUAL", label: "手动验证" },
  { value: "AUTOMATED", label: "自动验证" },
];

/**
 * 安全访问风险等级配置
 *
 * @param level 后端返回的风险等级（可能为未知枚举值或 undefined/null）
 * @returns 配置对象，未知值返回兜底配置
 */
export function getRiskConfig(
  level: RiskLevel | string | undefined | null,
): FallbackConfig {
  return level && level in RISK_CONFIG
    ? RISK_CONFIG[level as RiskLevel]
    : RISK_FALLBACK;
}

/**
 * 安全访问验证状态配置
 *
 * @param status 后端返回的验证状态（可能为未知枚举值或 undefined/null）
 * @returns 配置对象，未知值返回兜底配置
 */
export function getStatusConfig(
  status: VerificationStatus | string | undefined | null,
): StatusConfig {
  return status && status in STATUS_CONFIG
    ? STATUS_CONFIG[status as VerificationStatus]
    : STATUS_FALLBACK;
}

/**
 * 安全访问验证类型配置
 *
 * @param type 后端返回的验证类型（可能为未知枚举值或 undefined/null）
 * @returns 配置对象，未知值返回兜底配置
 */
export function getTypeConfig(
  type: VerificationType | string | undefined | null,
): FallbackConfig {
  return type && type in TYPE_CONFIG
    ? TYPE_CONFIG[type as VerificationType]
    : TYPE_FALLBACK;
}

/**
 * 判断值是否为已知枚举（用于决定是否显示 Tooltip 原始值）
 */
export function isKnownRiskLevel(
  level: RiskLevel | string | undefined | null,
): level is RiskLevel {
  return !!level && level in RISK_CONFIG;
}

/**
 * 判断值是否为已知状态枚举
 */
export function isKnownStatus(
  status: VerificationStatus | string | undefined | null,
): status is VerificationStatus {
  return !!status && status in STATUS_CONFIG;
}

/**
 * 判断值是否为已知类型枚举
 */
export function isKnownType(
  type: VerificationType | string | undefined | null,
): type is VerificationType {
  return !!type && type in TYPE_CONFIG;
}
