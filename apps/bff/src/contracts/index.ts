/**
 * BFF Consumer 契约模块统一导出（P0-2.1 HTTP/OpenAPI 契约）
 *
 * 提供 12 个业务域的 ConsumerExpectation 注册表与查询/统计接口。
 * V1 策略：zod schema 软验证（复用 packages/shared 的 schemas）。
 * V2 演进：基于注册表自动生成 Pact V3 契约文件并 push 到 Broker。
 *
 * 权威源：@design/D45-测试-验收体系.md §D45.11
 */
export type { ContractDomain } from "./contract-registry";
export {
  CONTRACT_DOMAINS,
  CONTRACT_REGISTRY,
  getExpectation,
  getExpectationsByDomain,
  getRegistryStats,
  validateRegistry,
} from "./contract-registry";

// 按域分组的注册表（便于按域单独引用）
export { CORE_REGISTRY } from "./registry/core.registry";
export { AI_TEVV_REGISTRY } from "./registry/ai-tevv.registry";
export { OPS_REGISTRY } from "./registry/ops.registry";
