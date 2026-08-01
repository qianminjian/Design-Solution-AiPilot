/**
 * Pact 契约测试基础设施统一导出（P0-1.3）
 *
 * 用途：
 *  - BFF/前端通过此模块统一引用 Consumer 期望声明与软验证工具
 *  - V2 Pact Broker 接入时替换为 Pact V3 SDK
 *
 * 权威源：@design/D45-测试-验收体系.md §D45.11 HTTP/OpenAPI 契约
 */
export type {
  ConsumerExpectation,
  ContractRegistryStats,
  PactInteractionType,
  PactValidationResult,
  PactValidationStrictness,
} from "./types";

export {
  ContractValidationError,
  DEFAULT_STRICTNESS,
  isWriteOperation,
  validateRequest,
  validateResponse,
} from "./contract-validator";
