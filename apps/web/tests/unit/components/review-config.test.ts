import { describe, it, expect } from "vitest";

import {
  CHECK_RESULT_STATUS_CONFIG,
  CHECK_RESULT_STATUS_FALLBACK,
  FINDING_STATUS_CONFIG,
  FINDING_STATUS_FALLBACK,
  SEVERITY_CONFIG,
  SEVERITY_FALLBACK,
  getCheckResultStatusConfig,
  getFindingStatusConfig,
  getSeverityConfig,
  isKnownCheckResultStatus,
  isKnownFindingStatus,
  isKnownSeverity,
  type CheckResultStatus,
  type FindingSeverity,
  type FindingStatus,
} from "@/components/review/review-config";

/**
 * Review 模块枚举配置与兜底函数单元测试
 *
 * 覆盖核心规则：
 *  - 已知枚举值返回对应配置（含 label/color/iconKey/bgColor）
 *  - 未知枚举值返回兜底配置（label="未知"、color="default"、iconKey="unknown"）
 *  - null/undefined/空字符串均安全降级，不抛异常
 *  - 类型守卫正确识别已知/未知值
 */
describe("review-config", () => {
  describe("getSeverityConfig", () => {
    it("已知严重级别应返回对应配置", () => {
      expect(getSeverityConfig("critical")).toEqual(SEVERITY_CONFIG.critical);
      expect(getSeverityConfig("high")).toEqual(SEVERITY_CONFIG.high);
      expect(getSeverityConfig("medium")).toEqual(SEVERITY_CONFIG.medium);
      expect(getSeverityConfig("low")).toEqual(SEVERITY_CONFIG.low);
    });

    it("未知严重级别应返回兜底配置", () => {
      const config = getSeverityConfig("blocker" as unknown as FindingSeverity);
      expect(config.label).toBe("未知");
      expect(config.color).toBe("default");
      expect(config.iconKey).toBe("unknown");
      expect(config).toEqual(SEVERITY_FALLBACK);
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getSeverityConfig(null)).toEqual(SEVERITY_FALLBACK);
      expect(getSeverityConfig(undefined)).toEqual(SEVERITY_FALLBACK);
    });

    it("空字符串应返回兜底配置", () => {
      expect(getSeverityConfig("").label).toBe("未知");
    });

    it("SeverityConfig 应包含 bgColor 字段", () => {
      expect(SEVERITY_CONFIG.critical.bgColor).toBeDefined();
      expect(SEVERITY_FALLBACK.bgColor).toBeDefined();
    });
  });

  describe("getFindingStatusConfig", () => {
    it("已知发现状态应返回对应配置", () => {
      expect(getFindingStatusConfig("pending")).toEqual(
        FINDING_STATUS_CONFIG.pending,
      );
      expect(getFindingStatusConfig("approved")).toEqual(
        FINDING_STATUS_CONFIG.approved,
      );
      expect(getFindingStatusConfig("rejected")).toEqual(
        FINDING_STATUS_CONFIG.rejected,
      );
      expect(getFindingStatusConfig("resolved")).toEqual(
        FINDING_STATUS_CONFIG.resolved,
      );
    });

    it("未知发现状态应返回兜底配置", () => {
      const config = getFindingStatusConfig(
        "closed" as unknown as FindingStatus,
      );
      expect(config.label).toBe("未知");
      expect(config.iconKey).toBe("unknown");
      expect(config).toEqual(FINDING_STATUS_FALLBACK);
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getFindingStatusConfig(null)).toEqual(FINDING_STATUS_FALLBACK);
      expect(getFindingStatusConfig(undefined)).toEqual(
        FINDING_STATUS_FALLBACK,
      );
    });
  });

  describe("getCheckResultStatusConfig", () => {
    it("已知检查结果状态应返回对应配置", () => {
      expect(getCheckResultStatusConfig("passed")).toEqual(
        CHECK_RESULT_STATUS_CONFIG.passed,
      );
      expect(getCheckResultStatusConfig("failed")).toEqual(
        CHECK_RESULT_STATUS_CONFIG.failed,
      );
      expect(getCheckResultStatusConfig("partial")).toEqual(
        CHECK_RESULT_STATUS_CONFIG.partial,
      );
      expect(getCheckResultStatusConfig("running")).toEqual(
        CHECK_RESULT_STATUS_CONFIG.running,
      );
    });

    it("未知检查结果状态应返回兜底配置", () => {
      const config = getCheckResultStatusConfig(
        "skipped" as unknown as CheckResultStatus,
      );
      expect(config.label).toBe("未知");
      expect(config.iconKey).toBe("unknown");
      expect(config).toEqual(CHECK_RESULT_STATUS_FALLBACK);
    });

    it("null/undefined/空字符串 应返回兜底配置", () => {
      expect(getCheckResultStatusConfig(null)).toEqual(
        CHECK_RESULT_STATUS_FALLBACK,
      );
      expect(getCheckResultStatusConfig(undefined)).toEqual(
        CHECK_RESULT_STATUS_FALLBACK,
      );
      expect(getCheckResultStatusConfig("").iconKey).toBe("unknown");
    });
  });

  describe("isKnown* 类型守卫", () => {
    it("isKnownSeverity 应正确判断", () => {
      expect(isKnownSeverity("critical")).toBe(true);
      expect(isKnownSeverity("low")).toBe(true);
      expect(isKnownSeverity("blocker")).toBe(false);
      expect(isKnownSeverity(null)).toBe(false);
      expect(isKnownSeverity(undefined)).toBe(false);
      expect(isKnownSeverity("")).toBe(false);
    });

    it("isKnownFindingStatus 应正确判断", () => {
      expect(isKnownFindingStatus("pending")).toBe(true);
      expect(isKnownFindingStatus("resolved")).toBe(true);
      expect(isKnownFindingStatus("closed")).toBe(false);
      expect(isKnownFindingStatus(null)).toBe(false);
      expect(isKnownFindingStatus(undefined)).toBe(false);
    });

    it("isKnownCheckResultStatus 应正确判断", () => {
      expect(isKnownCheckResultStatus("passed")).toBe(true);
      expect(isKnownCheckResultStatus("running")).toBe(true);
      expect(isKnownCheckResultStatus("skipped")).toBe(false);
      expect(isKnownCheckResultStatus(null)).toBe(false);
      expect(isKnownCheckResultStatus(undefined)).toBe(false);
      expect(isKnownCheckResultStatus("")).toBe(false);
    });
  });

  describe("配置对象完整性", () => {
    it("SEVERITY_CONFIG 应包含 4 个级别", () => {
      expect(Object.keys(SEVERITY_CONFIG)).toHaveLength(4);
    });

    it("FINDING_STATUS_CONFIG 应包含 4 个状态", () => {
      expect(Object.keys(FINDING_STATUS_CONFIG)).toHaveLength(4);
    });

    it("CHECK_RESULT_STATUS_CONFIG 应包含 4 个状态", () => {
      expect(Object.keys(CHECK_RESULT_STATUS_CONFIG)).toHaveLength(4);
    });

    it("所有兜底配置应有 iconKey='unknown'", () => {
      expect(SEVERITY_FALLBACK.iconKey).toBe("unknown");
      expect(FINDING_STATUS_FALLBACK.iconKey).toBe("unknown");
      expect(CHECK_RESULT_STATUS_FALLBACK.iconKey).toBe("unknown");
    });

    it("所有兜底配置应有 label='未知'", () => {
      expect(SEVERITY_FALLBACK.label).toBe("未知");
      expect(FINDING_STATUS_FALLBACK.label).toBe("未知");
      expect(CHECK_RESULT_STATUS_FALLBACK.label).toBe("未知");
    });
  });
});
