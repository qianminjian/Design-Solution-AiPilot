/**
 * AI Review 域 API 契约（V0 阶段：仅前端骨架，后端 API 未就位）
 *
 * 权威源：@design/D37-关键界面-交互状态.md §D37.13 P09 AI/Agent 复核中心
 *        @design/D27-Agent-工具调用治理.md
 *        @design/D28-AI-ML生命周期-评测.md
 *        @design/D24-AI能力目录-网关.md
 *        @design/D35-API-事件契约.md（AI Review 域契约待 V1 定义）
 *
 * V0 简化：
 *  - 仅定义类型与 API 路径占位，供前端骨架使用
 *  - 后端 AIInvocationRun/AgentRun/Step/ToolCall/Guardrail API 在 V1 阶段实现
 *  - 前端通过空状态区分"无 Run / Run 进行中 / Run 已完成 / 等待 ToolCall 审批"
 *
 * 实体关系（对齐 D37.13 §数据/接口）：
 *  AIInvocationRun（一次完整 AI 调用）
 *    ├── sourceRevision / targetRevision（输入/输出版本固定）
 *    ├── Prompt/InputManifest（输入清单）
 *    ├── Step[]（执行步骤时间线）
 *    │     ├── ToolCall[]（工具调用，含审批状态）
 *    │     ├── Guardrail[]（输入/输出护栏）
 *    │     └── OutputDiff（输出 diff）
 *    ├── Citation[]（引用证据）
 *    ├── Confidence（置信度 + 不确定性）
 *    └── Evaluation（人工评估 + 责任确认）
 *
 * 主动作约束（D37.13 §主动作）：
 *  - Accept as Draft / Edit / Reject / Escalate
 *  - 高风险输出只允许形成 Proposal/草稿，不直接进入业务状态
 *  - Accept 只生成带来源的 Draft/Revision Proposal，需字段级 diff + 目标 ETag + 责任确认
 *
 * 安全红线（design-constraints.md §AI 安全红线）：
 *  - 所有 AI 输出必须标记为"AI 辅助"
 *  - AI 不替代注册建筑师/工程师的专业审签和监管审批
 *  - 所有 AI 结果按风险等级进入人工复核流程
 *  - 高风险输出只允许形成 Proposal/草稿
 */

// ── 枚举 ──

/**
 * AI 运行模式
 * - CHAT: 单轮对话
 * - AGENT: 多步骤 Agent 执行（含工具调用）
 * - RAG: 检索增强生成
 * - REVIEW: AI 复核（如规则检查结果审阅、设计候选评估）
 */
export type AiRunMode = "CHAT" | "AGENT" | "RAG" | "REVIEW";

/**
 * AI 运行状态
 * - PENDING: 已创建未执行
 * - RUNNING: 执行中
 * - PAUSED: 已暂停（等待 ToolCall 审批或人工介入）
 * - COMPLETED: 已完成
 * - FAILED: 失败
 * - CANCELLED: 已取消
 */
export type AiRunStatus =
  "PENDING" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED" | "CANCELLED";

/**
 * Agent 步骤状态
 * - PENDING: 待执行
 * - RUNNING: 执行中
 * - AWAITING_APPROVAL: 等待审批（如 ToolCall 审批）
 * - COMPLETED: 已完成
 * - FAILED: 失败
 * - SKIPPED: 已跳过
 */
export type AiStepStatus =
  | "PENDING"
  | "RUNNING"
  | "AWAITING_APPROVAL"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED";

/**
 * 工具调用状态
 * - PENDING: 待执行
 * - AWAITING_APPROVAL: 等待人工审批
 * - APPROVED: 已批准
 * - REJECTED: 已拒绝
 * - COMPLETED: 已完成
 * - FAILED: 失败
 */
export type ToolCallStatus =
  | "PENDING"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "FAILED";

/**
 * 护栏类型
 * - INPUT: 输入审核（Prompt 注入/越狱检测）
 * - OUTPUT: 输出审核（敏感信息/越权内容/合规性）
 */
export type GuardrailType = "INPUT" | "OUTPUT";

/**
 * 护栏状态
 * - PASSED: 通过
 * - WARNING: 警告（允许通过但记录）
 * - BLOCKED: 阻断（不允许下游使用）
 */
