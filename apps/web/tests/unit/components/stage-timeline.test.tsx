import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageTimeline } from "@/components/project/stage-timeline";
import type { StageInstanceDto, StageCode } from "@design-platform/shared";

// Mock Ant Design 组件的基本渲染
vi.mock("antd", async () => {
  const actual = await vi.importActual("antd");
  return {
    ...actual,
    Card: ({
      children,
      title,
    }: {
      children: React.ReactNode;
      title?: React.ReactNode;
    }) => (
      <div data-testid="card">
        {title && <div data-testid="card-title">{title}</div>}
        {children}
      </div>
    ),
    Spin: () => <div data-testid="spin">Loading...</div>,
    Empty: ({ description }: { description?: string }) => (
      <div data-testid="empty">{description}</div>
    ),
    Tag: ({
      children,
      color,
    }: {
      children: React.ReactNode;
      color?: string;
    }) => (
      <span data-testid="tag" data-color={color}>
        {children}
      </span>
    ),
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Typography: {
      Title: ({ children }: { children: React.ReactNode }) => (
        <h5>{children}</h5>
      ),
      Text: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
      ),
    },
  };
});

describe("StageTimeline", () => {
  const mockStages: StageInstanceDto[] = [
    {
      id: "stage-1",
      tenantId: "tenant-1",
      projectId: "project-1",
      stageCode: "STG-P0" as StageCode,
      stageName: "概念设计",
      stageOrder: 1,
      status: "approved",
      startedAt: "2024-01-01T00:00:00Z",
      completedAt: null,
      metadata: {},
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      rowVersion: 1,
    },
    {
      id: "stage-2",
      tenantId: "tenant-1",
      projectId: "project-1",
      stageCode: "STG-P1" as StageCode,
      stageName: "方案设计",
      stageOrder: 2,
      status: "active",
      startedAt: "2024-01-15T00:00:00Z",
      completedAt: null,
      metadata: {},
      createdAt: "2024-01-15T00:00:00Z",
      updatedAt: "2024-01-15T00:00:00Z",
      rowVersion: 1,
    },
    {
      id: "stage-3",
      tenantId: "tenant-1",
      projectId: "project-1",
      stageCode: "STG-P2" as StageCode,
      stageName: "扩初设计",
      stageOrder: 3,
      status: "planned",
      startedAt: null,
      completedAt: null,
      metadata: {},
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      rowVersion: 1,
    },
  ];

  it("应该渲染阶段时间线标题", () => {
    render(<StageTimeline stages={mockStages} />);
    expect(screen.getByText("Project Stage Progress")).toBeDefined();
  });

  it("应该渲染所有阶段名称", () => {
    render(<StageTimeline stages={mockStages} />);
    expect(screen.getByText("概念设计")).toBeDefined();
    expect(screen.getByText("方案设计")).toBeDefined();
    expect(screen.getByText("扩初设计")).toBeDefined();
  });

  it("应该渲染阶段编码 Tag", () => {
    render(<StageTimeline stages={mockStages} />);
    expect(screen.getByText("STG-P0")).toBeDefined();
    expect(screen.getByText("STG-P1")).toBeDefined();
    expect(screen.getByText("STG-P2")).toBeDefined();
  });

  it("加载态应该显示 Spin", () => {
    render(<StageTimeline stages={[]} loading />);
    expect(screen.getByTestId("spin")).toBeDefined();
  });

  it("空阶段列表应该显示 Empty", () => {
    render(<StageTimeline stages={[]} />);
    expect(screen.getByTestId("empty")).toBeDefined();
  });
});
