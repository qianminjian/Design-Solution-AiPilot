/**
 * useProjects hooks 单元测试
 *
 * 验证：
 *  - useProjects 调用 apiGet 时传入 schema 软验证配置
 *  - useProject 在 id 为空时禁用查询
 *  - useCreateProject 自动生成 Idempotency-Key 头并失效列表缓存
 *  - useUpdateProject 派生 If-Match 头并失效列表+详情缓存
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HttpHeader } from "@design-platform/shared";

// Mock api-client：捕获 apiGet/apiPost/apiPatch 调用
const { mockApiGet, mockApiPost, mockApiPatch } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
}));
vi.mock("@/lib/api-client", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
}));

// 恢复真实的 @tanstack/react-query 实现
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return { ...actual };
});

import {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
} from "@/hooks/use-projects";

/** 包装 QueryClientProvider */
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

describe("useProjects hooks", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
  });

  describe("useProjects", () => {
    it("应该调用 apiGet 并传入 schema 软验证配置", async () => {
      const mockPage = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        hasMore: false,
      };
      mockApiGet.mockResolvedValue(mockPage);

      const { Wrapper } = createWrapper();
      const { result } = renderHook(
        () => useProjects({ page: 1, pageSize: 10 }),
        {
          wrapper: Wrapper,
        },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockApiGet).toHaveBeenCalledTimes(1);
      const [path, options] = mockApiGet.mock.calls[0] as [
        string,
        { validate: { schema: unknown; context: string } },
      ];
      // 路径应包含 page/pageSize 参数
      expect(path).toContain("/api/v1/projects");
      expect(path).toContain("page=1");
      expect(path).toContain("pageSize=10");
      // 应传入软验证配置
      expect(options.validate.schema).toBeDefined();
      expect(options.validate.context).toBe("useProjects.list");
    });

    it("status 过滤参数应拼接到 URL", async () => {
      mockApiGet.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        hasMore: false,
      });

      const { Wrapper } = createWrapper();
      const { result } = renderHook(
        () => useProjects({ page: 1, pageSize: 10, status: "active" }),
        { wrapper: Wrapper },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const [path] = mockApiGet.mock.calls[0] as [string];
      expect(path).toContain("status=active");
    });

    it("keyword 参数应 trim 后拼接到 URL", async () => {
      mockApiGet.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        hasMore: false,
      });

      const { Wrapper } = createWrapper();
      const { result } = renderHook(
        () => useProjects({ page: 1, pageSize: 10, keyword: "  hello  " }),
        { wrapper: Wrapper },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const [path] = mockApiGet.mock.calls[0] as [string];
      expect(path).toContain("keyword=hello");
    });

    it("空 keyword 不应拼接到 URL", async () => {
      mockApiGet.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        hasMore: false,
      });

      const { Wrapper } = createWrapper();
      const { result } = renderHook(
        () => useProjects({ page: 1, pageSize: 10, keyword: "" }),
        { wrapper: Wrapper },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const [path] = mockApiGet.mock.calls[0] as [string];
      expect(path).not.toContain("keyword=");
    });
  });

  describe("useProject", () => {
    it("应该调用 apiGet 并传入 projectDtoSchema 验证配置", async () => {
      const mockProject = {
        id: "proj-001",
        code: "P001",
        name: "测试项目",
        status: "active",
        buildingType: "office",
        floorsMin: 5,
        floorsMax: 15,
        region: "us-east-1",
        language: "en",
        classification: "PROJECT_RECORD",
        rowVersion: 1,
      };
      mockApiGet.mockResolvedValue(mockProject);

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useProject("proj-001"), {
        wrapper: Wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const [path, options] = mockApiGet.mock.calls[0] as [
        string,
        { validate: { schema: unknown; context: string } },
      ];
      expect(path).toBe("/api/v1/projects/proj-001");
      expect(options.validate.schema).toBeDefined();
      expect(options.validate.context).toBe("useProjects.detail");
    });

    it("id 为空时应禁用查询，不调用 apiGet", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useProject(null), {
        wrapper: Wrapper,
      });

      expect(result.current.fetchStatus).toBe("idle");
      expect(mockApiGet).not.toHaveBeenCalled();
    });

    it("id 为 undefined 时应禁用查询", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useProject(undefined), {
        wrapper: Wrapper,
      });

      expect(result.current.fetchStatus).toBe("idle");
      expect(mockApiGet).not.toHaveBeenCalled();
    });

    it("id 为空字符串时应禁用查询", async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useProject(""), {
        wrapper: Wrapper,
      });

      expect(result.current.fetchStatus).toBe("idle");
      expect(mockApiGet).not.toHaveBeenCalled();
    });
  });

  describe("useCreateProject", () => {
    it("应该调用 apiPost 并携带 Idempotency-Key 头与 schema 验证", async () => {
      const created = {
        id: "proj-001",
        code: "P001",
        name: "测试项目",
        status: "active",
        buildingType: "office",
        floorsMin: 5,
        floorsMax: 15,
        region: "us-east-1",
        language: "en",
        classification: "PROJECT_RECORD",
        rowVersion: 1,
      };
      mockApiPost.mockResolvedValue(created);

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useCreateProject(), {
        wrapper: Wrapper,
      });

      await result.current.mutateAsync({
        code: "P001",
        name: "测试项目",
        buildingType: "office",
        floorsMin: 5,
        floorsMax: 15,
      });

      expect(mockApiPost).toHaveBeenCalledTimes(1);
      const [path, payload, options] = mockApiPost.mock.calls[0] as [
        string,
        unknown,
        {
          headers: Record<string, string>;
          validate: { schema: unknown; context: string };
        },
      ];
      expect(path).toBe("/api/v1/projects");
      expect(payload).toMatchObject({ code: "P001", name: "测试项目" });
      // Idempotency-Key 头必须存在且为有效 UUID 格式
      expect(options.headers[HttpHeader.IDEMPOTENCY_KEY]).toBeDefined();
      expect(options.headers[HttpHeader.IDEMPOTENCY_KEY]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(options.validate.schema).toBeDefined();
      expect(options.validate.context).toBe("useProjects.create");
    });

    it("创建成功后应失效列表缓存", async () => {
      const created = { id: "proj-001" };
      mockApiPost.mockResolvedValue(created);

      const { queryClient, Wrapper } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useCreateProject(), {
        wrapper: Wrapper,
      });

      await result.current.mutateAsync({
        code: "P001",
        name: "测试项目",
      });

      await waitFor(() => {
        // 至少调用一次 invalidateQueries，且 queryKey 包含 "list"
        expect(invalidateSpy).toHaveBeenCalled();
        const calls = invalidateSpy.mock.calls;
        const hasListInvalidation = calls.some((call) => {
          const arg = call[0];
          return (
            arg &&
            typeof arg === "object" &&
            "queryKey" in arg &&
            Array.isArray(arg.queryKey) &&
            arg.queryKey.includes("list")
          );
        });
        expect(hasListInvalidation).toBe(true);
      });
    });
  });

  describe("useUpdateProject", () => {
    it("应该调用 apiPatch 并派生 If-Match 头与 schema 验证", async () => {
      const updated = {
        id: "proj-001",
        code: "P001",
        name: "更新后名称",
        status: "active",
        buildingType: "office",
        floorsMin: 5,
        floorsMax: 15,
        region: "us-east-1",
        language: "en",
        classification: "PROJECT_RECORD",
        rowVersion: 2,
      };
      mockApiPatch.mockResolvedValue(updated);

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateProject(), {
        wrapper: Wrapper,
      });

      await result.current.mutateAsync({
        id: "proj-001",
        rowVersion: 1,
        payload: { name: "更新后名称" },
      });

      expect(mockApiPatch).toHaveBeenCalledTimes(1);
      const [path, payload, options] = mockApiPatch.mock.calls[0] as [
        string,
        unknown,
        {
          headers: Record<string, string>;
          validate: { schema: unknown; context: string };
        },
      ];
      expect(path).toBe("/api/v1/projects/proj-001");
      expect(payload).toMatchObject({ name: "更新后名称" });
      // If-Match 头应派生自 rowVersion，形如 "rev-1"
      expect(options.headers[HttpHeader.IF_MATCH]).toBe('"rev-1"');
      expect(options.validate.schema).toBeDefined();
      expect(options.validate.context).toBe("useProjects.update");
    });

    it("更新成功后应失效列表与详情缓存", async () => {
      const updated = {
        id: "proj-001",
        code: "P001",
        name: "更新后名称",
        status: "active",
        buildingType: "office",
        floorsMin: 5,
        floorsMax: 15,
        region: "us-east-1",
        language: "en",
        classification: "PROJECT_RECORD",
        rowVersion: 2,
      };
      mockApiPatch.mockResolvedValue(updated);

      const { queryClient, Wrapper } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useUpdateProject(), {
        wrapper: Wrapper,
      });

      await result.current.mutateAsync({
        id: "proj-001",
        rowVersion: 1,
        payload: { name: "更新后名称" },
      });

      await waitFor(() => {
        // 应同时失效 list 和 detail 缓存
        const calls = invalidateSpy.mock.calls;
        const hasList = calls.some((call) => {
          const arg = call[0];
          return (
            arg &&
            typeof arg === "object" &&
            "queryKey" in arg &&
            Array.isArray(arg.queryKey) &&
            arg.queryKey.includes("list")
          );
        });
        const hasDetail = calls.some((call) => {
          const arg = call[0];
          return (
            arg &&
            typeof arg === "object" &&
            "queryKey" in arg &&
            Array.isArray(arg.queryKey) &&
            arg.queryKey.includes("detail")
          );
        });
        expect(hasList).toBe(true);
        expect(hasDetail).toBe(true);
      });
    });
  });
});
