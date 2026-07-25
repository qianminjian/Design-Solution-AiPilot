import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock useLogin hook - 必须在 LoginForm import 之前完成
const mockMutateAsync = vi.fn();
vi.mock("@/hooks/use-auth", () => ({
  useLogin: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    reset: vi.fn(),
  }),
}));

import { LoginForm } from "@/components/auth/login-form";

describe("LoginForm", () => {
  beforeEach(() => {
    // mockReset 会清除 mockResolvedValueOnce/mockRejectedValueOnce 等链式 mock 设置
    // 防止跨测试泄漏（vi.clearAllMocks 只清 calls/results，不清除 return value 设置）
    mockMutateAsync.mockReset();
    mockPush.mockReset();
    vi.clearAllMocks();
  });

  it("应该渲染标题、副标题与表单字段", () => {
    render(<LoginForm />);

    // 标题（h3）和按钮文本都是 "Sign In"，按角色区分
    expect(screen.getByRole("heading", { name: "Sign In" })).toBeDefined();
    expect(screen.getByText("使用企业邮箱登录平台")).toBeDefined();
    expect(screen.getByRole("button", { name: /Sign In/ })).toBeDefined();
    // 表单字段存在
    expect(screen.getByPlaceholderText("name@example.com")).toBeDefined();
    expect(screen.getByPlaceholderText("至少 8 个字符")).toBeDefined();
    expect(screen.getByRole("checkbox")).toBeDefined();
  });

  it("空表单提交应显示必填校验提示且不调用 mutateAsync", async () => {
    render(<LoginForm />);

    fireEvent.click(screen.getByRole("button", { name: /Sign In/ }));

    await waitFor(() => {
      expect(screen.getByText("请输入邮箱")).toBeDefined();
      expect(screen.getByText("请输入密码")).toBeDefined();
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("密码少于 8 个字符应提示且不调用 mutateAsync", async () => {
    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText("name@example.com"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("至少 8 个字符"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/ }));

    await waitFor(() => {
      expect(screen.getByText("密码至少 8 个字符")).toBeDefined();
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("邮箱格式不正确应提示且不调用 mutateAsync", async () => {
    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText("name@example.com"), {
      target: { value: "not-an-email" },
    });
    fireEvent.change(screen.getByPlaceholderText("至少 8 个字符"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/ }));

    await waitFor(() => {
      expect(screen.getByText("邮箱格式不正确")).toBeDefined();
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("表单校验通过后应调用 mutateAsync 并小写邮箱", async () => {
    mockMutateAsync.mockResolvedValueOnce({});
    render(<LoginForm />);

    // antd type=email 校验拒绝首尾空格，故仅测试 toLowerCase 逻辑
    fireEvent.change(screen.getByPlaceholderText("name@example.com"), {
      target: { value: "User@Example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("至少 8 个字符"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/ }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    const payload = mockMutateAsync.mock.calls[0]?.[0];
    expect(payload).toEqual({
      email: "user@example.com",
      password: "password123",
      rememberMe: false,
    });
  });

  it("登录成功后应跳转到 /dashboard", async () => {
    mockMutateAsync.mockResolvedValueOnce({});
    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText("name@example.com"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("至少 8 个字符"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/ }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("登录失败（rejected promise）不应跳转到 /dashboard", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("登录失败"));
    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText("name@example.com"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("至少 8 个字符"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/ }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    // 失败时不应跳转
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("勾选记住此设备后 rememberMe 应为 true", async () => {
    mockMutateAsync.mockResolvedValueOnce({});
    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText("name@example.com"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("至少 8 个字符"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Sign In/ }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    const payload = mockMutateAsync.mock.calls[0]?.[0];
    expect(payload?.rememberMe).toBe(true);
  });

  it("登录失败后再次提交应能正常调用 mutateAsync", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("first fail"));
    render(<LoginForm />);

    // 第一次失败
    fireEvent.change(screen.getByPlaceholderText("name@example.com"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("至少 8 个字符"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/ }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    // 第二次成功
    mockMutateAsync.mockResolvedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: /Sign In/ }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    });
  });
});
