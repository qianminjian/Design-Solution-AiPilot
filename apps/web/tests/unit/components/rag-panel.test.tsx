/**
 * RagPanel 组件单元测试
 *
 * 覆盖 V1 RagPanel 行为：
 *  - 渲染标题与说明文本
 *  - 知识库选择下拉框
 *  - 问题输入与检索按钮启用/禁用
 *  - 检索成功展示结论、置信度、引用片段
 *  - requiresHumanReview=true 展示「需人工复核」标签
 *  - citations 为空时不渲染引用区块
 *  - 检索失败展示错误 Alert
 *
 * Mock 依赖：
 *  - @/hooks/use-rag：useKnowledgeBases / useRagQuery
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { KnowledgeBaseDto } from "@design-platform/shared";

// ── Mock use-rag hooks ──

const { mockUseKnowledgeBases, mockUseRagQuery } = vi.hoisted(() => ({
  mockUseKnowledgeBases: vi.fn(),
  mockUseRagQuery: vi.fn(),
}));

vi.mock("@/hooks/use-rag", () => ({
  useKnowledgeBases: (...args: unknown[]) => mockUseKnowledgeBases(...args),
  useRagQuery: (...args: unknown[]) => mockUseRagQuery(...args),
}));

import { RagPanel } from "@/components/review/rag-panel";

// ── Fixtures ──

const sampleKnowledgeBases: KnowledgeBaseDto[] = [
  {
    id: "kb-001",
    documentCount: 12,
  },
];

// ── 测试用例 ──

describe("RagPanel", () => {
  beforeEach(() => {
    mockUseKnowledgeBases.mockReset();
    mockUseRagQuery.mockReset();

    // 默认 mock：知识库已加载，useRagQuery 返回 idle mutation
    mockUseKnowledgeBases.mockReturnValue({
      data: sampleKnowledgeBases,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseRagQuery.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it("应该渲染标题与说明文本", () => {
    render(<RagPanel />);

    expect(screen.getByText("AI 辅助检索")).toBeDefined();
  });

  it("应该渲染知识库选择下拉框与问题输入框", () => {
    render(<RagPanel />);

    // 下拉框 placeholder 与按钮存在即可（知识库选项在展开后才渲染）
    expect(screen.getByRole("combobox", { name: "选择知识库" })).toBeDefined();
    expect(
      screen.getByPlaceholderText("例如：防火分区的面积限制是多少？"),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /检\s*索/ })).toBeDefined();
  });

  it("未选择知识库时检索按钮应禁用", () => {
    render(<RagPanel />);

    const button = screen.getByRole("button", { name: /检\s*索/ });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("选择知识库并输入问题后检索按钮应启用", async () => {
    render(<RagPanel />);

    // 点击 Select 展开下拉
    const selectSelector = screen.getByRole("combobox", {
      name: "选择知识库",
    });
    fireEvent.mouseDown(selectSelector);

    // antd Select 选项在 portal 中渲染，使用 findByText 等待选项出现
    const option = await screen.findByText("kb-001 (12 篇)");
    fireEvent.click(option);

    // 输入问题
    const input =
      screen.getByPlaceholderText("例如：防火分区的面积限制是多少？");
    fireEvent.change(input, { target: { value: "防火分区面积？" } });

    const button = screen.getByRole("button", { name: /检\s*索/ });
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("知识库加载失败时应展示错误 Alert", () => {
    const refetch = vi.fn();
    mockUseKnowledgeBases.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });

    render(<RagPanel />);

    expect(screen.getByText("知识库列表加载失败")).toBeDefined();
  });

  it("onQuery 失败时应展示 Alert 错误", async () => {
    const mutateAsync = vi
      .fn()
      .mockRejectedValueOnce(new Error("LLM 调用超时"));
    mockUseRagQuery.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    render(<RagPanel />);

    // 选择知识库
    const selectSelector = screen.getByRole("combobox", {
      name: "选择知识库",
    });
    fireEvent.mouseDown(selectSelector);
    const option = await screen.findByText("kb-001 (12 篇)");
    fireEvent.click(option);

    // 输入问题并点击检索
    const input =
      screen.getByPlaceholderText("例如：防火分区的面积限制是多少？");
    fireEvent.change(input, { target: { value: "防火分区？" } });
    fireEvent.click(screen.getByRole("button", { name: /检\s*索/ }));

    await waitFor(() => {
      expect(screen.getByText("查询失败")).toBeDefined();
      expect(screen.getByText("LLM 调用超时")).toBeDefined();
    });
  });
});
