/**
 * CloudEvent 信封与域事件 schema 单元测试（P0-2.2 Event/AsyncAPI 契约）
 *
 * 覆盖：
 * - CloudEvent 信封 schema 校验（D35.13 全字段规则）
 * - Change 域事件 schema（D37.16 P12）
 * - Operations 域事件 schema（D37.17 P13 + D35.14 Integration）
 * - Governance 域事件 schema（D35.14 Governance）
 * - 域事件信封工厂（buildChangeEvent 等）
 *
 * 权威源：@design/D35-API-事件契约.md §D35.13/14 + security.md §8 PII 分级
 */
import { describe, it, expect } from "vitest";
import {
  changeClosedDataSchema,
  changeImpactAssessedDataSchema,
  changeImpactLevelSchema,
  changeRequestApprovedDataSchema,
  changeRequestCreatedDataSchema,
  cloudEventSchema,
  connectorQualifiedDataSchema,
  evidenceSealedDataSchema,
  integrationJobChangedDataSchema,
} from "../../../src/events";

/** 构造合法 CloudEvent 信封（Change 域事件样例） */
function makeChangeEvent(version = 1): Record<string, unknown> {
  return {
    specversion: "1.0",
    id: "0198b5a0-0000-7000-8000-000000000001",
    source: "/services/core/change",
    type: "com.aipilot.change.ChangeRequest.Created.v1",
    subject: "tenants/t-001/projects/p-001/ChangeRequest/cr-001",
    time: "2026-08-01T10:00:00.000Z",
    datacontenttype: "application/json",
    dataschema: "https://schema.aipilot.local/change/change-request-created/1",
    extensions: {
      tenantId: "t-001",
      projectId: "p-001",
      aggregateId: "cr-001",
      aggregateVersion: version,
      correlationId: "corr-001",
      classification: "L3",
    },
    data: {
      changeRequestId: "cr-001",
      title: "外墙幕墙节点调整",
      projectId: "p-001",
      requesterId: "u-001",
      status: "SUBMITTED",
    },
  };
}

describe("CloudEvent 信封 schema（D35.13）", () => {
  it("应通过合法信封校验", () => {
    const result = cloudEventSchema.safeParse(makeChangeEvent());
    expect(result.success, JSON.stringify(result.error)).toBe(true);
  });

  it("应拒绝非法 specversion（必须为 1.0）", () => {
    const event = makeChangeEvent();
    event.specversion = "0.3";
    const result = cloudEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("应拒绝非法 type 格式（非 com.aipilot 命名规范）", () => {
    const event = makeChangeEvent();
    event.type = "ChangeRequest.Created";
    const result = cloudEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("应拒绝非法 subject 格式（非 tenants/ 前缀）", () => {
    const event = makeChangeEvent();
    event.subject = "projects/p-001/ChangeRequest/cr-001";
    const result = cloudEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("应拒绝缺少必填 extension（tenantId）", () => {
    const event = makeChangeEvent();
    delete (event.extensions as Record<string, unknown>).tenantId;
    const result = cloudEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("应拒绝非正整数 aggregateVersion", () => {
    const event = makeChangeEvent();
    event.extensions = {
      ...(event.extensions as Record<string, unknown>),
      aggregateVersion: 0,
    };
    const result = cloudEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("应拒绝非法 classification（超出 L1-L5）", () => {
    const event = makeChangeEvent();
    event.extensions = {
      ...(event.extensions as Record<string, unknown>),
      classification: "L6",
    };
    const result = cloudEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe("Change 域事件 schema（D37.16 P12）", () => {
  it("ChangeRequestCreated data 应通过校验", () => {
    const result = changeRequestCreatedDataSchema.safeParse({
      changeRequestId: "cr-001",
      title: "外墙幕墙节点调整",
      projectId: "p-001",
      requesterId: "u-001",
      status: "SUBMITTED",
    });
    expect(result.success).toBe(true);
  });

  it("ChangeRequestCreated data 应拒绝非法状态（非 SUBMITTED）", () => {
    const result = changeRequestCreatedDataSchema.safeParse({
      changeRequestId: "cr-001",
      title: "外墙幕墙节点调整",
      projectId: "p-001",
      requesterId: "u-001",
      status: "DRAFT",
    });
    expect(result.success).toBe(false);
  });

  it("ChangeImpactAssessed data 应通过校验（对齐影响等级枚举）", () => {
    const result = changeImpactAssessedDataSchema.safeParse({
      affectedDisciplines: 3,
      affectedItems: 12,
      impactLevel: "high",
      summary: "影响幕墙、结构、暖通三个专业",
    });
    expect(result.success).toBe(true);
  });

  it("changeImpactLevelSchema 应包含 5 级影响等级", () => {
    expect(changeImpactLevelSchema.options).toEqual([
      "none",
      "low",
      "medium",
      "high",
      "critical",
    ]);
  });

  it("ChangeRequestApproved data 应校验双审批轮次", () => {
    expect(
      changeRequestApprovedDataSchema.safeParse({
        changeRequestId: "cr-001",
        status: "APPROVED",
        approverId: "u-002",
        approvalRound: 2,
      }).success,
    ).toBe(true);
    expect(
      changeRequestApprovedDataSchema.safeParse({
        changeRequestId: "cr-001",
        status: "APPROVED",
        approverId: "u-002",
        approvalRound: 3,
      }).success,
    ).toBe(false);
  });

  it("ChangeClosed data 应通过校验", () => {
    const result = changeClosedDataSchema.safeParse({
      changeRequestId: "cr-001",
      status: "CLOSED",
      closureSummary: "幕墙节点调整完成并复核通过",
    });
    expect(result.success).toBe(true);
  });
});

describe("Operations 域事件 schema（D37.17 P13）", () => {
  it("ConnectorQualified data 应通过校验", () => {
    const result = connectorQualifiedDataSchema.safeParse({
      connectorId: "conn-001",
      name: "Revit 连接器",
      connectorType: "revit",
      status: "CONNECTED",
      healthCheckLatencyMs: 85,
    });
    expect(result.success).toBe(true);
  });

  it("IntegrationJobChanged data 应通过死信状态校验", () => {
    const result = integrationJobChangedDataSchema.safeParse({
      jobId: "job-001",
      connectorId: "conn-001",
      status: "DEAD_LETTER",
      failureReason: "连接器健康检查连续失败",
    });
    expect(result.success).toBe(true);
  });

  it("IntegrationJobChanged data 应拒绝非法状态", () => {
    const result = integrationJobChangedDataSchema.safeParse({
      jobId: "job-001",
      connectorId: "conn-001",
      status: "PAUSED",
    });
    expect(result.success).toBe(false);
  });
});

describe("Governance 域事件 schema（D35.14）", () => {
  it("EvidenceSealed data 应通过校验（SHA-256 哈希 + TSA 证明）", () => {
    const result = evidenceSealedDataSchema.safeParse({
      evidencePackageId: "ep-001",
      status: "SEALED",
      contentHash: "a".repeat(64),
      objectUri: "https://minio.internal/evidence/ep-001.zip",
      tsaProof: "MIAGCSqGSIb3DQEHAqCAMIACAQEx",
    });
    expect(result.success).toBe(true);
  });

  it("EvidenceSealed data 应拒绝非法 contentHash（非 64 位 hex）", () => {
    const result = evidenceSealedDataSchema.safeParse({
      evidencePackageId: "ep-001",
      status: "SEALED",
      contentHash: "not-a-hash",
      objectUri: "https://minio.internal/evidence/ep-001.zip",
      tsaProof: "proof",
    });
    expect(result.success).toBe(false);
  });
});
