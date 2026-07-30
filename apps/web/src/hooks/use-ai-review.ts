"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AiInvocationRunDto,
  AiStepDto,
  AiTokenUsageDto,
  AiRunStatus,
  AiRunMode,
  AiRiskLevel,
  ApproveToolCallRequest,
  ControlAiRunRequest,
  GuardrailDto,
  ListAiRunsRequest,
  OffsetPageResponse,
  ReviewEvaluationDto,
  SubmitReviewDecisionRequest,
  ToolCallDto,
} from "@design-platform/shared";
import { AiReviewApiPaths } from "@design-platform/shared";
import { apiGet, apiPost } from "@/lib/api-client";

/**
 * AI Review 域 hooks（V0 阶段）
 *
 * 后端 AIInvocationRun/AgentRun/Step/ToolCall/Guardrail API 尚未实现，
 * 前端通过这些 hooks 提供统一查询入口；后端实现后无需修改组件代码。
 *
 * 当 API 返回 404 / 501（未实现）时，组件层显示空状态
 * （对齐 D37.13 §空状态：区分"无 Run / Run 进行中 / Run 已完成 / 等待 ToolCall 审批"）。
 *
 * 主动作约束（D37.13 §主动作）：
 *  - Accept as Draft / Edit / Reject / Escalate
 *  - 高风险输出只允许形成 Proposal/草稿
 *  - Accept 只生成带来源的 Draft/Revision Proposal，需字段级 diff + 目标 ETag + 责任确认
 *
 * 安全红线（design-constraints.md §AI 安全红线）：
 *  - 所有 AI 输出标记为"AI 辅助"
 *  - AI 不替代注册建筑师/工程师的专业审签和监管审批
 *  - 所有 AI 结果按风险等级进入人工复核流程
 */

const AI_REVIEW_QUERY_KEY = ["ai-review"] as const;

/** 判断 API 是否为"未实现"错误（404 / 501） */
function isNotImplementedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  return status === 404 || status === 501;
}

// ── Run 列表 ──

/** 构造 Run 列表查询键 */
function buildRunsQueryKey(
  projectId: string,
  params: Omit<ListAiRunsRequest, "projectId">,
) {
  return [
    ...AI_REVIEW_QUERY_KEY,
    "runs",
    projectId,
    {
      status: params.status ?? null,
      mode: params.mode ?? null,
      riskLevel: params.riskLevel ?? null,
      pendingReviewOnly: params.pendingReviewOnly ?? false,
    },
  ] as const;
}

/**
 * 列出项目下 AI 运行
 * 对应契约：GET /api/v1/projects/{projectId}/ai/runs
 */
