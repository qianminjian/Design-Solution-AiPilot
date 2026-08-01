/**
 * Governance 域事件契约（P0-2.2 Event/AsyncAPI 契约）
 *
 * 治理中心（D37.17 Governance）+ Governance 域事件（D35.14）：
 *  - ApprovalDecided：审批决定（对齐双审批状态机 + AI 人工复核）
 *  - LegalHoldChanged：法律保留状态变更
 *  - DeletionVerified：删除验证完成（安全销毁）
 *  - EvidenceSealed：证据封存（D41 WORM/签名/TSA）
 *
 * 事件类型命名对齐 D35.13：com.aipilot.<domain>.<aggregate>.<fact>.v1
 *
 * 权威源：@design/D35-API-事件契约.md §D35.14 + security.md §9 数据生命周期
 */
import { z } from "zod";
import type { CloudEvent } from "./cloud-event";

/** 审批决定结果（对齐双审批状态机） */
export const approvalDecisionSchema = z.enum(["APPROVED", "REJECTED"]);

/** 审批类型 */
export const approvalTypeSchema = z.enum([
  "IRREVERSIBLE_ACTION",
  "AI_REVIEW",
  "DATA_DELETION",
  "EVIDENCE_SEAL",
]);

/** 法律保留状态 */
export const legalHoldStatusSchema = z.enum(["NONE", "ACTIVE", "RELEASED"]);

/** ApprovalDecided 事件 data */
export const approvalDecidedDataSchema = z.object({
  /** 审批实例 ID */
  approvalId: z.string().min(1),
  /** 审批类型 */
  approvalType: approvalTypeSchema,
  /** 审批决定 */
  decision: approvalDecisionSchema,
  /** 审批人 ID */
  approverId: z.string().min(1),
  /** 审批轮次（对齐双审批状态机 PENDING_REVIEW1→PENDING_REVIEW2） */
  approvalRound: z.union([z.literal(1), z.literal(2)]),
  /** 审批意见（脱敏，不含敏感内容） */
  comment: z.string().max(512).optional(),
});

/** LegalHoldChanged 事件 data */
export const legalHoldChangedDataSchema = z.object({
  /** 法律保留实例 ID */
  legalHoldId: z.string().min(1),
  /** 保留对象（数据资产 ID / 项目 ID） */
  targetId: z.string().min(1),
  /** 保留状态 */
  status: legalHoldStatusSchema,
  /** 保留原因（合规依据，不含敏感内容） */
  reason: z.string().max(512),
});

/** DeletionVerified 事件 data */
export const deletionVerifiedDataSchema = z.object({
  /** 删除任务 ID */
  deletionId: z.string().min(1),
  /** 删除对象类型（如 audit_log/data_asset） */
  targetType: z.string().min(1).max(100),
  /** 删除对象 ID */
  targetId: z.string().min(1),
  /** 安全销毁验证结果（覆写 + 密钥销毁） */
  verified: z.literal(true),
});

/** EvidenceSealed 事件 data */
export const evidenceSealedDataSchema = z.object({
  /** 证据包 ID */
  evidencePackageId: z.string().min(1),
  /** 证据包状态（固定 SEALED） */
  status: z.literal("SEALED"),
  /** 证据内容哈希（SHA-256） */
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  /** 对象存储 URI（WORM 存储） */
  objectUri: z.string().url(),
  /** TSA 时间戳证明（RFC 3161 签名） */
  tsaProof: z.string().min(1),
});

/**
 * 构建 Governance 域事件（统一信封工厂）
 */
export function buildGovernanceEvent(
  base: Omit<CloudEvent, "type" | "subject" | "dataschema" | "datacontenttype">,
  typeSuffix: string,
  subject: string,
  dataschema: string,
): CloudEvent {
  return {
    ...base,
    type: `com.aipilot.governance.${typeSuffix}.v1`,
    subject,
    datacontenttype: "application/json",
    dataschema,
  };
}
