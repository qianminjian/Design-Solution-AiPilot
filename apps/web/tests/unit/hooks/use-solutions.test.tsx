/**
 * useSolutions hook 单元测试
 *
 * 验证：
 *  - PROMPT_TEMPLATE_OPTIONS 包含 4 个预定义模板
 *  - TEMPLATE_VARIABLES 与模板列表对应
 *  - getTemplateVariables 已知模板返回变量列表，未知返回空数组
 *  - getTemplateLabel 已知模板返回 label，未知返回 templateName
 */
import { describe, it, expect } from "vitest";

import {
  PROMPT_TEMPLATE_OPTIONS,
  TEMPLATE_VARIABLES,
  getTemplateVariables,
  getTemplateLabel,
} from "@/hooks/use-solutions";

describe("PROMPT_TEMPLATE_OPTIONS", () => {
  it("应包含 4 个预定义模板", () => {
    expect(PROMPT_TEMPLATE_OPTIONS).toHaveLength(4);
  });

  it("应包含 concept-generation 模板", () => {
    const tpl = PROMPT_TEMPLATE_OPTIONS.find(
      (t) => t.name === "concept-generation",
    );
    expect(tpl).toBeDefined();
    expect(tpl?.label).toBe("概念方案生成");
  });

  it("应包含 scheme-deepening 模板", () => {
    const tpl = PROMPT_TEMPLATE_OPTIONS.find(
      (t) => t.name === "scheme-deepening",
    );
    expect(tpl).toBeDefined();
    expect(tpl?.label).toBe("方案深化建议");
  });

  it("应包含 design-option-comparison 模板", () => {
    const tpl = PROMPT_TEMPLATE_OPTIONS.find(
      (t) => t.name === "design-option-comparison",
    );
    expect(tpl).toBeDefined();
    expect(tpl?.label).toBe("方案比选分析");
  });

  it("应包含 design-summary 模板", () => {
    const tpl = PROMPT_TEMPLATE_OPTIONS.find(
      (t) => t.name === "design-summary",
    );
    expect(tpl).toBeDefined();
    expect(tpl?.label).toBe("方案摘要");
  });

  it("所有模板都应有 name/label/description 字段", () => {
    for (const tpl of PROMPT_TEMPLATE_OPTIONS) {
      expect(tpl.name).toBeTruthy();
      expect(tpl.label).toBeTruthy();
      expect(tpl.description).toBeTruthy();
    }
  });
});

describe("TEMPLATE_VARIABLES", () => {
  it("concept-generation 应包含 4 个变量", () => {
    expect(TEMPLATE_VARIABLES["concept-generation"]).toHaveLength(4);
    const keys = TEMPLATE_VARIABLES["concept-generation"]?.map((v) => v.key);
    expect(keys).toEqual([
      "siteDescription",
      "brief",
      "referenceImages",
      "constraints",
    ]);
  });

  it("scheme-deepening 应包含 3 个变量", () => {
    expect(TEMPLATE_VARIABLES["scheme-deepening"]).toHaveLength(3);
    const keys = TEMPLATE_VARIABLES["scheme-deepening"]?.map((v) => v.key);
    expect(keys).toEqual(["conceptBaseline", "deepeningScope", "focusAspects"]);
  });

  it("design-option-comparison 应包含 3 个变量", () => {
    expect(TEMPLATE_VARIABLES["design-option-comparison"]).toHaveLength(3);
  });

  it("design-summary 应包含 1 个变量", () => {
    expect(TEMPLATE_VARIABLES["design-summary"]).toHaveLength(1);
  });

  it("所有变量都应有 key/label/placeholder/required 字段", () => {
    for (const vars of Object.values(TEMPLATE_VARIABLES)) {
      for (const v of vars) {
        expect(v.key).toBeTruthy();
        expect(v.label).toBeTruthy();
        expect(v.placeholder).toBeDefined();
        expect(typeof v.required).toBe("boolean");
      }
    }
  });
});

describe("getTemplateVariables", () => {
  it("已知模板应返回变量列表", () => {
    const vars = getTemplateVariables("concept-generation");
    expect(vars).toHaveLength(4);
    expect(vars[0]?.key).toBe("siteDescription");
  });

  it("未知模板应返回空数组", () => {
    const vars = getTemplateVariables("non-existent-template");
    expect(vars).toEqual([]);
  });

  it("空字符串应返回空数组", () => {
    const vars = getTemplateVariables("");
    expect(vars).toEqual([]);
  });
});

describe("getTemplateLabel", () => {
  it("已知模板应返回 label", () => {
    expect(getTemplateLabel("concept-generation")).toBe("概念方案生成");
    expect(getTemplateLabel("scheme-deepening")).toBe("方案深化建议");
    expect(getTemplateLabel("design-option-comparison")).toBe("方案比选分析");
    expect(getTemplateLabel("design-summary")).toBe("方案摘要");
  });

  it("未知模板应返回 templateName 原值", () => {
    expect(getTemplateLabel("unknown-template")).toBe("unknown-template");
  });

  it("空字符串应返回空字符串", () => {
    expect(getTemplateLabel("")).toBe("");
  });
});
