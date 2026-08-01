/**
 * Governance 域 Zod Schema（治理中心）
 *
 * 权威源：@design/D37-关键界面-交互状态.md §D37.17 + @design/D40-安全-隐私-合规.md
 *
 * 用途：
 *  - BFF GovernanceProxyController 软验证 Core Service 返回的治理域 DTO
 *  - 前端运行时验证治理中心 5 个页面（Access Review / AI Release /
 *    Data Governance / Audit / Backup-Restore）的 API 响应
 *  - 治理域写操作（approve / promote / rollback / seal / verify 等）请求体校验
 *
 * 命名策略：所有 schema 与 type 加 Governance 前缀，避免与 IAM 域
 *  `accessGrantDtoSchema` / `AccessGrantDto` / `dataClassificationSchema` 重名
 *
 * 安全：
 *  - 所有 timestamp 字段强制 ISO datetime
 *  - 所有 id 字段强制 UUID 或带前缀的字符串（rel-/grant-/bk- 等）
 *  - 风险等级、状态等枚举严格对齐前端 TypeScript 类型
 */
import { z } from "zod";

// ── 通用枚举（跨子域共享） ──

/** 风险等级（D37.17 治理中心统一） */
export const governanceRiskLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

/** 操作结果状态 */
export const governanceResultSchema = z.enum([
  "success",
  "failure",
  "denied",
  "error",
]);

/** 治理域数据分类等级（对齐 security.md §8 PII 分级 L1-L5） */
export const governanceDataClassificationSchema = z.enum([
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
]);

/** 审计日志类别 */
export const governanceAuditCategorySchema = z.enum([
  "auth",
  "data",
  "governance",
  "ai",
  "publication",
  "admin",
]);

/** 审计执行者类型 */
export const governanceAuditActorTypeSchema = z.enum([
  "user",
  "service",
  "ai",
  "system",
]);

// ── Access Grant（D37.17 Access Review） ──

export const governanceAccessGrantTypeSchema = z.enum([
  "member",
  "external",
  "service",
  "breakglass",
]);

export const governanceAccessGrantStatusSchema = z.enum([
  "active",
  "pending_review",
  "shortened",
  "revoked",
  "expired",
]);

export const governanceAccessGrantSchema = z.object({
  id: z.string(),
  type: governanceAccessGrantTypeSchema,
  principalName: z.string(),
  principalEmail: z.string().email(),
  resource: z.string(),
  permission: z.string(),
  riskLevel: governanceRiskLevelSchema,
  status: governanceAccessGrantStatusSchema,
  grantedBy: z.string(),
  grantedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().optional(),
  owner: z.string(),
  ownerEmail: z.string().email(),
  reason: z.string(),
  requiresStepUp: z.boolean(),
  hasLegalHold: z.boolean().optional(),
  propagationDependents: z.array(z.string()).optional(),
});

export const governanceAccessGrantListResponseSchema = z.object({
  items: z.array(governanceAccessGrantSchema),
  total: z.number().int().nonnegative(),
});

export const governanceAccessGrantActionRequestSchema = z.object({
  action: z.enum(["approve", "shorten", "revoke"]),
  reason: z.string().min(1).max(500),
  newExpiresAt: z.string().datetime().optional(),
  stepUpToken: z.string().optional(),
});

// ── Release（D37.17 AI/Rule Release） ──

export const governanceReleaseTypeSchema = z.enum([
  "llm",
  "rule_set",
  "ai_provider",
]);

export const governanceReleaseStatusSchema = z.enum([
  "draft",
  "review",
  "canary",
  "promoted",
  "rolled_back",
  "deprecated",
]);

export const governanceRedteamStatusSchema = z.enum([
  "pass",
  "warning",
  "fail",
  "pending",
]);

export const governanceMetricsDriftSchema = z.enum(["none", "minor", "major"]);

export const governanceReleaseDiffSummarySchema = z.object({
  added: z.number().int().nonnegative(),
  modified: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
});

export const governanceReleaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: governanceReleaseTypeSchema,
  version: z.string(),
  previousVersion: z.string().optional(),
  status: governanceReleaseStatusSchema,
  releaseManager: z.string(),
  createdAt: z.string().datetime(),
  promotedAt: z.string().datetime().optional(),
  evalScore: z.number().min(0).max(1),
  evalSlices: z.number().int().nonnegative(),
  redteamStatus: governanceRedteamStatusSchema,
  consumerCount: z.number().int().nonnegative(),
  canaryPercent: z.number().int().min(0).max(100),
  metricsDrift: governanceMetricsDriftSchema,
  hasEvalGap: z.boolean(),
  hasOldConsumer: z.boolean(),
  description: z.string(),
  diffSummary: governanceReleaseDiffSummarySchema,
});

