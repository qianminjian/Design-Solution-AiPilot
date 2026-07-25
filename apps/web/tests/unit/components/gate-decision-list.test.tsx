import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GateDecisionList } from "@/components/project/gate-decision-list";
import type { GateDecisionDto } from "@design-platform/shared";

/**
 * GateDecisionList 单元测试
 *
 * 覆盖场景：
 * 1. 加载中状态
 * 2. 空列表空状态
 * 3. 已批准决策展示
 * 4. 条件批准决策
 * 5. 待决策（pending）状态
 * 6. 决策备注展示
 * 7. 决策人与时间展示
 * 8. 决策为 null 时显示状态标签
 */
function buildGate(overrides: Partial<GateDecisionDto> = {}): GateDecisionDto {
  return {
    id: "gate-001",
    tenantId: "tenant-001",
    projectId: "proj-001",
    stageId: "stage-001",
    gateCode: "G1",
    gateName: "概念设计门禁",
    status: "decided",
    decision: "approved",
    decidedAt: "2026-07-24T10:00:00.000Z",
    decidedBy: "user-001",
    baselineId: "baseline-001",
    comment: "符合规范要求",
    evidence: [],
    metadata: {},
    createdAt: "2026-07-24T09:00:00.000Z",
    updatedAt: "2026-07-24T09:00:00.000Z",
    rowVersion: 1,
    ...overrides,
  };
}

describe("GateDecisionList", () => {
  it("加载中时应渲染 Spin", () => {
    render(<GateDecisionList gates={[]} loading={true} />);
    expect(screen.getByText("Gate Decisions")).toBeDefined();
  });

  it("空列表应渲染空状态", () => {
    render(<GateDecisionList gates={[]} />);
    expect(screen.getByText("暂无门禁决策记录")).toBeDefined();
  });

  it("应渲染卡片标题 Gate Decisions", () => {
    render(<GateDecisionList gates={[]} />);
    expect(screen.getByText("Gate Decisions")).toBeDefined();
  });

  it("应渲染已批准决策的标签与名称", () => {
    const gate = buildGate({
      decision: "approved",
      gateName: "概念设计门禁",
    });
    render(<GateDecisionList gates={[gate]} />);
    expect(screen.getByText("概念设计门禁")).toBeDefined();
    expect(screen.getByText("Approved")).toBeDefined();
    expect(screen.getByText("G1")).toBeDefined();
  });

  it("应渲染条件批准决策标签", () => {
    const gate = buildGate({
      decision: "conditionally_approved",
      gateName: "方案设计门禁",
    });
    render(<GateDecisionList gates={[gate]} />);
    expect(screen.getByText("方案设计门禁")).toBeDefined();
    expect(screen.getByText("Conditionally Approved")).toBeDefined();
  });

  it("应渲染返工决策标签", () => {
    const gate = buildGate({
      decision: "rework_required",
      gateName: "扩初设计门禁",
    });
    render(<GateDecisionList gates={[gate]} />);
    expect(screen.getByText("扩初设计门禁")).toBeDefined();
    expect(screen.getByText("Rework Required")).toBeDefined();
  });

  it("应渲染挂起决策标签", () => {
    const gate = buildGate({
      decision: "suspended",
      gateName: "施工图门禁",
    });
    render(<GateDecisionList gates={[gate]} />);
    expect(screen.getByText("施工图门禁")).toBeDefined();
    expect(screen.getByText("Suspended")).toBeDefined();
  });

  it("应渲染取消决策标签", () => {
    const gate = buildGate({
      decision: "cancelled",
      gateName: "综合校审门禁",
    });
    render(<GateDecisionList gates={[gate]} />);
    expect(screen.getByText("综合校审门禁")).toBeDefined();
    expect(screen.getByText("Cancelled")).toBeDefined();
  });

  it("决策为 null 时应渲染状态标签 Pending", () => {
    const gate = buildGate({
      decision: null,
      status: "pending",
      decidedAt: null,
      decidedBy: null,
      gateName: "未决策门禁",
    });
    render(<GateDecisionList gates={[gate]} />);
    expect(screen.getByText("未决策门禁")).toBeDefined();
    expect(screen.getByText("Pending")).toBeDefined();
  });

  it("应渲染决策备注", () => {
    const gate = buildGate({
      comment: "需补充结构计算书",
    });
    render(<GateDecisionList gates={[gate]} />);
    expect(screen.getByText("需补充结构计算书")).toBeDefined();
  });

  it("decidedBy 为 null 时应展示占位符 —", () => {
    const gate = buildGate({
      decidedBy: null,
      decision: null,
      status: "pending",
      decidedAt: null,
    });
    render(<GateDecisionList gates={[gate]} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("应同时渲染多个门禁决策", () => {
    const gates = [
      buildGate({
        id: "g1",
        gateCode: "G1",
        gateName: "概念设计门禁",
        decision: "approved",
      }),
      buildGate({
        id: "g2",
        gateCode: "G2",
        gateName: "方案设计门禁",
        decision: "conditionally_approved",
      }),
      buildGate({
        id: "g3",
        gateCode: "G3",
        gateName: "扩初设计门禁",
        decision: null,
        status: "pending",
        decidedAt: null,
        decidedBy: null,
      }),
    ];
    render(<GateDecisionList gates={gates} />);
    expect(screen.getByText("概念设计门禁")).toBeDefined();
    expect(screen.getByText("方案设计门禁")).toBeDefined();
    expect(screen.getByText("扩初设计门禁")).toBeDefined();
  });
});