export type GuardrailStatus = "PASSED" | "WARNING" | "BLOCKED";

/**
 * AI 风险等级（对齐 security.md §12 AI 安全红线）
 * - LOW: 低风险（文本摘要、标签生成）
 * - MEDIUM: 中风险（方案建议、规范检查）
 * - HIGH: 高风险（结构计算、施工图生成）
 * - CRITICAL: 极高风险（合规判定、安全评估）
 */
export type AiRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * 复核决策动作（D37.13 §主动作）
 * - ACCEPT_AS_DRAFT: 接受为草稿（生成 Draft/Proposal）
 * - EDIT: 编辑后接受
 * - REJECT: 拒绝（明确原因）
 * - ESCALATE: 上报（升级到更高权限审签）
 */
export type ReviewDecision = "ACCEPT_AS_DRAFT" | "EDIT" | "REJECT" | "ESCALATE";

/**
 * 复核状态
 * - PENDING: 待复核
 * - IN_PROGRESS: 复核中
 * - ACCEPTED: 已接受
 * - REJECTED: 已拒绝
 * - ESCALATED: 已上报
 */
export type ReviewStatus =
  "PENDING" | "IN_PROGRESS" | "ACCEPTED" | "REJECTED" | "ESCALATED";

// ── DTO ──

/**
 * Token 用量明细（运行级聚合）
 */
export interface AiTokenUsageDto {
  /** 输入 token 数 */
  promptTokens: number;
  /** 输出 token 数 */
  completionTokens: number;
  /** 总 token 数 */
  totalTokens: number;
  /** 预估成本（USD） */
  estimatedCostUsd?: number | null;
}

/**
 * AI 输入清单（D37.13 §正常状态：显示 Prompt/Tool/Policy/数据版本）
 */
export interface AiInputManifestDto {
  /** 使用的 Capability 名称（如 text-generation / vision） */
  capabilityName: string;
  /** 实际调用的模型名（如 gpt-4o / claude-3.5-sonnet） */
  modelName: string;
  /** 模型版本/发布 ID（用于追溯） */
  modelReleaseId?: string | null;
  /** Prompt 模板名（如 rule-check / drawing-review） */
  promptTemplateName?: string | null;
  /** Prompt 模板版本 */
  promptTemplateVersion?: string | null;
  /** 完整 Prompt（脱敏后） */
  prompt: string;
  /** 系统指令 */
  system?: string | null;
  /** Policy 版本（AI 治理策略） */
  policyVersion?: string | null;
  /** 输入数据版本（如检索的规范库版本、模型版本） */
  inputDataVersion?: string | null;
  /** 温度参数 */
  temperature?: number | null;
  /** 最大 token 数 */
  maxTokens?: number | null;
}

/**
 * AI 引用（Citation）
 * 用于支持 AI 输出结论的引用证据
 */
export interface AiCitationDto {
  /** 引用 ID */
  id: string;
  /** 引用类型（如规则条文/规范条款/历史案例/检索文档） */
  type:
    "RULE_CLAUSE" | "REGULATION" | "CASE" | "RETRIEVED_DOC" | "DESIGN_ELEMENT";
  /** 引用标题 */
  title: string;
  /** 引用来源定位（如 "GB 50016-2014 §5.5.17"） */
  locator: string;
  /** 引用片段内容 */
  snippet?: string | null;
  /** 引用来源 URL（如对象存储预签名） */
  sourceUrl?: string | null;
  /** 相关性评分（0-1） */
  relevanceScore?: number | null;
}

/**
 * AI 置信度（D37.13 §正常状态：显示置信/不确定性）
 */
export interface AiConfidenceDto {
  /** 置信度评分（0-1） */
  score: number;
  /** 不确定性说明 */
  uncertainty?: string | null;
  /** 置信度依据（如"基于检索 top-k 命中率"） */
  basis?: string | null;
  /** 校准来源（如"V3 GoldenDataset 评估"） */
  calibrationSource?: string | null;
}

/**
 * ToolCall DTO（工具调用）
 * 对应实体：ToolCall（Step 中的工具调用，含审批状态）
 *
 * PII 分级：inputSchema/outputSchema 为 L4（专业设计成果）
 */
