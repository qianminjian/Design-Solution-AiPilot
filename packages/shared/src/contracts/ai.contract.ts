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

// ── RAG 知识库 DTO ──

/**
 * RAG API 端点
 * 基础路径：/api/v1/rag
 *
 * 与 services/ai/src/rag/router.py 对齐：
 *  - POST /api/v1/rag/query：检索问答
 *  - POST /api/v1/rag/knowledge-bases：创建知识库
 *  - GET /api/v1/rag/knowledge-bases：列出知识库
 *  - POST /api/v1/rag/knowledge-bases/{id}/documents：添加文档
 *  - DELETE /api/v1/rag/knowledge-bases/{id}：删除知识库
 *
 * 安全红线：
 *  - 检索问答响应强制 isAiAssisted=true 与 requiresHumanReview 字段（security.md §12）
 *  - 检索结果按风险等级进入人工复核流程
 */
export const RagApiPaths = {
  /** 检索问答（同步） */
  query: "/api/v1/rag/query",
  /** 创建知识库 */
  createKnowledgeBase: "/api/v1/rag/knowledge-bases",
  /** 列出知识库 */
  listKnowledgeBases: "/api/v1/rag/knowledge-bases",
  /** 知识库详情（路径生成器） */
  knowledgeBase: (knowledgeBaseId: string) =>
    `/api/v1/rag/knowledge-bases/${knowledgeBaseId}`,
  /** 添加文档到知识库（路径生成器） */
  addDocuments: (knowledgeBaseId: string) =>
    `/api/v1/rag/knowledge-bases/${knowledgeBaseId}/documents`,
} as const;

/**
 * 检索问答请求
 * 对应契约：ai.rag.query（POST /api/v1/rag/query）
 */
export interface RagQueryRequest {
  /** 知识库 ID（对应 ChromaDB collection name） */
  knowledgeBaseId: string;
  /** 用户问题 */
  question: string;
}

/**
 * 检索引用来源
 * 对应 Python services/ai/src/rag/router.py:CitationSchema
 */
export interface RagCitation {
  /** 文本块 ID */
  chunkId: string;
  /** 文档 ID */
  documentId: string;
  /** 引用标题 */
  title: string;
  /** 章节/段落定位 */
  section: string;
  /** 引用片段内容 */
  content: string;
  /** 相关性评分（0-1） */
  score: number;
}

/**
 * 检索问答响应
 * 标记 isAiAssisted=true，前端须按风险等级进入人工复核（security.md §12）
 */
export interface RagQueryResponse {
  /** 结论/回答文本 */
  conclusion: string;
  /** 引用来源列表 */
  citations: RagCitation[];
  /** 不确定性评分（0-1，越高越不确定） */
  uncertainty: number;
  /** 实际使用的模型名 */
  modelVersion: string;
  /** 检索耗时（毫秒） */
  retrievalTimeMs: number;
  /** 是否需要人工复核（RAG 查询默认 true） */
  requiresHumanReview: boolean;
  /** 是否为 AI 辅助输出（恒为 true，满足安全红线标注） */
  isAiAssisted: true;
}

/**
 * 创建知识库请求
 */
export interface CreateKnowledgeBaseRequest {
  /** 知识库 ID（用户指定，对应 ChromaDB collection name） */
  knowledgeBaseId: string;
}

/**
 * 知识库信息
 * 对应 Python services/ai/src/rag/router.py:KnowledgeBaseSchema
 */
export interface KnowledgeBaseDto {
  /** 知识库 ID */
  id: string;
  /** 文档数量 */
  documentCount: number;
}

/**
 * 添加文档请求
 * documents 字段为灵活的键值对（如 title / content / source 等）
 */
export interface AddDocumentsRequest {
  /** 文档列表 */
  documents: Array<Record<string, string>>;
}

/** 添加文档响应 */
export interface AddDocumentsResponse {
  /** 状态 */
  status: string;
  /** 知识库 ID */
  knowledgeBaseId: string;
  /** 切片数量 */
  chunkCount: number;
}

/** 创建知识库响应 */
export interface CreateKnowledgeBaseResponse {
  /** 状态 */
  status: string;
  /** 知识库 ID */
  knowledgeBaseId: string;
}

/** 删除知识库响应 */
export interface DeleteKnowledgeBaseResponse {
  /** 状态 */
  status: string;
  /** 知识库 ID */
  knowledgeBaseId: string;
}
