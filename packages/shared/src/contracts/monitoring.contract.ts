/**
 * Monitoring & Operations 域契约（D37.17 Operations 中心）
 *
 * 权威源：
 * - @design/D37-关键界面-交互状态.md §D37.17 治理中心与运营中心关键页
 * - @design/D35-API-事件契约.md（Monitoring 域 API）
 * - @design/D29-可观测性-合规性-指标.md（SLO / RED / USE 指标）
 *
 * 后端实现状态（2026-07-29）：
 *  - Core Service 已实现 6 个 Controller：OperationsOverviewController / SloController /
 *    QueueTaskController / WorkerController / ConnectorController / OperationsActionController
 *  - 路径与 BFF OperationsProxyController（@Controller("v1/operations") + 全局前缀 /api）
 *    完全对齐，前端通过 MonitoringApiPaths 直连 BFF 代理
 *  - 后端非 2xx 响应原样透传（保留 errorCode/message/traceId）
 *
 * 主动作约束（D37.17 §Operations）：
 *  - isolate/retry/reconcile/failover 为危险动作，必须打开影响预览
 *  - 显示租户/项目/资源数量、不可逆性、替代方案、审批/Step-up 和审计引用
 *  - 不能在图表卡片上放无上下文"修复全部"
 *
 * 特殊状态（D37.17 §Operations）：
 *  - unknown job：未知任务显示明确文字/图标，不并入 queued/running
 *  - retry storm：重试风暴检测，超阈值时显示告警并暂停自动重试
 *  - 数据驻留限制：跨 Region 操作显示数据驻留约束
 */

// ── 枚举 ──

/** SLO 健康状态 */
export type SloStatus = "healthy" | "warning" | "critical";

/** 队列任务类型 */
export type QueueTaskType =
  | "ai_generation"
  | "compliance_check"
  | "analysis_run"
  | "publication_seal"
  | "ingest_parse"
  | "cleanup";

/** 队列任务状态 */
export type QueueTaskStatus =
  "queued" | "running" | "paused" | "failed" | "completed";

/** 队列任务优先级 */
export type QueueTaskPriority = "low" | "normal" | "high" | "critical";

/** Worker 类型 */
export type WorkerType = "ai" | "rule" | "analysis" | "ingest" | "publication";

/** Worker 运行状态 */
export type WorkerRuntimeStatus = "running" | "idle" | "stopped" | "error";

/** 连接器类型 */
export type ConnectorType =
  "llm" | "ai_provider" | "minio" | "revit" | "rhino" | "sketchup";

/** 连接器状态 */
export type ConnectorHealthStatus =
  "connected" | "degraded" | "disconnected" | "unknown";

/** Operations 主动作类型（D37.17 §危险动作） */
export type OperationsActionType =
  | "isolate"
  | "retry"
  | "reconcile"
  | "failover"
  | "pause"
  | "resume"
  | "cancel";

// ── DTO ──

/** SLO 目标 DTO */
export interface SloTargetDto {
  /** SLO 标识 */
  id: string;
  /** SLO 名称 */
  name: string;
  /** 目标可用率（百分比） */
  availabilityTarget: number;
  /** 当前可用率（百分比） */
  availabilityCurrent: number;
  /** 错误预算剩余（百分比，可为负） */
  errorBudgetRemaining: number;
  /** 最近 24h 请求数 */
  requestCount24h: number;
  /** 最近 24h 错误数 */
  errorCount24h: number;
  /** p95 延迟 ms */
  p95LatencyMs: number;
  /** p99 延迟 ms */
  p99LatencyMs: number;
  /** 健康状态 */
  status: SloStatus;
  /** 最后更新时间 */
  updatedAt: string;
}

/** 队列任务 DTO */
export interface QueueTaskDto {
  /** 任务 ID */
  id: string;
  /** 任务类型 */
  type: QueueTaskType;
  /** 任务状态 */
  status: QueueTaskStatus;
  /** 优先级 */
  priority: QueueTaskPriority;
  /** 任务负载描述（项目/阶段/资源摘要） */
  payload: string;
  /** 处理该任务的 Worker ID */
  workerId?: string | null;
  /** 排队时间 */
  queuedAt: string;
  /** 开始处理时间 */
  startedAt?: string | null;
  /** 已耗时（秒） */
  durationSec?: number | null;
  /** 已重试次数 */
  retryCount: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 租户 ID（多租户隔离） */
  tenantId?: string | null;
  /** 数据驻留 Region（跨境数据传输约束） */
  dataRegion?: string | null;
}

