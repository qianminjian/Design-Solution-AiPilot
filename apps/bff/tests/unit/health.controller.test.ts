import { describe, it, expect, vi, beforeEach } from "vitest";
import { of, throwError } from "rxjs";
import type { AxiosResponse } from "axios";
import type { HttpService } from "@nestjs/axios";
import { HealthController } from "../../src/health.controller";
import {
  createHttpServiceMock,
  buildAxiosResponse,
} from "../__support__/mocks/http-service.mock";

/** 测试用配置（覆盖 HealthController 实际访问的字段） */
const TEST_CONFIG = {
  version: "0.1.0-test",
  coreServiceUrl: "http://core.test",
  aiServiceUrl: "http://ai.test",
} as const;

/** 构造健康检查 200 响应 */
function okResponse(): AxiosResponse {
  return buildAxiosResponse({ status: "ok" }, 200);
}

/** 模拟 HttpService.get 全部返回成功 */
function mockAllDownstreamUp(httpService: HttpService): void {
  vi.mocked(httpService.get).mockReturnValue(of(okResponse()));
}

/** 模拟 HttpService.get 全部抛错（连接失败场景） */
function mockAllDownstreamDown(httpService: HttpService): void {
  vi.mocked(httpService.get).mockReturnValue(
    throwError(() => new Error("ECONNREFUSED")),
  );
}

describe("HealthController", () => {
  let httpService: HttpService;

  beforeEach(() => {
    httpService = createHttpServiceMock();
  });

  describe("check", () => {
    it("应该在下游全部可达时返回 status=ok 与 downstream.*=up", async () => {
      // Arrange
      mockAllDownstreamUp(httpService);
      const controller = new HealthController(
        TEST_CONFIG as never,
        httpService,
      );

      // Act
      const result = await controller.check();

      // Assert
      expect(result.status).toBe("ok");
      expect(result.service).toBe("bff");
      expect(result.version).toBe("0.1.0-test");
      expect(result.downstream.coreService).toBe("up");
      expect(result.downstream.aiService).toBe("up");
      expect(typeof result.timestamp).toBe("string");
      // 下游 URL 拼接正确
      expect(httpService.get).toHaveBeenCalledWith(
        "http://core.test/health/live",
        { timeout: 3000 },
      );
      expect(httpService.get).toHaveBeenCalledWith(
        "http://ai.test/health/live",
        { timeout: 3000 },
      );
    });

    it("应该在下游不可达时将对应字段标记为 down 但仍返回 status=ok", async () => {
      // Arrange
      mockAllDownstreamDown(httpService);
      const controller = new HealthController(
        TEST_CONFIG as never,
        httpService,
      );

      // Act
      const result = await controller.check();

      // Assert：BFF 自身健康（ok），下游状态如实反映
      expect(result.status).toBe("ok");
      expect(result.downstream.coreService).toBe("down");
      expect(result.downstream.aiService).toBe("down");
    });

    it("应该仅 core 不可达时仅标记 coreService=down", async () => {
      // Arrange：core 返回 200，ai 抛错
      const coreOk = of(okResponse());
      const aiDown = throwError(() => new Error("ai down"));
      vi.mocked(httpService.get)
        .mockReturnValueOnce(coreOk)
        .mockReturnValueOnce(aiDown);
      const controller = new HealthController(
        TEST_CONFIG as never,
        httpService,
      );

      // Act
      const result = await controller.check();

      // Assert
      expect(result.downstream.coreService).toBe("up");
      expect(result.downstream.aiService).toBe("down");
    });
  });

  describe("liveness", () => {
    it("应该返回 status=up 且不调用下游", async () => {
      // Arrange
      mockAllDownstreamUp(httpService);
      const controller = new HealthController(
        TEST_CONFIG as never,
        httpService,
      );

      // Act
      const result = await controller.liveness();

      // Assert
      expect(result.status).toBe("up");
      expect(typeof result.timestamp).toBe("string");
      // liveness 不应触发任何下游调用
      expect(httpService.get).not.toHaveBeenCalled();
    });
  });

  describe("readiness", () => {
    it("应该在 core 与 ai 均返回 2xx 时返回 status=ready", async () => {
      // Arrange
      mockAllDownstreamUp(httpService);
      const controller = new HealthController(
        TEST_CONFIG as never,
        httpService,
      );

      // Act
      const result = await controller.readiness();

      // Assert
      expect(result.status).toBe("ready");
      expect(httpService.get).toHaveBeenCalledWith(
        "http://core.test/health/ready",
        { timeout: 3000 },
      );
      expect(httpService.get).toHaveBeenCalledWith(
        "http://ai.test/health/ready",
        { timeout: 3000 },
      );
    });

    it("应该在全部下游不可达时返回 status=not_ready 且 details 标记 not_ready", async () => {
      // Arrange
      mockAllDownstreamDown(httpService);
      const controller = new HealthController(
        TEST_CONFIG as never,
        httpService,
      );

      // Act
      const result = await controller.readiness();

      // Assert
      expect(result.status).toBe("not_ready");
      expect(result.details?.coreService).toBe("not_ready");
      expect(result.details?.aiService).toBe("not_ready");
    });

    it("应该在 core 返回 4xx/5xx 时将其标记为 not_ready", async () => {
      // Arrange：core 返回 500（视为未就绪）
      const coreDown = of(buildAxiosResponse({ error: "internal" }, 500));
      const aiUp = of(okResponse());
      vi.mocked(httpService.get)
        .mockReturnValueOnce(coreDown)
        .mockReturnValueOnce(aiUp);
      const controller = new HealthController(
        TEST_CONFIG as never,
        httpService,
      );

      // Act
      const result = await controller.readiness();

      // Assert
      expect(result.status).toBe("not_ready");
      expect(result.details?.coreService).toBe("not_ready");
      expect(result.details?.aiService).toBe("ready");
    });
  });
});
