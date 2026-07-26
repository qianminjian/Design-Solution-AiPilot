/**
 * MonitoringPage 单元测试
 *
 * 验证：
 *  - 加载中状态：渲染 Spin
 *  - 错误状态：渲染 Alert 并显示错误消息
 *  - 成功状态（UP）：渲染整体状态 ALL UP 标签、5 个服务卡片、检测时间
 *  - 部分降级状态：渲染 DEGRADED 标签、DOWN 服务显示错误信息
 *  - 服务卡片：UP 显示绿色，DOWN 显示红色与错误 tag
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { mockUseHealth } = vi.hoisted(() => ({
  mockUseHealth: vi.fn(),
}));

vi.mock("@/hooks/use-monitoring", () => ({
  useHealth: (...args: unknown[]) => mockUseHealth(...args),
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

import MonitoringPage from "@/app/(dashboard)/monitoring/page";
import type { HealthCheckResult } from "@/hooks/use-monitoring";

function buildUpHealth(): HealthCheckResult {
  return {
    status: "UP",
    services: {
      bff: { status: "UP", details: { version: "0.1.0" } },
      core: {
        status: "UP",
        details: { url: "http://core/health/live", durationMs: 12 },
      },
      ai: {
        status: "UP",
        details: { url: "http://ai/health/live", durationMs: 45 },
      },
      postgresql: {
        status: "UP",
        details: { url: "http://core/health/db", durationMs: 8 },
      },
      minio: {
        status: "UP",
        details: { url: "http://core/health/storage", durationMs: 15 },
      },
    },
    schemaValidation: {
      softTotal: 0,
      strictTotal: 0,
      softFailures: {},
      strictFailures: {},
    },
    timestamp: "2026-07-26T00:00:00.000Z",
  };
}

function buildDownHealth(): HealthCheckResult {
  return {
    ...buildUpHealth(),
    status: "DOWN",
    services: {
      bff: { status: "UP" },
      core: { status: "DOWN", error: "ECONNREFUSED" },
      ai: { status: "UP" },
      postgresql: { status: "UP" },
      minio: { status: "DOWN", error: "timeout" },
    },
  };
}

describe("MonitoringPage", () => {
  beforeEach(() => {
    mockUseHealth.mockReset();
  });

  it("加载中应该渲染 Spin", () => {
    mockUseHealth.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { container } = render(<MonitoringPage />);

    // Spin 组件渲染（Ant Design 5 的 tip 文案可能被 aria 包裹）
    expect(container.querySelector(".ant-spin")).toBeInTheDocument();
    expect(container.querySelector(".ant-spin-lg")).toBeInTheDocument();
  });

  it("错误状态应该渲染 Alert 并显示错误消息", () => {
    mockUseHealth.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("网络断开"),
    });

    render(<MonitoringPage />);

    expect(screen.getByText("无法获取系统健康状态")).toBeInTheDocument();
    expect(screen.getByText("网络断开")).toBeInTheDocument();
  });

  it("非 Error 对象应显示未知错误", () => {
    mockUseHealth.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: "string error",
    });

    render(<MonitoringPage />);

    expect(screen.getByText("未知错误")).toBeInTheDocument();
  });

  it("所有服务 UP 时应渲染 ALL UP 标签", async () => {
    mockUseHealth.mockReturnValue({
      data: buildUpHealth(),
      isLoading: false,
      error: null,
    });

    render(<MonitoringPage />);

    expect(screen.getByText("ALL UP")).toBeInTheDocument();
    // 5 个服务卡片标题
    expect(screen.getByText("BFF 服务")).toBeInTheDocument();
    expect(screen.getByText("核心服务")).toBeInTheDocument();
    expect(screen.getByText("AI 服务")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.getByText("MinIO (S3)")).toBeInTheDocument();
  });

  it("任一服务 DOWN 时应渲染 DEGRADED 标签", async () => {
    mockUseHealth.mockReturnValue({
      data: buildDownHealth(),
      isLoading: false,
      error: null,
    });

    render(<MonitoringPage />);

    expect(screen.getByText("DEGRADED")).toBeInTheDocument();
  });

  it("DOWN 服务应该在卡片中显示错误 tag", async () => {
    mockUseHealth.mockReturnValue({
      data: buildDownHealth(),
      isLoading: false,
      error: null,
    });

    render(<MonitoringPage />);

    // 核心服务的错误 tag
    expect(screen.getByText("ECONNREFUSED")).toBeInTheDocument();
    expect(screen.getByText("timeout")).toBeInTheDocument();
  });

  it("应该渲染检测时间", async () => {
    mockUseHealth.mockReturnValue({
      data: buildUpHealth(),
      isLoading: false,
      error: null,
    });

    render(<MonitoringPage />);

    // 检测时间 label
    expect(screen.getByText("检测时间")).toBeInTheDocument();
  });

  it("data 为 undefined 且无错误时应该显示降级 UI", async () => {
    mockUseHealth.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    render(<MonitoringPage />);

    // 既不在加载也不在错误状态：data 缺失时整体状态显示 DEGRADED
    expect(screen.getByText("DEGRADED")).toBeInTheDocument();
  });

  it("应该调用 useHealth hook", () => {
    mockUseHealth.mockReturnValue({
      data: buildUpHealth(),
      isLoading: false,
      error: null,
    });

    render(<MonitoringPage />);

    expect(mockUseHealth).toHaveBeenCalledOnce();
  });
});
