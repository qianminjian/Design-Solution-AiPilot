/**
 * Workflow 域 Zod Schema
 *
 * 权威源：@design/D05-全流程阶段-阶段门.md + @design/D34-数据-数据库.md §D34.5 + @design/D35-API-事件契约.md
 * 对齐：packages/shared/src/contracts/workflow.contract.ts
 *
 * 实体 DTO 与枚举 schema 从 portfolio.schema.ts 复用（同一份数据库表），
 * 本文件补充 workflow 域特有的请求 schema。
 *
 * 用途：
 *  - BFF 代理层验证阶段实例流转、门禁决策、基线冻结请求体
 *  - 前端运行时验证列表查询参数
 */
import { z } from "zod";
import {
  stageStatusSchema,
  gateStatusSchema,
  gateDecisionSchema,
  stageCodeSchema,
} from "./portfolio.schema";

// ── schema 从 portfolio.schema.ts 复用（同一份数据库表，避免重复定义）──
export {
  projectStatusSchema,
  buildingTypeSchema,
  stageStatusSchema,
  gateStatusSchema,
  gateDecisionSchema,
  revisionStatusSchema,
  stageCodeSchema,
  gateCodeSchema,
  projectDtoSchema,
  stageInstanceDtoSchema,
  gateDecisionDtoSchema,
  projectBaselineDtoSchema,
  createProjectRequestSchema,
  updateProjectRequestSchema,
  listProjectsRequestSchema,
  transitionStageRequestSchema,
  freezeBaselineRequestSchema,
  decideGateRequestSchema,
} from "./portfolio.schema";

// ── workflow 域特有请求 DTO ──

/**
 * 列出阶段实例请求 schema
 * 对应契约：workflow.stage.list（GET /api/v1/projects/{projectId}/stages）
 */
export const listStageInstancesRequestSchema = z.object({
  /** 项目 ID（必填，作为路径参数） */
  projectId: z.string().uuid(),
  /** 阶段状态过滤 */
  status: stageStatusSchema.optional(),
  /** 阶段编码过滤（如 STG-P0） */
  stageCode: stageCodeSchema.optional(),
});

/**
 * 列出门禁决策请求 schema
 * 对应契约：workflow.gate.list（GET /api/v1/stages/{stageId}/gates）
 */
export const listGateDecisionsRequestSchema = z.object({
  /** 阶段实例 ID（必填，作为路径参数） */
  stageId: z.string().uuid(),
  /** 门禁状态过滤 */
  status: gateStatusSchema.optional(),
  /** 决策结论过滤 */
  decision: gateDecisionSchema.optional(),
});
