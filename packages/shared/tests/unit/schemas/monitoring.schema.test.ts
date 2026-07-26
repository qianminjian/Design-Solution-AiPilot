/**
 * Monitoring 域 Zod Schema 单元测试
 *
 * 验证：
 *  - schema 与 use-monitoring.ts hooks 中使用的字段对齐
 *  - 正例：合法 fixture 通过校验
 *  - 负例：缺字段、错误枚举值、非 ISO datetime 被拒绝
 */
import { describe, it, expect } from "vitest";
import {
  serviceHealthSchema,
  healthCheckResultSchema,
  schemaValidationStatsSchema,
} from "../../../src/schemas/monitoring.schema";

const validServiceHealth = {
  status: "UP",
  details: { latency: 50 },
  error: undefined,
};

describe("serviceHealthSchema", () => {
  it("应该接受合法的 UP 状态", () => {
    const result = serviceHealthSchema.safeParse(validServiceHealth);
    expect(result.success).toBe(true);
  });

  it("应该接受 DOWN 状态", () => {
    const result = serviceHealthSchema.safeParse({
      status: "DOWN",
      error: "Connection refused",
    });
    expect(result.success).toBe(true);
  });

  it("应该接受无 details 的简略形式", () => {
    const result = serviceHealthSchema.safeParse({ status: "UP" });
    expect(result.success).toBe(true);
  });

  it("应该拒绝非法 status 枚举值", () => {
    const result = serviceHealthSchema.safeParse({ status: "UNKNOWN" });
    expect(result.success).toBe(false);
  });

  it("应该拒绝缺失 status", () => {
    const result = serviceHealthSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("healthCheckResultSchema", () => {
  const valid = {
    status: "UP",
    services: {
      bff: { status: "UP" },
      core: { status: "UP" },
      ai: { status: "UP" },
      postgresql: { status: "UP" },
      minio: { status: "UP" },
    },
    schemaValidation: {
      softTotal: 0,
      strictTotal: 0,
      softFailures: {},
      strictFailures: {},
    },
    timestamp: "2026-07-25T08:00:00.000Z",
  };

  it("应该接受合法的健康检查响应", () => {
    const result = healthCheckResultSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该接受整体 DOWN 状态", () => {
    const result = healthCheckResultSchema.safeParse({
      ...valid,
      status: "DOWN",
    });
    expect(result.success).toBe(true);
  });

  it("应该接受子服务 DOWN 状态", () => {
    const result = healthCheckResultSchema.safeParse({
      ...valid,
      services: {
        ...valid.services,
        postgresql: { status: "DOWN", error: "Connection refused" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("应该拒绝缺失 services.postgresql", () => {
    const { postgresql: _removed, ...rest } = valid.services;
    const result = healthCheckResultSchema.safeParse({
      ...valid,
      services: rest,
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝 timestamp 非 ISO datetime", () => {
    const result = healthCheckResultSchema.safeParse({
      ...valid,
      timestamp: "2026-07-25 08:00:00",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝缺失 timestamp", () => {
    const { timestamp: _removed, ...rest } = valid;
    const result = healthCheckResultSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("应该拒绝非法 status 枚举值", () => {
    const result = healthCheckResultSchema.safeParse({
      ...valid,
      status: "UNKNOWN",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝缺失 schemaValidation 字段", () => {
    const { schemaValidation: _removed, ...rest } = valid;
    const result = healthCheckResultSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe("schemaValidationStatsSchema", () => {
  const valid = {
    softTotal: 3,
    strictTotal: 1,
    softFailures: {
      "ai.generateDesign": {
        AigenerationRecordSchema: {
          count: 3,
          lastTraceId: "trace-abc-001",
          lastFailedAt: "2026-07-25T08:00:00.000Z",
        },
      },
    },
    strictFailures: {
      "auth.login": {
        LoginResponseSchema: {
          count: 1,
          lastTraceId: "trace-xyz-002",
          lastFailedAt: "2026-07-25T08:01:00.000Z",
        },
      },
    },
  };

  it("应该接受合法的 schema 验证统计", () => {
    const result = schemaValidationStatsSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该接受空快照", () => {
    const result = schemaValidationStatsSchema.safeParse({
      softTotal: 0,
      strictTotal: 0,
      softFailures: {},
      strictFailures: {},
    });
    expect(result.success).toBe(true);
  });

  it("应该接受无 lastTraceId/lastFailedAt 的简化条目", () => {
    const result = schemaValidationStatsSchema.safeParse({
      softTotal: 1,
      strictTotal: 0,
      softFailures: {
        "project.list": { ProjectSchema: { count: 1 } },
      },
      strictFailures: {},
    });
    expect(result.success).toBe(true);
  });

  it("应该拒绝负数 softTotal", () => {
    const result = schemaValidationStatsSchema.safeParse({
      ...valid,
      softTotal: -1,
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝负数 strictTotal", () => {
    const result = schemaValidationStatsSchema.safeParse({
      ...valid,
      strictTotal: -2,
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝非 ISO datetime 的 lastFailedAt", () => {
    const result = schemaValidationStatsSchema.safeParse({
      ...valid,
      softFailures: {
        "ai.generateDesign": {
          AigenerationRecordSchema: {
            count: 3,
            lastTraceId: "trace-abc-001",
            lastFailedAt: "2026-07-25 08:00:00",
          },
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝负数 count", () => {
    const result = schemaValidationStatsSchema.safeParse({
      ...valid,
      softFailures: {
        "ai.generateDesign": {
          AigenerationRecordSchema: { count: -1 },
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝缺失 softFailures 字段", () => {
    const { softFailures: _removed, ...rest } = valid;
    const result = schemaValidationStatsSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("应该拒绝缺失 strictFailures 字段", () => {
    const { strictFailures: _removed, ...rest } = valid;
    const result = schemaValidationStatsSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
