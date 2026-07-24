/**
 * AI 生成记录域 API 契约 — 审计追溯
 *
 * 记录每次 AI 方案生成的完整上下文（prompt/输出/guardrails/traceId），
 * 与设计选项通过 designOptionId 关联。
 *
 * 权威源：@design/D35-统一身份作用域通用字段.md（审计字段） + security.md §12（AI 安全红线）
 */

// ── API 端点定义 ──

/**
 * AI 生成记录 API 端点
 * 基础路径：/api/v1
 */
export const AiGenerationRecordApiPaths = {
  /** 创建 AI 生成记录（AI Service 在生成方案后通过 BFF 转发） */
  create: "/api/v1/ai-generation-records",
  /** 查询详情 */
  detail: (id: string) => `/api/v1/ai-generation-records/${id}`,
  /** 按项目或设计选项查询 */
  list: "/api/v1/ai-generation-records",
  /** 关联设计选项（接受候选时回填） */
  linkDesignOption: (id: string) => `/api/v1/ai-generation-records/${id}/link`,
} as const;

// ── DTO ──

/** Token 用量 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** 创建 AI 生成记录请求 */
export interface CreateAiGenerationRecordRequest {
  projectId: string;
  designOptionId?: string;
  promptTemplate: string;
  variables?: Record<string, unknown>;
  renderedPrompt: string;
  rawContent: string;
  candidates: Record<string, unknown>;
  model: string;
  tokenUsage: TokenUsage;
  riskLevel: "low" | "medium" | "high" | "critical";
  guardrailResult: {
    passed: boolean;
    warnings: string[];
    escalatedReview: boolean;
  };
  requiresHumanReview?: boolean;
  latencyMs?: number;
  traceId?: string;
}

/** AI 生成记录响应 */
export interface AiGenerationRecordDto {
  id: string;
  tenantId: string;
  projectId: string;
  designOptionId?: string | null;
  promptTemplate: string;
  variables?: Record<string, unknown>;
  renderedPrompt: string;
  rawContent: string;
  candidates: Record<string, unknown>;
  model: string;
  tokenUsage: TokenUsage;
  riskLevel: "low" | "medium" | "high" | "critical";
  guardrailResult: {
    passed: boolean;
    warnings: string[];
    escalatedReview: boolean;
  };
  requiresHumanReview: boolean;
  latencyMs: number;
  traceId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}
