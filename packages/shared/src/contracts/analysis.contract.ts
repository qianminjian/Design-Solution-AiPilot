/**
 * Analysis 域 API 契约（D37.14 P10 工程分析运行与结果质量）
 *
 * 权威源：@design/D37-关键界面-交互状态.md §D37.14 P10 工程分析运行与结果质量
 *         @design/D33-工程分析模型.md（待定义）
 *
 * 后端实现状态（2026-07-29）：
 *  - Core Service 已实现 5 个 Controller：AnalysisProblemController /
 *    AnalysisScenarioController / SimulationRunController /
 *    AnalysisResultController / SolverProfileController
 *  - 路径与 BFF AnalysisProxyController（@Controller("v1/analysis") + 全局前缀 /api）
 *    完全对齐，前端通过 AnalysisApiPaths 直连 BFF 代理
 *  - 后端非 2xx 响应原样透传（保留 errorCode/message/traceId）
 *
 * 实体关系（对齐 D37.14）：
 *  AnalysisProblem（工程分析问题：结构 / 风 / 热 / 日照 / 能耗 等）
 *    └── AnalysisInput（输入：假设 / BC / Load / 材料 / 网格）
 *    └── AnalysisScenario（场景：参数组合 + 求解器配置）
 *          └── SimulationRun（运行实例：队列 / 进度 / 收敛 / 成本）
 *                └── AnalysisResult（结果包：变量 / case / time / 空间分层）
 *                      └── ResultQualityAssessment（质量评估：reviewer / 证据 / 决策）
 */

// ── 枚举 ──

/**
 * 分析问题类型
 * - STRUCTURAL: 结构分析（抗震 / 挠度 / 承载力）
 * - WIND: 风工程（风荷载 / 风环境）
 * - THERMAL: 热工（传热 / 结露）
 * - ENERGY: 能耗（能耗模拟 / 碳排放）
 * - LIGHTING: 光环境（采光 / 眩光）
 * - ACOUSTIC: 声环境（隔声 / 混响）
 * - DAYLIGHT: 日照分析
 * - FIRE: 消防（烟气模拟 / 疏散）
 * - GEOTECHNICAL: 岩土（沉降 / 承载）
 * - OTHER: 其他
 */
export type AnalysisProblemType =
  | "STRUCTURAL"
  | "WIND"
  | "THERMAL"
  | "ENERGY"
  | "LIGHTING"
  | "ACOUSTIC"
  | "DAYLIGHT"
  | "FIRE"
  | "GEOTECHNICAL"
  | "OTHER";

/**
 * 问题状态
 * - DRAFT: 草稿（输入未完成）
 * - READY: 就绪（可运行）
 * - RUNNING: 运行中
 * - COMPLETED: 已完成（结果待审查）
 * - REVIEWED: 已审查
 * - INVALID: 失效（输入过期 / Baseline 变化）
 */
export type ProblemStatus =
  "DRAFT" | "READY" | "RUNNING" | "COMPLETED" | "REVIEWED" | "INVALID";

/**
 * 运行状态
 * - QUEUED: 排队中
 * - LICENSING: 等待许可证
 * - PREPARING: 准备环境
 * - RUNNING: 运行中
 * - POST_PROCESSING: 后处理
 * - CONVERGED: 收敛
 * - DIVERGED: 发散
 * - CANCELLED: 已取消
 * - FAILED: 失败
 * - UNKNOWN: 未知（需 Reconcile）
 */
export type RunStatus =
  | "QUEUED"
  | "LICENSING"
  | "PREPARING"
  | "RUNNING"
  | "POST_PROCESSING"
  | "CONVERGED"
  | "DIVERGED"
  | "CANCELLED"
  | "FAILED"
  | "UNKNOWN";

/**
 * 结果质量状态
 * - PENDING: 待审查
 * - VALID: 有效
 * - QUESTIONABLE: 可疑（需复核）
 * - INVALID: 无效
 * - SUPERSEDED: 已被新结果取代
 */
export type ResultQualityStatus =
  "PENDING" | "VALID" | "QUESTIONABLE" | "INVALID" | "SUPERSEDED";

/**
 * 收敛状态
 * - CONVERGED: 已收敛
 * - DIVERGED: 发散
 * - IN_PROGRESS: 进行中
 * - NOT_STARTED: 未开始
 */
export type ConvergenceStatus =
  "CONVERGED" | "DIVERGED" | "IN_PROGRESS" | "NOT_STARTED";