export interface ToolCallDto {
  id: string;
  /** 所属 Step ID */
  stepId: string;
  /** 所属 Run ID */
  runId: string;
  /** 工具名称（如 compliance-check / model-query / file-read） */
  toolName: string;
  /** 工具版本 */
  toolVersion?: string | null;
  /** 工具描述 */
  description?: string | null;
  /** 状态 */
  status: ToolCallStatus;
  /** 输入参数（JSON） */
  input: Record<string, unknown>;
  /** 输出结果（JSON） */
  output?: Record<string, unknown> | null;
  /** 是否需要人工审批 */
  requiresApproval: boolean;
  /** 审批人 */
  approvedBy?: string | null;
  /** 审批时间 */
  approvedAt?: string | null;
  /** 拒绝原因 */
  rejectionReason?: string | null;
  /** 错误信息 */
  errorMessage?: string | null;
  /** 调用耗时（ms） */
  latencyMs?: number | null;
  /** Token 用量（如工具内部有 LLM 调用） */
  tokenUsage?: AiTokenUsageDto | null;
  /** 创建时间 */
  createdAt: string;
  /** 完成时间 */
  completedAt?: string | null;
}

/**
 * Guardrail DTO（安全护栏）
 * 对应实体：Guardrail（输入/输出审核结果）
 */
export interface GuardrailDto {
  id: string;
  /** 所属 Step ID */
  stepId: string;
  /** 所属 Run ID */
  runId: string;
  /** 护栏类型 */
  type: GuardrailType;
  /** 护栏名称（如 prompt-injection-detection / sensitive-info-filter） */
  name: string;
  /** 状态 */
  status: GuardrailStatus;
  /** 触发的规则列表 */
  triggeredRules?: string[];
  /** 警告/阻断原因 */
  reason?: string | null;
  /** 详细日志（脱敏后） */
  details?: Record<string, unknown> | null;
  /** 处置建议（如"修改输入后重试" / "切换到更安全的能力"） */
  remediation?: string | null;
  /** 检查耗时（ms） */
  latencyMs?: number | null;
  /** 检查时间 */
  checkedAt: string;
}

/**
 * AI Step DTO（执行步骤）
 * 对应实体：Step（AgentRun 中的单个执行步骤）
 */
