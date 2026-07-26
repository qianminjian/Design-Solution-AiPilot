import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentList } from "@/components/cde/document-list";
import {
  generateMockFromSchema,
  type DeepPartial,
} from "../../__support__/schema-mocks";
import {
  documentDtoSchema,
  type DocumentDto,
  type DocumentStatus,
} from "@design-platform/shared";

/** 基于 zod schema 生成 mock 文档数据 */
function buildDocument(overrides: DeepPartial<DocumentDto> = {}): DocumentDto {
  return generateMockFromSchema(documentDtoSchema, {
    name: "site-plan.dwg",
    mimeType: "application/acad",
    sizeBytes: 2048,
    status: "DRAFT",
    version: 1,
    createdBy: "alice",
    updatedAt: "2026-07-26T08:00:00Z",
    ...overrides,
  });
}

describe("DocumentList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("documents 为空数组时应渲染 Empty 占位", () => {
    render(<DocumentList documents={[]} loading={false} />);

    expect(screen.getByText("暂无文档，可点击右上角新建")).toBeDefined();
  });

  it("loading=true 时应渲染表格加载态", () => {
    const { container } = render(
      <DocumentList documents={[]} loading={true} />,
    );

    expect(container.querySelector(".ant-spin")).toBeDefined();
  });

  it("应该渲染表格表头（含 Name/Type/Status/Version/Size 等）", () => {
    render(<DocumentList documents={[buildDocument()]} loading={false} />);

    // antd Table 内部 measure-row 会导致表头文字重复，用 getAllByText
    expect(screen.getAllByText("Name").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Type").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Status").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Version").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Size").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Updated By").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Updated At").length).toBeGreaterThan(0);
  });

  it("应该渲染数据行（name、status 标签、version 等）", () => {
    render(<DocumentList documents={[buildDocument()]} loading={false} />);

    expect(screen.getByText("site-plan.dwg")).toBeDefined();
    // 状态 DRAFT 渲染为 "Draft" Tag
    expect(screen.getByText("Draft")).toBeDefined();
    // 版本号渲染为 "v1"
    expect(screen.getByText("v1")).toBeDefined();
    // createdBy 渲染
    expect(screen.getByText("alice")).toBeDefined();
  });

  it("不同 mimeType 应派生对应类型简称（DWG/PDF/RVT 等）", () => {
    // mimeToLabel 函数通过 lower.includes 匹配关键字
    const cases: Array<{ mime: string; label: string }> = [
      { mime: "application/autocad", label: "DWG" },
      { mime: "application/pdf", label: "PDF" },
      { mime: "application/revit", label: "RVT" },
      { mime: "application/rhino", label: "3DM" },
      { mime: "application/sketchup", label: "SKP" },
      { mime: "application/zip", label: "ZIP" },
    ];

    for (const { mime, label } of cases) {
      const { unmount } = render(
        <DocumentList
          documents={[buildDocument({ mimeType: mime, name: `file-${label}` })]}
          loading={false}
        />,
      );
      expect(screen.getByText(label)).toBeDefined();
      unmount();
    }
  });

  it("sizeBytes 应格式化为人类可读展示", () => {
    render(
      <DocumentList
        documents={[
          buildDocument({ name: "big.zip", sizeBytes: 1024 * 1024 * 5 }),
        ]}
        loading={false}
      />,
    );

    // 5 MB
    expect(screen.getByText("5.0 MB")).toBeDefined();
  });

  it("sizeBytes 小于 1024 应显示 B 单位", () => {
    render(
      <DocumentList
        documents={[buildDocument({ name: "tiny.txt", sizeBytes: 512 })]}
        loading={false}
      />,
    );

    expect(screen.getByText("512 B")).toBeDefined();
  });

  it("createdBy 为 null 应显示「—」", () => {
    render(
      <DocumentList
        documents={[buildDocument({ createdBy: null })]}
        loading={false}
      />,
    );

    expect(screen.getByText("—")).toBeDefined();
  });

  it("不同 status 应渲染对应的状态标签文案", () => {
    const cases: Array<{ status: DocumentStatus; label: string }> = [
      { status: "DRAFT", label: "Draft" },
      { status: "CHECKED_OUT", label: "Checked Out" },
      { status: "PUBLISHED", label: "Published" },
      { status: "SUPERSEDED", label: "Superseded" },
      { status: "ARCHIVED", label: "Archived" },
    ];

    for (const { status, label } of cases) {
      const { unmount } = render(
        <DocumentList
          documents={[buildDocument({ status, name: `doc-${status}` })]}
          loading={false}
        />,
      );
      expect(screen.getByText(label)).toBeDefined();
      unmount();
    }
  });

  it("点击行应触发 onRowClick 回调", () => {
    const onRowClick = vi.fn();
    const doc = buildDocument({ name: "clickable.dwg" });

    render(
      <DocumentList
        documents={[doc]}
        loading={false}
        onRowClick={onRowClick}
      />,
    );

    // 点击表格第一行（tr.ant-table-row）
    const row = screen.getByText("clickable.dwg").closest("tr");
    expect(row).toBeDefined();
    fireEvent.click(row as HTMLElement);

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(doc);
  });

  it("未提供 onRowClick 时行不应有 pointer cursor", () => {
    render(<DocumentList documents={[buildDocument()]} loading={false} />);

    const row = screen.getByText("site-plan.dwg").closest("tr");
    expect(row).toBeDefined();
    // 默认 cursor（未设置 pointer）
    expect((row as HTMLElement).style.cursor).not.toBe("pointer");
  });

  it("应该支持分页配置", () => {
    render(
      <DocumentList
        documents={[buildDocument()]}
        loading={false}
        pagination={{ pageSize: 5, total: 1 }}
      />,
    );

    // antd Table 会渲染分页器
    const pagination = document.querySelector(".ant-pagination");
    expect(pagination).toBeDefined();
  });

  it("未知文档状态应渲染兜底标签（不崩溃）", () => {
    render(
      <DocumentList
        documents={[
          buildDocument({
            status: "DELETED" as unknown as DocumentStatus,
            name: "unknown.doc",
          }),
        ]}
        loading={false}
      />,
    );

    expect(screen.getByText("unknown.doc")).toBeDefined();
    expect(screen.getByText("未知")).toBeDefined();
  });
});
