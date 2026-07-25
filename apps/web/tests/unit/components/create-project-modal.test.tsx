import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock antd App.useApp - 必须在 import CreateProjectModal 之前完成
const mockMessageSuccess = vi.fn();
const mockMessageError = vi.fn();
vi.mock("antd", async () => {
  const actual = await vi.importActual("antd");
  return {
    ...actual,
    App: {
      useApp: () => ({
        message: {
          success: mockMessageSuccess,
          error: mockMessageError,
        },
      }),
    },
  };
});

// Mock useCreateProject hook - 必须在 import CreateProjectModal 之前完成
const mockMutateAsync = vi.fn();
const mockReset = vi.fn();
vi.mock("@/hooks/use-projects", () => ({
  useCreateProject: () => ({
    mutateAsync: mockMutateAsync,
    reset: mockReset,
    isPending: false,
  }),
}));

import { CreateProjectModal } from "@/components/project/create-project-modal";

describe("CreateProjectModal", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("open=true 时应该渲染所有表单字段与默认值", () => {
    render(<CreateProjectModal open={true} onClose={mockOnClose} />);

    expect(screen.getByText("新建项目")).toBeDefined();
    expect(
      screen.getByPlaceholderText("如：Shanghai Office Tower"),
    ).toBeDefined();
    expect(screen.getByPlaceholderText("SH-OFFICE-001")).toBeDefined();
    expect(
      screen.getByPlaceholderText("项目背景、范围、目标等说明"),
    ).toBeDefined();
    // 建筑类型 Select 存在
    expect(screen.getByRole("combobox")).toBeDefined();
    // 提交按钮存在（文本可能被 antd 渲染为"创 建"）
    expect(screen.getByRole("button", { name: /创\s*建/ })).toBeDefined();
  });

  it("open=false 时弹窗不显示", () => {
    render(<CreateProjectModal open={false} onClose={mockOnClose} />);

    expect(screen.queryByText("新建项目")).toBeNull();
  });

  it("空表单提交应显示必填校验提示且不调用 mutateAsync", async () => {
    render(<CreateProjectModal open={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByRole("button", { name: /创\s*建/ }));

    await waitFor(() => {
      expect(screen.getByText("请输入项目名称")).toBeDefined();
      expect(screen.getByText("请输入项目编码")).toBeDefined();
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("最大层数小于最小层数应提示且不调用 mutateAsync", async () => {
    render(<CreateProjectModal open={true} onClose={mockOnClose} />);

    // 填充必填字段
    fireEvent.change(screen.getByPlaceholderText("如：Shanghai Office Tower"), {
      target: { value: "Shanghai Office Tower" },
    });
    fireEvent.change(screen.getByPlaceholderText("SH-OFFICE-001"), {
      target: { value: "SH-OFFICE-001" },
    });

    // 默认 floorsMin=5、floorsMax=15，调整 floorsMax 为 3
    // antd InputNumber 内部使用 spinbutton role
    const spinbuttons = screen.getAllByRole("spinbutton");
    // floorsMax 是第二个 InputNumber（第一个是 floorsMin）
    const floorsMaxInput = spinbuttons[1] as HTMLElement;
    fireEvent.change(floorsMaxInput, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /创\s*建/ }));

    await waitFor(() => {
      expect(screen.getByText("最大层数不能小于最小层数")).toBeDefined();
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("表单校验通过后应调用 mutateAsync 传入正确 payload（code 强制大写、trim）", async () => {
    mockMutateAsync.mockResolvedValueOnce({ id: "p-1" });
    render(<CreateProjectModal open={true} onClose={mockOnClose} />);

    fireEvent.change(screen.getByPlaceholderText("如：Shanghai Office Tower"), {
      target: { value: "Shanghai Office Tower" },
    });
    fireEvent.change(screen.getByPlaceholderText("SH-OFFICE-001"), {
      target: { value: "sh-office-001" }, // 小写以验证大写化逻辑
    });
    fireEvent.click(screen.getByRole("button", { name: /创\s*建/ }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    const payload = mockMutateAsync.mock.calls[0]?.[0];
    expect(payload).toEqual({
      name: "Shanghai Office Tower",
      code: "SH-OFFICE-001", // 经 trim + toUpperCase
      description: undefined,
      buildingType: "office", // 默认值
      floorsMin: 5, // 默认值
      floorsMax: 15, // 默认值
    });
  });

  it("创建成功后应调用 message.success 与 onClose 关闭弹窗", async () => {
    mockMutateAsync.mockResolvedValueOnce({ id: "p-1" });
    render(<CreateProjectModal open={true} onClose={mockOnClose} />);

    fireEvent.change(screen.getByPlaceholderText("如：Shanghai Office Tower"), {
      target: { value: "Shanghai Office Tower" },
    });
    fireEvent.change(screen.getByPlaceholderText("SH-OFFICE-001"), {
      target: { value: "SH-OFFICE-001" },
    });
    fireEvent.click(screen.getByRole("button", { name: /创\s*建/ }));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
    expect(mockMessageSuccess).toHaveBeenCalledWith("项目创建成功");
  });

  it("创建失败（mutateAsync rejected）不应调用 onClose", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("网络错误"));
    render(<CreateProjectModal open={true} onClose={mockOnClose} />);

    fireEvent.change(screen.getByPlaceholderText("如：Shanghai Office Tower"), {
      target: { value: "Shanghai Office Tower" },
    });
    fireEvent.change(screen.getByPlaceholderText("SH-OFFICE-001"), {
      target: { value: "SH-OFFICE-001" },
    });
    fireEvent.click(screen.getByRole("button", { name: /创\s*建/ }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    // 失败时不应关闭弹窗
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("open 从 true 切换为 false 时应重置 mutation 状态", () => {
    const { rerender } = render(
      <CreateProjectModal open={true} onClose={mockOnClose} />,
    );

    rerender(<CreateProjectModal open={false} onClose={mockOnClose} />);

    expect(mockReset).toHaveBeenCalled();
  });
});
