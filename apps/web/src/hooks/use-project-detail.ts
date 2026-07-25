"use client";

import { useQuery } from "@tanstack/react-query";
import type { ProjectDto, StageInstanceDto } from "@design-platform/shared";
import {
  PortfolioApiPaths,
  WorkflowApiPaths,
  projectDtoSchema,
  stageInstanceDtoSchema,
} from "@design-platform/shared";
import { z } from "zod";
import { apiGet } from "@/lib/api-client";

/** 项目详情查询键前缀 */
const PROJECT_DETAIL_QUERY_KEY = ["project", "detail"] as const;

/** 项目详情 + 阶段列表 聚合结果 */
export interface ProjectDetailComposite {
  /** 项目 DTO */
  project: ProjectDto;
  /** 项目下所有阶段实例（按 stageOrder 升序） */
  stages: StageInstanceDto[];
}

/**
 * 获取项目详情 + 阶段列表（聚合查询）
 * - 项目详情：GET /api/v1/projects/{id}
 * - 阶段列表：GET /api/v1/projects/{id}/stages
 *
 * 两个请求并行发起，结果聚合返回，供项目详情页一次性消费
 *
 * 契约验证：软验证模式
 *  - 项目详情或阶段列表结构错误不阻断展示，console.warn 记录便于排查
 */
export function useProjectDetail(projectId: string | null | undefined) {
  return useQuery<ProjectDetailComposite>({
    queryKey: [...PROJECT_DETAIL_QUERY_KEY, projectId] as const,
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: async () => {
      const id = projectId as string;
      // 并行拉取项目详情与阶段列表，减少串行等待
      const [project, stages] = await Promise.all([
        apiGet<ProjectDto>(PortfolioApiPaths.project(id), {
          validate: {
            schema: projectDtoSchema,
            context: "useProjectDetail.project",
          },
        }),
        apiGet<StageInstanceDto[]>(WorkflowApiPaths.stages(id), {
          validate: {
            schema: z.array(stageInstanceDtoSchema),
            context: "useProjectDetail.stages",
          },
        }),
      ]);
      // 阶段按 stageOrder 升序，保证时间线从左到右为流程顺序
      const sortedStages = [...stages].sort(
        (a, b) => a.stageOrder - b.stageOrder,
      );
      return { project, stages: sortedStages };
    },
  });
}
