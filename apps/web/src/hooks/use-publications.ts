"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AcknowledgeWarningRequest,
  BaselineDto,
  CreatePublicationRequest,
  EvidenceItemDto,
  ListPublicationsRequest,
  OffsetPageResponse,
  PublicationDetailDto,
  PublicationDto,
  PublicationOperationPhase,
  PublicationOperationPhaseDto,
  ReadinessCheckDto,
  RecallPublicationRequest,
  RecipientDto,
  ReviewerDecisionDto,
  SignatureDto,
  SubmitPublicationRequest,
  UpdateReviewerDecisionRequest,
} from "@design-platform/shared";
import { PublicationApiPaths } from "@design-platform/shared";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api-client";

/**
 * Publication 域 hooks（V0 阶段）
 *
 * 后端 Publication / Submission / Signature / Recipient API 尚未实现，
 * 前端通过这些 hooks 提供统一查询入口；后端实现后无需修改组件代码。
 *
 * 当 API 返回 404 / 501（未实现）时，组件层显示空状态
 * （对齐 D37.15 §空状态：区分"无发布 / 发布中 / 已发布 / 失败 / 已撤回"）。
 *
 * 主动作约束（D37.15 §主动作）：
 *  - 最终提交只在所有阻断项关闭、精确 Baseline 冻结且 SoD 满足时启用
 *  - Step-up 确认后提交 Operation（不可逆）
 *  - 警告项需显式确认处置，不默认勾选
 *
 * 安全红线（design-constraints.md §AI 安全红线）：
 *  - 所有发布必须由注册建筑师 / 工程师签章
 *  - 签名后对象锁定，不可篡改
 */

const PUBLICATION_QUERY_KEY = ["publication"] as const;

/** 判断 API 是否为"未实现"错误（404 / 501） */
function isNotImplementedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  return status === 404 || status === 501;
}

// ── 列表 ──

/** 构造发布列表查询键 */
function buildPublicationsQueryKey(params: ListPublicationsRequest) {
  return [
    ...PUBLICATION_QUERY_KEY,
    "list",
    {
      projectId: params.projectId ?? null,
      status: params.status ?? null,
      keyword: params.keyword ?? null,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
    },
  ] as const;
}

/**
 * 列出发布
 * 对应契约：GET /api/v1/publications
 */
