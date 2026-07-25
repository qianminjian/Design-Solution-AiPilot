/**
 * TEVV 域 Zod Schema — 金样数据集与验证项
 *
 * 权威源：@design/D33-TEVV-测试评估.md
 * 对齐：packages/shared/src/contracts/tevv.contract.ts
 * OpenAPI：@docs/api/tevv.yaml
 *
 * 用途：
 *  - BFF 代理层验证 TEVV Service 返回的金样数据集/验证项 DTO 结构
 *  - 前端运行时验证 Gate 准入验证流程的数据
 *  - 风险等级字段强制进入人工复核流程（security.md §12）
 */
import { z } from "zod";

// ── 枚举 ──

/** 数据集专业分类 schema */
export const datasetCategorySchema = z.enum([
  "ARCHITECTURE",
  "STRUCTURE",
  "MEP",
  "INTERIOR",
  "LANDSCAPE",
]);

/** 数据集状态 schema */
export const datasetStatusSchema = z.enum(["DRAFT", "FROZEN", "DEPRECATED"]);

/** 验证类型 schema */
export const verificationTypeSchema = z.enum(["MANUAL", "AUTOMATED"]);

/** 验证状态 schema */
export const verificationStatusSchema = z.enum([
  "PENDING",
  "PASSED",
  "FAILED",
  "WAIVED",
]);

/** 风险等级 schema（同 ai.schema.ts，本文件独立定义避免循环依赖） */
export const riskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

// ── DTO ──

/** 金样数据集 schema */
export const goldenDatasetDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: datasetCategorySchema,
  buildingType: z.string().min(1),
  version: z.number().int().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  status: datasetStatusSchema,
  storageKey: z.string().optional(),
  frozenAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

/** 创建金样数据集请求 schema */
export const createGoldenDatasetRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: datasetCategorySchema,
  buildingType: z.string().min(1),
  storageKey: z.string().min(1),
});

/** 验证项 schema */
export const verificationItemDtoSchema = z.object({
  id: z.string().uuid(),
  datasetId: z.string().uuid(),
  gateCode: z.string().min(1),
  verificationType: verificationTypeSchema,
  riskLevel: riskLevelSchema,
  status: verificationStatusSchema,
  description: z.string().min(1),
  waiverReason: z.string().optional(),
  verifiedBy: z.string().uuid().optional(),
  verifiedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});

/** 创建验证项请求 schema */
export const createVerificationItemRequestSchema = z.object({
  datasetId: z.string().uuid(),
  gateCode: z.string().min(1),
  verificationType: verificationTypeSchema,
  riskLevel: riskLevelSchema,
  description: z.string().min(1),
});
