// @design-platform/shared — 全平台共享类型与常量
// D35 接口契约中稳定 ID 的 TypeScript 侧定义

// ── API 域枚举 ──
export const ApiDomains = [
  "iam",
  "project",
  "cde",
  "design",
  "coordination",
  "workflow",
] as const;
export type ApiDomain = (typeof ApiDomains)[number];

// ── CDE 信息容器状态（对齐 ISO 19650） ──
export type CdeStatus = "WIP" | "Shared" | "Published" | "Archived";

// ── 项目阶段 ──
export type ProjectPhase =
  | "planning"
  | "concept"
  | "schematic"
  | "detailed"
  | "construction"
  | "review"
  | "delivery"
  | "change"
  | "archive";

// ── AI 置信度等级 ──
export type ConfidenceLevel = "high" | "medium" | "low" | "unknown";

// ── 分页参数 ──
export interface PageRequest {
  page: number;
  pageSize: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ── API 错误响应 ──
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId?: string;
}
