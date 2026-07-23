"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ProjectDto,
  CreateProjectRequest,
  UpdateProjectRequest,
  ListProjectsRequest,
  OffsetPageResponse,
} from "@design-platform/shared";
import { PortfolioApiPaths, HttpHeader } from "@design-platform/shared";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";

/** 项目列表查询键前缀 */
const PROJECTS_QUERY_KEY = ["projects"] as const;

/** 生成幂等键（UUIDv4，浏览器原生 crypto） */
function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // 兜底方案：时间戳 + 随机串
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** 构造项目列表查询键（包含分页与过滤参数，确保参数变化时独立缓存） */
function buildProjectsQueryKey(params: ListProjectsRequest) {
  return [
    ...PROJECTS_QUERY_KEY,
    "list",
    {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 10,
      status: params.status ?? null,
      keyword: params.keyword ?? "",
    },
  ] as const;
}

/**
 * 项目列表查询
 * 对应 GET /api/v1/projects?page=&pageSize=&status=&keyword=
 * 返回偏移分页结构 { items, total, page, pageSize, hasMore }
 */
export function useProjects(params: ListProjectsRequest = {}) {
  return useQuery<OffsetPageResponse<ProjectDto>>({
    queryKey: buildProjectsQueryKey(params),
    queryFn: () => {
      // 组装 query string，跳过 undefined / 空值
      const searchParams = new URLSearchParams();
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 10;
      searchParams.set("page", String(page));
      searchParams.set("pageSize", String(pageSize));
      if (params.status) {
        searchParams.set("status", params.status);
      }
      if (params.keyword && params.keyword.trim().length > 0) {
        searchParams.set("keyword", params.keyword.trim());
      }
      if (params.sort) {
        searchParams.set("sort", params.sort);
      }
      if (params.order) {
        searchParams.set("order", params.order);
      }
      return apiGet<OffsetPageResponse<ProjectDto>>(
        `${PortfolioApiPaths.projects}?${searchParams.toString()}`,
      );
    },
    placeholderData: (prev) => prev, // 翻页/筛选时保留旧数据，避免闪烁
  });
}

/**
 * 项目详情查询
 * 对应 GET /api/v1/projects/{id}
 */
export function useProject(id: string | null | undefined) {
  return useQuery<ProjectDto>({
    queryKey: [...PROJECTS_QUERY_KEY, "detail", id] as const,
    queryFn: () => apiGet<ProjectDto>(PortfolioApiPaths.project(id as string)),
    enabled: typeof id === "string" && id.length > 0,
  });
}

/**
 * 创建项目 mutation
 * 对应 POST /api/v1/projects
 * 必须携带 Idempotency-Key 头（D35 §幂等约定），自动生成 UUID
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation<ProjectDto, Error, CreateProjectRequest>({
    mutationFn: (payload) =>
      apiPost<ProjectDto>(PortfolioApiPaths.projects, payload, {
        headers: {
          [HttpHeader.IDEMPOTENCY_KEY]: generateIdempotencyKey(),
        },
      }),
    onSuccess: () => {
      // 创建成功后失效列表缓存，触发重新拉取
      void queryClient.invalidateQueries({
        queryKey: [...PROJECTS_QUERY_KEY, "list"],
      });
    },
  });
}

/**
 * 更新项目 mutation
 * 对应 PATCH /api/v1/projects/{id}
 * 必须携带 If-Match 头（D35 §ETag 乐观锁约定），值由 rowVersion 派生
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation<
    ProjectDto,
    Error,
    { id: string; rowVersion: number; payload: UpdateProjectRequest }
  >({
    mutationFn: ({ id, rowVersion, payload }) =>
      apiPatch<ProjectDto>(PortfolioApiPaths.project(id), payload, {
        headers: {
          // ETag 形如 "rev-<rowVersion>"，If-Match 需携带相同值
          [HttpHeader.IF_MATCH]: `"rev-${rowVersion}"`,
        },
      }),
    onSuccess: (data) => {
      // 失效列表与该条详情缓存
      void queryClient.invalidateQueries({
        queryKey: [...PROJECTS_QUERY_KEY, "list"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...PROJECTS_QUERY_KEY, "detail", data.id],
      });
    },
  });
}
