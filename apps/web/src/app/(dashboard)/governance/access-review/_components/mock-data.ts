/**
 * Access Review Mock 数据
 *
 * V0：仅前端展示用，V1 接入 IAM Audit API 后替换
 */

export interface AccessGrantDto {
  id: string;
  /** 主体类型 */
  type: "member" | "external" | "service" | "breakglass";
  /** 主体显示名 */
  principalName: string;
  /** 主体邮箱/账号 */
  principalEmail: string;
  /** 资源标识（项目/文档/Baseline 等） */
  resource: string;
  /** 权限说明 */
  permission: string;
  /** 风险等级 */
  riskLevel: "low" | "medium" | "high" | "critical";
  /** 状态 */
  status: "active" | "pending_review" | "shortened" | "revoked" | "expired";
  /** 颁发者 */
  grantedBy: string;
  /** 颁发时间 */
  grantedAt: string;
  /** 到期时间 */
  expiresAt: string;
  /** 最后使用时间 */
  lastUsedAt?: string;
  /** Owner（负责审批/撤销） */
  owner: string;
  /** Owner 邮箱 */
  ownerEmail: string;
  /** 颁发原因 */
  reason: string;
  /** 是否需要 Step-up 重新认证 */
  requiresStepUp: boolean;
  /** 是否涉及法律保留 */
  hasLegalHold?: boolean;
  /** 传播依赖（撤权将影响哪些下游 Grant） */
  propagationDependents?: string[];
}

const now = Date.now();
const daysFromNow = (days: number) =>
  new Date(now + days * 86_400_000).toISOString();
const daysAgo = (days: number) =>
  new Date(now - days * 86_400_000).toISOString();

export const ACCESS_GRANT_MOCK: AccessGrantDto[] = [
  {
    id: "grant-001",
    type: "member",
    principalName: "张工",
    principalEmail: "zhang@example.com",
    resource: "项目 proj-001 / 全部文档",
    permission: "read/write",
    riskLevel: "medium",
    status: "active",
    grantedBy: "李设计师",
    grantedAt: daysAgo(45),
    expiresAt: daysFromNow(15),
    lastUsedAt: daysAgo(1),
    owner: "王总工",
    ownerEmail: "wang@example.com",
    reason: "V1 方案设计交付",
    requiresStepUp: false,
    propagationDependents: ["grant-002", "grant-005"],
  },
  {
    id: "grant-002",
    type: "external",
    principalName: "External Contractor - 陈结构",
    principalEmail: "chen@external.com",
    resource: "项目 proj-001 / 结构专业图纸",
    permission: "read",
    riskLevel: "high",
    status: "pending_review",
    grantedBy: "王总工",
    grantedAt: daysAgo(3),
    expiresAt: daysFromNow(5),
    lastUsedAt: daysAgo(0),
    owner: "王总工",
    ownerEmail: "wang@example.com",
    reason: "外部结构顾问协作",
    requiresStepUp: true,
    hasLegalHold: true,
    propagationDependents: [],
  },
  {
    id: "grant-003",
    type: "service",
    principalName: "CI/CD Pipeline (aidesign-builder)",
    principalEmail: "ci@aidesign.local",
    resource: "项目 proj-002 / 全部文档",
    permission: "read/write",
    riskLevel: "high",
    status: "active",
    grantedBy: "管理员",
    grantedAt: daysAgo(180),
    expiresAt: daysFromNow(2),
    lastUsedAt: daysAgo(0),
    owner: "管理员",
    ownerEmail: "admin@example.com",
    reason: "CI/CD 自动发布集成",
    requiresStepUp: true,
    propagationDependents: [],
  },
  {
    id: "grant-004",
    type: "breakglass",
    principalName: "Emergency Admin Access",
    principalEmail: "emergency@example.com",
    resource: "租户全局 / 所有项目",
    permission: "admin",
    riskLevel: "critical",
    status: "active",
    grantedBy: "Break-Glass 流程",
    grantedAt: daysAgo(0),
    expiresAt: daysFromNow(1),
    lastUsedAt: daysAgo(0),
    owner: "管理员",
    ownerEmail: "admin@example.com",
    reason: "P0 故障应急响应（INC-2026-007）",
    requiresStepUp: true,
    propagationDependents: [],
  },
  {
    id: "grant-005",
    type: "member",
    principalName: "李设计师",
    principalEmail: "li@example.com",
    resource: "项目 proj-001 / 建筑专业",
    permission: "read/write",
    riskLevel: "low",
    status: "active",
    grantedBy: "张工",
    grantedAt: daysAgo(120),
    expiresAt: daysFromNow(245),
    lastUsedAt: daysAgo(2),
    owner: "张工",
    ownerEmail: "zhang@example.com",
    reason: "项目成员默认访问",
    requiresStepUp: false,
    propagationDependents: [],
  },
  {
    id: "grant-006",
    type: "external",
    principalName: "Third-party Reviewer - 赵审",
    principalEmail: "zhao@review.com",
    resource: "项目 proj-002 / 发布包 pub-001",
    permission: "read",
    riskLevel: "medium",
    status: "expired",
    grantedBy: "李设计师",
    grantedAt: daysAgo(90),
    expiresAt: daysAgo(5),
    lastUsedAt: daysAgo(8),
    owner: "李设计师",
    ownerEmail: "li@example.com",
    reason: "第三方审阅交付",
    requiresStepUp: false,
    propagationDependents: [],
  },
  {
    id: "grant-007",
    type: "service",
    principalName: "AI Service Account",
    principalEmail: "ai-service@aidesign.local",
    resource: "租户全局 / AI Run 历史",
    permission: "read/write/execute",
    riskLevel: "critical",
    status: "active",
    grantedBy: "管理员",
    grantedAt: daysAgo(30),
    expiresAt: daysFromNow(60),
    lastUsedAt: daysAgo(0),
    owner: "管理员",
    ownerEmail: "admin@example.com",
    reason: "AI 服务账号调用",
    requiresStepUp: true,
    propagationDependents: [],
  },
];