/** Worker 运行状态 DTO */
export interface WorkerStatusDto {
  /** Worker 标识 */
  id: string;
  /** Worker 类型 */
  type: WorkerType;
  /** 运行状态 */
  status: WorkerRuntimeStatus;
  /** 当前处理任务 ID */
  currentTaskId?: string | null;
  /** 当前任务负载描述 */
  currentTaskPayload?: string | null;
  /** 已处理任务数 */
  processedCount: number;
  /** 失败任务数 */
  failedCount: number;
  /** 平均处理时长（秒） */
  avgDurationSec: number;
  /** CPU 使用率（百分比） */
  cpuPercent: number;
  /** 内存使用率（百分比） */
  memoryPercent: number;
  /** 最后心跳时间 */
  lastHeartbeat: string;
  /** Worker 所在 Region（Hybrid-Site 部署） */
  region?: string | null;
  /** 是否为客户站点 Worker（Hybrid-Site） */
  isCustomerSiteWorker?: boolean;
}

/** 连接器状态 DTO */
export interface ConnectorStatusDto {
  /** 连接器标识 */
  id: string;
  /** 连接器名称 */
  name: string;
  /** 连接器类型 */
  type: ConnectorType;
  /** 健康状态 */
  status: ConnectorHealthStatus;
  /** 最近 1h 调用数 */
  callCount1h: number;
  /** 最近 1h 错误数 */
  errorCount1h: number;
  /** 最近 1h 平均延迟 ms */
  avgLatencyMs: number;
  /** 许可证剩余描述 */
  licenseRemaining?: string | null;
  /** 最近使用时间 */
  lastUsedAt: string;
  /** 是否为 ManualHandoff（OD-05 外部 AI V1 约束） */
  isManualHandoff?: boolean;
}

/** Operations 概览统计 DTO */
export interface OperationsOverviewDto {
  /** 检测时间戳 */
  timestamp: string;
  /** 整体状态（ALL UP / DEGRADED） */
  overallStatus: "up" | "degraded";
  /** 运行中任务数 */
  runningTasks: number;
  /** 排队任务数 */
  queuedTasks: number;
  /** 失败任务数 */
  failedTasks: number;
  /** 暂停任务数 */
  pausedTasks: number;
  /** 已完成任务数（最近 24h） */
  completedTasks24h: number;
  /** 运行中 Worker 数 */
  runningWorkers: number;
  /** 异常 Worker 数 */
  errorWorkers: number;
  /** 已停止 Worker 数 */
  stoppedWorkers: number;
  /** 已连接连接器数 */
  connectedConnectors: number;
  /** 降级连接器数 */
  degradedConnectors: number;
  /** 已断开连接器数 */
  disconnectedConnectors: number;
  /** 关键 SLO 数 */
  criticalSlos: number;
  /** 警告 SLO 数 */
  warningSlos: number;
  /** 是否检测到 retry storm（D37.17 §特殊状态） */
  hasRetryStorm: boolean;
  /** 是否有 unknown job（D37.17 §特殊状态） */
  hasUnknownJobs: boolean;
  /** 数据驻留约束 Region 列表 */
  dataResidencyRegions?: string[];
}

// ── 请求 DTO ──

/** 列出队列任务请求 */
export interface ListQueueTasksRequest {
  /** 状态过滤 */
  status?: QueueTaskStatus;
  /** 类型过滤 */
  type?: QueueTaskType;
  /** 优先级过滤 */
  priority?: QueueTaskPriority;
  /** Worker ID 过滤 */
  workerId?: string;
  /** 关键字搜索 */
  keyword?: string;
  /** 页码 */
  page?: number;
  /** 每页大小 */
  pageSize?: number;
}

/** 列出 Worker 请求 */
export interface ListWorkersRequest {
  /** 类型过滤 */
  type?: WorkerType;
  /** 状态过滤 */
  status?: WorkerRuntimeStatus;
  /** Region 过滤 */
  region?: string;
  /** 关键字搜索 */
  keyword?: string;
}

/** 列出连接器请求 */
export interface ListConnectorsRequest {
  /** 类型过滤 */
  type?: ConnectorType;
  /** 状态过滤 */
  status?: ConnectorHealthStatus;
  /** 关键字搜索 */
  keyword?: string;
}

/** Operations 主动作请求（D37.17 §危险动作） */
export interface OperationsActionRequest {
  /** 动作类型 */
  actionType: OperationsActionType;
  /** 目标对象类型（queue_task / worker / connector） */
  targetType: "queue_task" | "worker" | "connector";
  /** 目标对象 ID */
  targetId: string;
  /** 操作原因（必须，进入审计日志） */
  reason: string;
  /** Step-up 认证 Token（高风险动作必需） */
  stepUpToken?: string;
  /** 影响预览已确认 */
  impactPreviewAcknowledged: boolean;
}

/** Operations 主动作响应 */
export interface OperationsActionResponseDto {
  /** 操作 ID */
  operationId: string;
  /** 动作类型 */
  actionType: OperationsActionType;
  /** 目标对象 ID */
  targetId: string;
  /** 操作状态 */
  status: "queued" | "running" | "completed" | "failed";
  /** 已触发时间 */
  initiatedAt: string;
  /** 完成时间 */
  completedAt?: string | null;
  /** 影响对象数量 */
  affectedCount?: number;
  /** 审计追踪 ID */
  auditTraceId: string;
}

