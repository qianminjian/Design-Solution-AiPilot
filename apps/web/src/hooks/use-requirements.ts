"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  CoverageSummaryDto,
  ListRequirementsRequest,
  ListRequirementSourcesRequest,
  OffsetPageResponse,
  RequirementDto,
  RequirementHistoryDto,
  RequirementSourceDto,
  TraceLinkDto,
} from "@design-platform/shared";
import { RequirementApiPaths } from "@design-platform/shared";
import { apiGet } from "@/lib/api-client";

/**
 * Requirement 域 hooks（V0 阶段）
 *
 * 后端 API 未就位，前端通过这些 hooks 提供统一查询入口。
 * 后端实现后无需修改组件代码，直接对接即可。
 *
 * 当 API 返回 404 / 501（未实现）时，组件层显示"导入来源"空状态（对齐 D37.7 空状态红线）。
 */

const REQUIREMENTS_QUERY_KEY = ["requirements"] as const;

/** 构造需求列表查询键 */
function buildRequirementsQueryKey(
  projectId: string,
  params: ListRequirementsRequest,
) {
  return [
    ...REQUIREMENTS_QUERY_KEY,
    "list",
    projectId,
    {
      category: params.category ?? null,
      status: params.status ?? null,
      keyword: params.keyword ?? "",
      sourceId: params.sourceId ?? null,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      sort: params.sort ?? null,
      order: params.order ?? null,
    },
  ] as const;
}

/**
 * 列出项目下需求条目
 * 对应契约：GET /api/v1/projects/{projectId}/requirements
 *
 * V0：后端未实现，组件层捕获错误后展示空状态
 */
export function useRequirements(
  projectId: string | null | undefined,
  params: ListRequirementsRequest = {},
) {
  return useQuery<OffsetPageResponse<RequirementDto>>({
    queryKey:
      typeof projectId === "string"
        ? buildRequirementsQueryKey(projectId, params)
        : ([REQUIREMENTS_QUERY_KEY, "list", null] as const),
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () => {
      const searchParams = new URLSearchParams();
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 20;
      searchParams.set("page", String(page));
      searchParams.set("pageSize", String(pageSize));
      if (params.category) {
        searchParams.set("category", params.category);
      }
      if (params.status) {
        searchParams.set("status", params.status);
      }
      if (params.keyword && params.keyword.trim().length > 0) {
        searchParams.set("keyword", params.keyword.trim());
      }
      if (params.sourceId) {
        searchParams.set("sourceId", params.sourceId);
      }
      if (params.sort) {
        searchParams.set("sort", params.sort);
      }
      if (params.order) {
        searchParams.set("order", params.order);
      }
      return apiGet<OffsetPageResponse<RequirementDto>>(
        `${RequirementApiPaths.requirements(projectId as string)}?${searchParams.toString()}`,
      );
    },
    placeholderData: (prev) => prev,
    retry: (failureCount, error) => {
      // 后端未实现（404 / 501）时不重试，避免浪费请求
      const status = (error as { status?: number }).status;
      if (status === 404 || status === 501) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 列出需求来源
 * 对应契约：GET /api/v1/projects/{projectId}/requirement-sources
 */
export function useRequirementSources(
  projectId: string | null | undefined,
  params: ListRequirementSourcesRequest = {},
) {
  return useQuery<RequirementSourceDto[]>({
    queryKey: [
      ...REQUIREMENTS_QUERY_KEY,
      "sources",
      projectId,
      { type: params.type ?? null },
    ] as const,
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.type) {
        searchParams.set("type", params.type);
      }
      const query = searchParams.toString();
      const path = RequirementApiPaths.sources(projectId as string);
      return apiGet<RequirementSourceDto[]>(query ? `${path}?${query}` : path);
    },
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status === 404 || status === 501) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 获取需求详情
 * 对应契约：GET /api/v1/requirements/{id}
 */
export function useRequirement(requirementId: string | null | undefined) {
  return useQuery<RequirementDto>({
    queryKey: [...REQUIREMENTS_QUERY_KEY, "detail", requirementId] as const,
    enabled: typeof requirementId === "string" && requirementId.length > 0,
    queryFn: () =>
      apiGet<RequirementDto>(
        RequirementApiPaths.requirementDetail(requirementId as string),
      ),
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status === 404 || status === 501) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 获取需求变更历史
 * 对应契约：GET /api/v1/requirements/{id}/history
 */
export function useRequirementHistory(
  requirementId: string | null | undefined,
) {
  return useQuery<RequirementHistoryDto[]>({
    queryKey: [...REQUIREMENTS_QUERY_KEY, "history", requirementId] as const,
    enabled: typeof requirementId === "string" && requirementId.length > 0,
    queryFn: () =>
      apiGet<RequirementHistoryDto[]>(
        RequirementApiPaths.requirementHistory(requirementId as string),
      ),
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status === 404 || status === 501) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 获取需求的 TraceLink 列表
 * 对应契约：GET /api/v1/requirements/{requirementId}/trace-links
 */
export function useTraceLinks(requirementId: string | null | undefined) {
  return useQuery<TraceLinkDto[]>({
    queryKey: [
      ...REQUIREMENTS_QUERY_KEY,
      "trace-links",
      requirementId,
    ] as const,
    enabled: typeof requirementId === "string" && requirementId.length > 0,
    queryFn: () =>
      apiGet<TraceLinkDto[]>(
        RequirementApiPaths.traceLinks(requirementId as string),
      ),
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status === 404 || status === 501) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 获取项目需求覆盖度汇总
 * 对应契约：GET /api/v1/projects/{projectId}/requirements/coverage
 */
export function useCoverageSummary(projectId: string | null | undefined) {
  return useQuery<CoverageSummaryDto>({
    queryKey: [...REQUIREMENTS_QUERY_KEY, "coverage", projectId] as const,
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () =>
      apiGet<CoverageSummaryDto>(
        RequirementApiPaths.coverage(projectId as string),
      ),
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status === 404 || status === 501) return false;
      return failureCount < 2;
    },
  });
}
