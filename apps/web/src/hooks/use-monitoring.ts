"use client";

import { useQuery } from "@tanstack/react-query";
import type { HealthCheckResult, ServiceHealth } from "@design-platform/shared";
import { healthCheckResultSchema } from "@design-platform/shared";
import { apiGet } from "@/lib/api-client";

// ── 类型再导出（向后兼容组件层导入） ──

export type { HealthCheckResult, ServiceHealth };

/** 查询健康状态（30 秒轮询）
 *
 * 契约验证：软验证模式
 *  - 强制 timestamp 为 ISO datetime，避免时区解析问题
 *  - 验证失败不阻断展示，console.warn 记录便于排查
 */
export function useHealth() {
  return useQuery<HealthCheckResult>({
    queryKey: ["monitoring", "health"],
    queryFn: () =>
      apiGet<HealthCheckResult>("/api/v1/health", {
        validate: {
          schema: healthCheckResultSchema,
          context: "useMonitoring.health",
        },
      }),
    refetchInterval: 30_000,
    retry: 1,
  });
}

/** 查询 Prometheus 指标（30 秒轮询）
 *
 * Prometheus 暴露的是 text/plain 格式，不走 ApiResponse 包装，因此不接入 schema 验证
 */
export function useMetrics() {
  return useQuery<string>({
    queryKey: ["monitoring", "metrics"],
    queryFn: async () => {
      const response = await fetch("/api/v1/metrics");
      if (!response.ok) throw new Error("指标获取失败");
      return response.text();
    },
    refetchInterval: 30_000,
    retry: 1,
  });
}
