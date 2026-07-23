/**
 * 方案生成域 API 契约
 * 权威源：@design/D09-概念阶段.md + @design/D10-方案深化.md + @design/D26-方案决策.md
 *
 * 面向业务的方案生成能力：
 *   - 选择 prompt 模板（concept-generation / scheme-deepening / design-option-comparison）
 *   - 提供变量值，AI 渲染模板并调用 LLM 生成方案候选
 *   - Guardrails 校验输出（黑名单/升级关键词）
 *   - 所有响应强制 isAiAssisted=true，按风险等级进入人工复核（security.md §12）
 *
 * V0 阶段非流式：返回完整响应，V2 升级为 SSE 流式
 */

// ── API 端点定义 ──

/**
 * 方案生成 API 端点
 * 基础路径：/api/v1
 */
export const SolutionsApiPaths = {
  /** 生成方案候选（同步，V0 非流式） */
  generate: "/api/v1/solutions/generate",
} as const;

// ── 方案生成 DTO ──

/**
 * Prompt 模板变量键值对
 */
export interface SolutionVariable {
  /** 变量名（如 siteDescription） */
  key: string;
  /** 变量值 */
  value: string;
}

/**
 * 方案生成请求
 * 对应契约：solutions.generate（POST /api/v1/solutions/generate）
 */
export interface GenerateSolutionRequest {
  /** Prompt 模板名称（如 concept-generation） */
  promptTemplate: string;
  /** 模板变量键值对 */
  variables: SolutionVariable[];
  /** 关联项目 ID（可选，用于审计与 traceId 关联） */
  projectId?: string;
  /** 草图文档 ID（CDE 文档，AI 通过 presigned URL 取图） */
  sketchDocumentId?: string;
  /** 采样温度 0.0–2.0，默认 0.7 */
  temperature?: number;
  /** 最大生成 token 数，默认 2048 */
  maxTokens?: number;
}

/**
 * 方案候选
 */
export interface SolutionCandidate {
  /** 候选名称 */
  name: string;
  /** 候选内容（Markdown/JSON 字符串） */
  content: string;
  /** 风险点列表 */
  risks: string[];
  /** 可行性注记 */
  feasibilityNotes?: string | null;
}

/**
 * Guardrails 校验结果
 */
export interface GuardrailResult {
  /** 是否通过校验 */
  passed: boolean;
  /** 警告信息 */
  warnings: string[];
  /** 是否升级人工复核（触发安全关键词） */
  escalatedReview: boolean;
}

/**
 * 方案生成响应
 * 标记 isAiAssisted=true，按风险等级进入人工复核（security.md §12）
 */
export interface GenerateSolutionResponse {
  /** 方案候选列表（至少 1 项） */
  candidates: SolutionCandidate[];
  /** LLM 原始输出（未解析，用于审计追溯） */
  rawContent: string;
  /** 实际调用的 LLM 模型名 */
  model: string;
  /** Token 用量 */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 风险等级（继承自 prompt 模板） */
  riskLevel: "low" | "medium" | "high" | "critical";
  /** 实际使用的 prompt 模板名 */
  promptTemplateUsed: string;
  /** Guardrails 校验结果 */
  guardrail: GuardrailResult;
  /** 是否为 AI 辅助输出（恒为 true） */
  isAiAssisted: true;
  /** 是否需要人工复核 */
  requiresHumanReview: boolean;
  /** LLM 调用耗时（毫秒） */
  latencyMs: number;
}