// ── API 路径 ──

/** Operations API 端点 */
export const MonitoringApiPaths = {
  /** Operations 概览 */
  overview: "/api/v1/operations/overview",
  /** SLO 列表 */
  slos: "/api/v1/operations/slos",
  /** 队列任务列表 */
  queue: "/api/v1/operations/queue",
  /** 队列任务详情 */
  queueTask: (id: string) => `/api/v1/operations/queue/${id}`,
  /** Worker 列表 */
  workers: "/api/v1/operations/workers",
  /** Worker 详情 */
  worker: (id: string) => `/api/v1/operations/workers/${id}`,
  /** 连接器列表 */
  connectors: "/api/v1/operations/connectors",
  /** 连接器详情 */
  connector: (id: string) => `/api/v1/operations/connectors/${id}`,
  /** Operations 主动作（isolate/retry/reconcile/failover） */
  action: "/api/v1/operations/action",
} as const;

// ── 枚举映射常量 ──

/** SLO 状态标签 */
export const SLO_STATUS_LABEL: Record<SloStatus, string> = {
  healthy: "健康",
  warning: "警告",
  critical: "严重",
};

/** SLO 状态颜色（Ant Design Tag color） */
export const SLO_STATUS_COLOR: Record<SloStatus, string> = {
  healthy: "success",
  warning: "warning",
  critical: "error",
};

/** 队列任务类型标签 */
export const QUEUE_TYPE_LABEL: Record<QueueTaskType, string> = {
  ai_generation: "AI 生成",
  compliance_check: "合规检查",
  analysis_run: "工程分析",
  publication_seal: "发布封存",
  ingest_parse: "文件解析",
  cleanup: "清理任务",
};

/** 队列任务状态颜色 */
export const QUEUE_STATUS_COLOR: Record<QueueTaskStatus, string> = {
  queued: "default",
  running: "processing",
  paused: "warning",
  failed: "error",
  completed: "success",
};

/** 队列任务状态标签 */
export const QUEUE_STATUS_LABEL: Record<QueueTaskStatus, string> = {
  queued: "排队",
  running: "运行中",
  paused: "已暂停",
  failed: "失败",
  completed: "已完成",
};

/** 队列任务优先级颜色 */
export const QUEUE_PRIORITY_COLOR: Record<QueueTaskPriority, string> = {
  low: "default",
  normal: "blue",
  high: "orange",
  critical: "red",
};

/** 队列任务优先级标签 */
export const QUEUE_PRIORITY_LABEL: Record<QueueTaskPriority, string> = {
  low: "低",
  normal: "中",
  high: "高",
  critical: "关键",
};

/** Worker 类型标签 */
export const WORKER_TYPE_LABEL: Record<WorkerType, string> = {
  ai: "AI Worker",
  rule: "规则 Worker",
  analysis: "分析 Worker",
  ingest: "文件 Worker",
  publication: "发布 Worker",
};

/** Worker 状态颜色 */
export const WORKER_STATUS_COLOR: Record<WorkerRuntimeStatus, string> = {
  running: "processing",
  idle: "default",
  stopped: "warning",
  error: "error",
};

/** Worker 状态标签 */
export const WORKER_STATUS_LABEL: Record<WorkerRuntimeStatus, string> = {
  running: "运行中",
  idle: "空闲",
  stopped: "已停止",
  error: "异常",
};

/** 连接器类型标签 */
export const CONNECTOR_TYPE_LABEL: Record<ConnectorType, string> = {
  llm: "LLM API",
  ai_provider: "建筑 AI",
  minio: "对象存储",
  revit: "Revit Worker",
  rhino: "Rhino Worker",
  sketchup: "SketchUp Worker",
};

/** 连接器状态颜色 */
export const CONNECTOR_STATUS_COLOR: Record<ConnectorHealthStatus, string> = {
  connected: "success",
  degraded: "warning",
  disconnected: "error",
  unknown: "default",
};

/** 连接器状态标签 */
export const CONNECTOR_STATUS_LABEL: Record<ConnectorHealthStatus, string> = {
  connected: "已连接",
  degraded: "降级",
  disconnected: "已断开",
  unknown: "未知",
};

/** Operations 主动作标签 */
export const OPERATIONS_ACTION_LABEL: Record<OperationsActionType, string> = {
  isolate: "隔离",
  retry: "重试",
  reconcile: "对账",
  failover: "故障转移",
  pause: "暂停",
  resume: "恢复",
  cancel: "取消",
};

/** Operations 主动作风险等级（D37.23 §危险动作） */
export const OPERATIONS_ACTION_RISK_LEVEL: Record<
  OperationsActionType,
  "low" | "medium" | "high" | "irreversible"
> = {
  isolate: "high",
  retry: "medium",
  reconcile: "medium",
  failover: "high",
  pause: "medium",
  resume: "low",
  cancel: "irreversible",
};
