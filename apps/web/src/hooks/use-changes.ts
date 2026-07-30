"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AffectedItemDto,
  ApproveChangeRequestRequest,
  ChangeRequestDetailDto,
  ChangeRequestDto,
  ChangeStatus,
  ChangeType,
  ChangePriority,
  ChangeOperationPhaseDto,
  ClosureEvidenceItemDto,
  CreateChangeRequestRequest,
  GenerateTaskPlanRequest,
  ListChangeRequestsRequest,
  OffsetPageResponse,
  RecallChangeRequestRequest,
  RejectChangeRequestRequest,
  SubmitImpactAssessmentRequest,
  TaskPlanItemDto,
  VerifyClosureRequest,
} from "@design-platform/shared";
import {
  CHANGE_PRIORITY_LABEL,
  CHANGE_STATUS_LABEL,
  CHANGE_TYPE_LABEL,
  ChangeApiPaths,
} from "@design-platform/shared";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api-client";

/**
 * Change 域 hooks（V0 阶段，P12 变更影响与闭环工作台 D37.16）
 *
 * 后端 ChangeRequest / ImpactGraph / TaskPlan / ClosureEvidence API 尚未实现，
 * 前端通过这些 hooks 提供统一查询入口；后端实现后无需修改组件代码。
 *
 * 当 API 返回 404 / 501（未实现）时，组件层显示空状态
 * （对齐 D37.16 §空状态：区分"尚未分析 / 确认无影响 / Unknown 阻断"）。
 *
 * 主动作约束（D37.16 §主动作）：
 *  - 批准与实施/关闭职责分离
 *  - 不能在同一账号下完成批准+实施+关闭
 *  - 高风险变更（CRITICAL 优先级）强制 stepUpToken 二次认证
 *  - Unknown 影响项阻断高风险关闭
 *
 * 安全红线（design-constraints.md §AI 安全红线）：
 *  - 所有变更必须可追溯（影响版本、水位、Owner）
 *  - AI 辅助影响分析结果须人工确认
 *  - 关闭证据须可验证
 */

const CHANGE_QUERY_KEY = ["change"] as const;

/** 判断 API 是否为"未实现"错误（404 / 501） */
function isNotImplementedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  return status === 404 || status === 501;
}

// ── 列表 ──

/** 构造变更请求列表查询键 */
function buildChangesQueryKey(params: ListChangeRequestsRequest) {
  return [
    ...CHANGE_QUERY_KEY,
    "list",
    {
      projectId: params.projectId ?? null,
      status: params.status ?? null,
      type: params.type ?? null,
      priority: params.priority ?? null,
      keyword: params.keyword ?? null,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
    },
  ] as const;
}

/**
 * 列出变更请求
 * 对应契约：GET /api/v1/changes
 */
