/**
 * 事件契约模块统一导出（P0-2.2 Event/AsyncAPI 契约）
 *
 * 覆盖 Change / Operations / Governance 域事件 + CloudEvent 信封
 * + 事件校验工具（去重/顺序/缺口/重试/DLQ/upcast）。
 *
 * 权威源：@design/D35-API-事件契约.md §D35.13/14/22/24
 */
// CloudEvent 信封（D35.13）
export {
  cloudEventSchema,
  cloudEventExtensionsSchema,
  cloudEventDataSchema,
  EVENT_CLASSIFICATION_SCHEMA,
} from "./cloud-event";
export type {
  CloudEvent,
  CloudEventExtensions,
  EventClassification,
} from "./cloud-event";

// Change 域事件（D37.16 P12）
export {
  changeRequestIdSchema,
  changeImpactLevelSchema,
  changeRequestStatusSchema,
  changeImpactDataSchema,
  changeRequestCreatedDataSchema,
  changeImpactAssessedDataSchema,
  changeRequestApprovedDataSchema,
  changeClosedDataSchema,
  buildChangeEvent,
} from "./change.events";

// Operations 域事件（D37.17 P13 + D35.14 Integration）
export {
  connectorIdSchema,
  integrationJobStatusSchema,
  connectorStatusSchema,
  connectorQualifiedDataSchema,
  integrationJobChangedDataSchema,
  artifactImportedDataSchema,
  conflictDetectedDataSchema,
  buildOperationsEvent,
} from "./operations.events";

// Governance 域事件（D35.14 Governance）
export {
  approvalDecisionSchema,
  approvalTypeSchema,
  legalHoldStatusSchema,
  approvalDecidedDataSchema,
  legalHoldChangedDataSchema,
  deletionVerifiedDataSchema,
  evidenceSealedDataSchema,
  buildGovernanceEvent,
} from "./governance.events";

// 事件校验工具（D35.22/24）
export {
  buildEventKey,
  classifyOrdering,
  detectGaps,
  isDuplicate,
  parseSchemaVersion,
  shouldRetry,
  toDlqReason,
  upcastEvent,
} from "./event-validator";
export type { DlqReason, EventOrdering } from "./event-validator";
