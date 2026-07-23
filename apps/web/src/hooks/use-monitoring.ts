"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";

/** 单个服务健康状态 */
export interface ServiceHealth {
  status: "UP" | "DOWN";
  details?: Record<string, unknown>;
  error?: string;
}

/** 健康检查响应 */
export interface HealthCheckResult {
  status: "UP" | "DOWN";
  services: {
    bff: ServiceHealth;
    core: ServiceHealth;
    ai: ServiceHealth;
    postgresql: ServiceHealth;
    minio: ServiceHealth;
  };
  timestamp: string;
}

/** 查询健康状态（30 秒轮询） */
export function useHealth() {
  return useQuery<HealthCheckResult>({
    queryKey: ["monitoring", "health"],
    queryFn: () => apiGet<HealthCheckResult>("/api/v1/health"),
    refetchInterval: 30_000,
    retry: 1,
  });
}

/** 查询 Prometheus 指标（30 秒轮询） */
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
