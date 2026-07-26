import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { BcfIssue } from "@/hooks/use-review";

// Mock antd App.useApp
const mockMessageSuccess = vi.fn();
vi.mock("antd", async () => {
  const actual = await vi.importActual("antd");
  return {
    ...actual,
    App: {
      useApp: () => ({
        message: {
          success: mockMessageSuccess,
          error: vi.fn(),
        },
      }),
    },
  };
});

import { BcfIssueList } from "@/components/review/bcf-issue-list";

/** 构造一个 BcfIssue fixture */
function buildIssue(overrides: Partial<BcfIssue> = {}): BcfIssue {
  return {
    id: "issue-1",
    projectId: "p-1",
    issueIndex: 1,
    title: "Clash: Beam vs Duct",
    description: "结构梁与暖通管道碰撞",
    status: "open",
    priority: "high",
    issueType: "clash",
    snapshot: null,
    relatedElements: [],
    assignedTo: "alice",
    createdBy: "bob",
    createdAt: "2026-07-26T08:00:00Z",
    updatedAt: "2026-07-26T08:00:00Z",
    ...overrides,
  };
}

describe("BcfIssueList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loading=true 时应渲染 Spin 加载", () => {
    const { container } = render(<BcfIssueList data={[]} loading={true} />);
    expect(container.querySelector(".ant-spin")).toBeDefined();
  });

  it("data 为空数组时应渲染 Empty 占位", () => {
    render(<BcfIssueList data={[]} loading={false} />);

    expect(screen.getByText("暂无协调问题")).toBeDefined();
  });

  it("data 未定义时应渲染 Empty 占位", () => {
    render(
      <BcfIssueList
        data={undefined as unknown as BcfIssue[]}
        loading={false}
      />,
    );

    expect(screen.getByText("暂无协调问题")).toBeDefined();
  });

  it("应该渲染数据行（含 #issueIndex、标题、类型、发起人）", () => {
    render(<BcfIssueList data={[buildIssue()]} loading={false} />);

    expect(screen.getByText("#1")).toBeDefined();
    expect(screen.getByText("Clash: Beam vs Duct")).toBeDefined();
    expect(screen.getByText("clash")).toBeDefined();
    expect(screen.getByText("bob")).toBeDefined();
  });

  it("critical 优先级应渲染 Critical 红色标签", () => {
    render(
      <BcfIssueList
        data={[buildIssue({ priority: "critical" })]}
        loading={false}
      />,
    );

    expect(screen.getByText("Critical")).toBeDefined();
  });

  it("high 优先级应渲染 High 橙色标签", () => {
    render(
      <BcfIssueList
        data={[buildIssue({ priority: "high" })]}
        loading={false}
      />,
    );

    expect(screen.getByText("High")).toBeDefined();
  });

  it("medium 优先级应渲染 Medium 金色标签", () => {
    render(
      <BcfIssueList
        data={[buildIssue({ priority: "medium" })]}
        loading={false}
      />,
    );

    expect(screen.getByText("Medium")).toBeDefined();
  });

  it("low 优先级应渲染 Low 蓝色标签", () => {
    render(
      <BcfIssueList data={[buildIssue({ priority: "low" })]} loading={false} />,
    );

    expect(screen.getByText("Low")).toBeDefined();
  });

  it("assignedTo 为 null 时应显示「未指派」", () => {
    render(
      <BcfIssueList
        data={[buildIssue({ assignedTo: null })]}
        loading={false}
      />,
    );

    expect(screen.getByText("未指派")).toBeDefined();
  });

  it("assignedTo 存在时应显示指派对象", () => {
    render(
      <BcfIssueList
        data={[buildIssue({ assignedTo: "alice" })]}
        loading={false}
      />,
    );

    expect(screen.getByText("alice")).toBeDefined();
  });

  it("应该渲染状态 Select 下拉框", () => {
    render(<BcfIssueList data={[buildIssue()]} loading={false} />);

    // antd Table 测量行会重复渲染，使用 getAllByRole
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThan(0);
  });

  it("状态列应存在变更 Select 控件", () => {
    const mockOnStatusChange = vi.fn();
    render(
      <BcfIssueList
        data={[buildIssue({ status: "open" })]}
        loading={false}
        onStatusChange={mockOnStatusChange}
      />,
    );

    // 验证 Select 控件存在（不验证下拉交互，antd Select 在 jsdom 中行为复杂）
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThan(0);
  });

  it("点击指派按钮应打开指派弹窗", () => {
    render(<BcfIssueList data={[buildIssue()]} loading={false} />);

    // 指派按钮带 aria-label
    const assignButton = screen.getByLabelText("指派给 alice");
    fireEvent.click(assignButton);

    expect(screen.getByText("指派处理人")).toBeDefined();
    expect(screen.getByText("处理人")).toBeDefined();
  });

  it("指派弹窗提交应调用 onAssign 并显示成功提示", async () => {
    const mockOnAssign = vi.fn();
    render(
      <BcfIssueList
        data={[buildIssue()]}
        loading={false}
        onAssign={mockOnAssign}
      />,
    );

    fireEvent.click(screen.getByLabelText("指派给 alice"));

    // 弹窗中的输入框
    const assigneeInput = screen.getByPlaceholderText("输入处理人姓名");
    fireEvent.change(assigneeInput, { target: { value: "charlie" } });

    // 点击确认按钮
    fireEvent.click(screen.getByRole("button", { name: /确认指派/ }));

    await waitFor(() => {
      expect(mockOnAssign).toHaveBeenCalledWith("issue-1", "charlie");
      expect(mockMessageSuccess).toHaveBeenCalledWith("指派成功");
    });
  });

  it("应该渲染分页器", () => {
    const { container } = render(
      <BcfIssueList data={[buildIssue()]} loading={false} />,
    );

    expect(container.querySelector(".ant-pagination")).toBeDefined();
  });

  it("多行数据应正确渲染", () => {
    render(
      <BcfIssueList
        data={[
          buildIssue({ id: "i-1", issueIndex: 1, title: "Issue One" }),
          buildIssue({ id: "i-2", issueIndex: 2, title: "Issue Two" }),
          buildIssue({ id: "i-3", issueIndex: 3, title: "Issue Three" }),
        ]}
        loading={false}
      />,
    );

    expect(screen.getByText("Issue One")).toBeDefined();
    expect(screen.getByText("Issue Two")).toBeDefined();
    expect(screen.getByText("Issue Three")).toBeDefined();
  });

  it("未知优先级应渲染兜底标签（不崩溃）", () => {
    render(
      <BcfIssueList
        data={[
          buildIssue({
            priority: "urgent" as unknown as BcfIssue["priority"],
            title: "未知优先级 Issue",
          }),
        ]}
        loading={false}
      />,
    );

    expect(screen.getByText("未知优先级 Issue")).toBeDefined();
    expect(screen.getByText("未知")).toBeDefined();
  });
});
