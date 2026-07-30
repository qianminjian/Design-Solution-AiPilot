/**
 * WorkItem 域 API 契约（V0 阶段：仅前端骨架，后端 API 未就位）
 *
 * 权威源：@design/D37-关键界面-交互状态.md §D37.5 P01 我的工作
 *        @design/D35-API-事件契约.md（聚合查询待定义）
 *        @design/D05-全流程阶段-阶段门.md（阶段/门禁数据源）
 *
 * V0 简化：
 *  - 仅定义类型与 API 路径占位，供前端骨架使用
 *  - 后端聚合查询 API（Task/Issue/Review/Approval/Exception/AIReview 聚合）
 *    在 V1 阶段实现，对应契约：workflow.work.list
 *  - 前端通过空状态区分"当前无任务 / 筛选无结果 / 数据同步中"
 *
 * 实体关系（对齐 D37.5）：
 *  WorkItem（聚合工作项：跨 Task/Issue/Review/Approval/Exception/AIReview 6 类）
 *    ├── WorkGroup（时间分组：Now/Overdue/Upcoming/Waiting/Completed）
 *    ├── NextAction（下一动作：一项仅一个明确 nextAction）
 *    └── SavedView（保存视图：filter/sort/columns/layout）
 *
 * 主动作约束（D37.5 §主动作）：
 *  - 快捷动作仅允许 Claim / Acknowledge / 低风险 Complete
 *  - 高风险动作需在工作项详情页执行
 *  - 处理动作回源校验，不允许重复审批
 */

// ── 枚举 ──

/**
 * 工作项类型（聚合 6 类来源）
 * - TASK: 任务（D05 工作流任务）
 * - ISSUE: 问题（D11 协调 / 碰撞 / Issue）
 * - REVIEW: 评审（D11 专业评审）
 * - APPROVAL: 审批（D05 门禁审批 / D37.15 P11 发布审批）
 * - EXCEPTION: 异常（D37.13 P09 AI 复核异常 / D34 数据异常）
 * - AI_REVIEW: AI 复核（D37.13 P09 AI/Agent 复核中心）
 */
export type WorkItemType =
  "TASK" | "ISSUE" | "REVIEW" | "APPROVAL" | "EXCEPTION" | "AI_REVIEW";

/**
 * 工作项时间分组（D37.5 左侧 5 分组）
 * - NOW: 当前可执行（已分配、SLA 内、nextAction 明确）
 * - OVERDUE: 已逾期（SLA 倒计时为负）
 * - UPCOMING: 即将到期（24h/48h 内）
 * - WAITING: 等待他人（已转派或依赖未满足）
 * - COMPLETED: 已完成（本周期内）
 */
export type WorkGroupKey =
  "NOW" | "OVERDUE" | "UPCOMING" | "WAITING" | "COMPLETED";

/**
 * 工作项风险等级
 * - LOW: 低（常规任务，可批量处理）
 * - MEDIUM: 中（影响进度，需关注）
 * - HIGH: 高（影响门禁 / 发布，需优先处理）
 * - CRITICAL: 严重（影响合规 / 安全，需立即处理）
 */
export type WorkItemRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * 工作项状态
 * - PENDING: 待处理（已分配但未启动）
 * - IN_PROGRESS: 进行中
 * - WAITING: 等待他人（已转派或依赖未满足）
 * - COMPLETED: 已完成
 * - CANCELLED: 已取消
 * - BLOCKED: 已阻塞（依赖未满足或风险升级）
 */
export type WorkItemStatus =
  "PENDING" | "IN_PROGRESS" | "WAITING" | "COMPLETED" | "CANCELLED" | "BLOCKED";

/**
 * 快捷动作类型（D37.5 §主动作：仅允许低风险动作）
 * - CLAIM: 认领（将工作项分配给自己）
 * - ACKNOWLEDGE: 确认（确认收到，但不改变状态）
 * - COMPLETE: 完成（低风险完成，高风险需在详情页处理）
 */
