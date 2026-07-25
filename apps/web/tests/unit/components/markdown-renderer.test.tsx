import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownRenderer } from "@/components/ai-solution/markdown-renderer";

/**
 * MarkdownRenderer 单元测试
 *
 * 覆盖场景：
 * 1. 空内容降级展示
 * 2. 标题 / 段落 / 列表基础渲染
 * 3. GFM 表格渲染（含响应式包装）
 * 4. 代码块与行内代码渲染
 * 5. 引用块渲染
 * 6. 不解析 HTML（XSS 防护）
 */
describe("MarkdownRenderer", () => {
  it("空内容时应渲染占位文本", () => {
    render(<MarkdownRenderer content="" />);
    expect(screen.getByText("（无内容）")).toBeDefined();
  });

  it("应渲染一级标题", () => {
    render(<MarkdownRenderer content="# 建筑方案说明" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "建筑方案说明",
    );
  });

  it("应渲染段落文本", () => {
    render(<MarkdownRenderer content="这是一段普通文本描述。" />);
    expect(screen.getByText("这是一段普通文本描述。")).toBeDefined();
  });

  it("应渲染无序列表", () => {
    render(<MarkdownRenderer content={"- 项一\n- 项二\n- 项三"} />);
    expect(screen.getByText("项一")).toBeDefined();
    expect(screen.getByText("项二")).toBeDefined();
    expect(screen.getByText("项三")).toBeDefined();
  });

  it("应渲染 GFM 表格及表头单元格", () => {
    const table = `| 规范项 | 值 |
| --- | --- |
| 层数 | 12 |
| 高度 | 45m |`;
    render(<MarkdownRenderer content={table} />);
    expect(screen.getByText("规范项")).toBeDefined();
    expect(screen.getByText("值")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
    expect(screen.getByText("45m")).toBeDefined();
  });

  it("应渲染代码块", () => {
    const code = "```\nconst x = 1;\n```";
    render(<MarkdownRenderer content={code} />);
    expect(screen.getByText("const x = 1;")).toBeDefined();
  });

  it("应渲染行内代码", () => {
    render(<MarkdownRenderer content="使用 `pnpm install` 安装依赖" />);
    expect(screen.getByText("pnpm install")).toBeDefined();
  });

  it("应渲染引用块", () => {
    render(<MarkdownRenderer content="> 这是引用内容" />);
    expect(screen.getByText("这是引用内容")).toBeDefined();
  });

  it("应渲染加粗文本", () => {
    render(<MarkdownRenderer content="**重点说明**" />);
    expect(screen.getByText("重点说明")).toBeDefined();
  });

  it("应不解析原始 HTML（XSS 防护）", () => {
    // react-markdown 默认不解析 HTML，应原样输出文本而非渲染 script
    render(<MarkdownRenderer content={"<script>alert('xss')</script>"} />);
    // 脚本不应作为元素存在
    const scripts = document.querySelectorAll("script");
    // react-markdown 会把未知 HTML 当文本处理，不会真正插入 script 节点
    expect(scripts.length).toBe(0);
  });

  it("应渲染容器 className 为 ai-markdown", () => {
    const { container } = render(<MarkdownRenderer content="# 标题" />);
    expect(container.querySelector(".ai-markdown")).not.toBeNull();
  });

  it("应渲染多级标题", () => {
    render(<MarkdownRenderer content={"## 二级标题\n### 三级标题"} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(
      "二级标题",
    );
    expect(screen.getByRole("heading", { level: 3 }).textContent).toContain(
      "三级标题",
    );
  });

  it("应渲染链接", () => {
    render(<MarkdownRenderer content="[设计文档](https://example.com/doc)" />);
    const link = screen.getByRole("link", { name: "设计文档" });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("https://example.com/doc");
  });
});
