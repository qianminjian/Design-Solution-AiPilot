/**
 * Monitoring 域 Zod Schema（系统健康与指标）
 *
 * 用途：
 *  - 前端监控面板运行时验证响应数据结构
 *  - 强制 timestamp 为 ISO datetime，避免时区解析问题
 *  - 对齐 BFF HealthService 返回结构（含 schemaValidation 失败统计）
 */
import { z } from "zod";

/** 单个服务健康状态 */
export const serviceHealthSchema = z.object({
  status: z.enum(["UP", "DOWN"]),
  details: z.record(z.unknown()).optional(),
  error: z.string().optional(),
});

/** Schema 验证失败计数器条目 */
export const failureCounterEntrySchema = z.object({
  /** 累计失败次数 */
  count: z.number().int().nonnegative(),
  /** 最近一次失败的 traceId（便于关联日志） */
  lastTraceId: z.string().optional(),
  /** 最近一次失败时间（ISO 时间戳） */
  lastFailedAt: z.string().datetime().optional(),
});

/** Schema 验证失败统计（V1 可观测性，BFF health 端点透出） */
export const schemaValidationStatsSchema = z.object({
  /** 软验证失败累计次数 */
  softTotal: z.number().int().nonnegative(),
  /** 严格验证失败累计次数（每次都伴随 502 阻断） */
  strictTotal: z.number().int().nonnegative(),
  /** 软验证失败快照（按 context + schema 聚合） */
  softFailures: z.record(z.record(failureCounterEntrySchema)),
  /** 严格验证失败快照 */
  strictFailures: z.record(z.record(failureCounterEntrySchema)),
});

/** 健康检查响应 */
export const healthCheckResultSchema = z.object({
  status: z.enum(["UP", "DOWN"]),
  services: z.object({
    bff: serviceHealthSchema,
    core: serviceHealthSchema,
    ai: serviceHealthSchema,
    postgresql: serviceHealthSchema,
    minio: serviceHealthSchema,
  }),
  /** Schema 验证失败统计（V1 可观测性） */
  schemaValidation: schemaValidationStatsSchema,
  timestamp: z.string().datetime(),
});

// ── 推断类型导出 ──

/** 单个服务健康状态 */
export type ServiceHealth = z.infer<typeof serviceHealthSchema>;
/** Schema 验证失败计数器条目 */
export type FailureCounterEntry = z.infer<typeof failureCounterEntrySchema>;
/** Schema 验证失败统计 */
export type SchemaValidationStats = z.infer<typeof schemaValidationStatsSchema>;
/** 健康检查响应 */
export type HealthCheckResult = z.infer<typeof healthCheckResultSchema>;
