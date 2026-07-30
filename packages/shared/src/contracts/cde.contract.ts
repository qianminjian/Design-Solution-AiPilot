/**
 * CDE 域 API 契约（V1 简化文档模型）
 * 权威源：@design/D07-CDE领域-版本.md + @design/D35-API-事件契约.md + @design/D34-数据-数据库.md §cde
 *
 * V1 阶段裁剪：聚焦文档元数据 + 版本管理 + 检入检出状态流转
 * 完整 CDE 模型（Asset/AssetVersion/Baseline/Transmittal）见 D07.3
 *
 * 聚合根：Document（V1 简化）
 * 核心不变量：
 *  - 文档路径在租户+项目内可重复（按 ID 唯一标识）
 *  - 版本号 version_number 在文档内单调递增
 *  - 文档状态流转：DRAFT → CHECKED_OUT → PUBLISHED → SUPERSEDED → ARCHIVED
 *  - 旧版本在新版本上传后自动转为 SUPERSEDED
 */

// ── 枚举 ──

/**
 * 文档状态（V1 简化状态机）
 * - DRAFT: 草稿（新建或已检入）
 * - CHECKED_OUT: 已检出（编辑中，独占锁）
 * - PUBLISHED: 已发布（最终版本）
 * - SUPERSEDED: 已被新版本替代
 * - ARCHIVED: 已归档（不可再编辑）
 */
export type DocumentStatus =
  "DRAFT" | "CHECKED_OUT" | "PUBLISHED" | "SUPERSEDED" | "ARCHIVED";

/**
 * 文档版本状态
 * - DRAFT: 草稿版本
 * - PUBLISHED: 已发布版本
 * - SUPERSEDED: 已被新版本替代
 */
export type DocumentVersionStatus = "DRAFT" | "PUBLISHED" | "SUPERSEDED";

// ── 实体 DTO ──

/**
 * 文档 DTO
 * 对应 Java 实体 com.platform.core.cde.domain.Document
 *
 * PII 分级：path 字段为 L5（业务核心设计文件），日志须脱敏（security.md §3）
 */
export interface DocumentDto {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  /** 文档路径（PII: L5，日志须脱敏） */
  path: string;
  mimeType: string;
  sizeBytes: number;
  /** 当前版本 ID */
  currentVersionId: string | null;
  status: DocumentStatus;
  /** 内容校验和（SHA-256，当前版本） */
  checksum: string | null;
  /** 创建人（Jackson 可能省略 null，由 created_by 对应） */
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  /** 乐观锁版本号 */
  version: number;
}

/**
 * 文档版本 DTO
 * 对应 Java 实体 com.platform.core.cde.domain.DocumentVersion
 *
 * 不可变修订模型：版本一旦创建，storageKey/checksum 不可修改
 */
export interface DocumentVersionDto {
  id: string;
  documentId: string;
  /** 版本号，同文档内单调递增（从 1 开始） */
  versionNumber: number;
  uploadedBy: string | null;
  uploadedAt: string;
  /** 版本说明（用户输入） */
  comment: string | null;
  /** 对象存储 Key（S3/MinIO 引用） */
  storageKey: string;
  /** 版本内容校验和（SHA-256） */
  checksum: string;
  status: DocumentVersionStatus;
}

// ── 检入检出 DTO ──

/**
 * 检出响应 DTO
 * 检出后文档状态从 DRAFT 流转为 CHECKED_OUT，独占编辑权限
 */
export interface CheckoutDto {
  documentId: string;
  status: DocumentStatus;
  /** 检出执行人 */
  checkedOutBy: string | null;
  /** 检出时间 */
  checkedOutAt: string;
}

/**
 * 检入请求
 * 检入后文档状态从 CHECKED_OUT 流转为 PUBLISHED
 */
export interface CheckinRequest {
  /** 检入说明（必填） */
  comment: string;
  /** 新版本对象存储 Key（必填，由调用方上传后传入） */
  storageKey: string;
  /** 新版本内容校验和（SHA-256） */
  checksum: string;
  /** 新版本文件大小（字节） */
  sizeBytes?: number;
  /** 新版本 MIME 类型 */
  mimeType?: string;
}

// ── 请求 DTO ──

/**
 * 创建文档请求
 * 对应契约：POST /api/v1/projects/{projectId}/documents
 * 需要 Idempotency-Key 头
 */
export interface CreateDocumentRequest {
  name: string;
  /** 文档路径（PII: L5） */
  path: string;
  mimeType: string;
  sizeBytes?: number;
  /** 初始版本对象存储 Key */
  storageKey: string;
  /** 初始版本校验和（SHA-256） */
  checksum: string;
  /** 初始版本说明 */
  comment?: string;
}

/**
 * 更新文档请求（支持部分更新）
 * 仅可更新 name/path 等元数据；status 通过 checkout/checkin 流转
 */
export interface UpdateDocumentRequest {
  name?: string;
  path?: string;
  mimeType?: string;
}

/**
 * 查询文档列表请求
 */
export interface ListDocumentsRequest {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: "asc" | "desc";
  status?: DocumentStatus;
  keyword?: string;
}

/**
 * 上传新版本请求
 * 对应契约：POST /api/v1/documents/{id}/versions
 * 服务层自动递增 version_number，旧版本状态自动转为 SUPERSEDED
 */
export interface UploadVersionRequest {
  /** 对象存储 Key（必填） */
  storageKey: string;
  /** 版本内容校验和（SHA-256，必填） */
  checksum: string;
  /** 版本说明 */
  comment?: string;
  /** 文件大小（字节） */
  sizeBytes?: number;
  /** MIME 类型 */
  mimeType?: string;
}

// ── API 端点定义 ──

/**
 * CDE API 端点
 * 基础路径：/api/v1
 * 稳定契约 ID 见 @design/r2-contract-catalog/
 */
export const CdeApiPaths = {
  // 项目下文档列表 + 创建
  documents: (projectId: string) => `/api/v1/projects/${projectId}/documents`,
  // 文件上传 + 创建文档（多部分表单）
  upload: (projectId: string) =>
    `/api/v1/projects/${projectId}/documents/upload`,
  // 文档详情 + 更新 + 删除
  document: (id: string) => `/api/v1/documents/${id}`,
  // 检出
  checkout: (id: string) => `/api/v1/documents/${id}/checkout`,
  // 检入
  checkin: (id: string) => `/api/v1/documents/${id}/checkin`,
  // 文档版本列表 + 上传新版本
  versions: (id: string) => `/api/v1/documents/${id}/versions`,
  // 单个版本详情
  version: (id: string, versionId: string) =>
    `/api/v1/documents/${id}/versions/${versionId}`,
} as const;
