"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ConnectorRegisterRequest,
  ConnectorStatusDto,
  DualApprovalReviewRequest,
  DualApprovalReviewResponseDto,
  DualApprovalStatus,
  ListConnectorsRequest,
  ListQueueTasksRequest,
  ListWorkersRequest,
  OperationsActionRequest,
  OperationsActionResponseDto,
  OperationsOverviewDto,
  OffsetPageResponse,
  QueueTaskDto,
  SloTargetDto,
  WorkerStatusDto,
} from "@design-platform/shared";
import { MonitoringApiPaths } from "@design-platform/shared";
import { DUAL_APPROVAL_MIN_INTERVAL_MS } from "@design-platform/shared";
import { apiGet, apiPost } from "@/lib/api-client";

/**
 * Monitoring & Operations 域 hooks（D37.17 运营中心）
 *
 * 后端实现状态（2026-07-29）：
 *  - Core Service 已实现 6 个 Controller：OperationsOverview / Slo / QueueTask /
 *    Worker / Connector / OperationsAction
 *  - 前端通过 MonitoringApiPaths 直连 BFF 代理（/api/v1/operations/**）
 *  - 后端非 2xx 响应由组件层显示空状态或错误提示
 *    （对齐 D37 §空状态红线：不伪造数据，区分"无数据 / API 异常"）
 *
 * 主动作约束（D37.17 §Operations 危险动作）：
 *  - isolate/retry/reconcile/failover 为危险动作，必须打开影响预览
 *  - 显示租户/项目/资源数量、不可逆性、替代方案、审批/Step-up 和审计引用
 *  - 不能在图表卡片上放无上下文"修复全部"
 *  - 高风险动作（isolate/failover）需 stepUpToken 二次认证
 *
 * 特殊状态（D37.17 §Operations）：
 *  - unknown job：未知任务显示明确文字/图标，不并入 queued/running
 *  - retry storm：重试风暴检测，超阈值时显示告警并暂停自动重试
 *  - 数据驻留限制：跨 Region 操作显示数据驻留约束
 */

const OPERATIONS_QUERY_KEY = ["operations"] as const;

/** 判断 API 是否为"未实现"错误（404 / 501） */
function isNotImplementedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  return status === 404 || status === 501;
}

// ── Overview ──

/**
 * Operations 概览统计
 * 对应契约：GET /api/v1/operations/overview
 */
