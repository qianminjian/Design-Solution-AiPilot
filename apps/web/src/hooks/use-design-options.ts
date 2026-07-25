"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  DesignOptionDto,
  DesignFeedbackDto,
  DesignOptionStatus,
  DesignDiscipline,
  OffsetPageResponse,
} from "@design-platform/shared";
import {
  DesignApiPaths,
  designOptionDtoSchema,
  designFeedbackDtoSchema,
} from "@design-platform/shared";
import { z } from "zod";
import { apiGet, apiPost } from "@/lib/api-client";

/**
 * 偏移分页响应 schema 工厂
 * 复用 shared 包的 OffsetPageResponse 类型
 */
function offsetPageResponseSchema<T>(itemSchema: z.ZodType<T>) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    hasMore: z.boolean(),
  });
}

/** 设计选项查询键前缀 */
const DESIGN_OPTIONS_QUERY_KEY = ["design-options"] as const;

/** 构建设计选项列表查询键 */
function buildOptionsQueryKey(
  projectId: string,
  params: {
    page?: number;
    pageSize?: number;
    status?: DesignOptionStatus;
    discipline?: DesignDiscipline;
  },
) {
  return [
    ...DESIGN_OPTIONS_QUERY_KEY,
    "list",
    projectId,
    {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      status: params.status ?? null,
      discipline: params.discipline ?? null,
    },
  ] as const;
}

/**
 * 列出项目下设计选项
 * 对应契约：GET /api/v1/design-options?projectId=xxx
 */
export function useDesignOptions(
  projectId: string | null | undefined,
  params: {
    page?: number;
    pageSize?: number;
    status?: DesignOptionStatus;
    discipline?: DesignDiscipline;
  } = {},
) {
  return useQuery<OffsetPageResponse<DesignOptionDto>>({
    queryKey:
      typeof projectId === "string"
        ? buildOptionsQueryKey(projectId, params)
        : (["design-options", "list", null] as const),
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () => {
      const searchParams = new URLSearchParams();
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 20;
      searchParams.set("projectId", projectId as string);
      searchParams.set("page", String(page));
      searchParams.set("pageSize", String(pageSize));
      if (params.status) {
        searchParams.set("status", params.status);
      }
      if (params.discipline) {
        searchParams.set("discipline", params.discipline);
      }
      return apiGet<OffsetPageResponse<DesignOptionDto>>(
        `/api/v1/design-options?${searchParams.toString()}`,
        {
          validate: {
            schema: offsetPageResponseSchema(designOptionDtoSchema),
            context: "useDesignOptions.list",
          },
        },
      );
    },
    placeholderData: (prev) => prev,
  });
}

/**
 * 获取设计选项详情
 * 对应契约：GET /api/v1/design-options/{optionId}
 *
 * 契约验证：软验证模式
 *  - 详情数据结构错误不阻断展示，console.warn 记录便于排查
 */
export function useDesignOption(optionId: string | null | undefined) {
  return useQuery<DesignOptionDto>({
    queryKey: [...DESIGN_OPTIONS_QUERY_KEY, "detail", optionId] as const,
    enabled: typeof optionId === "string" && optionId.length > 0,
    queryFn: () =>
      apiGet<DesignOptionDto>(DesignApiPaths.optionDetail(optionId as string), {
        validate: {
          schema: designOptionDtoSchema,
          context: "useDesignOptions.detail",
        },
      }),
  });
}

/**
 * 创建设计选项
 * 对应契约：POST /api/v1/design-options
 */
export function useCreateDesignOption(projectId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation<
    DesignOptionDto,
    Error,
    {
      title: string;
      description?: string;
      discipline?: DesignDiscipline;
      metadata?: Record<string, unknown>;
    }
  >({
    mutationFn: (payload) =>
      apiPost<DesignOptionDto>(
        DesignApiPaths.createOption,
        {
          projectId: projectId as string,
          ...payload,
        },
        {
          validate: {
            schema: designOptionDtoSchema,
            context: "useDesignOptions.create",
          },
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...DESIGN_OPTIONS_QUERY_KEY, "list", projectId],
      });
    },
  });
}

/**
 * 查询设计选项反馈列表
 * 对应契约：GET /api/v1/design-options/{optionId}/feedback
 *
 * 契约验证：软验证模式
 */
export function useDesignFeedback(optionId: string | null | undefined) {
  return useQuery<DesignFeedbackDto[]>({
    queryKey: [...DESIGN_OPTIONS_QUERY_KEY, "feedback", optionId] as const,
    enabled: typeof optionId === "string" && optionId.length > 0,
    queryFn: () =>
      apiGet<DesignFeedbackDto[]>(
        DesignApiPaths.listFeedback(optionId as string),
        {
          validate: {
            schema: z.array(designFeedbackDtoSchema),
            context: "useDesignOptions.feedback",
          },
        },
      ),
  });
}

/**
 * 提交设计反馈
 * 对应契约：POST /api/v1/design-options/{optionId}/feedback
 */
export function useSubmitDesignFeedback() {
  const queryClient = useQueryClient();

  return useMutation<
    DesignFeedbackDto,
    Error,
    { optionId: string; comment: string; rating?: number }
  >({
    mutationFn: ({ optionId, comment, rating }) =>
      apiPost<DesignFeedbackDto>(
        DesignApiPaths.submitFeedback(optionId),
        {
          comment,
          rating,
        },
        {
          validate: {
            schema: designFeedbackDtoSchema,
            context: "useDesignOptions.submitFeedback",
          },
        },
      ),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...DESIGN_OPTIONS_QUERY_KEY, "feedback", variables.optionId],
      });
    },
  });
}
