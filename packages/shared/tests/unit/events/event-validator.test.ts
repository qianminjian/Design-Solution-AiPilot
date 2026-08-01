/**
 * 事件校验工具单元测试（P0-2.2 Event/AsyncAPI 契约）
 *
 * 覆盖 D35.22/24 事件语义场景：
 * - 分区 key（tenantId/aggregateId 组合保序）
 * - 去重（按 id 幂等，重投不变）
 * - 顺序分类（in-order/duplicate/late/out-of-order）
 * - 缺口检测（事件丢失 → 回源/补发）
 * - 有界重试（超过上限进入 DLQ）
 * - DLQ 判定（retry_exhausted/unrecoverable/schema_incompatible）
 * - upcast 事件升级（Schema Evolution）
 * - schema 版本解析
 *
 * 权威源：@design/D35-API-事件契约.md §D35.22 安全、异常与恢复 + §D35.24 验收条件
 */
import { describe, it, expect } from "vitest";
import type { CloudEvent } from "../../../src/events";
import {
  buildEventKey,
  classifyOrdering,
  detectGaps,
  isDuplicate,
  parseSchemaVersion,
  shouldRetry,
  toDlqReason,
  upcastEvent,
} from "../../../src/events";

/** 构造指定版本与 id 的 CloudEvent 信封 */
function makeEvent(version: number, id: string): CloudEvent {
  return {
    specversion: "1.0",
    id,
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

describe("buildEventKey（分区 key）", () => {
  it("应按 tenantId/aggregateId 组合生成分区 key", () => {
    expect(buildEventKey(makeEvent(1, "e-001"))).toBe("t-001/cr-001");
  });

  it("相同聚合不同租户应生成不同分区 key", () => {
    const eventA = makeEvent(1, "e-001");
    const eventB = {
      ...eventA,
      extensions: { ...eventA.extensions, tenantId: "t-002" },
    };
    expect(buildEventKey(eventA)).not.toBe(buildEventKey(eventB));
  });
});

describe("isDuplicate（去重）", () => {
  it("已处理 id 应判定为重复", () => {
    const processed = new Set(["e-001", "e-002"]);
    expect(isDuplicate(makeEvent(1, "e-001"), processed)).toBe(true);
  });

  it("未处理 id 应判定为非重复", () => {
    const processed = new Set(["e-001"]);
    expect(isDuplicate(makeEvent(2, "e-002"), processed)).toBe(false);
  });
});

describe("classifyOrdering（顺序分类）", () => {
  it("version = lastVersion + 1 应判定为 in-order", () => {
    expect(classifyOrdering(makeEvent(4, "e-004"), 3)).toBe("in-order");
  });

  it("version = lastVersion 应判定为 duplicate（重放）", () => {
    expect(classifyOrdering(makeEvent(3, "e-003"), 3)).toBe("duplicate");
  });

  it("version < lastVersion 应判定为 late（迟到）", () => {
    expect(classifyOrdering(makeEvent(2, "e-002"), 5)).toBe("late");
  });

  it("version > lastVersion + 1 应判定为 out-of-order（乱序）", () => {
    expect(classifyOrdering(makeEvent(6, "e-006"), 3)).toBe("out-of-order");
  });

  it("已按 id 处理过的事件应判定为 duplicate（即使 version 更高）", () => {
    expect(classifyOrdering(makeEvent(3, "e-003"), 2, true)).toBe("duplicate");
  });
});

describe("detectGaps（缺口检测）", () => {
  it("连续版本应返回空缺口", () => {
    expect(detectGaps([1, 2, 3, 4, 5])).toEqual([]);
  });

  it("存在缺失版本应返回升序缺口列表", () => {
    expect(detectGaps([1, 2, 4, 5, 7])).toEqual([3, 6]);
  });

  it("空输入应返回空列表", () => {
    expect(detectGaps([])).toEqual([]);
  });

  it("重复版本应去重后再检测", () => {
    expect(detectGaps([1, 1, 2, 2, 4])).toEqual([3]);
  });
});

describe("shouldRetry（有界重试）", () => {
  it("attempt < maxAttempts 且可重试应继续重试", () => {
    expect(shouldRetry(2, 3, true)).toBe(true);
  });

  it("attempt 达到上限应停止重试", () => {
    expect(shouldRetry(3, 3, true)).toBe(false);
  });

  it("不可重试错误应停止重试", () => {
    expect(shouldRetry(0, 3, false)).toBe(false);
  });
});

describe("toDlqReason（DLQ 判定）", () => {
  it("重试超限应进入 DLQ（retry_exhausted）", () => {
    expect(toDlqReason(3, 3, true, true)).toBe("retry_exhausted");
  });

  it("不可恢复错误应进入 DLQ（unrecoverable_error）", () => {
    expect(toDlqReason(0, 3, false, true)).toBe("unrecoverable_error");
  });

  it("schema 不兼容应进入 DLQ（schema_incompatible）", () => {
    expect(toDlqReason(0, 3, true, false)).toBe("schema_incompatible");
  });

  it("未达 DLQ 条件应返回 null", () => {
    expect(toDlqReason(1, 3, true, true)).toBeNull();
  });
});

describe("upcastEvent（Schema Evolution）", () => {
  it("存在迁移函数时应成功升级事件", () => {
    const upcasters = {
      "1->2": (event: CloudEvent): CloudEvent => ({
        ...event,
        dataschema:
          "https://schema.aipilot.local/change/change-request-created/2",
        data: {
          ...(event.data as Record<string, unknown>),
          priority: "medium",
        },
      }),
    };
    const result = upcastEvent(makeEvent(1, "e-001"), "1", "2", upcasters);
    expect(result).not.toBeNull();
    expect(result?.dataschema).toContain("/2");
    expect((result?.data as Record<string, unknown>).priority).toBe("medium");
  });

  it("缺少迁移函数应返回 null（由调用方决定进入 DLQ）", () => {
    expect(upcastEvent(makeEvent(1, "e-001"), "1", "3", {})).toBeNull();
  });

  it("upcast 修改信封字段应抛异常", () => {
    const upcasters = {
      "1->2": (event: CloudEvent): CloudEvent => ({
        ...event,
        id: "changed-id",
      }),
    };
    expect(() =>
      upcastEvent(makeEvent(1, "e-001"), "1", "2", upcasters),
    ).toThrow(/不得修改信封字段/);
  });
});

describe("parseSchemaVersion（版本解析）", () => {
  it("应从 dataschema URI 提取版本号", () => {
    expect(
      parseSchemaVersion(
        "https://schema.aipilot.local/change/change-request-created/1",
      ),
    ).toBe("1");
  });

  it("URI 不以数字结尾应返回 null", () => {
    expect(
      parseSchemaVersion("https://schema.aipilot.local/change/v2"),
    ).toBeNull();
  });
});
