/**
 * ComplianceRulesPage 单元测试
 *
 * 验证：
 *  - 加载中状态：渲染 Spin
 *  - 错误状态：渲染 DataErrorAlert（context="合规规则列表"）
 *  - 成功状态：渲染 Table 与规则数据
 *  - 空状态：Table 显示空
 *  - 标题与操作按钮渲染
 *  - 筛选下拉框存在
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const {
  mockUseComplianceRules,
  mockUseCreateComplianceRule,
  mockUseUpdateComplianceRule,
  mockUseDeleteComplianceRule,
  mockUseRuleRevisions,
  mockUseCreateRuleRevision,
  mockUseActivateRuleRevision,
  mockUseImportIds,
} = vi.hoisted(() => ({
  mockUseComplianceRules: vi.fn(),
  mockUseCreateComplianceRule: vi.fn(),
  mockUseUpdateComplianceRule: vi.fn(),
  mockUseDeleteComplianceRule: vi.fn(),
  mockUseRuleRevisions: vi.fn(),
  mockUseCreateRuleRevision: vi.fn(),
  mockUseActivateRuleRevision: vi.fn(),
  mockUseImportIds: vi.fn(),
}));

vi.mock("@/hooks/use-compliance", () => ({
  useComplianceRules: (...args: unknown[]) => mockUseComplianceRules(...args),
  useCreateComplianceRule: () => mockUseCreateComplianceRule(),
  useUpdateComplianceRule: () => mockUseUpdateComplianceRule(),
  useDeleteComplianceRule: () => mockUseDeleteComplianceRule(),
  useRuleRevisions: (...args: unknown[]) => mockUseRuleRevisions(...args),
  useCreateRuleRevision: () => mockUseCreateRuleRevision(),
  useActivateRuleRevision: () => mockUseActivateRuleRevision(),
  useImportIds: () => mockUseImportIds(),
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

import ComplianceRulesPage from "@/app/(dashboard)/compliance-rules/page";
import { ApiError } from "@/lib/api-client";
import { ResponseValidationError } from "@/lib/schema-validator";
import { z } from "zod";

function buildRule(
  overrides: Partial<{
    id: string;
    ruleCode: string;
    name: string;
    category: string;
    status: string;
    owner: string | null;
    updatedAt: string;
  }> = {},
) {
  return {
    id: overrides.id ?? "rule-001",
    ruleCode: overrides.ruleCode ?? "BC-FIRE-001",
    name: overrides.name ?? "防火分区面积校验",
    category: overrides.category ?? "FIRE_SAFETY",
    status: overrides.status ?? "ACTIVE",
    owner: overrides.owner ?? null,
    description: null,
    version: 1,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-07-01T00:00:00Z",
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

function buildRevisionsResult(items: unknown[] = []) {
  return {
    data: { items, total: items.length, page: 1, pageSize: 50, hasMore: false },
    isLoading: false,
    isError: false,
    error: null,
  };
}

function setupDefaultMocks() {
  mockUseCreateComplianceRule.mockReturnValue(buildMutationResult());
  mockUseUpdateComplianceRule.mockReturnValue(buildMutationResult());
  mockUseDeleteComplianceRule.mockReturnValue(buildMutationResult());
  mockUseImportIds.mockReturnValue(buildMutationResult());
  mockUseCreateRuleRevision.mockReturnValue(buildMutationResult());
  mockUseActivateRuleRevision.mockReturnValue(buildMutationResult());
  mockUseRuleRevisions.mockReturnValue(buildRevisionsResult([]));
}

describe("ComplianceRulesPage", () => {
  beforeEach(() => {
    mockUseComplianceRules.mockReset();
    mockUseRuleRevisions.mockReset();
    setupDefaultMocks();
  });

  it("加载中应该渲染 Spin", () => {
    mockUseComplianceRules.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { container } = render(<ComplianceRulesPage />);

    expect(container.querySelector(".ant-spin")).toBeInTheDocument();
  });

  it("错误状态应该渲染 DataErrorAlert", () => {
    mockUseComplianceRules.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("网络断开"),
    });

    render(<ComplianceRulesPage />);

    expect(screen.getByText("合规规则列表加载失败")).toBeInTheDocument();
    expect(screen.getByText("网络断开")).toBeInTheDocument();
  });

  it("ApiError 错误应该渲染对应错误信息", () => {
    const apiError = new ApiError({
      code: 404,
      errorCode: "RULE_NOT_FOUND",
      status: 404,
      title: "规则不存在",
      detail: "指定规则已被删除",
      retryable: false,
      correlationId: "trace-rules-001",
    });

    mockUseComplianceRules.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: apiError,
    });

    render(<ComplianceRulesPage />);

    expect(screen.getByText("合规规则列表不存在")).toBeInTheDocument();
  });

  it("schema 校验失败错误应该显示数据格式异常", () => {
    const zodError = new z.ZodError([
      {
        code: "invalid_type",
        expected: "string",
        received: "undefined",
        path: ["ruleCode"],
        message: "Required",
      },
    ]);
    const validationError = new ResponseValidationError(
      "useComplianceRules.list",
      zodError,
    );

    mockUseComplianceRules.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: validationError,
    });

    render(<ComplianceRulesPage />);

    expect(screen.getByText("数据格式异常")).toBeInTheDocument();
    expect(
      screen.getByText(/合规规则列表数据未通过 schema 校验/),
    ).toBeInTheDocument();
  });

  it("成功状态应该渲染 Table 与规则数据", () => {
    mockUseComplianceRules.mockReturnValue({
      data: {
        items: [
          buildRule({
            id: "r1",
            ruleCode: "BC-FIRE-001",
            name: "防火分区面积校验",
            category: "FIRE_SAFETY",
            status: "ACTIVE",
          }),
          buildRule({
            id: "r2",
            ruleCode: "BC-ACCESS-001",
            name: "无障碍通道宽度校验",
            category: "ACCESSIBILITY",
            status: "DRAFT",
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

    render(<ComplianceRulesPage />);

    expect(screen.getByText("BC-FIRE-001")).toBeInTheDocument();
    expect(screen.getByText("防火分区面积校验")).toBeInTheDocument();
    expect(screen.getByText("BC-ACCESS-001")).toBeInTheDocument();
    expect(screen.getByText("无障碍通道宽度校验")).toBeInTheDocument();
  });

  it("应该渲染页面标题与操作按钮", () => {
    mockUseComplianceRules.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 10, hasMore: false },
      isLoading: false,
      error: null,
    });

    render(<ComplianceRulesPage />);

    expect(screen.getByText("合规规则管理")).toBeInTheDocument();
    expect(screen.getByText("导入 IDS")).toBeInTheDocument();
    expect(screen.getByText("创建规则")).toBeInTheDocument();
  });

  it("点击创建规则按钮应该打开创建弹窗", () => {
    mockUseComplianceRules.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 10, hasMore: false },
      isLoading: false,
      error: null,
    });

    render(<ComplianceRulesPage />);

    fireEvent.click(screen.getByText("创建规则"));

    // 弹窗标题
    expect(screen.getByText("创建合规规则")).toBeInTheDocument();
  });

  it("点击导入 IDS 按钮应该打开导入弹窗", () => {
    mockUseComplianceRules.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 10, hasMore: false },
      isLoading: false,
      error: null,
    });

    render(<ComplianceRulesPage />);

    fireEvent.click(screen.getByText("导入 IDS"));

    // 弹窗标题
    expect(screen.getByText("导入 buildingSMART IDS 规则")).toBeInTheDocument();
  });

  it("应该调用 useComplianceRules 传入分页参数", () => {
    mockUseComplianceRules.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 10, hasMore: false },
      isLoading: false,
      error: null,
    });

    render(<ComplianceRulesPage />);

    expect(mockUseComplianceRules).toHaveBeenCalled();
    const args = mockUseComplianceRules.mock.calls[0]?.[0] as {
      page: number;
      pageSize: number;
    };
    expect(args.page).toBe(1);
    expect(args.pageSize).toBe(10);
  });

  it("成功状态应该渲染筛选下拉框", () => {
    mockUseComplianceRules.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 10, hasMore: false },
      isLoading: false,
      error: null,
    });

    render(<ComplianceRulesPage />);

    expect(screen.getByText("按类别筛选")).toBeInTheDocument();
    expect(screen.getByText("按状态筛选")).toBeInTheDocument();
  });
});
