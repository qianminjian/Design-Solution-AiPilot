import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Upload } from "antd";

// Mock antd App.useApp - 必须在 import DocumentUpload 之前完成
const mockMessageError = vi.fn();
const mockMessageInfo = vi.fn();
vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");
  return {
    ...actual,
    App: {
      useApp: () => ({
        message: {
          success: vi.fn(),
          error: mockMessageError,
          info: mockMessageInfo,
        },
      }),
    },
  };
});

import { DocumentUpload } from "@/components/cde/document-upload";

describe("DocumentUpload", () => {
  beforeEach(() => {
    mockMessageError.mockReset();
    mockMessageInfo.mockReset();
    vi.clearAllMocks();
  });

  it("应该渲染拖拽上传区域与说明文案", () => {
    render(<DocumentUpload projectId="p-1" />);

    // aria-label 用于定位 Dragger 容器
    expect(screen.getByLabelText("文档上传区域")).toBeDefined();
    expect(screen.getByText("点击或拖拽文件到此区域上传")).toBeDefined();
  });

  it("应该展示支持的文件格式提示", () => {
    render(<DocumentUpload projectId="p-1" />);

    expect(screen.getByText(/支持格式/)).toBeDefined();
    expect(screen.getByText(/\.rvt/)).toBeDefined();
    expect(screen.getByText(/\.dwg/)).toBeDefined();
    expect(screen.getByText(/\.pdf/)).toBeDefined();
    expect(screen.getByText(/\.zip/)).toBeDefined();
  });

  it("未提供 onUploadComplete 时不应抛错", () => {
    // 仅验证不抛错
    expect(() => render(<DocumentUpload projectId="p-1" />)).not.toThrow();
  });

  it("projectId 必填（V1 仅做占位，不阻断渲染）", () => {
    render(<DocumentUpload projectId="any-project-id" />);
    expect(screen.getByLabelText("文档上传区域")).toBeDefined();
  });

  it("Upload.LIST_IGNORE 应是 antd 导出的常量（用于拒绝非法扩展名）", () => {
    // antd 5 中 LIST_IGNORE 是一个内部 Symbol/特殊标记字符串
    expect(Upload.LIST_IGNORE).toBeDefined();
    expect(
      typeof Upload.LIST_IGNORE === "string" ||
        typeof Upload.LIST_IGNORE === "boolean",
    ).toBe(true);
  });
});
