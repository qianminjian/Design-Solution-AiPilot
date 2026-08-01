/**
 * CloudEvent 信封契约（P0-2.2 Event/AsyncAPI 契约）
 *
 * 对齐 D35.13 CloudEvent Envelope 与 Topic 规则：
 *  - specversion=1.0
 *  - id 为 event UUIDv7，全局唯一，重投不变
 *  - source 为 /services/{service}/{domain} 稳定 URI-reference
 *  - type 为 com.aipilot.<domain>.<aggregate>.<fact>.v1（事实用过去式语义）
 *  - subject 为 tenants/{tenant}/projects/{project}/<aggregate>/<id>
 *  - extensions 携带 tenantId/projectId/aggregateId/aggregateVersion/
 *    correlationId/causationId/traceparent/classification
 *
 * 权威源：@design/D35-API-事件契约.md §D35.13 + §D35.14 + §D35.22
 */
import { z } from "zod";

/** 数据分类（对齐 security.md §8 PII 数据分级 L1-L5） */
export const EVENT_CLASSIFICATION_SCHEMA = z.enum([
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
]);
export type EventClassification = z.infer<typeof EVENT_CLASSIFICATION_SCHEMA>;

/** CloudEvent 扩展属性（D35.13 Extensions） */
export const cloudEventExtensionsSchema = z.object({
  /** 租户 ID（分区 key 组成部分） */
  tenantId: z.string().min(1),
  /** 项目 ID（可选，仅项目内事件携带） */
  projectId: z.string().optional(),
  /** 聚合 ID（保序范围 key 组成部分） */
  aggregateId: z.string().min(1),
  /** 聚合版本（乐观并发 + 顺序检测，检测缺口防事件丢失） */
  aggregateVersion: z.number().int().positive(),
  /** 关联 ID（事件链），可空 */
  correlationId: z.string().optional(),
  /** 起因 ID（来源事件），可空 */
  causationId: z.string().optional(),
  /** W3C traceparent（链路追踪传播） */
  traceparent: z.string().optional(),
  /** 数据分类（对齐 PII 分级） */
  classification: EVENT_CLASSIFICATION_SCHEMA,
});

/** CloudEvent 数据负载（最小事实 + 变化摘要，大内容走 Manifest 引用） */
export const cloudEventDataSchema = z.record(z.string(), z.unknown());

/** CloudEvent 信封（D35.13 全字段） */
export const cloudEventSchema = z.object({
  /** CloudEvents 规范版本，固定 "1.0" */
  specversion: z.literal("1.0"),
  /** 事件唯一 ID（UUIDv7，全局唯一，重投不变） */
  id: z.string().min(1),
  /** 来源 URI：/services/{service}/{domain} */
  source: z.string().regex(/^\/services\/[a-z0-9-]+\/[a-z0-9-]+$/),
  /** 事件类型：com.aipilot.<domain>.<aggregate>.<fact>.v1 */
  type: z
    .string()
    .regex(/^com\.aipilot\.[a-z0-9-]+\.[A-Za-z0-9-]+\.[A-Za-z0-9-]+\.v\d+$/),
  /** 主题：tenants/{tenant}/projects/{project}/<aggregate>/<id> */
  subject: z
    .string()
    .regex(/^tenants\/[^/]+(\/projects\/[^/]+)?\/[^/]+\/[^/]+$/),
  /** 领域事实发生时间（UTC ISO8601） */
  time: z.string().datetime({ offset: true }),
  /** 数据内容类型 */
  datacontenttype: z.literal("application/json"),
  /** Schema Registry 不可变版本 URI */
  dataschema: z.string().url(),
  /** 扩展属性（tenantId/aggregateId/aggregateVersion/classification 必填） */
  extensions: cloudEventExtensionsSchema,
  /** 最小事实与变化摘要 */
  data: cloudEventDataSchema.optional(),
});

/** CloudEvent 信封类型 */
export type CloudEvent = z.infer<typeof cloudEventSchema>;
export type CloudEventExtensions = z.infer<typeof cloudEventExtensionsSchema>;
