import { describe, it, expect } from "vitest";
import {
  runRequestContext,
  getRequestContext,
  getCurrentTraceId,
  type RequestContext,
} from "../../../src/infra/request-context";

/**
 * RequestContext 单元测试
 *
 * 验证：
 *  - runRequestContext 在回调内提供上下文
 *  - getRequestContext 在上下文外返回 undefined
 *  - getCurrentTraceId 在上下文外返回 "anonymous"
 *  - AsyncLocalStorage 跨 async 边界自动透传
 */
describe("RequestContext (AsyncLocalStorage)", () => {
  describe("runRequestContext", () => {
    it("回调内 getRequestContext 应返回写入的上下文", () => {
      const ctx: RequestContext = { traceId: "trace-001" };
      runRequestContext(ctx, () => {
        expect(getRequestContext()).toBe(ctx);
      });
    });

    it("回调外 getRequestContext 应返回 undefined", () => {
      expect(getRequestContext()).toBeUndefined();
      runRequestContext({ traceId: "trace-002" }, () => {
        expect(getRequestContext()?.traceId).toBe("trace-002");
      });
      expect(getRequestContext()).toBeUndefined();
    });

    it("getCurrentTraceId 在上下文外应返回 anonymous", () => {
      expect(getCurrentTraceId()).toBe("anonymous");
    });

    it("getCurrentTraceId 在上下文内应返回当前 traceId", () => {
      runRequestContext({ traceId: "trace-003" }, () => {
        expect(getCurrentTraceId()).toBe("trace-003");
      });
    });

    it("AsyncLocalStorage 应跨 async 边界透传", async () => {
      await runRequestContext({ traceId: "trace-004" }, async () => {
        await new Promise((resolve) => setImmediate(resolve));
        expect(getCurrentTraceId()).toBe("trace-004");
      });
    });

    it("嵌套上下文应正确恢复外层", () => {
      runRequestContext({ traceId: "outer" }, () => {
        expect(getCurrentTraceId()).toBe("outer");
        runRequestContext({ traceId: "inner" }, () => {
          expect(getCurrentTraceId()).toBe("inner");
        });
        // 内层结束后应恢复外层
        expect(getCurrentTraceId()).toBe("outer");
      });
    });

    it("runRequestContext 应返回回调的返回值", () => {
      const result = runRequestContext({ traceId: "trace-005" }, () => 42);
      expect(result).toBe(42);
    });
  });
});
