"use client";

import { useQuery } from "@tanstack/react-query";
import type { StageInstanceDto } from "@design-platform/shared";
import {
  WorkflowApiPaths,
  stageInstanceDtoSchema,
} from "@design-platform/shared";
import { z } from "zod";
import { apiGet } from "@/lib/api-client";

/** 阶段实例列表查询键前缀 */
const STAGES_QUERY_KEY = ["stages"] as const;

/**
 * 列出项目下所有阶段实例
 * 对应契约：workflow.stage.list（GET /api/v1/projects/{projectId}/stages）
 *
 * 返回数组按 stageOrder 升序排列，保证时间线展示顺序与流程定义一致
 *
 * 契约验证：软验证模式
 *  - 阶段实例结构错误不阻断时间线展示，console.warn 记录便于排查
 */
export function useStages(projectId: string | null | undefined) {
  return useQuery<StageInstanceDto[]>({
    queryKey: [...STAGES_QUERY_KEY, "list", projectId] as const,
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: async () => {
      const id = projectId as string;
      const stages = await apiGet<StageInstanceDto[]>(
        WorkflowApiPaths.stages(id),
        {
          validate: {
            schema: z.array(stageInstanceDtoSchema),
            context: "useStages.list",
          },
        },
      );
      return [...stages].sort((a, b) => a.stageOrder - b.stageOrder);
    },
  });
}