export function useOperationsOverview() {
  return useQuery<OperationsOverviewDto>({
    queryKey: [...OPERATIONS_QUERY_KEY, "overview"] as const,
    queryFn: () => apiGet<OperationsOverviewDto>(MonitoringApiPaths.overview),
    // 概览统计 30s 自动刷新（对齐 D37.17 §实时刷新）
    refetchInterval: 30_000,
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── SLO ──

/**
 * SLO 列表
 * 对应契约：GET /api/v1/operations/slos
 */
export function useSlos() {
  return useQuery<SloTargetDto[]>({
    queryKey: [...OPERATIONS_QUERY_KEY, "slos"] as const,
    queryFn: () => apiGet<SloTargetDto[]>(MonitoringApiPaths.slos),
    refetchInterval: 60_000,
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── Queue ──

/** 构造队列查询键 */
function buildQueueQueryKey(params: ListQueueTasksRequest) {
  return [
    ...OPERATIONS_QUERY_KEY,
    "queue",
    {
      status: params.status ?? null,
      type: params.type ?? null,
      priority: params.priority ?? null,
      workerId: params.workerId ?? null,
      keyword: params.keyword ?? null,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
    },
  ] as const;
}

/**
 * 队列任务列表
 * 对应契约：GET /api/v1/operations/queue
 */
export function useQueueTasks(params: ListQueueTasksRequest = {}) {
  return useQuery<OffsetPageResponse<QueueTaskDto>>({
    queryKey: buildQueueQueryKey(params),
    queryFn: () => {
      const search = new URLSearchParams();
      search.set("page", String(params.page ?? 1));
      search.set("pageSize", String(params.pageSize ?? 50));
      if (params.status) search.set("status", params.status);
      if (params.type) search.set("type", params.type);
      if (params.priority) search.set("priority", params.priority);
      if (params.workerId) search.set("workerId", params.workerId);
      if (params.keyword) search.set("keyword", params.keyword);
      const url = `${MonitoringApiPaths.queue}?${search.toString()}`;
      return apiGet<OffsetPageResponse<QueueTaskDto>>(url);
    },
    refetchInterval: 15_000,
    placeholderData: (prev) => prev,
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── Workers ──

/** 构造 Worker 查询键 */
function buildWorkersQueryKey(params: ListWorkersRequest) {
  return [
    ...OPERATIONS_QUERY_KEY,
    "workers",
    {
      type: params.type ?? null,
      status: params.status ?? null,
      region: params.region ?? null,
      keyword: params.keyword ?? null,
    },
  ] as const;
}

/**
 * Worker 列表
 * 对应契约：GET /api/v1/operations/workers
 */
export function useWorkers(params: ListWorkersRequest = {}) {
  return useQuery<WorkerStatusDto[]>({
    queryKey: buildWorkersQueryKey(params),
    queryFn: () => {
      const search = new URLSearchParams();
      if (params.type) search.set("type", params.type);
      if (params.status) search.set("status", params.status);
      if (params.region) search.set("region", params.region);
      if (params.keyword) search.set("keyword", params.keyword);
      const url = `${MonitoringApiPaths.workers}?${search.toString()}`;
      return apiGet<WorkerStatusDto[]>(url);
    },
    refetchInterval: 30_000,
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── Connectors ──

/** 构造连接器查询键 */
function buildConnectorsQueryKey(params: ListConnectorsRequest) {
  return [
    ...OPERATIONS_QUERY_KEY,
    "connectors",
    {
      type: params.type ?? null,
      status: params.status ?? null,
      keyword: params.keyword ?? null,
    },
  ] as const;
}

/**
 * 连接器列表
 * 对应契约：GET /api/v1/operations/connectors
 */
export function useConnectors(params: ListConnectorsRequest = {}) {
  return useQuery<ConnectorStatusDto[]>({
    queryKey: buildConnectorsQueryKey(params),
    queryFn: () => {
      const search = new URLSearchParams();
      if (params.type) search.set("type", params.type);
      if (params.status) search.set("status", params.status);
      if (params.keyword) search.set("keyword", params.keyword);
      const url = `${MonitoringApiPaths.connectors}?${search.toString()}`;
      return apiGet<ConnectorStatusDto[]>(url);
    },
    refetchInterval: 60_000,
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 注册连接器（V1.10.3 新增，对齐后端 POST /api/v1/operations/connectors/register）
 *
 * 安全红线（对齐 OD-05 外部 AI 接入约束）：
 *  - AI_PROVIDER 类型（建筑 AI Provider）强制 isManualHandoff=true（V1 不自动接入）
 *  - 同一 connectorCode 已存在时更新记录（幂等注册）
 *  - 成功后自动刷新连接器列表
 */
export function useRegisterConnector() {
  const queryClient = useQueryClient();
  return useMutation<ConnectorStatusDto, Error, ConnectorRegisterRequest>({
    mutationFn: async (request) => {
      return apiPost<ConnectorStatusDto>(
        MonitoringApiPaths.connectorRegister,
        request,
      );
    },
    onSuccess: () => {
      // 注册成功后刷新连接器列表
      void queryClient.invalidateQueries({
        queryKey: [...OPERATIONS_QUERY_KEY, "connectors"],
      });
    },
  });
}

// ── Mutation ──

/**
 * Operations 主动作（isolate/retry/reconcile/failover/pause/resume/cancel）
 * 对应契约：POST /api/v1/operations:action
 *
 * 危险动作约束（D37.17 §危险动作）：
 *  - 必须传入 reason（进入审计日志）
 *  - 必须传入 impactPreviewAcknowledged = true（影响预览已确认）
 *  - 高风险动作（isolate/failover）需 stepUpToken 二次认证
 *  - 不可逆动作（cancel）需双人审批（V1 实现）
 *
 * 安全红线：
 *  - 不允许在图表卡片上放无上下文"修复全部"
 *  - 所有动作必须打开影响预览，显示租户/项目/资源数量
 */
export function useOperationsAction() {
  const queryClient = useQueryClient();
  return useMutation<
    OperationsActionResponseDto,
    Error,
    OperationsActionRequest
  >({
    mutationFn: async (request) => {
      return apiPost<OperationsActionResponseDto>(MonitoringApiPaths.action, {
        actionType: request.actionType,
        targetType: request.targetType,
        targetId: request.targetId,
        reason: request.reason,
        stepUpToken: request.stepUpToken,
        impactPreviewAcknowledged: request.impactPreviewAcknowledged,
      });
    },
    onSuccess: () => {
      // 主动作后刷新所有 Operations 数据
      void queryClient.invalidateQueries({
        queryKey: [...OPERATIONS_QUERY_KEY],
      });
    },
  });
}

// ── 派生工具函数 ──

/**
 * 计算队列任务统计
 */
export function computeQueueStats(tasks: QueueTaskDto[]): {
  running: number;
  queued: number;
  failed: number;
  paused: number;
  completed: number;
  /** 重试次数达到上限的任务数（retry storm 风险） */
  retryExhausted: number;
} {
  return {
    running: tasks.filter((t) => t.status === "running").length,
    queued: tasks.filter((t) => t.status === "queued").length,
    failed: tasks.filter((t) => t.status === "failed").length,
    paused: tasks.filter((t) => t.status === "paused").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    retryExhausted: tasks.filter(
      (t) => t.retryCount >= t.maxRetries && t.status === "failed",
    ).length,
  };
}

/**
 * 计算 Worker 统计
 */
export function computeWorkerStats(workers: WorkerStatusDto[]): {
  running: number;
  idle: number;
  stopped: number;
  error: number;
  /** 心跳过期的 Worker 数（超过 5 分钟） */
  staleHeartbeat: number;
} {
  const now = Date.now();
  const STALE_THRESHOLD_MS = 5 * 60 * 1000;
  return {
    running: workers.filter((w) => w.status === "running").length,
    idle: workers.filter((w) => w.status === "idle").length,
    stopped: workers.filter((w) => w.status === "stopped").length,
    error: workers.filter((w) => w.status === "error").length,
    staleHeartbeat: workers.filter((w) => {
      const heartbeatTime = new Date(w.lastHeartbeat).getTime();
      return now - heartbeatTime > STALE_THRESHOLD_MS;
    }).length,
  };
}

/**
 * 计算连接器统计
 */
export function computeConnectorStats(connectors: ConnectorStatusDto[]): {
  connected: number;
  degraded: number;
  disconnected: number;
  unknown: number;
  /** 高错误率连接器数（最近 1h 错误 > 100） */
  highErrorRate: number;
} {
  return {
    connected: connectors.filter((c) => c.status === "connected").length,
    degraded: connectors.filter((c) => c.status === "degraded").length,
    disconnected: connectors.filter((c) => c.status === "disconnected").length,
    unknown: connectors.filter((c) => c.status === "unknown").length,
    highErrorRate: connectors.filter((c) => c.errorCount1h > 100).length,
  };
}

/**
 * 判断是否可执行 Operations 主动作
 * 约束（D37.17 §危险动作）：
 *  - 必须传入 reason（非空）
 *  - 必须确认影响预览
 *  - 高风险动作（isolate/failover）需 stepUpToken
 *  - 不可逆动作（cancel）需双人审批（V1 实现）
 */
export function canExecuteOperationsAction(request: OperationsActionRequest): {
  canExecute: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (!request.reason || request.reason.trim().length === 0) {
    reasons.push("必须填写操作原因（进入审计日志）");
  }

  if (!request.impactPreviewAcknowledged) {
    reasons.push("必须确认影响预览");
  }

  const isHighRisk =
    request.actionType === "isolate" || request.actionType === "failover";
  if (isHighRisk && !request.stepUpToken) {
    reasons.push("高风险动作需 stepUpToken 二次认证");
  }

  const isIrreversible = request.actionType === "cancel";
  if (isIrreversible && !request.stepUpToken) {
    reasons.push("不可逆动作需 stepUpToken 二次认证");
  }

  return {
    canExecute: reasons.length === 0,
    reasons,
  };
}

// ── 双人审批 Hooks（D37.23 §不可逆/合规：二人审批） ──

/**
 * 查询 Operations 主动作详情（含双人审批状态）
 * 对应契约：GET /api/v1/operations/action/{actionId}
 *
 * 支持两种 actionId 格式：
 *  - UUID 字符串（数据库主键）：使用 actionDetail 路径
 *  - operationId 字符串（前端 cancel 后返回的 ID）：使用 actionByOperationId 路径
 *
 * 自动判断：尝试解析为 UUID，成功用 actionDetail，失败用 actionByOperationId。
 */
export function useOperationsActionDetail(actionId: string | null) {
  const isUuid = Boolean(actionId) && isValidUuid(actionId!);
  const path = actionId
    ? isUuid
      ? MonitoringApiPaths.actionDetail(actionId!)
      : MonitoringApiPaths.actionByOperationId(actionId!)
    : null;

  return useQuery<OperationsActionResponseDto>({
    queryKey: [...OPERATIONS_QUERY_KEY, "action", actionId] as const,
    queryFn: () => apiGet<OperationsActionResponseDto>(path!),
    enabled: Boolean(actionId) && Boolean(path),
    refetchInterval: 10_000,
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/** 判断字符串是否为合法 UUID */
function isValidUuid(s: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    s,
  );
}

/**
 * 查询待审批操作列表（D37.23 §不可逆/合规：二人审批）
 * 对应契约：GET /api/v1/operations/action/pending
 *
 * 默认查 PENDING_REVIEW1 + PENDING_REVIEW2，按 initiatedAt 倒序。
 */
export function usePendingOperationsActions(
  params: {
    /** 双人审批状态过滤（不传默认 PENDING_REVIEW1 + PENDING_REVIEW2） */
    statuses?: DualApprovalStatus[];
    /** 页码（0-based） */
    page?: number;
    /** 每页大小（默认 20，最大 100） */
    pageSize?: number;
  } = {},
) {
  const search = new URLSearchParams();
  if (params.statuses && params.statuses.length > 0) {
    search.set("statuses", params.statuses.join(","));
  }
  search.set("page", String(params.page ?? 0));
  search.set("size", String(params.pageSize ?? 20));
  const url = `${MonitoringApiPaths.pendingActions}?${search.toString()}`;
  return useQuery<OffsetPageResponse<OperationsActionResponseDto>>({
    queryKey: [
      ...OPERATIONS_QUERY_KEY,
      "pendingActions",
      {
        statuses: params.statuses ?? null,
        page: params.page ?? 0,
        size: params.pageSize ?? 20,
      },
    ] as const,
    queryFn: () => apiGet<OffsetPageResponse<OperationsActionResponseDto>>(url),
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/** 审批人1 通过 */
export function useApproveReview1() {
  return useDualApprovalReview("approveReview1");
}

/** 审批人1 拒绝 */
export function useRejectReview1() {
  return useDualApprovalReview("rejectReview1");
}

/** 审批人2 通过 */
export function useApproveReview2() {
  return useDualApprovalReview("approveReview2");
}

/** 审批人2 拒绝 */
export function useRejectReview2() {
  return useDualApprovalReview("rejectReview2");
}

/** 双人审批 mutation 内部工厂 */
function useDualApprovalReview(
  path: "approveReview1" | "rejectReview1" | "approveReview2" | "rejectReview2",
) {
  const queryClient = useQueryClient();
  return useMutation<
    DualApprovalReviewResponseDto,
    Error,
    { actionId: string; request: DualApprovalReviewRequest }
  >({
    mutationFn: async ({ actionId, request }) => {
      return apiPost<DualApprovalReviewResponseDto>(
        MonitoringApiPaths[path](actionId),
        request,
      );
    },
    onSuccess: (_data, variables) => {
      // 刷新该操作详情 + Operations 全量缓存
      void queryClient.invalidateQueries({
        queryKey: [...OPERATIONS_QUERY_KEY, "action", variables.actionId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...OPERATIONS_QUERY_KEY],
      });
    },
  });
}

/**
 * 计算审批人2 距离审批人1 的剩余等待毫秒数
 * 对齐后端 BUSINESS_RULE_VIOLATION 校验：审批间隔须 ≥ 5 秒
 * @returns 剩余等待毫秒数（已超过返回 0）
 */
export function computeReview2WaitMs(reviewer1At?: string | null): number {
  if (!reviewer1At) return 0;
  const elapsed = Date.now() - new Date(reviewer1At).getTime();
  if (elapsed >= DUAL_APPROVAL_MIN_INTERVAL_MS) return 0;
  return DUAL_APPROVAL_MIN_INTERVAL_MS - elapsed;
}

/**
 * 计算双人审批进度百分比（0-100）
 *  - not_required: 100
 *  - pending_review1: 25
 *  - pending_review2: 75
 *  - approved: 100
 *  - rejected_*: 100（流程终止）
 */
export function computeDualApprovalProgress(
  status: OperationsActionResponseDto["dualApprovalStatus"],
): number {
  if (!status || status === "not_required") return 100;
  switch (status) {
    case "pending_review1":
      return 25;
    case "pending_review2":
      return 75;
    case "approved":
    case "rejected_review1":
    case "rejected_review2":
      return 100;
    default:
      return 0;
  }
}
