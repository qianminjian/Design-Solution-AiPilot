"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  AiGenerationRecordDto,
  CreateAiGenerationRecordRequest,
  SubmitReviewRequest,
} from "@design-platform/shared";
import {
  AiGenerationRecordApiPaths,
  aiGenerationRecordDtoSchema,
} from "@design-platform/shared";
import { z } from "zod";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";

/** AI 生成记录查询键前缀 */
const AI_GEN_RECORD_QUERY_KEY = ["ai-generation-records"] as const;

/**
 * 查询 AI 生成记录详情
 * 对应契约：GET /api/v1/ai-generation-records/{id}
 *
 * 契约验证：软验证模式
 *  - 审计追溯记录结构错误不阻断展示，console.warn 记录便于排查
 */
export function useAiGenerationRecord(id: string | null | undefined) {
  return useQuery<AiGenerationRecordDto>({
    queryKey: [...AI_GEN_RECORD_QUERY_KEY, "detail", id] as const,
    enabled: typeof id === "string" && id.length > 0,
    queryFn: () =>
      apiGet<AiGenerationRecordDto>(
        AiGenerationRecordApiPaths.detail(id as string),
        {
          validate: {
            schema: aiGenerationRecordDtoSchema,
            context: "useAiGenerationRecord.detail",
          },
        },
      ),
  });
}

/**
 * 按设计选项反查 AI 生成记录（审计追溯：设计选项 → AI 来源）
 * 对应契约：GET /api/v1/ai-generation-records?designOptionId=xxx
 *
 * 契约验证：软验证模式
 */
export function useAiGenerationRecordsByDesignOption(
  designOptionId: string | null | undefined,
) {
  return useQuery<AiGenerationRecordDto[]>({
    queryKey: [
      ...AI_GEN_RECORD_QUERY_KEY,
      "by-design-option",
      designOptionId,
    ] as const,
    enabled: typeof designOptionId === "string" && designOptionId.length > 0,
    queryFn: () =>
      apiGet<AiGenerationRecordDto[]>(
        `${AiGenerationRecordApiPaths.list}?designOptionId=${encodeURIComponent(
          designOptionId as string,
        )}`,
        {
          validate: {
            schema: z.array(aiGenerationRecordDtoSchema),
            context: "useAiGenerationRecords.byDesignOption",
          },
        },
      ),
  });
}

/**
 * 按项目查询 AI 生成记录（按时间倒序）
 * 对应契约：GET /api/v1/ai-generation-records?projectId=xxx
 *
 * 契约验证：软验证模式
 */
export function useAiGenerationRecordsByProject(
  projectId: string | null | undefined,
) {
  return useQuery<AiGenerationRecordDto[]>({
    queryKey: [...AI_GEN_RECORD_QUERY_KEY, "by-project", projectId] as const,
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () =>
      apiGet<AiGenerationRecordDto[]>(
        `${AiGenerationRecordApiPaths.list}?projectId=${encodeURIComponent(
          projectId as string,
        )}`,
        {
          validate: {
            schema: z.array(aiGenerationRecordDtoSchema),
            context: "useAiGenerationRecords.byProject",
          },
        },
      ),
  });
}

/**
 * 查询项目内待人工复核的 AI 生成记录
 * 对应契约：GET /api/v1/ai-generation-records/reviews/pending?projectId=xxx
 *
 * AI 安全红线（security.md §12）：
 * requiresHumanReview=true 的记录必须经人工复核才能采纳。
 *
 * 契约验证：软验证模式
 */
export function usePendingAiReviews(projectId: string | null | undefined) {
  return useQuery<AiGenerationRecordDto[]>({
    queryKey: [
      ...AI_GEN_RECORD_QUERY_KEY,
      "pending-reviews",
      projectId,
    ] as const,
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () =>
      apiGet<AiGenerationRecordDto[]>(
        AiGenerationRecordApiPaths.pendingReviews(projectId as string),
        {
          validate: {
            schema: z.array(aiGenerationRecordDtoSchema),
            context: "usePendingAiReviews.list",
          },
        },
      ),
  });
}

/**
 * 提交人工复核决策
 * 对应契约：PATCH /api/v1/ai-generation-records/{id}/review
 *
 * 决策类型：
 * - APPROVED：复核通过
 * - REJECTED：复核驳回
 * - RETURNED：退回重生成
 *
 * 高风险（high/critical）记录须在 decisionContext 提供 secondReviewer 与 signer。
 */
export function useSubmitAiReview() {
  const queryClient = useQueryClient();

  return useMutation<
    AiGenerationRecordDto,
    Error,
    {
      id: string;
      payload: SubmitReviewRequest;
    }
  >({
    mutationFn: ({ id, payload }) =>
      apiPatch<AiGenerationRecordDto>(
        AiGenerationRecordApiPaths.submitReview(id),
        payload,
        {
          validate: {
            schema: aiGenerationRecordDtoSchema,
            context: "useSubmitAiReview",
          },
        },
      ),
    onSuccess: () => {
      // 复核完成后刷新待复核列表与详情
      void queryClient.invalidateQueries({
        queryKey: [...AI_GEN_RECORD_QUERY_KEY, "pending-reviews"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...AI_GEN_RECORD_QUERY_KEY, "detail"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...AI_GEN_RECORD_QUERY_KEY, "by-project"],
      });
    },
  });
}

/**
 * 创建 AI 生成记录（通常由 AI Service 通过 BFF 自动转发，前端较少直接调用）
 */
export async function createAiGenerationRecord(
  payload: CreateAiGenerationRecordRequest,
): Promise<AiGenerationRecordDto> {
  return apiPost<AiGenerationRecordDto>(
    AiGenerationRecordApiPaths.create,
    payload,
    {
      validate: {
        schema: aiGenerationRecordDtoSchema,
        context: "createAiGenerationRecord",
      },
    },
  );
}
