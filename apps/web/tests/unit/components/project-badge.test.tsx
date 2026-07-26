import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ProjectStatusBadge,
  BuildingTypeBadge,
  StageStatusBadge,
  GateStatusBadge,
  GateDecisionBadge,
} from "@/components/project/project-badge";
import {
  getProjectStatusConfig,
  getBuildingTypeConfig,
  getStageStatusConfig,
  getGateStatusConfig,
  getGateDecisionConfig,
  isKnownProjectStatus,
  isKnownBuildingType,
  isKnownStageStatus,
  isKnownGateStatus,
  isKnownGateDecision,
  PROJECT_STATUS_CONFIG,
  BUILDING_TYPE_CONFIG,
  STAGE_STATUS_CONFIG,
  GATE_STATUS_CONFIG,
  GATE_DECISION_CONFIG,
  PROJECT_STATUS_FALLBACK,
  BUILDING_TYPE_FALLBACK,
  STAGE_STATUS_FALLBACK,
  GATE_STATUS_FALLBACK,
  GATE_DECISION_FALLBACK,
  type ProjectStatus,
  type BuildingType,
  type StageStatus,
  type GateStatus,
  type GateDecision,
} from "@/components/project/project-config";

describe("project-config", () => {
  describe("getProjectStatusConfig", () => {
    it("已知枚举值应返回对应配置", () => {
      expect(getProjectStatusConfig("active").label).toBe("Active");
      expect(getProjectStatusConfig("on_hold").label).toBe("On Hold");
      expect(getProjectStatusConfig("completed").label).toBe("Completed");
      expect(getProjectStatusConfig("cancelled").label).toBe("Cancelled");
      expect(getProjectStatusConfig("archived").label).toBe("Archived");
    });

    it("未知枚举值应返回兜底配置", () => {
      const config = getProjectStatusConfig(
        "paused" as unknown as ProjectStatus,
      );
      expect(config.label).toBe("未知");
      expect(config.color).toBe("default");
      expect(config.iconKey).toBe("unknown");
    });

    it("null/undefined/空字符串应返回兜底配置", () => {
      expect(getProjectStatusConfig(null).label).toBe("未知");
      expect(getProjectStatusConfig(undefined).label).toBe("未知");
      expect(getProjectStatusConfig("").label).toBe("未知");
    });
  });

  describe("getBuildingTypeConfig", () => {
    it("已知枚举值应返回对应配置", () => {
      expect(getBuildingTypeConfig("office").label).toBe("Office");
      expect(getBuildingTypeConfig("residential").label).toBe("Residential");
      expect(getBuildingTypeConfig("commercial").label).toBe("Commercial");
      expect(getBuildingTypeConfig("mixed").label).toBe("Mixed-use");
    });

    it("未知枚举值应返回兜底配置", () => {
      const config = getBuildingTypeConfig(
        "industrial" as unknown as BuildingType,
      );
      expect(config.label).toBe("未知");
      expect(config.iconKey).toBe("unknown");
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getBuildingTypeConfig(null).label).toBe("未知");
      expect(getBuildingTypeConfig(undefined).label).toBe("未知");
    });
  });

  describe("getStageStatusConfig", () => {
    it("已知枚举值应返回对应配置", () => {
      expect(getStageStatusConfig("planned").label).toBe("Planned");
      expect(getStageStatusConfig("active").label).toBe("Active");
      expect(getStageStatusConfig("approved").label).toBe("Approved");
      expect(getStageStatusConfig("closed").label).toBe("Closed");
      expect(getStageStatusConfig("suspended").label).toBe("Suspended");
    });

    it("未知枚举值应返回兜底配置", () => {
      const config = getStageStatusConfig("rejected" as unknown as StageStatus);
      expect(config.label).toBe("未知");
      expect(config.iconKey).toBe("unknown");
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getStageStatusConfig(null).label).toBe("未知");
      expect(getStageStatusConfig(undefined).label).toBe("未知");
    });
  });

  describe("getGateStatusConfig", () => {
    it("已知枚举值应返回对应配置", () => {
      expect(getGateStatusConfig("pending").label).toBe("Pending");
      expect(getGateStatusConfig("decided").label).toBe("Decided");
      expect(getGateStatusConfig("cancelled").label).toBe("Cancelled");
    });

    it("未知枚举值应返回兜底配置", () => {
      const config = getGateStatusConfig("rejected" as unknown as GateStatus);
      expect(config.label).toBe("未知");
      expect(config.iconKey).toBe("unknown");
    });
  });

  describe("getGateDecisionConfig", () => {
    it("已知枚举值应返回对应配置", () => {
      expect(getGateDecisionConfig("approved").label).toBe("Approved");
      expect(getGateDecisionConfig("cancelled").label).toBe("Cancelled");
      expect(getGateDecisionConfig("rework_required").label).toBe(
        "Rework Required",
      );
      expect(getGateDecisionConfig("suspended").label).toBe("Suspended");
    });

    it("未知枚举值应返回兜底配置", () => {
      const config = getGateDecisionConfig(
        "rejected" as unknown as GateDecision,
      );
      expect(config.label).toBe("未知");
      expect(config.iconKey).toBe("unknown");
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getGateDecisionConfig(null).label).toBe("未知");
      expect(getGateDecisionConfig(undefined).label).toBe("未知");
    });
  });

  describe("类型守卫函数", () => {
    it("isKnownProjectStatus 应正确识别", () => {
      expect(isKnownProjectStatus("active")).toBe(true);
      expect(isKnownProjectStatus("paused")).toBe(false);
      expect(isKnownProjectStatus(null)).toBe(false);
      expect(isKnownProjectStatus(undefined)).toBe(false);
    });

    it("isKnownBuildingType 应正确识别", () => {
      expect(isKnownBuildingType("office")).toBe(true);
      expect(isKnownBuildingType("industrial")).toBe(false);
      expect(isKnownBuildingType(null)).toBe(false);
    });

    it("isKnownStageStatus 应正确识别", () => {
      expect(isKnownStageStatus("planned")).toBe(true);
      expect(isKnownStageStatus("rejected")).toBe(false);
      expect(isKnownStageStatus(undefined)).toBe(false);
    });

    it("isKnownGateStatus 应正确识别", () => {
      expect(isKnownGateStatus("pending")).toBe(true);
      expect(isKnownGateStatus("draft")).toBe(false);
    });

    it("isKnownGateDecision 应正确识别", () => {
      expect(isKnownGateDecision("approved")).toBe(true);
      expect(isKnownGateDecision("rejected")).toBe(false);
      expect(isKnownGateDecision(null)).toBe(false);
    });
  });

  describe("配置表完整性", () => {
    it("PROJECT_STATUS_CONFIG 应覆盖所有 ProjectStatus 枚举", () => {
      const statuses: ProjectStatus[] = [
        "active",
        "on_hold",
        "completed",
        "cancelled",
        "archived",
      ];
      statuses.forEach((s) => {
        expect(PROJECT_STATUS_CONFIG[s]).toBeDefined();
        expect(PROJECT_STATUS_CONFIG[s].label).toBeTruthy();
      });
    });

    it("BUILDING_TYPE_CONFIG 应覆盖所有 BuildingType 枚举", () => {
      const types: BuildingType[] = [
        "office",
        "residential",
        "commercial",
        "mixed",
      ];
      types.forEach((t) => {
        expect(BUILDING_TYPE_CONFIG[t]).toBeDefined();
      });
    });

    it("STAGE_STATUS_CONFIG 应覆盖所有 StageStatus 枚举（9 个）", () => {
      const statuses: StageStatus[] = [
        "planned",
        "active",
        "review_preparing",
        "under_review",
        "conditionally_approved",
        "approved",
        "suspended",
        "cancelled",
        "closed",
      ];
      expect(Object.keys(STAGE_STATUS_CONFIG).length).toBe(statuses.length);
      statuses.forEach((s) => {
        expect(STAGE_STATUS_CONFIG[s]).toBeDefined();
      });
    });

    it("GATE_STATUS_CONFIG 应覆盖所有 GateStatus 枚举", () => {
      const statuses: GateStatus[] = ["pending", "decided", "cancelled"];
      statuses.forEach((s) => {
        expect(GATE_STATUS_CONFIG[s]).toBeDefined();
      });
    });

    it("GATE_DECISION_CONFIG 应覆盖所有 GateDecision 枚举（5 个）", () => {
      const decisions: GateDecision[] = [
        "approved",
        "conditionally_approved",
        "rework_required",
        "suspended",
        "cancelled",
      ];
      expect(Object.keys(GATE_DECISION_CONFIG).length).toBe(decisions.length);
      decisions.forEach((d) => {
        expect(GATE_DECISION_CONFIG[d]).toBeDefined();
      });
    });

    it("所有 FALLBACK 配置应以 unknown 为 iconKey", () => {
      expect(PROJECT_STATUS_FALLBACK.iconKey).toBe("unknown");
      expect(BUILDING_TYPE_FALLBACK.iconKey).toBe("unknown");
      expect(STAGE_STATUS_FALLBACK.iconKey).toBe("unknown");
      expect(GATE_STATUS_FALLBACK.iconKey).toBe("unknown");
      expect(GATE_DECISION_FALLBACK.iconKey).toBe("unknown");
    });
  });
});

