/**
 * Monitoring 域 Zod Schema（系统健康与指标）
 *
 * 用途：
 *  - 前端监控面板运行时验证响应数据结构
 *  - 强制 timestamp 为 ISO datetime，避免时区解析问题
 */
import { z } from "zod";

/** 单个服务健康状态 */
export const serviceHealthSchema = z.object({
  status: z.enum(["UP", "DOWN"]),
  details: z.record(z.unknown()).optional(),
  error: z.string().optional(),
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
  timestamp: z.string().datetime(),
});

// ── 推断类型导出 ──

/** 单个服务健康状态 */
export type ServiceHealth = z.infer<typeof serviceHealthSchema>;
/** 健康检查响应 */
export type HealthCheckResult = z.infer<typeof healthCheckResultSchema>;
