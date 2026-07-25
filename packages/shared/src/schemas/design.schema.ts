/**
 * Design 域 Zod Schema — 设计选项与反馈
 *
 * 权威源：@design/D10-方案.md
 * 对齐：packages/shared/src/contracts/design.contract.ts
 * OpenAPI：@docs/api/design.yaml
 *
 * 用途：
 *  - BFF 代理层验证设计选项与反馈 DTO 结构
 *  - 前端运行时验证创建/反馈请求体
 */
import { z } from "zod";

// ── 枚举 ──

/** 设计选项状态 schema */
export const designOptionStatusSchema = z.enum([
  "DRAFT",
  "CANDIDATE",
  "SUBMITTED",
  "ACCEPTED",
  "RETURNED",
  "ARCHIVED",
]);

/** 设计专业 schema */
export const designDisciplineSchema = z.enum([
  "ARCHITECTURE",
  "STRUCTURE",
  "MEP",
  "LANDSCAPE",
  "INTERIOR",
]);

// ── DTO ──

/** 设计选项 schema */
export const designOptionDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: designOptionStatusSchema,
  discipline: designDisciplineSchema,
  metadata: z.record(z.unknown()).optional(),
  thumbnailDocumentId: z.string().uuid().optional(),
  createdBy: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  rowVersion: z.number().int().nonnegative(),
});

/** 创建设计选项请求 schema */
export const createDesignOptionRequestSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  discipline: designDisciplineSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  thumbnailDocumentId: z.string().uuid().optional(),
});

/** 设计反馈 schema */
export const designFeedbackDtoSchema = z.object({
  id: z.string().uuid(),
  optionId: z.string().uuid(),
  authorId: z.string().uuid(),
  comment: z.string().min(1),
  rating: z.number().int().min(0).max(5).optional(),
  createdAt: z.string().datetime(),
});

/** 提交设计反馈请求 schema */
export const designFeedbackRequestSchema = z.object({
  comment: z.string().min(1),
  rating: z.number().int().min(0).max(5).optional(),
});
