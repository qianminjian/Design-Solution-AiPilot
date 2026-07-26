/**
 * use-iam hooks 单元测试
 *
 * 验证：
 *  - usePrincipals / usePrincipal：列表与详情查询，调用 apiGet + schema 软验证
 *  - useCreatePrincipal / useUpdatePrincipal：mutation 调用 apiPost/apiPatch + Idempotency/If-Match
 *  - useOrganizations / useCreateOrganization：组织列表与创建
 *  - useMemberships / useMembership / useCreateMembership / useUpdateMembership / useDeleteMembership：成员关系 CRUD
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockApiGet, mockApiPost, mockApiPatch, mockApiDelete } = vi.hoisted(
  () => ({
    mockApiGet: vi.fn(),
    mockApiPost: vi.fn(),
    mockApiPatch: vi.fn(),
    mockApiDelete: vi.fn(),
  }),
);
vi.mock("@/lib/api-client", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
  apiDelete: (...args: unknown[]) => mockApiDelete(...args),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return { ...actual };
});

import {
  usePrincipals,
  usePrincipal,
  useCreatePrincipal,
  useUpdatePrincipal,
  useOrganizations,
  useCreateOrganization,
  useMemberships,
  useMembership,
  useCreateMembership,
  useUpdateMembership,
  useDeleteMembership,
} from "@/hooks/use-iam";

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

/** 构造符合 PrincipalDto schema 的 mock 数据 */
function mockPrincipalDto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tenantId: "22222222-2222-4222-8222-222222222222",
    type: "user",
    email: "alice@example.com",
    displayName: "Alice",
    status: "active",
    locale: "zh-CN",
    timezone: "Asia/Shanghai",
    classification: "project_record",
    externalId: null,
    lastLoginAt: null,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    rowVersion: 1,
    ...overrides,
  };
}

/** 构造符合 OrganizationDto schema 的 mock 数据 */
function mockOrganizationDto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    tenantId: "22222222-2222-4222-8222-222222222222",
    parentId: null,
    name: "总部",
    type: "enterprise",
    status: "active",
    classification: "project_record",
    metadata: {},
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    rowVersion: 1,
    ...overrides,
  };
}

/** 构造符合 MembershipDto schema 的 mock 数据 */
function mockMembershipDto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    tenantId: "22222222-2222-4222-8222-222222222222",
    principalId: "11111111-1111-4111-8111-111111111111",
    organizationId: "33333333-3333-4333-8333-333333333333",
    role: "architect",
    status: "active",
    joinedAt: "2026-07-01T00:00:00Z",
    effectiveFrom: null,
    effectiveTo: null,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    rowVersion: 1,
    ...overrides,
  };
}