export const governanceReleaseListResponseSchema = z.object({
  items: z.array(governanceReleaseSchema),
  total: z.number().int().nonnegative(),
});

export const governanceReleaseActionRequestSchema = z.object({
  action: z.enum(["canary", "promote", "rollback", "approve", "deprecate"]),
  reason: z.string().min(1).max(500),
  canaryPercent: z.number().int().min(0).max(100).optional(),
  stepUpToken: z.string().optional(),
});

// ── Data Asset（D37.17 Data Governance） ──

export const governanceDataAssetTypeSchema = z.enum([
  "dictionary",
  "dataset",
  "model",
  "publication",
  "evidence",
]);

export const governanceDataAssetStatusSchema = z.enum([
  "active",
  "archived",
  "deletion_pending",
  "hold_conflict",
]);

export const governanceRetentionPolicySchema = z.object({
  years: z.number().int().positive(),
  legalHold: z.boolean(),
  disposalDate: z.string().datetime(),
});

export const governanceDataAssetSchema = z.object({
  id: z.string(),
  type: governanceDataAssetTypeSchema,
  name: z.string(),
  domain: z.string(),
  owner: z.string(),
  ownerEmail: z.string().email(),
  classification: governanceDataClassificationSchema,
  retention: governanceRetentionPolicySchema,
  qualityScore: z.number().min(0).max(1),
  qualityIssues: z.number().int().nonnegative(),
  lineageCoverage: z.number().min(0).max(1),
  storageLocations: z.array(z.string()),
  status: governanceDataAssetStatusSchema,
  lastModified: z.string().datetime(),
  description: z.string(),
});

export const governanceDataAssetListResponseSchema = z.object({
  items: z.array(governanceDataAssetSchema),
  total: z.number().int().nonnegative(),
});

export const governanceDataAssetActionRequestSchema = z.object({
  action: z.enum(["hold", "release_hold", "archive", "delete", "repair"]),
  reason: z.string().min(1).max(500),
  stepUpToken: z.string().optional(),
});

// ── Audit Log（D37.17 Audit/Evidence） ──

export const governanceAuditObjectSchema = z.object({
  type: z.string(),
  id: z.string(),
  name: z.string(),
});

export const governanceAuditActorSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: governanceAuditActorTypeSchema,
});

export const governanceAuditLogSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  actor: governanceAuditActorSchema,
  action: z.string(),
  category: governanceAuditCategorySchema,
  object: governanceAuditObjectSchema,
  traceId: z.string(),
  result: governanceResultSchema,
  riskLevel: governanceRiskLevelSchema,
  masked: z.boolean(),
  ipAddress: z.string(),
  userAgent: z.string(),
  details: z.string(),
  // P0-1.2 测试数据隔离：null 表示生产/未标记数据，非空表示测试数据
  testRunId: z.string().nullable().optional(),
});

export const governanceAuditLogListResponseSchema = z.object({
  items: z.array(governanceAuditLogSchema),
  total: z.number().int().nonnegative(),
});

/**
 * 审计日志查询参数
 *
 * testRunId / excludeTestRun 用于 P0-1.2 测试数据隔离：
 *  - 不传任何参数：返回全部（含测试与生产）
 *  - testRunId=xxx：按值精确过滤某次测试运行
 *  - excludeTestRun=true：仅返回生产数据（test_run_id IS NULL）
 *  - testRunId 与 excludeTestRun 同时传时，以 excludeTestRun 优先
 */
export const governanceAuditLogQuerySchema = z.object({
  category: governanceAuditCategorySchema.optional(),
  result: governanceResultSchema.optional(),
  riskLevel: governanceRiskLevelSchema.optional(),
  actorId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  traceId: z.string().optional(),
  testRunId: z.string().optional(),
  excludeTestRun: z.boolean().optional(),
});

// ── Evidence Package（D37.17 Audit/Evidence 证据包） ──

export const governanceEvidencePackageStatusSchema = z.enum([
  "draft",
  "sealed",
  "verified",
  "challenged",
]);

