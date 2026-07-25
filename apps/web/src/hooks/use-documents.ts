"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  DocumentDto,
  DocumentVersionDto,
  ListDocumentsRequest,
  OffsetPageResponse,
} from "@design-platform/shared";
import {
  CdeApiPaths,
  documentDtoSchema,
  documentVersionDtoSchema,
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

/** 文档列表查询键前缀 */
const DOCUMENTS_QUERY_KEY = ["documents"] as const;

/** 构造文档列表查询键（包含分页与过滤参数） */
function buildDocumentsQueryKey(
  projectId: string,
  params: ListDocumentsRequest,
) {
  return [
    ...DOCUMENTS_QUERY_KEY,
    "list",
    projectId,
    {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      status: params.status ?? null,
      keyword: params.keyword ?? "",
      sort: params.sort ?? null,
      order: params.order ?? null,
    },
  ] as const;
}

/**
 * 列出项目下文档
 * 对应契约：GET /api/v1/projects/{projectId}/documents
 *
 * 返回偏移分页结构 { items, total, page, pageSize, hasMore }
 *
 * 契约验证：软验证模式
 *  - 文档列表为高频查询，软验证不阻断用户流程
 */
export function useDocuments(
  projectId: string | null | undefined,
  params: ListDocumentsRequest = {},
) {
  return useQuery<OffsetPageResponse<DocumentDto>>({
    queryKey:
      typeof projectId === "string"
        ? buildDocumentsQueryKey(projectId, params)
        : (["documents", "list", null] as const),
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () => {
      const searchParams = new URLSearchParams();
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 20;
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
      return apiGet<OffsetPageResponse<DocumentDto>>(
        `${CdeApiPaths.documents(projectId as string)}?${searchParams.toString()}`,
        {
          validate: {
            schema: offsetPageResponseSchema(documentDtoSchema),
            context: "useDocuments.list",
          },
        },
      );
    },
    placeholderData: (prev) => prev, // 翻页/筛选时保留旧数据，避免闪烁
  });
}

/**
 * 获取文档版本历史
 * 对应契约：GET /api/v1/documents/{documentId}/versions
 *
 * 契约验证：软验证模式
 */
export function useDocumentVersions(documentId: string | null | undefined) {
  return useQuery<DocumentVersionDto[]>({
    queryKey: [...DOCUMENTS_QUERY_KEY, "versions", documentId] as const,
    enabled: typeof documentId === "string" && documentId.length > 0,
    queryFn: () =>
      apiGet<DocumentVersionDto[]>(CdeApiPaths.versions(documentId as string), {
        validate: {
          schema: z.array(documentVersionDtoSchema),
          context: "useDocuments.versions",
        },
      }),
  });
}

/**
 * 上传文档新版本
 * 对应契约：POST /api/v1/documents/{documentId}/versions
 */
export function useUploadDocumentVersion() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    {
      documentId: string;
      payload: { storageKey: string; checksum: string; comment?: string };
    }
  >({
    mutationFn: ({ documentId, payload }) =>
      apiPost<void>(CdeApiPaths.versions(documentId), payload),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...DOCUMENTS_QUERY_KEY, "versions", variables.documentId],
      });
      void queryClient.invalidateQueries({
        queryKey: [...DOCUMENTS_QUERY_KEY, "list"],
      });
    },
  });
}