describe("usePrincipals hook", () => {
  beforeEach(() => mockApiGet.mockReset());

  it("应该调用 apiGet 并传入 schema 软验证配置", async () => {
    const mockPage = {
      items: [mockPrincipalDto()],
      total: 1,
      page: 1,
      pageSize: 10,
      hasMore: false,
    };
    mockApiGet.mockResolvedValue(mockPage);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePrincipals(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledTimes(1);
    const [path, options] = mockApiGet.mock.calls[0] as [
      string,
      { validate: { schema: unknown; context: string } },
    ];
    expect(path).toContain("/api/v1/principals");
    expect(path).toContain("page=1");
    expect(path).toContain("pageSize=10");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("usePrincipals.list");
  });
});

describe("usePrincipal hook", () => {
  beforeEach(() => mockApiGet.mockReset());

  it("应该在 id 为空时不发起查询", () => {
    const { Wrapper } = createWrapper();
    renderHook(() => usePrincipal(null), { wrapper: Wrapper });
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("应该调用 apiGet 查询主体详情", async () => {
    mockApiGet.mockResolvedValue(mockPrincipalDto());

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => usePrincipal("11111111-1111-4111-8111-111111111111"),
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
    expect(path).toBe(
      "/api/v1/principals/11111111-1111-4111-8111-111111111111",
    );
    expect(options.validate.context).toBe("usePrincipal.detail");
  });
});

describe("useCreatePrincipal hook", () => {
  beforeEach(() => mockApiPost.mockReset());

  it("应该调用 apiPost 并携带 Idempotency-Key 头", async () => {
    mockApiPost.mockResolvedValue(mockPrincipalDto());

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreatePrincipal(), {
      wrapper: Wrapper,
    });

    const payload = {
      email: "bob@example.com",
      displayName: "Bob",
      password: "super-secret-pwd",
    };
    await result.current.mutateAsync(payload);

    expect(mockApiPost).toHaveBeenCalledTimes(1);
    const [path, body, options] = mockApiPost.mock.calls[0] as [
      string,
      unknown,
      { headers: { "idempotency-key": string }; validate: { context: string } },
    ];
    expect(path).toBe("/api/v1/principals");
    expect(body).toEqual(payload);
    expect(options.headers["idempotency-key"]).toBeTruthy();
    expect(options.validate.context).toBe("usePrincipal.create");
  });
});

describe("useUpdatePrincipal hook", () => {
  beforeEach(() => mockApiPatch.mockReset());

  it("应该调用 apiPatch 并携带 If-Match 头", async () => {
    mockApiPatch.mockResolvedValue(mockPrincipalDto({ rowVersion: 2 }));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdatePrincipal(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      id: "11111111-1111-4111-8111-111111111111",
      rowVersion: 1,
      payload: { displayName: "Alice Updated" },
    });

    expect(mockApiPatch).toHaveBeenCalledTimes(1);
    const [path, body, options] = mockApiPatch.mock.calls[0] as [
      string,
      unknown,
      { headers: { "if-match": string }; validate: { context: string } },
    ];
    expect(path).toBe(
      "/api/v1/principals/11111111-1111-4111-8111-111111111111",
    );
    expect(body).toEqual({ displayName: "Alice Updated" });
    expect(options.headers["if-match"]).toBe('"rev-1"');
    expect(options.validate.context).toBe("usePrincipal.update");
  });
});

describe("useOrganizations hook", () => {
  beforeEach(() => mockApiGet.mockReset());

  it("应该调用 apiGet 查询组织列表", async () => {
    mockApiGet.mockResolvedValue({
      items: [mockOrganizationDto()],
      total: 1,
      page: 1,
      pageSize: 50,
      hasMore: false,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useOrganizations(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const [path, options] = mockApiGet.mock.calls[0] as [
      string,
      { validate: { schema: unknown; context: string } },
    ];
    expect(path).toContain("/api/v1/organizations");
    expect(options.validate.context).toBe("useOrganizations.list");
  });
});

describe("useCreateOrganization hook", () => {
  beforeEach(() => mockApiPost.mockReset());

  it("应该调用 apiPost 并携带 Idempotency-Key 头", async () => {
    mockApiPost.mockResolvedValue(mockOrganizationDto());

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateOrganization(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({ name: "新组织" });

    const [path, , options] = mockApiPost.mock.calls[0] as [
      string,
      unknown,
      { headers: { "idempotency-key": string } },
    ];
    expect(path).toBe("/api/v1/organizations");
    expect(options.headers["idempotency-key"]).toBeTruthy();
  });
});

describe("useMemberships hook", () => {
  beforeEach(() => mockApiGet.mockReset());

  it("应该按筛选条件构造 query string", async () => {
    mockApiGet.mockResolvedValue({
      items: [mockMembershipDto()],
      total: 1,
      page: 1,
      pageSize: 10,
      hasMore: false,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useMemberships({
          page: 2,
          pageSize: 20,
          organizationId: "org-1",
          status: "active",
          role: "architect",
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const [path, options] = mockApiGet.mock.calls[0] as [
      string,
      { validate: { schema: unknown; context: string } },
    ];
    expect(path).toContain("/api/v1/memberships");
    expect(path).toContain("page=2");
    expect(path).toContain("pageSize=20");
    expect(path).toContain("organizationId=org-1");
    expect(path).toContain("status=active");
    expect(path).toContain("role=architect");
    expect(options.validate.context).toBe("useMemberships.list");
  });
});

describe("useMembership hook", () => {
  beforeEach(() => mockApiGet.mockReset());

  it("应该在 id 为空时不发起查询", () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useMembership(null), { wrapper: Wrapper });
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useCreateMembership hook", () => {
  beforeEach(() => mockApiPost.mockReset());

  it("应该调用 apiPost 创建成员关系并失效列表缓存", async () => {
    mockApiPost.mockResolvedValue(mockMembershipDto());

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateMembership(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      principalId: "11111111-1111-4111-8111-111111111111",
      organizationId: "33333333-3333-4333-8333-333333333333",
      role: "architect",
    });

    expect(mockApiPost).toHaveBeenCalledTimes(1);
    const [path, body] = mockApiPost.mock.calls[0] as [string, unknown];
    expect(path).toBe("/api/v1/memberships");
    expect(body).toMatchObject({ role: "architect" });

    await waitFor(() => {
      const hasListInvalidation = invalidateSpy.mock.calls.some((call) => {
        const arg = call[0];
        return (
          arg &&
          typeof arg === "object" &&
          "queryKey" in arg &&
          Array.isArray(arg.queryKey) &&
          arg.queryKey.includes("memberships")
        );
      });
      expect(hasListInvalidation).toBe(true);
    });
  });
});

describe("useUpdateMembership hook", () => {
  beforeEach(() => mockApiPatch.mockReset());

  it("应该调用 apiPatch 并携带 If-Match 头", async () => {
    mockApiPatch.mockResolvedValue(mockMembershipDto({ rowVersion: 2 }));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateMembership(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      id: "44444444-4444-4444-8444-444444444444",
      rowVersion: 1,
      payload: { role: "reviewer", status: "suspended" },
    });

    const [path, body, options] = mockApiPatch.mock.calls[0] as [
      string,
      unknown,
      { headers: { "if-match": string }; validate: { context: string } },
    ];
    expect(path).toBe(
      "/api/v1/memberships/44444444-4444-4444-8444-444444444444",
    );
    expect(body).toEqual({ role: "reviewer", status: "suspended" });
    expect(options.headers["if-match"]).toBe('"rev-1"');
    expect(options.validate.context).toBe("useMemberships.update");
  });
});

describe("useDeleteMembership hook", () => {
  beforeEach(() => mockApiDelete.mockReset());

  it("应该调用 apiDelete 并携带 If-Match 头", async () => {
    mockApiDelete.mockResolvedValue(undefined);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteMembership(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      id: "44444444-4444-4444-8444-444444444444",
      rowVersion: 3,
    });

    const [path, options] = mockApiDelete.mock.calls[0] as [
      string,
      { headers: { "if-match": string } },
    ];
    expect(path).toBe(
      "/api/v1/memberships/44444444-4444-4444-8444-444444444444",
    );
    expect(options.headers["if-match"]).toBe('"rev-3"');
  });
});
