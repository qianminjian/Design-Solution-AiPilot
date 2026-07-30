/**
 * Publication 域 API 契约（V0 阶段：前端骨架 + V1 API 对接预留）
 *
 * 权威源：@design/D37-关键界面-交互状态.md §D37.15 P11 专业提交、校审与发布向导
 *        @design/D05-全流程阶段-阶段门.md（发布门禁数据源）
 *        @design/D11-专业协同与多专业校审.md（专业评审职责分离）
 *
 * V0 简化：
 *  - 仅定义类型与 API 路径占位，供前端骨架使用
 *  - 后端 Publication / Submission / Signature / Recipient API 待 V1 实现
 *  - 前端通过空状态区分"无发布 / 发布中 / 已发布 / 失败 / 已撤回"
 *  - 后端 404/501 时前端显示空状态，不伪造数据
 *
 * 实体关系（对齐 D37.15）：
 *  Publication（发布：核心实体）
 *    ├── baseline: Baseline（冻结基线，sha256 hash）
 *    ├── manifest: PublicationManifest（发布清单：收件人/留存期/签名要求）
 *    ├── checks: ReadinessCheck[]（完整性检查：阻断/警告/通过/N/A）
 *    ├── evidence: EvidenceItem[]（证据：版本差异/Issue/规则/AI分析）
 *    ├── reviewers: ReviewerDecision[]（专业复核：Accept/Return/Reject/Conditional）
 *    ├── signatures: Signature[]（签名：注册建筑师/结构/项目经理）
 *    ├── recipients: Recipient[]（收件人：业主/总包/监理/归档/审批机关）
 *    └── operation: PublicationOperation（发布操作：Sealing/Signing/Lock/Notification）
 *
 *  Submission（提交审阅对象，与 Publication 1:1 关联）
 *    ├── submissionItems: SubmissionItem[]（提交项：图纸/模型/计算书）
 *    └── reviewSteps: ReviewStep[]（7 步审阅流程）
 *
 * 主动作约束（D37.15 §主动作）：
 *  - Review 决策：Accept / Return / Reject / Conditional
 *  - 必须 reason + checklist
 *  - Conditional 须有责任人 / 期限 / 影响范围
 *  - 最终提交只在所有阻断项关闭、精确 Baseline 冻结且 SoD 满足时启用
 *  - Step-up 确认后提交 Operation（不可逆）
 *
 * 安全红线（design-constraints.md §AI 安全红线）：
 *  - 所有发布必须由注册建筑师 / 工程师签章
 *  - 签名后对象锁定，不可篡改
 *  - Retention 与法规对齐（ISO 19650 §archival requirements）
 */

// ── 枚举 ──

/**
 * 发布状态
 * - DRAFT: 草稿（向导中，未提交）
 * - READY_TO_PUBLISH: 就绪待发布（所有阻断项已关闭）
 * - PUBLISHING: 发布中（Operation 执行中）
 * - PUBLISHED: 已发布（签名完成，对象锁定）
 * - FAILED: 发布失败（Operation 异常）
 * - RECALLED: 已撤回（审批后撤回）
 */
export type PublicationStatus =
  | "DRAFT"
  | "READY_TO_PUBLISH"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "RECALLED";

/**
 * 完整性检查状态
 * - PASS: 通过
 * - WARNING: 警告（需显式确认处置）
 * - BLOCKING: 阻断（必须关闭才能继续）
 * - NOT_APPLICABLE: 不适用
 */
export type ReadinessCheckStatus =
  "PASS" | "WARNING" | "BLOCKING" | "NOT_APPLICABLE";

/**
 * 证据类型
 * - VERSION_DIFF: 版本差异
 * - ISSUE: 协调 Issue（BCF）
 * - RULE_RUN: 合规规则运行
 * - AI_ANALYSIS: AI 复核分析
 * - ANALYSIS: 工程分析
 */
export type EvidenceType =
  "VERSION_DIFF" | "ISSUE" | "RULE_RUN" | "AI_ANALYSIS" | "ANALYSIS";

/**
 * 证据结果
 * - PASS: 通过
 * - WARNING: 警告
 * - FAIL: 失败
 * - NOT_APPLICABLE: 不适用
 */
export type EvidenceOutcome = "PASS" | "WARNING" | "FAIL" | "NOT_APPLICABLE";

/**
 * 专业复核决策（对齐 D37.15 §决策）
 * - ACCEPT: 通过
 * - RETURN: 退回（修改后重审）
 * - REJECT: 拒绝（不可发布）
 * - CONDITIONAL: 有条件通过（须有责任人/期限/影响范围）
 * - PENDING: 待评审
 */
