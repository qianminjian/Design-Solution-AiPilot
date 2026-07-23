/**
 * Design 域契约 — 设计选项与反馈
 *
 * 权威源：@design/D10-方案.md
 * OpenAPI：@docs/api/design.yaml
 */

// ── 枚举 ──

/** 设计选项状态 */
export type DesignOptionStatus =
  "DRAFT" | "CANDIDATE" | "SUBMITTED" | "ACCEPTED" | "RETURNED" | "ARCHIVED";

/** 设计专业 */
export type DesignDiscipline =
  "ARCHITECTURE" | "STRUCTURE" | "MEP" | "LANDSCAPE" | "INTERIOR";

// ── DTO ──

/** 设计选项 */
export interface DesignOptionDto {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  description?: string;
  status: DesignOptionStatus;
  discipline: DesignDiscipline;
  metadata?: Record<string, unknown>;
  thumbnailDocumentId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

/** 创建设计选项请求 */
export interface CreateDesignOptionRequest {
  projectId: string;
  title: string;
  description?: string;
  discipline?: DesignDiscipline;
  metadata?: Record<string, unknown>;
  thumbnailDocumentId?: string;
}

/** 设计反馈 */
export interface DesignFeedbackDto {
  id: string;
  optionId: string;
  authorId: string;
  comment: string;
  rating?: number;
  createdAt: string;
}

/** 提交设计反馈请求 */
export interface DesignFeedbackRequest {
  comment: string;
  rating?: number;
}

// ── API 路径 ──

export const DesignApiPaths = {
  /** 列出设计选项 */
  listOptions: (projectId: string) =>
    `/api/v1/design-options?projectId=${projectId}`,
  /** 创建设计选项 */
  createOption: "/api/v1/design-options",
  /** 查询设计选项详情 */
  optionDetail: (optionId: string) => `/api/v1/design-options/${optionId}`,
  /** 提交设计反馈 */
  submitFeedback: (optionId: string) =>
    `/api/v1/design-options/${optionId}/feedback`,
  /** 列出设计反馈 */
  listFeedback: (optionId: string) =>
    `/api/v1/design-options/${optionId}/feedback`,
} as const;
