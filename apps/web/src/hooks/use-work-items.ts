"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CursorPageResponse,
  ListWorkItemsRequest,
  QuickActionRequest,
  QuickActionResponse,
  SavedViewDto,
  WorkItemDto,
} from "@design-platform/shared";
import { WorkItemApiPaths } from "@design-platform/shared";
import { apiGet, apiPost } from "@/lib/api-client";

/**
 * WorkItem 域 hooks（V0 阶段）
 *
 * 后端聚合查询 API（workflow.work.list）尚未实现，
 * 前端通过这些 hooks 提供统一查询入口；后端实现后无需修改组件代码。
 *
 * 当 API 返回 404 / 501（未实现）时，组件层显示空状态
 * （对齐 D37.5 §空状态：区分"当前无任务 / 筛选无结果 / 数据同步中"）。
 *
 * 主动作约束（D37.5 §主动作）：
 *  - 快捷动作仅允许 CLAIM / ACKNOWLEDGE / 低风险 COMPLETE
 *  - 高风险动作需在工作项详情页执行
 *  - 处理动作回源校验，不允许重复审批
 */

const WORK_ITEMS_QUERY_KEY = ["work-items"] as const;
const SAVED_VIEWS_QUERY_KEY = ["work-items", "saved-views"] as const;

/** 判断 API 是否为"未实现"错误（404 / 501） */
function isNotImplementedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  return status === 404 || status === 501;
}

/** 构造工作项列表查询键 */
function buildWorkItemsQueryKey(params: ListWorkItemsRequest) {
  return [
    ...WORK_ITEMS_QUERY_KEY,
    "list",
    {
      group: params.group ?? null,
      type: params.type ?? null,
      projectId: params.projectId ?? null,
      stageCode: params.stageCode ?? null,
      discipline: params.discipline ?? null,
      risk: params.risk ?? null,
      status: params.status ?? null,
      keyword: params.keyword ?? "",
      onlyMine: params.onlyMine ?? true,
      cursor: params.cursor ?? null,
      pageSize: params.pageSize ?? 50,
    },
  ] as const;
}

/**
 * 列出工作项（聚合查询）
 * 对应契约：GET /api/v1/work-items
 *
 * V0：后端未实现，组件层捕获错误后展示空状态
 */
export function useWorkItems(params: ListWorkItemsRequest = {}) {
  return useQuery<CursorPageResponse<WorkItemDto>>({
    queryKey: buildWorkItemsQueryKey(params),
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params.group) search.set("group", params.group);
      if (params.type) search.set("type", params.type);
      if (params.projectId) search.set("projectId", params.projectId);
      if (params.stageCode) search.set("stageCode", params.stageCode);
      if (params.discipline) search.set("discipline", params.discipline);
      if (params.risk) search.set("risk", params.risk);
      if (params.status) search.set("status", params.status);
      if (params.keyword && params.keyword.trim().length > 0) {
        search.set("keyword", params.keyword.trim());
      }
      search.set("onlyMine", String(params.onlyMine ?? true));
      if (params.cursor) search.set("cursor", params.cursor);
      search.set("pageSize", String(params.pageSize ?? 50));
      const url = `${WorkItemApiPaths.list}?${search.toString()}`;
      return apiGet<CursorPageResponse<WorkItemDto>>(url);
    },
    // 404 / 501 视为后端未实现，不重试避免浪费请求
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 工作项详情
 * 对应契约：GET /api/v1/work-items/{id}
 */
export function useWorkItem(id: string | null | undefined) {
  return useQuery<WorkItemDto>({
    queryKey: [...WORK_ITEMS_QUERY_KEY, "detail", id] as const,
    enabled: typeof id === "string" && id.length > 0,
    queryFn: async () => {
      if (!id) throw new Error("id is required");
      return apiGet<WorkItemDto>(WorkItemApiPaths.detail(id));
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * SavedView 列表
 * 对应契约：GET /api/v1/work-items/saved-views
 *
 * V0：后端未实现，组件层使用内置默认视图
 */
export function useSavedViews() {
  return useQuery<SavedViewDto[]>({
    queryKey: [...SAVED_VIEWS_QUERY_KEY] as const,
    queryFn: async () => {
      return apiGet<SavedViewDto[]>(WorkItemApiPaths.savedViews);
    },
    retry: (failureCount, error) => {
      if (isNotImplementedError(error)) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 执行快捷动作（CLAIM / ACKNOWLEDGE / COMPLETE）
 * 对应契约：POST /api/v1/work-items/{id}:quick-action
 *
 * D37.5 §主动作约束：
 *  - 仅允许低风险动作，高风险需在详情页执行
 *  - 处理动作回源校验，不允许重复审批
 */
export function useQuickAction() {
  const queryClient = useQueryClient();
  return useMutation<QuickActionResponse, Error, QuickActionRequest>({
    mutationFn: async (request) => {
      const url = WorkItemApiPaths.quickAction(request.workItemId);
      const payload: QuickActionRequest = {
        workItemId: request.workItemId,
        actionType: request.actionType,
        reason: request.reason,
        stepUpToken: request.stepUpToken,
        ifMatch: request.ifMatch,
      };
      return apiPost<QuickActionResponse>(url, payload);
    },
    onSuccess: (_data, variables) => {
      // 失效列表与详情缓存
      void queryClient.invalidateQueries({
        queryKey: [...WORK_ITEMS_QUERY_KEY, "list"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...WORK_ITEMS_QUERY_KEY, "detail", variables.workItemId],
      });
    },
  });
}
