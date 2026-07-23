import { QueryClient } from "@tanstack/react-query";

/**
 * 创建 TanStack Query 客户端
 * - staleTime 30s：避免短时间内重复请求
 * - retry 1：仅重试一次，防止付费 API 被反复调用（D35 第三方 API 红线）
 * - refetchOnWindowFocus false：默认不在窗口聚焦时重新拉取
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
