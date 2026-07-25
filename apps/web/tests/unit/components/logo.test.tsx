import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "@/components/layout/logo";

describe("Logo", () => {
  it("应该渲染品牌名称 AI Pilot", () => {
    render(<Logo />);
    expect(screen.getByText("AI Pilot")).toBeDefined();
  });

  it("应该渲染 56px 高度的容器", () => {
    const { container } = render(<Logo />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toBeDefined();
    expect(outerDiv.style.height).toBe("56px");
  });

  it("应该包含装饰性色块（aria-hidden）", () => {
    const { container } = render(<Logo />);
    const decorativeBlock = container.querySelector("[aria-hidden='true']");
    expect(decorativeBlock).toBeDefined();
    // 装饰性色块尺寸 28x28
    expect((decorativeBlock as HTMLElement).style.width).toBe("28px");
    expect((decorativeBlock as HTMLElement).style.height).toBe("28px");
  });

  it("品牌文字应渲染为 strong 标签", () => {
    render(<Logo />);
    const text = screen.getByText("AI Pilot");
    // antd Typography Text strong 渲染为 <strong>
    expect(text.tagName).toBe("STRONG");
  });
});