export interface AiStepDto {
  id: string;
  /** 所属 Run ID */
  runId: string;
  /** 步骤序号（从 1 开始） */
  stepIndex: number;
  /** 步骤名称 */
  name: string;
  /** 步骤类型（如 PLAN / TOOL_CALL / OBSERVE / REFLECT / OUTPUT） */
  type: "PLAN" | "TOOL_CALL" | "OBSERVE" | "REFLECT" | "OUTPUT";
  /** 状态 */
  status: AiStepStatus;
  /** 步骤输入（摘要） */
  inputSummary?: string | null;
  /** 步骤输出（摘要） */
  outputSummary?: string | null;
  /** 步骤详细输入（JSON） */
  inputDetails?: Record<string, unknown> | null;
  /** 步骤详细输出（JSON） */
  outputDetails?: Record<string, unknown> | null;
  /** 步骤开始时间 */
  startedAt?: string | null;
  /** 步骤完成时间 */
  completedAt?: string | null;
  /** 步骤耗时（ms） */
  latencyMs?: number | null;
  /** 步骤错误信息 */
  errorMessage?: string | null;
  /** 步骤包含的 ToolCall ID 列表 */
  toolCallIds: string[];
  /** 步骤包含的 Guardrail ID 列表 */
  guardrailIds: string[];
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * OutputDiff DTO（输出 diff）
 * 用于显示 AI 输出与基线/原版本的差异
 */
export interface OutputDiffDto {
  /** diff 类型（如 text / json / structured） */
  type: "text" | "json" | "structured";
  /** 旧版本内容（如基线设计文档） */
  before?: string | null;
  /** 新版本内容（AI 输出） */
  after: string;
  /** diff 行列表（unified diff 格式） */
  hunks?: Array<{
    /** 起始行号 */
    startLine: number;
    /** 行数 */
    lineCount: number;
    /** 变更行（+/-/= 前缀） */
    lines: string[];
  }>;
  /** 字段级 diff（结构化数据） */
  fieldDiffs?: Array<{
    /** 字段路径（如 "design.area"） */
    path: string;
    /** 旧值 */
    oldValue?: string | null;
    /** 新值 */
    newValue?: string | null;
    /** 变更类型（added/removed/modified） */
    changeType: "added" | "removed" | "modified";
  }>;
}

/**
 * AIInvocationRun DTO（AI 调用运行）
 * 对应实体：AIInvocationRun（一次完整 AI 调用过程）
 *
 * PII 分级：inputManifest/outputDiff 为 L4（专业设计成果）
 */
export interface AiInvocationRunDto {
  id: string;
  tenantId: string;
  projectId: string;
  /** 运行编号（项目内递增） */
  runIndex: number;
  /** 运行名称 */
  name: string;
  /** 运行模式 */
  mode: AiRunMode;
  /** 状态 */
  status: AiRunStatus;
  /** 风险等级 */
  riskLevel: AiRiskLevel;
  /** 是否为 Agent 运行（多步骤） */
  isAgentRun: boolean;
  /** 输入清单 */
  inputManifest: AiInputManifestDto;
  /** 源版本 ID（输入设计版本固定） */
  sourceRevisionId?: string | null;
  /** 目标版本 ID（输出 Draft/Proposal 写入目标） */
  targetRevisionId?: string | null;
  /** 目标 ETag（用于乐观锁，Accept 时校验） */
  targetETag?: string | null;
  /** 授权主体（发起人） */
  initiatedBy: string;
  /** 授权主体显示名 */
  initiatedByName?: string | null;
  /** 调用目的（业务用途说明） */
  purpose: string;
  /** 开始时间 */
  startedAt?: string | null;
  /** 完成时间 */
  completedAt?: string | null;
  /** 运行耗时（ms） */
  latencyMs?: number | null;
  /** Token 用量（聚合） */
  tokenUsage?: AiTokenUsageDto | null;
  /** 引用列表 */
  citations?: AiCitationDto[];
  /** 置信度 */
  confidence?: AiConfidenceDto | null;
  /** 输出 diff */
  outputDiff?: OutputDiffDto | null;
  /** 步骤总数 */
  stepCount: number;
  /** 工具调用总数 */
  toolCallCount: number;
  /** 护栏总数 */
  guardrailCount: number;
  /** 失败原因（status=FAILED 时） */
  failureReason?: string | null;
  /** 是否需要人工复核（按 risk_level 决定） */
  requiresHumanReview: boolean;
  /** 是否为 AI 辅助输出（恒为 true，满足安全红线标注） */
  isAiAssisted: true;
  createdAt: string;
  updatedAt: string;
  /** 乐观锁版本号 */
  rowVersion: number;
}

/**
 * ReviewEvaluation DTO（人工评估）
 * 对应实体：Evaluation（人工对 AI 输出的评估）
 */
export interface ReviewEvaluationDto {
  id: string;
  /** 关联 Run ID */
  runId: string;
  /** 评估人 */
  reviewer: string;
  /** 评估人显示名 */
  reviewerName?: string | null;
  /** 评估决策 */
  decision: ReviewDecision;
  /** 评估状态 */
  status: ReviewStatus;
  /** 评估原因（必填，对齐 D37.13 §决策"必须 reason/checklist"） */
  reason: string;
  /** 评估检查清单（对齐 D37.13 §决策"必须 checklist"） */
  checklist?: Array<{
    /** 检查项 */
    item: string;
    /** 是否通过 */
    passed: boolean;
    /** 备注 */
    note?: string | null;
  }>;
  /** 草稿/Proposal ID（ACCEPT_AS_DRAFT 时生成） */
  draftId?: string | null;
  /** 草稿类型（如 ImpactProposal / DesignRevisionDraft） */
  draftType?: string | null;
  /** 是否盲审（隐藏 AI 建议先做独立判断） */
  isBlindReview: boolean;
  /** 责任确认（必须勾选"AI 不替代专业审签"） */
  responsibilityAcknowledged: boolean;
  /** 评估时间 */
  evaluatedAt?: string | null;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

// ── 请求 DTO ──

/**
 * 列出 AI 运行请求
 */
export interface ListAiRunsRequest {
  projectId: string;
  status?: AiRunStatus;
  mode?: AiRunMode;
  riskLevel?: AiRiskLevel;
  initiatedBy?: string;
  /** 仅等待复核 */
  pendingReviewOnly?: boolean;
  page?: number;
  pageSize?: number;
  sort?: "createdAt" | "riskLevel" | "startedAt";
  order?: "asc" | "desc";
}

/**
 * 审批 ToolCall 请求
 */
export interface ApproveToolCallRequest {
  toolCallId: string;
  action: "APPROVE" | "REJECT";
  reason?: string;
  /** 高风险审批需要 stepUpToken */
  stepUpToken?: string;
}

/**
 * 提交复核决策请求
 */
export interface SubmitReviewDecisionRequest {
  runId: string;
  decision: ReviewDecision;
  reason: string;
  checklist?: Array<{
    item: string;
    passed: boolean;
    note?: string;
  }>;
  /** 草稿类型（ACCEPT_AS_DRAFT 必填） */
  draftType?: string;
  /** 是否盲审 */
  isBlindReview?: boolean;
  /** 责任确认 */
  responsibilityAcknowledged: boolean;
  /** 目标 ETag（用于乐观锁校验） */
  targetETag?: string;
  /** 高风险决策需要 stepUpToken */
  stepUpToken?: string;
}

/**
 * 控制 AI 运行请求（暂停/恢复/取消）
 */
export interface ControlAiRunRequest {
  runId: string;
  action: "PAUSE" | "RESUME" | "CANCEL";
  reason?: string;
}

// ── API 路径定义 ──

/**
 * AI Review 域 API 端点
 * 基础路径：/api/v1
 *
 * V0 阶段：后端未实现，前端通过 hook 空状态展示
 */
export const AiReviewApiPaths = {
  /** 列出项目下 AI 运行 */
  runs: (projectId: string) => `/api/v1/projects/${projectId}/ai/runs`,
  /** AI 运行详情 */
  runDetail: (projectId: string, runId: string) =>
    `/api/v1/projects/${projectId}/ai/runs/${runId}`,
  /** AI 运行步骤列表 */
  steps: (projectId: string, runId: string) =>
    `/api/v1/projects/${projectId}/ai/runs/${runId}/steps`,
  /** 步骤详情 */
  stepDetail: (projectId: string, runId: string, stepId: string) =>
    `/api/v1/projects/${projectId}/ai/runs/${runId}/steps/${stepId}`,
  /** 工具调用列表 */
  toolCalls: (projectId: string, runId: string) =>
    `/api/v1/projects/${projectId}/ai/runs/${runId}/tool-calls`,
  /** 工具调用详情 */
  toolCallDetail: (projectId: string, runId: string, toolCallId: string) =>
    `/api/v1/projects/${projectId}/ai/runs/${runId}/tool-calls/${toolCallId}`,
  /** 审批工具调用 */
  approveToolCall: (toolCallId: string) =>
    `/api/v1/ai/tool-calls/${toolCallId}/approve`,
  /** 拒绝工具调用 */
  rejectToolCall: (toolCallId: string) =>
    `/api/v1/ai/tool-calls/${toolCallId}/reject`,
  /** 护栏结果列表 */
  guardrails: (projectId: string, runId: string) =>
    `/api/v1/projects/${projectId}/ai/runs/${runId}/guardrails`,
  /** 控制运行（暂停/恢复/取消） */
  controlRun: (projectId: string, runId: string) =>
    `/api/v1/projects/${projectId}/ai/runs/${runId}/control`,
  /** 列出待复核 Run */
  reviews: "/api/v1/reviews",
  /** 审核详情 */
  reviewDetail: (reviewId: string) => `/api/v1/reviews/${reviewId}`,
  /** 提交复核决策 */
  submitDecision: (runId: string) => `/api/v1/ai/runs/${runId}/review-decision`,
  /** 评估详情 */
  evaluation: (runId: string) => `/api/v1/ai/runs/${runId}/evaluation`,
} as const;
