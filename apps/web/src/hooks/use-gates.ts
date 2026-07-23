"use client";

import { useQuery } from "@tanstack/react-query";
import type { GateDecisionDto } from "@design-platform/shared";
import { WorkflowApiPaths } from "@design-platform/shared";
import { apiGet } from "@/lib/api-client";

/** 门禁决策列表查询键前缀 */
const GATES_QUERY_KEY = ["gates"] as const;

/**
 * 列出阶段关联的门禁决策
 * 对应契约：workflow.gate.list（GET /api/v1/stages/{stageId}/gates）
 */
export function useGates(stageId: string | null | undefined) {
  return useQuery<GateDecisionDto[]>({
    queryKey: [...GATES_QUERY_KEY, "list", stageId] as const,
    enabled: typeof stageId === "string" && stageId.length > 0,
    queryFn: () =>
      apiGet<GateDecisionDto[]>(WorkflowApiPaths.stageGates(stageId as string)),
  });
}
