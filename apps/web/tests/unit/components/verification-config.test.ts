/**
 * verification-config 单元测试
 *
 * 覆盖：
 * - RISK_CONFIG / STATUS_CONFIG / TYPE_CONFIG 完整性
 * - RISK_FALLBACK / STATUS_FALLBACK / TYPE_FALLBACK 兜底配置
 * - getRiskConfig / getStatusConfig / getTypeConfig 安全访问
 * - isKnownRiskLevel / isKnownStatus / isKnownType 类型守卫
 * - RISK_OPTIONS / TYPE_OPTIONS 选项列表
 *
 * 权威源：.trae/rules/security.md §12 AI 安全红线（前端兜底）
 */
import { describe, it, expect } from "vitest";

import {
  RISK_CONFIG,
  RISK_FALLBACK,
  STATUS_CONFIG,
  STATUS_FALLBACK,
  TYPE_CONFIG,
  TYPE_FALLBACK,
  RISK_OPTIONS,
  TYPE_OPTIONS,
  getRiskConfig,
  getStatusConfig,
  getTypeConfig,
  isKnownRiskLevel,
  isKnownStatus,
  isKnownType,
  type RiskLevel,
  type VerificationStatus,
  type VerificationType,
} from "@/components/verification/verification-config";

describe("RISK_CONFIG", () => {
  it("应包含 4 个风险等级", () => {
    expect(Object.keys(RISK_CONFIG)).toHaveLength(4);
  });

  it("LOW 应为绿色低风险", () => {
    expect(RISK_CONFIG.LOW).toEqual({ label: "低", color: "green" });
  });

  it("MEDIUM 应为橙色中等风险", () => {
    expect(RISK_CONFIG.MEDIUM).toEqual({ label: "中", color: "orange" });
  });

  it("HIGH 应为红色高风险", () => {
    expect(RISK_CONFIG.HIGH).toEqual({ label: "高", color: "red" });
  });

  it("CRITICAL 应为洋红严重风险", () => {
    expect(RISK_CONFIG.CRITICAL).toEqual({ label: "严重", color: "magenta" });
  });

  it("RISK_FALLBACK 应为未评估默认色", () => {
    expect(RISK_FALLBACK).toEqual({ label: "未评估", color: "default" });
  });
});

describe("STATUS_CONFIG", () => {
  it("应包含 4 个验证状态", () => {
    expect(Object.keys(STATUS_CONFIG)).toHaveLength(4);
  });

  it("PENDING 应为待验证默认色", () => {
    expect(STATUS_CONFIG.PENDING).toEqual({
      label: "待验证",
      color: "default",
      iconKey: "pending",
    });
  });

  it("PASSED 应为通过 success 色", () => {
    expect(STATUS_CONFIG.PASSED).toEqual({
      label: "通过",
      color: "success",
      iconKey: "passed",
    });
  });

  it("FAILED 应为未通过 error 色", () => {
    expect(STATUS_CONFIG.FAILED).toEqual({
      label: "未通过",
      color: "error",
      iconKey: "failed",
    });
  });

  it("WAIVED 应为豁免 warning 色", () => {
    expect(STATUS_CONFIG.WAIVED).toEqual({
      label: "豁免",
      color: "warning",
      iconKey: "waived",
    });
  });

  it("STATUS_FALLBACK 应为未知默认色", () => {
    expect(STATUS_FALLBACK).toEqual({
      label: "未知",
      color: "default",
      iconKey: "unknown",
    });
  });
});

describe("TYPE_CONFIG", () => {
  it("应包含 2 个验证类型", () => {
    expect(Object.keys(TYPE_CONFIG)).toHaveLength(2);
  });

  it("MANUAL 应为手动验证蓝色", () => {
    expect(TYPE_CONFIG.MANUAL).toEqual({ label: "手动验证", color: "blue" });
  });

  it("AUTOMATED 应为自动验证青色", () => {
    expect(TYPE_CONFIG.AUTOMATED).toEqual({ label: "自动验证", color: "cyan" });
  });

  it("TYPE_FALLBACK 应为未知默认色", () => {
    expect(TYPE_FALLBACK).toEqual({ label: "未知", color: "default" });
  });
});

describe("RISK_OPTIONS / TYPE_OPTIONS", () => {
  it("RISK_OPTIONS 应包含 4 个选项", () => {
    expect(RISK_OPTIONS).toHaveLength(4);
    expect(RISK_OPTIONS.map((o) => o.value)).toEqual([
      "LOW",
      "MEDIUM",
      "HIGH",
      "CRITICAL",
    ]);
  });

  it("TYPE_OPTIONS 应包含 2 个选项", () => {
    expect(TYPE_OPTIONS).toHaveLength(2);
    expect(TYPE_OPTIONS.map((o) => o.value)).toEqual(["MANUAL", "AUTOMATED"]);
  });

  it("RISK_OPTIONS value 应为 RiskLevel 类型", () => {
    for (const opt of RISK_OPTIONS) {
      // 类型层面验证：赋值给 RiskLevel 变量应通过
      const _: RiskLevel = opt.value;
      expect(_).toBeDefined();
    }
  });

  it("TYPE_OPTIONS value 应为 VerificationType 类型", () => {
    for (const opt of TYPE_OPTIONS) {
      const _: VerificationType = opt.value;
      expect(_).toBeDefined();
    }
  });
});