export const governanceEvidenceItemSchema = z.object({
  id: z.string(),
  source: z.string(),
  revision: z.string().optional(),
  toolchain: z.string().optional(),
  hash: z.string(),
  capturedAt: z.string().datetime(),
});

export const governanceEvidencePackageSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: governanceEvidencePackageStatusSchema,
  objectId: z.string(),
  objectType: z.string(),
  items: z.array(governanceEvidenceItemSchema),
  sealedBy: z.string().optional(),
  sealedAt: z.string().datetime().optional(),
  verifiedBy: z.string().optional(),
  verifiedAt: z.string().datetime().optional(),
  hash: z.string(),
  createdAt: z.string().datetime(),
});

export const governanceEvidencePackageListResponseSchema = z.object({
  items: z.array(governanceEvidencePackageSchema),
  total: z.number().int().nonnegative(),
});

export const governanceEvidencePackageActionRequestSchema = z.object({
  action: z.enum(["seal", "verify", "export", "challenge"]),
  reason: z.string().min(1).max(500).optional(),
  verifier: z.string().optional(),
  signature: z.string().optional(),
  stepUpToken: z.string().optional(),
});

// ── Backup（D37.17 Backup/Restore） ──

export const governanceBackupTypeSchema = z.enum([
  "full",
  "incremental",
  "wal",
]);

export const governanceBackupScopeSchema = z.enum([
  "database",
  "object_storage",
  "config",
  "all",
]);

export const governanceBackupStatusSchema = z.enum([
  "running",
  "completed",
  "failed",
  "verifying",
  "verified",
]);

export const governanceBackupPointSchema = z.object({
  id: z.string(),
  type: governanceBackupTypeSchema,
  scope: governanceBackupScopeSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  durationSec: z.number().int().positive().optional(),
  sizeBytes: z.number().int().nonnegative(),
  objectCount: z.number().int().nonnegative(),
  status: governanceBackupStatusSchema,
  actualRpoMin: z.number().int().nonnegative(),
  storageLocation: z.string(),
  hash: z.string(),
  triggeredBy: z.string(),
});

export const governanceBackupListResponseSchema = z.object({
  items: z.array(governanceBackupPointSchema),
  total: z.number().int().nonnegative(),
});

export const governanceBackupCreateRequestSchema = z.object({
  type: governanceBackupTypeSchema,
  scope: governanceBackupScopeSchema,
  reason: z.string().min(1).max(500),
  stepUpToken: z.string().optional(),
});

export const governanceBackupRestoreRequestSchema = z.object({
  backupId: z.string(),
  target: z.enum(["production", "isolated_env"]),
  reason: z.string().min(1).max(500),
  stepUpToken: z.string(),
});

// ── Restore Drill（D37.17 灾备演练） ──

