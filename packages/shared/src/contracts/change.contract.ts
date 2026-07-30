/**
 * Change 域契约 — P12 变更影响与闭环工作台（D37.16）
 *
 * V0 前端骨架 + V1 API 对接预留：
 *  - 后端 ChangeRequest / ImpactGraph / TaskPlan / ClosureEvidence API 未实现
 *  - 前端使用 TanStack Query 调用真实端点，404/501 时显示空状态，不伪造数据
 *
 * 权威源：@design/D37-关键界面-交互状态.md §D37.16、@design/D11-专业协同与多专业校审.md
 */

import type { OffsetPageResponse } from "../api-response";

// ── 枚举 ──

/** 变更请求状态（UPPERCASE 对齐 Java 后端枚举序列化） */
export type ChangeStatus =
  | "DRAFT" // 草稿
  | "IMPACT_ASSESSMENT" // 影响评估中
  | "PENDING_APPROVAL" // 待批准
  | "APPROVED" // 已批准
  | "IN_PROGRESS" // 实施中
  | "VERIFICATION" // 验证关闭中
  | "CLOSED" // 已关闭
  | "REJECTED"; // 已拒绝

/** 变更类型 */
export type ChangeType =
  | "REQUIREMENT" // 需求变更
  | "DESIGN" // 设计变更
  | "SCOPE" // 范围变更
  | "BASELINE" // 基线变更
  | "REGULATORY" // 规范变更
  | "OTHER";

/** 变更优先级 */
export type ChangePriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** 受影响对象类型 */
export type AffectedObjectType =
  | "REQUIREMENT" // 需求项
  | "MODEL_ELEMENT" // 模型元素
  | "DRAWING" // 图纸
  | "DISCIPLINE" // 专业
  | "RULE" // 规则
  | "QUANTITY" // 工程量
  | "ANALYSIS"; // 分析运行

/** 影响判定（对齐 D37.16 §正常状态：Confirmed/Potential/Unknown/NotAffected） */
export type ImpactLevel =
  | "CONFIRMED" // 已确认受影响
  | "POTENTIAL" // 潜在受影响
  | "UNKNOWN" // 未知（需进一步分析）
  | "NOT_AFFECTED"; // 确认无影响

/** 受影响项的变更动作 */
export type AffectedAction = "ADDED" | "MODIFIED" | "REMOVED";

/** 复查状态 */
export type RecheckStatus =
  | "PENDING" // 待复查
  | "IN_PROGRESS" // 复查中
  | "COMPLETED" // 已完成
  | "NOT_APPLICABLE"; // 不适用

/** 处置任务状态 */
export type TaskPlanStatus =
  "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED" | "CANCELLED";

/** 关闭证据类型 */
export type ClosureEvidenceType =
  | "DESIGN_REVIEW" // 设计评审
  | "RULE_RUN" // 规则运行
  | "AI_REVIEW" // AI 复核
  | "SIGNATURE" // 签章
  | "TEST"; // 测试

/** 关闭证据验证状态 */
export type ClosureEvidenceStatus = "PENDING" | "VERIFIED" | "REJECTED";

/** 变更操作阶段（对齐 D37.16 §闭环：批准→实施→验证→关闭） */
export type ChangeOperationPhase =
  | "SUBMIT" // 提交
  | "IMPACT_ANALYSIS" // 影响分析
  | "APPROVAL" // 批准
  | "IMPLEMENTATION" // 实施
  | "VERIFICATION" // 验证
  | "CLOSURE" // 关闭
  | "RECALL"; // 撤回

// ── 核心 DTO ──

