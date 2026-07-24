"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  AiGenerationRecordDto,
  CreateAiGenerationRecordRequest,
} from "@design-platform/shared";
import { AiGenerationRecordApiPaths } from "@design-platform/shared";
import { apiGet, apiPost } from "@/lib/api-client";

/** AI 生成记录查询键前缀 */
const AI_GEN_RECORD_QUERY_KEY = ["ai-generation-records"] as const;

/**
 * 查询 AI 生成记录详情
 * 对应契约：GET /api/v1/ai-generation-records/{id}
 */
export function useAiGenerationRecord(id: string | null | undefined) {
  return useQuery<AiGenerationRecordDto>({
    queryKey: [...AI_GEN_RECORD_QUERY_KEY, "detail", id] as const,
    enabled: typeof id === "string" && id.length > 0,
    queryFn: () =>
      apiGet<AiGenerationRecordDto>(
        AiGenerationRecordApiPaths.detail(id as string),
      ),
  });
}

/**
 * 按设计选项反查 AI 生成记录（审计追溯：设计选项 → AI 来源）
 * 对应契约：GET /api/v1/ai-generation-records?designOptionId=xxx
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
      ),
  });
}

/**
 * 按项目查询 AI 生成记录（按时间倒序）
 * 对应契约：GET /api/v1/ai-generation-records?projectId=xxx
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
      ),
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
  );
}
