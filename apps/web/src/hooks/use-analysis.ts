"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AnalysisProblemDto,
  AnalysisResultDto,
  AnalysisScenarioDto,
  ConvergenceMetricDto,
  CreateAnalysisProblemRequest,
  CreateAnalysisScenarioRequest,
  CreateSimulationRunRequest,
  InvalidateProblemRequest,
  MeshQualityDto,
  OffsetPageResponse,
  ResultQualityAssessmentDto,
  RunTimelineEventDto,
  SubmitQualityAssessmentRequest,
  SimulationRunDto,
  SolverProfileDto,
} from "@design-platform/shared";
import { AnalysisApiPaths } from "@design-platform/shared";
import { useMemo } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api-client";

/**
 * Analysis 域 hooks（V0 阶段，P10 工程分析运行与结果质量 D37.14）
 *
 * 后端 AnalysisProblem / Scenario / Run / Result / SolverProfile API 已实现，
 * 前端通过这些 hooks 调用真实端点；当 API 返回 404 / 501 时组件显示空状态。
 *
 * 对齐 D37.14 设计规格：
 *  - Problem/Input/Scenario tabs
 *  - Run monitor
 *  - Result Viewer/Chart/Table
 *  - Quality/Evidence rail
 *
 * 安全红线（design-constraints.md §AI 安全红线 + D37.14 §主动作）：
 *  - 高风险动作（submit/invalidate/cancel/retry/impact-proposal）需 stepUpToken
 *  - 质量评估决策（ACCEPT_AS_REVISION/EXCEPTION）需注册师签章
 *  - AI 辅助推荐场景/参数须人工确认
 *  - 完成运行 ≠ 接受结果：质量评估须由具备资质的人员完成
 */

const ANALYSIS_QUERY_KEY = ["analysis"] as const;

/** 判断 API 是否为"未实现"错误（404 / 501） */
function isNotImplementedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  return status === 404 || status === 501;
}

/**
 * 将后端 PageResponse.data（{ list, total, page, pageSize, hasMore }）
 * 适配为前端 OffsetPageResponse（{ items, total, page, pageSize, hasMore }）
 *
 * 兼容两种字段名：list（Java PageResponse）与 items（前端契约）。
 * 后端 BFF 纯透传模式下，字段名以 list 为准。
 */
function adaptPage<T>(
  payload:
    | {
        list?: T[];
        items?: T[];
        total?: number;
        page?: number;
        pageSize?: number;
        hasMore?: boolean;
      }
    | null
    | undefined,
): OffsetPageResponse<T> {
  if (!payload) {
    return { items: [], total: 0, page: 1, pageSize: 20, hasMore: false };
  }
  const items = payload.list ?? payload.items ?? [];
  return {
    items,
    total: payload.total ?? items.length,
    page: payload.page ?? 1,
    pageSize: payload.pageSize ?? items.length,
    hasMore: payload.hasMore ?? false,
  };
}

// ── AnalysisProblem 主实体 ──

/**
 * 列出工程分析问题
 * 对应契约：GET /api/v1/analysis/problems
 */