export type QuickActionType = "CLAIM" | "ACKNOWLEDGE" | "COMPLETE";

// ── DTO ──

/**
 * 工作项 DTO（聚合视图）
 *
 * 字段对齐 D37.5 §核心组件：
 *  WorkType、项目/阶段/专业、来源、Assignee、SLA、Risk、Dependency、WhyMe
 */
export interface WorkItemDto {
  /** 工作项稳定 ID */
  id: string;
  /** 工作项类型 */
  type: WorkItemType;
  /** 标题 */
  title: string;
  /** 描述（可选，用于 Quick Preview） */
  description?: string;
  /** 项目 ID */
  projectId: string;
  /** 项目名称（冗余，避免前端多次查询） */
  projectName: string;
  /** 阶段编码（如 STG-P0） */
  stageCode?: string;
  /** 阶段名称 */
  stageName?: string;
  /** 专业（如 ARCHITECTURE / STRUCTURE / MEP） */
  discipline?: string;
  /** 来源标识（Task/Issue/Review/Approval/Exception/AIReview 的原始 ID） */
  sourceId: string;
  /** 来源类型标签（如 "Clash Run #123" / "Gate G2 Approval"） */
  sourceLabel: string;
  /** 当前责任人 ID */
  assigneeId: string;
  /** 当前责任人名称 */
  assigneeName: string;
  /** 代办时显示 delegatedBy（转派发起人） */
  delegatedBy?: string;
  /** SLA 到期时间（ISO 8601） */
  slaDueAt?: string;
  /** 风险等级 */
  risk: WorkItemRisk;
  /** 状态 */
  status: WorkItemStatus;
  /** 阻塞原因（status=BLOCKED 时必填） */
  blockReason?: string;
  /** 依赖工作项 ID 列表（前置依赖未完成时不可执行） */
  dependencies?: string[];
  /** WhyMe 说明（为什么分配给我，对齐 D37.5） */
  whyMe?: string;
  /** 下一动作（一项仅一个明确 nextAction） */
  nextAction?: NextActionDto;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;
}

/**
 * 下一动作 DTO（D37.5 §正常状态：一项仅一个明确 nextAction）
 */
export interface NextActionDto {
  /** 动作标签（如 "Approve" / "Comment" / "Resolve"） */
  label: string;
  /** 动作类型（用于路由跳转） */
  actionType: "NAVIGATE" | "APPROVE" | "COMMENT" | "RESOLVE" | "REVIEW";
  /** 目标路由（actionType=NAVIGATE 时使用） */
  targetUrl?: string;
  /** 是否为快捷动作（仅快捷动作可在 P01 直接执行） */
  isQuickAction: boolean;
  /** 快捷动作类型（isQuickAction=true 时必填） */
  quickActionType?: QuickActionType;
}

/**
 * SavedView DTO（D37.5 §核心组件 + D37.19 §Saved View）
 *
 * 保存 filter/sort/columns/layout/schema version，共享前权限/敏感字段检查。
 */
export interface SavedViewDto {
  /** SavedView ID */
  id: string;
  /** 视图名称 */
  name: string;
  /** 是否为个人视图（false 表示团队共享） */
  isShared: boolean;
  /** 创建人 ID */
  ownerId: string;
  /** 创建人名称 */
  ownerName: string;
  /** 过滤条件（JSON 序列化） */
  filters: WorkItemFilter;
  /** 排序条件 */
  sort?: WorkItemSort;
  /** 列配置（列显隐/宽度/顺序） */
  columns?: string[];
  /** 布局模式 */
  layout?: "TABLE" | "GRID" | "CARD";
  /** Schema 版本（用于兼容性检查） */
  schemaVersion: string;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;
}

// ── 请求 DTO ──

/**
 * 列出工作项请求
 * 对应契约：workflow.work.list（GET /api/v1/work-items）
 *
 * V0 阶段后端未实现，前端 hook 返回空状态占位。
 */