export function useChangeRequests(params: ListChangeRequestsRequest = {}) {
  return useQuery<OffsetPageResponse<ChangeRequestDto>>({
    queryKey: buildChangesQueryKey(params),
    queryFn: () => {
      const search = new URLSearchParams();
      search.set("page", String(params.page ?? 1));
      search.set("pageSize", String(params.pageSize ?? 20));
      if (params.projectId) search.set("projectId", params.projectId);
      if (params.status) search.set("status", params.status);
      if (params.type) search.set("type", params.type);
      if (params.priority) search.set("priority", params.priority);
      if (params.keyword) search.set("keyword", params.keyword);
      const url = `${ChangeApiPaths.list}?${search.toString()}`;
      return apiGet<OffsetPageResponse<ChangeRequestDto>>(url);
    },
    placeholderData: (prev) => prev,
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── 详情 ──

/**
 * 变更请求详情（含子实体）
 * 对应契约：GET /api/v1/changes/{id}
 */
export function useChangeRequestDetail(changeId: string | null | undefined) {
  return useQuery<ChangeRequestDetailDto>({
    queryKey: [...CHANGE_QUERY_KEY, "detail", changeId],
    enabled: !!changeId,
    queryFn: () =>
      apiGet<ChangeRequestDetailDto>(ChangeApiPaths.detail(changeId!)),
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── 子实体列表 ──

/**
 * 受影响项列表
 * 对应契约：GET /api/v1/changes/{id}/affected-items
 */
export function useAffectedItems(changeId: string | null | undefined) {
  return useQuery<AffectedItemDto[]>({
    queryKey: [...CHANGE_QUERY_KEY, "affected-items", changeId],
    enabled: !!changeId,
    queryFn: () =>
      apiGet<AffectedItemDto[]>(ChangeApiPaths.affectedItems(changeId!)),
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 处置任务列表
 * 对应契约：GET /api/v1/changes/{id}/task-plans
 */
export function useTaskPlans(changeId: string | null | undefined) {
  return useQuery<TaskPlanItemDto[]>({
    queryKey: [...CHANGE_QUERY_KEY, "task-plans", changeId],
    enabled: !!changeId,
    queryFn: () =>
      apiGet<TaskPlanItemDto[]>(ChangeApiPaths.taskPlans(changeId!)),
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 关闭证据列表
 * 对应契约：GET /api/v1/changes/{id}/closure-evidences
 */
export function useClosureEvidences(changeId: string | null | undefined) {
  return useQuery<ClosureEvidenceItemDto[]>({
    queryKey: [...CHANGE_QUERY_KEY, "closure-evidences", changeId],
    enabled: !!changeId,
    queryFn: () =>
      apiGet<ClosureEvidenceItemDto[]>(
        ChangeApiPaths.closureEvidences(changeId!),
      ),
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 操作阶段时间线
 * 对应契约：GET /api/v1/changes/{id}/operations
 */
export function useChangeOperations(changeId: string | null | undefined) {
  return useQuery<ChangeOperationPhaseDto[]>({
    queryKey: [...CHANGE_QUERY_KEY, "operations", changeId],
    enabled: !!changeId,
    queryFn: () =>
      apiGet<ChangeOperationPhaseDto[]>(ChangeApiPaths.operations(changeId!)),
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── Mutations ──

/**
 * 创建变更请求
 * 对应契约：POST /api/v1/changes
 */
export function useCreateChangeRequest() {
  const queryClient = useQueryClient();
  return useMutation<ChangeRequestDto, Error, CreateChangeRequestRequest>({
    mutationFn: (request) =>
      apiPost<ChangeRequestDto>(ChangeApiPaths.create, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...CHANGE_QUERY_KEY, "list"],
      });
    },
  });
}

/**
 * 更新变更请求（草稿阶段）
 * 对应契约：PUT /api/v1/changes/{id}
 */
export function useUpdateChangeRequest() {
  const queryClient = useQueryClient();
  return useMutation<
    ChangeRequestDetailDto,
    Error,
    { changeId: string; data: Partial<CreateChangeRequestRequest> }
  >({
    mutationFn: ({ changeId, data }) =>
      apiPut<ChangeRequestDetailDto>(ChangeApiPaths.update(changeId), data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...CHANGE_QUERY_KEY, "detail", variables.changeId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...CHANGE_QUERY_KEY, "list"],
      });
    },
  });
}

/**
 * 删除草稿
 * 对应契约：DELETE /api/v1/changes/{id}
 */
export function useDeleteChangeRequest() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (changeId) => apiDelete(ChangeApiPaths.delete(changeId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...CHANGE_QUERY_KEY, "list"],
      });
    },
  });
}

/**
 * 提交影响评估
 * 安全红线：
 *  - "尚未分析"与"确认无影响"严格分离（confirmedNoImpact 必须明确）
 *  - Unknown 影响项阻断关闭，必须先解决
 */
export function useSubmitImpactAssessment() {
  const queryClient = useQueryClient();
  return useMutation<
    ChangeRequestDetailDto,
    Error,
    SubmitImpactAssessmentRequest
  >({
    mutationFn: (request) =>
      apiPost<ChangeRequestDetailDto>(
        ChangeApiPaths.submitImpactAssessment(request.changeId),
        {
          impactAssessment: request.impactAssessment,
          confirmedNoImpact: request.confirmedNoImpact,
          stepUpToken: request.stepUpToken,
        },
      ),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...CHANGE_QUERY_KEY, "detail", variables.changeId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...CHANGE_QUERY_KEY, "affected-items", variables.changeId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...CHANGE_QUERY_KEY, "operations", variables.changeId],
      });
    },
  });
}

/**
 * 批准变更请求
 * 安全红线：
 *  - 不可逆操作（批准后进入实施阶段）
 *  - 必须责任确认（responsibilityAcknowledged = true）
 *  - 必须提供 stepUpToken
 *  - 批准人与实施人/关闭人职责分离
 */
export function useApproveChangeRequest() {
  const queryClient = useQueryClient();
  return useMutation<
    ChangeRequestDetailDto,
    Error,
    ApproveChangeRequestRequest
  >({
    mutationFn: (request) =>
      apiPost<ChangeRequestDetailDto>(
        ChangeApiPaths.approve(request.changeId),
        {
          comment: request.comment,
          stepUpToken: request.stepUpToken,
          responsibilityAcknowledged: request.responsibilityAcknowledged,
        },
      ),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...CHANGE_QUERY_KEY, "detail", variables.changeId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...CHANGE_QUERY_KEY, "operations", variables.changeId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...CHANGE_QUERY_KEY, "list"],
      });
    },
  });
}

