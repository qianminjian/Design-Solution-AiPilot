import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FindingList } from "@/components/review/finding-list";
import type { ComplianceFinding } from "@/hooks/use-review";

/** 构造一个 ComplianceFinding fixture */
function buildFinding(
  overrides: Partial<ComplianceFinding> = {},
): ComplianceFinding {
  return {
    id: "f-1",
    reviewId: "rev-1",
    projectId: "p-1",
    ruleName: "疏散门最小宽度",
    ruleCode: "EGRESS-DOOR-W",
    objectName: "Door-001",
    objectId: "obj-1",
    severity: "critical",
    status: "pending",
    confidence: 0.85,
    description: "疏散门宽度不满足 1.2m 最低要求",
    codeReference: "GB 50016-2014 §5.5.19",
    suggestedFix: "调整门洞尺寸至 1200mm",
    assignedTo: "alice",
    createdAt: "2026-07-26T08:00:00Z",
    updatedAt: "2026-07-26T08:00:00Z",
    ...overrides,
  };
}

describe("FindingList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loading=true 时应渲染 Spin 加载", () => {
    const { container } = render(<FindingList data={[]} loading={true} />);
    expect(container.querySelector(".ant-spin")).toBeDefined();
  });

  it("data 为空数组时应渲染 Empty 占位", () => {
    render(<FindingList data={[]} loading={false} />);

    expect(screen.getByText("暂无合规发现")).toBeDefined();
  });

  it("data 未定义时应渲染 Empty 占位", () => {
    render(
      <FindingList
        data={undefined as unknown as ComplianceFinding[]}
        loading={false}
      />,
    );

    expect(screen.getByText("暂无合规发现")).toBeDefined();
  });

  it("应该渲染表格表头（含严重度、规则、适用对象、描述等）", () => {
    render(<FindingList data={[buildFinding()]} loading={false} />);

    // antd Table 内部 measure-row 会导致表头文字重复，用 getAllByText
    expect(screen.getAllByText("严重度").length).toBeGreaterThan(0);
    expect(screen.getAllByText("规则").length).toBeGreaterThan(0);
    expect(screen.getAllByText("适用对象").length).toBeGreaterThan(0);
    expect(screen.getAllByText("描述").length).toBeGreaterThan(0);
    expect(screen.getAllByText("规范引用").length).toBeGreaterThan(0);
    expect(screen.getAllByText("置信度").length).toBeGreaterThan(0);
    expect(screen.getAllByText("状态").length).toBeGreaterThan(0);
    expect(screen.getAllByText("指派").length).toBeGreaterThan(0);
    expect(screen.getAllByText("操作").length).toBeGreaterThan(0);
  });

  it("应该渲染数据行（ruleName、ruleCode、objectName、description 等）", () => {
    render(<FindingList data={[buildFinding()]} loading={false} />);

    expect(screen.getByText("疏散门最小宽度")).toBeDefined();
    expect(screen.getByText("EGRESS-DOOR-W")).toBeDefined();
    expect(screen.getByText("Door-001")).toBeDefined();
    expect(screen.getByText("疏散门宽度不满足 1.2m 最低要求")).toBeDefined();
    expect(screen.getByText("GB 50016-2014 §5.5.19")).toBeDefined();
  });

  it("critical 严重度应渲染红色「严重」标签", () => {
    render(
      <FindingList
        data={[buildFinding({ severity: "critical" })]}
        loading={false}
      />,
    );

    expect(screen.getByText("严重")).toBeDefined();
  });

  it("high 严重度应渲染橙色「高」标签", () => {
    render(
      <FindingList
        data={[buildFinding({ severity: "high" })]}
        loading={false}
      />,
    );

    expect(screen.getByText("高")).toBeDefined();
  });

  it("medium 严重度应渲染金色「中」标签", () => {
    render(
      <FindingList
        data={[buildFinding({ severity: "medium" })]}
        loading={false}
      />,
    );

    expect(screen.getByText("中")).toBeDefined();
  });

  it("low 严重度应渲染蓝色「低」标签", () => {
    render(
      <FindingList
        data={[buildFinding({ severity: "low" })]}
        loading={false}
      />,
    );

    expect(screen.getByText("低")).toBeDefined();
  });

  it("pending 状态应渲染「待处理」标签", () => {
    render(
      <FindingList
        data={[buildFinding({ status: "pending" })]}
        loading={false}
      />,
    );

    expect(screen.getByText("待处理")).toBeDefined();
  });

  it("approved 状态应渲染「已批准」标签", () => {
    render(
      <FindingList
        data={[buildFinding({ status: "approved" })]}
        loading={false}
      />,
    );

    expect(screen.getByText("已批准")).toBeDefined();
  });

  it("rejected 状态应渲染「已拒绝」标签", () => {
    render(
      <FindingList
        data={[buildFinding({ status: "rejected" })]}
        loading={false}
      />,
    );

    expect(screen.getByText("已拒绝")).toBeDefined();
  });

  it("resolved 状态应渲染「已解决」标签", () => {
    render(
      <FindingList
        data={[buildFinding({ status: "resolved" })]}
        loading={false}
      />,
    );

    expect(screen.getByText("已解决")).toBeDefined();
  });

  it("assignedTo 为 null 应显示「未指派」", () => {
    render(
      <FindingList
        data={[buildFinding({ assignedTo: null })]}
        loading={false}
      />,
    );

    expect(screen.getByText("未指派")).toBeDefined();
  });

  it("应该渲染分页器", () => {
    const { container } = render(
      <FindingList data={[buildFinding()]} loading={false} />,
    );

    expect(container.querySelector(".ant-pagination")).toBeDefined();
  });

  it("多行数据应正确渲染", () => {
    render(
      <FindingList
        data={[
          buildFinding({ id: "f-1", objectName: "Door-001" }),
          buildFinding({ id: "f-2", objectName: "Door-002" }),
          buildFinding({ id: "f-3", objectName: "Door-003" }),
        ]}
        loading={false}
      />,
    );

    expect(screen.getByText("Door-001")).toBeDefined();
    expect(screen.getByText("Door-002")).toBeDefined();
    expect(screen.getByText("Door-003")).toBeDefined();
  });
});