describe("getRiskConfig", () => {
  it("LOW 应返回 LOW 配置", () => {
    expect(getRiskConfig("LOW")).toEqual(RISK_CONFIG.LOW);
  });

  it("CRITICAL 应返回 CRITICAL 配置", () => {
    expect(getRiskConfig("CRITICAL")).toEqual(RISK_CONFIG.CRITICAL);
  });

  it("未知字符串应返回 RISK_FALLBACK", () => {
    expect(getRiskConfig("UNKNOWN_LEVEL")).toEqual(RISK_FALLBACK);
  });

  it("undefined 应返回 RISK_FALLBACK", () => {
    expect(getRiskConfig(undefined)).toEqual(RISK_FALLBACK);
  });

  it("null 应返回 RISK_FALLBACK", () => {
    expect(getRiskConfig(null)).toEqual(RISK_FALLBACK);
  });

  it("空字符串应返回 RISK_FALLBACK", () => {
    expect(getRiskConfig("")).toEqual(RISK_FALLBACK);
  });
});

describe("getStatusConfig", () => {
  it("PENDING 应返回 PENDING 配置", () => {
    expect(getStatusConfig("PENDING")).toEqual(STATUS_CONFIG.PENDING);
  });

  it("PASSED 应返回 PASSED 配置", () => {
    expect(getStatusConfig("PASSED")).toEqual(STATUS_CONFIG.PASSED);
  });

  it("未知字符串应返回 STATUS_FALLBACK", () => {
    expect(getStatusConfig("UNKNOWN_STATUS")).toEqual(STATUS_FALLBACK);
  });

  it("undefined 应返回 STATUS_FALLBACK", () => {
    expect(getStatusConfig(undefined)).toEqual(STATUS_FALLBACK);
  });

  it("null 应返回 STATUS_FALLBACK", () => {
    expect(getStatusConfig(null)).toEqual(STATUS_FALLBACK);
  });
});

describe("getTypeConfig", () => {
  it("MANUAL 应返回 MANUAL 配置", () => {
    expect(getTypeConfig("MANUAL")).toEqual(TYPE_CONFIG.MANUAL);
  });

  it("AUTOMATED 应返回 AUTOMATED 配置", () => {
    expect(getTypeConfig("AUTOMATED")).toEqual(TYPE_CONFIG.AUTOMATED);
  });

  it("未知字符串应返回 TYPE_FALLBACK", () => {
    expect(getTypeConfig("UNKNOWN_TYPE")).toEqual(TYPE_FALLBACK);
  });

  it("undefined 应返回 TYPE_FALLBACK", () => {
    expect(getTypeConfig(undefined)).toEqual(TYPE_FALLBACK);
  });

  it("null 应返回 TYPE_FALLBACK", () => {
    expect(getTypeConfig(null)).toEqual(TYPE_FALLBACK);
  });
});

describe("isKnownRiskLevel", () => {
  it("已知 4 个等级应返回 true", () => {
    expect(isKnownRiskLevel("LOW")).toBe(true);
    expect(isKnownRiskLevel("MEDIUM")).toBe(true);
    expect(isKnownRiskLevel("HIGH")).toBe(true);
    expect(isKnownRiskLevel("CRITICAL")).toBe(true);
  });

  it("未知字符串应返回 false", () => {
    expect(isKnownRiskLevel("UNKNOWN_LEVEL")).toBe(false);
  });

  it("undefined / null / 空串应返回 false", () => {
    expect(isKnownRiskLevel(undefined)).toBe(false);
    expect(isKnownRiskLevel(null)).toBe(false);
    expect(isKnownRiskLevel("")).toBe(false);
  });

  it("应作为类型守卫收窄为 RiskLevel", () => {
    const value: RiskLevel | string | undefined = "HIGH";
    if (isKnownRiskLevel(value)) {
      // 类型层面：value 应收窄为 RiskLevel
      const _: RiskLevel = value;
      expect(_).toBe("HIGH");
    } else {
      throw new Error("应进入已知分支");
    }
  });
});

describe("isKnownStatus", () => {
  it("已知 4 个状态应返回 true", () => {
    expect(isKnownStatus("PENDING")).toBe(true);
    expect(isKnownStatus("PASSED")).toBe(true);
    expect(isKnownStatus("FAILED")).toBe(true);
    expect(isKnownStatus("WAIVED")).toBe(true);
  });

  it("未知字符串应返回 false", () => {
    expect(isKnownStatus("UNKNOWN_STATUS")).toBe(false);
  });

  it("undefined / null / 空串应返回 false", () => {
    expect(isKnownStatus(undefined)).toBe(false);
    expect(isKnownStatus(null)).toBe(false);
    expect(isKnownStatus("")).toBe(false);
  });

  it("应作为类型守卫收窄为 VerificationStatus", () => {
    const value: VerificationStatus | string | undefined = "PASSED";
    if (isKnownStatus(value)) {
      const _: VerificationStatus = value;
      expect(_).toBe("PASSED");
    } else {
      throw new Error("应进入已知分支");
    }
  });
});

describe("isKnownType", () => {
  it("已知 2 个类型应返回 true", () => {
    expect(isKnownType("MANUAL")).toBe(true);
    expect(isKnownType("AUTOMATED")).toBe(true);
  });

  it("未知字符串应返回 false", () => {
    expect(isKnownType("UNKNOWN_TYPE")).toBe(false);
  });

  it("undefined / null / 空串应返回 false", () => {
    expect(isKnownType(undefined)).toBe(false);
    expect(isKnownType(null)).toBe(false);
    expect(isKnownType("")).toBe(false);
  });

  it("应作为类型守卫收窄为 VerificationType", () => {
    const value: VerificationType | string | undefined = "MANUAL";
    if (isKnownType(value)) {
      const _: VerificationType = value;
      expect(_).toBe("MANUAL");
    } else {
      throw new Error("应进入已知分支");
    }
  });
});
