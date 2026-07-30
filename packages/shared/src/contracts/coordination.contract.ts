/**
 * Coordination 域 API 契约（V0 阶段：仅前端骨架，后端 API 未就位）
 *
 * 权威源：@design/D37-关键界面-交互状态.md §D37.11 P07 协调、碰撞与 Issue 工作台
 *        @design/D11-协调-碰撞-问题.md
 *        @design/D35-API-事件契约.md（Coordination 域契约待定义）
 *
 * V0 简化：
 *  - 仅定义类型与 API 路径占位，供前端骨架使用
 *  - 后端 Coordination API（ClashRun/Finding/Cluster/Issue/Waiver）在 V1 阶段实现
 *  - 前端通过空状态区分"当前无 Run / Run 进行中 / Run 已完成但无 Finding / Cluster 已就绪"
 *  - BCF Issue 已接入 use-review.ts 的 useBcfIssues hook，本契约补充 Finding/Cluster/Run/Waiver
 *
 * 实体关系（对齐 D37.11 §数据/接口）：
 *  ClashRun（碰撞检测运行）
 *    └── Finding（碰撞发现：源/目标构件 + 规则 + 容差 + 严重性）
 *          └── Cluster（聚类：Finding 集合 + AI 置信度 + 误并风险）
 *                └── IssueLinkage（Finding→Cluster→Issue 映射，保留映射历史）
 *                      └── Issue（BCF Issue，已在 review.schema.ts 定义）
 *                            ├── Viewpoint（BCF 视点：camera/selection/section/snapshot）
 *                            ├── Comment（评论，支持 ETag 冲突保留草稿）
 *                            └── Waiver（豁免：范围/期限/批准人，过期回待审）
 *
 * 主动作约束（D37.11 §主动作）：
 *  - 验证候选并创建/关联 Issue
 *  - Run 结果不能直接成为已确认 Issue（必须人工确认）
 *  - 关闭 Issue 需验证新模型版本和证据
 *  - 批量动作先预检逐项版本、权限、SoD
 */

// ── 枚举 ──

/**
 * 协调检查类型
 * - CLASH: 碰撞检测（几何碰撞）
 * - CLEARANCE: 间距检查（净距不足）
 * - CONSISTENCY: 一致性检查（跨专业模型对齐）
 * - CODE_CHECK: 规范合规检查（建筑/结构/MEP 跨专业）
 */
export type CoordinationCheckType =
  "CLASH" | "CLEARANCE" | "CONSISTENCY" | "CODE_CHECK";

/**
 * ClashRun 运行状态
 * - PENDING: 已创建未执行
 * - RUNNING: 执行中
 * - COMPLETED: 已完成
 * - FAILED: 失败
 * - CANCELLED: 已取消
 */
export type ClashRunStatus =
  "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

/**
 * Finding 严重性（对齐 BCF priority + 项目风险分级）
 * - CRITICAL: 严重（影响安全/合规）
 * - HIGH: 高（影响功能/协调）
 * - MEDIUM: 中（影响设计效率）
 * - LOW: 低（提示性）
 *
 * 说明：与 review.schema.ts 的 FindingSeverity（lowercase）不同，
 * coordination 域使用大写枚举值（对齐 Java 后端枚举序列化）。
 */
export type CoordinationFindingSeverity =
  "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

/**
 * Finding 状态
 * - OPEN: 待处理
 * - CLUSTERED: 已聚类
 * - LINKED: 已关联 Issue
 * - RESOLVED: 已解决
 * - IGNORED: 已忽略
 * - WAIVED: 已豁免
 *
 * 说明：与 review.schema.ts 的 FindingStatus（lowercase）不同，
 * coordination 域使用大写枚举值（对齐 Java 后端枚举序列化）。
 */
export type CoordinationFindingStatus =
  "OPEN" | "CLUSTERED" | "LINKED" | "RESOLVED" | "IGNORED" | "WAIVED";

/**
 * Cluster 状态
 * - PROPOSED: AI/规则建议（人工待审）
 * - CONFIRMED: 已确认
 * - SPLIT: 已拆分
 * - MERGED: 已合并到其他 Cluster
 * - DISMISSED: 已驳回
 */
export type ClusterStatus =
  "PROPOSED" | "CONFIRMED" | "SPLIT" | "MERGED" | "DISMISSED";

/**
 * Waiver 状态（D37.11 §关闭/豁免）
 * - PENDING: 待审批
 * - APPROVED: 已批准
 * - REJECTED: 已拒绝
 * - EXPIRED: 已过期（自动回待审）
 * - REVOKED: 已撤销
 */
