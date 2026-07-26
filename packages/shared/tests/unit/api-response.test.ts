/**
 * D35 统一响应格式单元测试
 *
 * 覆盖：
 * - BIZ_CODE 常量
 * - isSuccess 类型守卫
 * - ApiResponse / ApiErrorResponse 结构契约
 * - 分页请求/响应结构（OffsetPage / CursorPage）
 *
 * 权威源：@design/D35-API-事件契约.md §D35.6/§D35.9
 */
import { describe, it, expect } from "vitest";

import {
  BIZ_CODE,
  isSuccess,
  type ApiResponse,
  type ApiErrorResponse,
  type FieldError,
  type OffsetPageRequest,
  type OffsetPageResponse,
  type CursorPageRequest,
  type CursorPageResponse,
} from "../../src/api-response";

describe("BIZ_CODE", () => {
  it("SUCCESS 应为 0", () => {
    expect(BIZ_CODE.SUCCESS).toBe(0);
  });

  it("BIZ_CODE 应为只读常量集合", () => {
    expect(Object.keys(BIZ_CODE)).toContain("SUCCESS");
  });
});

describe("isSuccess", () => {
  it("code=0 时应判定为成功", () => {
    // Arrange
    const response: ApiResponse<{ id: string }> = {
      code: BIZ_CODE.SUCCESS,
      data: { id: "p-001" },
      message: "ok",
      traceId: "01234567-89ab-7cde-8123-456789abcdef",
    };

    // Act
    const result = isSuccess(response);

    // Assert
    expect(result).toBe(true);
  });

  it("code 非 0 时应判定为失败", () => {
    // Arrange
    const response = {
      code: 1001,
      data: null,
      traceId: "01234567-89ab-7cde-8123-456789abcdef",
    } as unknown as ApiResponse<null>;

    // Act
    const result = isSuccess(response);

    // Assert
    expect(result).toBe(false);
  });

  it("应作为类型守卫收窄 data 类型", () => {
    // Arrange
    const response: ApiResponse<{ name: string }> = {
      code: BIZ_CODE.SUCCESS,
      data: { name: "项目甲" },
      traceId: "01234567-89ab-7cde-8123-456789abcdef",
    };

    // Act
    if (isSuccess(response)) {
      // Assert: 此处 data 类型应已收窄为 { name: string }
      expect(response.data.name).toBe("项目甲");
    } else {
      throw new Error("应进入成功分支");
    }
  });
});

describe("ApiResponse", () => {
  it("应携带必需字段 code/data/traceId", () => {
    // Arrange
    const response: ApiResponse<{ items: string[] }> = {
      code: BIZ_CODE.SUCCESS,
      data: { items: ["a", "b"] },
      traceId: "01234567-89ab-7cde-8123-456789abcdef",
    };

    // Assert
    expect(response.code).toBe(0);
    expect(response.data.items).toEqual(["a", "b"]);
    expect(response.traceId).toHaveLength(36);
  });

  it("message 应为可选字段", () => {
    // Arrange
    const response: ApiResponse<unknown> = {
      code: BIZ_CODE.SUCCESS,
      data: {},
      traceId: "01234567-89ab-7cde-8123-456789abcdef",
    };

    // Assert
    expect(response.message).toBeUndefined();
  });
});

