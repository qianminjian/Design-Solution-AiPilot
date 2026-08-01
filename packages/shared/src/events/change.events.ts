/**
 * Change 域事件契约（P0-2.2 Event/AsyncAPI 契约）
 *
 * 变更影响与闭环工作台（D37.16 P12）领域事件：
 *  - ChangeRequestCreated：变更请求创建
 *  - ChangeImpactAssessed：影响分析完成（AiImpactAnalyzer 输出）
 *  - ChangeRequestApproved：变更请求审批通过（IRREVERSIBLE 双人审批）
 *  - ChangeClosed：变更闭环（处置完成 + 复核矩阵闭环）
 *
 * 事件类型命名对齐 D35.13：com.aipilot.<domain>.<aggregate>.<fact>.v1
 *
 * 权威源：@design/D37-关键界面-交互状态.md §P12 + @design/D35-API-事件契约.md §D35.14
 */
import { z } from "zod";
import type { CloudEvent } from "./cloud-event";

/** 变更请求 ID */
export const changeRequestIdSchema = z.string().min(1);

/** 变更影响等级（对齐 D37.16 Impact Operation 结果） */
export const changeImpactLevelSchema = z.enum([
  "none",
  "low",
  "medium",
  "high",
  "critical",
]);

/** 变更请求状态（对齐 ChangeRequest 状态机） */
export const changeRequestStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "IMPLEMENTING",
  "CLOSED",
]);

/** 影响评估结果（Impact Operation 输出） */
export const changeImpactDataSchema = z.object({
  /** 受影响专业/构件数 */
  affectedDisciplines: z.number().int().nonnegative(),
  /** 受影响文档/构件引用数 */
  affectedItems: z.number().int().nonnegative(),
  /** 影响等级 */
  impactLevel: changeImpactLevelSchema,
  /** 影响摘要（最小事实，大内容走 Manifest 引用） */
  summary: z.string().max(512),
});

/** ChangeRequestCreated 事件 data */
export const changeRequestCreatedDataSchema = z.object({
  /** 变更请求 ID */
  changeRequestId: changeRequestIdSchema,
  /** 变更标题 */
  title: z.string().min(1).max(200),
  /** 关联项目 ID */
  projectId: z.string().min(1),
  /** 发起人 ID */
  requesterId: z.string().min(1),
  /** 初始状态（固定 SUBMITTED） */
  status: z.literal("SUBMITTED"),
});

/** ChangeImpactAssessed 事件 data */
export const changeImpactAssessedDataSchema = changeImpactDataSchema;

/** ChangeRequestApproved 事件 data */
export const changeRequestApprovedDataSchema = z.object({
  /** 变更请求 ID */
  changeRequestId: changeRequestIdSchema,
  /** 审批通过后的状态（固定 APPROVED） */
  status: z.literal("APPROVED"),
  /** 审批人 ID */
  approverId: z.string().min(1),
  /** 审批轮次（1=发起人复核 / 2=第二审批人，对齐双审批状态机） */
  approvalRound: z.union([z.literal(1), z.literal(2)]),
});

/** ChangeClosed 事件 data */
export const changeClosedDataSchema = z.object({
  /** 变更请求 ID */
  changeRequestId: changeRequestIdSchema,
  /** 闭环状态（固定 CLOSED） */
  status: z.literal("CLOSED"),
  /** 闭环处置摘要 */
  closureSummary: z.string().max(512),
});

/**
 * 构建 Change 域事件（统一信封工厂）
 *
 * @param base 事件公共字段（id/source/time/extensions/data）
 * @param type 事件类型后缀（如 "ChangeRequest.Created"）
 * @returns 完整 CloudEvent
 */
export function buildChangeEvent(
  base: Omit<CloudEvent, "type" | "subject" | "dataschema" | "datacontenttype">,
  typeSuffix: string,
  subject: string,
  dataschema: string,
): CloudEvent {
  return {
    ...base,
    type: `com.aipilot.change.${typeSuffix}.v1`,
    subject,
    datacontenttype: "application/json",
    dataschema,
  };
}
