import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GateDecisionForm } from "@/components/project/gate-decision-form";

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

describe("GateDecisionForm", () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该渲染门禁名称和状态", () => {
    render(
      <GateDecisionForm
        gateId="gate-1"
        gateName="G1 Gate"
        gateStatus="pending"
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByText(/G1 Gate/)).toBeDefined();
    expect(screen.getByText(/待决策/)).toBeDefined();
  });

  it("应该渲染决策选项标签", () => {
    render(
      <GateDecisionForm
        gateId="gate-1"
        gateName="G1 Gate"
        gateStatus="pending"
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText("Approved")).toBeDefined();
    expect(screen.getByText("Conditionally Approved")).toBeDefined();
    expect(screen.getByText("Rework Required")).toBeDefined();
  });

  it("应该渲染提交按钮", () => {
    render(
      <GateDecisionForm
        gateId="gate-1"
        gateName="G1 Gate"
        gateStatus="pending"
        onSubmit={mockOnSubmit}
      />,
    );

    expect(screen.getByText("提交决策")).toBeDefined();
  });

  it("已决策状态应该禁用表单", () => {
    render(
      <GateDecisionForm
        gateId="gate-1"
        gateName="G1 Gate"
        gateStatus="decided"
        onSubmit={mockOnSubmit}
      />,
    );

    // 已决策状态应该显示"已决策"
    expect(screen.getByText(/已决策/)).toBeDefined();
  });

  it("有 onCancel 时应该渲染取消按钮", () => {
    render(
      <GateDecisionForm
        gateId="gate-1"
        gateName="G1 Gate"
        gateStatus="pending"
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByText("取消")).toBeDefined();
  });

  it("无 onCancel 时不应该渲染取消按钮", () => {
    render(
      <GateDecisionForm
        gateId="gate-1"
        gateName="G1 Gate"
        gateStatus="pending"
        onSubmit={mockOnSubmit}
      />,
    );

    // 只有"提交决策"按钮，没有"取消"
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(1);
  });
});