/**
 * 拒绝变更请求
 */
export function useRejectChangeRequest() {
  const queryClient = useQueryClient();
  return useMutation<ChangeRequestDetailDto, Error, RejectChangeRequestRequest>(
    {
      mutationFn: (request) =>
        apiPost<ChangeRequestDetailDto>(
          ChangeApiPaths.reject(request.changeId),
          {
            reason: request.reason,
            stepUpToken: request.stepUpToken,
          },
        ),
      onSuccess: (_, variables) => {
        void queryClient.invalidateQueries({
          queryKey: [...CHANGE_QUERY_KEY, "detail", variables.changeId],
        });
        void queryClient.invalidateQueries({
          queryKey: [...CHANGE_QUERY_KEY, "operations", variables.changeId],
        });
        void queryClient.invalidateQueries({
          queryKey: [...CHANGE_QUERY_KEY, "list"],
        });
      },
    },
  );
}

/**
 * 生成处置任务
 * 对应契约：POST /api/v1/changes/{id}/task-plans:generate
 */
export function useGenerateTaskPlan() {
  const queryClient = useQueryClient();
  return useMutation<TaskPlanItemDto[], Error, GenerateTaskPlanRequest>({
    mutationFn: (request) =>
      apiPost<TaskPlanItemDto[]>(
        ChangeApiPaths.generateTaskPlan(request.changeId),
        {
          strategy: request.strategy ?? "AUTO",
        },
      ),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...CHANGE_QUERY_KEY, "task-plans", variables.changeId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...CHANGE_QUERY_KEY, "detail", variables.changeId],
      });
    },
  });
}

/**
 * 验证关闭
 * 安全红线：
 *  - 不可逆操作（关闭后变更请求进入终态）
 *  - 必须责任确认（responsibilityAcknowledged = true）
 *  - 必须提供 stepUpToken
 *  - 关闭人与批准人/实施人职责分离
 *  - Unknown 影响项阻断关闭
 */