/**
 * 质量决策
 * - ACCEPT_AS_DRAFT: 接受为草稿
 * - ACCEPT_AS_REVISION: 接受为修订
 * - REJECT: 拒绝
 * - ESCALATE: 上报
 * - EXCEPTION: 例外批准
 */
export type QualityDecision =
  | "ACCEPT_AS_DRAFT"
  | "ACCEPT_AS_REVISION"
  | "REJECT"
  | "ESCALATE"
  | "EXCEPTION";

// ── DTO ──

/**
 * 工程分析问题
 */
export interface AnalysisProblemDto {
  id: string;
  code: string;
  title: string;
  type: AnalysisProblemType;
  status: ProblemStatus;
  description: string;
  projectId: string;
  projectName: string;
  baselineId: string;
  baselineHash: string;
  owner: string;
  ownerRole: string;
  createdAt: string;
  updatedAt: string;
  /** 输入完整性百分比 */
  inputCompleteness: number;
  /** 假设条目数 */
  assumptionCount: number;
  /** 边界条件数 */
  boundaryConditionCount: number;
  /** 荷载工况数 */
  loadCaseCount: number;
  /** 已运行次数 */
  runCount: number;
  /** 最近运行 ID */
  latestRunId?: string;
  /** 最近运行状态 */
  latestRunStatus?: RunStatus;
  /** 最近结果质量状态 */
  latestResultQuality?: ResultQualityStatus;
  /** 是否需要人工复核 */
  requiresHumanReview: boolean;
  /** AI 辅助标记 */
  isAiAssisted: boolean;
}

/**
 * 创建工程分析问题请求（对齐后端 CreateAnalysisProblemRequest）
 */
export interface CreateAnalysisProblemRequest {
  title: string;
  description?: string;
  type: AnalysisProblemType;
  projectId: string;
  projectName?: string;
  baselineId?: string;
  baselineHash?: string;
  owner: string;
  ownerRole: string;
  inputCompleteness?: number;
  assumptionCount?: number;
  boundaryConditionCount?: number;
  loadCaseCount?: number;
}

/**
 * 标记工程分析问题失效请求（对齐后端 InvalidateProblemRequest）
 *
 * 安全红线：invalidate 为高风险动作，需 stepUpToken 二次认证。
 */
export interface InvalidateProblemRequest {
  reason: string;
  stepUpToken?: string;
}

/**
 * 分析输入条目（假设 / BC / Load 通用）
 */
export interface AnalysisInputItemDto {
  id: string;
  /** 条目类型：assumption / boundaryCondition / load / material / mesh */
  category: "assumption" | "boundaryCondition" | "load" | "material" | "mesh";
  name: string;
  value: string;
  unit: string;
  source: string;
  /** 来源 hash（用于变更检测） */
  sourceHash: string;
  /** 是否为 AI 推荐 */
  isAiRecommended: boolean;
  /** 备注 */
  remark?: string;
}

/**
 * 分析场景
 *
 * V0 阶段：保留前端字段（meshDensity/timeStep/tolerance/maxIterations 等），
 * 后端 AnalysisScenarioDto 与 AnalysisScenario 实体需要对齐本契约。
 * parameters 为结构化数组（key/value/unit），由后端 jsonb 列持久化与序列化。
 */
