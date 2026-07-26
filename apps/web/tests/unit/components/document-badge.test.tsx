import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  DocumentStatusBadge,
  DocumentVersionStatusBadge,
} from "@/components/cde/document-badge";
import {
  getDocumentStatusConfig,
  getDocumentVersionStatusConfig,
  isKnownDocumentStatus,
  isKnownDocumentVersionStatus,
  DOCUMENT_STATUS_CONFIG,
  DOCUMENT_VERSION_STATUS_CONFIG,
  DOCUMENT_STATUS_FALLBACK,
  DOCUMENT_VERSION_STATUS_FALLBACK,
  type DocumentStatus,
  type DocumentVersionStatus,
} from "@/components/cde/document-config";

describe("document-config", () => {
  describe("getDocumentStatusConfig", () => {
    it("已知枚举值应返回对应配置", () => {
      expect(getDocumentStatusConfig("DRAFT").label).toBe("Draft");
      expect(getDocumentStatusConfig("CHECKED_OUT").label).toBe("Checked Out");
      expect(getDocumentStatusConfig("PUBLISHED").label).toBe("Published");
      expect(getDocumentStatusConfig("SUPERSEDED").label).toBe("Superseded");
      expect(getDocumentStatusConfig("ARCHIVED").label).toBe("Archived");
    });

    it("未知枚举值应返回兜底配置", () => {
      const config = getDocumentStatusConfig(
        "DELETED" as unknown as DocumentStatus,
      );
      expect(config.label).toBe("未知");
      expect(config.color).toBe("default");
      expect(config.iconKey).toBe("unknown");
    });

    it("null/undefined/空字符串应返回兜底配置", () => {
      expect(getDocumentStatusConfig(null).label).toBe("未知");
      expect(getDocumentStatusConfig(undefined).label).toBe("未知");
      expect(getDocumentStatusConfig("").label).toBe("未知");
    });
  });

  describe("getDocumentVersionStatusConfig", () => {
    it("已知枚举值应返回对应配置", () => {
      expect(getDocumentVersionStatusConfig("DRAFT").label).toBe("Draft");
      expect(getDocumentVersionStatusConfig("PUBLISHED").label).toBe(
        "Published",
      );
      expect(getDocumentVersionStatusConfig("SUPERSEDED").label).toBe(
        "Superseded",
      );
    });

    it("未知枚举值应返回兜底配置", () => {
      const config = getDocumentVersionStatusConfig(
        "ARCHIVED" as unknown as DocumentVersionStatus,
      );
      expect(config.label).toBe("未知");
      expect(config.iconKey).toBe("unknown");
    });

    it("null/undefined 应返回兜底配置", () => {
      expect(getDocumentVersionStatusConfig(null).label).toBe("未知");
      expect(getDocumentVersionStatusConfig(undefined).label).toBe("未知");
    });
  });

  describe("类型守卫函数", () => {
    it("isKnownDocumentStatus 应正确识别", () => {
      expect(isKnownDocumentStatus("DRAFT")).toBe(true);
      expect(isKnownDocumentStatus("DELETED")).toBe(false);
      expect(isKnownDocumentStatus(null)).toBe(false);
      expect(isKnownDocumentStatus(undefined)).toBe(false);
    });

    it("isKnownDocumentVersionStatus 应正确识别", () => {
      expect(isKnownDocumentVersionStatus("PUBLISHED")).toBe(true);
      expect(isKnownDocumentVersionStatus("ARCHIVED")).toBe(false);
      expect(isKnownDocumentVersionStatus(null)).toBe(false);
    });
  });

  describe("配置表完整性", () => {
    it("DOCUMENT_STATUS_CONFIG 应覆盖所有 DocumentStatus 枚举（5 个）", () => {
      const statuses: DocumentStatus[] = [
        "DRAFT",
        "CHECKED_OUT",
        "PUBLISHED",
        "SUPERSEDED",
        "ARCHIVED",
      ];
      expect(Object.keys(DOCUMENT_STATUS_CONFIG).length).toBe(statuses.length);
      statuses.forEach((s) => {
        expect(DOCUMENT_STATUS_CONFIG[s]).toBeDefined();
      });
    });

    it("DOCUMENT_VERSION_STATUS_CONFIG 应覆盖所有 DocumentVersionStatus 枚举（3 个）", () => {
      const statuses: DocumentVersionStatus[] = [
        "DRAFT",
        "PUBLISHED",
        "SUPERSEDED",
      ];
      expect(Object.keys(DOCUMENT_VERSION_STATUS_CONFIG).length).toBe(
        statuses.length,
      );
      statuses.forEach((s) => {
        expect(DOCUMENT_VERSION_STATUS_CONFIG[s]).toBeDefined();
      });
    });

    it("所有 FALLBACK 配置应以 unknown 为 iconKey", () => {
      expect(DOCUMENT_STATUS_FALLBACK.iconKey).toBe("unknown");
      expect(DOCUMENT_VERSION_STATUS_FALLBACK.iconKey).toBe("unknown");
    });
  });
});

describe("document-badge 组件", () => {
  describe("DocumentStatusBadge", () => {
    it("已知状态应渲染对应标签", () => {
      render(<DocumentStatusBadge value="PUBLISHED" />);
      expect(screen.getByText("Published")).toBeDefined();
    });

    it("未知状态应渲染兜底标签（不崩溃）", () => {
      render(
        <DocumentStatusBadge value={"DELETED" as unknown as DocumentStatus} />,
      );
      expect(screen.getByText("未知")).toBeDefined();
    });

    it("null 应渲染兜底标签", () => {
      render(<DocumentStatusBadge value={null} />);
      expect(screen.getByText("未知")).toBeDefined();
    });

    it("undefined 应渲染兜底标签", () => {
      render(<DocumentStatusBadge value={undefined} />);
      expect(screen.getByText("未知")).toBeDefined();
    });
  });

  describe("DocumentVersionStatusBadge", () => {
    it("已知状态应渲染对应标签", () => {
      render(<DocumentVersionStatusBadge value="PUBLISHED" />);
      expect(screen.getByText("Published")).toBeDefined();
    });

    it("未知状态应渲染兜底标签（不崩溃）", () => {
      render(
        <DocumentVersionStatusBadge
          value={"ARCHIVED" as unknown as DocumentVersionStatus}
        />,
      );
      expect(screen.getByText("未知")).toBeDefined();
    });

    it("null 应渲染兜底标签", () => {
      render(<DocumentVersionStatusBadge value={null} />);
      expect(screen.getByText("未知")).toBeDefined();
    });
  });
});
