/**
 * Providers 组件单元测试
 *
 * 验证：
 *  - 渲染子组件不抛错
 *  - 多次渲染保持稳定
 *  - createQueryClient 配置正确（间接验证 Providers 内部使用）
 *
 * 注意：tests/setup.ts 全局 mock 了 antd App（替换为只有 useApp 的 object），
 * 导致 <AntApp> 渲染失败。此处通过 Object.assign 保留真实的 App 组件，
 * 仅覆盖 App.useApp 的返回值。
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// 重新 mock antd：保留真实的 App 组件，仅 mock App.useApp
vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");
  // 保留 App 组件本身（forwardRef），仅覆盖 useApp 静态方法
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
  return {
    ...actual,
    App: AppWithMockedUseApp,
  };
});

import { Providers } from "@/app/providers";
import { createQueryClient } from "@/lib/query-client";

describe("Providers", () => {
  it("应该渲染子组件", () => {
    render(
      <Providers>
        <div data-testid="child">child content</div>
      </Providers>,
    );

    expect(screen.getByTestId("child")).toBeTruthy();
    expect(screen.getByTestId("child").textContent).toBe("child content");
  });

  it("rerender 后应保持子组件渲染", () => {
    const { rerender } = render(
      <Providers>
        <div data-testid="child">first</div>
      </Providers>,
    );

    expect(screen.getByTestId("child").textContent).toBe("first");

    rerender(
      <Providers>
        <div data-testid="child">second</div>
      </Providers>,
    );

    expect(screen.getByTestId("child").textContent).toBe("second");
  });

  it("应渲染嵌套子组件", () => {
    render(
      <Providers>
        <div data-testid="parent">
          <span data-testid="nested">nested content</span>
        </div>
      </Providers>,
    );

    expect(screen.getByTestId("parent")).toBeTruthy();
    expect(screen.getByTestId("nested").textContent).toBe("nested content");
  });

  it("createQueryClient 默认 staleTime=30s 应被 Providers 继承", () => {
    const client = createQueryClient();
    expect(client.getDefaultOptions().queries?.staleTime).toBe(30 * 1000);
  });

  it("createQueryClient 默认 retry=1 应被 Providers 继承", () => {
    const client = createQueryClient();
    expect(client.getDefaultOptions().queries?.retry).toBe(1);
  });

  it("createQueryClient 默认 refetchOnWindowFocus=false 应被 Providers 继承", () => {
    const client = createQueryClient();
    expect(client.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(
      false,
    );
  });

  it("createQueryClient mutations 默认 retry=0 应被 Providers 继承", () => {
    const client = createQueryClient();
    expect(client.getDefaultOptions().mutations?.retry).toBe(0);
  });

  it("createQueryClient 多次调用应返回独立实例", () => {
    const client1 = createQueryClient();
    const client2 = createQueryClient();
    expect(client1).not.toBe(client2);
  });
});
