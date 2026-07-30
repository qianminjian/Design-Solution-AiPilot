/**
 * CDE 域 Zod Schema（V1 简化文档模型）
 *
 * 权威源：@design/D07-CDE领域-版本.md + @design/D35-API-事件契约.md + @design/D34-数据-数据库.md §cde
 * 对齐：packages/shared/src/contracts/cde.contract.ts
 *
 * 用途：
 *  - BFF 代理层验证 Core Service 返回的文档/版本 DTO 结构
 *  - 前端运行时验证检入检出请求与响应
 *  - PII L5 字段（path）验证（security.md §3）
 */
import { z } from "zod";

// ── 枚举 ──

/**
 * 文档状态 schema（V1 简化状态机）
 * - DRAFT: 草稿（新建或已检入）
 * - CHECKED_OUT: 已检出（编辑中，独占锁）
 * - PUBLISHED: 已发布（最终版本）
 * - SUPERSEDED: 已被新版本替代
 * - ARCHIVED: 已归档（不可再编辑）
 */
export const documentStatusSchema = z.enum([
  "DRAFT",
  "CHECKED_OUT",
  "PUBLISHED",
  "SUPERSEDED",
  "ARCHIVED",
]);

/**
 * 文档版本状态 schema
 * - DRAFT: 草稿版本
 * - PUBLISHED: 已发布版本
 * - SUPERSEDED: 已被新版本替代
 */
export const documentVersionStatusSchema = z.enum([
  "DRAFT",
  "PUBLISHED",
  "SUPERSEDED",
]);

// ── 实体 DTO ──

/**
 * 文档 DTO schema
 * PII 分级：path 字段为 L5（业务核心设计文件），日志须脱敏（security.md §3）
 */
export const documentDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1),
  /** 文档路径（PII: L5，日志须脱敏） */
  path: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  /** 当前版本 ID */
  currentVersionId: z.string().uuid().nullable(),
  status: documentStatusSchema,
  /** 内容校验和（SHA-256，当前版本） */
  checksum: z.string().nullable(),
  createdBy: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** 乐观锁版本号 */
  version: z.number().int().nonnegative(),
});

/**
 * 文档版本 DTO schema
 * 不可变修订模型：版本一旦创建，storageKey/checksum 不可修改
 */
export const documentVersionDtoSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  /** 版本号，同文档内单调递增（从 1 开始） */
  versionNumber: z.number().int().positive(),
  uploadedBy: z.string().uuid().nullable(),
  uploadedAt: z.string().datetime(),
  /** 版本说明（用户输入） */
  comment: z.string().nullable(),
  /** 对象存储 Key（S3/MinIO 引用） */
  storageKey: z.string().min(1),
  /** 版本内容校验和（SHA-256） */
  checksum: z.string().min(1),
  status: documentVersionStatusSchema,
});

// ── 检入检出 DTO ──

/**
 * 检出响应 DTO schema
 * 检出后文档状态从 DRAFT 流转为 CHECKED_OUT，独占编辑权限
 */
export const checkoutDtoSchema = z.object({
  documentId: z.string().uuid(),
  status: documentStatusSchema,
  /** 检出执行人 */
  checkedOutBy: z.string().uuid().nullable(),
  /** 检出时间 */
  checkedOutAt: z.string().datetime(),
});

/**
 * 检入请求 schema
 * 检入后文档状态从 CHECKED_OUT 流转为 PUBLISHED
 */
export const checkinRequestSchema = z.object({
  /** 检入说明（必填） */
  comment: z.string().min(1),
  /** 新版本对象存储 Key（必填，由调用方上传后传入） */
  storageKey: z.string().min(1),
  /** 新版本内容校验和（SHA-256） */
  checksum: z.string().min(1),
  /** 新版本文件大小（字节） */
  sizeBytes: z.number().int().nonnegative().optional(),
  /** 新版本 MIME 类型 */
  mimeType: z.string().optional(),
});

// ── 请求 DTO ──

/**
 * 创建文档请求 schema
 * 对应契约：POST /api/v1/projects/{projectId}/documents
 * 需要 Idempotency-Key 头
 */
export const createDocumentRequestSchema = z.object({
  name: z.string().min(1),
  /** 文档路径（PII: L5） */
  path: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().optional(),
  /** 初始版本对象存储 Key */
  storageKey: z.string().min(1),
  /** 初始版本校验和（SHA-256） */
  checksum: z.string().min(1),
  /** 初始版本说明 */
  comment: z.string().optional(),
});

/**
 * 更新文档请求 schema（支持部分更新）
 * 仅可更新 name/path 等元数据；status 通过 checkout/checkin 流转
 */
export const updateDocumentRequestSchema = z.object({
  name: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
});

/**
 * 查询文档列表请求 schema
 */
export const listDocumentsRequestSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  status: documentStatusSchema.optional(),
  keyword: z.string().optional(),
});

/**
 * 上传新版本请求 schema
 * 对应契约：POST /api/v1/documents/{id}/versions
 * 服务层自动递增 version_number，旧版本状态自动转为 SUPERSEDED
 */
export const uploadVersionRequestSchema = z.object({
  /** 对象存储 Key（必填） */
  storageKey: z.string().min(1),
  /** 版本内容校验和（SHA-256，必填） */
  checksum: z.string().min(1),
  /** 版本说明 */
  comment: z.string().optional(),
  /** 文件大小（字节） */
  sizeBytes: z.number().int().nonnegative().optional(),
  /** MIME 类型 */
  mimeType: z.string().optional(),
});
