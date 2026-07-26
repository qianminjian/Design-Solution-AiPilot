import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataErrorAlert } from "@/components/common/data-error-alert";
import { ApiError } from "@/lib/api-client";
import { ResponseValidationError } from "@/lib/schema-validator";
import { z } from "zod";

describe("DataErrorAlert", () => {
  describe("ResponseValidationError 渲染", () => {
    function buildValidationError(
      path: string[] = ["requiresHumanReview"],
      message = "Required",
    ): ResponseValidationError {
      const zodError = new z.ZodError([
        {
          code: "invalid_type",
          expected: "boolean",
          received: "undefined",
          path,
          message,
        },
      ]);
      return new ResponseValidationError("useTest.context", zodError);
    }

    it("inline 模式应渲染数据格式异常标题", () => {
      render(
        <DataErrorAlert error={buildValidationError()} context="AI 生成记录" />,
      );

      expect(screen.getByText("数据格式异常")).toBeDefined();
    });

    it("inline 模式应渲染 schema 失败字段详情", () => {
      render(
        <DataErrorAlert
          error={buildValidationError(["riskLevel"], "invalid enum value")}
          context="AI 生成记录"
        />,
      );

      expect(screen.getByText(/riskLevel=invalid enum value/)).toBeDefined();
      expect(screen.getByText(/useTest\.context/)).toBeDefined();
    });

    it("inline 模式应提示联系管理员排查契约漂移", () => {
      render(
        <DataErrorAlert error={buildValidationError()} context="AI 生成记录" />,
      );

      expect(screen.getByText(/联系管理员排查/)).toBeDefined();
    });

    it("result 模式应渲染数据格式异常标题", () => {
      render(
        <DataErrorAlert
          error={buildValidationError()}
          context="AI 生成记录"
          variant="result"
        />,
      );

      expect(screen.getByText("数据格式异常")).toBeDefined();
    });
  });

  describe("ApiError 渲染", () => {
    function buildApiError(status: number, errorCode: string): ApiError {
      return new ApiError({
        code: status,
        status,
        errorCode,
        title: "API Error",
        detail: `${errorCode} occurred`,
        correlationId: "trace-abc-123",
        retryable: false,
      });
    }

    it("404 错误应显示不存在标题", () => {
      render(
        <DataErrorAlert
          error={buildApiError(404, "PROJECT_NOT_FOUND")}
          context="项目"
        />,
      );

      expect(screen.getByText("项目不存在")).toBeDefined();
    });

    it("403 错误应显示无权访问标题", () => {
      render(
        <DataErrorAlert
          error={buildApiError(403, "FORBIDDEN")}
          context="项目"
        />,
      );

      expect(screen.getByText("无权访问")).toBeDefined();
    });

    it("500 错误应显示加载失败标题", () => {
      render(
        <DataErrorAlert
          error={buildApiError(500, "INTERNAL_ERROR")}
          context="项目"
        />,
      );

      expect(screen.getByText("项目加载失败")).toBeDefined();
    });

    it("应渲染 errorCode 与 status 详情", () => {
      render(
        <DataErrorAlert
          error={buildApiError(500, "INTERNAL_ERROR")}
          context="项目"
        />,
      );

      expect(screen.getByText(/errorCode=INTERNAL_ERROR/)).toBeDefined();
      expect(screen.getByText(/status=500/)).toBeDefined();
      expect(screen.getByText(/traceId=trace-abc-123/)).toBeDefined();
    });

    it("result 模式 404 应使用 404 状态图标", () => {
      const { container } = render(
        <DataErrorAlert
          error={buildApiError(404, "PROJECT_NOT_FOUND")}
          context="项目"
          variant="result"
        />,
      );

      // antd Result 404 状态会渲染特定图标
      expect(container.querySelector(".ant-result-404")).toBeDefined();
    });
  });

  describe("普通 Error 渲染", () => {
    it("应渲染加载失败标题与 error.message", () => {
      render(
        <DataErrorAlert
          error={new Error("network timeout")}
          context="项目列表"
        />,
      );

      expect(screen.getByText("项目列表加载失败")).toBeDefined();
      expect(screen.getByText("network timeout")).toBeDefined();
    });

    it("无 message 的 Error 应显示通用提示", () => {
      const err = new Error();
      render(<DataErrorAlert error={err} context="项目列表" />);

      expect(screen.getByText("项目列表加载失败")).toBeDefined();
      expect(screen.getByText("请稍后重试")).toBeDefined();
    });
  });

  describe("未知错误类型", () => {
    it("应渲染通用加载失败提示", () => {
      render(<DataErrorAlert error="some string" context="项目列表" />);

      expect(screen.getByText("项目列表加载失败")).toBeDefined();
      expect(screen.getByText("请稍后重试")).toBeDefined();
    });

    it("null 错误也应正常渲染", () => {
      render(<DataErrorAlert error={null} context="项目列表" />);

      expect(screen.getByText("项目列表加载失败")).toBeDefined();
    });
  });

  describe("重试按钮", () => {
    it("提供 onRetry 时应渲染重试按钮", () => {
      const onRetry = vi.fn();
      render(
        <DataErrorAlert
          error={new Error("test")}
          onRetry={onRetry}
          variant="inline"
        />,
      );

      const button = screen.getByRole("button", { name: /重\s*试/ });
      fireEvent.click(button);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("未提供 onRetry 时不渲染重试按钮", () => {
      render(<DataErrorAlert error={new Error("test")} />);

      expect(screen.queryByRole("button", { name: /重\s*试/ })).toBeNull();
    });

    it("result 模式下也应支持重试按钮", () => {
      const onRetry = vi.fn();
      render(
        <DataErrorAlert
          error={new Error("test")}
          onRetry={onRetry}
          variant="result"
        />,
      );

      const button = screen.getByRole("button", { name: /重\s*试/ });
      fireEvent.click(button);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("支持自定义 retryLabel（如返回项目列表）", () => {
      const onRetry = vi.fn();
      render(
        <DataErrorAlert
          error={new Error("test")}
          onRetry={onRetry}
          retryLabel="返回项目列表"
          variant="result"
        />,
      );

      const button = screen.getByRole("button", { name: /返回项目列表/ });
      fireEvent.click(button);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("context 默认值", () => {
    it("未提供 context 时应使用通用「数据」描述", () => {
      render(<DataErrorAlert error={new Error("test")} />);

      expect(screen.getByText("数据加载失败")).toBeDefined();
    });
  });
});