export function useAiRuns(
  projectId: string | null | undefined,
  params: Omit<ListAiRunsRequest, "projectId"> = {},
) {
  return useQuery<OffsetPageResponse<AiInvocationRunDto>>({
    queryKey:
      typeof projectId === "string"
        ? buildRunsQueryKey(projectId, params)
        : ([AI_REVIEW_QUERY_KEY, "runs", null] as const),
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () => {
      if (!projectId) throw new Error("projectId is required");
      const search = new URLSearchParams();
      search.set("page", String(params.page ?? 1));
      search.set("pageSize", String(params.pageSize ?? 50));
      if (params.status) search.set("status", params.status);
      if (params.mode) search.set("mode", params.mode);
      if (params.riskLevel) search.set("riskLevel", params.riskLevel);
      if (params.pendingReviewOnly) search.set("pendingReviewOnly", "true");
      const url = `${AiReviewApiPaths.runs(projectId)}?${search.toString()}`;
      return apiGet<OffsetPageResponse<AiInvocationRunDto>>(url);
    },
    placeholderData: (prev) => prev,
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * AI 运行详情
 * 对应契约：GET /api/v1/projects/{projectId}/ai/runs/{runId}
 */
export function useAiRun(
  projectId: string | null | undefined,
  runId: string | null | undefined,
) {
  return useQuery<AiInvocationRunDto>({
    queryKey: [...AI_REVIEW_QUERY_KEY, "run", projectId, runId] as const,
    enabled:
      typeof projectId === "string" &&
      projectId.length > 0 &&
      typeof runId === "string" &&
      runId.length > 0,
    queryFn: () => {
      if (!projectId) throw new Error("projectId is required");
      if (!runId) throw new Error("runId is required");
      return apiGet<AiInvocationRunDto>(
        AiReviewApiPaths.runDetail(projectId, runId),
      );
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── Step ──

/**
 * 列出 Run 的执行步骤
 * 对应契约：GET /api/v1/projects/{projectId}/ai/runs/{runId}/steps
 */
export function useAiSteps(
  projectId: string | null | undefined,
  runId: string | null | undefined,
) {
  return useQuery<AiStepDto[]>({
    queryKey: [...AI_REVIEW_QUERY_KEY, "steps", projectId, runId] as const,
    enabled:
      typeof projectId === "string" &&
      projectId.length > 0 &&
      typeof runId === "string" &&
      runId.length > 0,
    queryFn: () => {
      if (!projectId) throw new Error("projectId is required");
      if (!runId) throw new Error("runId is required");
      return apiGet<AiStepDto[]>(AiReviewApiPaths.steps(projectId, runId));
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── ToolCall ──

/**
 * 列出 Run 的工具调用
 * 对应契约：GET /api/v1/projects/{projectId}/ai/runs/{runId}/tool-calls
 */
export function useToolCalls(
  projectId: string | null | undefined,
  runId: string | null | undefined,
) {
  return useQuery<ToolCallDto[]>({
    queryKey: [...AI_REVIEW_QUERY_KEY, "toolCalls", projectId, runId] as const,
    enabled:
      typeof projectId === "string" &&
      projectId.length > 0 &&
      typeof runId === "string" &&
      runId.length > 0,
    queryFn: () => {
      if (!projectId) throw new Error("projectId is required");
      if (!runId) throw new Error("runId is required");
      return apiGet<ToolCallDto[]>(
        AiReviewApiPaths.toolCalls(projectId, runId),
      );
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 审批 ToolCall（APPROVE / REJECT）
 * 对应契约：POST /api/v1/ai/tool-calls/{toolCallId}/approve | /reject
 *
 * 安全红线：
 *  - 高风险工具调用需 stepUpToken（V0 占位）
 *  - 拒绝需明确原因
 */
export function useApproveToolCall() {
  const queryClient = useQueryClient();
  return useMutation<ToolCallDto, Error, ApproveToolCallRequest>({
    mutationFn: async (request) => {
      const url =
        request.action === "APPROVE"
          ? AiReviewApiPaths.approveToolCall(request.toolCallId)
          : AiReviewApiPaths.rejectToolCall(request.toolCallId);
      return apiPost<ToolCallDto>(url, {
        reason: request.reason,
        stepUpToken: request.stepUpToken,
      });
    },
    onSuccess: (data) => {
      // 失效 ToolCall 列表和 Run 详情
      void queryClient.invalidateQueries({
        queryKey: [...AI_REVIEW_QUERY_KEY, "toolCalls"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...AI_REVIEW_QUERY_KEY, "run"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...AI_REVIEW_QUERY_KEY, "steps"],
      });
      // 失效具体 ToolCall 缓存
      void queryClient.invalidateQueries({
        queryKey: [...AI_REVIEW_QUERY_KEY, "toolCall", data.id],
      });
    },
  });
}

// ── Guardrail ──

/**
 * 列出 Run 的护栏结果
 * 对应契约：GET /api/v1/projects/{projectId}/ai/runs/{runId}/guardrails
 */
export function useGuardrails(
  projectId: string | null | undefined,
  runId: string | null | undefined,
) {
  return useQuery<GuardrailDto[]>({
    queryKey: [...AI_REVIEW_QUERY_KEY, "guardrails", projectId, runId] as const,
    enabled:
      typeof projectId === "string" &&
      projectId.length > 0 &&
      typeof runId === "string" &&
      runId.length > 0,
    queryFn: () => {
      if (!projectId) throw new Error("projectId is required");
      if (!runId) throw new Error("runId is required");
      return apiGet<GuardrailDto[]>(
        AiReviewApiPaths.guardrails(projectId, runId),
      );
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── Evaluation ──

/**
 * 获取 Run 的人工评估
 * 对应契约：GET /api/v1/ai/runs/{runId}/evaluation
 */
export function useReviewEvaluation(runId: string | null | undefined) {
  return useQuery<ReviewEvaluationDto | null>({
    queryKey: [...AI_REVIEW_QUERY_KEY, "evaluation", runId] as const,
    enabled: typeof runId === "string" && runId.length > 0,
    queryFn: () => {
      if (!runId) throw new Error("runId is required");
      return apiGet<ReviewEvaluationDto | null>(
        AiReviewApiPaths.evaluation(runId),
      );
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 提交复核决策
 * 对应契约：POST /api/v1/ai/runs/{runId}/review-decision
 *
 * 主动作（D37.13 §主动作）：
 *  - Accept as Draft / Edit / Reject / Escalate
 *  - 高风险决策需 stepUpToken
 *  - ACCEPT_AS_DRAFT 必须填写 draftType
 *  - 必须勾选 responsibilityAcknowledged（AI 不替代专业审签）
 */
export function useSubmitReviewDecision() {
  const queryClient = useQueryClient();
  return useMutation<ReviewEvaluationDto, Error, SubmitReviewDecisionRequest>({
    mutationFn: async (request) => {
      return apiPost<ReviewEvaluationDto>(
        AiReviewApiPaths.submitDecision(request.runId),
        {
          decision: request.decision,
          reason: request.reason,
          checklist: request.checklist,
          draftType: request.draftType,
          isBlindReview: request.isBlindReview ?? false,
          responsibilityAcknowledged: request.responsibilityAcknowledged,
          targetETag: request.targetETag,
          stepUpToken: request.stepUpToken,
        },
      );
    },
    onSuccess: (data) => {
      // 失效 Run 详情（状态可能变化）
      void queryClient.invalidateQueries({
        queryKey: [...AI_REVIEW_QUERY_KEY, "run"],
      });
      // 失效 Run 列表
      void queryClient.invalidateQueries({
        queryKey: [...AI_REVIEW_QUERY_KEY, "runs"],
      });
      // 失效评估缓存
      void queryClient.invalidateQueries({
        queryKey: [...AI_REVIEW_QUERY_KEY, "evaluation", data.runId],
      });
    },
  });
}

// ── Run 控制 ──

/**
 * 控制 AI 运行（暂停 / 恢复 / 取消）
 * 对应契约：POST /api/v1/projects/{projectId}/ai/runs/{runId}/control
 *
 * D37.13 §Running/Paused：
 *  - 实时 Step、等待审批的 ToolCall、剩余预算、停止/恢复
 *  - 断线 REST 回补，不重复工具调用
 */
export function useControlAiRun() {
  const queryClient = useQueryClient();
  return useMutation<
    AiInvocationRunDto,
    Error,
    { projectId: string } & ControlAiRunRequest
  >({
    mutationFn: async ({ projectId, runId, action, reason }) => {
      return apiPost<AiInvocationRunDto>(
        AiReviewApiPaths.controlRun(projectId, runId),
        { action, reason },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...AI_REVIEW_QUERY_KEY, "run"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...AI_REVIEW_QUERY_KEY, "runs"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...AI_REVIEW_QUERY_KEY, "steps"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...AI_REVIEW_QUERY_KEY, "toolCalls"],
      });
    },
  });
}

// ── 派生工具：聚合统计 ──

/**
 * 计算 Run 的护栏统计
 */
export function computeGuardrailStats(guardrails: GuardrailDto[]): {
  total: number;
  passed: number;
  warning: number;
  blocked: number;
} {
  return {
    total: guardrails.length,
    passed: guardrails.filter((g) => g.status === "PASSED").length,
    warning: guardrails.filter((g) => g.status === "WARNING").length,
    blocked: guardrails.filter((g) => g.status === "BLOCKED").length,
  };
}

/**
 * 计算 Run 的 Token 用量统计
 * @deprecated V0：steps 参数已废弃，仅用于兼容旧调用方
 */
export function computeTokenUsage(
  _steps: AiStepDto[] | undefined,
  toolCalls: ToolCallDto[],
  runTokenUsage?: AiTokenUsageDto | null,
): AiTokenUsageDto {
  // 优先使用 Run 级聚合的 tokenUsage
  if (runTokenUsage) {
    return runTokenUsage;
  }

  // 兜底：从 ToolCall 聚合
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let estimatedCostUsd = 0;

  for (const tc of toolCalls) {
    if (tc.tokenUsage) {
      promptTokens += tc.tokenUsage.promptTokens;
      completionTokens += tc.tokenUsage.completionTokens;
      totalTokens += tc.tokenUsage.totalTokens;
      if (tc.tokenUsage.estimatedCostUsd) {
        estimatedCostUsd += tc.tokenUsage.estimatedCostUsd;
      }
    }
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: estimatedCostUsd > 0 ? estimatedCostUsd : null,
  };
}

// ── 枚举映射常量（供页面组件使用） ──

export const AI_RUN_STATUS_LABEL: Record<AiRunStatus, string> = {
  PENDING: "待执行",
  RUNNING: "执行中",
  PAUSED: "已暂停",
  COMPLETED: "已完成",
  FAILED: "失败",
  CANCELLED: "已取消",
};

export const AI_RUN_STATUS_COLOR: Record<AiRunStatus, string> = {
  PENDING: "default",
  RUNNING: "processing",
  PAUSED: "warning",
  COMPLETED: "success",
  FAILED: "error",
  CANCELLED: "default",
};

export const AI_RUN_MODE_LABEL: Record<AiRunMode, string> = {
  CHAT: "单轮对话",
  AGENT: "Agent 执行",
  RAG: "检索增强",
  REVIEW: "AI 复核",
};

export const AI_RISK_LEVEL_LABEL: Record<AiRiskLevel, string> = {
  LOW: "低风险",
  MEDIUM: "中风险",
  HIGH: "高风险",
  CRITICAL: "极高风险",
};

export const AI_RISK_LEVEL_COLOR: Record<AiRiskLevel, string> = {
  LOW: "default",
  MEDIUM: "gold",
  HIGH: "orange",
  CRITICAL: "red",
};

export const TOOL_CALL_STATUS_LABEL: Record<ToolCallDto["status"], string> = {
  PENDING: "待执行",
  AWAITING_APPROVAL: "等待审批",
  APPROVED: "已批准",
  REJECTED: "已拒绝",
  COMPLETED: "已完成",
  FAILED: "失败",
};

export const TOOL_CALL_STATUS_COLOR: Record<ToolCallDto["status"], string> = {
  PENDING: "default",
  AWAITING_APPROVAL: "warning",
  APPROVED: "processing",
  REJECTED: "error",
  COMPLETED: "success",
  FAILED: "error",
};

export const GUARDRAIL_STATUS_LABEL: Record<GuardrailDto["status"], string> = {
  PASSED: "通过",
  WARNING: "警告",
  BLOCKED: "阻断",
};

export const GUARDRAIL_STATUS_COLOR: Record<GuardrailDto["status"], string> = {
  PASSED: "success",
  WARNING: "warning",
  BLOCKED: "error",
};
