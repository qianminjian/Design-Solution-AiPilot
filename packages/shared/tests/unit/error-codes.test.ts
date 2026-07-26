/**
 * 错误码与 HTTP 状态码映射单元测试
 *
 * 覆盖：
 * - ErrorCode 常量完整性（与 D35.9 一致）
 * - ERROR_HTTP_STATUS 映射一对一
 * - isRetryable 函数：429/502/503/504 可重试，其他不可重试
 * - HttpHeader 常量
 */

import { describe, it, expect } from "vitest";

import {
  ErrorCode,
  ERROR_HTTP_STATUS,
  HttpHeader,
  isRetryable,
} from "../../src/error-codes";

describe("ErrorCode", () => {
  it("所有错误码应为字符串常量", () => {
    for (const code of Object.values(ErrorCode)) {
      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
    }
  });

  it("错误码应与键名一致（机器可读）", () => {
    for (const [key, value] of Object.entries(ErrorCode)) {
      expect(value).toBe(key);
    }
  });

  it("应包含 D35.9 关键错误码", () => {
    expect(ErrorCode.REQUEST_INVALID).toBe("REQUEST_INVALID");
    expect(ErrorCode.AUTHENTICATION_REQUIRED).toBe("AUTHENTICATION_REQUIRED");
    expect(ErrorCode.ACCESS_DENIED).toBe("ACCESS_DENIED");
    expect(ErrorCode.RESOURCE_NOT_FOUND).toBe("RESOURCE_NOT_FOUND");
    expect(ErrorCode.STATE_CONFLICT).toBe("STATE_CONFLICT");
    expect(ErrorCode.REVISION_CONFLICT).toBe("REVISION_CONFLICT");
    expect(ErrorCode.VALIDATION_FAILED).toBe("VALIDATION_FAILED");
    expect(ErrorCode.RATE_LIMITED).toBe("RATE_LIMITED");
    expect(ErrorCode.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
    expect(ErrorCode.DEADLINE_EXCEEDED).toBe("DEADLINE_EXCEEDED");
  });
});

describe("ERROR_HTTP_STATUS", () => {
  it("每个 ErrorCode 都应有 HTTP 状态码映射", () => {
    const codes = Object.values(ErrorCode);
    for (const code of codes) {
      expect(ERROR_HTTP_STATUS[code]).toBeDefined();
      expect(typeof ERROR_HTTP_STATUS[code]).toBe("number");
    }
  });

  it("400 类错误码映射正确", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.REQUEST_INVALID]).toBe(400);
    expect(ERROR_HTTP_STATUS[ErrorCode.IDEMPOTENCY_KEY_REQUIRED]).toBe(400);
  });

  it("401 映射 AUTHENTICATION_REQUIRED", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.AUTHENTICATION_REQUIRED]).toBe(401);
  });

  it("403 类错误码映射正确", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.ACCESS_DENIED]).toBe(403);
    expect(ERROR_HTTP_STATUS[ErrorCode.DATA_RESIDENCY_DENIED]).toBe(403);
  });

  it("404 映射 RESOURCE_NOT_FOUND", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.RESOURCE_NOT_FOUND]).toBe(404);
  });

  it("409 类错误码映射正确", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.STATE_CONFLICT]).toBe(409);
    expect(ERROR_HTTP_STATUS[ErrorCode.BASELINE_NOT_FROZEN]).toBe(409);
  });

  it("412 映射 REVISION_CONFLICT", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.REVISION_CONFLICT]).toBe(412);
  });

  it("413 映射 PAYLOAD_TOO_LARGE", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.PAYLOAD_TOO_LARGE]).toBe(413);
  });

  it("415 映射 FORMAT_UNSUPPORTED", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.FORMAT_UNSUPPORTED]).toBe(415);
  });

  it("422 类错误码映射正确", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.VALIDATION_FAILED]).toBe(422);
    expect(ERROR_HTTP_STATUS[ErrorCode.IDEMPOTENCY_KEY_REUSED]).toBe(422);
  });

  it("428 映射 PRECONDITION_REQUIRED", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.PRECONDITION_REQUIRED]).toBe(428);
  });

  it("429 类错误码映射正确", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.RATE_LIMITED]).toBe(429);
    expect(ERROR_HTTP_STATUS[ErrorCode.BUDGET_EXHAUSTED]).toBe(429);
  });

  it("500 映射 INTERNAL_ERROR", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.INTERNAL_ERROR]).toBe(500);
  });

  it("502/503/504 类错误码映射正确", () => {
    expect(ERROR_HTTP_STATUS[ErrorCode.DEPENDENCY_FAILED]).toBe(502);
    expect(ERROR_HTTP_STATUS[ErrorCode.CAPABILITY_UNAVAILABLE]).toBe(503);
    expect(ERROR_HTTP_STATUS[ErrorCode.DEADLINE_EXCEEDED]).toBe(504);
  });
});

