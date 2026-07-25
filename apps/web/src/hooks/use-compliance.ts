"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ComplianceRuleDto,
  ComplianceCheckRunDto,
  CheckResultDto,
  RuleRevisionDto,
  CreateRuleRequest,
  CreateCheckRunRequest,
  CreateRuleRevisionRequest,
  IdsImportRequest,
  IdsImportResponse,
  UpdateRuleRequest,
  OffsetPageResponse,
} from "@design-platform/shared";
import {
  ComplianceApiPaths,
  complianceRuleDtoSchema,
  complianceCheckRunDtoSchema,
  checkResultDtoSchema,
  ruleRevisionDtoSchema,
  idsImportResponseSchema,
  updateRuleRequestSchema,
} from "@design-platform/shared";
import { z } from "zod";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";

// 类型再导出（向后兼容组件层导入）
export type { UpdateRuleRequest };

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

/** 合规规则查询键前缀 */
const COMPLIANCE_QUERY_KEY = ["compliance"] as const;

// ── 规则 ──

/**
 * 列出合规规则
 */
export function useComplianceRules(
  params: {
    page?: number;
    pageSize?: number;
    category?: string;
    status?: string;
    order?: "asc" | "desc";
  } = {},
) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery<OffsetPageResponse<ComplianceRuleDto>>({
    queryKey: [...COMPLIANCE_QUERY_KEY, "rules", "list", params] as const,
    queryFn: () => {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("pageSize", String(pageSize));
      if (params.category) sp.set("category", params.category);
      if (params.status) sp.set("status", params.status);
      sp.set("order", params.order ?? "desc");
      return apiGet<OffsetPageResponse<ComplianceRuleDto>>(
        `${ComplianceApiPaths.rules}?${sp.toString()}`,
        {
          validate: {
            schema: offsetPageResponseSchema(complianceRuleDtoSchema),
            context: "useComplianceRules.list",
          },
        },
      );
    },
    placeholderData: (prev) => prev,
  });
}

/**
 * 查询规则详情
 */
export function useComplianceRule(id: string | null | undefined) {
  return useQuery<ComplianceRuleDto>({
    queryKey: [...COMPLIANCE_QUERY_KEY, "rules", "detail", id] as const,
    enabled: typeof id === "string" && id.length > 0,
    queryFn: () =>
      apiGet<ComplianceRuleDto>(ComplianceApiPaths.ruleDetail(id as string), {
        validate: {
          schema: complianceRuleDtoSchema,
          context: "useComplianceRule.detail",
        },
      }),
  });
}

/**
 * 创建规则
 *
 * 契约验证：软验证模式
 *  - 创建响应结构错误不阻断，但会记录日志
 */
export function useCreateComplianceRule() {
  const queryClient = useQueryClient();
  return useMutation<ComplianceRuleDto, Error, CreateRuleRequest>({
    mutationFn: (payload) =>
      apiPost<ComplianceRuleDto>(ComplianceApiPaths.rules, payload, {
        validate: {
          schema: complianceRuleDtoSchema,
          context: "useCreateComplianceRule",
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...COMPLIANCE_QUERY_KEY, "rules", "list"],
      });
    },
  });
}

/**
 * 删除规则
 */
export function useDeleteComplianceRule() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiDelete<void>(ComplianceApiPaths.ruleDetail(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...COMPLIANCE_QUERY_KEY, "rules", "list"],
      });
    },
  });
}

/**
 * 更新规则（局部字段）
 *
 * 契约验证：软验证模式
 *  - 更新响应结构错误不阻断，console.warn 记录便于排查
 */
export function useUpdateComplianceRule() {
  const queryClient = useQueryClient();
  return useMutation<
    ComplianceRuleDto,
    Error,
    { id: string; data: UpdateRuleRequest }
  >({
    mutationFn: ({ id, data }) => {
      // 请求体软验证
      const parsed = updateRuleRequestSchema.safeParse(data);
      if (!parsed.success) {
        console.warn(
          "[useUpdateComplianceRule] 请求体校验失败",
          parsed.error.flatten(),
        );
      }
      return apiPatch<ComplianceRuleDto>(
        ComplianceApiPaths.ruleDetail(id),
        data,
        {
          validate: {
            schema: complianceRuleDtoSchema,
            context: "useUpdateComplianceRule",
          },
        },
      );
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...COMPLIANCE_QUERY_KEY, "rules", "list"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...COMPLIANCE_QUERY_KEY, "rules", "detail", variables.id],
      });
    },
  });
}

// ── 规则修订 ──

/**
 * 列出规则修订
 */
export function useRuleRevisions(
  ruleId: string | null | undefined,
  params: { page?: number; pageSize?: number; order?: "asc" | "desc" } = {},
) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery<OffsetPageResponse<RuleRevisionDto>>({
    queryKey: [
      ...COMPLIANCE_QUERY_KEY,
      "revisions",
      "list",
      ruleId,
      params,
    ] as const,
    enabled: typeof ruleId === "string" && ruleId.length > 0,
    queryFn: () => {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("pageSize", String(pageSize));
      sp.set("order", params.order ?? "desc");
      return apiGet<OffsetPageResponse<RuleRevisionDto>>(
        `${ComplianceApiPaths.ruleRevisions(ruleId as string)}?${sp.toString()}`,
        {
          validate: {
            schema: offsetPageResponseSchema(ruleRevisionDtoSchema),
            context: "useRuleRevisions.list",
          },
        },
      );
    },
  });
}

/**
 * 创建规则修订
 *
 * 契约验证：软验证模式
 */
