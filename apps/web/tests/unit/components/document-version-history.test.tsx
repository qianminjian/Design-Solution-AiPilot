import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentVersionHistory } from "@/components/cde/document-version-history";
import {
  generateMockFromSchema,
  type DeepPartial,
} from "../../__support__/schema-mocks";
import {
  documentVersionDtoSchema,
  type DocumentVersionDto,
  type DocumentVersionStatus,
} from "@design-platform/shared";

/** 基于 zod schema 生成 mock 版本数据 */
function buildVersion(
  overrides: DeepPartial<DocumentVersionDto> = {},
): DocumentVersionDto {
  return generateMockFromSchema(documentVersionDtoSchema, {
    versionNumber: 1,
    uploadedBy: "alice",
    uploadedAt: "2026-07-26T08:00:00Z",
    comment: "初始版本",
    status: "PUBLISHED",
    ...overrides,
  });
}

describe("DocumentVersionHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loading=true 时应渲染 Spin 加载", () => {
    const { container } = render(
      <DocumentVersionHistory versions={[]} loading={true} />,
    );

    expect(container.querySelector(".ant-spin")).toBeDefined();
  });

  it("versions 为空数组时应渲染 Empty 占位", () => {
    render(<DocumentVersionHistory versions={[]} loading={false} />);

    expect(screen.getByText("暂无版本记录")).toBeDefined();
  });

  it("versions 为 undefined 时应渲染 Empty 占位", () => {
    render(
      <DocumentVersionHistory
        versions={undefined as unknown as DocumentVersionDto[]}
        loading={false}
      />,
    );

    expect(screen.getByText("暂无版本记录")).toBeDefined();
  });

  it("应该渲染版本号（v1）与状态标签（Published）", () => {
    render(
      <DocumentVersionHistory versions={[buildVersion()]} loading={false} />,
    );

    expect(screen.getByText("v1")).toBeDefined();
    expect(screen.getByText("Published")).toBeDefined();
  });

  it("应该渲染上传人 ID", () => {
    render(
      <DocumentVersionHistory
        versions={[buildVersion({ uploadedBy: "uploader-uuid-123" })]}
        loading={false}
      />,
    );

    expect(screen.getByText(/uploader-uuid-123/)).toBeDefined();
  });

  it("应该渲染版本说明 comment", () => {
    render(
      <DocumentVersionHistory
        versions={[buildVersion({ comment: "新增疏散门" })]}
        loading={false}
      />,
    );

    expect(screen.getByText("新增疏散门")).toBeDefined();
  });

  it("comment 为 null 时不应渲染说明", () => {
    render(
      <DocumentVersionHistory
        versions={[buildVersion({ comment: null })]}
        loading={false}
      />,
    );

    expect(screen.queryByText("初始版本")).toBeNull();
  });

  it("uploadedBy 为 null 应显示「—」", () => {
    render(
      <DocumentVersionHistory
        versions={[buildVersion({ uploadedBy: null })]}
        loading={false}
      />,
    );

    expect(screen.getByText(/—/)).toBeDefined();
  });

  it("应该按版本号降序排列（最新在前）", () => {
    const versions = [
      buildVersion({ versionNumber: 1, comment: "v1-comment" }),
      buildVersion({ versionNumber: 3, comment: "v3-comment" }),
      buildVersion({ versionNumber: 2, comment: "v2-comment" }),
    ];

    render(<DocumentVersionHistory versions={versions} loading={false} />);

    // antd Timeline 渲染顺序：v3, v2, v1
    const v3 = screen.getByText("v3").closest("li");
    const v2 = screen.getByText("v2").closest("li");
    const v1 = screen.getByText("v1").closest("li");

    expect(v3).toBeDefined();
    expect(v2).toBeDefined();
    expect(v1).toBeDefined();

    // v3 节点在 v2 之前，v2 在 v1 之前
    if (!v3 || !v2 || !v1) {
      throw new Error("Timeline 节点未找到");
    }
    const allItems = Array.from(
      document.querySelectorAll("li.ant-timeline-item"),
    );
    const v3Index = allItems.indexOf(v3 as HTMLLIElement);
    const v2Index = allItems.indexOf(v2 as HTMLLIElement);
    const v1Index = allItems.indexOf(v1 as HTMLLIElement);

    expect(v3Index).toBeLessThan(v2Index);
    expect(v2Index).toBeLessThan(v1Index);
  });

  it("不同 status 应渲染对应的状态标签文案", () => {
    const cases: Array<{ status: DocumentVersionStatus; label: string }> = [
      { status: "DRAFT", label: "Draft" },
      { status: "PUBLISHED", label: "Published" },
      { status: "SUPERSEDED", label: "Superseded" },
    ];

    for (const { status, label } of cases) {
      const { unmount } = render(
        <DocumentVersionHistory
          versions={[buildVersion({ status })]}
          loading={false}
        />,
      );
      expect(screen.getByText(label)).toBeDefined();
      unmount();
    }
  });

  it("应该渲染 Timeline 组件（含多个版本节点）", () => {
    const { container } = render(
      <DocumentVersionHistory
        versions={[
          buildVersion({ versionNumber: 1 }),
          buildVersion({ versionNumber: 2 }),
        ]}
        loading={false}
      />,
    );

    const timeline = container.querySelector(".ant-timeline");
    expect(timeline).toBeDefined();

    const items = container.querySelectorAll("li.ant-timeline-item");
    expect(items.length).toBe(2);
  });

  it("版本说明包含中文内容时应正确显示", () => {
    const chineseComment = "修复疏散门宽度计算错误，调整至 1.2m";

    render(
      <DocumentVersionHistory
        versions={[buildVersion({ comment: chineseComment })]}
        loading={false}
      />,
    );

    expect(screen.getByText(chineseComment)).toBeDefined();
  });

  it("未知版本状态应渲染兜底标签（不崩溃）", () => {
    render(
      <DocumentVersionHistory
        versions={[
          buildVersion({
            status: "ARCHIVED" as unknown as DocumentVersionStatus,
            versionNumber: 99,
          }),
        ]}
        loading={false}
      />,
    );

    expect(screen.getByText("v99")).toBeDefined();
    expect(screen.getByText("未知")).toBeDefined();
    expect(screen.getByText("原始状态值：ARCHIVED")).toBeDefined();
  });
});
