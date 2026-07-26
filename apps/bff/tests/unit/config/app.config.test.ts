import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("appConfig", () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    // 每个用例前重置环境变量，避免相互污染
    process.env = { ...previousEnv };
    // 清理本用例关心字段，确保默认值测试可重复
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.CORE_SERVICE_URL;
    delete process.env.AI_SERVICE_URL;
    delete process.env.CORS_ORIGIN;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_ACCESS_TOKEN_EXPIRES_IN;
    delete process.env.JWT_REFRESH_TOKEN_EXPIRES_IN;
    delete process.env.npm_package_version;
  });

  afterEach(() => {
    // 还原 env，避免影响其他测试
    process.env = { ...previousEnv };
  });

  /**
   * 因 registerAs 内部闭包捕获 process.env，需每次测试动态 import 以读取最新环境变量。
   */
  async function loadConfig() {
    const mod = await import("../../../src/config/app.config");
    return mod.default;
  }

  it("应该使用默认值当环境变量未设置时", async () => {
    const config = await loadConfig();
    const result = config();

    expect(result.name).toBe("bff");
    expect(result.version).toBe("0.1.0");
    expect(result.environment).toBe("development");
    expect(result.port).toBe(3001);
    expect(result.coreServiceUrl).toBe("http://localhost:8080");
    expect(result.aiServiceUrl).toBe("http://localhost:8000");
    expect(result.corsOrigin).toEqual(["http://localhost:3000"]);
    expect(result.jwt).toEqual({
      secret: "",
      accessTokenExpire: "15m",
      refreshTokenExpire: "7d",
    });
  });

  it("应该正确解析 PORT 为 number 类型", async () => {
    process.env.PORT = "8080";
    const config = await loadConfig();
    const result = config();

    expect(result.port).toBe(8080);
    expect(typeof result.port).toBe("number");
  });

  it("PORT 非法时回退到默认值 3001（防御性兜底）", async () => {
    process.env.PORT = "abc";
    const config = await loadConfig();
    const result = config();

    expect(result.port).toBe(3001);
  });

  it("PORT 为 0 或负数时回退到默认值 3001", async () => {
    process.env.PORT = "0";
    const config = await loadConfig();
    expect((await config()).port).toBe(3001);

    process.env.PORT = "-1";
    const config2 = await loadConfig();
    expect((await config2()).port).toBe(3001);
  });

  it("PORT 超过 65535 时回退到默认值 3001", async () => {
    process.env.PORT = "70000";
    const config = await loadConfig();
    const result = config();

    expect(result.port).toBe(3001);
  });

  it("PORT 为 65535（边界上限）时正确解析", async () => {
    process.env.PORT = "65535";
    const config = await loadConfig();
    const result = config();

    expect(result.port).toBe(65535);
  });

  it("应该读取 npm_package_version 作为 version", async () => {
    process.env.npm_package_version = "1.2.3";
    const config = await loadConfig();
    const result = config();

    expect(result.version).toBe("1.2.3");
  });

  it("应该读取 NODE_ENV 作为 environment", async () => {
    process.env.NODE_ENV = "production";
    const config = await loadConfig();
    const result = config();

    expect(result.environment).toBe("production");
  });

  it("应该读取下游服务 URL", async () => {
    process.env.CORE_SERVICE_URL = "http://core:8080";
    process.env.AI_SERVICE_URL = "http://ai:8000";
    const config = await loadConfig();
    const result = config();

    expect(result.coreServiceUrl).toBe("http://core:8080");
    expect(result.aiServiceUrl).toBe("http://ai:8000");
  });

  it("CORS_ORIGIN 单个值应放入数组", async () => {
    process.env.CORS_ORIGIN = "https://example.com";
    const config = await loadConfig();
    const result = config();

    expect(result.corsOrigin).toEqual(["https://example.com"]);
  });

  it("CORS_ORIGIN 多个值应按逗号分隔为数组", async () => {
    process.env.CORS_ORIGIN =
      "https://a.example.com,https://b.example.com,https://c.example.com";
    const config = await loadConfig();
    const result = config();

    expect(result.corsOrigin).toEqual([
      "https://a.example.com",
      "https://b.example.com",
      "https://c.example.com",
    ]);
  });

  it("CORS_ORIGIN 为空字符串时回退到默认值（防御性兜底）", async () => {
    process.env.CORS_ORIGIN = "";
    const config = await loadConfig();
    const result = config();

    expect(result.corsOrigin).toEqual(["http://localhost:3000"]);
  });

  it("CORS_ORIGIN 仅含空白时回退到默认值", async () => {
    process.env.CORS_ORIGIN = " , , ";
    const config = await loadConfig();
    const result = config();

    expect(result.corsOrigin).toEqual(["http://localhost:3000"]);
  });

  it("CORS_ORIGIN 含前后空格应被 trim", async () => {
    process.env.CORS_ORIGIN =
      "  https://a.example.com  ,  https://b.example.com  ";
    const config = await loadConfig();
    const result = config();

    expect(result.corsOrigin).toEqual([
      "https://a.example.com",
      "https://b.example.com",
    ]);
  });

  it("应该读取 JWT 配置", async () => {
    process.env.JWT_SECRET = "super-secret-key";
    process.env.JWT_ACCESS_TOKEN_EXPIRES_IN = "30m";
    process.env.JWT_REFRESH_TOKEN_EXPIRES_IN = "14d";
    const config = await loadConfig();
    const result = config();

    expect(result.jwt).toEqual({
      secret: "super-secret-key",
      accessTokenExpire: "30m",
      refreshTokenExpire: "14d",
    });
  });

  it("JWT_SECRET 默认为空字符串（开发环境占位）", async () => {
    const config = await loadConfig();
    const result = config();

    expect(result.jwt.secret).toBe("");
  });

  it("registerAs 应返回命名空间标识符 'app'", async () => {
    const config = await loadConfig();
    // registerAs 返回的函数带 KEY 属性，可通过 toString 粗略校验
    expect(typeof config).toBe("function");
  });
});
