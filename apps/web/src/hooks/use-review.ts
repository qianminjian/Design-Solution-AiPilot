"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ComplianceFinding,
  GateSummary,
  BcfIssue,
  BcfIssueStatus,
  BcfIssuePriority,
  FindingSeverity,
  FindingStatus,
  ComplianceCheckRun,
  ComplianceCheckResult,
  UpdateBcfIssueStatusRequest,
  AssignBcfIssueRequest,
} from "@design-platform/shared";
import {
  complianceFindingSchema,
  gateSummarySchema,
  bcfIssueSchema,
  updateBcfIssueStatusRequestSchema,
  assignBcfIssueRequestSchema,
  complianceCheckRunViewSchema,
} from "@design-platform/shared";
import { z } from "zod";
import { apiGet, apiPatch } from "@/lib/api-client";

// ── 查询键常量 ──

const REVIEW_QUERY_KEY = ["review"] as const;

// ── 类型再导出（向后兼容组件层导入） ──

export type {
  ComplianceFinding,
  GateSummary,
  BcfIssue,
  BcfIssueStatus,
  BcfIssuePriority,
  FindingSeverity,
  FindingStatus,
  ComplianceCheckRun,
  ComplianceCheckResult,
  UpdateBcfIssueStatusRequest,
  AssignBcfIssueRequest,
};

// ── API 路径 ──

const ReviewApiPaths = {
  complianceCheck: (projectId: string) =>
    `/api/v1/projects/${projectId}/compliance-check`,
  findings: (projectId: string) => `/api/v1/projects/${projectId}/findings`,
  gateSummary: (projectId: string) =>
    `/api/v1/projects/${projectId}/review/gate-summary`,
  bcfIssues: (projectId: string) =>
    `/api/v1/projects/${projectId}/coordination/issues`,
  bcfIssue: (issueId: string) => `/api/v1/coordination/issues/${issueId}`,
  bcfIssueStatus: (issueId: string) =>
    `/api/v1/coordination/issues/${issueId}/status`,
  bcfIssueAssign: (issueId: string) =>
    `/api/v1/coordination/issues/${issueId}/assign`,
} as const;

// ── 查询 Hook ──

/**
 * 获取项目合规检查运行结果
 * 对应 GET /api/v1/projects/{projectId}/compliance-check
 *
 * 契约验证：软验证模式
 *  - 详情数据结构错误不阻断展示，console.warn 记录便于排查
 */
export function useComplianceCheck(projectId: string | null | undefined) {
  return useQuery<ComplianceCheckRun>({
    queryKey: [...REVIEW_QUERY_KEY, "compliance-check", projectId] as const,
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () =>
      apiGet<ComplianceCheckRun>(
        ReviewApiPaths.complianceCheck(projectId as string),
        {
          validate: {
            schema: complianceCheckRunViewSchema,
            context: "useReview.complianceCheck",
          },
        },
      ),
  });
}

/**
 * 获取项目合规发现列表
 * 对应 GET /api/v1/projects/{projectId}/findings
 *
 * 契约验证：软验证模式
 */
export function useFindings(projectId: string | null | undefined) {
  return useQuery<ComplianceFinding[]>({
    queryKey: [...REVIEW_QUERY_KEY, "findings", projectId] as const,
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () =>
      apiGet<ComplianceFinding[]>(
        ReviewApiPaths.findings(projectId as string),
        {
          validate: {
            schema: z.array(complianceFindingSchema),
            context: "useReview.findings",
          },
        },
      ),
  });
}

/**
 * 获取门禁决策概览
 * 对应 GET /api/v1/projects/{projectId}/review/gate-summary
 *
 * 契约验证：软验证模式
 */
export function useGateSummary(projectId: string | null | undefined) {
  return useQuery<GateSummary>({
    queryKey: [...REVIEW_QUERY_KEY, "gate-summary", projectId] as const,
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () =>
      apiGet<GateSummary>(ReviewApiPaths.gateSummary(projectId as string), {
        validate: {
          schema: gateSummarySchema,
          context: "useReview.gateSummary",
        },
      }),
  });
}

/**
 * 获取项目 BCF 协调问题列表
 * 对应 GET /api/v1/projects/{projectId}/coordination/issues
 *
 * 契约验证：软验证模式
 */
export function useBcfIssues(projectId: string | null | undefined) {
  return useQuery<BcfIssue[]>({
    queryKey: [...REVIEW_QUERY_KEY, "bcf-issues", projectId] as const,
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () =>
      apiGet<BcfIssue[]>(ReviewApiPaths.bcfIssues(projectId as string), {
        validate: {
          schema: z.array(bcfIssueSchema),
          context: "useReview.bcfIssues",
        },
      }),
  });
}

/**
 * 更新 BCF 问题状态
 * 对应 PATCH /api/v1/coordination/issues/{issueId}/status
 */
export function useUpdateBcfIssueStatus() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { issueId: string; status: BcfIssueStatus }>({
    mutationFn: ({ issueId, status }) => {
      const body: UpdateBcfIssueStatusRequest = { status };
      // 请求体软验证
      const parsed = updateBcfIssueStatusRequestSchema.safeParse(body);
      if (!parsed.success) {
        console.warn(
          "[useReview.updateBcfIssueStatus] 请求体校验失败",
          parsed.error.flatten(),
        );
      }
      return apiPatch<void>(ReviewApiPaths.bcfIssueStatus(issueId), body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...REVIEW_QUERY_KEY, "bcf-issues"],
      });
    },
  });
}

/**
 * 指派 BCF 问题
 * 对应 PATCH /api/v1/coordination/issues/{issueId}/assign
 */
export function useAssignBcfIssue() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { issueId: string; assignee: string }>({
    mutationFn: ({ issueId, assignee }) => {
      const body: AssignBcfIssueRequest = { assignee };
      // 请求体软验证
      const parsed = assignBcfIssueRequestSchema.safeParse(body);
      if (!parsed.success) {
        console.warn(
          "[useReview.assignBcfIssue] 请求体校验失败",
          parsed.error.flatten(),
        );
      }
      return apiPatch<void>(ReviewApiPaths.bcfIssueAssign(issueId), body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...REVIEW_QUERY_KEY, "bcf-issues"],
      });
    },
  });
}