export function useAnalysisProblems(
  params: {
    keyword?: string;
    type?: string;
    status?: string;
    projectId?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  return useQuery<OffsetPageResponse<AnalysisProblemDto>>({
    queryKey: [
      ...ANALYSIS_QUERY_KEY,
      "problems",
      "list",
      {
        keyword: params.keyword ?? null,
        type: params.type ?? null,
        status: params.status ?? null,
        projectId: params.projectId ?? null,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      },
    ],
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("page", String(params.page ?? 1));
      search.set("pageSize", String(params.pageSize ?? 20));
      if (params.keyword) search.set("keyword", params.keyword);
      if (params.type) search.set("type", params.type);
      if (params.status) search.set("status", params.status);
      if (params.projectId) search.set("projectId", params.projectId);
      const url = `${AnalysisApiPaths.listProblems}?${search.toString()}`;
      const data = await apiGet<
        | {
            list?: AnalysisProblemDto[];
            items?: AnalysisProblemDto[];
            total?: number;
            page?: number;
            pageSize?: number;
            hasMore?: boolean;
          }
        | AnalysisProblemDto[]
      >(url);
      // 兼容：后端可能返回分页包装或直接数组
      if (Array.isArray(data)) {
        return adaptPage<AnalysisProblemDto>({
          list: data,
          total: data.length,
        });
      }
      return adaptPage<AnalysisProblemDto>(data);
    },
    placeholderData: (prev) => prev,
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 获取工程分析问题详情
 * 对应契约：GET /api/v1/analysis/problems/{problemId}
 */
export function useAnalysisProblem(problemId: string | null | undefined) {
  return useQuery<AnalysisProblemDto | null>({
    queryKey: [...ANALYSIS_QUERY_KEY, "problems", "detail", problemId],
    enabled: typeof problemId === "string" && problemId.length > 0,
    queryFn: async () => {
      try {
        return await apiGet<AnalysisProblemDto>(
          AnalysisApiPaths.getProblem(problemId!),
        );
      } catch (error) {
        if (isNotImplementedError(error)) return null;
        throw error;
      }
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 创建工程分析问题（草稿）
 * 对应契约：POST /api/v1/analysis/problems
 */
export function useCreateAnalysisProblem() {
  const queryClient = useQueryClient();
  return useMutation<AnalysisProblemDto, Error, CreateAnalysisProblemRequest>({
    mutationFn: (request) =>
      apiPost<AnalysisProblemDto>(AnalysisApiPaths.createProblem, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...ANALYSIS_QUERY_KEY, "problems", "list"],
      });
    },
  });
}

/**
 * 更新工程分析问题（仅 DRAFT 状态）
 * 对应契约：PUT /api/v1/analysis/problems/{problemId}
 */
export function useUpdateAnalysisProblem() {
  const queryClient = useQueryClient();
  return useMutation<
    AnalysisProblemDto,
    Error,
    { problemId: string; data: Partial<CreateAnalysisProblemRequest> }
  >({
    mutationFn: ({ problemId, data }) =>
      apiPut<AnalysisProblemDto>(
        AnalysisApiPaths.updateProblem(problemId),
        data,
      ),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [
          ...ANALYSIS_QUERY_KEY,
          "problems",
          "detail",
          variables.problemId,
        ],
      });
      void queryClient.invalidateQueries({
        queryKey: [...ANALYSIS_QUERY_KEY, "problems", "list"],
      });
    },
  });
}

/**
 * 删除工程分析问题草稿
 * 对应契约：DELETE /api/v1/analysis/problems/{problemId}
 */
export function useDeleteAnalysisProblem() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (problemId) =>
      apiDelete(AnalysisApiPaths.deleteProblem(problemId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...ANALYSIS_QUERY_KEY, "problems", "list"],
      });
    },
  });
}

/**
 * 提交工程分析问题（DRAFT → READY）
 * 安全红线：高风险动作（输入基线变更后不可逆）
 */
export function useSubmitAnalysisProblem() {
  const queryClient = useQueryClient();
  return useMutation<AnalysisProblemDto, Error, string>({
    mutationFn: (problemId) =>
      apiPost<AnalysisProblemDto>(
        AnalysisApiPaths.submitProblem(problemId),
        {},
      ),
    onSuccess: (_, problemId) => {
      void queryClient.invalidateQueries({
        queryKey: [...ANALYSIS_QUERY_KEY, "problems", "detail", problemId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...ANALYSIS_QUERY_KEY, "problems", "list"],
      });
    },
  });
}

/**
 * 标记工程分析问题失效
 * 安全红线：高风险动作，需 stepUpToken
 */
export function useInvalidateAnalysisProblem() {
  const queryClient = useQueryClient();
  return useMutation<
    AnalysisProblemDto,
    Error,
    { problemId: string; data: InvalidateProblemRequest }
  >({
    mutationFn: ({ problemId, data }) =>
      apiPost<AnalysisProblemDto>(
        AnalysisApiPaths.invalidateProblem(problemId),
        data,
      ),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [
          ...ANALYSIS_QUERY_KEY,
          "problems",
          "detail",
          variables.problemId,
        ],
      });
      void queryClient.invalidateQueries({
        queryKey: [...ANALYSIS_QUERY_KEY, "problems", "list"],
      });
    },
  });
}

// ── MeshQuality ──

/**
 * 获取网格质量摘要
 * 对应契约：GET /api/v1/analysis/problems/{problemId}/mesh-quality
 *
 * 后端 V0 可能未实现此端点（404/501），返回 null 由组件显示空状态。
 */