export type ReviewerDecisionValue =
  "ACCEPT" | "RETURN" | "REJECT" | "CONDITIONAL" | "PENDING";

/**
 * 签名角色
 * - ARCHITECT: 注册建筑师
 * - STRUCTURAL_ENGINEER: 注册结构工程师
 * - MEP_ENGINEER: MEP 工程师
 * - PROJECT_MANAGER: 项目经理
 * - COMPLIANCE_OFFICER: 合规员
 * - OWNER_REPRESENTATIVE: 业主代表
 */
export type SignatureRole =
  | "ARCHITECT"
  | "STRUCTURAL_ENGINEER"
  | "MEP_ENGINEER"
  | "PROJECT_MANAGER"
  | "COMPLIANCE_OFFICER"
  | "OWNER_REPRESENTATIVE";

/**
 * 签名状态
 * - PENDING: 待签
 * - SIGNED: 已签
 * - REJECTED: 拒签
 * - EXPIRED: 已过期
 */
export type SignatureStatus = "PENDING" | "SIGNED" | "REJECTED" | "EXPIRED";

/**
 * 收件人类型
 * - OWNER_REP: 业主代表
 * - CONTRACTOR: 总包单位
 * - SUPERVISOR: 监理单位
 * - ARCHIVE: 归档系统
 * - AUTHORITY: 审批机关
 * - INTERNAL: 项目内部团队
 */
export type RecipientType =
  | "OWNER_REP"
  | "CONTRACTOR"
  | "SUPERVISOR"
  | "ARCHIVE"
  | "AUTHORITY"
  | "INTERNAL";

/**
 * 发布操作阶段（对齐 D37.15 §Operation）
 * - SEALING: 密封（生成不可变 hash）
 * - SIGNING: 签名收集
 * - OBJECT_LOCK: 对象锁定
 * - NOTIFICATION: 通知收件人
 */
export type PublicationOperationPhase =
  "SEALING" | "SIGNING" | "OBJECT_LOCK" | "NOTIFICATION";

/**
 * 操作阶段状态
 * - PENDING: 待执行
 * - IN_PROGRESS: 执行中
 * - COMPLETED: 已完成
 * - FAILED: 失败
 */
export type OperationPhaseStatus =
  "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

/**
 * 审阅流程步骤键
 */
export type ReviewStepKey =
  | "baseline"
  | "completeness"
  | "evidence"
  | "reviews"
  | "manifest"
  | "submit"
  | "receipt";

// ── DTO ──

/**
 * 完整性检查项 DTO
 */
