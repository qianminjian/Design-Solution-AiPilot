import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AiReviewPanel } from "@/components/review/ai-review-panel";

// Mock hooks
vi.mock("@/hooks/use-ai-generation-records", () => ({
  usePendingAiReviews: vi.fn(() => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
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
        },
      }),
    },
  };
});

describe("AiReviewPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(screen.getByText("刷新")).toBeDefined();
  });
});