export interface AnalysisScenarioDto {
  id: string;
  problemId: string;
  name: string;
  description: string;
  /** 求解器配置 ID */
  solverProfileId: string;
  solverProfileName: string;
  /** 网格密度 */
  meshDensity: "coarse" | "medium" | "fine" | "very_fine";
  /** 时间步长 */
  timeStep?: string;
  /** 总时长 */
  totalTime?: string;
  /** 收敛容差 */
  tolerance: string;
  /** 最大迭代数 */
  maxIterations: number;
  /** 是否推荐 */
  isRecommended: boolean;
  /** 参数组合（key-value） */
  parameters: Array<{ key: string; value: string; unit: string }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * 创建分析场景请求
 */
export interface CreateAnalysisScenarioRequest {
  name: string;
  description?: string;
  /** 场景类型（如：基础/对比/参数研究） */
  scenarioType: string;
  /** 求解器配置 ID */
  solverProfileId: string;
  /** 网格密度 */
  meshDensity: "coarse" | "medium" | "fine" | "very_fine";
  /** 时间步长 */
  timeStep?: string;
  /** 总时长 */
  totalTime?: string;
  /** 收敛容差 */
  tolerance: string;
  /** 最大迭代数 */
  maxIterations: number;
  /** 参数组合 */
  parameters?: Array<{ key: string; value: string; unit: string }>;
}

/**
 * 求解器配置
 *
 * V0 阶段：保留前端字段（licenseType/available/estimatedCost/estimatedDurationMin），
 * 后端 SolverProfile 实体与 SolverProfileDto 需要对齐本契约。
 */
export interface SolverProfileDto {
  id: string;
  name: string;
  version: string;
  /** 求解器类型 */
  solverType: string;
  /** 许可证类型 */
  licenseType: "floating" | "node_locked" | "cloud";
  /** 是否可用 */
  available: boolean;
  /** 估算单次运行成本（单位：元） */
  estimatedCost: number;
  /** 估算运行时长（分钟） */
  estimatedDurationMin: number;
}

/**
 * 运行时间线事件
 */
export interface RunTimelineEventDto {
  id: string;
  runId: string;
  timestamp: string;
  /** 事件类型 */
  type:
    | "queued"
    | "license_acquired"
    | "preparing"
    | "solver_started"
    | "checkpoint"
    | "iteration"
    | "converged"
    | "diverged"
    | "post_processing"
    | "completed"
    | "failed"
    | "cancelled"
    | "log"
    | "warning"
    | "error";
  /** 消息 */
  message: string;
  /** 迭代号 */
  iteration?: number;
  /** 残差值 */
  residual?: number;
  /** 详情 */
  detail?: string;
}

/**
 * 收敛指标
 *
 * 注：后端 ConvergenceMetric 实体的 history 字段为 jsonb 字符串，
 * DTO 序列化时会自动转为数组。前端按 number[] 处理。
 */
export interface ConvergenceMetricDto {
  id: string;
  runId: string;
  /** 指标名称 */
  name: string;
  /** 指标类型 */
  type: "residual" | "balance" | "error" | "other";
  /** 当前值 */
  currentValue: number;
  /** 目标值 */
  targetValue: number;
  /** 是否收敛 */
  converged: boolean;
  /** 历史值（迭代序列） */
  history: number[];
}

/**
 * 模拟运行（对齐后端 SimulationRunDto）
 */
export interface SimulationRunDto {
  id: string;
  problemId: string;
  scenarioId: string;
  solverProfileId: string;
  solverProfileName?: string;
  status: RunStatus;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  /** 求解器实际运行版本 */
  solverVersion?: string;
  /** 实际耗时（秒） */
  actualDurationSec?: number;
  /** 实际成本（单位：元） */
  actualCost?: number;
  /** 失败原因（FAILED 时填充） */
  failureReason?: string;
  /** 重试次数（retry storm 检测依据） */
  retryCount: number;
  /** 上游运行 ID（重试链） */
  parentRunId?: string;
  /** 是否为 unknown job（需 Reconcile） */
  isUnknownJob: boolean;
  cancelledBy?: string;
  cancelReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 创建模拟运行请求（对齐后端 CreateSimulationRunRequest）
 */
export interface CreateSimulationRunRequest {
  problemId: string;
  scenarioId: string;
  solverProfileId: string;
  solverVersion?: string;
}

/**
 * 取消运行请求（对齐后端 CancelRunRequest）
 *
 * 安全红线：cancel 为高风险动作，需 stepUpToken 二次认证。
 */
export interface CancelRunRequest {
  reason: string;
  stepUpToken?: string;
}

/**
 * 分析结果
 */
export interface AnalysisResultDto {
  id: string;
  runId: string;
  problemId: string;
  /** 结果包名称 */
  name: string;
  /** 质量状态 */
  qualityStatus: ResultQualityStatus;
  /** 生成时间 */
  generatedAt: string;
  /** 文件大小（MB） */
  sizeMb: number;
  /** 包含变量列表 */
  variables: string[];
  /** 包含 case 列表 */
  cases: string[];
  /** 时间步数 */
  timeSteps: number;
  /** 空间网格点数 */
  spatialPoints: number;
  /** 关键指标摘要 */
  metrics: Array<{
    name: string;
    value: number;
    unit: string;
    /** 是否在阈值内 */
    withinThreshold: boolean;
    /** 阈值 */
    threshold?: number;
  }>;
  /** Benchmark 对比 */
  benchmarkComparison?: {
    benchmarkName: string;
    deviationPercent: number;
    passed: boolean;
  };
  /** 下载 URL（V0 占位） */
  downloadUrl?: string;
  /** 是否被 superseded */
  supersededBy?: string;
}

/**
 * 质量评估
 */
export interface ResultQualityAssessmentDto {
  id: string;
  resultId: string;
  /** 评估人 */
  reviewer: string;
  reviewerRole: string;
  /** 决策 */
  decision: QualityDecision;
  /** 评估时间 */
  assessedAt: string;
  /** 评估理由 */
  reason: string;
  /** 检查清单 */
  checklist: Array<{
    id: string;
    label: string;
    passed: boolean;
    remark?: string;
  }>;
  /** 是否需要例外批准 */
  requiresExceptionApproval: boolean;
  /** 例外批准人 */
  exceptionApprover?: string;
}

/**
 * 提交结果质量评估请求
 *
 * 安全红线：
 *  - 决策 ACCEPT_AS_REVISION/EXCEPTION 需注册师签章
 *  - 高风险决策需 stepUpToken 二次认证
 */
export interface SubmitQualityAssessmentRequest {
  decision: QualityDecision;
  /** 评估人 ID */
  reviewer: string;
  /** 评估人角色 */
  reviewerRole: string;
  /** 评估理由 */
  reason: string;
  /** 检查清单（结构化数组） */
  checklist?: Array<{
    id: string;
    label: string;
    passed: boolean;
    remark?: string;
  }>;
  /** 是否需要例外批准 */
  requiresExceptionApproval?: boolean;
  /** 例外批准人 */
  exceptionApprover?: string;
  /** stepUp 二次认证 Token（高风险决策必须） */
  stepUpToken?: string;
  /** 注册师签章 ID（ACCEPT_AS_REVISION/EXCEPTION 必须） */
  sealId?: string;
}

/**
 * 网格质量摘要
 */
export interface MeshQualityDto {
  id: string;
  problemId: string;
  /** 总单元数 */
  totalElements: number;
  /** 总节点数 */
  totalNodes: number;
  /** 最小雅可比 */
  minJacobian: number;
  /** 最大长宽比 */
  maxAspectRatio: number;
  /** 失败单元数 */
  failedElements: number;
  /** 失败率（百分比） */
  failureRate: number;
  /** 质量等级 */
  qualityGrade: "A" | "B" | "C" | "D" | "F";
}

// ── API 路径 ──

/**
 * Analysis 域 API 路径（对齐后端 Spring Controller @RequestMapping）。
 *
 * 端点 → Core Service（Java，AnalysisProblemController / AnalysisScenarioController /
 * SimulationRunController / AnalysisResultController / SolverProfileController 等）：
 *
 * AnalysisProblem 主实体（/api/v1/analysis/problems）：
 *  - GET    /                                  列出工程分析问题（支持 keyword/type/status/projectId 过滤）
 *  - POST   /                                  创建工程分析问题（草稿）
 *  - GET    /{problemId}                       问题详情
 *  - PUT    /{problemId}                       更新问题（草稿阶段）
 *  - DELETE /{problemId}                       删除草稿
 *  - POST   /{problemId}/submit                提交就绪（DRAFT → READY）
 *  - POST   /{problemId}/invalidate            标记失效（输入过期 / Baseline 变化）
 *  - GET    /{problemId}/mesh-quality          网格质量摘要
 *
 * AnalysisScenario 子实体（/api/v1/analysis/problems/{problemId}/scenarios）：
 *  - GET    /                                  场景列表
 *  - POST   /                                  创建场景
 *  - GET    /{scenarioId}                      场景详情
 *  - PUT    /{scenarioId}                      更新场景
 *  - DELETE /{scenarioId}                      删除场景
 *
 * SimulationRun 子实体（/api/v1/analysis/runs）：
 *  - GET    ?problemId=                        按问题查询运行列表
 *  - POST   /                                  创建运行（QUEUED）
 *  - GET    /{runId}                           运行详情
 *  - POST   /{runId}/cancel                    取消运行
 *  - POST   /{runId}/retry                     重试运行（未知状态触发 reconcile）
 *  - GET    /{runId}/timeline                  运行时间线
 *  - GET    /{runId}/convergence               收敛指标
 *  - GET    /{runId}/results                   运行结果列表
 *
 * AnalysisResult 子实体（/api/v1/analysis/results）：
 *  - GET    /{resultId}                        结果详情
 *  - GET    /{resultId}/quality                结果质量评估
 *  - POST   /{resultId}/quality-assessment     提交质量评估（含 decision/checklist）
 *  - POST   /{resultId}/impact-proposal        创建变更影响提案（结果 → 变更域）
 *  - POST   /{resultId}/supersede              标记结果被取代
 *
 * SolverProfile 配置（/api/v1/analysis/solver-profiles）：
 *  - GET    /                                  求解器配置列表
 *
 * 安全红线（design-constraints.md §AI 安全红线）：
 *  - 高风险动作（submit/invalidate/cancel/retry/impact-proposal）需 stepUpToken
 *  - 质量评估决策（ACCEPT_AS_REVISION/EXCEPTION）需注册师签章
 *  - AI 辅助推荐场景/参数须人工确认
 *  - 完成运行 ≠ 接受结果：须由具备资质的人员完成质量评估与接受决策
 */
export const AnalysisApiPaths = {
  // ── AnalysisProblem 主实体 ──
  /** 列出工程分析问题 */
  listProblems: "/api/v1/analysis/problems",
  /** 创建工程分析问题 */
  createProblem: "/api/v1/analysis/problems",
  /** 工程分析问题详情 */
  getProblem: (problemId: string) => `/api/v1/analysis/problems/${problemId}`,
  /** 更新工程分析问题（草稿阶段） */
  updateProblem: (problemId: string) =>
    `/api/v1/analysis/problems/${problemId}`,
  /** 删除工程分析问题草稿 */
  deleteProblem: (problemId: string) =>
    `/api/v1/analysis/problems/${problemId}`,
  /** 提交就绪（DRAFT → READY） */
  submitProblem: (problemId: string) =>
    `/api/v1/analysis/problems/${problemId}/submit`,
  /** 标记失效（输入过期 / Baseline 变化） */
  invalidateProblem: (problemId: string) =>
    `/api/v1/analysis/problems/${problemId}/invalidate`,
  /** 网格质量摘要 */
  meshQuality: (problemId: string) =>
    `/api/v1/analysis/problems/${problemId}/mesh-quality`,

  // ── AnalysisScenario 子实体 ──
  /** 场景列表 */
  listScenarios: (problemId: string) =>
    `/api/v1/analysis/problems/${problemId}/scenarios`,
  /** 创建场景 */
  createScenario: (problemId: string) =>
    `/api/v1/analysis/problems/${problemId}/scenarios`,
  /** 场景详情 */
  getScenario: (problemId: string, scenarioId: string) =>
    `/api/v1/analysis/problems/${problemId}/scenarios/${scenarioId}`,
  /** 更新场景 */
  updateScenario: (problemId: string, scenarioId: string) =>
    `/api/v1/analysis/problems/${problemId}/scenarios/${scenarioId}`,
  /** 删除场景 */
  deleteScenario: (problemId: string, scenarioId: string) =>
    `/api/v1/analysis/problems/${problemId}/scenarios/${scenarioId}`,

  // ── SimulationRun 子实体 ──
  /** 运行列表（按 problemId 过滤） */
  listRuns: "/api/v1/analysis/runs",
  /** 创建运行（QUEUED） */
  createRun: "/api/v1/analysis/runs",
  /** 运行详情 */
  getRun: (runId: string) => `/api/v1/analysis/runs/${runId}`,
  /** 取消运行 */
  cancelRun: (runId: string) => `/api/v1/analysis/runs/${runId}/cancel`,
  /** 重试运行（未知状态触发 reconcile） */
  retryRun: (runId: string) => `/api/v1/analysis/runs/${runId}/retry`,
  /** 运行时间线 */
  runTimeline: (runId: string) => `/api/v1/analysis/runs/${runId}/timeline`,
  /** 收敛指标 */
  runConvergence: (runId: string) =>
    `/api/v1/analysis/runs/${runId}/convergence`,
  /** 运行结果列表 */
  runResults: (runId: string) => `/api/v1/analysis/runs/${runId}/results`,

  // ── AnalysisResult 子实体 ──
  /** 结果详情 */
  getResult: (resultId: string) => `/api/v1/analysis/results/${resultId}`,
  /** 结果质量评估 */
  resultQuality: (resultId: string) =>
    `/api/v1/analysis/results/${resultId}/quality`,
  /** 提交质量评估 */
  submitQualityAssessment: (resultId: string) =>
    `/api/v1/analysis/results/${resultId}/quality-assessment`,
  /** 创建变更影响提案 */
  createImpactProposal: (resultId: string) =>
    `/api/v1/analysis/results/${resultId}/impact-proposal`,
  /** 标记结果被取代 */
  supersedeResult: (resultId: string) =>
    `/api/v1/analysis/results/${resultId}/supersede`,

  // ── SolverProfile 配置 ──
  /** 求解器配置列表 */
  listSolverProfiles: "/api/v1/analysis/solver-profiles",
} as const;