describe("isRetryable", () => {
  it("429 RATE_LIMITED 应可重试", () => {
    expect(isRetryable(ErrorCode.RATE_LIMITED)).toBe(true);
  });

  it("429 BUDGET_EXHAUSTED 应可重试", () => {
    expect(isRetryable(ErrorCode.BUDGET_EXHAUSTED)).toBe(true);
  });

  it("502 DEPENDENCY_FAILED 应可重试", () => {
    expect(isRetryable(ErrorCode.DEPENDENCY_FAILED)).toBe(true);
  });

  it("503 CAPABILITY_UNAVAILABLE 应可重试", () => {
    expect(isRetryable(ErrorCode.CAPABILITY_UNAVAILABLE)).toBe(true);
  });

  it("504 DEADLINE_EXCEEDED 应可重试", () => {
    expect(isRetryable(ErrorCode.DEADLINE_EXCEEDED)).toBe(true);
  });

  it("400 REQUEST_INVALID 不应可重试", () => {
    expect(isRetryable(ErrorCode.REQUEST_INVALID)).toBe(false);
  });

  it("401 AUTHENTICATION_REQUIRED 不应可重试", () => {
    expect(isRetryable(ErrorCode.AUTHENTICATION_REQUIRED)).toBe(false);
  });

  it("403 ACCESS_DENIED 不应可重试", () => {
    expect(isRetryable(ErrorCode.ACCESS_DENIED)).toBe(false);
  });

  it("404 RESOURCE_NOT_FOUND 不应可重试", () => {
    expect(isRetryable(ErrorCode.RESOURCE_NOT_FOUND)).toBe(false);
  });

  it("409 STATE_CONFLICT 不应可重试", () => {
    expect(isRetryable(ErrorCode.STATE_CONFLICT)).toBe(false);
  });

  it("412 REVISION_CONFLICT 不应可重试", () => {
    expect(isRetryable(ErrorCode.REVISION_CONFLICT)).toBe(false);
  });

  it("422 VALIDATION_FAILED 不应可重试", () => {
    expect(isRetryable(ErrorCode.VALIDATION_FAILED)).toBe(false);
  });

  it("500 INTERNAL_ERROR 不应可重试", () => {
    expect(isRetryable(ErrorCode.INTERNAL_ERROR)).toBe(false);
  });
});

describe("HttpHeader", () => {
  it("应包含 W3C Trace Context headers", () => {
    expect(HttpHeader.TRACEPARENT).toBe("traceparent");
    expect(HttpHeader.TRACESTATE).toBe("tracestate");
  });

  it("应包含 x-trace-id 与 x-request-id", () => {
    expect(HttpHeader.X_TRACE_ID).toBe("x-trace-id");
    expect(HttpHeader.X_REQUEST_ID).toBe("x-request-id");
  });

  it("应包含 x-tenant-id 与 x-project-id", () => {
    expect(HttpHeader.X_TENANT_ID).toBe("x-tenant-id");
    expect(HttpHeader.X_PROJECT_ID).toBe("x-project-id");
  });

  it("应包含幂等与并发控制 headers", () => {
    expect(HttpHeader.IDEMPOTENCY_KEY).toBe("idempotency-key");
    expect(HttpHeader.IF_MATCH).toBe("if-match");
    expect(HttpHeader.ETAG).toBe("etag");
    expect(HttpHeader.IF_NONE_MATCH).toBe("if-none-match");
  });

  it("应包含认证 header", () => {
    expect(HttpHeader.AUTHORIZATION).toBe("authorization");
  });

  it("应包含本地化 headers", () => {
    expect(HttpHeader.ACCEPT_LANGUAGE).toBe("accept-language");
    expect(HttpHeader.CONTENT_LANGUAGE).toBe("content-language");
  });

  it("应包含 RETRY_AFTER header", () => {
    expect(HttpHeader.RETRY_AFTER).toBe("retry-after");
  });
});