export interface ReadinessCheckDto {
  id: string;
  tenantId: string;
  publicationId: string;
  name: string;
  status: ReadinessCheckStatus;
  detail: string;
  /** 关联依赖（如某 Issue / Rule Run / 文件 ID） */
  referenceId?: string | null;
  /** 是否需要显式确认处置（warning 必须为 true） */
  requiresAcknowledgment: boolean;
  /** 已确认处置的用户 ID（warning 项确认后填入） */
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 证据项 DTO
 */
export interface EvidenceItemDto {
  id: string;
  tenantId: string;
  publicationId: string;
  type: EvidenceType;
  title: string;
  outcome: EvidenceOutcome;
  /** 引用 ID（如 diff ID / Issue ID / rule-run ID / ai-run ID） */
  referenceId: string;
  /** 引用 URL（可选，便于跳转） */
  referenceUrl?: string | null;
  createdAt: string;
}

/**
 * 专业复核决策 DTO
 */
export interface ReviewerDecisionDto {
  id: string;
  tenantId: string;
  publicationId: string;
  /** 专业（建筑/结构/MEP/合规/业主） */
  discipline: string;
  /** 评审人用户 ID */
  reviewerId: string;
  reviewerName: string;
  decision: ReviewerDecisionValue;
  reason?: string | null;
  /** Conditional 时必填：责任人 / 期限 / 影响范围 */
  conditionalOwner?: string | null;
  conditionalDueAt?: string | null;
  conditionalScope?: string | null;
  /** 检查清单（每个项目必须勾选才能提交） */
  checklist?: ReviewChecklistItem[];
  decidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 复核检查清单项
 */
export interface ReviewChecklistItem {
  item: string;
  passed: boolean;
  /** 是否高风险项（高风险项需额外确认） */
  highRisk?: boolean;
}

/**
 * 签名 DTO
 */
export interface SignatureDto {
  id: string;
  tenantId: string;
  publicationId: string;
  role: SignatureRole;
  signerId?: string | null;
  signerName?: string | null;
  status: SignatureStatus;
  /** 签名时间戳（不可篡改） */
  signedAt?: string | null;
  /** 签名 hash（绑定 Baseline + 内容） */
  signatureHash?: string | null;
  /** 证书 DN / 证书序列号 */
  certificateDn?: string | null;
  /** 拒签原因 */
  rejectReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 收件人 DTO
 */
export interface RecipientDto {
  id: string;
  tenantId: string;
  publicationId: string;
  type: RecipientType;
  name: string;
  email?: string | null;
  /** 是否已通知 */
  notified: boolean;
  notifiedAt?: string | null;
  /** 下载链接（发布完成后生成） */
  downloadUrl?: string | null;
  /** 链接有效期（天） */
  linkExpiryDays?: number | null;
  createdAt: string;
}

/**
 * 发布操作阶段 DTO
 */
export interface PublicationOperationPhaseDto {
  id: string;
  publicationId: string;
  phase: PublicationOperationPhase;
  status: OperationPhaseStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  /** 失败原因 */
  failureReason?: string | null;
  /** 重试次数 */
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 发布清单 DTO（收件人 + 留存期 + 签名要求）
 */
export interface PublicationManifestDto {
  /** 留存期（天） */
  retentionDays: number;
  /** 签名要求（角色列表） */
  requiredSignatures: SignatureRole[];
  /** 是否生成归档包 */
  generateArchivePackage: boolean;
  /** 是否启用对象锁定 */
  enableObjectLock: boolean;
  /** 备注 */
  notes?: string | null;
}

/**
 * Baseline 信息 DTO
 */
export interface BaselineDto {
  /** Baseline ID，如 BL-2026-003 */
  id: string;
  /** Baseline 标题 */
  title: string;
  /** sha256 hash（精确版本指纹） */
  hash: string;
  /** 冻结时间 */
  frozenAt: string;
  /** 关联项目 ID */
  projectId: string;
  /** 是否冻结 */
  isFrozen: boolean;
}

/**
 * 发布 DTO（核心实体）
 */
export interface PublicationDto {
  id: string;
  tenantId: string;
  /** 发布编号，如 PUB-001 */
  code: string;
  /** 发布标题 */
  title: string;
  /** Baseline（精确版本） */
  baselineId: string;
  baselineHash: string;
  baseline?: BaselineDto | null;
  /** 状态 */
  status: PublicationStatus;
  /** 发布清单 */
  manifest: PublicationManifestDto;
  /** 发布人 ID */
  publisherId: string;
  publisherName?: string | null;
  /** 发布时间（成功后） */
  publishedAt?: string | null;
  /** Step-up 原因（提交时填写） */
  stepUpReason?: string | null;
  /** AI 辅助标记（V0 强制 false，发布不依赖 AI 输出） */
  isAiAssisted: false;
  /** 是否需要人工复核（发布必须人工签章） */
  requiresHumanReview: true;
  /** 完整性检查项 */
  checksCount?: number | null;
  /** 阻断项数量 */
  blockingCount?: number | null;
  /** 警告项数量 */
  warningCount?: number | null;
  /** 证据数量 */
  evidenceCount?: number | null;
  /** 复核矩阵数量 */
  reviewersCount?: number | null;
  /** 已签名数量 */
  signedCount?: number | null;
  /** 收件人数量 */
  recipientsCount?: number | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

/**
 * 发布详情 DTO（包含完整子实体）
 */
export interface PublicationDetailDto extends PublicationDto {
  checks: ReadinessCheckDto[];
  evidence: EvidenceItemDto[];
  reviewers: ReviewerDecisionDto[];
  signatures: SignatureDto[];
  recipients: RecipientDto[];
  operations: PublicationOperationPhaseDto[];
}

// ── 请求 DTO ──

/**
 * 列出发布请求
 */
export interface ListPublicationsRequest {
  page?: number;
  pageSize?: number;
  /** 按项目筛选 */
  projectId?: string;
  /** 按状态筛选 */
  status?: PublicationStatus;
  /** 关键字搜索（code/title/baselineId） */
  keyword?: string;
}

/**
 * 创建发布请求（向导 Step 1-5 收集）
 */
export interface CreatePublicationRequest {
  projectId: string;
  title: string;
  baselineId: string;
  manifest: PublicationManifestDto;
  /** 警告项确认列表（id 列表） */
  acknowledgedWarningIds: string[];
  /** Step-up 原因（≥10 字符） */
  stepUpReason: string;
  /** Step-up Token（高风险操作） */
  stepUpToken?: string;
}

/**
 * 更新发布决策请求（向导 Step 4）
 */
export interface UpdateReviewerDecisionRequest {
  publicationId: string;
  decision: ReviewerDecisionValue;
  reason: string;
  checklist?: ReviewChecklistItem[];
  /** Conditional 必填 */
  conditionalOwner?: string;
  conditionalDueAt?: string;
  conditionalScope?: string;
}

/**
 * 确认警告项请求（向导 Step 3）
 */
export interface AcknowledgeWarningRequest {
  publicationId: string;
  checkIds: string[];
  /** Step-up Token（确认处置 warning 视为高风险） */
  stepUpToken?: string;
}

/**
 * 提交发布请求（向导 Step 6）
 */
export interface SubmitPublicationRequest {
  publicationId: string;
  stepUpReason: string;
  stepUpToken: string;
  /** 责任确认（必须勾选：发布不可逆，签章后锁定） */
  responsibilityAcknowledged: boolean;
}

/**
 * 撤回发布请求
 */
export interface RecallPublicationRequest {
  publicationId: string;
  reason: string;
  stepUpToken: string;
}

// ── API 端点定义 ──

/**
 * Publication API 端点
 * 基础路径：/api/v1/publications
 *
 * 后端 Publication / Submission / Signature / Recipient API 待 V1 实现。
 * 稳定契约 ID 见 @design/r2-contract-catalog/
 */
export const PublicationApiPaths = {
  /** 列出发布 */
  list: "/api/v1/publications",
  /** 创建发布（向导 Step 1-5 草稿） */
  create: "/api/v1/publications",
  /** 发布详情（含子实体） */
  detail: (id: string) => `/api/v1/publications/${id}`,
  /** 更新发布（草稿阶段） */
  update: (id: string) => `/api/v1/publications/${id}`,
  /** 删除草稿 */
  delete: (id: string) => `/api/v1/publications/${id}`,
  /** 提交发布（向导 Step 6，触发 Operation） */
  submit: (id: string) => `/api/v1/publications/${id}:submit`,
  /** 撤回发布 */
  recall: (id: string) => `/api/v1/publications/${id}:recall`,
  /** 完整性检查列表 */
  checks: (id: string) => `/api/v1/publications/${id}/checks`,
  /** 确认警告项 */
  acknowledgeWarnings: (id: string) =>
    `/api/v1/publications/${id}/checks:acknowledge`,
  /** 证据列表 */
  evidence: (id: string) => `/api/v1/publications/${id}/evidence`,
  /** 复核决策列表 */
  reviewers: (id: string) => `/api/v1/publications/${id}/reviewers`,
  /** 更新复核决策 */
  updateReviewerDecision: (id: string) =>
    `/api/v1/publications/${id}/reviewers:decide`,
  /** 签名列表 */
  signatures: (id: string) => `/api/v1/publications/${id}/signatures`,
  /** 收件人列表 */
  recipients: (id: string) => `/api/v1/publications/${id}/recipients`,
  /** 操作阶段列表 */
  operations: (id: string) => `/api/v1/publications/${id}/operations`,
  /** Baseline 列表（用于向导 Step 1 选择） */
  baselines: (projectId: string) => `/api/v1/projects/${projectId}/baselines`,
  /** Baseline 详情 */
  baselineDetail: (projectId: string, baselineId: string) =>
    `/api/v1/projects/${projectId}/baselines/${baselineId}`,
} as const;

// ── 枚举映射常量（供前端组件使用） ──

export const PUBLICATION_STATUS_LABEL: Record<PublicationStatus, string> = {
  DRAFT: "草稿",
  READY_TO_PUBLISH: "待发布",
  PUBLISHING: "发布中",
  PUBLISHED: "已发布",
  FAILED: "发布失败",
  RECALLED: "已撤回",
};

export const PUBLICATION_STATUS_COLOR: Record<PublicationStatus, string> = {
  DRAFT: "default",
  READY_TO_PUBLISH: "warning",
  PUBLISHING: "processing",
  PUBLISHED: "success",
  FAILED: "error",
  RECALLED: "default",
};

export const READINESS_CHECK_STATUS_LABEL: Record<
  ReadinessCheckStatus,
  string
> = {
  PASS: "通过",
  WARNING: "警告",
  BLOCKING: "阻断",
  NOT_APPLICABLE: "不适用",
};

export const READINESS_CHECK_STATUS_COLOR: Record<
  ReadinessCheckStatus,
  string
> = {
  PASS: "success",
  WARNING: "warning",
  BLOCKING: "error",
  NOT_APPLICABLE: "default",
};

export const EVIDENCE_TYPE_LABEL: Record<EvidenceType, string> = {
  VERSION_DIFF: "版本差异",
  ISSUE: "Issue",
  RULE_RUN: "规则运行",
  AI_ANALYSIS: "AI 分析",
  ANALYSIS: "工程分析",
};

export const EVIDENCE_OUTCOME_LABEL: Record<EvidenceOutcome, string> = {
  PASS: "通过",
  WARNING: "警告",
  FAIL: "未通过",
  NOT_APPLICABLE: "不适用",
};

export const EVIDENCE_OUTCOME_COLOR: Record<EvidenceOutcome, string> = {
  PASS: "success",
  WARNING: "warning",
  FAIL: "error",
  NOT_APPLICABLE: "default",
};

export const REVIEWER_DECISION_LABEL: Record<ReviewerDecisionValue, string> = {
  ACCEPT: "通过",
  RETURN: "退回",
  REJECT: "拒绝",
  CONDITIONAL: "有条件通过",
  PENDING: "待评审",
};

export const REVIEWER_DECISION_COLOR: Record<ReviewerDecisionValue, string> = {
  ACCEPT: "success",
  RETURN: "warning",
  REJECT: "error",
  CONDITIONAL: "processing",
  PENDING: "default",
};

export const SIGNATURE_ROLE_LABEL: Record<SignatureRole, string> = {
  ARCHITECT: "注册建筑师",
  STRUCTURAL_ENGINEER: "注册结构工程师",
  MEP_ENGINEER: "MEP 工程师",
  PROJECT_MANAGER: "项目经理",
  COMPLIANCE_OFFICER: "合规员",
  OWNER_REPRESENTATIVE: "业主代表",
};

export const SIGNATURE_STATUS_LABEL: Record<SignatureStatus, string> = {
  PENDING: "待签",
  SIGNED: "已签",
  REJECTED: "拒签",
  EXPIRED: "已过期",
};

export const SIGNATURE_STATUS_COLOR: Record<SignatureStatus, string> = {
  PENDING: "default",
  SIGNED: "success",
  REJECTED: "error",
  EXPIRED: "warning",
};

export const RECIPIENT_TYPE_LABEL: Record<RecipientType, string> = {
  OWNER_REP: "业主代表",
  CONTRACTOR: "总包单位",
  SUPERVISOR: "监理单位",
  ARCHIVE: "归档系统",
  AUTHORITY: "审批机关",
  INTERNAL: "项目内部团队",
};

export const OPERATION_PHASE_LABEL: Record<PublicationOperationPhase, string> =
  {
    SEALING: "Sealing（密封）",
    SIGNING: "Signing（签名收集）",
    OBJECT_LOCK: "Object Lock（对象锁定）",
    NOTIFICATION: "Notification（通知）",
  };

export const OPERATION_PHASE_STATUS_LABEL: Record<
  OperationPhaseStatus,
  string
> = {
  PENDING: "待执行",
  IN_PROGRESS: "执行中",
  COMPLETED: "已完成",
  FAILED: "失败",
};

export const OPERATION_PHASE_STATUS_COLOR: Record<
  OperationPhaseStatus,
  string
> = {
  PENDING: "default",
  IN_PROGRESS: "processing",
  COMPLETED: "success",
  FAILED: "error",
};

/** 默认复核检查清单项（向导 Step 4） */
export const DEFAULT_REVIEW_CHECKLIST: ReviewChecklistItem[] = [
  { item: "图纸完整性已确认（所有专业）", passed: false },
  { item: "结构计算书已关联且版本匹配", passed: false },
  { item: "规范合规运行通过", passed: false },
  { item: "AI 复核高风险项已处理", passed: false },
  { item: "协调 Issue 已闭环或豁免", passed: false },
];

/** 高风险额外检查清单项 */
export const HIGH_RISK_REVIEW_CHECKLIST: ReviewChecklistItem[] = [
  {
    item: "注册建筑师 / 结构工程师签章已就位",
    passed: false,
    highRisk: true,
  },
  {
    item: "Baseline 已冻结且 hash 已记录",
    passed: false,
    highRisk: true,
  },
];
