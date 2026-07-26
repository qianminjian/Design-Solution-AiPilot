/**
 * MembersPage 单元测试
 *
 * 验证：
 *  - 加载中状态：渲染 Spin
 *  - 错误状态：渲染 DataErrorAlert（context="成员列表"）
 *  - 成功状态：渲染 Table 与成员数据
 *  - 空状态：Table 无数据行
 *  - 标题与"添加成员"按钮渲染
 *  - 角色筛选与状态筛选下拉框存在
 *  - 点击"添加成员"打开弹窗
 *  - 点击"编辑"打开编辑弹窗
 *  - 未知角色/状态枚举值兜底显示"未知"灰标签
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const {
  mockUseMemberships,
  mockUseCreateMembership,
  mockUseUpdateMembership,
  mockUseDeleteMembership,
  mockUsePrincipals,
  mockUseOrganizations,
} = vi.hoisted(() => ({
  mockUseMemberships: vi.fn(),
  mockUseCreateMembership: vi.fn(),
  mockUseUpdateMembership: vi.fn(),
  mockUseDeleteMembership: vi.fn(),
  mockUsePrincipals: vi.fn(),
  mockUseOrganizations: vi.fn(),
}));

vi.mock("@/hooks/use-iam", () => ({
  useMemberships: (...args: unknown[]) => mockUseMemberships(...args),
  useCreateMembership: () => mockUseCreateMembership(),
  useUpdateMembership: () => mockUseUpdateMembership(),
  useDeleteMembership: () => mockUseDeleteMembership(),
  usePrincipals: (...args: unknown[]) => mockUsePrincipals(...args),
  useOrganizations: (...args: unknown[]) => mockUseOrganizations(...args),
}));

// 全局 antd App mock（与 setup.ts 一致）
vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");
  const AppWithMockedUseApp = Object.assign(actual.App, {
    useApp: vi.fn(() => ({
      message: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        loading: vi.fn(),
      },
      modal: { confirm: vi.fn() },
      notification: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
      },
    })),
  });
  return { ...actual, App: AppWithMockedUseApp };
});

import MembersPage from "@/app/(dashboard)/members/page";
import { ApiError } from "@/lib/api-client";
import { ResponseValidationError } from "@/lib/schema-validator";
import { z } from "zod";

/** 构造成员关系 DTO */
function buildMembership(
  overrides: Partial<{
    id: string;
    principalId: string;
    organizationId: string;
    role: string;
    status: string;
    joinedAt: string;
  }> = {},
) {
  return {
    id: overrides.id ?? "mem-001",
    tenantId: "tenant-001",
    principalId: overrides.principalId ?? "principal-001",
    organizationId: overrides.organizationId ?? "org-001",
    role: overrides.role ?? "architect",
    status: overrides.status ?? "active",
    joinedAt: overrides.joinedAt ?? "2026-07-01T00:00:00Z",
    effectiveFrom: null,
    effectiveTo: null,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    rowVersion: 1,
  };
}

function buildMutationResult() {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    isIdle: true,
    isPaused: false,
    isSuccess: false,
    variables: undefined,
    data: undefined,
    error: null,
    failureCount: 0,
    failureReason: null,
    submittedAt: 0,
    reset: vi.fn(),
    status: "idle" as const,
  };
}

function buildEmptyPage() {
  return {
    data: { items: [], total: 0, page: 1, pageSize: 10, hasMore: false },
    isLoading: false,
    isError: false,
    error: null,
  };
}

function setupDefaultMocks() {
  mockUseCreateMembership.mockReturnValue(buildMutationResult());
  mockUseUpdateMembership.mockReturnValue(buildMutationResult());
  mockUseDeleteMembership.mockReturnValue(buildMutationResult());
  mockUsePrincipals.mockReturnValue(buildEmptyPage());
  mockUseOrganizations.mockReturnValue(buildEmptyPage());
}