export function useVerifyClosure() {
  const queryClient = useQueryClient();
  return useMutation<ChangeRequestDetailDto, Error, VerifyClosureRequest>({
    mutationFn: (request) =>
      apiPost<ChangeRequestDetailDto>(
        ChangeApiPaths.verifyClosure(request.changeId),
        {
          verificationResult: request.verificationResult,
          comment: request.comment,
          stepUpToken: request.stepUpToken,
          responsibilityAcknowledged: request.responsibilityAcknowledged,
        },
      ),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...CHANGE_QUERY_KEY, "detail", variables.changeId],
      });
      void queryClient.invalidateQueries({
        queryKey: [
          ...CHANGE_QUERY_KEY,
          "closure-evidences",
          variables.changeId,
        ],
      });
      void queryClient.invalidateQueries({
        queryKey: [...CHANGE_QUERY_KEY, "operations", variables.changeId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...CHANGE_QUERY_KEY, "list"],
      });
    },
  });
}

/**
 * 撤回变更请求
 * 安全红线：
 *  - 必须提供 stepUpToken
 *  - 撤回原因必须明确
 */
export function useRecallChangeRequest() {
  const queryClient = useQueryClient();
  return useMutation<ChangeRequestDetailDto, Error, RecallChangeRequestRequest>(
    {
      mutationFn: (request) =>
        apiPost<ChangeRequestDetailDto>(
          ChangeApiPaths.recall(request.changeId),
          {
            reason: request.reason,
            stepUpToken: request.stepUpToken,
          },
        ),
      onSuccess: (_, variables) => {
        void queryClient.invalidateQueries({
          queryKey: [...CHANGE_QUERY_KEY, "detail", variables.changeId],
        });
        void queryClient.invalidateQueries({
          queryKey: [...CHANGE_QUERY_KEY, "operations", variables.changeId],
        });
        void queryClient.invalidateQueries({
          queryKey: [...CHANGE_QUERY_KEY, "list"],
        });
      },
    },
  );
}

// ── 派生工具函数 ──

/** 计算受影响项统计 */
export function computeAffectedItemsStats(items: AffectedItemDto[]) {
  const confirmed = items.filter((i) => i.impact === "CONFIRMED").length;
  const potential = items.filter((i) => i.impact === "POTENTIAL").length;
  const unknown = items.filter((i) => i.impact === "UNKNOWN").length;
  const notAffected = items.filter((i) => i.impact === "NOT_AFFECTED").length;
  const needRecheck = items.filter(
    (i) => i.recheckRequired && i.recheckStatus !== "COMPLETED",
  ).length;
  return {
    total: items.length,
    confirmed,
    potential,
    unknown,
    notAffected,
    needRecheck,
    /** Unknown 阻断高风险关闭（对齐 D37.16 §空/未知） */
    blocksClosure: unknown > 0,
  };
}

/** 计算处置任务统计 */
export function computeTaskPlanStats(tasks: TaskPlanItemDto[]) {
  const todo = tasks.filter((t) => t.status === "TODO").length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const done = tasks.filter((t) => t.status === "DONE").length;
  const blocked = tasks.filter((t) => t.status === "BLOCKED").length;
  const cancelled = tasks.filter((t) => t.status === "CANCELLED").length;
  return {
    total: tasks.length,
    todo,
    inProgress,
    done,
    blocked,
    cancelled,
    /** 完成率 */
    completionRate:
      tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
  };
}

/** 计算关闭证据统计 */
export function computeClosureEvidenceStats(
  evidences: ClosureEvidenceItemDto[],
) {
  const pending = evidences.filter((e) => e.status === "PENDING").length;
  const verified = evidences.filter((e) => e.status === "VERIFIED").length;
  const rejected = evidences.filter((e) => e.status === "REJECTED").length;
  return {
    total: evidences.length,
    pending,
    verified,
    rejected,
    /** 全部已验证才可关闭 */
    allVerified: evidences.length > 0 && pending === 0 && rejected === 0,
  };
}

/**
 * 判断是否可提交影响评估
 * 约束（对齐 D37.16 §正常状态）：
 *  - 必须有受影响项分析（或明确确认无影响）
 *  - 不能有 Unknown 项（必须先解决）
 */
