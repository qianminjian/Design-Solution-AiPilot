/**
 * CDE 模块枚举配置与兜底函数
 *
 * 设计原则：
 *  - 与 project-config / review-config / verification-config 保持一致的兜底风格
 *  - 未知枚举值（如后端新增状态未同步前端）显示"未知"标签 + Tooltip 提示原始值
 *  - 已知/未知/null/undefined 都不会导致渲染崩溃
 *
 * 权威源：packages/shared/src/contracts/cde.contract.ts
 *  - DocumentStatus: DRAFT/CHECKED_OUT/PUBLISHED/SUPERSEDED/ARCHIVED
 *  - DocumentVersionStatus: DRAFT/PUBLISHED/SUPERSEDED
 */

/** 文档状态 */
export type DocumentStatus =
  "DRAFT" | "CHECKED_OUT" | "PUBLISHED" | "SUPERSEDED" | "ARCHIVED";

/** 文档版本状态 */
export type DocumentVersionStatus = "DRAFT" | "PUBLISHED" | "SUPERSEDED";

/** 兜底配置 */
export interface FallbackConfig {
  label: string;
  color: string;
}

/** 文档状态配置 */
export interface DocumentStatusConfig extends FallbackConfig {
  iconKey:
    | "draft"
    | "checked_out"
    | "published"
    | "superseded"
    | "archived"
    | "unknown";
}

/** 文档版本状态配置 */
export interface DocumentVersionStatusConfig extends FallbackConfig {
  iconKey: "draft" | "published" | "superseded" | "unknown";
}

/** 文档状态配置 */
export const DOCUMENT_STATUS_CONFIG: Record<
  DocumentStatus,
  DocumentStatusConfig
> = {
  DRAFT: { label: "Draft", color: "default", iconKey: "draft" },
  CHECKED_OUT: {
    label: "Checked Out",
    color: "processing",
    iconKey: "checked_out",
  },
  PUBLISHED: { label: "Published", color: "success", iconKey: "published" },
  SUPERSEDED: { label: "Superseded", color: "warning", iconKey: "superseded" },
  ARCHIVED: { label: "Archived", color: "default", iconKey: "archived" },
};

/** 文档状态兜底配置 */
export const DOCUMENT_STATUS_FALLBACK: DocumentStatusConfig = {
  label: "未知",
  color: "default",
  iconKey: "unknown",
};

/** 文档版本状态配置 */
export const DOCUMENT_VERSION_STATUS_CONFIG: Record<
  DocumentVersionStatus,
  DocumentVersionStatusConfig
> = {
  DRAFT: { label: "Draft", color: "default", iconKey: "draft" },
  PUBLISHED: { label: "Published", color: "success", iconKey: "published" },
  SUPERSEDED: { label: "Superseded", color: "warning", iconKey: "superseded" },
};

/** 文档版本状态兜底配置 */
export const DOCUMENT_VERSION_STATUS_FALLBACK: DocumentVersionStatusConfig = {
  label: "未知",
  color: "default",
  iconKey: "unknown",
};

/** 安全访问文档状态配置 */
export function getDocumentStatusConfig(
  status: DocumentStatus | string | undefined | null,
): DocumentStatusConfig {
  return status && status in DOCUMENT_STATUS_CONFIG
    ? DOCUMENT_STATUS_CONFIG[status as DocumentStatus]
    : DOCUMENT_STATUS_FALLBACK;
}

/** 安全访问文档版本状态配置 */
export function getDocumentVersionStatusConfig(
  status: DocumentVersionStatus | string | undefined | null,
): DocumentVersionStatusConfig {
  return status && status in DOCUMENT_VERSION_STATUS_CONFIG
    ? DOCUMENT_VERSION_STATUS_CONFIG[status as DocumentVersionStatus]
    : DOCUMENT_VERSION_STATUS_FALLBACK;
}

/** 判断值是否为已知文档状态 */
export function isKnownDocumentStatus(
  status: DocumentStatus | string | undefined | null,
): status is DocumentStatus {
  return !!status && status in DOCUMENT_STATUS_CONFIG;
}

/** 判断值是否为已知文档版本状态 */
export function isKnownDocumentVersionStatus(
  status: DocumentVersionStatus | string | undefined | null,
): status is DocumentVersionStatus {
  return !!status && status in DOCUMENT_VERSION_STATUS_CONFIG;
}
