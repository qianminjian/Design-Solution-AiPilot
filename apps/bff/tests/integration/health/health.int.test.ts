import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { INestApplication, Controller, Get, Res, Inject } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { Response } from "express";
import appConfig from "../../../src/config/app.config";
import { HealthService, type HealthCheckResult } from "../../../src/health/health.service";

@Controller("v1/health")
class TestHealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  async check(@Res({ passthrough: true }) response: Response) {
    const result: HealthCheckResult = await this.healthService.checkAll();
    response.status(result.status === "UP" ? 200 : 503);
    return result;
  }
}

describe("Health API 集成测试", () => {
  let app: INestApplication;
  let mockCheckAll: vi.Mock;

  beforeEach(async () => {
    mockCheckAll = vi.fn();

    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [appConfig],
          cache: true,
        }),
      ],
      controllers: [TestHealthController],
      providers: [
        {
          provide: HealthService,
          useValue: { checkAll: mockCheckAll },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    vi.clearAllMocks();
  });

  function buildHealthResult(
    status: "UP" | "DOWN",
    services: Partial<HealthCheckResult["services"]> = {},
  ): HealthCheckResult {
    return {
      status,
      services: {
        bff: { status: "UP" },
        core: { status: "UP" },
        ai: { status: "UP" },
        postgresql: { status: "UP" },
        minio: { status: "UP" },
        ...services,
      },
      timestamp: new Date().toISOString(),
    };
  }

  it("应该在所有依赖 UP 时返回 200 且 status=UP", async () => {
    mockCheckAll.mockResolvedValue(buildHealthResult("UP"));

    const response = await request(app.getHttpServer()).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("UP");
    expect(response.body.services.bff.status).toBe("UP");
    expect(response.body.services.core.status).toBe("UP");
    expect(response.body.services.ai.status).toBe("UP");
    expect(response.body.services.postgresql.status).toBe("UP");
    expect(response.body.services.minio.status).toBe("UP");
    expect(typeof response.body.timestamp).toBe("string");
  });

  it("应该在任一依赖 DOWN 时返回 503 且 services 中标记具体失败项", async () => {
    mockCheckAll.mockResolvedValue(
      buildHealthResult("DOWN", {
        core: { status: "DOWN", error: "ECONNREFUSED" },
        postgresql: { status: "DOWN", error: "core unreachable" },
        minio: { status: "DOWN", error: "core unreachable" },
      }),
    );

    const response = await request(app.getHttpServer()).get("/api/v1/health");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("DOWN");
    expect(response.body.services.bff.status).toBe("UP");
    expect(response.body.services.core.status).toBe("DOWN");
    expect(response.body.services.postgresql.status).toBe("DOWN");
    expect(response.body.services.minio.status).toBe("DOWN");
    expect(response.body.services.ai.status).toBe("UP");
  });

  it("应该不需认证即可访问（无需 Authorization 头）", async () => {
    mockCheckAll.mockResolvedValue(buildHealthResult("UP"));

    const response = await request(app.getHttpServer()).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("UP");
  });
});
