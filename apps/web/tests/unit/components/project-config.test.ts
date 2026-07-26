import { describe, it, expect } from "vitest";

import {
  BUILDING_TYPE_CONFIG,
  BUILDING_TYPE_FALLBACK,
  GATE_DECISION_CONFIG,
  GATE_DECISION_FALLBACK,
  GATE_STATUS_CONFIG,
  GATE_STATUS_FALLBACK,
  PROJECT_STATUS_CONFIG,
  PROJECT_STATUS_FALLBACK,
  STAGE_STATUS_CONFIG,
  STAGE_STATUS_FALLBACK,
  getBuildingTypeConfig,
  getGateDecisionConfig,
  getGateStatusConfig,
  getProjectStatusConfig,
  getStageStatusConfig,
  isKnownBuildingType,
  isKnownGateDecision,
  isKnownGateStatus,
  isKnownProjectStatus,
  isKnownStageStatus,
  type BuildingType,
  type GateDecision,
  type GateStatus,
  type ProjectStatus,
  type StageStatus,
} from "@/components/project/project-config";

/**
 * Project 模块枚举配置与兜底函数单元测试
 *
 * 覆盖核心规则：
 *  - 已知枚举值返回对应配置（含 label/color/iconKey）
 *  - 未知枚举值返回兜底配置（label="未知"、color="default"、iconKey="unknown"）
 *  - null/undefined/空字符串均安全降级，不抛异常
 *  - 类型守卫正确识别已知/未知值
 */
