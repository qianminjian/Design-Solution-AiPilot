/**
 * Workflow 域 Zod Schema 单元测试
 *
 * 验证：
 *  - schema 与 workflow.contract.ts 类型对齐
 *  - 复用 portfolio.schema 的实体 DTO
 *  - workflow 域特有请求 schema 的正例与负例
 */
import { describe, it, expect } from "vitest";
import {
  listStageInstancesRequestSchema,
  listGateDecisionsRequestSchema,
} from "../../../src/schemas/workflow.schema";

describe("listStageInstancesRequestSchema", () => {
  it("应该接受合法的列表请求（仅 projectId）", () => {
    const valid = {
      projectId: "550e8400-e29b-41d4-a716-446655440000",
    };
    const result = listStageInstancesRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该接受含 status 与 stageCode 的请求", () => {
    const valid = {
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      status: "active",
      stageCode: "STG-P0",
    };
    const result = listStageInstancesRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该拒绝非 UUID 的 projectId", () => {
    const result = listStageInstancesRequestSchema.safeParse({
      projectId: "not-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝缺失 projectId", () => {
    const result = listStageInstancesRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("listGateDecisionsRequestSchema", () => {
  it("应该接受合法的列表请求（仅 stageId）", () => {
    const valid = {
      stageId: "550e8400-e29b-41d4-a716-446655440000",
    };
    const result = listGateDecisionsRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该接受含 status 与 decision 的请求", () => {
    const valid = {
      stageId: "550e8400-e29b-41d4-a716-446655440000",
      status: "pending",
      decision: "approved",
    };
    const result = listGateDecisionsRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("应该拒绝非 UUID 的 stageId", () => {
    const result = listGateDecisionsRequestSchema.safeParse({
      stageId: "not-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("应该拒绝缺失 stageId", () => {
    const result = listGateDecisionsRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