export function useMeshQuality(problemId: string | null | undefined) {
  return useQuery<MeshQualityDto | null>({
    queryKey: [...ANALYSIS_QUERY_KEY, "problems", "mesh-quality", problemId],
    enabled: typeof problemId === "string" && problemId.length > 0,
    queryFn: async () => {
      try {
        return await apiGet<MeshQualityDto>(
          AnalysisApiPaths.meshQuality(problemId!),
        );
      } catch (error) {
        if (isNotImplementedError(error)) return null;
        throw error;
      }
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── AnalysisScenario 子实体 ──

/**
 * 列出问题下的场景
 * 对应契约：GET /api/v1/analysis/problems/{problemId}/scenarios
 */
export function useAnalysisScenarios(problemId: string | null | undefined) {
  return useQuery<AnalysisScenarioDto[]>({
    queryKey: [...ANALYSIS_QUERY_KEY, "scenarios", "list", problemId],
    enabled: typeof problemId === "string" && problemId.length > 0,
    queryFn: async () => {
      try {
        const data = await apiGet<
          | AnalysisScenarioDto[]
          | { list?: AnalysisScenarioDto[]; items?: AnalysisScenarioDto[] }
        >(AnalysisApiPaths.listScenarios(problemId!));
        if (Array.isArray(data)) return data;
        return data.list ?? data.items ?? [];
      } catch (error) {
        if (isNotImplementedError(error)) return [];
        throw error;
      }
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 创建场景
 */
export function useCreateAnalysisScenario() {
  const queryClient = useQueryClient();
  return useMutation<
    AnalysisScenarioDto,
    Error,
    { problemId: string; data: CreateAnalysisScenarioRequest }
  >({
    mutationFn: ({ problemId, data }) =>
      apiPost<AnalysisScenarioDto>(
        AnalysisApiPaths.createScenario(problemId),
        data,
      ),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [
          ...ANALYSIS_QUERY_KEY,
          "scenarios",
          "list",
          variables.problemId,
        ],
      });
    },
  });
}

/**
 * 删除场景
 */
export function useDeleteAnalysisScenario() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { problemId: string; scenarioId: string }>({
    mutationFn: ({ problemId, scenarioId }) =>
      apiDelete(AnalysisApiPaths.deleteScenario(problemId, scenarioId)),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [
          ...ANALYSIS_QUERY_KEY,
          "scenarios",
          "list",
          variables.problemId,
        ],
      });
    },
  });
}

// ── SimulationRun 子实体 ──

/**
 * 列出运行（按 problemId 过滤）
 * 对应契约：GET /api/v1/analysis/runs?problemId=
 */
export function useSimulationRuns(
  params: {
    problemId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  return useQuery<OffsetPageResponse<SimulationRunDto>>({
    queryKey: [
      ...ANALYSIS_QUERY_KEY,
      "runs",
      "list",
      {
        problemId: params.problemId ?? null,
        status: params.status ?? null,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      },
    ],
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("page", String(params.page ?? 1));
      search.set("pageSize", String(params.pageSize ?? 20));
      if (params.problemId) search.set("problemId", params.problemId);
      if (params.status) search.set("status", params.status);
      const url = `${AnalysisApiPaths.listRuns}?${search.toString()}`;
      const data = await apiGet<
        | {
            list?: SimulationRunDto[];
            items?: SimulationRunDto[];
            total?: number;
            page?: number;
            pageSize?: number;
            hasMore?: boolean;
          }
        | SimulationRunDto[]
      >(url);
      if (Array.isArray(data)) {
        return adaptPage<SimulationRunDto>({ list: data, total: data.length });
      }
      return adaptPage<SimulationRunDto>(data);
    },
    placeholderData: (prev) => prev,
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 获取运行详情
 */
export function useSimulationRun(runId: string | null | undefined) {
  return useQuery<SimulationRunDto | null>({
    queryKey: [...ANALYSIS_QUERY_KEY, "runs", "detail", runId],
    enabled: typeof runId === "string" && runId.length > 0,
    queryFn: async () => {
      try {
        return await apiGet<SimulationRunDto>(AnalysisApiPaths.getRun(runId!));
      } catch (error) {
        if (isNotImplementedError(error)) return null;
        throw error;
      }
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 创建运行（QUEUED）
 */
export function useCreateSimulationRun() {
  const queryClient = useQueryClient();
  return useMutation<SimulationRunDto, Error, CreateSimulationRunRequest>({
    mutationFn: (request) =>
      apiPost<SimulationRunDto>(AnalysisApiPaths.createRun, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...ANALYSIS_QUERY_KEY, "runs", "list"],
      });
    },
  });
}

/**
 * 取消运行
 * 安全红线：高风险动作，需 stepUpToken
 */
export function useCancelSimulationRun() {
  const queryClient = useQueryClient();
  return useMutation<
    SimulationRunDto,
    Error,
    { runId: string; reason: string; stepUpToken?: string }
  >({
    mutationFn: ({ runId, reason, stepUpToken }) =>
      apiPost<SimulationRunDto>(AnalysisApiPaths.cancelRun(runId), {
        reason,
        stepUpToken,
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...ANALYSIS_QUERY_KEY, "runs", "detail", variables.runId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...ANALYSIS_QUERY_KEY, "runs", "list"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...ANALYSIS_QUERY_KEY, "runs", "timeline", variables.runId],
      });
    },
  });
}

/**
 * 重试运行
 * 安全红线：高风险动作 + retry storm 检测
 */
export function useRetrySimulationRun() {
  const queryClient = useQueryClient();
  return useMutation<
    SimulationRunDto,
    Error,
    { runId: string; reason?: string; stepUpToken?: string }
  >({
    mutationFn: ({ runId, reason, stepUpToken }) =>
      apiPost<SimulationRunDto>(AnalysisApiPaths.retryRun(runId), {
        reason,
        stepUpToken,
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...ANALYSIS_QUERY_KEY, "runs", "list"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...ANALYSIS_QUERY_KEY, "runs", "timeline", variables.runId],
      });
    },
  });
}

/**
 * 获取运行时间线
 */
export function useRunTimeline(runId: string | null | undefined) {
  return useQuery<RunTimelineEventDto[]>({
    queryKey: [...ANALYSIS_QUERY_KEY, "runs", "timeline", runId],
    enabled: typeof runId === "string" && runId.length > 0,
    queryFn: async () => {
      try {
        const data = await apiGet<
          | RunTimelineEventDto[]
          | { list?: RunTimelineEventDto[]; items?: RunTimelineEventDto[] }
        >(AnalysisApiPaths.runTimeline(runId!));
        if (Array.isArray(data)) return data;
        return data.list ?? data.items ?? [];
      } catch (error) {
        if (isNotImplementedError(error)) return [];
        throw error;
      }
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 获取收敛指标
 */
export function useRunConvergence(runId: string | null | undefined) {
  return useQuery<ConvergenceMetricDto[]>({
    queryKey: [...ANALYSIS_QUERY_KEY, "runs", "convergence", runId],
    enabled: typeof runId === "string" && runId.length > 0,
    queryFn: async () => {
      try {
        const data = await apiGet<
          | ConvergenceMetricDto[]
          | { list?: ConvergenceMetricDto[]; items?: ConvergenceMetricDto[] }
        >(AnalysisApiPaths.runConvergence(runId!));
        if (Array.isArray(data)) return data;
        return data.list ?? data.items ?? [];
      } catch (error) {
        if (isNotImplementedError(error)) return [];
        throw error;
      }
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 获取运行的结果列表
 * 对应契约：GET /api/v1/analysis/runs/{runId}/results
 *
 * 注：此端点由 AnalysisResultController 提供，路径为 /api/v1/analysis/results?runId=
 * 此 hook 暂以 results 列表查询（后端 V0 可能未直接实现 runId/results 路径）
 */
export function useRunResults(runId: string | null | undefined) {
  return useQuery<AnalysisResultDto[]>({
    queryKey: [...ANALYSIS_QUERY_KEY, "runs", "results", runId],
    enabled: typeof runId === "string" && runId.length > 0,
    queryFn: async () => {
      try {
        const data = await apiGet<
          | AnalysisResultDto[]
          | { list?: AnalysisResultDto[]; items?: AnalysisResultDto[] }
        >(`${AnalysisApiPaths.runResults(runId!)}`);
        if (Array.isArray(data)) return data;
        return data.list ?? data.items ?? [];
      } catch (error) {
        if (isNotImplementedError(error)) return [];
        throw error;
      }
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── AnalysisResult 子实体 ──

/**
 * 获取分析结果详情
 */
export function useAnalysisResult(resultId: string | null | undefined) {
  return useQuery<AnalysisResultDto | null>({
    queryKey: [...ANALYSIS_QUERY_KEY, "results", "detail", resultId],
    enabled: typeof resultId === "string" && resultId.length > 0,
    queryFn: async () => {
      try {
        return await apiGet<AnalysisResultDto>(
          AnalysisApiPaths.getResult(resultId!),
        );
      } catch (error) {
        if (isNotImplementedError(error)) return null;
        throw error;
      }
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 获取结果质量评估
 */
export function useResultQuality(resultId: string | null | undefined) {
  return useQuery<ResultQualityAssessmentDto | null>({
    queryKey: [...ANALYSIS_QUERY_KEY, "results", "quality", resultId],
    enabled: typeof resultId === "string" && resultId.length > 0,
    queryFn: async () => {
      try {
        return await apiGet<ResultQualityAssessmentDto>(
          AnalysisApiPaths.resultQuality(resultId!),
        );
      } catch (error) {
        if (isNotImplementedError(error)) return null;
        throw error;
      }
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 提交结果质量评估
 * 安全红线：ACCEPT_AS_REVISION/EXCEPTION 决策需注册师签章
 */
export function useSubmitQualityAssessment() {
  const queryClient = useQueryClient();
  return useMutation<
    ResultQualityAssessmentDto,
    Error,
    { resultId: string; data: SubmitQualityAssessmentRequest }
  >({
    mutationFn: ({ resultId, data }) =>
      apiPost<ResultQualityAssessmentDto>(
        AnalysisApiPaths.submitQualityAssessment(resultId),
        data,
      ),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [
          ...ANALYSIS_QUERY_KEY,
          "results",
          "quality",
          variables.resultId,
        ],
      });
      void queryClient.invalidateQueries({
        queryKey: [
          ...ANALYSIS_QUERY_KEY,
          "results",
          "detail",
          variables.resultId,
        ],
      });
    },
  });
}

/**
 * 创建变更影响提案（结果 → 变更域）
 * 安全红线：高风险动作，需 stepUpToken
 */
export function useCreateImpactProposal() {
  return useMutation<
    { proposalId: string },
    Error,
    { resultId: string; data: unknown; stepUpToken?: string }
  >({
    mutationFn: ({ resultId, data, stepUpToken }) =>
      apiPost<{ proposalId: string }>(
        AnalysisApiPaths.createImpactProposal(resultId),
        { ...((data as object) ?? {}), stepUpToken },
      ),
  });
}

// ── SolverProfile 配置 ──

/**
 * 获取求解器配置列表
 */
export function useSolverProfiles() {
  return useQuery<SolverProfileDto[]>({
    queryKey: [...ANALYSIS_QUERY_KEY, "solver-profiles"],
    queryFn: async () => {
      try {
        const data = await apiGet<
          | SolverProfileDto[]
          | { list?: SolverProfileDto[]; items?: SolverProfileDto[] }
        >(AnalysisApiPaths.listSolverProfiles);
        if (Array.isArray(data)) return data;
        return data.list ?? data.items ?? [];
      } catch (error) {
        if (isNotImplementedError(error)) return [];
        throw error;
      }
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

// ── 派生工具函数 ──

/**
 * 计算问题状态汇总
 */
export function useProblemStatusSummary(
  problems: AnalysisProblemDto[] | undefined,
) {
  return useMemo(() => {
    const base = {
      total: 0,
      running: 0,
      completed: 0,
      questionable: 0,
      invalid: 0,
      draft: 0,
      ready: 0,
      reviewed: 0,
    };
    if (!problems) return base;
    return problems.reduce(
      (acc, p) => {
        acc.total += 1;
        if (p.status === "RUNNING") acc.running += 1;
        if (p.status === "COMPLETED") acc.completed += 1;
        if (p.status === "REVIEWED") acc.reviewed += 1;
        if (p.status === "READY") acc.ready += 1;
        if (p.status === "DRAFT") acc.draft += 1;
        if (p.status === "INVALID") acc.invalid += 1;
        if (p.latestResultQuality === "QUESTIONABLE") acc.questionable += 1;
        return acc;
      },
      { ...base },
    );
  }, [problems]);
}