export function useCreateRuleRevision(ruleId: string) {
  const queryClient = useQueryClient();
  return useMutation<RuleRevisionDto, Error, CreateRuleRevisionRequest>({
    mutationFn: (payload) =>
      apiPost<RuleRevisionDto>(
        ComplianceApiPaths.ruleRevisions(ruleId),
        payload,
        {
          validate: {
            schema: ruleRevisionDtoSchema,
            context: "useCreateRuleRevision",
          },
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...COMPLIANCE_QUERY_KEY, "revisions", "list", ruleId],
      });
    },
  });
}

/**
 * 激活规则修订
 *
 * 契约验证：软验证模式
 */
export function useActivateRuleRevision() {
  const queryClient = useQueryClient();
  return useMutation<RuleRevisionDto, Error, string>({
    mutationFn: (revisionId) =>
      apiPost<RuleRevisionDto>(
        ComplianceApiPaths.activateRevision(revisionId),
        {},
        {
          validate: {
            schema: ruleRevisionDtoSchema,
            context: "useActivateRuleRevision",
          },
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...COMPLIANCE_QUERY_KEY, "revisions"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...COMPLIANCE_QUERY_KEY, "rules", "list"],
      });
    },
  });
}

/**
 * 导入 IDS
 */
export function useImportIds() {
  const queryClient = useQueryClient();
  return useMutation<IdsImportResponse, Error, IdsImportRequest>({
    mutationFn: (payload) =>
      apiPost<IdsImportResponse>(ComplianceApiPaths.importIds, payload, {
        validate: {
          schema: idsImportResponseSchema,
          context: "useImportIds",
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...COMPLIANCE_QUERY_KEY, "rules", "list"],
      });
    },
  });
}

// ── 检查运行 ──

/**
 * 列出检查运行
 */
export function useComplianceCheckRuns(
  params: {
    page?: number;
    pageSize?: number;
    projectId?: string;
    order?: "asc" | "desc";
  } = {},
) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery<OffsetPageResponse<ComplianceCheckRunDto>>({
    queryKey: [...COMPLIANCE_QUERY_KEY, "check-runs", "list", params] as const,
    queryFn: () => {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("pageSize", String(pageSize));
      if (params.projectId) sp.set("projectId", params.projectId);
      sp.set("order", params.order ?? "desc");
      return apiGet<OffsetPageResponse<ComplianceCheckRunDto>>(
        `${ComplianceApiPaths.checkRuns}?${sp.toString()}`,
        {
          validate: {
            schema: offsetPageResponseSchema(complianceCheckRunDtoSchema),
            context: "useComplianceCheckRuns.list",
          },
        },
      );
    },
    placeholderData: (prev) => prev,
  });
}

/**
 * 查询检查运行详情
 */
export function useComplianceCheckRun(id: string | null | undefined) {
  return useQuery<ComplianceCheckRunDto>({
    queryKey: [...COMPLIANCE_QUERY_KEY, "check-runs", "detail", id] as const,
    enabled: typeof id === "string" && id.length > 0,
    queryFn: () =>
      apiGet<ComplianceCheckRunDto>(
        ComplianceApiPaths.checkRunDetail(id as string),
        {
          validate: {
            schema: complianceCheckRunDtoSchema,
            context: "useComplianceCheckRun.detail",
          },
        },
      ),
  });
}

/**
 * 创建检查运行
 *
 * 契约验证：软验证模式
 */
export function useCreateComplianceCheckRun() {
  const queryClient = useQueryClient();
  return useMutation<ComplianceCheckRunDto, Error, CreateCheckRunRequest>({
    mutationFn: (payload) =>
      apiPost<ComplianceCheckRunDto>(ComplianceApiPaths.checkRuns, payload, {
        validate: {
          schema: complianceCheckRunDtoSchema,
          context: "useCreateComplianceCheckRun",
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...COMPLIANCE_QUERY_KEY, "check-runs", "list"],
      });
    },
  });
}

/**
 * 执行检查运行
 *
 * 契约验证：软验证模式
 */
export function useExecuteComplianceCheckRun() {
  const queryClient = useQueryClient();
  return useMutation<ComplianceCheckRunDto, Error, string>({
    mutationFn: (id) =>
      apiPost<ComplianceCheckRunDto>(
        ComplianceApiPaths.executeCheckRun(id),
        {},
        {
          validate: {
            schema: complianceCheckRunDtoSchema,
            context: "useExecuteComplianceCheckRun",
          },
        },
      ),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({
        queryKey: [...COMPLIANCE_QUERY_KEY, "check-runs", "detail", id],
      });
      void queryClient.invalidateQueries({
        queryKey: [...COMPLIANCE_QUERY_KEY, "check-runs", "list"],
      });
    },
  });
}

// ── 检查结果 ──

/**
 * 列出检查结果（按执行 ID）
 */
export function useCheckResults(
  executionId: string | null | undefined,
  params: { page?: number; pageSize?: number; outcome?: string } = {},
) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery<OffsetPageResponse<CheckResultDto>>({
    queryKey: [
      ...COMPLIANCE_QUERY_KEY,
      "results",
      executionId,
      params,
    ] as const,
    enabled: typeof executionId === "string" && executionId.length > 0,
    queryFn: () => {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("pageSize", String(pageSize));
      if (params.outcome) sp.set("outcome", params.outcome);
      return apiGet<OffsetPageResponse<CheckResultDto>>(
        `${ComplianceApiPaths.checkResults(executionId as string)}?${sp.toString()}`,
        {
          validate: {
            schema: offsetPageResponseSchema(checkResultDtoSchema),
            context: "useCheckResults.list",
          },
        },
      );
    },
    placeholderData: (prev) => prev,
  });
}
