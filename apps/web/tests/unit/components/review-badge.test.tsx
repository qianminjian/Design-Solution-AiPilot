import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  SeverityBadge,
  FindingStatusBadge,
  CheckResultStatusBadge,
} from "@/components/review/review-badge";
import {
  getSeverityConfig,
  getFindingStatusConfig,
  getCheckResultStatusConfig,
  isKnownSeverity,
  isKnownFindingStatus,
  isKnownCheckResultStatus,
  SEVERITY_CONFIG,
  FINDING_STATUS_CONFIG,
  CHECK_RESULT_STATUS_CONFIG,
  SEVERITY_FALLBACK,
  FINDING_STATUS_FALLBACK,
  CHECK_RESULT_STATUS_FALLBACK,
  type FindingSeverity,
  type FindingStatus,
  type CheckResultStatus,
} from "@/components/review/review-config";

describe("review-config", () => {
  describe("getSeverityConfig", () => {
    it("已知枚举值应返回对应配置", () => {
      expect(getSeverityConfig("critical")).toEqual({
        label: "严重",
        color: "red",
        iconKey: "critical",
        bgColor: "#fff1f0",
      });
      expect(getSeverityConfig("high").label).toBe("高");
      expect(getSeverityConfig("medium").label).toBe("中");
      expect(getSeverityConfig("low").label).toBe("低");
    });

    it("未知枚举值应返回兜底配置", () => {
      const config = getSeverityConfig("blocker" as unknown as FindingSeverity);
      expect(config.label).toBe("未知");
      expect(config.color).toBe("default");
      expect(config.iconKey).toBe("unknown");
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getSeverityConfig(null).label).toBe("未知");
      expect(getSeverityConfig(undefined).label).toBe("未知");
    });

    it("空字符串应返回兜底配置", () => {
      expect(getSeverityConfig("").label).toBe("未知");
    });
  });

  describe("getFindingStatusConfig", () => {
    it("已知状态应返回对应配置", () => {
      expect(getFindingStatusConfig("pending").label).toBe("待处理");
      expect(getFindingStatusConfig("approved").label).toBe("已批准");
      expect(getFindingStatusConfig("rejected").label).toBe("已拒绝");
      expect(getFindingStatusConfig("resolved").label).toBe("已解决");
    });

    it("未知状态应返回兜底配置", () => {
      const config = getFindingStatusConfig(
        "archived" as unknown as FindingStatus,
      );
      expect(config.label).toBe("未知");
      expect(config.color).toBe("default");
      expect(config.iconKey).toBe("unknown");
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getFindingStatusConfig(null).iconKey).toBe("unknown");
      expect(getFindingStatusConfig(undefined).iconKey).toBe("unknown");
    });
  });

  describe("getCheckResultStatusConfig", () => {
    it("已知状态应返回对应配置", () => {
      expect(getCheckResultStatusConfig("passed").label).toBe("通过");
      expect(getCheckResultStatusConfig("failed").label).toBe("失败");
      expect(getCheckResultStatusConfig("partial").label).toBe("部分通过");
      expect(getCheckResultStatusConfig("running").label).toBe("运行中");
    });

    it("未知状态应返回兜底配置", () => {
      expect(
        getCheckResultStatusConfig("skipped" as unknown as CheckResultStatus)
          .label,
      ).toBe("未知");
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getCheckResultStatusConfig(null).label).toBe("未知");
      expect(getCheckResultStatusConfig(undefined).label).toBe("未知");
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
      expect(isKnownFindingStatus("archived")).toBe(false);
      expect(isKnownFindingStatus(null)).toBe(false);
    });

    it("isKnownCheckResultStatus 应正确判断", () => {
      expect(isKnownCheckResultStatus("passed")).toBe(true);
      expect(isKnownCheckResultStatus("running")).toBe(true);
      expect(isKnownCheckResultStatus("skipped")).toBe(false);
      expect(isKnownCheckResultStatus(undefined)).toBe(false);
    });
  });

  describe("配置常量完整性", () => {
    it("SEVERITY_CONFIG 应包含 4 个严重级别", () => {
      expect(Object.keys(SEVERITY_CONFIG).length).toBe(4);
      expect(Object.keys(SEVERITY_CONFIG).sort()).toEqual(
        ["critical", "high", "low", "medium"].sort(),
      );
    });

    it("FINDING_STATUS_CONFIG 应包含 4 个状态", () => {
      expect(Object.keys(FINDING_STATUS_CONFIG).length).toBe(4);
      expect(Object.keys(FINDING_STATUS_CONFIG).sort()).toEqual(
        ["approved", "pending", "rejected", "resolved"].sort(),
      );
    });

    it("CHECK_RESULT_STATUS_CONFIG 应包含 4 个状态", () => {
      expect(Object.keys(CHECK_RESULT_STATUS_CONFIG).length).toBe(4);
      expect(Object.keys(CHECK_RESULT_STATUS_CONFIG).sort()).toEqual(
        ["failed", "partial", "passed", "running"].sort(),
      );
    });

    it("兜底配置应使用 iconKey=unknown", () => {
      expect(SEVERITY_FALLBACK.iconKey).toBe("unknown");
      expect(FINDING_STATUS_FALLBACK.iconKey).toBe("unknown");
      expect(CHECK_RESULT_STATUS_FALLBACK.iconKey).toBe("unknown");
    });
  });
});

describe("review-badge 组件渲染", () => {
  describe("SeverityBadge", () => {
    it("已知严重级别应渲染对应标签", () => {
      render(<SeverityBadge value="critical" />);
      expect(screen.getByText("严重")).toBeDefined();
    });

    it("未知严重级别应渲染兜底标签（不崩溃）", () => {
      render(<SeverityBadge value={"blocker" as unknown as FindingSeverity} />);
      expect(screen.getByText("未知")).toBeDefined();
    });

    it("null 应渲染兜底标签", () => {
      render(<SeverityBadge value={null} />);
      expect(screen.getByText("未知")).toBeDefined();
    });

    it("undefined 应渲染兜底标签", () => {
      render(<SeverityBadge value={undefined} />);
      expect(screen.getByText("未知")).toBeDefined();
    });
  });

  describe("FindingStatusBadge", () => {
    it("已知状态应渲染对应标签", () => {
      render(<FindingStatusBadge value="approved" />);
      expect(screen.getByText("已批准")).toBeDefined();
    });

    it("未知状态应渲染兜底标签（不崩溃）", () => {
      render(
        <FindingStatusBadge value={"archived" as unknown as FindingStatus} />,
      );
      expect(screen.getByText("未知")).toBeDefined();
    });

    it("null 应渲染兜底标签", () => {
      render(<FindingStatusBadge value={null} />);
      expect(screen.getByText("未知")).toBeDefined();
    });
  });

  describe("CheckResultStatusBadge", () => {
    it("已知状态应渲染对应标签", () => {
      render(<CheckResultStatusBadge value="passed" />);
      expect(screen.getByText("通过")).toBeDefined();
    });

    it("未知状态应渲染兜底标签（不崩溃）", () => {
      render(
        <CheckResultStatusBadge
          value={"skipped" as unknown as CheckResultStatus}
        />,
      );
      expect(screen.getByText("未知")).toBeDefined();
    });

    it("undefined 应渲染兜底标签", () => {
      render(<CheckResultStatusBadge value={undefined} />);
      expect(screen.getByText("未知")).toBeDefined();
    });
  });
});
