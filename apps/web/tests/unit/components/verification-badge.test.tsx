import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  RiskLevelBadge,
  VerificationStatusBadge,
  VerificationTypeBadge,
} from "@/components/verification/verification-badge";
import {
  getRiskConfig,
  getStatusConfig,
  getTypeConfig,
  isKnownRiskLevel,
  isKnownStatus,
  isKnownType,
  RISK_OPTIONS,
  TYPE_OPTIONS,
  type RiskLevel,
  type VerificationStatus,
  type VerificationType,
} from "@/components/verification/verification-config";

describe("verification-config", () => {
  describe("getRiskConfig", () => {
    it("已知枚举值应返回对应配置", () => {
      expect(getRiskConfig("LOW")).toEqual({ label: "低", color: "green" });
      expect(getRiskConfig("MEDIUM")).toEqual({
        label: "中",
        color: "orange",
      });
      expect(getRiskConfig("HIGH")).toEqual({ label: "高", color: "red" });
      expect(getRiskConfig("CRITICAL")).toEqual({
        label: "严重",
        color: "magenta",
      });
    });

    it("未知枚举值应返回兜底配置", () => {
      const config = getRiskConfig("EXTREME" as unknown as RiskLevel);
      expect(config.label).toBe("未评估");
      expect(config.color).toBe("default");
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getRiskConfig(null).label).toBe("未评估");
      expect(getRiskConfig(undefined).label).toBe("未评估");
    });

    it("空字符串应返回兜底配置", () => {
      expect(getRiskConfig("").label).toBe("未评估");
    });
  });

  describe("getStatusConfig", () => {
    it("已知状态应返回对应配置（含 iconKey）", () => {
      expect(getStatusConfig("PENDING").iconKey).toBe("pending");
      expect(getStatusConfig("PASSED").iconKey).toBe("passed");
      expect(getStatusConfig("FAILED").iconKey).toBe("failed");
      expect(getStatusConfig("WAIVED").iconKey).toBe("waived");
    });

    it("未知状态应返回兜底配置", () => {
      const config = getStatusConfig(
        "ARCHIVED" as unknown as VerificationStatus,
      );
      expect(config.label).toBe("未知");
      expect(config.color).toBe("default");
      expect(config.iconKey).toBe("unknown");
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getStatusConfig(null).iconKey).toBe("unknown");
      expect(getStatusConfig(undefined).iconKey).toBe("unknown");
    });
  });

  describe("getTypeConfig", () => {
    it("已知类型应返回对应配置", () => {
      expect(getTypeConfig("MANUAL").label).toBe("手动验证");
      expect(getTypeConfig("AUTOMATED").label).toBe("自动验证");
    });

    it("未知类型应返回兜底配置", () => {
      expect(
        getTypeConfig("SEMI_AUTOMATED" as unknown as VerificationType).label,
      ).toBe("未知");
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getTypeConfig(null).label).toBe("未知");
      expect(getTypeConfig(undefined).label).toBe("未知");
    });
  });

  describe("isKnown* 类型守卫", () => {
    it("isKnownRiskLevel 应正确判断", () => {
      expect(isKnownRiskLevel("LOW")).toBe(true);
      expect(isKnownRiskLevel("CRITICAL")).toBe(true);
      expect(isKnownRiskLevel("EXTREME")).toBe(false);
      expect(isKnownRiskLevel(null)).toBe(false);
      expect(isKnownRiskLevel(undefined)).toBe(false);
      expect(isKnownRiskLevel("")).toBe(false);
    });

    it("isKnownStatus 应正确判断", () => {
      expect(isKnownStatus("PASSED")).toBe(true);
      expect(isKnownStatus("ARCHIVED")).toBe(false);
      expect(isKnownStatus(null)).toBe(false);
    });

    it("isKnownType 应正确判断", () => {
      expect(isKnownType("MANUAL")).toBe(true);
      expect(isKnownType("SEMI_AUTOMATED")).toBe(false);
      expect(isKnownType(undefined)).toBe(false);
    });
  });

  describe("Form 选项", () => {
    it("RISK_OPTIONS 应包含全部 4 个等级", () => {
      expect(RISK_OPTIONS).toHaveLength(4);
      const values = RISK_OPTIONS.map((o) => o.value);
      expect(values).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
    });

    it("TYPE_OPTIONS 应包含全部 2 个类型", () => {
      expect(TYPE_OPTIONS).toHaveLength(2);
      const values = TYPE_OPTIONS.map((o) => o.value);
      expect(values).toEqual(["MANUAL", "AUTOMATED"]);
    });
  });
});

describe("verification-badge 组件渲染", () => {
  describe("RiskLevelBadge", () => {
    it("已知风险等级应渲染对应标签", () => {
      render(<RiskLevelBadge value="HIGH" />);
      expect(screen.getByText("高")).toBeDefined();
    });

    it("未知风险等级应渲染兜底标签（不崩溃）", () => {
      render(<RiskLevelBadge value={"EXTREME" as unknown as RiskLevel} />);
      expect(screen.getByText("未评估")).toBeDefined();
    });

    it("null 应渲染兜底标签", () => {
      render(<RiskLevelBadge value={null} />);
      expect(screen.getByText("未评估")).toBeDefined();
    });

    it("undefined 应渲染兜底标签", () => {
      render(<RiskLevelBadge value={undefined} />);
      expect(screen.getByText("未评估")).toBeDefined();
    });
  });

  describe("VerificationStatusBadge", () => {
    it("已知状态应渲染对应标签与图标", () => {
      const { container } = render(<VerificationStatusBadge value="PASSED" />);
      expect(screen.getByText("通过")).toBeDefined();
      // 状态标签应渲染图标（anticon）
      expect(container.querySelector(".anticon")).not.toBeNull();
    });

    it("未知状态应渲染兜底标签（不崩溃）", () => {
      render(
        <VerificationStatusBadge
          value={"ARCHIVED" as unknown as VerificationStatus}
        />,
      );
      expect(screen.getByText("未知")).toBeDefined();
    });

    it("null 应渲染兜底标签", () => {
      render(<VerificationStatusBadge value={null} />);
      expect(screen.getByText("未知")).toBeDefined();
    });
  });

  describe("VerificationTypeBadge", () => {
    it("已知类型应渲染对应标签", () => {
      render(<VerificationTypeBadge value="MANUAL" />);
      expect(screen.getByText("手动验证")).toBeDefined();
    });

    it("未知类型应渲染兜底标签（不崩溃）", () => {
      render(
        <VerificationTypeBadge
          value={"SEMI_AUTOMATED" as unknown as VerificationType}
        />,
      );
      expect(screen.getByText("未知")).toBeDefined();
    });

    it("undefined 应渲染兜底标签", () => {
      render(<VerificationTypeBadge value={undefined} />);
      expect(screen.getByText("未知")).toBeDefined();
    });
  });
});
