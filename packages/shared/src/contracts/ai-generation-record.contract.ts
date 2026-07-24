/**
 * AI 生成记录域 API 契约 — 审计追溯 + 人工复核闭环
 *
 * 记录每次 AI 方案生成的完整上下文（prompt/输出/guardrails/traceId），
 * 与设计选项通过 designOptionId 关联；
 * 对 requiresHumanReview=true 的记录提供人工复核闭环。
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
  /** 查询项目内待人工复核记录 */
  pendingReviews: (projectId: string) =>
    `/api/v1/ai-generation-records/reviews/pending?projectId=${encodeURIComponent(projectId)}`,
  /** 提交人工复核决策 */
  submitReview: (id: string) => `/api/v1/ai-generation-records/${id}/review`,
} as const;

// ── 复核枚举 ──

/**
 * AI 生成记录人工复核状态
 * - PENDING：待复核（requiresHumanReview=true 时默认值）
 * - APPROVED：复核通过
 * - REJECTED：复核驳回
 * - RETURNED：退回重生成
 */
export type AiReviewStatus = "PENDING" | "APPROVED" | "REJECTED" | "RETURNED";

/**
 * AI 生成记录人工复核决策动作
 * 与 AiReviewStatus 后三项对应（不含 PENDING，因 PENDING 不能由用户选择）
 */
export type AiReviewDecision = "APPROVED" | "REJECTED" | "RETURNED";

// ── 复核请求 DTO ──

/**
 * 提交人工复核决策请求
 *
 * 用于对 requiresHumanReview=true 的 AI 生成记录提交复核结论。
 * 风险等级 high/critical 须双人复核 + 注册师签章（security.md §12），
 * 在 decisionContext 中提供 secondReviewer 与 signer 信息。
 */
export interface SubmitReviewRequest {
  /** 决策：APPROVED / REJECTED / RETURNED */
  decision: AiReviewDecision;
  /** 复核意见 */
  comment?: string;
  /**
   * 决策上下文（双人复核签章、注册师信息等）
   * 高风险（high/critical）记录须提供：
   * - secondReviewer: 第二复核人 ID
   * - signer: 注册师签章信息（姓名 / 证书号 / 签章时间）
   */
  decisionContext?: Record<string, unknown>;
}

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
  /** 人工复核状态：PENDING / APPROVED / REJECTED / RETURNED */
  reviewStatus: AiReviewStatus;
  /** 复核人 ID */
  reviewerId?: string | null;
  /** 复核意见 */
  reviewComment?: string | null;
  /** 复核时间（ISO 字符串） */
  reviewedAt?: string | null;
  /** 复核决策上下文（双人复核签章、注册师信息等） */
  reviewDecision?: Record<string, unknown> | null;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}
