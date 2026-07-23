/**
 * TEVV 域契约 — 金样数据集与验证项
 *
 * 权威源：@design/D33-TEVV-测试评估.md
 * OpenAPI：@docs/api/tevv.yaml
 */

// ── 枚举 ──

/** 数据集专业分类 */
export type DatasetCategory =
  "ARCHITECTURE" | "STRUCTURE" | "MEP" | "INTERIOR" | "LANDSCAPE";

/** 数据集状态 */
export type DatasetStatus = "DRAFT" | "FROZEN" | "DEPRECATED";

/** 验证类型 */
export type VerificationType = "MANUAL" | "AUTOMATED";

/** 验证状态 */
export type VerificationStatus = "PENDING" | "PASSED" | "FAILED" | "WAIVED";

/** 风险等级 */
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// ── DTO ──

/** 金样数据集 */
export interface GoldenDatasetDto {
  id: string;
  name: string;
  description?: string;
  category: DatasetCategory;
  buildingType: string;
  version: number;
  fileCount: number;
  status: DatasetStatus;
  storageKey?: string;
  frozenAt?: string;
  createdAt: string;
  updatedAt?: string;
}

/** 创建金样数据集请求 */
export interface CreateGoldenDatasetRequest {
  name: string;
  description?: string;
  category: DatasetCategory;
  buildingType: string;
  storageKey: string;
}

/** 验证项 */
export interface VerificationItemDto {
  id: string;
  datasetId: string;
  gateCode: string;
  verificationType: VerificationType;
  riskLevel: RiskLevel;
  status: VerificationStatus;
  description: string;
  waiverReason?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
}

/** 创建验证项请求 */
export interface CreateVerificationItemRequest {
  datasetId: string;
  gateCode: string;
  verificationType: VerificationType;
  riskLevel: RiskLevel;
  description: string;
}

// ── API 路径 ──

export const TEVV_API_PATHS = {
  /** 数据集列表 / 创建 */
  DATASETS: "/api/v1/golden-datasets",
  /** 数据集详情 */
  DATASET_DETAIL: (id: string) => `/api/v1/golden-datasets/${id}`,
  /** 冻结数据集 */
  DATASET_FREEZE: (id: string) => `/api/v1/golden-datasets/${id}/freeze`,
  /** 验证项列表 / 创建 */
  VERIFICATION_ITEMS: "/api/v1/verification-items",
  /** 更新验证项状态 */
  ITEM_STATUS: (id: string) => `/api/v1/verification-items/${id}/status`,
} as const;