export function canSubmitImpactAssessment(detail: ChangeRequestDetailDto): {
  canSubmit: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const stats = computeAffectedItemsStats(detail.affectedItems);

  if (stats.unknown > 0) {
    reasons.push(`仍有 ${stats.unknown} 个 Unknown 影响项未确认`);
  }

  if (!detail.impactAssessment || detail.impactAssessment.trim().length < 10) {
    reasons.push("影响评估结论尚未填写或过短");
  }

  return {
    canSubmit: reasons.length === 0,
    reasons,
  };
}

/**
 * 判断是否可批准变更
 * 约束（对齐 D37.16 §主动作）：
 *  - 影响评估已完成
 *  - 无 Unknown 项
 *  - 职责分离：批准人不能是发起人
 */
export function canApproveChange(detail: ChangeRequestDetailDto): {
  canApprove: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (
    detail.status !== "PENDING_APPROVAL" &&
    detail.status !== "IMPACT_ASSESSMENT"
  ) {
    reasons.push(`当前状态 ${detail.status} 不允许批准`);
  }

  const stats = computeAffectedItemsStats(detail.affectedItems);
  if (stats.unknown > 0) {
    reasons.push(`仍有 ${stats.unknown} 个 Unknown 影响项未确认`);
  }

  if (!detail.impactAssessment || detail.impactAssessment.trim().length === 0) {
    reasons.push("影响评估结论未填写");
  }

  return {
    canApprove: reasons.length === 0,
    reasons,
  };
}

/**
 * 判断是否可验证关闭
 * 约束（对齐 D37.16 §闭环）：
 *  - 所有处置任务已完成
 *  - 所有关闭证据已验证
 *  - 无 Unknown 项
 *  - 职责分离：关闭人不能是批准人/实施人
 */
export function canVerifyClosure(detail: ChangeRequestDetailDto): {
  canVerify: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (detail.status !== "VERIFICATION" && detail.status !== "IN_PROGRESS") {
    reasons.push(`当前状态 ${detail.status} 不允许验证关闭`);
  }

  const taskStats = computeTaskPlanStats(detail.taskPlan);
  if (taskStats.todo > 0 || taskStats.inProgress > 0) {
    reasons.push(
      `仍有 ${taskStats.todo + taskStats.inProgress} 个处置任务未完成`,
    );
  }
  if (taskStats.blocked > 0) {
    reasons.push(`仍有 ${taskStats.blocked} 个处置任务被阻塞`);
  }

  const evidenceStats = computeClosureEvidenceStats(detail.closureEvidences);
  if (evidenceStats.pending > 0) {
    reasons.push(`仍有 ${evidenceStats.pending} 个关闭证据待验证`);
  }
  if (evidenceStats.rejected > 0) {
    reasons.push(`仍有 ${evidenceStats.rejected} 个关闭证据被拒绝`);
  }

  const affectedStats = computeAffectedItemsStats(detail.affectedItems);
  if (affectedStats.unknown > 0) {
    reasons.push(`仍有 ${affectedStats.unknown} 个 Unknown 影响项`);
  }

  return {
    canVerify: reasons.length === 0,
    reasons,
  };
}

/** 状态过滤选项 */
export const CHANGE_STATUS_OPTIONS: { value: ChangeStatus; label: string }[] = (
  Object.keys(CHANGE_STATUS_LABEL) as ChangeStatus[]
).map((value) => ({
  value,
  label: CHANGE_STATUS_LABEL[value],
}));

/** 类型过滤选项 */
export const CHANGE_TYPE_OPTIONS: { value: ChangeType; label: string }[] = (
  Object.keys(CHANGE_TYPE_LABEL) as ChangeType[]
).map((value) => ({
  value,
  label: CHANGE_TYPE_LABEL[value],
}));

/** 优先级过滤选项 */
export const CHANGE_PRIORITY_OPTIONS: {
  value: ChangePriority;
  label: string;
}[] = (Object.keys(CHANGE_PRIORITY_LABEL) as ChangePriority[]).map((value) => ({
  value,
  label: CHANGE_PRIORITY_LABEL[value],
}));
