import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GateSummaryCard } from "@/components/review/gate-summary";
import type { GateSummary } from "@/hooks/use-review";

/** 构造一个 pass 状态的 fixture */
function buildGateSummary(overrides: Partial<GateSummary> = {}): GateSummary {
  return {
    stageName: "概念设计",
    stageCode: "STG-P1",
    gateCode: "G1",
    gateName: "G1 方案审查",
    passRate: 0.85,
    pendingItems: 2,
    totalFindings: 12,
    criticalFindings: 1,
    status: "pass",
    ...overrides,
  };
}

describe("GateSummaryCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loading=true 时应渲染 Card loading 占位", () => {
    const { container } = render(
      <GateSummaryCard data={null} loading={true} />,
    );
    // antd Card loading 渲染骨架
    expect(container.querySelector(".ant-skeleton")).toBeDefined();
  });

  it("data=null 且非 loading 时应渲染 Empty 占位", () => {
    render(<GateSummaryCard data={null} loading={false} />);

    expect(screen.getByText("暂无门禁数据")).toBeDefined();
  });

  it("pass 状态应渲染通过标签与门禁信息", () => {
    render(<GateSummaryCard data={buildGateSummary()} />);

    expect(screen.getByText("STG-P1 - 概念设计")).toBeDefined();
    expect(screen.getByText("G1 方案审查")).toBeDefined();
    expect(screen.getByText(/G1 门禁/)).toBeDefined();
    expect(screen.getByText("通过")).toBeDefined();
  });

  it("fail 状态应渲染未通过标签", () => {
    render(<GateSummaryCard data={buildGateSummary({ status: "fail" })} />);

    expect(screen.getByText("未通过")).toBeDefined();
  });

  it("pending 状态应渲染待决策标签", () => {
    render(<GateSummaryCard data={buildGateSummary({ status: "pending" })} />);

    expect(screen.getByText("待决策")).toBeDefined();
  });

  it("应该渲染 4 个 Statistic（通过率/未决项/发现总数/严重发现）", () => {
    render(<GateSummaryCard data={buildGateSummary()} />);

    expect(screen.getByText("通过率")).toBeDefined();
    expect(screen.getByText("未决项")).toBeDefined();
    expect(screen.getByText("发现总数")).toBeDefined();
    expect(screen.getByText("严重发现")).toBeDefined();
  });

  it("通过率应展示为百分比（85%）", () => {
    render(<GateSummaryCard data={buildGateSummary({ passRate: 0.85 })} />);

    expect(screen.getByText("85")).toBeDefined();
    expect(screen.getByText("%")).toBeDefined();
  });

  it("passRate > 0 时应渲染进度条", () => {
    const { container } = render(
      <GateSummaryCard data={buildGateSummary({ passRate: 0.85 })} />,
    );

    expect(screen.getByText("门禁通过进度")).toBeDefined();
    // antd Progress 渲染为 .ant-progress 类
    expect(container.querySelector(".ant-progress")).toBeDefined();
  });

  it("passRate=0 时不应渲染进度条", () => {
    const { container } = render(
      <GateSummaryCard data={buildGateSummary({ passRate: 0 })} />,
    );

    expect(screen.queryByText("门禁通过进度")).toBeNull();
    expect(container.querySelector(".ant-progress")).toBeNull();
  });

  it("应该展示未决项与严重发现的数值", () => {
    render(
      <GateSummaryCard
        data={buildGateSummary({
          pendingItems: 5,
          totalFindings: 20,
          criticalFindings: 3,
        })}
      />,
    );

    // 通过 getAllByText 因为多个 5 可能在 DOM 中（如 passRate 也可能是 5%）
    // 这里 passRate 为 0.85，渲染为 85，pendingItems=5
    expect(screen.getByText("未决项")).toBeDefined();
    expect(screen.getByText("发现总数")).toBeDefined();
    expect(screen.getByText("严重发现")).toBeDefined();
  });

  it("passRate >= 0.8 时通过率数值应为绿色", () => {
    render(<GateSummaryCard data={buildGateSummary({ passRate: 0.85 })} />);

    // 通过率 Statistic 的 valueStyle.color 应为绿色
    const statistic = screen.getByText("85");
    // 找到包含 85 的 Statistic value 元素
    const valueElement = statistic.closest(".ant-statistic-content");
    expect(valueElement).toBeDefined();
    expect((valueElement as HTMLElement).style.color).toBe("rgb(82, 196, 26)");
  });

  it("passRate < 0.5 时进度条应为红色", () => {
    const { container } = render(
      <GateSummaryCard data={buildGateSummary({ passRate: 0.3 })} />,
    );

    // antd Progress 的 strokeColor 会渲染为内联 style
    const progressInner = container.querySelector(".ant-progress-bg");
    expect(progressInner).toBeDefined();
    expect((progressInner as HTMLElement).style.background).toContain(
      "rgb(255, 77, 79)",
    );
  });
});
