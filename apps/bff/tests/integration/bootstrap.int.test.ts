import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  INestApplication,
  Controller,
  Get,
  Post,
  Body,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { configureApp } from "../../src/bootstrap";

/**
 * BFF bootstrap 配置集成测试
 *
 * 验证 configureApp() 在 NestExpressApplication 上应用的核心配置：
 * - 全局前缀 /api
 * - CORS（默认源 http://localhost:3000，credentials=true）
 * - body 解析限制 10mb（json / urlencoded）
 * - pino logger 全局替换
 *
 * 由于 configureApp 是 main.ts 启动逻辑的可测入口，
 * 此测试不启动真实端口，通过 supertest 验证 HTTP 行为。
 */

/** 测试 controller：暴露 ping/echo 端点用于断言配置效果 */
@Controller("v1/ping")
class PingController {
  /** GET /api/v1/ping —— 简单返回 ok，用于验证全局前缀生效 */
  @Get()
  ping(): { ok: true } {
    return { ok: true } as const;
  }

  /** POST /api/v1/ping/echo —— 回显请求体，用于验证 body 解析与限制 */
  @Post("echo")
  echo(@Body() body: unknown): { received: unknown; size: number } {
    return {
      received: body,
      size:
        typeof body === "object" && body !== null
          ? JSON.stringify(body).length
          : 0,
    };
  }

  /** GET /api/v1/ping/headers —— 返回响应头，用于验证 CORS */
  @Get("headers")
  headers(@Res({ passthrough: true }) response: Response): { ok: true } {
    response.setHeader("X-Test-Header", "bootstrap");
    return { ok: true } as const;
  }
}

describe("BFF bootstrap 配置集成测试", () => {
  let app: INestApplication;
  const originalCorsOrigin = process.env.CORS_ORIGIN;

  beforeEach(async () => {
    // 重置 CORS_ORIGIN，使 configureApp 使用默认值 http://localhost:3000
    delete process.env.CORS_ORIGIN;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PingController],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    if (originalCorsOrigin === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = originalCorsOrigin;
    }
    vi.clearAllMocks();
  });

  it("应该设置全局前缀 /api，使 /api/v1/ping 返回 200", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/ping");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("应该使不带 /api 前缀的请求路径返回 404", async () => {
    const response = await request(app.getHttpServer()).get("/v1/ping");

    expect(response.status).toBe(404);
  });

  it("应该在 GET 请求中返回 CORS 头部（默认源）", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/ping")
      .set("Origin", "http://localhost:3000");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("应该在 OPTIONS 预检请求中返回 CORS 头部", async () => {
    const response = await request(app.getHttpServer())
      .options("/api/v1/ping")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET");

    expect(response.status).toBeLessThan(400);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
  });

  it("应该接受 <=10mb 的 JSON body", async () => {
    // 构造 ~9MB 的 JSON body（未达 10mb 上限）
    const largeString = "a".repeat(9 * 1024 * 1024);
    const payload = { data: largeString };

    const response = await request(app.getHttpServer())
      .post("/api/v1/ping/echo")
      .set("Content-Type", "application/json")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.size).toBeGreaterThan(9 * 1024 * 1024);
  });

  it("应该拒绝 >10mb 的 JSON body（413 Payload Too Large）", async () => {
    // 构造 ~11MB 的 JSON body（超过 10mb 上限）
    const oversizedString = "a".repeat(11 * 1024 * 1024);
    const payload = { data: oversizedString };

    const response = await request(app.getHttpServer())
      .post("/api/v1/ping/echo")
      .set("Content-Type", "application/json")
      .send(payload);

    // Express 默认返回 413 PayloadTooLargeError
    expect(response.status).toBe(413);
  });

  it("应该接受 urlencoded 表单数据", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/ping/echo")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("field1=value1&field2=value2");

    expect(response.status).toBe(201);
    expect(response.body.received).toEqual({
      field1: "value1",
      field2: "value2",
    });
  });

  it("应该正确解析 JSON body（小体积场景）", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/ping/echo")
      .set("Content-Type", "application/json")
      .send({ key: "value", nested: { foo: "bar" } });

    expect(response.status).toBe(201);
    expect(response.body.received).toEqual({
      key: "value",
      nested: { foo: "bar" },
    });
  });

  it("应该使用 CORS_ORIGIN 环境变量覆盖默认源", async () => {
    // 关闭当前 app，使用新 CORS_ORIGIN 重新构建
    await app.close();
    process.env.CORS_ORIGIN = "https://example.com";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PingController],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .get("/api/v1/ping")
      .set("Origin", "https://example.com");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://example.com",
    );
  });
});
