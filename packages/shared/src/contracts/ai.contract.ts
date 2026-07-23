/**
 * AI 域 API 契约
 * 权威源：@design/D24-AI能力目录-网关.md + @design/D35-API-事件契约.md
 *
 * 聚焦 AI 能力目录对外暴露的统一 Capability API：
 *   - 文本生成（TextGeneration）
 *   - 视觉理解（VisionUnderstanding）
 *   - 向量检索（Embedding）
 *   - Prompt 模板管理
 *
 * V0 阶段裁剪：
 *   - 仅暴露 OpenAI 兼容 Provider，未实现路由/预算/降级（D24.8–D24.11 后续迭代）
 *   - 视觉能力复用 chat 接口（待独立 vision 模型部署后切换）
 *   - Embedding 暂返回 stub（待 embedding 模型配置后启用）
 *
 * 所有 AI 输出标记为 "AI 辅助"，按风险等级进入人工复核（security.md §12）
 */

// ── API 端点定义 ──

/**
 * AI Capability API 端点
 * 基础路径：/api/v1
 *
 * 与 D24.14 服务接口对齐：业务侧只依赖 capability，不指定供应商模型名。
 * 稳定契约 ID 见 @design/r2-contract-catalog/
 */
export const AiApiPaths = {
  /** 文本生成能力（同步） */
  textGeneration: "/api/v1/capabilities/text-generation",
  /** 视觉理解能力（同步） */
  vision: "/api/v1/capabilities/vision",
  /** 文本向量化能力（同步） */
  embeddings: "/api/v1/capabilities/embeddings",
  /** Prompt 模板列表 */
  prompts: "/api/v1/prompts",
} as const;

// ── 文本生成 DTO ──

/**
 * 文本生成请求
 * 对应契约：ai.capability.text-generation（POST /api/v1/capabilities/text-generation）
 */
export interface TextGenerationRequest {
  /** 用户 prompt（必填） */
  prompt: string;
  /** 系统指令（可选，用于注入角色/约束） */
  system?: string;
  /** 采样温度 0.0–2.0，默认 0.7 */
  temperature?: number;
  /** 最大生成 token 数，默认 1024 */
  maxTokens?: number;
  /** 调用方使用的 Prompt 模板名（可选，用于追踪） */
  promptTemplate?: string;
}

/**
 * Token 用量明细
 */
export interface TokenUsageDto {
  /** 输入 token 数 */
  promptTokens: number;
  /** 输出 token 数 */
  completionTokens: number;
  /** 总 token 数 */
  totalTokens: number;
}

/**
 * 文本生成响应
 * 标记 isAiAssisted=true，前端须按风险等级进入人工复核（security.md §12）
 */
export interface TextGenerationResponse {
  /** 生成的文本内容 */
  content: string;
  /** 实际使用的模型名（来自 Provider 响应） */
  model: string;
  /** 完成原因：stop / length / content_filter / tool_calls */
  finishReason: string;
  /** Token 用量 */
  usage: TokenUsageDto;
  /** 是否为 AI 辅助输出（恒为 true，满足安全红线标注） */
  isAiAssisted: true;
  /** 是否需要人工复核（按 risk_profile 决定，V0 默认 true） */
  requiresHumanReview: boolean;
  /** LLM 调用耗时（毫秒） */
  latencyMs: number;
}

// ── 视觉理解 DTO ──

/**
 * 视觉理解请求
 * 对应契约：ai.capability.vision（POST /api/v1/capabilities/vision）
 */
export interface VisionRequest {
  /** 图片 URL（公网可访问或对象存储预签名） */
  imageUrl: string;
  /** 针对图片的提问 prompt */
  prompt: string;
  /** 系统指令（可选） */
  system?: string;
  /** 采样温度，默认 0.3（视觉理解倾向确定性） */
  temperature?: number;
  /** 最大生成 token 数 */
  maxTokens?: number;
}

/**
 * 视觉理解响应
 * 结构与 TextGenerationResponse 一致，附带图片来源标记
 */
export interface VisionResponse {
  /** 生成的文本描述/回答 */
  content: string;
  /** 实际使用的模型名 */
  model: string;
  /** 完成原因 */
  finishReason: string;
  /** Token 用量 */
  usage: TokenUsageDto;
  /** 是否为 AI 辅助输出 */
  isAiAssisted: true;
  /** 是否需要人工复核（视觉结果默认进入人工复核） */
  requiresHumanReview: boolean;
  /** LLM 调用耗时（毫秒） */
  latencyMs: number;
}

// ── 向量化 DTO ──

/**
 * 文本向量化请求
 * 对应契约：ai.capability.embeddings（POST /api/v1/capabilities/embeddings）
 */
export interface EmbeddingRequest {
  /** 待向量化的文本（单条） */
  input: string;
  /** 指定模型（可选，默认走配置 LLM_MODEL） */
  model?: string;
}

/**
 * 向量化响应
 * V0 阶段维度可能为 stub（待 embedding 模型配置后启用真实维度）
 */
export interface EmbeddingResponse {
  /** 向量数据（float32） */
  embedding: number[];
  /** 向量维度 */
  dimensions: number;
  /** 实际使用的模型名 */
  model: string;
  /** Token 用量（embedding 仅统计 promptTokens） */
  usage: TokenUsageDto;
  /** LLM 调用耗时（毫秒） */
  latencyMs: number;
}

// ── Prompt 模板 DTO ──

/**
 * Prompt 模板 DTO
 * 对应 Python services/ai/src/prompts/models.py:PromptTemplate
 */
export interface PromptTemplateDto {
  /** 模板唯一标识（如 rule-check / drawing-review） */
  name: string;
  /** 模板版本号（如 v1） */
  version: string;
  /** 模板描述（中文） */
  description: string;
  /** 模板内容（含占位符 {{var}}） */
  template: string;
  /** 占位符变量列表 */
  variables: string[];
  /** 风险等级（low / medium / high / critical） */
  riskLevel: "low" | "medium" | "high" | "critical";
  /** 是否需要人工复核 */
  requiresHumanReview: boolean;
}
