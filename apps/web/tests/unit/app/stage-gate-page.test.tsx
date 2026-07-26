/**
 * StageGateIndexPage 单元测试
 *
 * 验证：
 *  - 加载中状态：渲染 Spin
 *  - 错误状态：渲染 DataErrorAlert（context="阶段门项目列表"）
 *  - 空状态：渲染 Empty
 *  - 成功状态：渲染项目列表
 *  - 点击项目卡片：跳转到 /stage-gate/{id}
 *  - 点击 "View Gate" 按钮：跳转且阻止冒泡
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { mockUseProjects, mockRouterPush } = vi.hoisted(() => ({
  mockUseProjects: vi.fn(),
  mockRouterPush: vi.fn(),
}));

vi.mock("@/hooks/use-projects", () => ({
  useProjects: (...args: unknown[]) => mockUseProjects(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

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

import StageGateIndexPage from "@/app/(dashboard)/stage-gate/page";
import { ApiError } from "@/lib/api-client";
import { ResponseValidationError } from "@/lib/schema-validator";
import { z } from "zod";

function buildProject(
  overrides: Partial<{
    id: string;
    name: string;
    code: string;
  }> = {},
) {
  return {
    id: overrides.id ?? "proj-001",
    name: overrides.name ?? "滨海办公大楼",
    code: overrides.code ?? "OFFICE-001",
    status: "active",
    buildingType: "office",
    floorsMin: 5,
    floorsMax: 12,
    rowVersion: 1,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  };
}

describe("StageGateIndexPage", () => {
  beforeEach(() => {
    mockUseProjects.mockReset();
    mockRouterPush.mockReset();
  });

  it("加载中应该渲染 Spin", () => {
    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    const { container } = render(<StageGateIndexPage />);

    expect(container.querySelector(".ant-spin")).toBeInTheDocument();
    expect(container.querySelector(".ant-spin-lg")).toBeInTheDocument();
  });

  it("错误状态应该渲染 DataErrorAlert 并显示阶段门项目列表上下文", () => {
    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("网络断开"),
    });

    render(<StageGateIndexPage />);

    expect(screen.getByText("阶段门项目列表加载失败")).toBeInTheDocument();
    expect(screen.getByText("网络断开")).toBeInTheDocument();
  });

  it("ApiError 404 错误应该显示对应标题", () => {
    const apiError = new ApiError({
      code: 404,
      errorCode: "PROJECT_NOT_FOUND",
      status: 404,
      title: "项目不存在",
      detail: "指定项目已被删除",
      retryable: false,
      correlationId: "trace-003",
    });

    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: apiError,
    });

    render(<StageGateIndexPage />);

    expect(screen.getByText("阶段门项目列表不存在")).toBeInTheDocument();
  });

  it("schema 校验失败错误应该显示数据格式异常", () => {
    const zodError = new z.ZodError([
      {
        code: "invalid_type",
        expected: "string",
        received: "undefined",
        path: ["name"],
        message: "Required",
      },
    ]);
    const validationError = new ResponseValidationError(
      "useProjects.list",
      zodError,
    );

    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: validationError,
    });

    render(<StageGateIndexPage />);

    expect(screen.getByText("数据格式异常")).toBeInTheDocument();
    expect(
      screen.getByText(/阶段门项目列表数据未通过 schema 校验/),
    ).toBeInTheDocument();
  });

  it("空项目列表应该渲染 Empty", () => {
    mockUseProjects.mockReturnValue({
      data: {
        items: [],
        total: 0,
        page: 1,
        pageSize: 50,
        hasMore: false,
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<StageGateIndexPage />);

    expect(screen.getByText("暂无项目，请先创建项目")).toBeInTheDocument();
  });

  it("成功状态应该渲染项目列表", () => {
    mockUseProjects.mockReturnValue({
      data: {
        items: [
          buildProject({ id: "p1", name: "项目A", code: "CODE-A" }),
          buildProject({ id: "p2", name: "项目B", code: "CODE-B" }),
        ],
        total: 2,
        page: 1,
        pageSize: 50,
        hasMore: false,
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<StageGateIndexPage />);

    expect(screen.getByText("项目A")).toBeInTheDocument();
    expect(screen.getByText("CODE-A")).toBeInTheDocument();
    expect(screen.getByText("项目B")).toBeInTheDocument();
    expect(screen.getByText("CODE-B")).toBeInTheDocument();
  });

  it("点击项目卡片应该跳转到项目阶段门页", () => {
    mockUseProjects.mockReturnValue({
      data: {
        items: [buildProject({ id: "p1", name: "项目A", code: "CODE-A" })],
        total: 1,
        page: 1,
        pageSize: 50,
        hasMore: false,
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<StageGateIndexPage />);

    fireEvent.click(screen.getByText("项目A"));

    expect(mockRouterPush).toHaveBeenCalledWith("/stage-gate/p1");
  });

  it("点击 View Gate 按钮应该跳转且不触发卡片点击", () => {
    mockUseProjects.mockReturnValue({
      data: {
        items: [buildProject({ id: "p1", name: "项目A", code: "CODE-A" })],
        total: 1,
        page: 1,
        pageSize: 50,
        hasMore: false,
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<StageGateIndexPage />);

    fireEvent.click(screen.getByText("View Gate"));

    expect(mockRouterPush).toHaveBeenCalledWith("/stage-gate/p1");
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
  });

  it("应该使用 pageSize=50 调用 useProjects", () => {
    mockUseProjects.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 50, hasMore: false },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<StageGateIndexPage />);

    expect(mockUseProjects).toHaveBeenCalledWith({ pageSize: 50 });
  });

  it("应该渲染页面标题与说明", () => {
    mockUseProjects.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 50, hasMore: false },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<StageGateIndexPage />);

    expect(screen.getByText("Stage Gate Management")).toBeInTheDocument();
    expect(screen.getByText("管理项目阶段门审批流程")).toBeInTheDocument();
    expect(screen.getByText("Select a Project")).toBeInTheDocument();
  });
});