export type WaiverStatus =
  "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "REVOKED";

// ── DTO ──

/**
 * 碰撞规则 DTO
 * 对应实体：ClashRule（规则 + 容差 + 适用范围）
 */
export interface ClashRuleDto {
  id: string;
  tenantId: string;
  projectId: string;
  /** 规则编号 */
  code: string;
  /** 规则名称 */
  name: string;
  /** 检查类型 */
  checkType: CoordinationCheckType;
  /** 专业 A（如 ARCH） */
  disciplineA: string;
  /** 专业 B（如 MEP） */
  disciplineB: string;
  /** 容差（mm，0 表示严格碰撞） */
  tolerance?: number | null;
  /** 是否启用 */
  enabled: boolean;
  /** 描述 */
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 碰撞检测运行 DTO
 * 对应实体：ClashRun（一次 Clash 检测执行）
 *
 * PII 分级：sourceModelVersions 为 L4（专业设计成果），日志须脱敏
 */
export interface ClashRunDto {
  id: string;
  tenantId: string;
  projectId: string;
  /** 运行编号（项目内递增） */
  runIndex: number;
  /** 运行名称 */
  name: string;
  /** 状态 */
  status: ClashRunStatus;
  /** 检查类型 */
  checkType: CoordinationCheckType;
  /** 应用的规则集（规则 ID 列表） */
  ruleIds: string[];
  /** 源模型版本（discipline → modelVersionId 映射） */
  sourceModelVersions: Record<string, string>;
  /** 开始时间 */
  startedAt?: string | null;
  /** 完成时间 */
  completedAt?: string | null;
  /** Finding 总数 */
  totalFindings: number;
  /** CRITICAL 数量 */
  criticalCount: number;
  /** HIGH 数量 */
  highCount: number;
  /** MEDIUM 数量 */
  mediumCount: number;
  /** LOW 数量 */
  lowCount: number;
  /** Cluster 数量 */
  clusterCount: number;
  /** 已关联 Issue 数量 */
  linkedIssueCount: number;
  /** 运行耗时（ms） */
  durationMs?: number | null;
  /** 执行人 */
  executedBy?: string | null;
  /** 失败原因（status=FAILED 时） */
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
  /** 乐观锁版本号 */
  rowVersion: number;
}

/**
 * 碰撞发现 DTO
 * 对应实体：Finding（碰撞检测发现的单个问题）
 *
 * PII 分级：sourceElementId/targetElementId 为 L4（专业设计成果）
 */
export interface FindingDto {
  id: string;
  tenantId: string;
  projectId: string;
  runId: string;
  /** Finding 编号（项目内递增） */
  findingIndex: number;
  /** 规则 ID */
  ruleId: string;
  /** 规则编号 */
  ruleCode: string;
  /** 检查类型 */
  checkType: CoordinationCheckType;
  /** 严重性 */
  severity: CoordinationFindingSeverity;
  /** 状态 */
  status: CoordinationFindingStatus;
  /** 关联 Cluster ID（未聚类为 null） */
  clusterId?: string | null;
  /** 关联 Issue ID（未关联为 null） */
  issueId?: string | null;
  /** 源专业 */
  sourceDiscipline: string;
  /** 源构件 GUID */
  sourceElementId: string;
  /** 源构件名称 */
  sourceElementName: string;
  /** 源模型版本 */
  sourceModelVersion: string;
  /** 目标专业 */
  targetDiscipline: string;
  /** 目标构件 GUID */
  targetElementId: string;
  /** 目标构件名称 */
  targetElementName: string;
  /** 目标模型版本 */
  targetModelVersion: string;
  /** 碰撞距离（mm，负值表示穿透） */
  distance?: number | null;
  /** 碰撞位置（X/Y/Z） */
  location?: {
    x: number;
    y: number;
    z: number;
  } | null;
  /** 描述 */
  description: string;
  /** 创建时间 */
  createdAt: string;
  updatedAt: string;
}

/**
 * Cluster DTO（聚类）
 * 对应实体：Cluster（Finding 集合 + AI 置信度）
 */
export interface ClusterDto {
  id: string;
  tenantId: string;
  projectId: string;
  runId: string;
  /** Cluster 编号 */
  clusterIndex: number;
  /** 标题（AI 建议或人工命名） */
  title: string;
  /** 状态 */
  status: ClusterStatus;
  /** 包含的 Finding ID 列表 */
  findingIds: string[];
  /** Finding 数量 */
  findingCount: number;
  /** 主 Finding ID（代表） */
  representativeFindingId: string;
  /** 主规则编号 */
  primaryRuleCode: string;
  /** 主严重性（最高级） */
  primarySeverity: CoordinationFindingSeverity;
  /** 涉及专业 */
  disciplines: string[];
  /** AI 置信度（0-1） */
  aiConfidence?: number | null;
  /** AI 聚类依据（如 "相同空间区域 + 相同专业对"） */
  clusterBasis?: string | null;
  /** 误并风险（AI 评估的聚类错误概率，0-1） */
  mergeRisk?: number | null;
  /** 是否人工已审核 */
  humanReviewed: boolean;
  /** 审核人 */
  reviewedBy?: string | null;
  /** 审核备注 */
  reviewComment?: string | null;
  /** 关联 Issue ID */
  issueId?: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

/**
 * BCF Viewpoint DTO（视点快照）
 * 对应实体：Viewpoint（camera/selection/section/snapshot）
 */
export interface ViewpointDto {
  id: string;
  issueId: string;
  /** 视点类型（DEFAULT/SECTION/CAMERA_SNAPSHOT） */
  type: "DEFAULT" | "SECTION" | "CAMERA_SNAPSHOT";
  /** 相机位置 */
  camera?: {
    position: { x: number; y: number; z: number };
    direction: { x: number; y: number; z: number };
    up: { x: number; y: number; z: number };
    fov: number;
  } | null;
  /** 选中构件 GUID 列表 */
  selection: string[];
  /** 隐藏构件 GUID 列表 */
  hidden?: string[];
  /** 剖切面（可选） */
  sectionPlane?: {
    point: { x: number; y: number; z: number };
    direction: { x: number; y: number; z: number };
  } | null;
  /** 截图快照（base64） */
  snapshot?: string | null;
  /** 组件标签（如 "Plan View" / "3D View"） */
  label?: string | null;
  /** 创建人 */
  createdBy: string;
  createdAt: string;
}

/**
 * 评论 DTO
 * 对应实体：Comment（Issue 评论，支持 ETag 冲突保留草稿）
 */
export interface IssueCommentDto {
  id: string;
  issueId: string;
  author: string;
  authorName: string;
  content: string;
  /** 评论类型（COMMENT/STATUS_CHANGE/ASSIGNMENT/VERIFICATION） */
  type: "COMMENT" | "STATUS_CHANGE" | "ASSIGNMENT" | "VERIFICATION";
  /** 关联视点 ID（可选） */
  viewpointId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 豁免 DTO（D37.11 §关闭/豁免）
 * 对应实体：Waiver（范围/期限/批准人，过期自动回待审）
 */
export interface WaiverDto {
  id: string;
  issueId: string;
  /** 豁免范围（影响的设计元素/区域） */
  scope: string;
  /** 豁免理由（依据规范条文或设计决策） */
  justification: string;
  /** 豁免期限（到期时间） */
  expiresAt: string;
  /** 补偿控制（替代措施，确保安全/合规不受影响） */
  compensatingControl?: string | null;
  /** 签审角色（如 "Principal Engineer" / "Fire Safety Reviewer"） */
  approvalRole: string;
  /** 状态 */
  status: WaiverStatus;
  /** 申请人 */
  requestedBy: string;
  /** 申请时间 */
  requestedAt: string;
  /** 审批人 */
  approvedBy?: string | null;
  /** 审批时间 */
  approvedAt?: string | null;
  /** 拒绝原因 */
  rejectionReason?: string | null;
  /** 撤销原因 */
  revocationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

// ── 请求 DTO ──

/**
 * 列出碰撞检测运行请求
 * projectId 通过 hook 参数 + URL 路径传入
 */
export interface ListClashRunsRequest {
  status?: ClashRunStatus;
  checkType?: CoordinationCheckType;
  /** 是否只返回最新的 Run */
  latestOnly?: boolean;
}

/**
 * 列出 Finding 请求
 */
export interface ListFindingsRequest {
  runId: string;
  severity?: CoordinationFindingSeverity;
  status?: CoordinationFindingStatus;
  clusterId?: string;
  /** 关键词搜索（构件名称/规则编号） */
  keyword?: string;
  /** 仅未聚类 */
  unclusteredOnly?: boolean;
  page?: number;
  pageSize?: number;
  sort?: "severity" | "createdAt" | "ruleCode";
  order?: "asc" | "desc";
}

/**
 * 列出 Cluster 请求
 */
export interface ListClustersRequest {
  runId: string;
  status?: ClusterStatus;
  /** 仅未审核 */
  unreviewedOnly?: boolean;
  /** 最低 AI 置信度 */
  minConfidence?: number;
  page?: number;
  pageSize?: number;
}

/**
 * 创建 ClashRun 请求
 */
export interface CreateClashRunRequest {
  projectId: string;
  name: string;
  checkType: CoordinationCheckType;
  ruleIds: string[];
  sourceModelVersions: Record<string, string>;
}

/**
 * 创建 Issue 请求（从 Finding/Cluster 创建）
 */
export interface CreateIssueFromFindingRequest {
  projectId: string;
  /** 来源 Finding ID（与 clusterId 二选一） */
  findingId?: string;
  /** 来源 Cluster ID（与 findingId 二选一） */
  clusterId?: string;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  /** 关联视点（可选） */
  viewpoint?: {
    selection: string[];
    snapshot?: string;
    label?: string;
  };
  assignee?: string;
}

/**
 * 创建 Waiver 请求
 */
export interface CreateWaiverRequest {
  issueId: string;
  scope: string;
  justification: string;
  expiresAt: string;
  compensatingControl?: string;
  approvalRole: string;
}

/**
 * 审核 Waiver 请求
 */
export interface ReviewWaiverRequest {
  waiverId: string;
  action: "APPROVE" | "REJECT";
  reason?: string;
}

/**
 * Cluster 拆分/合并请求
 */
export interface MergeClusterRequest {
  sourceClusterId: string;
  targetClusterId: string;
  reason?: string;
}

/**
 * 创建评论请求
 */
export interface CreateCommentRequest {
  issueId: string;
  content: string;
  viewpointId?: string;
}

// ── API 端点定义 ──

/**
 * Coordination API 端点
 * 基础路径：/api/v1
 *
 * V0 阶段：API 未实现，前端通过空状态展示
 * V1 阶段：Core 服务实现对应端点
 *
 * BCF Issue 端点复用 use-review.ts 中定义的路径：
 *  - GET    /api/v1/projects/{projectId}/coordination/issues
 *  - GET    /api/v1/coordination/issues/{issueId}
 *  - PATCH  /api/v1/coordination/issues/{issueId}/status
 *  - POST   /api/v1/coordination/issues/{issueId}/assign
 */
export const CoordinationApiPaths = {
  // 碰撞规则
  rules: (projectId: string) =>
    `/api/v1/projects/${projectId}/coordination/rules`,
  ruleDetail: (ruleId: string) => `/api/v1/coordination/rules/${ruleId}`,

  // 碰撞检测运行
  runs: (projectId: string) =>
    `/api/v1/projects/${projectId}/coordination/runs`,
  runDetail: (runId: string) => `/api/v1/coordination/runs/${runId}`,
  runExecute: (runId: string) => `/api/v1/coordination/runs/${runId}:execute`,
  runCancel: (runId: string) => `/api/v1/coordination/runs/${runId}:cancel`,

  // Finding
  findings: (runId: string) => `/api/v1/coordination/runs/${runId}/findings`,
  findingDetail: (findingId: string) =>
    `/api/v1/coordination/findings/${findingId}`,

  // Cluster
  clusters: (runId: string) => `/api/v1/coordination/runs/${runId}/clusters`,
  clusterDetail: (clusterId: string) =>
    `/api/v1/coordination/clusters/${clusterId}`,
  clusterApprove: (clusterId: string) =>
    `/api/v1/coordination/clusters/${clusterId}:approve`,
  clusterDismiss: (clusterId: string) =>
    `/api/v1/coordination/clusters/${clusterId}:dismiss`,
  clusterSplit: (clusterId: string) =>
    `/api/v1/coordination/clusters/${clusterId}:split`,
  clusterMerge: () => `/api/v1/coordination/clusters:merge`,

  // Issue（从 Finding/Cluster 创建）
  issueCreateFromFinding: () => `/api/v1/coordination/issues:from-finding`,
  issueLinkage: (issueId: string) =>
    `/api/v1/coordination/issues/${issueId}/linkage`,

  // Viewpoint
  viewpoints: (issueId: string) =>
    `/api/v1/coordination/issues/${issueId}/viewpoints`,

  // Comment
  comments: (issueId: string) =>
    `/api/v1/coordination/issues/${issueId}/comments`,

  // Waiver
  waivers: (issueId: string) =>
    `/api/v1/coordination/issues/${issueId}/waivers`,
  waiverReview: (waiverId: string) =>
    `/api/v1/coordination/waivers/${waiverId}:review`,

  // BCF 导入导出
  bcfImport: (projectId: string) =>
    `/api/v1/projects/${projectId}/coordination/bcf:import`,
  bcfExport: (projectId: string) =>
    `/api/v1/projects/${projectId}/coordination/bcf:export`,
} as const;
