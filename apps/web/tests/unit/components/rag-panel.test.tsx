import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RagPanel } from "@/components/review/rag-panel";
import type { RagQueryResponse } from "@/hooks/use-review";

/** 构造一个 RAG 响应 fixture */
function buildRagResponse(
  overrides: Partial<RagQueryResponse> = {},
): RagQueryResponse {
  return {
    id: "rag-1",
    question: "防火分区的面积限制是多少？",
    answer: "根据 GB 50016，防火分区面积不应大于 1500m²",
    sources: [
      {
        id: "src-1",
        title: "GB 50016-2014 建筑设计防火规范",
        url: "https://example.com/gb-50016",
        snippet: "5.3.1 防火分区面积不应大于 1500m²...",
      },
    ],
    confidence: 0.92,
    isAiAssisted: true,
    requiresHumanReview: false,
    latencyMs: 350,
    ...overrides,
  };
}

describe("RagPanel", () => {
  const mockOnQuery = vi.fn();

  beforeEach(() => {
    mockOnQuery.mockReset();
  });

  it("应该渲染标题与说明文本", () => {
    render(<RagPanel projectId="p-1" onQuery={mockOnQuery} />);

    expect(screen.getByText("AI 辅助审查")).toBeDefined();
    expect(
      screen.getByText("输入问题，AI 将基于项目文档和规范进行检索回答"),
    ).toBeDefined();
  });

  it("应该渲染问题输入框与检索按钮", () => {
    render(<RagPanel projectId="p-1" onQuery={mockOnQuery} />);

    expect(
      screen.getByPlaceholderText("例如：防火分区的面积限制是多少？"),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /检\s*索/ })).toBeDefined();
  });

  it("问题为空时检索按钮应禁用", () => {
    render(<RagPanel projectId="p-1" onQuery={mockOnQuery} />);

    const button = screen.getByRole("button", { name: /检\s*索/ });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("输入问题后检索按钮应启用", () => {
    render(<RagPanel projectId="p-1" onQuery={mockOnQuery} />);

    const input =
      screen.getByPlaceholderText("例如：防火分区的面积限制是多少？");
    fireEvent.change(input, { target: { value: "防火分区" } });

    const button = screen.getByRole("button", { name: /检\s*索/ });
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("点击检索按钮应调用 onQuery 并展示回答", async () => {
    mockOnQuery.mockResolvedValueOnce(buildRagResponse());
    render(<RagPanel projectId="p-1" onQuery={mockOnQuery} />);

    const input =
      screen.getByPlaceholderText("例如：防火分区的面积限制是多少？");
    fireEvent.change(input, { target: { value: "防火分区面积？" } });
    fireEvent.click(screen.getByRole("button", { name: /检\s*索/ }));

    await waitFor(() => {
      expect(mockOnQuery).toHaveBeenCalledWith({
        projectId: "p-1",
        question: "防火分区面积？",
      });
    });

    // 验证回答渲染
    await waitFor(() => {
      expect(
        screen.getByText("根据 GB 50016，防火分区面积不应大于 1500m²"),
      ).toBeDefined();
    });
  });

  it("回答区应展示问题、置信度、AI 辅助标签与耗时", async () => {
    mockOnQuery.mockResolvedValueOnce(buildRagResponse());
    render(<RagPanel projectId="p-1" onQuery={mockOnQuery} />);

    fireEvent.change(
      screen.getByPlaceholderText("例如：防火分区的面积限制是多少？"),
      { target: { value: "防火分区？" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /检\s*索/ }));

    await waitFor(() => {
      // antd Typography 渲染可能拆分文本，使用 RegExp 模糊匹配
      // 使用问题文本末尾的"？"避免与回答区文本冲突
      expect(screen.getByText(/面积限制是多少？/)).toBeDefined();
      expect(screen.getByText("置信度: 92%")).toBeDefined();
      expect(screen.getByText("AI 辅助")).toBeDefined();
      expect(screen.getByText("耗时: 350ms")).toBeDefined();
    });
  });

  it("requiresHumanReview=true 时应展示「需人工复核」标签", async () => {
    mockOnQuery.mockResolvedValueOnce(
      buildRagResponse({ requiresHumanReview: true }),
    );
    render(<RagPanel projectId="p-1" onQuery={mockOnQuery} />);

    fireEvent.change(
      screen.getByPlaceholderText("例如：防火分区的面积限制是多少？"),
      { target: { value: "问题？" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /检\s*索/ }));

    await waitFor(() => {
      expect(screen.getByText("需人工复核")).toBeDefined();
    });
  });

  it("回答包含来源时应展示引用来源区块", async () => {
    mockOnQuery.mockResolvedValueOnce(buildRagResponse());
    render(<RagPanel projectId="p-1" onQuery={mockOnQuery} />);

    fireEvent.change(
      screen.getByPlaceholderText("例如：防火分区的面积限制是多少？"),
      { target: { value: "防火分区？" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /检\s*索/ }));

    await waitFor(() => {
      expect(screen.getByText("引用来源")).toBeDefined();
      expect(screen.getByText("GB 50016-2014 建筑设计防火规范")).toBeDefined();
    });
  });

  it("sources 为空数组时不应渲染引用来源区块", async () => {
    mockOnQuery.mockResolvedValueOnce(buildRagResponse({ sources: [] }));
    render(<RagPanel projectId="p-1" onQuery={mockOnQuery} />);

    fireEvent.change(
      screen.getByPlaceholderText("例如：防火分区的面积限制是多少？"),
      { target: { value: "防火分区？" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /检\s*索/ }));

    await waitFor(() => {
      expect(
        screen.getByText("根据 GB 50016，防火分区面积不应大于 1500m²"),
      ).toBeDefined();
    });
    expect(screen.queryByText("引用来源")).toBeNull();
  });

  it("onQuery 失败时应展示 Alert 错误", async () => {
    mockOnQuery.mockRejectedValueOnce(new Error("LLM 调用超时"));
    render(<RagPanel projectId="p-1" onQuery={mockOnQuery} />);

    fireEvent.change(
      screen.getByPlaceholderText("例如：防火分区的面积限制是多少？"),
      { target: { value: "防火分区？" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /检\s*索/ }));

    await waitFor(() => {
      expect(screen.getByText("查询失败")).toBeDefined();
      expect(screen.getByText("LLM 调用超时")).toBeDefined();
    });
  });

  it("projectId 为空时不应触发 onQuery", () => {
    render(<RagPanel projectId="" onQuery={mockOnQuery} />);

    fireEvent.change(
      screen.getByPlaceholderText("例如：防火分区的面积限制是多少？"),
      { target: { value: "问题" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /检\s*索/ }));

    expect(mockOnQuery).not.toHaveBeenCalled();
  });

  it("isLoading=true 时输入框与按钮应禁用，显示 Spin", () => {
    const { container } = render(
      <RagPanel projectId="p-1" onQuery={mockOnQuery} isLoading={true} />,
    );

    const input =
      screen.getByPlaceholderText("例如：防火分区的面积限制是多少？");
    expect(input.hasAttribute("disabled")).toBe(true);

    const button = screen.getByRole("button", { name: /检\s*索/ });
    expect(button.hasAttribute("disabled")).toBe(true);

    // 显示 Spin 加载
    expect(container.querySelector(".ant-spin")).toBeDefined();
  });
});
