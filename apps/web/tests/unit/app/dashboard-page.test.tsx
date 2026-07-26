/**
 * DashboardPage 单元测试
 *
 * 验证：
 *  - 渲染 V1 技术试点 Tag
 *  - 渲染欢迎标题
 *  - 渲染项目定位说明
 *  - 渲染全流程覆盖说明
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

import DashboardPage from "@/app/(dashboard)/dashboard/page";

describe("DashboardPage", () => {
  it("应该渲染 V1 技术试点 Tag", () => {
    render(<DashboardPage />);
    expect(screen.getByText("V1 技术试点")).toBeInTheDocument();
  });

  it("应该渲染欢迎标题", () => {
    render(<DashboardPage />);
    expect(
      screen.getByText("欢迎使用施工图全流程 AI 平台"),
    ).toBeInTheDocument();
  });

  it("应该渲染项目定位说明", () => {
    render(<DashboardPage />);
    expect(
      screen.getByText("建筑专业纵向闭环 — 境外主创草图到方案深化"),
    ).toBeInTheDocument();
  });

  it("应该渲染全流程覆盖说明", () => {
    render(<DashboardPage />);
    expect(
      screen.getByText(
        /覆盖前期策划、概念设计、方案设计、扩初设计、施工图设计/,
      ),
    ).toBeInTheDocument();
  });
});
