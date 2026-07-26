/**
 * useAuth hooks 单元测试
 *
 * 验证：
 *  - useLogout 调用 apiPost 时传入 logoutResponseSchema 验证配置
 *  - 登出成功后清空 QueryClient 缓存（防止泄露前一会话数据）
 *  - 登出失败时不清空缓存，错误向上抛出
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock apiPost 以验证 schema 验证配置（使用 vi.hoisted 保证 mock 引用一致）
const { mockApiPost } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
}));
vi.mock("@/lib/api-client", () => ({
  apiGet: vi.fn(),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

// 恢复真实的 @tanstack/react-query 实现（setup.ts 中全局 mock 了 useMutation）
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return { ...actual };
});

import { useLogout } from "@/hooks/use-auth";

/** 包装 QueryClientProvider 便于测试 hook */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return { queryClient, Wrapper };
}

describe("useAuth hooks", () => {
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  describe("useLogout", () => {
    it("应该调用 apiPost 并传入 logoutResponseSchema 验证配置", async () => {
      mockApiPost.mockResolvedValue({ revoked: true });

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

      await result.current.mutateAsync();

      expect(mockApiPost).toHaveBeenCalledTimes(1);
      const [path, body, options] = mockApiPost.mock.calls[0] as [
        string,
        unknown,
        { validate: { schema: unknown; context: string } },
      ];
      expect(path).toBe("/api/v1/auth/logout");
      expect(body).toBeUndefined();
      expect(options.validate.schema).toBeDefined();
      expect(options.validate.context).toBe("auth.logout");
    });

    it("登出成功后应清空 QueryClient 缓存", async () => {
      mockApiPost.mockResolvedValue({ revoked: true });

      const { queryClient, Wrapper } = createWrapper();
      const clearSpy = vi.spyOn(queryClient, "clear");

      const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

      await result.current.mutateAsync();

      await waitFor(() => {
        expect(clearSpy).toHaveBeenCalledTimes(1);
      });
    });

    it("登出失败时不应清空缓存，错误向上抛出", async () => {
      mockApiPost.mockRejectedValue(new Error("网络异常"));

      const { queryClient, Wrapper } = createWrapper();
      const clearSpy = vi.spyOn(queryClient, "clear");

      const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

      let caught: unknown;
      try {
        await result.current.mutateAsync();
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe("网络异常");

      await waitFor(() => {
        expect(clearSpy).not.toHaveBeenCalled();
      });
    });
  });
});
