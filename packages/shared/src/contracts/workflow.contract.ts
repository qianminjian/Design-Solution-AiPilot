/**
 * Workflow 域 API 契约
 * 权威源：@design/D05-全流程阶段-阶段门.md + @design/D34-数据-数据库.md §D34.5 + @design/D35-API-事件契约.md
 *
 * 聚焦阶段实例流转、门禁决策、基线冻结三个核心子域。
 * 实体 DTO 与枚举从 portfolio.contract.ts 复用（同一份数据库表），本文件补充 workflow 域特有的 API 路径与查询请求。
 *
 * V0 阶段裁剪（D05.18）：G0、G1、轻量 G2、G5、G6、G7
 */

// ── 类型与常量从 portfolio 契约复用（同一份数据库表，避免重复定义）──
export type {
  ProjectStatus,
  BuildingType,
  StageStatus,
  GateStatus,
  GateDecision,
  RevisionStatus,
  StageCode,
  GateCode,
} from "./portfolio.contract";

export {
  StageCode as StageCodeConst,
  GateCode as GateCodeConst,
} from "./portfolio.contract";

export type {
  StageInstanceDto,
  GateDecisionDto,
  ProjectBaselineDto,
  TransitionStageRequest,
  FreezeBaselineRequest,
  DecideGateRequest,
} from "./portfolio.contract";

// ── 从 portfolio 契约导入类型用于本文件内引用 ──
import type {
  StageStatus,
  GateStatus,
  GateDecision,
  StageCode,
} from "./portfolio.contract";

// ── workflow 域特有请求 DTO ──

/**
 * 列出阶段实例请求
 * 对应契约：workflow.stage.list（GET /api/v1/projects/{projectId}/stages）
 *
 * projectId 作为路径参数，其余为可选 query 过滤。
 */
export interface ListStageInstancesRequest {
  /** 项目 ID（必填，作为路径参数） */
  projectId: string;
  /** 阶段状态过滤 */
  status?: StageStatus;
  /** 阶段编码过滤（如 STG-P0） */
  stageCode?: StageCode;
}

/**
 * 列出门禁决策请求
 * 对应契约：workflow.gate.list（GET /api/v1/stages/{stageId}/gates）
 *
 * stageId 作为路径参数，其余为可选 query 过滤。
 */
export interface ListGateDecisionsRequest {
  /** 阶段实例 ID（必填，作为路径参数） */
  stageId: string;
  /** 门禁状态过滤 */
  status?: GateStatus;
  /** 决策结论过滤 */
  decision?: GateDecision;
}

// ── API 端点定义 ──

/**
 * Workflow API 端点
 * 基础路径：/api/v1/workflow
 *
 * workflow 域独立路径前缀，避免与 portfolio 域路径冲突。
 * 自定义动作采用 Google AIP 风格（:transition / :decide / :freeze）。
 * 列表端点通过 query 参数过滤（projectId / stageId）。
 *
 * 稳定契约 ID 见 @design/r2-contract-catalog/
 */
export const WorkflowApiPaths = {
  // 阶段实例
  /** 列出项目下所有阶段实例（按 stageOrder 升序） */
  stages: (projectId: string) =>
    `/api/v1/workflow/stages?projectId=${projectId}`,
  /** 阶段状态流转（按阶段 ID 直达） */
  stageTransition: (stageId: string) =>
    `/api/v1/workflow/stages/${stageId}:transition`,
  /** 列出阶段关联的门禁决策 */
  stageGates: (stageId: string) => `/api/v1/workflow/gates?stageId=${stageId}`,
  // 门禁决策
  /** 提交门禁决策 */
  gateDecision: (gateId: string) => `/api/v1/workflow/gates/${gateId}:decide`,
  // 项目基线
  /** 列出项目下所有基线（按版本号降序） */
  baselines: (projectId: string) =>
    `/api/v1/workflow/baselines?projectId=${projectId}`,
  /** 冻结基线（按基线 ID 直达，先创建草稿后冻结两步式） */
  baselineFreeze: (baselineId: string) =>
    `/api/v1/workflow/baselines/${baselineId}:freeze`,
  /** 查询基线详情 */
  baseline: (baselineId: string) => `/api/v1/workflow/baselines/${baselineId}`,
} as const;
