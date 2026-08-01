/**
 * 核心域 Consumer 契约注册表（P0-2.1 HTTP/OpenAPI 契约）
 *
 * 覆盖域：auth / iam / portfolio / workflow / cde
 * 每个 ConsumerExpectation 对应一个 BFF 代理端点对 Core Service 的契约期望。
 *
 * 权威源：@design/D35-API-事件契约.md + @design/D39-身份多租户-授权.md
 *         + @design/D37.1 项目组合与阶段门
 */
import type { ConsumerExpectation } from "@design-platform/shared";
import {
  authContextSchema,
  changePasswordRequestSchema,
  createDocumentRequestSchema,
  createProjectRequestSchema,
  documentDtoSchema,
  documentVersionDtoSchema,
  gateDecisionDtoSchema,
  listDocumentsRequestSchema,
  listProjectsRequestSchema,
  loginRequestSchema,
  loginResponseSchema,
  logoutResponseSchema,
  projectDtoSchema,
  refreshTokenResponseSchema,
  updateProjectRequestSchema,
  uploadVersionRequestSchema,
} from "@design-platform/shared";

const CONSUMER = "@design-platform/bff" as const;
const PROVIDER = "@design-platform/core" as const;

/**
 * auth 域契约（安全关键端点 strict，其余 soft）
 *
 * 安全红线（security.md §2.2）：
 *  - login/refresh 响应结构错误将导致前端无法登录，使用 strict 级别
 */
export const AUTH_EXPECTATIONS: ConsumerExpectation[] = [
  {
    contractId: "auth-login-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "auth",
    method: "POST",
    path: "/api/v1/auth/login",
    description: "用户登录",
    requestSchema: loginRequestSchema,
    responseSchema: loginResponseSchema,
    strictness: "strict",
    version: "1.0.0",
  },
  {
    contractId: "auth-refresh-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "auth",
    method: "POST",
    path: "/api/v1/auth/refresh",
    description: "刷新 access token",
    requestSchema: null,
    responseSchema: refreshTokenResponseSchema,
    strictness: "strict",
    version: "1.0.0",
  },
  {
    contractId: "auth-me-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "auth",
    method: "GET",
    path: "/api/v1/auth/me",
    description: "当前登录用户上下文",
    requestSchema: null,
    responseSchema: authContextSchema,
    strictness: "strict",
    version: "1.0.0",
  },
  {
    contractId: "auth-logout-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "auth",
    method: "POST",
    path: "/api/v1/auth/logout",
    description: "用户登出",
    requestSchema: null,
    responseSchema: logoutResponseSchema,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "auth-change-password-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "auth",
    method: "POST",
    path: "/api/v1/auth/change-password",
    description: "修改密码",
    requestSchema: changePasswordRequestSchema,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
];

/**
 * iam 域契约（V1 API Token 已实现，A-62~A-64）
 */
export const IAM_EXPECTATIONS: ConsumerExpectation[] = [
  {
    contractId: "iam-token-list-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "iam",
    method: "GET",
    path: "/api/v1/iam/tokens",
    description: "API Token 列表",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "iam-token-create-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "iam",
    method: "POST",
    path: "/api/v1/iam/tokens",
    description: "创建 API Token",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "iam-preferences-get-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "iam",
    method: "GET",
    path: "/api/v1/iam/preferences",
    description: "查询用户偏好设置",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "iam-preferences-update-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "iam",
    method: "PUT",
    path: "/api/v1/iam/preferences",
    description: "更新用户偏好设置",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
];

/**
 * portfolio 域契约（项目组合 + 阶段门 + 基线）
 */
export const PORTFOLIO_EXPECTATIONS: ConsumerExpectation[] = [
  {
    contractId: "portfolio-project-create-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "portfolio",
    method: "POST",
    path: "/api/v1/projects",
    description: "创建项目",
    requestSchema: createProjectRequestSchema,
    responseSchema: projectDtoSchema,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "portfolio-project-list-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "portfolio",
    method: "GET",
    path: "/api/v1/projects",
    description: "项目列表（分页）",
    requestSchema: listProjectsRequestSchema,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "portfolio-project-update-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "portfolio",
    method: "PUT",
    path: "/api/v1/projects/:id",
    description: "更新项目",
    requestSchema: updateProjectRequestSchema,
    responseSchema: projectDtoSchema,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "portfolio-stage-instance-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "portfolio",
    method: "GET",
    path: "/api/v1/projects/:id/stages",
    description: "项目阶段实例列表",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "portfolio-gate-decision-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "portfolio",
    method: "GET",
    path: "/api/v1/projects/:id/gates",
    description: "阶段门决策列表",
    requestSchema: null,
    responseSchema: gateDecisionDtoSchema,
    strictness: "soft",
    version: "1.0.0",
  },
];

/**
 * workflow 域契约（阶段实例 + 阶段门工作流）
 */
export const WORKFLOW_EXPECTATIONS: ConsumerExpectation[] = [
  {
    contractId: "workflow-stage-instances-list-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "workflow",
    method: "GET",
    path: "/api/v1/workflow/stage-instances",
    description: "阶段实例列表",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "workflow-gate-decisions-list-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "workflow",
    method: "GET",
    path: "/api/v1/workflow/gate-decisions",
    description: "阶段门决策列表",
    requestSchema: null,
    responseSchema: gateDecisionDtoSchema,
    strictness: "soft",
    version: "1.0.0",
  },
];

/**
 * cde 域契约（文档 + 版本 + 检出/检入）
 */
export const CDE_EXPECTATIONS: ConsumerExpectation[] = [
  {
    contractId: "cde-document-create-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "cde",
    method: "POST",
    path: "/api/v1/cde/documents",
    description: "创建文档",
    requestSchema: createDocumentRequestSchema,
    responseSchema: documentDtoSchema,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "cde-document-list-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "cde",
    method: "GET",
    path: "/api/v1/cde/documents",
    description: "文档列表",
    requestSchema: listDocumentsRequestSchema,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "cde-document-version-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "cde",
    method: "GET",
    path: "/api/v1/cde/documents/:id/versions",
    description: "文档版本列表",
    requestSchema: null,
    responseSchema: documentVersionDtoSchema,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "cde-version-upload-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "cde",
    method: "POST",
    path: "/api/v1/cde/documents/:id/versions",
    description: "上传新版本",
    requestSchema: uploadVersionRequestSchema,
    responseSchema: documentVersionDtoSchema,
    strictness: "soft",
    version: "1.0.0",
  },
];

/** core 域注册表：核心 5 域全部契约 */
export const CORE_REGISTRY: ConsumerExpectation[] = [
  ...AUTH_EXPECTATIONS,
  ...IAM_EXPECTATIONS,
  ...PORTFOLIO_EXPECTATIONS,
  ...WORKFLOW_EXPECTATIONS,
  ...CDE_EXPECTATIONS,
];