export const governanceRestoreDrillStatusSchema = z.enum([
  "scheduled",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const governanceRestoreDrillSchema = z.object({
  id: z.string(),
  backupId: z.string(),
  target: z.enum(["isolated_env", "production"]),
  status: governanceRestoreDrillStatusSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  actualRtoMin: z.number().int().nonnegative().optional(),
  actualRpoMin: z.number().int().nonnegative().optional(),
  verifier: z.string(),
  reportUrl: z.string().optional(),
  passed: z.boolean().optional(),
  notes: z.string().optional(),
});

export const governanceRestoreDrillListResponseSchema = z.object({
  items: z.array(governanceRestoreDrillSchema),
  total: z.number().int().nonnegative(),
});

export const governanceRestoreDrillCreateRequestSchema = z.object({
  backupId: z.string(),
  target: z.enum(["isolated_env", "production"]),
  operator: z.string(),
  scheduledAt: z.string().datetime().optional(),
  stepUpToken: z.string(),
});

// ── 推断类型导出 ──

export type GovernanceAccessGrant = z.infer<typeof governanceAccessGrantSchema>;
export type GovernanceAccessGrantActionRequest = z.infer<
  typeof governanceAccessGrantActionRequestSchema
>;
export type GovernanceRelease = z.infer<typeof governanceReleaseSchema>;
export type GovernanceReleaseActionRequest = z.infer<
  typeof governanceReleaseActionRequestSchema
>;
export type GovernanceDataAsset = z.infer<typeof governanceDataAssetSchema>;
export type GovernanceDataAssetActionRequest = z.infer<
  typeof governanceDataAssetActionRequestSchema
>;
export type GovernanceAuditLog = z.infer<typeof governanceAuditLogSchema>;
export type GovernanceAuditLogQuery = z.infer<
  typeof governanceAuditLogQuerySchema
>;
export type GovernanceEvidencePackage = z.infer<
  typeof governanceEvidencePackageSchema
>;
export type GovernanceEvidencePackageActionRequest = z.infer<
  typeof governanceEvidencePackageActionRequestSchema
>;
export type GovernanceBackupPoint = z.infer<typeof governanceBackupPointSchema>;
export type GovernanceBackupCreateRequest = z.infer<
  typeof governanceBackupCreateRequestSchema
>;
export type GovernanceBackupRestoreRequest = z.infer<
  typeof governanceBackupRestoreRequestSchema
>;
export type GovernanceRestoreDrill = z.infer<
  typeof governanceRestoreDrillSchema
>;
export type GovernanceRestoreDrillCreateRequest = z.infer<
  typeof governanceRestoreDrillCreateRequestSchema
>;

// ── TestEvidence（D45.10 TestEvidence，P0-1.4 测试报告与证据存储） ──

export const governanceTestEvidenceTypeSchema = z.enum([
  "UNIT",
  "INTEGRATION",
  "E2E",
  "PERFORMANCE",
  "SECURITY",
  "ACCEPTANCE",
  "CONTRACT",
]);

export const governanceTestEvidenceRetentionSchema = z.enum([
  "PROJECT_LIFETIME",
  "LEGAL_HOLD",
  "DAYS_30",
  "DAYS_90",
  "YEAR_1",
]);

export const governanceTestEvidenceSchema = z.object({
  id: z.string().uuid(),
  evidenceType: governanceTestEvidenceTypeSchema,
  objectUri: z.string().min(1).max(512),
  hash: z.string().regex(/^[a-f0-9]{64}$/, "hash must be SHA-256 hex"),
  tool: z.string().min(1).max(100),
  version: z.string().min(1).max(32),
  rawSummary: z.string().min(1).max(512),
  retention: governanceTestEvidenceRetentionSchema,
  classification: z.enum(["L1", "L2", "L3", "L4", "L5"]),
  signatureAlgorithm: z.string().max(32).optional(),
  signatureValue: z.string().max(1024).optional(),
  objectId: z.string().max(200).optional(),
  objectType: z.string().max(100).optional(),
  testRunId: z.string().max(64).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const governanceTestEvidenceListResponseSchema = z.object({
  items: z.array(governanceTestEvidenceSchema),
  total: z.number().int().nonnegative(),
});

export const governanceTestEvidenceCreateRequestSchema = z.object({
  evidenceType: governanceTestEvidenceTypeSchema,
  objectUri: z.string().min(1).max(512),
  hash: z.string().regex(/^[a-f0-9]{64}$/, "hash must be SHA-256 hex"),
  tool: z.string().min(1).max(100),
  version: z.string().min(1).max(32),
  rawSummary: z.string().min(1).max(512),
  retention: governanceTestEvidenceRetentionSchema,
  classification: z.enum(["L1", "L2", "L3", "L4", "L5"]),
  signatureAlgorithm: z.string().max(32).optional(),
  signatureValue: z.string().max(1024).optional(),
  objectId: z.string().max(200).optional(),
  objectType: z.string().max(100).optional(),
  testRunId: z.string().max(64).optional(),
});

export const governanceTestEvidenceVerifyRequestSchema = z.object({
  evidenceId: z.string().uuid(),
  actualHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/, "actualHash must be SHA-256 hex"),
});

export const governanceTestEvidenceVerifyResultSchema = z.object({
  evidenceId: z.string().uuid(),
  verified: z.boolean(),
  storedHash: z.string().regex(/^[a-f0-9]{64}$/),
  actualHash: z.string().regex(/^[a-f0-9]{64}$/),
});

export type GovernanceTestEvidence = z.infer<
  typeof governanceTestEvidenceSchema
>;
export type GovernanceTestEvidenceCreateRequest = z.infer<
  typeof governanceTestEvidenceCreateRequestSchema
>;
export type GovernanceTestEvidenceVerifyRequest = z.infer<
  typeof governanceTestEvidenceVerifyRequestSchema
>;
export type GovernanceTestEvidenceVerifyResult = z.infer<
  typeof governanceTestEvidenceVerifyResultSchema
>;
