/**
 * ComplianceChecksPage 单元测试
 *
 * 验证：
 *  - 加载中状态：渲染 Spin
 *  - 错误状态：渲染 DataErrorAlert（context="合规检查运行列表"）
 *  - 成功状态：渲染 Table 与检查运行数据
 *  - 标题与操作按钮渲染
 *  - 点击创建按钮打开弹窗
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const {
  mockUseComplianceCheckRuns,
  mockUseComplianceCheckRun,
  mockUseCheckResults,
  mockUseCreateComplianceCheckRun,
  mockUseExecuteComplianceCheckRun,
} = vi.hoisted(() => ({
  mockUseComplianceCheckRuns: vi.fn(),
  mockUseComplianceCheckRun: vi.fn(),
  mockUseCheckResults: vi.fn(),
  mockUseCreateComplianceCheckRun: vi.fn(),
  mockUseExecuteComplianceCheckRun: vi.fn(),
}));

vi.mock("@/hooks/use-compliance", () => ({
  useComplianceCheckRuns: (...a: unknown[]) => mockUseComplianceCheckRuns(...a),
  useComplianceCheckRun: (...a: unknown[]) => mockUseComplianceCheckRun(...a),
  useCheckResults: (...a: unknown[]) => mockUseCheckResults(...a),
  useCreateComplianceCheckRun: () => mockUseCreateComplianceCheckRun(),
  useExecuteComplianceCheckRun: () => mockUseExecuteComplianceCheckRun(),
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

import ComplianceChecksPage from "@/app/(dashboard)/compliance-checks/page";
import { ApiError } from "@/lib/api-client";
import { ResponseValidationError } from "@/lib/schema-validator";
import { z } from "zod";

function buildRun(
  overrides: Partial<{
    id: string;
    ruleSetId: string;
    projectId: string | null;
    status: string;
    outcomeSummary: string | null;
    createdAt: string;
  }> = {},
) {
  return {
    id: overrides.id ?? "run-001",
    ruleSetId: overrides.ruleSetId ?? "ruleset-001",
    projectId: overrides.projectId ?? null,
    status: overrides.status ?? "PENDING",
    outcomeSummary: overrides.outcomeSummary ?? null,
    startedAt: null,
    completedAt: null,
    executions: [],
    createdAt: overrides.createdAt ?? "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
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

function setupDefaultMocks() {
  mockUseCreateComplianceCheckRun.mockReturnValue(buildMutationResult());
  mockUseExecuteComplianceCheckRun.mockReturnValue(buildMutationResult());
  mockUseComplianceCheckRun.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
  });
  mockUseCheckResults.mockReturnValue({
    data: { items: [], total: 0, page: 1, pageSize: 50, hasMore: false },
    isLoading: false,
    error: null,
  });
}

describe("ComplianceChecksPage", () => {
  beforeEach(() => {
    mockUseComplianceCheckRuns.mockReset();
    setupDefaultMocks();
  });

  it("加载中应该渲染 Spin", () => {
    mockUseComplianceCheckRuns.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { container } = render(<ComplianceChecksPage />);

    expect(container.querySelector(".ant-spin")).toBeInTheDocument();
  });

  it("错误状态应该渲染 DataErrorAlert", () => {
    mockUseComplianceCheckRuns.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("网络断开"),
    });

    render(<ComplianceChecksPage />);

    expect(screen.getByText("合规检查运行列表加载失败")).toBeInTheDocument();
    expect(screen.getByText("网络断开")).toBeInTheDocument();
  });

  it("ApiError 错误应该渲染对应错误信息", () => {
    const apiError = new ApiError({
      errorCode: "AUTHORIZATION_REQUIRED",
      status: 403,
      title: "无权访问",
      detail: "需要审核员权限",
      retryable: false,
      correlationId: "trace-checks-001",
    });

    mockUseComplianceCheckRuns.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: apiError,
    });

    render(<ComplianceChecksPage />);

    expect(screen.getAllByText("无权访问").length).toBeGreaterThan(0);
  });

  it("schema 校验失败错误应该显示数据格式异常", () => {
    const zodError = new z.ZodError([
      {
        code: "invalid_type",
        expected: "string",
        received: "undefined",
        path: ["id"],
        message: "Required",
      },
    ]);
    const validationError = new ResponseValidationError(
      "useComplianceCheckRuns.list",
      zodError,
    );

    mockUseComplianceCheckRuns.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: validationError,
    });

    render(<ComplianceChecksPage />);

    expect(screen.getByText("数据格式异常")).toBeInTheDocument();
    expect(
      screen.getByText(/合规检查运行列表数据未通过 schema 校验/),
    ).toBeInTheDocument();
  });

  it("成功状态应该渲染 Table 与检查运行数据", () => {
    mockUseComplianceCheckRuns.mockReturnValue({
      data: {
        items: [
          buildRun({
            id: "run-abc12345",
            ruleSetId: "ruleset-001",
            status: "PENDING",
          }),
          buildRun({
            id: "run-def67890",
            ruleSetId: "ruleset-002",
            status: "COMPLETED",
          }),
        ],
        total: 2,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      isLoading: false,
      error: null,
    });

    render(<ComplianceChecksPage />);

    // id 显示截断前 8 字符
    expect(screen.getByText("run-abc1...")).toBeInTheDocument();
    expect(screen.getByText("run-def6...")).toBeInTheDocument();
    // ruleSetId 截断
    expect(screen.getAllByText("ruleset-...").length).toBeGreaterThan(0);
  });

  it("应该渲染页面标题与创建按钮", () => {
    mockUseComplianceCheckRuns.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 10, hasMore: false },
      isLoading: false,
      error: null,
    });

    render(<ComplianceChecksPage />);

    expect(screen.getByText("合规检查运行")).toBeInTheDocument();
    expect(screen.getByText("创建检查运行")).toBeInTheDocument();
  });

  it("点击创建按钮应该打开创建弹窗", () => {
    mockUseComplianceCheckRuns.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 10, hasMore: false },
      isLoading: false,
      error: null,
    });

    render(<ComplianceChecksPage />);

    fireEvent.click(screen.getByText("创建检查运行"));

    expect(screen.getByText("创建合规检查运行")).toBeInTheDocument();
  });

  it("应该调用 useComplianceCheckRuns 传入分页参数", () => {
    mockUseComplianceCheckRuns.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 10, hasMore: false },
      isLoading: false,
      error: null,
    });

    render(<ComplianceChecksPage />);

    expect(mockUseComplianceCheckRuns).toHaveBeenCalled();
    const args = mockUseComplianceCheckRuns.mock.calls[0]?.[0] as {
      page: number;
      pageSize: number;
    };
    expect(args.page).toBe(1);
    expect(args.pageSize).toBe(10);
  });

  it("成功状态且检查运行 PENDING 时应该显示执行按钮", () => {
    mockUseComplianceCheckRuns.mockReturnValue({
      data: {
        items: [
          buildRun({
            id: "run-abc12345",
            status: "PENDING",
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

    render(<ComplianceChecksPage />);

    // PENDING 状态显示"执行"按钮
    expect(screen.getByText("执行")).toBeInTheDocument();
    // 详情按钮
    expect(screen.getByText("详情")).toBeInTheDocument();
  });

  it("成功状态且检查运行 COMPLETED 时不应显示执行按钮", () => {
    mockUseComplianceCheckRuns.mockReturnValue({
      data: {
        items: [
          buildRun({
            id: "run-abc12345",
            status: "COMPLETED",
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

    render(<ComplianceChecksPage />);

    // COMPLETED 状态不显示"执行"按钮
    expect(screen.queryByText("执行")).not.toBeInTheDocument();
    // 仍然有详情按钮
    expect(screen.getByText("详情")).toBeInTheDocument();
  });
});
