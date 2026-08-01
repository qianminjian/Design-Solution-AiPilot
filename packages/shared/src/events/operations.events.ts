/**
 * Operations 域事件契约（P0-2.2 Event/AsyncAPI 契约）
 *
 * 运营中心（D37.17 P13）+ Integration 域事件（D35.14）：
 *  - ConnectorQualified：连接器资质确认（注册 + 健康检查通过）
 *  - IntegrationJobChanged：集成作业状态变更（排队/执行/完成/失败/死信）
 *  - ArtifactImported：构件导入完成
 *  - ConflictDetected：集成冲突检测（如版本冲突）
 *
 * 事件类型命名对齐 D35.13：com.aipilot.<domain>.<aggregate>.<fact>.v1
 *
 * 权威源：@design/D37-关键界面-交互状态.md §P13 + @design/D35-API-事件契约.md §D35.14
 */
import { z } from "zod";
import type { CloudEvent } from "./cloud-event";

/** 连接器 ID */
export const connectorIdSchema = z.string().min(1);

/** 集成作业状态（对齐 QueueTaskStatus 状态机 + 死信） */
export const integrationJobStatusSchema = z.enum([
  "QUEUED",
  "CLAIMED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "DEAD_LETTER",
]);

/** 连接器状态（对齐 Connector 生命周期） */
export const connectorStatusSchema = z.enum([
  "REGISTERED",
  "CONNECTED",
  "DEGRADED",
  "DISCONNECTED",
  "ERROR",
]);

/** ConnectorQualified 事件 data */
export const connectorQualifiedDataSchema = z.object({
  /** 连接器 ID */
  connectorId: connectorIdSchema,
  /** 连接器名称 */
  name: z.string().min(1).max(200),
  /** 连接器类型（如 revit/autocad/rhino） */
  connectorType: z.string().min(1).max(100),
  /** 资质确认后的状态（固定 CONNECTED） */
  status: z.literal("CONNECTED"),
  /** 健康检查延迟（ms） */
  healthCheckLatencyMs: z.number().int().nonnegative(),
});

/** IntegrationJobChanged 事件 data */
export const integrationJobChangedDataSchema = z.object({
  /** 集成作业 ID */
  jobId: z.string().min(1),
  /** 关联连接器 ID */
  connectorId: connectorIdSchema,
  /** 作业状态 */
  status: integrationJobStatusSchema,
  /** 失败原因摘要（仅 FAILED/DEAD_LETTER 携带） */
  failureReason: z.string().max(512).optional(),
});

/** ArtifactImported 事件 data */
export const artifactImportedDataSchema = z.object({
  /** 导入构件 ID */
  artifactId: z.string().min(1),
  /** 关联连接器 ID */
  connectorId: connectorIdSchema,
  /** 导入来源文件类型（如 .rvt/.dwg） */
  sourceType: z.string().min(1).max(20),
  /** 对象存储 URI */
  objectUri: z.string().url(),
  /** 内容哈希（SHA-256，证据可校验） */
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
});

/** ConflictDetected 事件 data */
export const conflictDetectedDataSchema = z.object({
  /** 冲突 ID */
  conflictId: z.string().min(1),
  /** 关联集成作业 ID */
  jobId: z.string().min(1),
  /** 冲突类型 */
  conflictType: z.enum([
    "version_mismatch",
    "schema_conflict",
    "duplicate",
    "other",
  ]),
  /** 冲突描述（脱敏，不含敏感内容） */
  description: z.string().max(512),
});

/**
 * 构建 Operations 域事件（统一信封工厂）
 */
export function buildOperationsEvent(
  base: Omit<CloudEvent, "type" | "subject" | "dataschema" | "datacontenttype">,
  typeSuffix: string,
  subject: string,
  dataschema: string,
): CloudEvent {
  return {
    ...base,
    type: `com.aipilot.integration.${typeSuffix}.v1`,
    subject,
    datacontenttype: "application/json",
    dataschema,
  };
}
