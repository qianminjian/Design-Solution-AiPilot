/**
 * useDocuments hooks 单元测试
 *
 * 验证：
 *  - useDocuments 调用 apiGet 时传入 schema 软验证配置（offsetPageResponseSchema）
 *  - useDocuments 在 projectId 为空时禁用查询
 *  - useDocuments 的 status/keyword/sort/order 参数拼接
 *  - useDocumentVersions 调用 apiGet 并传入 array schema
 *  - useUploadDocumentVersion 调用 apiPost 并失效 versions+list 缓存
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));
vi.mock("@/lib/api-client", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return { ...actual };
});

import {
  useDocuments,
  useDocumentVersions,
  useUploadDocumentVersion,
} from "@/hooks/use-documents";

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

describe("useDocuments hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
  });

  it("应该调用 apiGet 并传入 schema 软验证配置", async () => {
    const mockPage = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    };
    mockApiGet.mockResolvedValue(mockPage);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useDocuments("proj-001", { page: 1, pageSize: 20 }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledTimes(1);
    const [path, options] = mockApiGet.mock.calls[0] as [
      string,
      { validate: { schema: unknown; context: string } },
    ];
    expect(path).toContain("/api/v1/projects/proj-001/documents");
    expect(path).toContain("page=1");
    expect(path).toContain("pageSize=20");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useDocuments.list");
  });

  it("status 参数应拼接到 URL", async () => {
    mockApiGet.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useDocuments("proj-001", { status: "PUBLISHED" }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const [path] = mockApiGet.mock.calls[0] as [string];
    expect(path).toContain("status=PUBLISHED");
  });

  it("keyword 参数应 trim 后拼接到 URL", async () => {
    mockApiGet.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useDocuments("proj-001", { keyword: "  floor-plan  " }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const [path] = mockApiGet.mock.calls[0] as [string];
    expect(path).toContain("keyword=floor-plan");
  });

  it("空 keyword 不应拼接到 URL", async () => {
    mockApiGet.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useDocuments("proj-001", { keyword: "   " }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const [path] = mockApiGet.mock.calls[0] as [string];
    expect(path).not.toContain("keyword=");
  });

  it("sort/order 参数应拼接到 URL", async () => {
    mockApiGet.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useDocuments("proj-001", {
          sort: "updatedAt",
          order: "asc",
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const [path] = mockApiGet.mock.calls[0] as [string];
    expect(path).toContain("sort=updatedAt");
    expect(path).toContain("order=asc");
  });

  it("projectId 为 null 时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocuments(null), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("projectId 为空字符串时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocuments(""), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useDocumentVersions hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该调用 apiGet 并传入 array schema 软验证配置", async () => {
    const versions = [
      {
        id: "ver-1",
        documentId: "doc-1",
        versionNumber: 1,
        storageKey: "s3://key/v1",
        checksum: "abc123",
        uploadedAt: "2026-07-26T10:00:00Z",
        uploadedBy: "user-1",
      },
    ];
    mockApiGet.mockResolvedValue(versions);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocumentVersions("doc-001"), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledTimes(1);
    const [path, options] = mockApiGet.mock.calls[0] as [
      string,
      { validate: { schema: unknown; context: string } },
    ];
    expect(path).toBe("/api/v1/documents/doc-001/versions");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useDocuments.versions");
  });

  it("documentId 为 null 时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocumentVersions(null), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("documentId 为空字符串时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDocumentVersions(""), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useUploadDocumentVersion hook", () => {
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  it("应该调用 apiPost 提交新版本并失效 versions+list 缓存", async () => {
    mockApiPost.mockResolvedValue(undefined);

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUploadDocumentVersion(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      documentId: "doc-001",
      payload: {
        storageKey: "s3://bucket/key-v2",
        checksum: "def456",
        comment: "更新版本",
      },
    });

    expect(mockApiPost).toHaveBeenCalledTimes(1);
    const [path, payload] = mockApiPost.mock.calls[0] as [string, unknown];
    expect(path).toBe("/api/v1/documents/doc-001/versions");
    expect(payload).toMatchObject({
      storageKey: "s3://bucket/key-v2",
      checksum: "def456",
      comment: "更新版本",
    });

    await waitFor(() => {
      const calls = invalidateSpy.mock.calls;
      const hasVersionsInvalidation = calls.some((call) => {
        const arg = call[0];
        return (
          arg &&
          typeof arg === "object" &&
          "queryKey" in arg &&
          Array.isArray(arg.queryKey) &&
          arg.queryKey.includes("versions")
        );
      });
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
      expect(hasVersionsInvalidation).toBe(true);
      expect(hasListInvalidation).toBe(true);
    });
  });

  it("无 comment 字段时也应正常提交", async () => {
    mockApiPost.mockResolvedValue(undefined);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUploadDocumentVersion(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      documentId: "doc-001",
      payload: {
        storageKey: "s3://key",
        checksum: "abc",
      },
    });

    expect(mockApiPost).toHaveBeenCalledTimes(1);
    const [path, payload] = mockApiPost.mock.calls[0] as [string, unknown];
    expect(path).toBe("/api/v1/documents/doc-001/versions");
    expect(payload).toMatchObject({
      storageKey: "s3://key",
      checksum: "abc",
    });
  });
});