export interface ListWorkItemsRequest {
  /** 时间分组过滤（不传则返回全部） */
  group?: WorkGroupKey;
  /** 工作项类型过滤 */
  type?: WorkItemType;
  /** 项目 ID 过滤 */
  projectId?: string;
  /** 阶段编码过滤 */
  stageCode?: string;
  /** 专业过滤 */
  discipline?: string;
  /** 风险等级过滤 */
  risk?: WorkItemRisk;
  /** 状态过滤 */
  status?: WorkItemStatus;
  /** 关键字搜索（标题 / 描述 / 来源标签） */
  keyword?: string;
  /** 是否仅显示当前用户的工作项 */
  onlyMine?: boolean;
  /** 游标分页 cursor */
  cursor?: string;
  /** 每页数量 */
  pageSize?: number;
}

/**
 * 工作项过滤条件（用于 SavedView 持久化）
 */
export interface WorkItemFilter {
  /** 时间分组 */
  group?: WorkGroupKey;
  /** 工作项类型 */
  type?: WorkItemType;
  /** 项目 ID */
  projectId?: string;
  /** 阶段编码 */
  stageCode?: string;
  /** 专业 */
  discipline?: string;
  /** 风险等级 */
  risk?: WorkItemRisk;
  /** 状态 */
  status?: WorkItemStatus;
  /** 关键字 */
  keyword?: string;
  /** 是否仅显示当前用户的 */
  onlyMine?: boolean;
}

/**
 * 工作项排序条件
 */
export interface WorkItemSort {
  /** 排序字段（如 risk / slaDueAt / updatedAt） */
  field: "risk" | "slaDueAt" | "updatedAt" | "createdAt";
  /** 排序方向 */
  order: "asc" | "desc";
}

/**
 * 执行快捷动作请求
 *
 * D37.5 §主动作约束：
 *  - 快捷动作仅允许 CLAIM / ACKNOWLEDGE / 低风险 COMPLETE
 *  - 高风险 COMPLETE 需在工作项详情页执行
 *  - 处理动作回源校验，不允许重复审批
 */
export interface QuickActionRequest {
  /** 工作项 ID */
  workItemId: string;
  /** 快捷动作类型 */
  actionType: QuickActionType;
  /** 备注（可选，写入审计日志） */
  reason?: string;
  /** Step-up token（高风险 COMPLETE 时必填，V0 阶段可省略） */
  stepUpToken?: string;
  /** 客户端 ETag（用于乐观并发控制） */
  ifMatch?: string;
}

/**
 * 执行快捷动作响应
 */
export interface QuickActionResponse {
  /** 工作项 ID */
  workItemId: string;
  /** 新状态 */
  newStatus: WorkItemStatus;
  /** 新责任人 ID（CLAIM 时返回） */
  newAssigneeId?: string;
  /** 处理时间（ISO 8601） */
  processedAt: string;
  /** 服务端 ETag（用于后续乐观并发控制） */
  etag: string;
}

// ── API 端点定义 ──

/**
 * WorkItem API 端点
 * 基础路径：/api/v1/work-items
 *
 * workflow.work.list 聚合查询 API 待 V1 阶段实现。
 * 稳定契约 ID 见 @design/r2-contract-catalog/
 */
export const WorkItemApiPaths = {
  /** 列出工作项（聚合查询，cursor 分页） */
  list: "/api/v1/work-items",
  /** 工作项详情 */
  detail: (id: string) => `/api/v1/work-items/${id}`,
  /** 执行快捷动作（CLAIM / ACKNOWLEDGE / COMPLETE） */
  quickAction: (id: string) => `/api/v1/work-items/${id}:quick-action`,
  /** SavedView 列表 */
  savedViews: "/api/v1/work-items/saved-views",
  /** SavedView 详情 */
  savedView: (id: string) => `/api/v1/work-items/saved-views/${id}`,
} as const;
