/**
 * Requirement 域 API 契约（V0 阶段：仅前端骨架，后端 API 未就位）
 *
 * 权威源：@design/D37-关键界面-交互状态.md §D37.7 P03 需求、信息要求与追踪矩阵
 *        @design/D14-需求与信息要求.md（待定义）
 *        @design/D46-追踪完整性-一致性总审.md
 *
 * V0 简化：
 *  - 仅定义类型与 API 路径占位，供前端骨架使用
 *  - 后端 API（RequirementSource / Requirement / TraceLink / CoverageSummary）在 V1 阶段实现
 *  - 前端通过空状态显示"导入来源"引导，不伪造数据
 *
 * 实体关系（对齐 D37.7）：
 *  RequirementSource（来源文档：业主任务书、规范、合同附件等）
 *    └── Requirement（结构化需求条目：原文 locator + 结构化字段）
 *          └── TraceLink（追踪链接：需求 ↔ 设计元素 / 验证证据）
 *    InformationRequirementSet（信息要求集合：阶段 / 专业维度）
 *      └── CoverageSummary（覆盖度汇总：阶段 / 专业 / 成果 / 验证维度）
 */

// ── 枚举 ──

/**
 * 需求来源类型
 * - BRIEF: 业主任务书 / 设计任务书
 * - CODE: 规范条文（IBC / EN / GB 等）
 * - CONTRACT: 合同附件 / 设计服务范围
 * - ADDENDUM: 补充协议 / 设计变更通知
 * - OTHER: 其他（会议纪要、邮件确认等）
 */
export type RequirementSourceType =
  "BRIEF" | "CODE" | "CONTRACT" | "ADDENDUM" | "OTHER";

/**
 * 需求类别（用于左侧树分组）
 * - SPATIAL: 空间（净高、面积、流线）
 * - STRUCTURAL: 结构（抗震、挠度、承载力）
 * - MEP: 机电（HVAC、给排水、电气）
 * - FIRE_SAFETY: 消防（疏散、喷淋、防排烟）
 * - ACCESSIBILITY: 无障碍
 * - SUSTAINABILITY: 可持续（绿建、能耗）
 * - OTHER: 其他
 */
export type RequirementCategory =
  | "SPATIAL"
  | "STRUCTURAL"
  | "MEP"
  | "FIRE_SAFETY"
  | "ACCESSIBILITY"
  | "SUSTAINABILITY"
  | "OTHER";

/**
 * 需求优先级
 * - HIGH: 高（必须满足，影响合规或安全）
 * - MEDIUM: 中（应当满足，影响品质或功能）
 * - LOW: 低（建议满足，优化项）
 */
export type RequirementPriority = "HIGH" | "MEDIUM" | "LOW";

/**
 * 需求状态
 * - DRAFT: 草稿（录入中，未提交评审）
 * - IN_REVIEW: 评审中
 * - APPROVED: 已批准（基线）
 * - IMPLEMENTED: 已实现（设计已落实）
 * - SUPERSEDED: 已被新版本替代
 * - REJECTED: 已拒绝
 */
export type RequirementStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "IMPLEMENTED"
  | "SUPERSEDED"
  | "REJECTED";

/**
 * TraceLink 类型（追踪维度，对齐 D37.7 P03 Trace Matrix 过滤维度）
 * - STAGE: 阶段维度（概念 / 方案 / 扩初 / 施工图）
 * - DISCIPLINE: 专业维度（建筑 / 结构 / MEP）
 * - DELIVERABLE: 成果维度（图纸 / 模型 / 计算）
 * - VERIFICATION: 验证维度（检查报告 / 合规运行 / 测试）
 */
export type TraceLinkType =
  "STAGE" | "DISCIPLINE" | "DELIVERABLE" | "VERIFICATION";

// ── DTO ──

/**
 * 需求来源 DTO
 * 对应实体：RequirementSource（业主任务书 / 规范 / 合同附件等）
 */