/** 受影响对象 DTO */
export interface AffectedItemDto {
  id: string;
  tenantId: string;
  changeId: string;
  /** 受影响对象类型 */
  type: AffectedObjectType;
  /** 对象编号（如 REQ-001、WALL-1234） */
  code: string;
  /** 对象名称 */
  name: string;
  /** 所属专业 */
  discipline: string;
  /** 变更动作 */
  action: AffectedAction;
  /** 影响判定 */
  impact: ImpactLevel;
  /** 是否需要复查 */
  recheckRequired: boolean;
  /** 复查状态 */
  recheckStatus: RecheckStatus;
  /** 责任人 */
  owner: string;
  /** 影响依据（算法/人工） */
  evidence?: string | null;
  /** 影响版本（变更触发时的 Baseline） */
  sourceBaselineId?: string | null;
  /** 水位（变更水位标记） */
  watermark?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 处置任务 DTO */
export interface TaskPlanItemDto {
  id: string;
  tenantId: string;
  changeId: string;
  /** 任务标题 */
  title: string;
  /** 责任人 */
  assignee: string;
  /** 所属专业 */
  discipline?: string | null;
  /** 任务状态 */
  status: TaskPlanStatus;
  /** 计划完成时间 */
  dueDate: string;
  /** 实际完成时间 */
  completedAt?: string | null;
  /** 关联受影响项 ID 列表 */
  affectedItemIds: string[];
  /** 任务描述 */
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 关闭证据 DTO */
export interface ClosureEvidenceItemDto {
  id: string;
  tenantId: string;
  changeId: string;
  /** 证据类型 */
  type: ClosureEvidenceType;
  /** 证据标题 */
  title: string;
  /** 证据来源（关联实体 ID） */
  sourceId: string;
  /** 证据来源描述 */
  sourceDescription?: string | null;
  /** 验证状态 */
  status: ClosureEvidenceStatus;
  /** 验证人 */
  verifiedBy?: string | null;
  /** 验证时间 */
  verifiedAt?: string | null;
  /** 证据摘要 */
  summary: string;
  /** 证据链接（如适用） */
  evidenceUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 变更请求 DTO（列表项） */
export interface ChangeRequestDto {
  id: string;
  tenantId: string;
  /** 变更编号，如 CR-001 */
  code: string;
  /** 变更标题 */
  title: string;
  /** 变更类型 */
  type: ChangeType;
  /** 状态 */
  status: ChangeStatus;
  /** 优先级 */
  priority: ChangePriority;
  /** 发起人 ID */
  requesterId: string;
  /** 发起人姓名 */
  requesterName?: string | null;
  /** 发起人角色 */
  requesterRole?: string | null;
  /** 批准人 ID */
  approverId?: string | null;
  /** 批准人姓名 */
  approverName?: string | null;
  /** 批准人角色 */
  approverRole?: string | null;
  /** 实施人 ID */
  implementerId?: string | null;
  /** 关闭验证人 ID */
  closerId?: string | null;
  /** 受影响项数量 */
  affectedItemCount: number;
  /** 是否已生成处置任务 */
  hasTaskPlan: boolean;
  /** 是否已收集关闭证据 */
  hasClosureEvidence: boolean;
  /** 关联项目 ID */
  projectId?: string | null;
  /** 关联 Baseline ID（变更触发源） */
  sourceBaselineId?: string | null;
  /** 关联目标 Baseline ID（变更后生成） */
  targetBaselineId?: string | null;
  /** 关联发布 ID（变更导致的发布） */
  publicationId?: string | null;
  /** AI 辅助标记（变更影响分析可由 AI 辅助） */
  isAiAssisted: boolean;
  /** 是否需要人工复核（高风险变更强制人工复核） */
  requiresHumanReview: boolean;
  createdAt: string;
  updatedAt: string;
  /** 批准时间 */
  approvedAt?: string | null;
  /** 关闭时间 */
  closedAt?: string | null;
  rowVersion: number;
}

/** 变更请求详情 DTO（含子实体） */
export interface ChangeRequestDetailDto extends ChangeRequestDto {
  /** 变更来源描述 */
  source: string;
  /** 变更理由 */
  rationale: string;
  /** 影响评估结论 */
  impactAssessment?: string | null;
  /** 影响评估时间 */
  impactAssessedAt?: string | null;
  /** 影响评估人 */
  impactAssessor?: string | null;
  /** 关闭证据摘要 */
  closureEvidenceSummary?: string | null;
  /** 受影响项列表 */
  affectedItems: AffectedItemDto[];
  /** 处置任务列表 */
  taskPlan: TaskPlanItemDto[];
  /** 关闭证据列表 */
  closureEvidences: ClosureEvidenceItemDto[];
  /** 操作阶段时间线 */
  operations: ChangeOperationPhaseDto[];
}

/** 变更操作阶段 DTO */
export interface ChangeOperationPhaseDto {
  id: string;
  /** 阶段 */
  phase: ChangeOperationPhase;
  /** 状态 */
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "SKIPPED";
  /** 操作人 */
  operatorId?: string | null;
  /** 操作时间 */
  operatedAt?: string | null;
  /** 备注 */
  comment?: string | null;
}

// ── 请求 DTO ──

/** 列出变更请求请求 */
export interface ListChangeRequestsRequest {
  projectId?: string;
  keyword?: string;
  status?: ChangeStatus;
  type?: ChangeType;
  priority?: ChangePriority;
  page?: number;
  pageSize?: number;
}

/** 创建变更请求请求 */
export interface CreateChangeRequestRequest {
  projectId: string;
  title: string;
  type: ChangeType;
  priority: ChangePriority;
  /** 变更来源 */
  source: string;
  /** 变更理由 */
  rationale: string;
  /** 关联 Baseline ID */
  sourceBaselineId?: string;
  /** AI 辅助标记 */
  isAiAssisted?: boolean;
}

/** 提交影响评估请求 */
export interface SubmitImpactAssessmentRequest {
  changeId: string;
  /** 影响评估结论 */
  impactAssessment: string;
  /** 是否确认无影响（与 Unknown 严格分离） */
  confirmedNoImpact: boolean;
  /** step-up Token（高风险变更强制） */
  stepUpToken?: string;
}

/** 批准变更请求请求 */
export interface ApproveChangeRequestRequest {
  changeId: string;
  /** 批准意见 */
  comment: string;
  /** step-up Token（批准操作强制二次认证） */
  stepUpToken: string;
  /** 责任确认 */
  responsibilityAcknowledged: boolean;
}

/** 拒绝变更请求请求 */
export interface RejectChangeRequestRequest {
  changeId: string;
  /** 拒绝原因 */
  reason: string;
  /** step-up Token */
  stepUpToken: string;
}

/** 生成处置任务请求 */
export interface GenerateTaskPlanRequest {
  changeId: string;
  /** 任务生成策略 */
  strategy?: "AUTO" | "MANUAL";
}

/** 验证关闭请求 */
export interface VerifyClosureRequest {
  changeId: string;
  /** 验证结论 */
  verificationResult: "PASSED" | "FAILED" | "PARTIAL";
  /** 验证说明 */
  comment: string;
  /** step-up Token（关闭操作强制二次认证） */
  stepUpToken: string;
  /** 责任确认 */
  responsibilityAcknowledged: boolean;
}

/** 撤回变更请求 */
export interface RecallChangeRequestRequest {
  changeId: string;
  /** 撤回原因 */
  reason: string;
  /** step-up Token */
  stepUpToken: string;
}

// ── API 端点 ──

/**
 * Change API 端点
 *
 * 路径与 Core Service ChangeRequestController / AffectedItemController /
 * TaskPlanItemController / ClosureEvidenceController / ChangeOperationController 对齐。
 *
 * 后端 Controller 路由基址：
 *  - ChangeRequest:        /api/v1/changes
 *  - AffectedItem:          /api/v1/changes/{changeId}/affected-items
 *  - TaskPlanItem:          /api/v1/changes/{changeId}/task-plans
 *  - ClosureEvidence:       /api/v1/changes/{changeId}/closure-evidences
 *  - ChangeOperation:       /api/v1/changes/{changeId}/operations
 *
 * 状态流转端点采用斜杠分隔（与后端 @PostMapping("/{id}/submit-impact") 等一致），
 * 子实体上的动作端点（recheck/verify/start/generate）保留冒号语法（与后端 @PostMapping("/:generate") 等一致）。
 */
export const ChangeApiPaths = {
  // ── ChangeRequest 主实体 ──
  /** 列出变更请求 */
  list: "/api/v1/changes",
  /** 创建变更请求 */
  create: "/api/v1/changes",
  /** 变更详情（含子实体） */
  detail: (id: string) => `/api/v1/changes/${id}`,
  /** 更新变更请求（草稿阶段） */
  update: (id: string) => `/api/v1/changes/${id}`,
  /** 删除草稿 */
  delete: (id: string) => `/api/v1/changes/${id}`,
  /** 提交影响评估（DRAFT/IMPACT_ASSESSMENT → PENDING_APPROVAL） */
  submitImpactAssessment: (id: string) => `/api/v1/changes/${id}/submit-impact`,
  /** 批准变更（PENDING_APPROVAL → APPROVED） */
  approve: (id: string) => `/api/v1/changes/${id}/approve`,
  /** 拒绝变更（PENDING_APPROVAL → REJECTED） */
  reject: (id: string) => `/api/v1/changes/${id}/reject`,
  /** 撤回变更（非 CLOSED → RECALLED） */
  recall: (id: string) => `/api/v1/changes/${id}/recall`,
  /** 验证关闭（VERIFICATION → CLOSED） */
  verifyClosure: (id: string) => `/api/v1/changes/${id}/verify-closure`,

  // ── AffectedItem 子实体（/api/v1/changes/{changeId}/affected-items） ──
  /** 受影响项列表 */
  affectedItems: (changeId: string) =>
    `/api/v1/changes/${changeId}/affected-items`,
  /** 受影响项详情 */
  affectedItemDetail: (changeId: string, itemId: string) =>
    `/api/v1/changes/${changeId}/affected-items/${itemId}`,
  /** 创建受影响项 */
  createAffectedItem: (changeId: string) =>
    `/api/v1/changes/${changeId}/affected-items`,
  /** 更新受影响项 */
  updateAffectedItem: (changeId: string, itemId: string) =>
    `/api/v1/changes/${changeId}/affected-items/${itemId}`,
  /** 删除受影响项 */
  deleteAffectedItem: (changeId: string, itemId: string) =>
    `/api/v1/changes/${changeId}/affected-items/${itemId}`,
  /** 重新检查受影响项（UNKNOWN → 重新评估） */
  recheckAffectedItem: (changeId: string, itemId: string) =>
    `/api/v1/changes/${changeId}/affected-items/${itemId}:recheck`,

  // ── TaskPlanItem 子实体（/api/v1/changes/{changeId}/task-plans） ──
  /** 处置任务列表 */
  taskPlans: (changeId: string) => `/api/v1/changes/${changeId}/task-plans`,
  /** 处置任务详情 */
  taskPlanDetail: (changeId: string, itemId: string) =>
    `/api/v1/changes/${changeId}/task-plans/${itemId}`,
  /** 创建处置任务 */
  createTaskPlan: (changeId: string) =>
    `/api/v1/changes/${changeId}/task-plans`,
  /** 更新处置任务 */
  updateTaskPlan: (changeId: string, itemId: string) =>
    `/api/v1/changes/${changeId}/task-plans/${itemId}`,
  /** 删除处置任务 */
  deleteTaskPlan: (changeId: string, itemId: string) =>
    `/api/v1/changes/${changeId}/task-plans/${itemId}`,
  /** 生成处置任务（AI 辅助批量生成） */
  generateTaskPlan: (changeId: string) =>
    `/api/v1/changes/${changeId}/task-plans/:generate`,
  /** 启动处置任务 */
  startTaskPlan: (changeId: string, itemId: string) =>
    `/api/v1/changes/${changeId}/task-plans/${itemId}:start`,

  // ── ClosureEvidence 子实体（/api/v1/changes/{changeId}/closure-evidences） ──
  /** 关闭证据列表 */
  closureEvidences: (changeId: string) =>
    `/api/v1/changes/${changeId}/closure-evidences`,
  /** 关闭证据详情 */
  closureEvidenceDetail: (changeId: string, evidenceId: string) =>
    `/api/v1/changes/${changeId}/closure-evidences/${evidenceId}`,
  /** 创建关闭证据 */
  createClosureEvidence: (changeId: string) =>
    `/api/v1/changes/${changeId}/closure-evidences`,
  /** 删除关闭证据 */
  deleteClosureEvidence: (changeId: string, evidenceId: string) =>
    `/api/v1/changes/${changeId}/closure-evidences/${evidenceId}`,
  /** 验证关闭证据（标记为已验证） */
  verifyClosureEvidence: (changeId: string, evidenceId: string) =>
    `/api/v1/changes/${changeId}/closure-evidences/${evidenceId}:verify`,

  // ── ChangeOperation 时间线（/api/v1/changes/{changeId}/operations） ──
  /** 操作阶段时间线 */
  operations: (changeId: string) => `/api/v1/changes/${changeId}/operations`,
} as const;

// ── 枚举映射常量 ──

export const CHANGE_STATUS_LABEL: Record<ChangeStatus, string> = {
  DRAFT: "草稿",
  IMPACT_ASSESSMENT: "影响评估",
  PENDING_APPROVAL: "待批准",
  APPROVED: "已批准",
  IN_PROGRESS: "实施中",
  VERIFICATION: "验证关闭",
  CLOSED: "已关闭",
  REJECTED: "已拒绝",
};

export const CHANGE_STATUS_COLOR: Record<ChangeStatus, string> = {
  DRAFT: "default",
  IMPACT_ASSESSMENT: "processing",
  PENDING_APPROVAL: "warning",
  APPROVED: "success",
  IN_PROGRESS: "processing",
  VERIFICATION: "warning",
  CLOSED: "success",
  REJECTED: "error",
};

export const CHANGE_TYPE_LABEL: Record<ChangeType, string> = {
  REQUIREMENT: "需求",
  DESIGN: "设计",
  SCOPE: "范围",
  BASELINE: "基线",
  REGULATORY: "规范",
  OTHER: "其他",
};

export const CHANGE_PRIORITY_LABEL: Record<ChangePriority, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  CRITICAL: "极高",
};

export const CHANGE_PRIORITY_COLOR: Record<ChangePriority, string> = {
  LOW: "default",
  MEDIUM: "blue",
  HIGH: "orange",
  CRITICAL: "red",
};

export const AFFECTED_OBJECT_TYPE_LABEL: Record<AffectedObjectType, string> = {
  REQUIREMENT: "需求",
  MODEL_ELEMENT: "模型元素",
  DRAWING: "图纸",
  DISCIPLINE: "专业",
  RULE: "规则",
  QUANTITY: "工程量",
  ANALYSIS: "分析",
};

export const IMPACT_LEVEL_LABEL: Record<ImpactLevel, string> = {
  CONFIRMED: "已确认",
  POTENTIAL: "潜在",
  UNKNOWN: "未知",
  NOT_AFFECTED: "无影响",
};

export const IMPACT_LEVEL_COLOR: Record<ImpactLevel, string> = {
  CONFIRMED: "error",
  POTENTIAL: "warning",
  UNKNOWN: "default",
  NOT_AFFECTED: "success",
};

export const AFFECTED_ACTION_LABEL: Record<AffectedAction, string> = {
  ADDED: "新增",
  MODIFIED: "修改",
  REMOVED: "删除",
};

export const AFFECTED_ACTION_COLOR: Record<AffectedAction, string> = {
  ADDED: "green",
  MODIFIED: "orange",
  REMOVED: "red",
};

export const RECHECK_STATUS_LABEL: Record<RecheckStatus, string> = {
  PENDING: "待复查",
  IN_PROGRESS: "复查中",
  COMPLETED: "已完成",
  NOT_APPLICABLE: "不适用",
};

export const RECHECK_STATUS_COLOR: Record<RecheckStatus, string> = {
  PENDING: "default",
  IN_PROGRESS: "processing",
  COMPLETED: "success",
  NOT_APPLICABLE: "default",
};

export const TASK_PLAN_STATUS_LABEL: Record<TaskPlanStatus, string> = {
  TODO: "待办",
  IN_PROGRESS: "进行中",
  DONE: "已完成",
  BLOCKED: "已阻塞",
  CANCELLED: "已取消",
};

export const TASK_PLAN_STATUS_COLOR: Record<TaskPlanStatus, string> = {
  TODO: "default",
  IN_PROGRESS: "processing",
  DONE: "success",
  BLOCKED: "error",
  CANCELLED: "default",
};

export const CLOSURE_EVIDENCE_TYPE_LABEL: Record<ClosureEvidenceType, string> =
  {
    DESIGN_REVIEW: "设计评审",
    RULE_RUN: "规则运行",
    AI_REVIEW: "AI 复核",
    SIGNATURE: "签章",
    TEST: "测试",
  };

export const CLOSURE_EVIDENCE_STATUS_LABEL: Record<
  ClosureEvidenceStatus,
  string
> = {
  PENDING: "待验证",
  VERIFIED: "已验证",
  REJECTED: "已拒绝",
};

export const CLOSURE_EVIDENCE_STATUS_COLOR: Record<
  ClosureEvidenceStatus,
  string
> = {
  PENDING: "default",
  VERIFIED: "success",
  REJECTED: "error",
};

export const CHANGE_OPERATION_PHASE_LABEL: Record<
  ChangeOperationPhase,
  string
> = {
  SUBMIT: "提交",
  IMPACT_ANALYSIS: "影响分析",
  APPROVAL: "批准",
  IMPLEMENTATION: "实施",
  VERIFICATION: "验证",
  CLOSURE: "关闭",
  RECALL: "撤回",
};

export const CHANGE_OPERATION_PHASE_STATUS_LABEL: Record<
  ChangeOperationPhaseDto["status"],
  string
> = {
  PENDING: "待执行",
  IN_PROGRESS: "执行中",
  COMPLETED: "已完成",
  FAILED: "失败",
  SKIPPED: "已跳过",
};

export const CHANGE_OPERATION_PHASE_STATUS_COLOR: Record<
  ChangeOperationPhaseDto["status"],
  string
> = {
  PENDING: "default",
  IN_PROGRESS: "processing",
  COMPLETED: "success",
  FAILED: "error",
  SKIPPED: "default",
};

// ── 分页响应类型导出 ──

export type { OffsetPageResponse };
