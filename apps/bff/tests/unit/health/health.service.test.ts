import { describe, it, expect, vi, beforeEach } from "vitest";
import { of, throwError } from "rxjs";
import type { HttpService } from "@nestjs/axios";
import { HealthService } from "../../../src/health/health.service";
import { SchemaValidator } from "../../../src/proxy/schema-validator.service";
import {
  createHttpServiceMock,
  buildAxiosResponse,
} from "../../__support__/mocks/http-service.mock";

/** 测试用配置（覆盖 HealthService 实际访问的字段） */
const TEST_CONFIG = {
  version: "0.1.0-test",
  environment: "test",
  coreServiceUrl: "http://core.test",
  aiServiceUrl: "http://ai.test",
} as const;

/** 构造健康检查 200 响应 */
function okResponse(): ReturnType<typeof buildAxiosResponse> {
  return buildAxiosResponse({ status: "ok" }, 200);
}

/** 构造健康检查 500 响应 */
function downResponse(): ReturnType<typeof buildAxiosResponse> {
  return buildAxiosResponse({ error: "down" }, 500);
}

describe("HealthService", () => {
  let httpService: HttpService;
  let schemaValidator: SchemaValidator;

  beforeEach(() => {
    httpService = createHttpServiceMock();
    schemaValidator = new SchemaValidator();
    schemaValidator.resetFailures();
  });

  it("应该在所有依赖 UP 时返回整体 status=UP 且 timestamp 合法", async () => {
    // Arrange
    vi.mocked(httpService.get).mockReturnValue(of(okResponse()));
    const service = new HealthService(
      TEST_CONFIG as never,
      httpService,
      schemaValidator,
    );

    // Act
    const result = await service.checkAll();

    // Assert
    expect(result.status).toBe("UP");
    expect(result.services.bff.status).toBe("UP");
    expect(result.services.core.status).toBe("UP");
    expect(result.services.ai.status).toBe("UP");
    expect(result.services.postgresql.status).toBe("UP");
    expect(result.services.minio.status).toBe("UP");
    expect(result.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    // BFF 自身附带版本信息
    expect(result.services.bff.details).toMatchObject({
      version: "0.1.0-test",
      environment: "test",
    });
  });

  it("应该在 core 不可达时整体 status=DOWN 且标记 core/ai/postgresql/minio=DOWN", async () => {
    // Arrange
    vi.mocked(httpService.get).mockImplementation((url: string) => {
      if (url.startsWith("http://core.test")) {
        return throwError(() => new Error("ECONNREFUSED core"));
      }
      return of(okResponse());
    });
    const service = new HealthService(
      TEST_CONFIG as never,
      httpService,
      schemaValidator,
    );

    // Act
    const result = await service.checkAll();

    // Assert
    expect(result.status).toBe("DOWN");
    expect(result.services.bff.status).toBe("UP");
    expect(result.services.core.status).toBe("DOWN");
    expect(result.services.postgresql.status).toBe("DOWN");
    expect(result.services.minio.status).toBe("DOWN");
    expect(result.services.ai.status).toBe("UP");
  });

  it("应该在 ai 不可达时整体 status=DOWN 且仅 ai 标记 DOWN", async () => {
    // Arrange
    vi.mocked(httpService.get).mockImplementation((url: string) => {
      if (url.startsWith("http://ai.test")) {
        return throwError(() => new Error("ai connection refused"));
      }
      return of(okResponse());
    });
    const service = new HealthService(
      TEST_CONFIG as never,
      httpService,
      schemaValidator,
    );

    // Act
    const result = await service.checkAll();

    // Assert
    expect(result.status).toBe("DOWN");
    expect(result.services.bff.status).toBe("UP");
    expect(result.services.core.status).toBe("UP");
    expect(result.services.postgresql.status).toBe("UP");
    expect(result.services.minio.status).toBe("UP");
    expect(result.services.ai.status).toBe("DOWN");
  });

  it("应该在 core 返回 5xx 时将其标记为 DOWN 并附 statusCode", async () => {
    // Arrange
    vi.mocked(httpService.get).mockImplementation((url: string) => {
      if (url === "http://core.test/health/live") {
        return of(downResponse());
      }
      return of(okResponse());
    });
    const service = new HealthService(
      TEST_CONFIG as never,
      httpService,
      schemaValidator,
    );

    // Act
    const result = await service.checkAll();

    // Assert
    expect(result.status).toBe("DOWN");
    expect(result.services.core.status).toBe("DOWN");
    expect(result.services.core.error).toBe("HTTP 500");
    expect(result.services.core.details).toMatchObject({ statusCode: 500 });
  });

  it("应该使用正确的下游 URL（core/ai/db/storage）探测各服务", async () => {
    // Arrange
    vi.mocked(httpService.get).mockReturnValue(of(okResponse()));
    const service = new HealthService(
      TEST_CONFIG as never,
      httpService,
      schemaValidator,
    );

    // Act
    await service.checkAll();

    // Assert
    const calls = vi.mocked(httpService.get).mock.calls;
    const urls = calls.map((call) => call[0]);
    expect(urls).toContain("http://core.test/health/live");
    expect(urls).toContain("http://core.test/health/db");
    expect(urls).toContain("http://core.test/health/storage");
    expect(urls).toContain("http://ai.test/health/live");
    // 探测超时为 3s
    expect(calls[0]?.[1]).toEqual({ timeout: 3_000 });
  });

  describe("schema 验证失败统计（V1 可观测性）", () => {
    it("初始状态应返回空 schemaValidation 字段", async () => {
      vi.mocked(httpService.get).mockReturnValue(of(okResponse()));
      const service = new HealthService(
        TEST_CONFIG as never,
        httpService,
        schemaValidator,
      );

      const result = await service.checkAll();

      expect(result.schemaValidation).toEqual({
        softTotal: 0,
        strictTotal: 0,
        softFailures: {},
        strictFailures: {},
      });
    });

    it("schema 验证失败次数应反映在 schemaValidation 字段", async () => {
      vi.mocked(httpService.get).mockReturnValue(of(okResponse()));
      const service = new HealthService(
        TEST_CONFIG as never,
        httpService,
        schemaValidator,
      );

      // 触发软验证失败 2 次（直接调用 SchemaValidator 内部计数器）
      const testSchema = (await import("zod")).z.object({
        id: (await import("zod")).z.string().uuid(),
      });
      schemaValidator.validateSoft({ id: "bad" }, testSchema, {
        domain: "test",
        operation: "op1",
      });
      schemaValidator.validateSoft({ id: "bad" }, testSchema, {
        domain: "test",
        operation: "op1",
      });

      const result = await service.checkAll();

      expect(result.schemaValidation.softTotal).toBe(2);
      expect(result.schemaValidation.strictTotal).toBe(0);
      expect(result.schemaValidation.softFailures["test.op1"]).toBeDefined();
    });

    it("严格验证失败次数应反映在 schemaValidation.strictTotal", async () => {
      vi.mocked(httpService.get).mockReturnValue(of(okResponse()));
      const service = new HealthService(
        TEST_CONFIG as never,
        httpService,
        schemaValidator,
      );

      const { z } = await import("zod");
      const testSchema = z.object({ id: z.string().uuid() });
      try {
        schemaValidator.validateStrict({ id: "bad" }, testSchema, {
          domain: "test",
          operation: "strictOp",
        });
      } catch {
        // 预期抛错
      }

      const result = await service.checkAll();

      expect(result.schemaValidation.strictTotal).toBe(1);
      expect(result.schemaValidation.softTotal).toBe(0);
      expect(
        result.schemaValidation.strictFailures["test.strictOp"],
      ).toBeDefined();
    });
  });
});
