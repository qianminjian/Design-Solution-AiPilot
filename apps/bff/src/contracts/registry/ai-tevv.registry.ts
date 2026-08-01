/**
 * AI 与合规域 Consumer 契约注册表（P0-2.1 HTTP/OpenAPI 契约）
 *
 * 覆盖域：ai / tevv / design / compliance
 * AI 域端点响应必须包含 isAiAssisted / requiresHumanReview 安全红线字段
 * （security.md §12），采用 strict 级别防止契约漂移。
 *
 * 权威源：@design/D35-API-事件契约.md + @design/D40-AI-服务.md
 *         + @design/D37.10 合规规则引擎
 */
import type { ConsumerExpectation } from "@design-platform/shared";
import {
  complianceCheckRunDtoSchema,
  complianceRuleDtoSchema,
  createCheckRunRequestSchema,
  createRuleRequestSchema,
  embeddingRequestSchema,
  embeddingResponseSchema,
  generateSolutionRequestSchema,
  generateSolutionResponseSchema,
  idsImportRequestSchema,
  idsImportResponseSchema,
  textGenerationRequestSchema,
  textGenerationResponseSchema,
  updateRuleRequestSchema,
  visionRequestSchema,
  visionResponseSchema,
} from "@design-platform/shared";

const CONSUMER = "@design-platform/bff" as const;
const PROVIDER = "@design-platform/core" as const;

/**
 * ai 域契约（安全红线端点 strict）
 */
export const AI_EXPECTATIONS: ConsumerExpectation[] = [
  {
    contractId: "ai-capability-text-generation-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "ai",
    method: "POST",
    path: "/api/v1/capabilities/text-generation",
    description: "文本生成能力（AI 输出，安全红线 strict）",
    requestSchema: textGenerationRequestSchema,
    responseSchema: textGenerationResponseSchema,
    strictness: "strict",
    version: "1.0.0",
  },
  {
    contractId: "ai-capability-vision-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "ai",
    method: "POST",
    path: "/api/v1/capabilities/vision",
    description: "视觉理解能力（AI 输出，安全红线 strict）",
    requestSchema: visionRequestSchema,
    responseSchema: visionResponseSchema,
    strictness: "strict",
    version: "1.0.0",
  },
  {
    contractId: "ai-capability-embeddings-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "ai",
    method: "POST",
    path: "/api/v1/capabilities/embeddings",
    description: "向量嵌入能力",
    requestSchema: embeddingRequestSchema,
    responseSchema: embeddingResponseSchema,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "ai-solution-generate-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "ai",
    method: "POST",
    path: "/api/v1/ai/solutions/generate",
    description: "方案生成（AI 输出，安全红线 strict）",
    requestSchema: generateSolutionRequestSchema,
    responseSchema: generateSolutionResponseSchema,
    strictness: "strict",
    version: "1.0.0",
  },
];

/**
 * tevv 域契约（金样数据集 + Gate 准入验证）
 */
export const TEVV_EXPECTATIONS: ConsumerExpectation[] = [
  {
    contractId: "tevv-gates-list-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "tevv",
    method: "GET",
    path: "/api/v1/tevv/gates",
    description: "TEVV Gate 列表",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "tevv-verification-list-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "tevv",
    method: "GET",
    path: "/api/v1/tevv/verifications",
    description: "验证项列表",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
];

/**
 * design 域契约（设计选项 + 反馈）
 */
export const DESIGN_EXPECTATIONS: ConsumerExpectation[] = [
  {
    contractId: "design-options-list-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "design",
    method: "GET",
    path: "/api/v1/design/options",
    description: "设计选项列表",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "design-option-create-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "design",
    method: "POST",
    path: "/api/v1/design/options",
    description: "创建设计选项",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
];

/**
 * compliance 域契约（规则引擎 + 检查运行 + 结果）
 */
export const COMPLIANCE_EXPECTATIONS: ConsumerExpectation[] = [
  {
    contractId: "compliance-rule-create-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "compliance",
    method: "POST",
    path: "/api/v1/compliance/rules",
    description: "创建合规规则",
    requestSchema: createRuleRequestSchema,
    responseSchema: complianceRuleDtoSchema,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "compliance-rule-update-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "compliance",
    method: "PUT",
    path: "/api/v1/compliance/rules/:id",
    description: "更新合规规则",
    requestSchema: updateRuleRequestSchema,
    responseSchema: complianceRuleDtoSchema,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "compliance-check-run-create-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "compliance",
    method: "POST",
    path: "/api/v1/compliance/check-runs",
    description: "创建检查运行",
    requestSchema: createCheckRunRequestSchema,
    responseSchema: complianceCheckRunDtoSchema,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "compliance-ids-import-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "compliance",
    method: "POST",
    path: "/api/v1/compliance/ids/import",
    description: "IDS 导入",
    requestSchema: idsImportRequestSchema,
    responseSchema: idsImportResponseSchema,
    strictness: "soft",
    version: "1.0.0",
  },
];

/** ai 与合规域注册表 */
export const AI_TEVV_REGISTRY: ConsumerExpectation[] = [
  ...AI_EXPECTATIONS,
  ...TEVV_EXPECTATIONS,
  ...DESIGN_EXPECTATIONS,
  ...COMPLIANCE_EXPECTATIONS,
];