describe("project-badge 组件", () => {
  describe("ProjectStatusBadge", () => {
    it("已知状态应渲染对应标签", () => {
      render(<ProjectStatusBadge value="active" />);
      expect(screen.getByText("Active")).toBeDefined();
    });

    it("未知状态应渲染兜底标签（不崩溃）", () => {
      render(
        <ProjectStatusBadge value={"paused" as unknown as ProjectStatus} />,
      );
      expect(screen.getByText("未知")).toBeDefined();
    });

    it("null 应渲染兜底标签", () => {
      render(<ProjectStatusBadge value={null} />);
      expect(screen.getByText("未知")).toBeDefined();
    });

    it("undefined 应渲染兜底标签", () => {
      render(<ProjectStatusBadge value={undefined} />);
      expect(screen.getByText("未知")).toBeDefined();
    });
  });

  describe("BuildingTypeBadge", () => {
    it("已知类型应渲染对应标签", () => {
      render(<BuildingTypeBadge value="office" />);
      expect(screen.getByText("Office")).toBeDefined();
    });

    it("未知类型应渲染兜底标签（不崩溃）", () => {
      render(
        <BuildingTypeBadge value={"industrial" as unknown as BuildingType} />,
      );
      expect(screen.getByText("未知")).toBeDefined();
    });

    it("null 应渲染兜底标签", () => {
      render(<BuildingTypeBadge value={null} />);
      expect(screen.getByText("未知")).toBeDefined();
    });
  });

  describe("StageStatusBadge", () => {
    it("已知状态应渲染对应标签", () => {
      render(<StageStatusBadge value="planned" />);
      expect(screen.getByText("Planned")).toBeDefined();
    });

    it("未知状态应渲染兜底标签（不崩溃）", () => {
      render(<StageStatusBadge value={"rejected" as unknown as StageStatus} />);
      expect(screen.getByText("未知")).toBeDefined();
    });

    it("undefined 应渲染兜底标签", () => {
      render(<StageStatusBadge value={undefined} />);
      expect(screen.getByText("未知")).toBeDefined();
    });
  });

  describe("GateStatusBadge", () => {
    it("已知状态应渲染对应标签", () => {
      render(<GateStatusBadge value="pending" />);
      expect(screen.getByText("Pending")).toBeDefined();
    });

    it("未知状态应渲染兜底标签（不崩溃）", () => {
      render(<GateStatusBadge value={"draft" as unknown as GateStatus} />);
      expect(screen.getByText("未知")).toBeDefined();
    });
  });

  describe("GateDecisionBadge", () => {
    it("已知决策应渲染对应标签", () => {
      render(<GateDecisionBadge value="approved" />);
      expect(screen.getByText("Approved")).toBeDefined();
    });

    it("未知决策应渲染兜底标签（不崩溃）", () => {
      render(
        <GateDecisionBadge value={"rejected" as unknown as GateDecision} />,
      );
      expect(screen.getByText("未知")).toBeDefined();
    });

    it("null/undefined 决策应渲染「未决策」标签", () => {
      render(<GateDecisionBadge value={null} />);
      expect(screen.getByText("未决策")).toBeDefined();
    });

    it("undefined 决策应渲染「未决策」标签", () => {
      render(<GateDecisionBadge value={undefined} />);
      expect(screen.getByText("未决策")).toBeDefined();
    });
  });
});
