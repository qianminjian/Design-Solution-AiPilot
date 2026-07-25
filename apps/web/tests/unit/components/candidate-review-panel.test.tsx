import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CandidateReviewPanel } from "@/components/ai-solution/candidate-review-panel";
import type { SolutionCandidate } from "@design-platform/shared";

/**
 * CandidateReviewPanel 单元测试
 *
 * 覆盖场景：
 * 1. 渲染基础元素（复核面板标题、安全提示、操作按钮）
 * 2. 输入复核人与批注
 * 3. 驳回决策流转
 * 4. 接受决策成功流转
 * 5. 接受决策失败时显示错误消息
 * 6. 已接受状态显示成功结果
 * 7. 已驳回状态显示信息结果
 * 8. AI 安全提示文案存在
 */

// Mock useCreateDesignOption hook
const mockMutateAsync = vi.fn();
vi.mock("@/hooks/use-design-options", () => ({
  useCreateDesignOption: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

function buildCandidate(
  overrides: Partial<SolutionCandidate> = {},
): SolutionCandidate {
  return {
    name: "办公楼方案 A",
    content: "## 设计说明\n本文案采用框架结构...",
    risks: ["地震烈度需复核", "层高略低于规范要求"],
    feasibilityNotes: "可在 30 天内完成深化",
    ...overrides,
  };
}

describe("CandidateReviewPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应渲染人工复核面板标题", () => {
    render(
      <CandidateReviewPanel
        projectId="proj-001"
        candidate={buildCandidate()}
      />,
    );
    expect(screen.getByText("人工复核面板")).toBeDefined();
  });

  it("应渲染 AI 安全红线提示", () => {
    render(
      <CandidateReviewPanel
        projectId="proj-001"
        candidate={buildCandidate()}
      />,
    );
    expect(
      screen.getByText(
        /AI 输出仅作为设计候选参考，接受前请由注册建筑师\/工程师完成专业评审/,
      ),
    ).toBeDefined();
  });

  it("应渲染接受与驳回按钮", () => {
    render(
      <CandidateReviewPanel
        projectId="proj-001"
        candidate={buildCandidate()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /接受为设计选项/ }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /驳\s*回/ })).toBeDefined();
  });

  it("应渲染复核人输入框与批注输入框", () => {
    render(
      <CandidateReviewPanel
        projectId="proj-001"
        candidate={buildCandidate()}
      />,
    );
    expect(screen.getByPlaceholderText(/复核人姓名/)).toBeDefined();
    expect(screen.getByPlaceholderText(/复核批注/)).toBeDefined();
  });

  it("点击驳回后应显示已驳回结果", () => {
    render(
      <CandidateReviewPanel
        projectId="proj-001"
        candidate={buildCandidate()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /驳\s*回/ }));
    expect(screen.getByText("已驳回该候选")).toBeDefined();
    expect(screen.getByText("撤销驳回")).toBeDefined();
  });

  it("点击撤销驳回应回到待决策状态", () => {
    render(
      <CandidateReviewPanel
        projectId="proj-001"
        candidate={buildCandidate()}
      />,
    );
    // 先驳回
    fireEvent.click(screen.getByRole("button", { name: /驳\s*回/ }));
    expect(screen.getByText("已驳回该候选")).toBeDefined();
    // 撤销
    fireEvent.click(screen.getByText("撤销驳回"));
    expect(screen.getByText("人工复核面板")).toBeDefined();
  });

  it("接受成功后应显示成功结果与查看设计选项库按钮", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      id: "opt-new-001",
      title: "办公楼方案 A",
      description: "## 设计说明",
      status: "DRAFT",
    });

    render(
      <CandidateReviewPanel
        projectId="proj-001"
        candidate={buildCandidate()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /接受为设计选项/ }));

    await waitFor(() => {
      expect(screen.getByText("已接受为设计选项")).toBeDefined();
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    // 接受后应显示查看设计选项库按钮
    expect(
      screen.getByRole("button", { name: /查看设计选项库/ }),
    ).toBeDefined();
  });

  it("接受失败后应回到待决策状态", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("网络错误"));

    render(
      <CandidateReviewPanel
        projectId="proj-001"
        candidate={buildCandidate()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /接受为设计选项/ }));

    await waitFor(() => {
      // 失败后应回到待决策状态，重新显示人工复核面板
      expect(screen.getByText("人工复核面板")).toBeDefined();
    });
  });

  it("接受时应携带候选名称与内容作为设计选项", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      id: "opt-new-002",
      title: "办公楼方案 A",
      description: "## 设计说明",
      status: "DRAFT",
    });

    render(
      <CandidateReviewPanel
        projectId="proj-001"
        candidate={buildCandidate({
          name: "测试候选名称",
          content: "测试内容",
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /接受为设计选项/ }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "测试候选名称",
          description: "测试内容",
        }),
      );
    });
  });

  it("接受时应在 metadata 中携带 risks 与 feasibilityNotes", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      id: "opt-new-003",
      title: "办公楼方案 A",
      description: "## 设计说明",
      status: "DRAFT",
    });

    render(
      <CandidateReviewPanel
        projectId="proj-001"
        candidate={buildCandidate({
          risks: ["风险一", "风险二"],
          feasibilityNotes: "30 天可完成",
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /接受为设计选项/ }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
      const callArgs = mockMutateAsync.mock.calls[0]![0];
      expect(callArgs.metadata).toMatchObject({
        source: "ai-generation",
        risks: ["风险一", "风险二"],
        feasibilityNotes: "30 天可完成",
      });
    });
  });

  it("未填复核人时 metadata.reviewer 应为 anonymous", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      id: "opt-new-004",
      title: "办公楼方案 A",
      description: "## 设计说明",
      status: "DRAFT",
    });

    render(
      <CandidateReviewPanel
        projectId="proj-001"
        candidate={buildCandidate()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /接受为设计选项/ }));

    await waitFor(() => {
      const callArgs = mockMutateAsync.mock.calls[0]![0];
      expect(callArgs.metadata.reviewer).toBe("anonymous");
    });
  });

  it("填写复核人时 metadata.reviewer 应为输入值", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      id: "opt-new-005",
      title: "办公楼方案 A",
      description: "## 设计说明",
      status: "DRAFT",
    });

    render(
      <CandidateReviewPanel
        projectId="proj-001"
        candidate={buildCandidate()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/复核人姓名/), {
      target: { value: "张工" },
    });
    fireEvent.click(screen.getByRole("button", { name: /接受为设计选项/ }));

    await waitFor(() => {
      const callArgs = mockMutateAsync.mock.calls[0]![0];
      expect(callArgs.metadata.reviewer).toBe("张工");
    });
  });
});
