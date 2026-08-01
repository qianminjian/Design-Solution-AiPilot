/**
 * 协调/变更/运营域 Consumer 契约注册表（P0-2.1 HTTP/OpenAPI 契约）
 *
 * 覆盖域：coordination / change / operations
 * coordination 与 change 域 V1 zod schema 尚未实现，V0 使用 null schema
 * 软验证（仅注册契约元数据，不执行运行时校验），待 V1 schema 补齐后升级。
 *
 * 权威源：@design/D37.11 协调工作台 + @design/D37.16 变更影响与闭环工作台
 *         + @design/D37.17 运营中心
 */
import type { ConsumerExpectation } from "@design-platform/shared";
import { healthCheckResultSchema } from "@design-platform/shared";

const CONSUMER = "@design-platform/bff" as const;
const PROVIDER = "@design-platform/core" as const;

/**
 * coordination 域契约（碰撞与 Issue 工作台，V0 schema 待补齐）
 */
export const COORDINATION_EXPECTATIONS: ConsumerExpectation[] = [
  {
    contractId: "coordination-issues-list-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "coordination",
    method: "GET",
    path: "/api/v1/coordination/issues",
    description: "协调 Issue 列表",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "coordination-issue-create-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "coordination",
    method: "POST",
    path: "/api/v1/coordination/issues",
    description: "创建协调 Issue",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
];

/**
 * change 域契约（变更影响与闭环工作台，V0 schema 待补齐）
 */
export const CHANGE_EXPECTATIONS: ConsumerExpectation[] = [
  {
    contractId: "change-request-list-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "change",
    method: "GET",
    path: "/api/v1/change/requests",
    description: "变更请求列表",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "change-request-create-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "change",
    method: "POST",
    path: "/api/v1/change/requests",
    description: "创建变更请求",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "change-request-impact-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "change",
    method: "GET",
    path: "/api/v1/change/requests/:id/impact",
    description: "变更影响分析结果",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
];

/**
 * operations 域契约（连接器 + 队列 + Worker + 动作审批）
 */
export const OPERATIONS_EXPECTATIONS: ConsumerExpectation[] = [
  {
    contractId: "operations-connectors-list-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "operations",
    method: "GET",
    path: "/api/v1/operations/connectors",
    description: "连接器列表",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "operations-connector-register-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "operations",
    method: "POST",
    path: "/api/v1/operations/connectors/register",
    description: "注册连接器",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "operations-queue-list-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "operations",
    method: "GET",
    path: "/api/v1/operations/queue/tasks",
    description: "队列任务列表",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "operations-workers-list-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "operations",
    method: "GET",
    path: "/api/v1/operations/workers",
    description: "Worker 列表",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "operations-actions-list-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "operations",
    method: "GET",
    path: "/api/v1/operations/actions",
    description: "运营动作列表（含双审批状态）",
    requestSchema: null,
    responseSchema: null,
    strictness: "soft",
    version: "1.0.0",
  },
  {
    contractId: "operations-health-v1",
    consumer: CONSUMER,
    provider: PROVIDER,
    domain: "operations",
    method: "GET",
    path: "/api/v1/health",
    description: "服务健康检查",
    requestSchema: null,
    responseSchema: healthCheckResultSchema,
    strictness: "soft",
    version: "1.0.0",
  },
];

/** 协调/变更/运营域注册表 */
export const OPS_REGISTRY: ConsumerExpectation[] = [
  ...COORDINATION_EXPECTATIONS,
  ...CHANGE_EXPECTATIONS,
  ...OPERATIONS_EXPECTATIONS,
];
