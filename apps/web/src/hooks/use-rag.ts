"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  RagQueryRequest,
  RagQueryResponse,
  CreateKnowledgeBaseRequest,
  KnowledgeBaseDto,
  AddDocumentsRequest,
  AddDocumentsResponse,
  CreateKnowledgeBaseResponse,
  DeleteKnowledgeBaseResponse,
} from "@design-platform/shared";
import {
  RagApiPaths,
  aiRagQueryRequestSchema,
  aiRagQueryResponseSchema,
  createKnowledgeBaseRequestSchema,
  knowledgeBaseDtoSchema,
  addDocumentsRequestSchema,
  addDocumentsResponseSchema,
  knowledgeBaseMutationResponseSchema,
} from "@design-platform/shared";
import { z } from "zod";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";

/**
 * RAG 知识库 hooks
 *
 * 对齐 services/ai/src/rag/router.py：
 *  - POST /api/v1/rag/query：检索问答
 *  - POST /api/v1/rag/knowledge-bases：创建知识库
 *  - GET  /api/v1/rag/knowledge-bases：列出知识库
 *  - POST /api/v1/rag/knowledge-bases/:id/documents：添加文档
 *  - DELETE /api/v1/rag/knowledge-bases/:id：删除知识库
 *
 * 字段命名：前端 camelCase（BFF 完成与 AI Service snake_case 双向转换）
 *
 * 安全红线（security.md §12 AI 安全红线）：
 *  - /rag/query 响应强制 isAiAssisted=true 与 requiresHumanReview
 *  - 检索结果按风险等级进入人工复核流程
 */

const RAG_QUERY_KEY = ["rag"] as const;

/** 知识库列表响应 schema（兼容数组与 { items:[] } 包装形式） */
const knowledgeBaseListResponseSchema = z.union([
  z.array(knowledgeBaseDtoSchema),
  z.object({ items: z.array(knowledgeBaseDtoSchema) }),
]);

/** 标准化知识库列表（始终返回数组） */
function normalizeKnowledgeBaseList(
  data: z.infer<typeof knowledgeBaseListResponseSchema>,
): KnowledgeBaseDto[] {
  return Array.isArray(data) ? data : data.items;
}

// ── 查询 Hook ──

/**
 * 列出所有知识库
 * 对应 GET /api/v1/rag/knowledge-bases
 *
 * 契约验证：软验证模式
 *  - 检测契约漂移但不阻断展示
 *  - 后端返回数组或 { items:[] } 包装均可处理
 */
export function useKnowledgeBases(enabled = true) {
  return useQuery<KnowledgeBaseDto[]>({
    queryKey: [...RAG_QUERY_KEY, "knowledge-bases"] as const,
    enabled,
    queryFn: async () => {
      const raw = await apiGet<z.infer<typeof knowledgeBaseListResponseSchema>>(
        RagApiPaths.listKnowledgeBases,
        {
          validate: {
            schema: knowledgeBaseListResponseSchema,
            context: "useRag.listKnowledgeBases",
          },
        },
      );
      return normalizeKnowledgeBaseList(raw);
    },
  });
}

/**
 * 检索问答
 * 对应 POST /api/v1/rag/query
 *
 * 契约验证：严格模式
 *  - 强制 isAiAssisted=true 与 requiresHumanReview 字段存在（security.md §12 AI 安全红线）
 *  - 缺失任一字段将抛错，避免前端误用未标记的 AI 输出
 */
export function useRagQuery() {
  const queryClient = useQueryClient();

  return useMutation<RagQueryResponse, Error, RagQueryRequest>({
    mutationFn: (payload) => {
      const parsed = aiRagQueryRequestSchema.safeParse(payload);
      if (!parsed.success) {
        console.warn("[useRag.query] 请求体校验失败", parsed.error.flatten());
      }
      return apiPost<RagQueryResponse>(RagApiPaths.query, payload, {
        validate: {
          schema: aiRagQueryResponseSchema,
          context: "useRag.query",
          strict: true,
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...RAG_QUERY_KEY, "query"],
      });
    },
  });
}

/**
 * 创建知识库
 * 对应 POST /api/v1/rag/knowledge-bases
 *
 * 契约验证：软验证模式
 */
export function useCreateKnowledgeBase() {
  const queryClient = useQueryClient();

  return useMutation<
    CreateKnowledgeBaseResponse,
    Error,
    CreateKnowledgeBaseRequest
  >({
    mutationFn: (payload) => {
      const parsed = createKnowledgeBaseRequestSchema.safeParse(payload);
      if (!parsed.success) {
        console.warn(
          "[useRag.createKnowledgeBase] 请求体校验失败",
          parsed.error.flatten(),
        );
      }
      return apiPost<CreateKnowledgeBaseResponse>(
        RagApiPaths.createKnowledgeBase,
        payload,
        {
          validate: {
            schema: knowledgeBaseMutationResponseSchema,
            context: "useRag.createKnowledgeBase",
          },
        },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...RAG_QUERY_KEY, "knowledge-bases"],
      });
    },
  });
}

/**
 * 删除知识库
 * 对应 DELETE /api/v1/rag/knowledge-bases/{knowledgeBaseId}
 */
export function useDeleteKnowledgeBase() {
  const queryClient = useQueryClient();

  return useMutation<
    DeleteKnowledgeBaseResponse,
    Error,
    { knowledgeBaseId: string }
  >({
    mutationFn: ({ knowledgeBaseId }) =>
      apiDelete<DeleteKnowledgeBaseResponse>(
        RagApiPaths.knowledgeBase(knowledgeBaseId),
        {
          validate: {
            schema: knowledgeBaseMutationResponseSchema,
            context: "useRag.deleteKnowledgeBase",
          },
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...RAG_QUERY_KEY, "knowledge-bases"],
      });
    },
  });
}

/**
 * 添加文档到知识库
 * 对应 POST /api/v1/rag/knowledge-bases/{knowledgeBaseId}/documents
 *
 * 契约验证：软验证模式
 */
export function useAddDocuments() {
  const queryClient = useQueryClient();

  return useMutation<
    AddDocumentsResponse,
    Error,
    { knowledgeBaseId: string; documents: AddDocumentsRequest["documents"] }
  >({
    mutationFn: ({ knowledgeBaseId, documents }) => {
      const body = { documents };
      const parsed = addDocumentsRequestSchema.safeParse(body);
      if (!parsed.success) {
        console.warn(
          "[useRag.addDocuments] 请求体校验失败",
          parsed.error.flatten(),
        );
      }
      return apiPost<AddDocumentsResponse>(
        RagApiPaths.addDocuments(knowledgeBaseId),
        body,
        {
          validate: {
            schema: addDocumentsResponseSchema,
            context: "useRag.addDocuments",
          },
        },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...RAG_QUERY_KEY, "knowledge-bases"],
      });
    },
  });
}
