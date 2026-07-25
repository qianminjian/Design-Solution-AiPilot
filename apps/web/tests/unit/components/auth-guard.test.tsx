import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AuthContext } from "@design-platform/shared";

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock useAuth hook - 通过 mockReturnValue 动态控制返回值
const mockUseAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

import { AuthGuard } from "@/components/auth/auth-guard";

/** 构造一个已登录的 AuthContext fixture */
function buildAuthedContext(): AuthContext {
  return {
    principal: {
      userId: "u-1",
      tenantId: "t-1",
      email: "user@example.com",
      displayName: "User",
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

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isLoading=true 时应显示 Spin 全屏加载，不渲染 children", () => {
    mockUseAuth.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    // 不渲染 children
    expect(screen.queryByText("Protected Content")).toBeNull();
    // Spin 存在
    expect(document.querySelector(".ant-spin")).toBeDefined();
    // 不应跳转
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("已登录（有 principal）应渲染 children，不跳转", () => {
    mockUseAuth.mockReturnValue({
      data: buildAuthedContext(),
      isLoading: false,
      isError: false,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(screen.getByText("Protected Content")).toBeDefined();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("未登录（loading 完成、无 principal）应跳转到 /login", () => {
    mockUseAuth.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(mockReplace).toHaveBeenCalledWith("/login");
    // 不渲染 children
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("data 存在但 principal 缺失应跳转到 /login", () => {
    mockUseAuth.mockReturnValue({
      // 有 data 但 principal 为空
      data: { principal: null } as unknown as AuthContext,
      isLoading: false,
      isError: false,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("useAuth 抛错（isError=true）应跳转到 /login", () => {
    mockUseAuth.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("已登录且 isError=false 时不应跳转", () => {
    mockUseAuth.mockReturnValue({
      data: buildAuthedContext(),
      isLoading: false,
      isError: false,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("从 loading 切换到已登录状态后应渲染 children", () => {
    mockUseAuth.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { rerender } = render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    // loading 阶段不渲染 children
    expect(screen.queryByText("Protected Content")).toBeNull();

    // 切换到已登录
    mockUseAuth.mockReturnValue({
      data: buildAuthedContext(),
      isLoading: false,
      isError: false,
    });

    rerender(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(screen.getByText("Protected Content")).toBeDefined();
  });

  it("从 loading 切换到未登录状态后应跳转 /login", () => {
    mockUseAuth.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { rerender } = render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(mockReplace).not.toHaveBeenCalled();

    // 切换到未登录（无 data）
    mockUseAuth.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    rerender(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(mockReplace).toHaveBeenCalledWith("/login");
  });
});
