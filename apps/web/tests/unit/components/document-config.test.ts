import { describe, it, expect } from "vitest";

import {
  DOCUMENT_STATUS_CONFIG,
  DOCUMENT_STATUS_FALLBACK,
  DOCUMENT_VERSION_STATUS_CONFIG,
  DOCUMENT_VERSION_STATUS_FALLBACK,
  getDocumentStatusConfig,
  getDocumentVersionStatusConfig,
  isKnownDocumentStatus,
  isKnownDocumentVersionStatus,
  type DocumentStatus,
  type DocumentVersionStatus,
} from "@/components/cde/document-config";

/**
 * CDE 模块枚举配置与兜底函数单元测试
 *
 * 覆盖核心规则：
 *  - 已知枚举值返回对应配置（含 label/color/iconKey）
 *  - 未知枚举值返回兜底配置（label="未知"、color="default"、iconKey="unknown"）
 *  - null/undefined/空字符串均安全降级，不抛异常
 *  - 类型守卫正确识别已知/未知值
 */
describe("document-config", () => {
  describe("getDocumentStatusConfig", () => {
    it("已知文档状态应返回对应配置", () => {
      expect(getDocumentStatusConfig("DRAFT")).toEqual(
        DOCUMENT_STATUS_CONFIG.DRAFT,
      );
      expect(getDocumentStatusConfig("CHECKED_OUT")).toEqual(
        DOCUMENT_STATUS_CONFIG.CHECKED_OUT,
      );
      expect(getDocumentStatusConfig("PUBLISHED")).toEqual(
        DOCUMENT_STATUS_CONFIG.PUBLISHED,
      );
      expect(getDocumentStatusConfig("SUPERSEDED")).toEqual(
        DOCUMENT_STATUS_CONFIG.SUPERSEDED,
      );
      expect(getDocumentStatusConfig("ARCHIVED")).toEqual(
        DOCUMENT_STATUS_CONFIG.ARCHIVED,
      );
    });

    it("未知文档状态应返回兜底配置", () => {
      const config = getDocumentStatusConfig(
        "DELETED" as unknown as DocumentStatus,
      );
      expect(config.label).toBe("未知");
      expect(config.color).toBe("default");
      expect(config.iconKey).toBe("unknown");
      expect(config).toEqual(DOCUMENT_STATUS_FALLBACK);
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getDocumentStatusConfig(null)).toEqual(DOCUMENT_STATUS_FALLBACK);
      expect(getDocumentStatusConfig(undefined)).toEqual(
        DOCUMENT_STATUS_FALLBACK,
      );
    });

    it("空字符串应返回兜底配置", () => {
      expect(getDocumentStatusConfig("").label).toBe("未知");
    });
  });

  describe("getDocumentVersionStatusConfig", () => {
    it("已知版本状态应返回对应配置", () => {
      expect(getDocumentVersionStatusConfig("DRAFT")).toEqual(
        DOCUMENT_VERSION_STATUS_CONFIG.DRAFT,
      );
      expect(getDocumentVersionStatusConfig("PUBLISHED")).toEqual(
        DOCUMENT_VERSION_STATUS_CONFIG.PUBLISHED,
      );
      expect(getDocumentVersionStatusConfig("SUPERSEDED")).toEqual(
        DOCUMENT_VERSION_STATUS_CONFIG.SUPERSEDED,
      );
    });

    it("未知版本状态应返回兜底配置", () => {
      const config = getDocumentVersionStatusConfig(
        "ARCHIVED" as unknown as DocumentVersionStatus,
      );
      expect(config.label).toBe("未知");
      expect(config.iconKey).toBe("unknown");
      expect(config).toEqual(DOCUMENT_VERSION_STATUS_FALLBACK);
    });

    it("null/undefined/空字符串 应返回兜底配置", () => {
      expect(getDocumentVersionStatusConfig(null)).toEqual(
        DOCUMENT_VERSION_STATUS_FALLBACK,
      );
      expect(getDocumentVersionStatusConfig(undefined)).toEqual(
        DOCUMENT_VERSION_STATUS_FALLBACK,
      );
      expect(getDocumentVersionStatusConfig("").iconKey).toBe("unknown");
    });
  });

  describe("isKnown* 类型守卫", () => {
    it("isKnownDocumentStatus 应正确判断", () => {
      expect(isKnownDocumentStatus("DRAFT")).toBe(true);
      expect(isKnownDocumentStatus("ARCHIVED")).toBe(true);
      expect(isKnownDocumentStatus("DELETED")).toBe(false);
      expect(isKnownDocumentStatus(null)).toBe(false);
      expect(isKnownDocumentStatus(undefined)).toBe(false);
      expect(isKnownDocumentStatus("")).toBe(false);
    });

    it("isKnownDocumentVersionStatus 应正确判断", () => {
      expect(isKnownDocumentVersionStatus("DRAFT")).toBe(true);
      expect(isKnownDocumentVersionStatus("PUBLISHED")).toBe(true);
      expect(isKnownDocumentVersionStatus("SUPERSEDED")).toBe(true);
      expect(isKnownDocumentVersionStatus("ARCHIVED")).toBe(false);
      expect(isKnownDocumentVersionStatus(null)).toBe(false);
      expect(isKnownDocumentVersionStatus(undefined)).toBe(false);
    });
  });

  describe("配置对象完整性", () => {
    it("DOCUMENT_STATUS_CONFIG 应包含 5 个状态", () => {
      expect(Object.keys(DOCUMENT_STATUS_CONFIG)).toHaveLength(5);
    });

    it("DOCUMENT_VERSION_STATUS_CONFIG 应包含 3 个状态", () => {
      expect(Object.keys(DOCUMENT_VERSION_STATUS_CONFIG)).toHaveLength(3);
    });

    it("所有兜底配置应有 iconKey='unknown'", () => {
      expect(DOCUMENT_STATUS_FALLBACK.iconKey).toBe("unknown");
      expect(DOCUMENT_VERSION_STATUS_FALLBACK.iconKey).toBe("unknown");
    });

    it("所有兜底配置应有 label='未知'", () => {
      expect(DOCUMENT_STATUS_FALLBACK.label).toBe("未知");
      expect(DOCUMENT_VERSION_STATUS_FALLBACK.label).toBe("未知");
    });
  });
});