describe("project-config", () => {
  describe("getProjectStatusConfig", () => {
    it("已知枚举值应返回对应配置", () => {
      expect(getProjectStatusConfig("active")).toEqual(
        PROJECT_STATUS_CONFIG.active,
      );
      expect(getProjectStatusConfig("on_hold")).toEqual(
        PROJECT_STATUS_CONFIG.on_hold,
      );
      expect(getProjectStatusConfig("completed")).toEqual(
        PROJECT_STATUS_CONFIG.completed,
      );
      expect(getProjectStatusConfig("cancelled")).toEqual(
        PROJECT_STATUS_CONFIG.cancelled,
      );
      expect(getProjectStatusConfig("archived")).toEqual(
        PROJECT_STATUS_CONFIG.archived,
      );
    });

    it("未知枚举值应返回兜底配置", () => {
      const config = getProjectStatusConfig(
        "frozen" as unknown as ProjectStatus,
      );
      expect(config.label).toBe("未知");
      expect(config.color).toBe("default");
      expect(config.iconKey).toBe("unknown");
      expect(config).toEqual(PROJECT_STATUS_FALLBACK);
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getProjectStatusConfig(null)).toEqual(PROJECT_STATUS_FALLBACK);
      expect(getProjectStatusConfig(undefined)).toEqual(
        PROJECT_STATUS_FALLBACK,
      );
    });

    it("空字符串应返回兜底配置", () => {
      expect(getProjectStatusConfig("").label).toBe("未知");
    });
  });

  describe("getBuildingTypeConfig", () => {
    it("已知建筑类型应返回对应配置", () => {
      expect(getBuildingTypeConfig("office")).toEqual(
        BUILDING_TYPE_CONFIG.office,
      );
      expect(getBuildingTypeConfig("residential")).toEqual(
        BUILDING_TYPE_CONFIG.residential,
      );
      expect(getBuildingTypeConfig("commercial")).toEqual(
        BUILDING_TYPE_CONFIG.commercial,
      );
      expect(getBuildingTypeConfig("mixed")).toEqual(
        BUILDING_TYPE_CONFIG.mixed,
      );
    });

    it("未知建筑类型应返回兜底配置", () => {
      const config = getBuildingTypeConfig(
        "industrial" as unknown as BuildingType,
      );
      expect(config.label).toBe("未知");
      expect(config.iconKey).toBe("unknown");
      expect(config).toEqual(BUILDING_TYPE_FALLBACK);
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getBuildingTypeConfig(null)).toEqual(BUILDING_TYPE_FALLBACK);
      expect(getBuildingTypeConfig(undefined)).toEqual(BUILDING_TYPE_FALLBACK);
    });
  });

  describe("getStageStatusConfig", () => {
    it("已知阶段状态应返回对应配置", () => {
      // 覆盖所有 9 个阶段状态
      const allStatuses: StageStatus[] = [
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
      for (const status of allStatuses) {
        const config = getStageStatusConfig(status);
        expect(config).toEqual(STAGE_STATUS_CONFIG[status]);
        expect(config.iconKey).toBe(status);
      }
    });

    it("未知阶段状态应返回兜底配置", () => {
      const config = getStageStatusConfig("rejected" as unknown as StageStatus);
      expect(config.label).toBe("未知");
      expect(config.color).toBe("default");
      expect(config.iconKey).toBe("unknown");
      expect(config).toEqual(STAGE_STATUS_FALLBACK);
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getStageStatusConfig(null)).toEqual(STAGE_STATUS_FALLBACK);
      expect(getStageStatusConfig(undefined)).toEqual(STAGE_STATUS_FALLBACK);
    });

    it("空字符串应返回兜底配置", () => {
      expect(getStageStatusConfig("").iconKey).toBe("unknown");
    });
  });

  describe("getGateStatusConfig", () => {
    it("已知门禁状态应返回对应配置", () => {
      expect(getGateStatusConfig("pending")).toEqual(
        GATE_STATUS_CONFIG.pending,
      );
      expect(getGateStatusConfig("decided")).toEqual(
        GATE_STATUS_CONFIG.decided,
      );
      expect(getGateStatusConfig("cancelled")).toEqual(
        GATE_STATUS_CONFIG.cancelled,
      );
    });

    it("未知门禁状态应返回兜底配置", () => {
      const config = getGateStatusConfig("approved" as unknown as GateStatus);
      expect(config.label).toBe("未知");
      expect(config.iconKey).toBe("unknown");
      expect(config).toEqual(GATE_STATUS_FALLBACK);
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getGateStatusConfig(null)).toEqual(GATE_STATUS_FALLBACK);
      expect(getGateStatusConfig(undefined)).toEqual(GATE_STATUS_FALLBACK);
    });
  });

  describe("getGateDecisionConfig", () => {
    it("已知门禁决策应返回对应配置", () => {
      expect(getGateDecisionConfig("approved")).toEqual(
        GATE_DECISION_CONFIG.approved,
      );
      expect(getGateDecisionConfig("conditionally_approved")).toEqual(
        GATE_DECISION_CONFIG.conditionally_approved,
      );
      expect(getGateDecisionConfig("rework_required")).toEqual(
        GATE_DECISION_CONFIG.rework_required,
      );
      expect(getGateDecisionConfig("suspended")).toEqual(
        GATE_DECISION_CONFIG.suspended,
      );
      expect(getGateDecisionConfig("cancelled")).toEqual(
        GATE_DECISION_CONFIG.cancelled,
      );
    });

    it("未知门禁决策应返回兜底配置", () => {
      const config = getGateDecisionConfig(
        "rejected" as unknown as GateDecision,
      );
      expect(config.label).toBe("未知");
      expect(config.iconKey).toBe("unknown");
      expect(config).toEqual(GATE_DECISION_FALLBACK);
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getGateDecisionConfig(null)).toEqual(GATE_DECISION_FALLBACK);
      expect(getGateDecisionConfig(undefined)).toEqual(GATE_DECISION_FALLBACK);
    });
  });

  describe("isKnown* 类型守卫", () => {
    it("isKnownProjectStatus 应正确判断", () => {
      expect(isKnownProjectStatus("active")).toBe(true);
      expect(isKnownProjectStatus("archived")).toBe(true);
      expect(isKnownProjectStatus("frozen")).toBe(false);
      expect(isKnownProjectStatus(null)).toBe(false);
      expect(isKnownProjectStatus(undefined)).toBe(false);
      expect(isKnownProjectStatus("")).toBe(false);
    });

    it("isKnownBuildingType 应正确判断", () => {
      expect(isKnownBuildingType("office")).toBe(true);
      expect(isKnownBuildingType("mixed")).toBe(true);
      expect(isKnownBuildingType("industrial")).toBe(false);
      expect(isKnownBuildingType(null)).toBe(false);
      expect(isKnownBuildingType(undefined)).toBe(false);
    });

    it("isKnownStageStatus 应正确判断", () => {
      expect(isKnownStageStatus("planned")).toBe(true);
      expect(isKnownStageStatus("closed")).toBe(true);
      expect(isKnownStageStatus("rejected")).toBe(false);
      expect(isKnownStageStatus(null)).toBe(false);
      expect(isKnownStageStatus(undefined)).toBe(false);
      expect(isKnownStageStatus("")).toBe(false);
    });

    it("isKnownGateStatus 应正确判断", () => {
      expect(isKnownGateStatus("pending")).toBe(true);
      expect(isKnownGateStatus("decided")).toBe(true);
      expect(isKnownGateStatus("cancelled")).toBe(true);
      expect(isKnownGateStatus("approved")).toBe(false);
      expect(isKnownGateStatus(null)).toBe(false);
      expect(isKnownGateStatus(undefined)).toBe(false);
    });

    it("isKnownGateDecision 应正确判断", () => {
      expect(isKnownGateDecision("approved")).toBe(true);
      expect(isKnownGateDecision("suspended")).toBe(true);
      expect(isKnownGateDecision("rejected")).toBe(false);
      expect(isKnownGateDecision(null)).toBe(false);
      expect(isKnownGateDecision(undefined)).toBe(false);
    });
  });

  describe("配置对象完整性", () => {
    it("PROJECT_STATUS_CONFIG 应包含 5 个状态", () => {
      expect(Object.keys(PROJECT_STATUS_CONFIG)).toHaveLength(5);
    });

    it("BUILDING_TYPE_CONFIG 应包含 4 个类型", () => {
      expect(Object.keys(BUILDING_TYPE_CONFIG)).toHaveLength(4);
    });

    it("STAGE_STATUS_CONFIG 应包含 9 个阶段状态", () => {
      expect(Object.keys(STAGE_STATUS_CONFIG)).toHaveLength(9);
    });

    it("GATE_STATUS_CONFIG 应包含 3 个门禁状态", () => {
      expect(Object.keys(GATE_STATUS_CONFIG)).toHaveLength(3);
    });

    it("GATE_DECISION_CONFIG 应包含 5 个门禁决策", () => {
      expect(Object.keys(GATE_DECISION_CONFIG)).toHaveLength(5);
    });

    it("所有兜底配置应有 iconKey='unknown'", () => {
      expect(PROJECT_STATUS_FALLBACK.iconKey).toBe("unknown");
      expect(BUILDING_TYPE_FALLBACK.iconKey).toBe("unknown");
      expect(STAGE_STATUS_FALLBACK.iconKey).toBe("unknown");
      expect(GATE_STATUS_FALLBACK.iconKey).toBe("unknown");
      expect(GATE_DECISION_FALLBACK.iconKey).toBe("unknown");
    });

    it("所有兜底配置应有 label='未知'", () => {
      expect(PROJECT_STATUS_FALLBACK.label).toBe("未知");
      expect(BUILDING_TYPE_FALLBACK.label).toBe("未知");
      expect(STAGE_STATUS_FALLBACK.label).toBe("未知");
      expect(GATE_STATUS_FALLBACK.label).toBe("未知");
      expect(GATE_DECISION_FALLBACK.label).toBe("未知");
    });
  });
});
