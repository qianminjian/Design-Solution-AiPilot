/**
 * 平台通用枚举
 */

/** API 域枚举 */
export const ApiDomains = [
  "iam",
  "project",
  "cde",
  "design",
  "coordination",
  "workflow",
] as const;
export type ApiDomain = (typeof ApiDomains)[number];

/** CDE 信息容器状态（对齐 ISO 19650） */
export type CdeStatus = "WIP" | "Shared" | "Published" | "Archived";

/** AI 置信度等级 */
export type ConfidenceLevel = "high" | "medium" | "low" | "unknown";
