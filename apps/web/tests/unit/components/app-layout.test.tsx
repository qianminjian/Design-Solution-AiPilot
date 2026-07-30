import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { AuthContext } from "@design-platform/shared";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/dashboard",
}));

// Mock antd App.useApp
const mockMessageSuccess = vi.fn();
const mockMessageError = vi.fn();
vi.mock("antd", async () => {
  const actual = await vi.importActual("antd");
  return {
    ...actual,
    App: {
      useApp: () => ({
        message: {
          success: mockMessageSuccess,
          error: mockMessageError,
        },
      }),
    },
  };
});

// Mock useAuth / useLogout
const mockUseAuth = vi.fn();
const mockLogoutMutateAsync = vi.fn();
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
  useLogout: () => ({
    mutateAsync: mockLogoutMutateAsync,
    isPending: false,
    reset: vi.fn(),
  }),
}));

import { AppLayout } from "@/components/layout/app-layout";

/** 构造一个已登录的 AuthContext fixture */
function buildAuthedContext(): AuthContext {
  return {
    principal: {
      userId: "u-1",
      tenantId: "t-1",
      email: "user@example.com",
      displayName: "Alice Zhang",
      roles: ["architect"],
      permissions: [],
    },
    accessToken: "access-token",
    accessTokenExpiresAt: "2026-12-31T23:59:59Z",
    refreshTokenSet: {
      current: "refresh-token",
      previous: null,
      rotatedAt: "2026-07-01T00:00:00Z",
      expiresAt: "2026-08-01T00:00:00Z",
    },
    session: {
      id: "s-1",
      issuedAt: "2026-07-01T00:00:00Z",
      expiresAt: "2026-08-01T00:00:00Z",
      rememberMe: false,
    },
  } as unknown as AuthContext;
}

describe("AppLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      data: buildAuthedContext(),
      isLoading: false,
      isError: false,
    });
  });

  it("应该渲染 Logo 和侧边栏菜单项", () => {
    render(<AppLayout>Children Content</AppLayout>);

    // 菜单项对齐 app-layout.tsx SIDER_MENU_ITEMS（D37.5 P01 "My Work"）
    expect(screen.getByText("AI Pilot")).toBeDefined();
    expect(screen.getByText("My Work")).toBeDefined();
    expect(screen.getByText("Projects")).toBeDefined();
    expect(screen.getByText("Stage Gate")).toBeDefined();
    expect(screen.getByText("Documents")).toBeDefined();
    expect(screen.getByText("Compliance Rules")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("应该渲染 children 到 Content 区域", () => {
    render(<AppLayout>Children Content</AppLayout>);

    expect(screen.getByText("Children Content")).toBeDefined();
  });

  it("应该显示当前登录用户的 displayName", () => {
    render(<AppLayout>Children</AppLayout>);

    expect(screen.getByText("Alice Zhang")).toBeDefined();
  });

  it("未登录用户应显示 Guest 占位", () => {
    mockUseAuth.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    render(<AppLayout>Children</AppLayout>);

    expect(screen.getByText("Guest")).toBeDefined();
  });

  it("应该渲染全局搜索输入框", () => {
    render(<AppLayout>Children</AppLayout>);

    expect(screen.getByPlaceholderText("搜索项目、文档...")).toBeDefined();
    expect(screen.getByLabelText("全局搜索")).toBeDefined();
  });

  it("搜索框输入回车应跳转到 /projects?keyword=", () => {
    render(<AppLayout>Children</AppLayout>);

    const input = screen.getByPlaceholderText("搜索项目、文档...");
    fireEvent.change(input, { target: { value: "office tower" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", charCode: 13 });

    expect(mockPush).toHaveBeenCalledWith("/projects?keyword=office%20tower");
  });

  it("点击侧边栏菜单应跳转对应路由", () => {
    render(<AppLayout>Children</AppLayout>);

    fireEvent.click(screen.getByText("Projects"));

    expect(mockPush).toHaveBeenCalledWith("/projects");
  });

  it("点击 Logout 应调用 logoutMutation 并跳转 /login", async () => {
    mockLogoutMutateAsync.mockResolvedValueOnce({});
    render(<AppLayout>Children</AppLayout>);

    // 打开用户菜单
    fireEvent.click(screen.getByLabelText("User menu"));
    // 点击 Logout
    await waitFor(() => {
      expect(screen.getByText("Logout")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Logout"));

    await waitFor(() => {
      expect(mockLogoutMutateAsync).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith("已退出登录");
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("Logout 失败应显示错误提示", async () => {
    mockLogoutMutateAsync.mockRejectedValueOnce(new Error("网络错误"));
    render(<AppLayout>Children</AppLayout>);

    fireEvent.click(screen.getByLabelText("User menu"));
    await waitFor(() => {
      expect(screen.getByText("Logout")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Logout"));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith("网络错误");
    });
  });
});
