"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ClashRuleDto,
  ClashRunDto,
  ClusterDto,
  CreateClashRunRequest,
  CreateCommentRequest,
  CreateIssueFromFindingRequest,
  CreateWaiverRequest,
  FindingDto,
  IssueCommentDto,
  ListClashRunsRequest,
  ListClustersRequest,
  ListFindingsRequest,
  MergeClusterRequest,
  OffsetPageResponse,
  ReviewWaiverRequest,
  ViewpointDto,
  WaiverDto,
} from "@design-platform/shared";
import { CoordinationApiPaths } from "@design-platform/shared";
import { apiGet, apiPost } from "@/lib/api-client";

/**
 * Coordination 域 hooks（V0 阶段）
 *
 * 后端 Coordination API（ClashRun/Finding/Cluster/Waiver）尚未实现，
 * 前端通过这些 hooks 提供统一查询入口；后端实现后无需修改组件代码。
 *
 * 当 API 返回 404 / 501（未实现）时，组件层显示空状态
 * （对齐 D37.11 §空状态：区分"当前无 Run / Run 进行中 / Run 已完成但无 Finding"）。
 *
 * 主动作约束（D37.11 §主动作）：
 *  - 验证候选并创建/关联 Issue
 *  - Run 结果不能直接成为已确认 Issue（必须人工确认）
 *  - 关闭 Issue 需验证新模型版本和证据
 */

const COORDINATION_QUERY_KEY = ["coordination"] as const;

/** 判断 API 是否为"未实现"错误（404 / 501） */
function isNotImplementedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  return status === 404 || status === 501;
}

// ── Rule ──

/**
 * 列出碰撞规则
 * 对应契约：GET /api/v1/projects/{projectId}/coordination/rules
 */