export interface RequirementSourceDto {
  id: string;
  tenantId: string;
  projectId: string;
  /** 来源类型 */
  type: RequirementSourceType;
  /** 来源标题（如 "Grade A Office Specification"） */
  title: string;
  /** 来源文档引用（CDE Document ID 或外部 URL） */
  documentId?: string | null;
  /** 外部引用（如规范条文号 "IBC 2021 §1607"） */
  externalRef?: string | null;
  /** 上传 / 登记时间 */
  importedAt: string;
  /** 上传 / 登记人 */
  importedBy?: string | null;
  /** 来源条目数 */
  requirementCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 需求条目 DTO
 * 对应实体：Requirement（结构化需求条目）
 *
 * PII 分级：sourceLocator 字段为 L4（专业设计成果），日志须脱敏
 */
export interface RequirementDto {
  id: string;
  tenantId: string;
  projectId: string;
  /** 来源 ID */
  sourceId: string;
  /** 需求编号（项目内唯一，如 REQ-001） */
  code: string;
  /** 标题 */
  title: string;
  /** 详细描述 */
  description?: string | null;
  /** 类别 */
  category: RequirementCategory;
  /** 子类别（如 "Ceiling Heights"） */
  subCategory?: string | null;
  /** 优先级 */
  priority: RequirementPriority;
  /** 状态 */
  status: RequirementStatus;
  /** 来源定位（原文 locator：页码 / 章节号 / 行号） */
  sourceLocator?: string | null;
  /** 关联设计元素数量（TraceLink 计数） */
  linkedCount: number;
  /** 最近更新时间 */
  lastUpdatedAt: string;
  /** 最近更新人 */
  lastUpdatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  /** 乐观锁版本号 */
  rowVersion: number;
}

/**
 * TraceLink DTO（需求 ↔ 设计元素 / 验证证据 的追踪链接）
 */
export interface TraceLinkDto {
  id: string;
  tenantId: string;
  projectId: string;
  /** 需求 ID */
  requirementId: string;
  /** 链接类型（追踪维度） */
  type: TraceLinkType;
  /** 目标元素 ID（设计元素 / 验证证据 ID） */
  targetId: string;
  /** 目标元素类型（如 "FLOOR_PLAN" / "SECTION" / "CALCULATION" / "TEST_REPORT"） */
  targetType: string;
  /** 目标元素编号（如 "EL-1024"） */
  targetCode: string;
  /** 目标元素名称 */
  targetName: string;
  /** 链接建立时间 */
  linkedAt: string;
  /** 链接建立人 */
  linkedBy?: string | null;
}

/**
 * 覆盖度汇总 DTO
 * 对应实体：CoverageSummary（按阶段 / 专业 / 成果 / 验证维度统计）
 */
export interface CoverageSummaryDto {
  projectId: string;
  /** 总需求数 */
  totalRequirements: number;
  /** 已批准需求数 */
  approvedCount: number;
  /** 已实现需求数 */
  implementedCount: number;
  /** 已建立 TraceLink 的需求数 */
  linkedCount: number;
  /** 覆盖率（已链接 / 总需求，0-1） */
  coverageRate: number;
  /** 按阶段维度的覆盖统计 */
  byStage?: Record<string, { total: number; linked: number }>;
  /** 按专业维度的覆盖统计 */
  byDiscipline?: Record<string, { total: number; linked: number }>;
  /** 按成果维度的覆盖统计 */
  byDeliverable?: Record<string, { total: number; linked: number }>;
  /** 按验证维度的覆盖统计 */
  byVerification?: Record<string, { total: number; linked: number }>;
}

/**
 * 需求变更历史 DTO
 */
export interface RequirementHistoryDto {
  id: string;
  requirementId: string;
  /** 变更时间 */
  timestamp: string;
  /** 变更人 */
  author: string;
  /** 变更描述 */
  description: string;
  /** 变更字段（如 "status" / "priority" / "description"） */
  field?: string | null;
  /** 旧值 */
  oldValue?: string | null;
  /** 新值 */
  newValue?: string | null;
}

// ── 请求 DTO ──

/**
 * 列出需求条目请求
 * projectId 通过 hook 参数 + URL 路径传入，不在 Request 内重复
 */
export interface ListRequirementsRequest {
  /** 类别过滤 */
  category?: RequirementCategory;
  /** 状态过滤 */
  status?: RequirementStatus;
  /** 关键词搜索（标题 / 描述 / 编号） */
  keyword?: string;
  /** 来源 ID 过滤 */
  sourceId?: string;
  /** 分页页码（从 1 开始） */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 排序字段 */
  sort?: "code" | "priority" | "status" | "lastUpdatedAt";
  /** 排序方向 */
  order?: "asc" | "desc";
}

/**
 * 列出需求来源请求
 * projectId 通过 hook 参数 + URL 路径传入，不在 Request 内重复
 */
export interface ListRequirementSourcesRequest {
  type?: RequirementSourceType;
}

// ── API 端点定义 ──

/**
 * Requirement API 端点
 * 基础路径：/api/v1
 *
 * V0 阶段：API 未实现，前端通过空状态展示
 * V1 阶段：Core 服务实现对应端点
 */
export const RequirementApiPaths = {
  // 需求来源
  sources: (projectId: string) =>
    `/api/v1/projects/${projectId}/requirement-sources`,
  sourceDetail: (sourceId: string) => `/api/v1/requirement-sources/${sourceId}`,

  // 需求条目
  requirements: (projectId: string) =>
    `/api/v1/projects/${projectId}/requirements`,
  requirementDetail: (id: string) => `/api/v1/requirements/${id}`,
  requirementHistory: (id: string) => `/api/v1/requirements/${id}/history`,

  // TraceLink
  traceLinks: (requirementId: string) =>
    `/api/v1/requirements/${requirementId}/trace-links`,

  // 覆盖度汇总
  coverage: (projectId: string) =>
    `/api/v1/projects/${projectId}/requirements/coverage`,
} as const;