describe("MembersPage", () => {
  beforeEach(() => {
    mockUseMemberships.mockReset();
    mockUseCreateMembership.mockReset();
    mockUseUpdateMembership.mockReset();
    mockUseDeleteMembership.mockReset();
    mockUsePrincipals.mockReset();
    mockUseOrganizations.mockReset();
    setupDefaultMocks();
  });

  it("加载中应该渲染 Spin", () => {
    mockUseMemberships.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { container } = render(<MembersPage />);

    expect(container.querySelector(".ant-spin")).toBeInTheDocument();
  });

  it("错误状态应该渲染 DataErrorAlert", () => {
    mockUseMemberships.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("网络断开"),
    });

    render(<MembersPage />);

    expect(screen.getByText("成员列表加载失败")).toBeInTheDocument();
    expect(screen.getByText("网络断开")).toBeInTheDocument();
  });

  it("ApiError 错误应该渲染对应错误信息", () => {
    const apiError = new ApiError({
      errorCode: "AUTHORIZATION_REQUIRED",
      status: 403,
      title: "无权访问",
      detail: "需要成员管理权限",
      retryable: false,
      correlationId: "trace-members-001",
    });

    mockUseMemberships.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: apiError,
    });

    render(<MembersPage />);

    // 403 错误标题与描述都会渲染
    expect(screen.getAllByText("无权访问").length).toBeGreaterThan(0);
  });

  it("ResponseValidationError 应该渲染契约漂移提示", () => {
    let zodError: z.ZodError | null = null;
    try {
      z.object({ id: z.string() }).parse({ id: 123 });
    } catch (e) {
      zodError = e as z.ZodError;
    }

    const validationError = new ResponseValidationError(
      "useMemberships.list",
      zodError!,
    );

    mockUseMemberships.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: validationError,
    });

    render(<MembersPage />);

    // ResponseValidationError 渲染"数据格式异常"标题与 schema 校验失败描述
    expect(screen.getByText("数据格式异常")).toBeInTheDocument();
    expect(screen.getByText(/未通过 schema 校验/)).toBeInTheDocument();
  });

  it("成功状态应该渲染成员列表", () => {
    mockUseMemberships.mockReturnValue({
      data: {
        items: [
          buildMembership({ id: "mem-001", role: "architect" }),
          buildMembership({ id: "mem-002", role: "owner" }),
        ],
        total: 2,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      isLoading: false,
      error: null,
    });

    render(<MembersPage />);

    // 角色标签渲染
    expect(screen.getByText("建筑师")).toBeInTheDocument();
    expect(screen.getByText("项目负责人")).toBeInTheDocument();
  });

  it("空状态应该渲染标题但无成员数据", () => {
    mockUseMemberships.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 10, hasMore: false },
      isLoading: false,
      error: null,
    });

    render(<MembersPage />);

    expect(screen.getByText("成员管理")).toBeInTheDocument();
  });

  it("应该渲染标题与添加成员按钮", () => {
    mockUseMemberships.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 10, hasMore: false },
      isLoading: false,
      error: null,
    });

    render(<MembersPage />);

    expect(screen.getByText("成员管理")).toBeInTheDocument();
    expect(screen.getByText("添加成员")).toBeInTheDocument();
  });

  it("应该渲染角色与状态筛选下拉框", () => {
    mockUseMemberships.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 10, hasMore: false },
      isLoading: false,
      error: null,
    });

    render(<MembersPage />);

    expect(screen.getByText("按角色筛选")).toBeInTheDocument();
    expect(screen.getByText("按状态筛选")).toBeInTheDocument();
  });

  it("点击添加成员按钮应该打开弹窗", () => {
    mockUseMemberships.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 10, hasMore: false },
      isLoading: false,
      error: null,
    });

    render(<MembersPage />);

    fireEvent.click(screen.getByText("添加成员"));

    // 弹窗标题
    expect(
      screen.getByText("添加成员", { selector: ".ant-modal-title" }),
    ).toBeInTheDocument();
  });

  it("点击编辑按钮应该打开编辑弹窗", () => {
    mockUseMemberships.mockReturnValue({
      data: {
        items: [
          buildMembership({
            id: "mem-001",
            role: "architect",
            status: "active",
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      isLoading: false,
      error: null,
    });

    render(<MembersPage />);

    // 操作列中的编辑按钮（使用 getByText 查找，避开 button role 名称匹配问题）
    const editButtons = screen.getAllByText("编辑");
    expect(editButtons.length).toBeGreaterThan(0);
    fireEvent.click(editButtons[0]!);

    // 编辑弹窗标题
    expect(screen.getByText("编辑成员")).toBeInTheDocument();
  });

  it("未知角色枚举值应该兜底显示未知灰标签", () => {
    mockUseMemberships.mockReturnValue({
      data: {
        items: [
          buildMembership({
            id: "mem-001",
            role: "UNKNOWN_ROLE",
            status: "active",
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      isLoading: false,
      error: null,
    });

    render(<MembersPage />);

    // 未知角色显示"未知"灰标签
    expect(screen.getAllByText("未知").length).toBeGreaterThan(0);
  });

  it("未知状态枚举值应该兜底显示未知灰标签", () => {
    mockUseMemberships.mockReturnValue({
      data: {
        items: [
          buildMembership({
            id: "mem-001",
            role: "architect",
            status: "unknown_status" as unknown as never,
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      isLoading: false,
      error: null,
    });

    render(<MembersPage />);

    // 未知状态显示"未知"灰标签
    expect(screen.getAllByText("未知").length).toBeGreaterThan(0);
  });

  it("应该调用 useMemberships hook", () => {
    mockUseMemberships.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 10, hasMore: false },
      isLoading: false,
      error: null,
    });

    render(<MembersPage />);

    expect(mockUseMemberships).toHaveBeenCalled();
  });
});