export function useCoordinationRules(projectId: string | null | undefined) {
  return useQuery<ClashRuleDto[]>({
    queryKey: [...COORDINATION_QUERY_KEY, "rules", projectId] as const,
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () => {
      if (!projectId) throw new Error("projectId is required");
      return apiGet<ClashRuleDto[]>(CoordinationApiPaths.rules(projectId));
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── ClashRun ──

/** 构造 ClashRun 列表查询键 */
function buildClashRunsQueryKey(
  projectId: string,
  params: ListClashRunsRequest,
) {
  return [
    ...COORDINATION_QUERY_KEY,
    "runs",
    projectId,
    {
      status: params.status ?? null,
      checkType: params.checkType ?? null,
      latestOnly: params.latestOnly ?? false,
    },
  ] as const;
}

/**
 * 列出碰撞检测运行
 * 对应契约：GET /api/v1/projects/{projectId}/coordination/runs
 */
export function useClashRuns(
  projectId: string | null | undefined,
  params: ListClashRunsRequest = {},
) {
  return useQuery<ClashRunDto[]>({
    queryKey:
      typeof projectId === "string"
        ? buildClashRunsQueryKey(projectId, params)
        : ([COORDINATION_QUERY_KEY, "runs", null] as const),
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () => {
      if (!projectId) throw new Error("projectId is required");
      const search = new URLSearchParams();
      if (params.status) search.set("status", params.status);
      if (params.checkType) search.set("checkType", params.checkType);
      if (params.latestOnly) search.set("latestOnly", "true");
      const query = search.toString();
      const url = query
        ? `${CoordinationApiPaths.runs(projectId)}?${query}`
        : CoordinationApiPaths.runs(projectId);
      return apiGet<ClashRunDto[]>(url);
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * ClashRun 详情
 * 对应契约：GET /api/v1/coordination/runs/{runId}
 */
export function useClashRun(runId: string | null | undefined) {
  return useQuery<ClashRunDto>({
    queryKey: [...COORDINATION_QUERY_KEY, "run", runId] as const,
    enabled: typeof runId === "string" && runId.length > 0,
    queryFn: () => {
      if (!runId) throw new Error("runId is required");
      return apiGet<ClashRunDto>(CoordinationApiPaths.runDetail(runId));
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 创建 ClashRun
 * 对应契约：POST /api/v1/projects/{projectId}/coordination/runs
 */
export function useCreateClashRun() {
  const queryClient = useQueryClient();
  return useMutation<ClashRunDto, Error, CreateClashRunRequest>({
    mutationFn: async (request) => {
      const { projectId } = request;
      return apiPost<ClashRunDto>(
        CoordinationApiPaths.runs(projectId),
        request,
      );
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: [...COORDINATION_QUERY_KEY, "runs", data.projectId],
      });
    },
  });
}

/**
 * 执行 ClashRun
 * 对应契约：POST /api/v1/coordination/runs/{runId}:execute
 */
export function useExecuteClashRun() {
  const queryClient = useQueryClient();
  return useMutation<ClashRunDto, Error, { runId: string }>({
    mutationFn: async ({ runId }) => {
      return apiPost<ClashRunDto>(CoordinationApiPaths.runExecute(runId), {});
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: [...COORDINATION_QUERY_KEY, "run", data.id],
      });
      void queryClient.invalidateQueries({
        queryKey: [...COORDINATION_QUERY_KEY, "runs", data.projectId],
      });
      // 同时失效 Finding 与 Cluster 缓存
      void queryClient.invalidateQueries({
        queryKey: [...COORDINATION_QUERY_KEY, "findings", data.id],
      });
      void queryClient.invalidateQueries({
        queryKey: [...COORDINATION_QUERY_KEY, "clusters", data.id],
      });
    },
  });
}

/**
 * 取消 ClashRun
 * 对应契约：POST /api/v1/coordination/runs/{runId}:cancel
 */
export function useCancelClashRun() {
  const queryClient = useQueryClient();
  return useMutation<ClashRunDto, Error, { runId: string; reason?: string }>({
    mutationFn: async ({ runId, reason }) => {
      return apiPost<ClashRunDto>(CoordinationApiPaths.runCancel(runId), {
        reason,
      });
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: [...COORDINATION_QUERY_KEY, "run", data.id],
      });
      void queryClient.invalidateQueries({
        queryKey: [...COORDINATION_QUERY_KEY, "runs", data.projectId],
      });
    },
  });
}

// ── Finding ──

/** 构造 Finding 列表查询键 */
function buildFindingsQueryKey(params: ListFindingsRequest) {
  return [
    ...COORDINATION_QUERY_KEY,
    "findings",
    params.runId,
    {
      severity: params.severity ?? null,
      status: params.status ?? null,
      clusterId: params.clusterId ?? null,
      keyword: params.keyword ?? "",
      unclusteredOnly: params.unclusteredOnly ?? false,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
      sort: params.sort ?? null,
      order: params.order ?? null,
    },
  ] as const;
}

/**
 * 列出 Finding
 * 对应契约：GET /api/v1/coordination/runs/{runId}/findings
 */
export function useFindings(params: ListFindingsRequest) {
  return useQuery<OffsetPageResponse<FindingDto>>({
    queryKey: buildFindingsQueryKey(params),
    enabled: typeof params.runId === "string" && params.runId.length > 0,
    queryFn: () => {
      const search = new URLSearchParams();
      search.set("page", String(params.page ?? 1));
      search.set("pageSize", String(params.pageSize ?? 50));
      if (params.severity) search.set("severity", params.severity);
      if (params.status) search.set("status", params.status);
      if (params.clusterId) search.set("clusterId", params.clusterId);
      if (params.keyword && params.keyword.trim().length > 0) {
        search.set("keyword", params.keyword.trim());
      }
      if (params.unclusteredOnly) search.set("unclusteredOnly", "true");
      if (params.sort) search.set("sort", params.sort);
      if (params.order) search.set("order", params.order);
      const url = `${CoordinationApiPaths.findings(params.runId)}?${search.toString()}`;
      return apiGet<OffsetPageResponse<FindingDto>>(url);
    },
    placeholderData: (prev) => prev,
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * Finding 详情
 * 对应契约：GET /api/v1/coordination/findings/{findingId}
 */
export function useFinding(findingId: string | null | undefined) {
  return useQuery<FindingDto>({
    queryKey: [...COORDINATION_QUERY_KEY, "finding", findingId] as const,
    enabled: typeof findingId === "string" && findingId.length > 0,
    queryFn: () => {
      if (!findingId) throw new Error("findingId is required");
      return apiGet<FindingDto>(CoordinationApiPaths.findingDetail(findingId));
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── Cluster ──

/** 构造 Cluster 列表查询键 */
function buildClustersQueryKey(params: ListClustersRequest) {
  return [
    ...COORDINATION_QUERY_KEY,
    "clusters",
    params.runId,
    {
      status: params.status ?? null,
      unreviewedOnly: params.unreviewedOnly ?? false,
      minConfidence: params.minConfidence ?? null,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
    },
  ] as const;
}

/**
 * 列出 Cluster
 * 对应契约：GET /api/v1/coordination/runs/{runId}/clusters
 */
export function useClusters(params: ListClustersRequest) {
  return useQuery<OffsetPageResponse<ClusterDto>>({
    queryKey: buildClustersQueryKey(params),
    enabled: typeof params.runId === "string" && params.runId.length > 0,
    queryFn: () => {
      const search = new URLSearchParams();
      search.set("page", String(params.page ?? 1));
      search.set("pageSize", String(params.pageSize ?? 50));
      if (params.status) search.set("status", params.status);
      if (params.unreviewedOnly) search.set("unreviewedOnly", "true");
      if (params.minConfidence !== undefined) {
        search.set("minConfidence", String(params.minConfidence));
      }
      const url = `${CoordinationApiPaths.clusters(params.runId)}?${search.toString()}`;
      return apiGet<OffsetPageResponse<ClusterDto>>(url);
    },
    placeholderData: (prev) => prev,
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * Cluster 详情
 * 对应契约：GET /api/v1/coordination/clusters/{clusterId}
 */
export function useCluster(clusterId: string | null | undefined) {
  return useQuery<ClusterDto>({
    queryKey: [...COORDINATION_QUERY_KEY, "cluster", clusterId] as const,
    enabled: typeof clusterId === "string" && clusterId.length > 0,
    queryFn: () => {
      if (!clusterId) throw new Error("clusterId is required");
      return apiGet<ClusterDto>(CoordinationApiPaths.clusterDetail(clusterId));
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 确认 Cluster（人工审核通过）
 * 对应契约：POST /api/v1/coordination/clusters/{clusterId}:approve
 */
export function useApproveCluster() {
  const queryClient = useQueryClient();
  return useMutation<
    ClusterDto,
    Error,
    { clusterId: string; comment?: string }
  >({
    mutationFn: async ({ clusterId, comment }) => {
      return apiPost<ClusterDto>(
        CoordinationApiPaths.clusterApprove(clusterId),
        {
          comment,
        },
      );
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: [...COORDINATION_QUERY_KEY, "cluster", data.id],
      });
      void queryClient.invalidateQueries({
        queryKey: [...COORDINATION_QUERY_KEY, "clusters", data.runId],
      });
    },
  });
}

/**
 * 驳回 Cluster（人工不认可聚类）
 * 对应契约：POST /api/v1/coordination/clusters/{clusterId}:dismiss
 */
export function useDismissCluster() {
  const queryClient = useQueryClient();
  return useMutation<ClusterDto, Error, { clusterId: string; reason: string }>({
    mutationFn: async ({ clusterId, reason }) => {
      return apiPost<ClusterDto>(
        CoordinationApiPaths.clusterDismiss(clusterId),
        {
          reason,
        },
      );
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: [...COORDINATION_QUERY_KEY, "cluster", data.id],
      });
      void queryClient.invalidateQueries({
        queryKey: [...COORDINATION_QUERY_KEY, "clusters", data.runId],
      });
    },
  });
}

/**
 * 合并 Cluster
 * 对应契约：POST /api/v1/coordination/clusters:merge
 */
export function useMergeClusters() {
  const queryClient = useQueryClient();
  return useMutation<ClusterDto, Error, MergeClusterRequest>({
    mutationFn: async (request) => {
      return apiPost<ClusterDto>(CoordinationApiPaths.clusterMerge(), request);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: [...COORDINATION_QUERY_KEY, "clusters", data.runId],
      });
    },
  });
}

// ── Issue 创建/关联 ──

/**
 * 从 Finding 或 Cluster 创建 Issue
 * 对应契约：POST /api/v1/coordination/issues:from-finding
 *
 * D37.11 §主动作约束：
 *  - Run 结果不能直接成为已确认 Issue，必须人工确认
 *  - 此接口用于 Finding/Cluster → Issue 转换
 */
export function useCreateIssueFromFinding() {
  const queryClient = useQueryClient();
  return useMutation<
    { issueId: string; findingId?: string; clusterId?: string },
    Error,
    CreateIssueFromFindingRequest
  >({
    mutationFn: async (request) => {
      return apiPost<{
        issueId: string;
        findingId?: string;
        clusterId?: string;
      }>(CoordinationApiPaths.issueCreateFromFinding(), request);
    },
    onSuccess: () => {
      // 失效所有 coordination 缓存（影响 finding/cluster/issue 多处）
      void queryClient.invalidateQueries({
        queryKey: [...COORDINATION_QUERY_KEY],
      });
    },
  });
}

// ── Viewpoint ──

/**
 * 列出 Issue 的 Viewpoint
 * 对应契约：GET /api/v1/coordination/issues/{issueId}/viewpoints
 */
export function useViewpoints(issueId: string | null | undefined) {
  return useQuery<ViewpointDto[]>({
    queryKey: [...COORDINATION_QUERY_KEY, "viewpoints", issueId] as const,
    enabled: typeof issueId === "string" && issueId.length > 0,
    queryFn: () => {
      if (!issueId) throw new Error("issueId is required");
      return apiGet<ViewpointDto[]>(CoordinationApiPaths.viewpoints(issueId));
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── Comment ──

/**
 * 列出 Issue 的评论
 * 对应契约：GET /api/v1/coordination/issues/{issueId}/comments
 */
export function useComments(issueId: string | null | undefined) {
  return useQuery<IssueCommentDto[]>({
    queryKey: [...COORDINATION_QUERY_KEY, "comments", issueId] as const,
    enabled: typeof issueId === "string" && issueId.length > 0,
    queryFn: () => {
      if (!issueId) throw new Error("issueId is required");
      return apiGet<IssueCommentDto[]>(CoordinationApiPaths.comments(issueId));
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 创建评论
 * 对应契约：POST /api/v1/coordination/issues/{issueId}/comments
 *
 * D37.11 §冲突：Issue 已更新时评论草稿保留；
 *               状态/负责人变更要求重新加载或基于新 ETag 提交
 */
export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation<IssueCommentDto, Error, CreateCommentRequest>({
    mutationFn: async (request) => {
      return apiPost<IssueCommentDto>(
        CoordinationApiPaths.comments(request.issueId),
        request,
      );
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...COORDINATION_QUERY_KEY, "comments", variables.issueId],
      });
    },
  });
}

// ── Waiver ──

/**
 * 列出 Issue 的豁免
 * 对应契约：GET /api/v1/coordination/issues/{issueId}/waivers
 */
export function useWaivers(issueId: string | null | undefined) {
  return useQuery<WaiverDto[]>({
    queryKey: [...COORDINATION_QUERY_KEY, "waivers", issueId] as const,
    enabled: typeof issueId === "string" && issueId.length > 0,
    queryFn: () => {
      if (!issueId) throw new Error("issueId is required");
      return apiGet<WaiverDto[]>(CoordinationApiPaths.waivers(issueId));
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 创建豁免
 * 对应契约：POST /api/v1/coordination/issues/{issueId}/waivers
 *
 * D37.11 §关闭/豁免：
 *  - Waiver 显示范围/期限/批准人
 *  - 过期自动回待审
 */
export function useCreateWaiver() {
  const queryClient = useQueryClient();
  return useMutation<WaiverDto, Error, CreateWaiverRequest>({
    mutationFn: async (request) => {
      return apiPost<WaiverDto>(
        CoordinationApiPaths.waivers(request.issueId),
        request,
      );
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...COORDINATION_QUERY_KEY, "waivers", variables.issueId],
      });
    },
  });
}

/**
 * 审核 Waiver（APPROVE / REJECT）
 * 对应契约：POST /api/v1/coordination/waivers/{waiverId}:review
 */
export function useReviewWaiver() {
  const queryClient = useQueryClient();
  return useMutation<WaiverDto, Error, ReviewWaiverRequest>({
    mutationFn: async (request) => {
      return apiPost<WaiverDto>(
        CoordinationApiPaths.waiverReview(request.waiverId),
        request,
      );
    },
    onSuccess: () => {
      // 失效所有 waivers 缓存（review 可能影响多个 issue 的 waiver 列表）
      void queryClient.invalidateQueries({
        queryKey: [...COORDINATION_QUERY_KEY, "waivers"],
      });
    },
  });
}
