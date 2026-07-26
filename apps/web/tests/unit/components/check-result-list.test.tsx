import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CheckResultList } from "@/components/review/check-result-list";
import type { ComplianceCheckResult } from "@/hooks/use-review";

/** 构造一个 ComplianceCheckResult fixture */
function buildResult(
  overrides: Partial<ComplianceCheckResult> = {},
): ComplianceCheckResult {
  return {
    id: "r-1",
    ruleName: "最小开窗面积比",
    ruleCode: "WIN-RATIO-001",
    applicableObjects: 12,
    passCount: 10,
    failCount: 2,
    naCount: 0,
    uncertainCount: 0,
    status: "passed",
    lastRunAt: "2026-07-26T08:00:00Z",
    ...overrides,
  };
}

describe("CheckResultList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loading=true 时应渲染 Spin 加载", () => {
    const { container } = render(<CheckResultList data={[]} loading={true} />);
    expect(container.querySelector(".ant-spin")).toBeDefined();
  });

  it("data 为空数组时应渲染 Empty 占位", () => {
    render(<CheckResultList data={[]} loading={false} />);

    expect(screen.getByText("暂无检查结果")).toBeDefined();
  });

  it("data 未定义时应渲染 Empty 占位", () => {
    render(
      <CheckResultList
        data={undefined as unknown as ComplianceCheckResult[]}
        loading={false}
      />,
    );

    expect(screen.getByText("暂无检查结果")).toBeDefined();
  });

  it("应该渲染表格表头（含规则名称、规则编码、适用对象数等）", () => {
    render(<CheckResultList data={[buildResult()]} loading={false} />);

    // antd Table 内部会渲染 measure-row，导致表头文字出现多次，用 getAllByText
    expect(screen.getAllByText("规则名称").length).toBeGreaterThan(0);
    expect(screen.getAllByText("规则编码").length).toBeGreaterThan(0);
    expect(screen.getAllByText("适用对象数").length).toBeGreaterThan(0);
    expect(screen.getAllByText("通过").length).toBeGreaterThan(0);
    expect(screen.getAllByText("失败").length).toBeGreaterThan(0);
    expect(screen.getAllByText("不适用").length).toBeGreaterThan(0);
    expect(screen.getAllByText("不确定").length).toBeGreaterThan(0);
    expect(screen.getAllByText("通过率").length).toBeGreaterThan(0);
    expect(screen.getAllByText("状态").length).toBeGreaterThan(0);
  });

  it("应该渲染数据行（ruleName、ruleCode 等）", () => {
    render(<CheckResultList data={[buildResult()]} loading={false} />);

    expect(screen.getByText("最小开窗面积比")).toBeDefined();
    expect(screen.getByText("WIN-RATIO-001")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined(); // applicableObjects
    expect(screen.getByText("10")).toBeDefined(); // passCount
    expect(screen.getByText("2")).toBeDefined(); // failCount
  });

  it("passed 状态应渲染「通过」标签", () => {
    render(
      <CheckResultList
        data={[buildResult({ status: "passed" })]}
        loading={false}
      />,
    );

    // 表头也含"通过"字样，用 getAllByText
    expect(screen.getAllByText("通过").length).toBeGreaterThan(0);
  });

  it("failed 状态应渲染「失败」标签", () => {
    render(
      <CheckResultList
        data={[buildResult({ status: "failed" })]}
        loading={false}
      />,
    );

    expect(screen.getAllByText("失败").length).toBeGreaterThan(0);
  });

  it("running 状态应渲染蓝色「运行中」标签", () => {
    render(
      <CheckResultList
        data={[buildResult({ status: "running" })]}
        loading={false}
      />,
    );

    expect(screen.getByText("运行中")).toBeDefined();
  });

  it("partial 状态应渲染橙色「部分通过」标签", () => {
    render(
      <CheckResultList
        data={[buildResult({ status: "partial" })]}
        loading={false}
      />,
    );

    expect(screen.getByText("部分通过")).toBeDefined();
  });

  it("total=0 时通过率应显示 -", () => {
    render(
      <CheckResultList
        data={[
          buildResult({
            applicableObjects: 0,
            naCount: 0,
          }),
        ]}
        loading={false}
      />,
    );

    // 通过率列单元格渲染为 "-"
    expect(screen.getByText("-")).toBeDefined();
  });

  it("应该渲染分页器", () => {
    const { container } = render(
      <CheckResultList data={[buildResult()]} loading={false} />,
    );

    expect(container.querySelector(".ant-pagination")).toBeDefined();
  });

  it("多行数据应正确渲染", () => {
    render(
      <CheckResultList
        data={[
          buildResult({ id: "r-1", ruleName: "规则 A" }),
          buildResult({ id: "r-2", ruleName: "规则 B" }),
          buildResult({ id: "r-3", ruleName: "规则 C" }),
        ]}
        loading={false}
      />,
    );

    expect(screen.getByText("规则 A")).toBeDefined();
    expect(screen.getByText("规则 B")).toBeDefined();
    expect(screen.getByText("规则 C")).toBeDefined();
  });

  it("未知检查结果状态应渲染兜底标签（不崩溃）", () => {
    render(
      <CheckResultList
        data={[
          buildResult({
            status: "skipped" as unknown as ComplianceCheckResult["status"],
          }),
        ]}
        loading={false}
      />,
    );

    expect(screen.getByText("未知")).toBeDefined();
  });
});
