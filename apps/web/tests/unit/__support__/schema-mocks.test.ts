import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  generateMockFromSchema,
  createMockFromSchema,
} from "../../__support__/schema-mocks";
import {
  authContextSchema,
  loginResponseSchema,
  projectDtoSchema,
  generateSolutionResponseSchema,
  textGenerationResponseSchema,
  promptTemplateDtoSchema,
  decideGateRequestSchema,
  createProjectRequestSchema,
  designOptionDtoSchema,
  designFeedbackDtoSchema,
  documentDtoSchema,
  documentVersionDtoSchema,
  stageInstanceDtoSchema,
  gateDecisionDtoSchema,
  complianceRuleDtoSchema,
  complianceCheckRunDtoSchema,
  checkResultDtoSchema,
  ruleRevisionDtoSchema,
  aiGenerationRecordDtoSchema,
  goldenDatasetDtoSchema,
  updateRuleRequestSchema,
  aiRagQueryResponseSchema,
  complianceFindingSchema,
  gateSummarySchema,
  bcfIssueSchema,
  healthCheckResultSchema,
} from "@design-platform/shared";

describe("schema-mocks", () => {
  describe("基础 zod 类型支持", () => {
    it("应该为 ZodObject 递归生成所有字段", () => {
      const userSchema = z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        age: z.number().int().nonnegative(),
        isActive: z.boolean(),
      });
      const mock = generateMockFromSchema(userSchema);
      expect(mock).toEqual({
        id: expect.any(String),
        name: expect.any(String),
        age: expect.any(Number),
        isActive: false,
      });
      // 生成的 mock 应该通过 schema 验证
      expect(userSchema.safeParse(mock).success).toBe(true);
    });

    it("应该为 ZodString 的 uuid 格式生成 UUID", () => {
      const schema = z.object({ id: z.string().uuid() });
      const mock = generateMockFromSchema(schema);
      expect(mock.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("应该为 ZodString 的 email 格式生成邮箱", () => {
      const schema = z.object({ email: z.string().email() });
      const mock = generateMockFromSchema(schema);
      expect(mock.email).toBe("mock@example.com");
    });

    it("应该为 ZodString 的 datetime 格式生成 ISO 时间", () => {
      const schema = z.object({ createdAt: z.string().datetime() });
      const mock = generateMockFromSchema(schema);
      expect(mock.createdAt).toBe("2026-07-22T00:00:00.000Z");
      expect(new Date(mock.createdAt).toString()).not.toBe("Invalid Date");
    });

    it("应该为 ZodString 的 url 格式生成 URL", () => {
      const schema = z.object({ url: z.string().url() });
      const mock = generateMockFromSchema(schema);
      expect(mock.url).toBe("https://mock.example.com/path");
    });

    it("应该为 ZodString 的 min 长度约束填充字符串", () => {
      const schema = z.object({ name: z.string().min(10) });
      const mock = generateMockFromSchema(schema);
      expect(mock.name.length).toBeGreaterThanOrEqual(10);
    });

    it("应该为 ZodNumber 的 min 约束生成符合下限的值", () => {
      const schema = z.object({ age: z.number().int().min(18) });
      const mock = generateMockFromSchema(schema);
      expect(mock.age).toBeGreaterThanOrEqual(18);
      expect(Number.isInteger(mock.age)).toBe(true);
    });

    it("应该为 ZodNumber 的 positive 约束生成正数", () => {
      const schema = z.object({ count: z.number().int().positive() });
      const mock = generateMockFromSchema(schema);
      expect(mock.count).toBeGreaterThan(0);
    });

    it("应该为 ZodNumber 的 max 约束生成不超过上限的值", () => {
      const schema = z.object({ score: z.number().int().min(0).max(100) });
      const mock = generateMockFromSchema(schema);
      expect(mock.score).toBeGreaterThanOrEqual(0);
      expect(mock.score).toBeLessThanOrEqual(100);
    });

    it("应该为 ZodBoolean 生成 false", () => {
      const schema = z.object({ isActive: z.boolean() });
      const mock = generateMockFromSchema(schema);
      expect(mock.isActive).toBe(false);
    });

    it("应该为 ZodEnum 取第一个值", () => {
      const schema = z.object({
        status: z.enum(["active", "on_hold", "completed"]),
      });
      const mock = generateMockFromSchema(schema);
      expect(mock.status).toBe("active");
    });

    it("应该为 ZodLiteral 取字面值", () => {
      const schema = z.object({ isAiAssisted: z.literal(true) });
      const mock = generateMockFromSchema(schema);
      expect(mock.isAiAssisted).toBe(true);
    });

    it("应该为 ZodArray 生成单元素数组", () => {
      const schema = z.object({
        items: z.array(z.string().min(1)),
      });
      const mock = generateMockFromSchema(schema);
      expect(Array.isArray(mock.items)).toBe(true);
      expect(mock.items).toHaveLength(1);
    });

    it("应该为 ZodOptional 生成内层默认值", () => {
      const schema = z.object({
        nickname: z.string().min(1).optional(),
      });
      const mock = generateMockFromSchema(schema);
      expect(mock.nickname).toBe("mock-string");
    });

    it("应该为 ZodNullable 生成内层默认值", () => {
      const schema = z.object({
        description: z.string().nullable(),
      });
      const mock = generateMockFromSchema(schema);
      expect(mock.description).toBe("mock-string");
    });

    it("应该为 ZodRecord 生成空对象", () => {
      const schema = z.object({
        settings: z.record(z.unknown()),
      });
      const mock = generateMockFromSchema(schema);
      expect(mock.settings).toEqual({});
    });
  });

  describe("overrides 深度合并", () => {
    it("应该用 overrides 覆盖顶层字段", () => {
      const schema = z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
      });
      const mock = generateMockFromSchema(schema, { name: "custom-name" });
      expect(mock.name).toBe("custom-name");
      expect(mock.id).toMatch(/^[0-9a-f-]+$/);
    });

    it("应该深度合并嵌套对象", () => {
      const addressSchema = z.object({
        city: z.string().min(1),
        country: z.string().min(1),
      });
      const userSchema = z.object({
        name: z.string().min(1),
        address: addressSchema,
      });
      // DeepPartial<T> 递归让嵌套属性可选，仅覆盖 city，deepMerge 保留 country 默认值
      const mock = generateMockFromSchema(userSchema, {
        address: { city: "Shanghai" },
      });
      expect(mock.address.city).toBe("Shanghai");
      expect(mock.address.country).toBe("mock-string"); // 保留默认值
    });

    it("应该用数组整体替换默认数组", () => {
      const schema = z.object({
        items: z.array(z.string().min(1)),
      });
      const mock = generateMockFromSchema(schema, { items: ["a", "b", "c"] });
      expect(mock.items).toEqual(["a", "b", "c"]);
    });
  });

  describe("createMockFromSchema 通用工厂", () => {
    it("应该从任意 schema 生成 mock 并保留类型", () => {
      const schema = z.object({
        id: z.string().uuid(),
        count: z.number().int().positive(),
      });
      const mock = createMockFromSchema(schema);
      expect(mock.id).toMatch(/^[0-9a-f-]+$/);
      expect(mock.count).toBeGreaterThan(0);
    });
  });

  describe("实际项目 schema 集成测试", () => {
    it("应该为 authContextSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(authContextSchema);
      const result = authContextSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 loginResponseSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(loginResponseSchema);
      const result = loginResponseSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 projectDtoSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(projectDtoSchema);
      const result = projectDtoSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 generateSolutionResponseSchema 生成有效 mock，强制 isAiAssisted=true", () => {
      const mock = generateMockFromSchema(generateSolutionResponseSchema);
      expect(mock.isAiAssisted).toBe(true);
      const result = generateSolutionResponseSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 textGenerationResponseSchema 生成有效 mock，强制 isAiAssisted=true", () => {
      const mock = generateMockFromSchema(textGenerationResponseSchema);
      expect(mock.isAiAssisted).toBe(true);
      const result = textGenerationResponseSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 promptTemplateDtoSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(promptTemplateDtoSchema);
      const result = promptTemplateDtoSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 decideGateRequestSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(decideGateRequestSchema);
      const result = decideGateRequestSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 createProjectRequestSchema 生成有效 mock（含 refine 约束）", () => {
      const mock = generateMockFromSchema(createProjectRequestSchema);
      const result = createProjectRequestSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该支持覆盖 generateSolutionResponseSchema 的 candidates 字段", () => {
      const mock = generateMockFromSchema(generateSolutionResponseSchema, {
        candidates: [
          {
            name: "Tower方案",
            content: "## Tower\n- 10F\n- 12000 m²",
            risks: ["用地偏紧"],
            feasibilityNotes: "结构可行",
          },
        ],
        riskLevel: "high",
      });
      expect(mock.candidates).toHaveLength(1);
      expect(mock.candidates[0]?.name).toBe("Tower方案");
      expect(mock.riskLevel).toBe("high");
      expect(mock.isAiAssisted).toBe(true); // 保留默认值
      const result = generateSolutionResponseSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });
  });

  describe("hooks schema 集成测试", () => {
    it("应该为 designOptionDtoSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(designOptionDtoSchema);
      const result = designOptionDtoSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 designFeedbackDtoSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(designFeedbackDtoSchema);
      const result = designFeedbackDtoSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 documentDtoSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(documentDtoSchema);
      const result = documentDtoSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 documentVersionDtoSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(documentVersionDtoSchema);
      const result = documentVersionDtoSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 stageInstanceDtoSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(stageInstanceDtoSchema);
      const result = stageInstanceDtoSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 gateDecisionDtoSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(gateDecisionDtoSchema);
      const result = gateDecisionDtoSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 complianceRuleDtoSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(complianceRuleDtoSchema);
      const result = complianceRuleDtoSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 complianceCheckRunDtoSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(complianceCheckRunDtoSchema);
      const result = complianceCheckRunDtoSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 checkResultDtoSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(checkResultDtoSchema);
      const result = checkResultDtoSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 ruleRevisionDtoSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(ruleRevisionDtoSchema);
      const result = ruleRevisionDtoSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 aiGenerationRecordDtoSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(aiGenerationRecordDtoSchema);
      const result = aiGenerationRecordDtoSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 goldenDatasetDtoSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(goldenDatasetDtoSchema);
      const result = goldenDatasetDtoSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该支持覆盖 designOptionDtoSchema 关键字段", () => {
      const mock = generateMockFromSchema(designOptionDtoSchema, {
        title: "方案 C-庭院式",
        status: "CANDIDATE",
        discipline: "ARCHITECTURE",
      });
      expect(mock.title).toBe("方案 C-庭院式");
      expect(mock.status).toBe("CANDIDATE");
      expect(mock.discipline).toBe("ARCHITECTURE");
      const result = designOptionDtoSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该支持覆盖 aiGenerationRecordDtoSchema 风险等级字段", () => {
      const mock = generateMockFromSchema(aiGenerationRecordDtoSchema, {
        riskLevel: "high",
        reviewStatus: "PENDING",
      });
      expect(mock.riskLevel).toBe("high");
      expect(mock.reviewStatus).toBe("PENDING");
      const result = aiGenerationRecordDtoSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 updateRuleRequestSchema 生成有效 mock（全可选字段）", () => {
      const mock = generateMockFromSchema(updateRuleRequestSchema, {
        name: "更新后的规则名",
      });
      expect(mock.name).toBe("更新后的规则名");
      const result = updateRuleRequestSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 aiRagQueryResponseSchema 生成有效 mock，强制 isAiAssisted=true", () => {
      const mock = generateMockFromSchema(aiRagQueryResponseSchema);
      expect(mock.isAiAssisted).toBe(true);
      expect(mock.requiresHumanReview).toBe(false);
      const result = aiRagQueryResponseSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该支持覆盖 aiRagQueryResponseSchema 的 requiresHumanReview 字段", () => {
      const mock = generateMockFromSchema(aiRagQueryResponseSchema, {
        requiresHumanReview: true,
      });
      expect(mock.requiresHumanReview).toBe(true);
      const result = aiRagQueryResponseSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 complianceFindingSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(complianceFindingSchema);
      const result = complianceFindingSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 gateSummarySchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(gateSummarySchema);
      const result = gateSummarySchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 bcfIssueSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(bcfIssueSchema);
      const result = bcfIssueSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该为 healthCheckResultSchema 生成有效 mock", () => {
      const mock = generateMockFromSchema(healthCheckResultSchema);
      expect(mock.status === "UP" || mock.status === "DOWN").toBe(true);
      const result = healthCheckResultSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });

    it("应该支持覆盖 healthCheckResultSchema 的 status 字段为 DOWN", () => {
      const mock = generateMockFromSchema(healthCheckResultSchema, {
        status: "DOWN",
      });
      expect(mock.status).toBe("DOWN");
      const result = healthCheckResultSchema.safeParse(mock);
      expect(result.success).toBe(true);
    });
  });
});