export function usePublications(params: ListPublicationsRequest = {}) {
  return useQuery<OffsetPageResponse<PublicationDto>>({
    queryKey: buildPublicationsQueryKey(params),
    queryFn: () => {
      const search = new URLSearchParams();
      search.set("page", String(params.page ?? 1));
      search.set("pageSize", String(params.pageSize ?? 20));
      if (params.projectId) search.set("projectId", params.projectId);
      if (params.status) search.set("status", params.status);
      if (params.keyword) search.set("keyword", params.keyword);
      const url = `${PublicationApiPaths.list}?${search.toString()}`;
      return apiGet<OffsetPageResponse<PublicationDto>>(url);
    },
    placeholderData: (prev) => prev,
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 发布详情（含子实体）
 * 对应契约：GET /api/v1/publications/{id}
 */
export function usePublicationDetail(id: string | null | undefined) {
  return useQuery<PublicationDetailDto>({
    queryKey: [...PUBLICATION_QUERY_KEY, "detail", id] as const,
    enabled: typeof id === "string" && id.length > 0,
    queryFn: () => {
      if (!id) throw new Error("id is required");
      return apiGet<PublicationDetailDto>(PublicationApiPaths.detail(id));
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── 子实体查询 ──

/**
 * 完整性检查列表
 * 对应契约：GET /api/v1/publications/{id}/checks
 */
export function usePublicationChecks(publicationId: string | null | undefined) {
  return useQuery<ReadinessCheckDto[]>({
    queryKey: [...PUBLICATION_QUERY_KEY, "checks", publicationId] as const,
    enabled: typeof publicationId === "string" && publicationId.length > 0,
    queryFn: () => {
      if (!publicationId) throw new Error("publicationId is required");
      return apiGet<ReadinessCheckDto[]>(
        PublicationApiPaths.checks(publicationId),
      );
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 证据列表
 * 对应契约：GET /api/v1/publications/{id}/evidence
 */
export function usePublicationEvidence(
  publicationId: string | null | undefined,
) {
  return useQuery<EvidenceItemDto[]>({
    queryKey: [...PUBLICATION_QUERY_KEY, "evidence", publicationId] as const,
    enabled: typeof publicationId === "string" && publicationId.length > 0,
    queryFn: () => {
      if (!publicationId) throw new Error("publicationId is required");
      return apiGet<EvidenceItemDto[]>(
        PublicationApiPaths.evidence(publicationId),
      );
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 复核决策列表
 * 对应契约：GET /api/v1/publications/{id}/reviewers
 */
export function usePublicationReviewers(
  publicationId: string | null | undefined,
) {
  return useQuery<ReviewerDecisionDto[]>({
    queryKey: [...PUBLICATION_QUERY_KEY, "reviewers", publicationId] as const,
    enabled: typeof publicationId === "string" && publicationId.length > 0,
    queryFn: () => {
      if (!publicationId) throw new Error("publicationId is required");
      return apiGet<ReviewerDecisionDto[]>(
        PublicationApiPaths.reviewers(publicationId),
      );
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 签名列表
 * 对应契约：GET /api/v1/publications/{id}/signatures
 */
export function usePublicationSignatures(
  publicationId: string | null | undefined,
) {
  return useQuery<SignatureDto[]>({
    queryKey: [...PUBLICATION_QUERY_KEY, "signatures", publicationId] as const,
    enabled: typeof publicationId === "string" && publicationId.length > 0,
    queryFn: () => {
      if (!publicationId) throw new Error("publicationId is required");
      return apiGet<SignatureDto[]>(
        PublicationApiPaths.signatures(publicationId),
      );
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 收件人列表
 * 对应契约：GET /api/v1/publications/{id}/recipients
 */
export function usePublicationRecipients(
  publicationId: string | null | undefined,
) {
  return useQuery<RecipientDto[]>({
    queryKey: [...PUBLICATION_QUERY_KEY, "recipients", publicationId] as const,
    enabled: typeof publicationId === "string" && publicationId.length > 0,
    queryFn: () => {
      if (!publicationId) throw new Error("publicationId is required");
      return apiGet<RecipientDto[]>(
        PublicationApiPaths.recipients(publicationId),
      );
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 操作阶段列表
 * 对应契约：GET /api/v1/publications/{id}/operations
 */
export function usePublicationOperations(
  publicationId: string | null | undefined,
) {
  return useQuery<PublicationOperationPhaseDto[]>({
    queryKey: [...PUBLICATION_QUERY_KEY, "operations", publicationId] as const,
    enabled: typeof publicationId === "string" && publicationId.length > 0,
    queryFn: () => {
      if (!publicationId) throw new Error("publicationId is required");
      return apiGet<PublicationOperationPhaseDto[]>(
        PublicationApiPaths.operations(publicationId),
      );
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── Baseline ──

/**
 * 列出项目下可用的 Baseline
 * 对应契约：GET /api/v1/projects/{projectId}/baselines
 */
export function useBaselines(projectId: string | null | undefined) {
  return useQuery<BaselineDto[]>({
    queryKey: [...PUBLICATION_QUERY_KEY, "baselines", projectId] as const,
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () => {
      if (!projectId) throw new Error("projectId is required");
      return apiGet<BaselineDto[]>(PublicationApiPaths.baselines(projectId));
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── Mutation ──

/**
 * 创建发布（向导 Step 1-5 草稿）
 * 对应契约：POST /api/v1/publications
 */
export function useCreatePublication() {
  const queryClient = useQueryClient();
  return useMutation<PublicationDto, Error, CreatePublicationRequest>({
    mutationFn: async (request) => {
      return apiPost<PublicationDto>(PublicationApiPaths.create, request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...PUBLICATION_QUERY_KEY, "list"],
      });
    },
  });
}

/**
 * 更新发布（草稿阶段）
 * 对应契约：PUT /api/v1/publications/{id}
 */
export function useUpdatePublication() {
  const queryClient = useQueryClient();
  return useMutation<
    PublicationDto,
    Error,
    { id: string; data: Partial<CreatePublicationRequest> }
  >({
    mutationFn: async ({ id, data }) => {
      return apiPut<PublicationDto>(PublicationApiPaths.update(id), data);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: [...PUBLICATION_QUERY_KEY, "detail", data.id],
      });
      void queryClient.invalidateQueries({
        queryKey: [...PUBLICATION_QUERY_KEY, "list"],
      });
    },
  });
}

/**
 * 删除草稿
 * 对应契约：DELETE /api/v1/publications/{id}
 */
export function useDeletePublication() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      return apiDelete<void>(PublicationApiPaths.delete(id));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...PUBLICATION_QUERY_KEY, "list"],
      });
    },
  });
}

/**
 * 确认警告项（向导 Step 3）
 * 对应契约：POST /api/v1/publications/{id}/checks:acknowledge
 *
 * 安全红线：
 *  - 警告项需显式确认处置，不默认勾选
 *  - 高风险确认需 stepUpToken
 */
export function useAcknowledgeWarnings() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, AcknowledgeWarningRequest>({
    mutationFn: async (request) => {
      return apiPost<void>(
        PublicationApiPaths.acknowledgeWarnings(request.publicationId),
        {
          checkIds: request.checkIds,
          stepUpToken: request.stepUpToken,
        },
      );
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...PUBLICATION_QUERY_KEY, "checks", variables.publicationId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...PUBLICATION_QUERY_KEY, "detail", variables.publicationId],
      });
    },
  });
}

/**
 * 更新复核决策（向导 Step 4）
 * 对应契约：POST /api/v1/publications/{id}/reviewers:decide
 *
 * 主动作约束：
 *  - 必须 reason + checklist
 *  - Conditional 须有责任人 / 期限 / 影响范围
 */
export function useUpdateReviewerDecision() {
  const queryClient = useQueryClient();
  return useMutation<ReviewerDecisionDto, Error, UpdateReviewerDecisionRequest>(
    {
      mutationFn: async (request) => {
        return apiPost<ReviewerDecisionDto>(
          PublicationApiPaths.updateReviewerDecision(request.publicationId),
          {
            decision: request.decision,
            reason: request.reason,
            checklist: request.checklist,
            conditionalOwner: request.conditionalOwner,
            conditionalDueAt: request.conditionalDueAt,
            conditionalScope: request.conditionalScope,
          },
        );
      },
      onSuccess: (_, variables) => {
        void queryClient.invalidateQueries({
          queryKey: [
            ...PUBLICATION_QUERY_KEY,
            "reviewers",
            variables.publicationId,
          ],
        });
        void queryClient.invalidateQueries({
          queryKey: [
            ...PUBLICATION_QUERY_KEY,
            "detail",
            variables.publicationId,
          ],
        });
      },
    },
  );
}

/**
 * 提交发布（向导 Step 6，触发 Operation）
 * 对应契约：POST /api/v1/publications/{id}:submit
 *
 * 安全红线：
 *  - 不可逆操作：发布后 Baseline 不可修改，对象锁定，签名不可篡改
 *  - 必须责任确认（responsibilityAcknowledged = true）
 *  - 必须提供 stepUpToken
 */
export function useSubmitPublication() {
  const queryClient = useQueryClient();
  return useMutation<PublicationDetailDto, Error, SubmitPublicationRequest>({
    mutationFn: async (request) => {
      return apiPost<PublicationDetailDto>(
        PublicationApiPaths.submit(request.publicationId),
        {
          stepUpReason: request.stepUpReason,
          stepUpToken: request.stepUpToken,
          responsibilityAcknowledged: request.responsibilityAcknowledged,
        },
      );
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...PUBLICATION_QUERY_KEY, "detail", variables.publicationId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...PUBLICATION_QUERY_KEY, "list"],
      });
      void queryClient.invalidateQueries({
        queryKey: [
          ...PUBLICATION_QUERY_KEY,
          "operations",
          variables.publicationId,
        ],
      });
    },
  });
}

/**
 * 撤回发布
 * 对应契约：POST /api/v1/publications/{id}:recall
 */
export function useRecallPublication() {
  const queryClient = useQueryClient();
  return useMutation<PublicationDto, Error, RecallPublicationRequest>({
    mutationFn: async (request) => {
      return apiPost<PublicationDto>(
        PublicationApiPaths.recall(request.publicationId),
        {
          reason: request.reason,
          stepUpToken: request.stepUpToken,
        },
      );
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...PUBLICATION_QUERY_KEY, "detail", variables.publicationId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...PUBLICATION_QUERY_KEY, "list"],
      });
    },
  });
}

// ── 派生工具：聚合统计 ──

/**
 * 计算完整性检查统计
 */
export function computeCheckStats(checks: ReadinessCheckDto[]) {
  return {
    total: checks.length,
    pass: checks.filter((c) => c.status === "PASS").length,
    warning: checks.filter((c) => c.status === "WARNING").length,
    blocking: checks.filter((c) => c.status === "BLOCKING").length,
    notApplicable: checks.filter((c) => c.status === "NOT_APPLICABLE").length,
  };
}

/**
 * 计算签名统计
 */
export function computeSignatureStats(signatures: SignatureDto[]) {
  return {
    total: signatures.length,
    signed: signatures.filter((s) => s.status === "SIGNED").length,
    pending: signatures.filter((s) => s.status === "PENDING").length,
    rejected: signatures.filter((s) => s.status === "REJECTED").length,
    expired: signatures.filter((s) => s.status === "EXPIRED").length,
  };
}

/**
 * 计算复核矩阵统计
 */
export function computeReviewerStats(reviewers: ReviewerDecisionDto[]) {
  return {
    total: reviewers.length,
    accept: reviewers.filter((r) => r.decision === "ACCEPT").length,
    return: reviewers.filter((r) => r.decision === "RETURN").length,
    reject: reviewers.filter((r) => r.decision === "REJECT").length,
    conditional: reviewers.filter((r) => r.decision === "CONDITIONAL").length,
    pending: reviewers.filter((r) => r.decision === "PENDING").length,
  };
}

/**
 * 计算操作阶段进度
 */
export function computeOperationStats(
  operations: PublicationOperationPhaseDto[],
) {
  const phases: PublicationOperationPhase[] = [
    "SEALING",
    "SIGNING",
    "OBJECT_LOCK",
    "NOTIFICATION",
  ];
  const findByPhase = (phase: PublicationOperationPhase) =>
    operations.find((op) => op.phase === phase);

  return phases.map((phase) => {
    const op = findByPhase(phase);
    return {
      phase,
      status: op?.status ?? "PENDING",
      startedAt: op?.startedAt ?? null,
      completedAt: op?.completedAt ?? null,
      failureReason: op?.failureReason ?? null,
      retryCount: op?.retryCount ?? 0,
    };
  });
}

/**
 * 判断是否可提交（向导 Step 6 启用条件）
 *
 * 主动作约束（D37.15 §主动作）：
 *  - 所有阻断项关闭
 *  - 所有警告项已确认处置
 *  - 所有复核决策非 PENDING
 *  - 所有签名已就位（提交后绑定，提交时允许 PENDING）
 */
export function canSubmitPublication(detail: PublicationDetailDto): {
  canSubmit: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // 阻断项检查
  const blockingCount = detail.checks.filter(
    (c) => c.status === "BLOCKING",
  ).length;
  if (blockingCount > 0) {
    reasons.push(`仍有 ${blockingCount} 个阻断项未关闭`);
  }

  // 警告项确认检查
  const unackWarnings = detail.checks.filter(
    (c) =>
      c.status === "WARNING" && c.requiresAcknowledgment && !c.acknowledgedBy,
  ).length;
  if (unackWarnings > 0) {
    reasons.push(`仍有 ${unackWarnings} 个警告项未确认处置`);
  }

  // 复核决策检查
  const pendingReviewers = detail.reviewers.filter(
    (r) => r.decision === "PENDING",
  ).length;
  if (pendingReviewers > 0) {
    reasons.push(`仍有 ${pendingReviewers} 个专业复核未决策`);
  }

  // 拒绝决策检查
  const rejectedReviewers = detail.reviewers.filter(
    (r) => r.decision === "REJECT",
  ).length;
  if (rejectedReviewers > 0) {
    reasons.push(`存在 ${rejectedReviewers} 个专业拒绝发布`);
  }

  return {
    canSubmit: reasons.length === 0,
    reasons,
  };
}
