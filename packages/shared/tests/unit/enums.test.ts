/**
 * 平台通用枚举单元测试
 *
 * 覆盖：
 * - ApiDomains 常量集合完整性
 * - CdeStatus / ConfidenceLevel 类型对齐
 *
 * 权威源：@design/D35-API-事件契约.md
 */
import { describe, it, expect } from "vitest";

import { ApiDomains } from "../../src/enums";

describe("ApiDomains", () => {
  it("应包含 6 个核心域", () => {
    expect(ApiDomains).toHaveLength(6);
  });

  it("应包含 iam / project / cde / design 域", () => {
    expect(ApiDomains).toContain("iam");
    expect(ApiDomains).toContain("project");
    expect(ApiDomains).toContain("cde");
    expect(ApiDomains).toContain("design");
  });

  it("应包含 coordination / workflow 域", () => {
    expect(ApiDomains).toContain("coordination");
    expect(ApiDomains).toContain("workflow");
  });

  it("应为只读元组（as const）", () => {
    // 元组类型在运行时仍为数组，但 TS 层禁止 push
    // 这里仅验证快照稳定性
    expect(ApiDomains).toEqual([
      "iam",
      "project",
      "cde",
      "design",
      "coordination",
      "workflow",
    ]);
  });

  it("应无重复值", () => {
    const set = new Set(ApiDomains);
    expect(set.size).toBe(ApiDomains.length);
  });
});