describe("ApiErrorResponse", () => {
  it("应携带业务错误码与 HTTP 状态", () => {
    // Arrange
    const error: ApiErrorResponse = {
      code: 1001,
      errorCode: "RESOURCE_NOT_FOUND",
      status: 404,
      title: "资源不存在",
      detail: "项目 p-001 不存在",
      correlationId: "01234567-89ab-7cde-8123-456789abcdef",
      retryable: false,
    };

    // Assert
    expect(error.code).toBe(1001);
    expect(error.errorCode).toBe("RESOURCE_NOT_FOUND");
    expect(error.status).toBe(404);
    expect(error.retryable).toBe(false);
  });

  it("retryAfter 应为可选字段", () => {
    // Arrange
    const error: ApiErrorResponse = {
      code: 1029,
      errorCode: "RATE_LIMITED",
      status: 429,
      title: "限流",
      detail: "请稍后重试",
      correlationId: "01234567-89ab-7cde-8123-456789abcdef",
      retryable: true,
      retryAfter: 30,
    };

    // Assert
    expect(error.retryAfter).toBe(30);
    expect(error.retryable).toBe(true);
  });

  it("应支持字段级错误明细", () => {
    // Arrange
    const fieldError: FieldError = {
      code: "FIELD_INVALID",
      pointer: "/email",
      parameter: "email",
      resourceId: "u-001",
    };
    const error: ApiErrorResponse = {
      code: 1422,
      errorCode: "VALIDATION_FAILED",
      status: 422,
      title: "校验失败",
      detail: "字段格式错误",
      correlationId: "01234567-89ab-7cde-8123-456789abcdef",
      retryable: false,
      errors: [fieldError],
    };

    // Assert
    expect(error.errors).toHaveLength(1);
    expect(error.errors?.[0]?.pointer).toBe("/email");
  });
});

describe("OffsetPageRequest", () => {
  it("应支持 page/pageSize 与可选 sort/order", () => {
    // Arrange
    const req: OffsetPageRequest = {
      page: 1,
      pageSize: 20,
      sort: "createdAt",
      order: "desc",
    };

    // Assert
    expect(req.page).toBe(1);
    expect(req.pageSize).toBe(20);
    expect(req.order).toBe("desc");
  });

  it("应允许 sort/order 缺省", () => {
    // Arrange
    const req: OffsetPageRequest = { page: 2, pageSize: 50 };

    // Assert
    expect(req.sort).toBeUndefined();
    expect(req.order).toBeUndefined();
  });
});

describe("OffsetPageResponse", () => {
  it("应携带 items/total/page/pageSize/hasMore", () => {
    // Arrange
    const resp: OffsetPageResponse<{ id: string }> = {
      items: [{ id: "p-001" }, { id: "p-002" }],
      total: 2,
      page: 1,
      pageSize: 20,
      hasMore: false,
    };

    // Assert
    expect(resp.items).toHaveLength(2);
    expect(resp.hasMore).toBe(false);
    expect(resp.total).toBe(2);
  });
});

describe("CursorPageRequest", () => {
  it("首屏 cursor 应为 null", () => {
    // Arrange
    const req: CursorPageRequest = {
      cursor: null,
      pageSize: 50,
    };

    // Assert
    expect(req.cursor).toBeNull();
  });

  it("应支持 sort 表达式", () => {
    // Arrange
    const req: CursorPageRequest = {
      cursor: "eyJpZCI6IjAwMSJ9",
      pageSize: 50,
      sort: "-updatedAt,id",
    };

    // Assert
    expect(req.cursor).toBe("eyJpZCI6IjAwMSJ9");
    expect(req.sort).toBe("-updatedAt,id");
  });
});

describe("CursorPageResponse", () => {
  it("应携带 items 与 pageInfo.nextCursor", () => {
    // Arrange
    const resp: CursorPageResponse<{ id: string }> = {
      items: [{ id: "p-001" }],
      pageInfo: {
        nextCursor: "eyJpZCI6IjAwMiJ9",
        hasNextPage: true,
      },
    };

    // Assert
    expect(resp.pageInfo.nextCursor).toBe("eyJpZCI6IjAwMiJ9");
    expect(resp.pageInfo.hasNextPage).toBe(true);
  });

  it("末页时 nextCursor 应为 null", () => {
    // Arrange
    const resp: CursorPageResponse<{ id: string }> = {
      items: [{ id: "p-099" }],
      pageInfo: {
        nextCursor: null,
        hasNextPage: false,
      },
    };

    // Assert
    expect(resp.pageInfo.nextCursor).toBeNull();
    expect(resp.pageInfo.hasNextPage).toBe(false);
  });
});
