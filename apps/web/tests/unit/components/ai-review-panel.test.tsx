import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiReviewPanel } from "@/components/review/ai-review-panel";
import type { AiGenerationRecordDto } from "@design-platform/shared";
import { ResponseValidationError } from "@/lib/schema-validator";
import { z } from "zod";

// Mock hooks
const mockUsePendingAiReviews = vi.fn(
  (): {
    data: AiGenerationRecordDto[];
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
  } => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
);

vi.mock("@/hooks/use-ai-generation-records", () => ({
  usePendingAiReviews: () => mockUsePendingAiReviews(),
  useSubmitAiReview: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

// Mock Ant Design App.useApp
vi.mock("antd", async () => {
  const actual = await vi.importActual("antd");
  return {
    ...actual,
    App: {
      useApp: () => ({
        message: {
          success: vi.fn(),
          error: vi.fn(),
          info: vi.fn(),
          warning: vi.fn(),
          loading: vi.fn(),
        },
        modal: {
          confirm: vi.fn(),
        },
        notification: {
          success: vi.fn(),
          error: vi.fn(),
          info: vi.fn(),
          warning: vi.fn(),
        },
      }),
    },
  };
});

/** 构造 AiGenerationRecordDto 测试数据 */
function buildRecord(
  overrides: Partial<AiGenerationRecordDto> = {},
): AiGenerationRecordDto {
  return {
    id: "rec-001",
    tenantId: "tenant-001",
    projectId: "project-1",
    promptTemplate: "concept-generation",
    model: "gpt-4-turbo",
    riskLevel: "low",
    renderedPrompt: "渲染后的 prompt",
    rawContent: "AI 生成的原始内容",
    candidates: {},
    tokenUsage: {
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
    },
    latencyMs: 1234,
    traceId: "trace-001",
    guardrailResult: {
      passed: true,
      escalatedReview: false,
      warnings: [],
    },
    requiresHumanReview: true,
    reviewStatus: "PENDING",
    createdAt: "2026-07-26T10:00:00Z",
    updatedAt: "2026-07-26T10:00:00Z",
    rowVersion: 1,
    ...overrides,
  } as AiGenerationRecordDto;
}

describe("AiReviewPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePendingAiReviews.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("应该渲染面板标题", () => {
    render(<AiReviewPanel projectId="project-1" />);
    expect(screen.getByText("AI 生成记录人工复核")).toBeDefined();
  });

  it("无待复核记录时应该显示空状态", () => {
    render(<AiReviewPanel projectId="project-1" />);
    expect(screen.getByText("暂无待复核的 AI 生成记录")).toBeDefined();
  });

  it("应该渲染刷新按钮", () => {
    render(<AiReviewPanel projectId="project-1" />);
    // 按钮文本可能被渲染为"刷 新"（带空格）
    expect(screen.getByRole("button", { name: /刷\s*新/ })).toBeDefined();
  });

  it("应该渲染待复核记录列表（含风险等级标签）", () => {
    mockUsePendingAiReviews.mockReturnValue({
      data: [buildRecord({ riskLevel: "high", id: "rec-high" })],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<AiReviewPanel projectId="project-1" />);

    expect(screen.getByText("高风险")).toBeDefined();
    expect(screen.getByText("concept-generation")).toBeDefined();
  });

  it("未知风险等级应渲染兜底标签（不崩溃）", () => {
    mockUsePendingAiReviews.mockReturnValue({
      data: [
        buildRecord({
          riskLevel: "severe" as unknown as AiGenerationRecordDto["riskLevel"],
          id: "rec-unknown",
        }),
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<AiReviewPanel projectId="project-1" />);

    // 列表渲染兜底标签
    expect(screen.getByText("未知")).toBeDefined();
    expect(screen.getByText("concept-generation")).toBeDefined();
  });

  it("点击复核按钮应打开 Modal 并展示风险等级详情", () => {
    mockUsePendingAiReviews.mockReturnValue({
      data: [buildRecord({ riskLevel: "critical", id: "rec-critical" })],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<AiReviewPanel projectId="project-1" />);

    // 点击"复核"按钮
    const reviewButton = screen.getByRole("button", { name: /复\s*核/ });
    fireEvent.click(reviewButton);

    // Modal 标题渲染
    expect(screen.getByText("AI 生成记录复核")).toBeDefined();
    // 风险等级标签渲染
    expect(screen.getAllByText("极高风险").length).toBeGreaterThan(0);
  });

  it("Modal 中未知风险等级应渲染兜底标签（不崩溃）", () => {
    mockUsePendingAiReviews.mockReturnValue({
      data: [
        buildRecord({
          riskLevel: "severe" as unknown as AiGenerationRecordDto["riskLevel"],
          id: "rec-unknown-modal",
        }),
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<AiReviewPanel projectId="project-1" />);

    // 点击"复核"按钮打开 Modal
    const reviewButton = screen.getByRole("button", { name: /复\s*核/ });
    fireEvent.click(reviewButton);

    // Modal 中应渲染兜底标签
    expect(screen.getAllByText("未知").length).toBeGreaterThan(0);
  });

  it("schema 校验失败（requiresHumanReview 缺失）应显示 AI 安全字段校验失败提示", () => {
    // 模拟 BFF 返回数据缺失 requiresHumanReview 字段，前端严格模式抛 ResponseValidationError
    const zodError = new z.ZodError([
      {
        code: "invalid_type",
        expected: "boolean",
        received: "undefined",
        path: ["requiresHumanReview"],
        message: "Required",
      },
    ]);
    const validationError = new ResponseValidationError(
      "usePendingAiReviews.list",
      zodError,
    );

    mockUsePendingAiReviews.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: validationError,
      refetch: vi.fn(),
    });

    render(<AiReviewPanel projectId="project-1" />);

    expect(screen.getByText("AI 生成记录数据异常")).toBeDefined();
    expect(screen.getByText(/requiresHumanReview=Required/)).toBeDefined();
    expect(screen.getByText(/联系管理员/)).toBeDefined();
  });

  it("普通加载错误（非 schema 错误）应显示通用加载失败提示", () => {
    mockUsePendingAiReviews.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: new Error("network timeout"),
      refetch: vi.fn(),
    });

    render(<AiReviewPanel projectId="project-1" />);

    expect(screen.getByText("AI 生成记录数据异常")).toBeDefined();
    expect(
      screen.getByText("待复核 AI 生成记录加载失败，请稍后重试。"),
    ).toBeDefined();
  });
});
