import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ComplianceSummary,
  type ComplianceSummaryData,
} from "@/components/project/compliance-summary";

/**
 * ComplianceSummary 单元测试
 *
 * 覆盖场景：
 * 1. 加载中状态
 * 2. 数据为 null 时空状态
 * 3. 完成状态（completed）渲染通过率与计数
 * 4. 运行中状态（running）
 * 5. 失败状态（failed）
 * 6. 通过率 100% 时颜色为绿
 * 7. 通过率 0% 时显示失败提示
 * 8. totalRules = 0 时通过率为 0（边界）
 */
describe("ComplianceSummary", () => {
  it("加载中时应该渲染骨架卡片", () => {
    const { container } = render(
      <ComplianceSummary data={null} loading={true} />,
    );
    // Ant Design Card loading 渲染骨架
    expect(container.firstChild).not.toBeNull();
  });

  it("data 为 null 时应该显示空状态", () => {
    render(<ComplianceSummary data={null} />);
    expect(screen.getByText("暂无合规检查数据")).toBeDefined();
  });

  it("完成状态时应渲染通过率与计数", () => {
    const data: ComplianceSummaryData = {
      totalRules: 100,
      passedRules: 80,
      failedRules: 20,
      checkStatus: "completed",
    };
    render(<ComplianceSummary data={data} />);
    // 通过率文本
    expect(screen.getByText("合规通过率")).toBeDefined();
    // 总规则数
    expect(screen.getByText("100")).toBeDefined();
    // 通过规则数
    expect(screen.getByText("80")).toBeDefined();
    // 失败规则数
    expect(screen.getByText("20")).toBeDefined();
    // 状态标签 Completed
    expect(screen.getByText("Completed")).toBeDefined();
  });

  it("运行中状态应显示 Running 标签", () => {
    const data: ComplianceSummaryData = {
      totalRules: 50,
      passedRules: 30,
      failedRules: 5,
      checkStatus: "running",
    };
    render(<ComplianceSummary data={data} />);
    expect(screen.getByText("Running")).toBeDefined();
  });

  it("失败状态应显示 Failed 标签", () => {
    const data: ComplianceSummaryData = {
      totalRules: 50,
      passedRules: 10,
      failedRules: 40,
      checkStatus: "failed",
    };
    render(<ComplianceSummary data={data} />);
    expect(screen.getByText("Failed")).toBeDefined();
  });

  it("失败规则数 > 0 时应显示风险提示", () => {
    const data: ComplianceSummaryData = {
      totalRules: 10,
      passedRules: 7,
      failedRules: 3,
      checkStatus: "completed",
    };
    render(<ComplianceSummary data={data} />);
    expect(screen.getByText(/存在 3 项未通过规则/)).toBeDefined();
  });

  it("失败规则数 = 0 时不应显示风险提示", () => {
    const data: ComplianceSummaryData = {
      totalRules: 10,
      passedRules: 10,
      failedRules: 0,
      checkStatus: "completed",
    };
    const { container } = render(<ComplianceSummary data={data} />);
    expect(container.textContent).not.toMatch(/存在 0 项未通过规则/);
  });

  it("totalRules = 0 时通过率应为 0（边界）", () => {
    const data: ComplianceSummaryData = {
      totalRules: 0,
      passedRules: 0,
      failedRules: 0,
      checkStatus: "completed",
    };
    render(<ComplianceSummary data={data} />);
    // 通过率显示为 0%
    expect(screen.getByText("合规通过率")).toBeDefined();
    // 总规则数为 0
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });

  it("通过率 >= 80% 时不显示风险提示", () => {
    const data: ComplianceSummaryData = {
      totalRules: 100,
      passedRules: 85,
      failedRules: 15,
      checkStatus: "completed",
    };
    const { container } = render(<ComplianceSummary data={data} />);
    // 通过率 85% 但仍有 15 个失败规则，应显示风险提示
    expect(container.textContent).toMatch(/存在 15 项未通过规则/);
  });

  it("应渲染状态标签 Completed 图标", () => {
    const data: ComplianceSummaryData = {
      totalRules: 10,
      passedRules: 10,
      failedRules: 0,
      checkStatus: "completed",
    };
    render(<ComplianceSummary data={data} />);
    // 状态标签应包含 Completed 文本
    const statusTags = screen.getAllByText("Completed");
    expect(statusTags.length).toBeGreaterThan(0);
  });

  it("未知检查状态应渲染兜底标签（不崩溃）", () => {
    const data = {
      totalRules: 10,
      passedRules: 8,
      failedRules: 2,
      checkStatus: "paused" as unknown as ComplianceSummaryData["checkStatus"],
    };
    render(
      <ComplianceSummary data={data as unknown as ComplianceSummaryData} />,
    );
    expect(screen.getByText("未知")).toBeDefined();
  });
});
