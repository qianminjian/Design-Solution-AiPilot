/**
 * Consumer 契约注册表单元测试（P0-2.1 HTTP/OpenAPI 契约）
 *
 * 覆盖：
 * - 12 个业务域全覆盖（每个域至少 1 个契约期望）
 * - contractId 全局唯一性
 * - 契约字段完整性（path/method/consumer/provider/version）
 * - validateRegistry 完整性校验无错误
 * - getExpectation / getExpectationsByDomain 查询行为
 * - getRegistryStats 统计正确性（总数/按域/按严格级别）
 * - 安全红线：auth 认证端点 strict + ai 方案生成 strict
 * - validateResponse 对真实 schema 的软验证行为（auth-login 样例）
 *
 * 权威源：@design/D45-测试-验收体系.md §D45.11 + security.md §2.2/§12
 */
import { describe, it, expect } from "vitest";
import { validateResponse } from "@design-platform/shared";
import {
  CONTRACT_DOMAINS,
  CONTRACT_REGISTRY,
  getExpectation,
  getExpectationsByDomain,
  getRegistryStats,
  validateRegistry,
} from "../../src/contracts";

describe("契约注册表 12 域覆盖", () => {
  it("CONTRACT_DOMAINS 应包含 12 个业务域", () => {
    expect(CONTRACT_DOMAINS).toHaveLength(12);
    expect(CONTRACT_DOMAINS).toEqual(
      expect.arrayContaining([
        "auth",
        "iam",
        "portfolio",
        "workflow",
        "cde",
        "ai",
        "tevv",
        "design",
        "compliance",
        "coordination",
        "change",
        "operations",
      ]),
    );
  });

  it("每个域应至少注册 1 个契约期望", () => {
    for (const domain of CONTRACT_DOMAINS) {
      const expectations = CONTRACT_REGISTRY.filter((e) => e.domain === domain);
      expect(expectations.length, `域 ${domain} 无契约期望`).toBeGreaterThan(0);
    }
  });

  it("契约总数应等于各域契约数之和", () => {
    const domainTotal = CONTRACT_REGISTRY.length;
    const sumByDomain = CONTRACT_DOMAINS.reduce(
      (sum, domain) => sum + getExpectationsByDomain(domain).length,
      0,
    );
    expect(domainTotal).toBe(sumByDomain);
  });
});

describe("契约字段完整性", () => {
  it("contractId 应全局唯一", () => {
    const ids = CONTRACT_REGISTRY.map((e) => e.contractId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("每个契约应包含完整字段", () => {
    for (const e of CONTRACT_REGISTRY) {
      expect(e.contractId, e.contractId).toMatch(/^[a-z0-9-]+-v\d+$/);
      expect(e.consumer, e.contractId).toBe("@design-platform/bff");
      expect(e.provider, e.contractId).toBe("@design-platform/core");
      expect(e.path, e.contractId).toMatch(/^\/api\/v1\//);
      expect(e.description, e.contractId).not.toBe("");
      expect(e.version, e.contractId).toMatch(/^\d+\.\d+\.\d+$/);
      expect(["GET", "POST", "PUT", "PATCH", "DELETE"], e.contractId).toContain(
        e.method,
      );
      expect(["passthrough", "soft", "strict"], e.contractId).toContain(
        e.strictness,
      );
    }
  });

  it("validateRegistry 应返回空错误列表", () => {
    expect(validateRegistry()).toEqual([]);
  });
});

describe("查询接口", () => {
  it("getExpectation 应返回匹配的契约（auth-login-v1）", () => {
    const expectation = getExpectation("auth-login-v1");
    expect(expectation).toBeDefined();
    expect(expectation?.method).toBe("POST");
    expect(expectation?.path).toBe("/api/v1/auth/login");
    expect(expectation?.strictness).toBe("strict");
  });

  it("getExpectation 对未知 contractId 应返回 undefined", () => {
    expect(getExpectation("unknown-contract-v1")).toBeUndefined();
  });

  it("getExpectationsByDomain 应只返回该域的契约", () => {
    const auth = getExpectationsByDomain("auth");
    expect(auth.length).toBeGreaterThan(0);
    expect(auth.every((e) => e.domain === "auth")).toBe(true);
  });
});

describe("getRegistryStats", () => {
  it("应返回正确的契约总数", () => {
    expect(getRegistryStats().totalContracts).toBe(CONTRACT_REGISTRY.length);
  });

  it("按域统计之和应等于总数", () => {
    const stats = getRegistryStats();
    const sumByDomain = Object.values(stats.byDomain).reduce(
      (sum, count) => sum + count,
      0,
    );
    expect(sumByDomain).toBe(stats.totalContracts);
  });

  it("严格级别统计应包含 passthrough/soft/strict 三档", () => {
    const stats = getRegistryStats();
    expect(stats.byStrictness).toHaveProperty("passthrough");
    expect(stats.byStrictness).toHaveProperty("soft");
    expect(stats.byStrictness).toHaveProperty("strict");
    const strictTotal =
      stats.byStrictness.passthrough +
      stats.byStrictness.soft +
      stats.byStrictness.strict;
    expect(strictTotal).toBe(stats.totalContracts);
  });

  it("按 Provider 统计应全部归属 core 服务", () => {
    const stats = getRegistryStats();
    expect(stats.byProvider["@design-platform/core"]).toBe(
      stats.totalContracts,
    );
  });
});

describe("安全红线（security.md §2.2 + §12）", () => {
  it("auth 认证端点应使用 strict 级别（防止 token 结构漂移）", () => {
    const strictAuth = getExpectationsByDomain("auth").filter(
      (e) => e.strictness === "strict",
    );
    // login/refresh/me 3 个认证关键端点必须 strict
    expect(strictAuth.length).toBeGreaterThanOrEqual(3);
    expect(strictAuth.map((e) => e.contractId)).toEqual(
      expect.arrayContaining([
        "auth-login-v1",
        "auth-refresh-v1",
        "auth-me-v1",
      ]),
    );
  });

  it("AI 方案生成端点应使用 strict 级别（AI 安全红线）", () => {
    const generate = getExpectation("ai-solution-generate-v1");
    expect(generate?.strictness).toBe("strict");
  });

  it("auth-login 契约的 responseSchema 应通过 validateResponse 软验证", () => {
    const expectation = getExpectation("auth-login-v1");
    expect(expectation).toBeDefined();
    if (expectation === undefined) return;

    const validLogin = {
      principal: {
        id: "0a1b2c3d-4e5f-6789-abcd-ef0123456789",
        tenantId: "123e4567-e89b-12d3-a456-426614174000",
        email: "arch@example.com",
        displayName: "Architect",
        type: "user",
        status: "active",
        locale: "en-US",
        timezone: "UTC",
      },
      accessToken: "jwt-token-abc",
      accessTokenExpiresIn: 900,
      refreshTokenSet: true,
      tenant: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Demo",
        code: "DEMO",
        region: "us-east",
        language: "en",
      },
      roles: ["ARCHITECT"],
      permissions: ["project:read"],
    };

    const result = validateResponse(expectation, validLogin);
    expect(result.success, JSON.stringify(result.errors)).toBe(true);
  });
});
