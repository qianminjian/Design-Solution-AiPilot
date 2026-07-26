import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response } from "express";
import { HealthController } from "../../../src/health/health.controller";
import type {
  HealthService,
  HealthCheckResult,
} from "../../../src/health/health.service";

/**
 * HealthController（v1/health）单元测试
 *
 * 覆盖点：
 * - check：整体 UP 返回 200；任一依赖 DOWN 返回 503
 * - liveness：固定返回 up 与 timestamp
 * - readiness：复用 checkAll，状态码与 check 一致
 * - response.status 设置行为（passthrough 模式）
 */
describe("HealthController (v1/health)", () => {
  const buildUpResult = (): HealthCheckResult => ({
    status: "UP",
    services: {
      bff: { status: "UP", details: { version: "0.1.0" } },
      core: { status: "UP", details: { url: "http://core/health/live" } },
      ai: { status: "UP", details: { url: "http://ai/health/live" } },
      postgresql: { status: "UP", details: { url: "http://core/health/db" } },
      minio: { status: "UP", details: { url: "http://core/health/storage" } },
    },
    schemaValidation: {
      softTotal: 0,
      strictTotal: 0,
      softFailures: [],
      strictFailures: [],
    },
    timestamp: "2026-07-26T00:00:00.000Z",
  });

  const buildDownResult = (): HealthCheckResult => ({
    ...buildUpResult(),
    status: "DOWN",
    services: {
      bff: { status: "UP" },
      core: { status: "DOWN", error: "ECONNREFUSED" },
      ai: { status: "UP" },
      postgresql: { status: "UP" },
      minio: { status: "UP" },
    },
  });

  const createMockResponse = (): Response => {
    const res = {
      status: vi.fn().mockReturnThis(),
    } as unknown as Response;
    return res;
  };

  let healthService: HealthService;

  beforeEach(() => {
    healthService = {
      checkAll: vi.fn(),
    } as unknown as HealthService;
  });

  describe("check", () => {
    it("应该在所有依赖 UP 时返回 200 与 UP 结果", async () => {
      const up = buildUpResult();
      vi.mocked(healthService.checkAll).mockResolvedValue(up);
      const controller = new HealthController(healthService);
      const response = createMockResponse();

      const result = await controller.check(response);

      expect(healthService.checkAll).toHaveBeenCalledOnce();
      expect(response.status).toHaveBeenCalledWith(200);
      expect(result).toEqual(up);
    });

    it("应该在任一依赖 DOWN 时返回 503 与 DOWN 结果", async () => {
      const down = buildDownResult();
      vi.mocked(healthService.checkAll).mockResolvedValue(down);
      const controller = new HealthController(healthService);
      const response = createMockResponse();

      const result = await controller.check(response);

      expect(response.status).toHaveBeenCalledWith(503);
      expect(result.status).toBe("DOWN");
      expect(result.services.core.status).toBe("DOWN");
      expect(result.services.core.error).toBe("ECONNREFUSED");
    });

    it("应该在 checkAll 抛错时向上传播（由异常过滤器处理）", async () => {
      vi.mocked(healthService.checkAll).mockRejectedValue(
        new Error("unexpected"),
      );
      const controller = new HealthController(healthService);
      const response = createMockResponse();

      await expect(controller.check(response)).rejects.toThrow("unexpected");
      expect(response.status).not.toHaveBeenCalled();
    });
  });

  describe("liveness", () => {
    it("应该返回 status=up 且不调用 checkAll", async () => {
      const controller = new HealthController(healthService);

      const result = await controller.liveness();

      expect(result.status).toBe("up");
      expect(typeof result.timestamp).toBe("string");
      expect(healthService.checkAll).not.toHaveBeenCalled();
    });

    it("每次调用应返回新的 timestamp", async () => {
      const controller = new HealthController(healthService);

      const r1 = await controller.liveness();
      await new Promise((r) => setTimeout(r, 5));
      const r2 = await controller.liveness();

      expect(r1.timestamp).not.toBe(r2.timestamp);
    });
  });

  describe("readiness", () => {
    it("应该在所有依赖 UP 时返回 200 与 UP 结果", async () => {
      const up = buildUpResult();
      vi.mocked(healthService.checkAll).mockResolvedValue(up);
      const controller = new HealthController(healthService);
      const response = createMockResponse();

      const result = await controller.readiness(response);

      expect(healthService.checkAll).toHaveBeenCalledOnce();
      expect(response.status).toHaveBeenCalledWith(200);
      expect(result.status).toBe("UP");
    });

    it("应该在任一依赖 DOWN 时返回 503", async () => {
      const down = buildDownResult();
      vi.mocked(healthService.checkAll).mockResolvedValue(down);
      const controller = new HealthController(healthService);
      const response = createMockResponse();

      const result = await controller.readiness(response);

      expect(response.status).toHaveBeenCalledWith(503);
      expect(result.status).toBe("DOWN");
    });

    it("schemaValidation 字段应原样透传给响应", async () => {
      const result = buildUpResult();
      result.schemaValidation = {
        softTotal: 3,
        strictTotal: 1,
        softFailures: [
          {
            context: "ai-generation-record",
            schema: "aiGenerationRecordSchema",
            count: 3,
            lastTraceId: "trace-001",
            lastOccurredAt: "2026-07-26T00:00:00.000Z",
          },
        ],
        strictFailures: [
          {
            context: "auth",
            schema: "loginResponseSchema",
            count: 1,
            lastTraceId: "trace-002",
            lastOccurredAt: "2026-07-26T00:01:00.000Z",
          },
        ],
      };
      vi.mocked(healthService.checkAll).mockResolvedValue(result);
      const controller = new HealthController(healthService);
      const response = createMockResponse();

      const data = await controller.readiness(response);

      expect(data.schemaValidation.softTotal).toBe(3);
      expect(data.schemaValidation.strictTotal).toBe(1);
      expect(data.schemaValidation.softFailures).toHaveLength(1);
      expect(data.schemaValidation.strictFailures).toHaveLength(1);
    });
  });
});
