"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";

// ── 查询键常量 ──

const REVIEW_QUERY_KEY = ["review"] as const;

// ── 合规检查相关类型 ──

export interface ComplianceCheckResult {
  id: string;
  ruleName: string;
  ruleCode: string;
  applicableObjects: number;
  passCount: number;
  failCount: number;
  naCount: number;
  uncertainCount: number;
  status: "passed" | "failed" | "partial" | "running";
  lastRunAt: string;
}

export interface ComplianceCheckRun {
  id: string;
  projectId: string;
  status: "completed" | "running" | "failed";
  totalRules: number;
  passedRules: number;
  failedRules: number;
  startedAt: string;
  completedAt: string | null;
  results: ComplianceCheckResult[];
}

// ── RAG 问答相关类型 ──

export interface RagSource {
  id: string;
  title: string;
  url: string;
  snippet: string;
}

export interface RagQueryResponse {
  id: string;
  question: string;
  answer: string;
  sources: RagSource[];
  confidence: number;
  isAiAssisted: true;
  requiresHumanReview: boolean;
  latencyMs: number;
}

export interface RagQueryRequest {
  projectId: string;
  question: string;
}

// ── 合规发现相关类型 ──

export type FindingSeverity = "critical" | "high" | "medium" | "low";

export type FindingStatus = "pending" | "approved" | "rejected" | "resolved";

export interface ComplianceFinding {
  id: string;
  reviewId: string;
  projectId: string;
  ruleName: string;
  ruleCode: string;
  objectName: string;
  objectId: string;
  severity: FindingSeverity;
  status: FindingStatus;
  confidence: number;
  description: string;
  codeReference: string;
  suggestedFix: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── 门禁决策概览类型 ──

export interface GateSummary {
  stageName: string;
  stageCode: string;
  gateCode: string;
  gateName: string;
  passRate: number;
  pendingItems: number;
  totalFindings: number;
  criticalFindings: number;
  status: "pass" | "fail" | "pending";
}

// ── BCF 协调问题相关类型 ──

/** BCF 问题状态 */
export type BcfIssueStatus = "open" | "in_progress" | "resolved" | "closed";

/** BCF 问题优先级 */
export type BcfIssuePriority = "critical" | "high" | "medium" | "low";

/** BCF 协调问题 DTO */
export interface BcfIssue {
  id: string;
  projectId: string;
  /** 问题序号（项目内递增） */
  issueIndex: number;
  title: string;
  description: string;
  status: BcfIssueStatus;
  priority: BcfIssuePriority;
  /** 问题类型（如 clash、code_review、design_review） */
  issueType: string;
  /** BCF 视点快照（base64 图片） */
  snapshot: string | null;
  /** 关联构件 GUID 列表 */
  relatedElements: string[];
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** 更新 BCF 问题状态请求 */
export interface UpdateBcfIssueStatusRequest {
  status: BcfIssueStatus;
}

/** 指派 BCF 问题请求 */
export interface AssignBcfIssueRequest {
  assignee: string;
}

// ── API 路径 ──

const ReviewApiPaths = {
  complianceCheck: (projectId: string) =>
    `/api/v1/projects/${projectId}/compliance-check`,
  findings: (projectId: string) => `/api/v1/projects/${projectId}/findings`,
  ragQuery: "/api/v1/capabilities/rag-query",
  gateSummary: (projectId: string) =>
    `/api/v1/projects/${projectId}/review/gate-summary`,
  bcfIssues: (projectId: string) =>
    `/api/v1/projects/${projectId}/coordination/issues`,
  bcfIssue: (issueId: string) =>
    `/api/v1/coordination/issues/${issueId}`,
  bcfIssueStatus: (issueId: string) =>
    `/api/v1/coordination/issues/${issueId}/status`,
  bcfIssueAssign: (issueId: string) =>
    `/api/v1/coordination/issues/${issueId}/assign`,
} as const;

// ── 查询 Hook ──

/**
 * 获取项目合规检查运行结果
 * 对应 GET /api/v1/projects/{projectId}/compliance-check
 */
export function useComplianceCheck(projectId: string | null | undefined) {
  return useQuery<ComplianceCheckRun>({
    queryKey: [...REVIEW_QUERY_KEY, "compliance-check", projectId] as const,
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () =>
      apiGet<ComplianceCheckRun>(
        ReviewApiPaths.complianceCheck(projectId as string),
      ),
  });
}

/**
 * RAG 检索问答
 * 对应 POST /api/v1/capabilities/rag-query
 */
export function useRagQuery() {
  const queryClient = useQueryClient();

  return useMutation<RagQueryResponse, Error, RagQueryRequest>({
    mutationFn: (payload) =>
      apiPost<RagQueryResponse>(ReviewApiPaths.ragQuery, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...REVIEW_QUERY_KEY, "rag"],
      });
    },
  });
}

/**
 * 获取项目合规发现列表
 * 对应 GET /api/v1/projects/{projectId}/findings
 */
export function useFindings(projectId: string | null | undefined) {
  return useQuery<ComplianceFinding[]>({
    queryKey: [...REVIEW_QUERY_KEY, "findings", projectId] as const,
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () =>
      apiGet<ComplianceFinding[]>(ReviewApiPaths.findings(projectId as string)),
  });
}

/**
 * 获取门禁决策概览
 * 对应 GET /api/v1/projects/{projectId}/review/gate-summary
 */
export function useGateSummary(projectId: string | null | undefined) {
  return useQuery<GateSummary>({
    queryKey: [...REVIEW_QUERY_KEY, "gate-summary", projectId] as const,
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () =>
      apiGet<GateSummary>(ReviewApiPaths.gateSummary(projectId as string)),
  });
}

/**
 * 获取项目 BCF 协调问题列表
 * 对应 GET /api/v1/projects/{projectId}/coordination/issues
 */
export function useBcfIssues(projectId: string | null | undefined) {
  return useQuery<BcfIssue[]>({
    queryKey: [...REVIEW_QUERY_KEY, "bcf-issues", projectId] as const,
    enabled: typeof projectId === "string" && projectId.length > 0,
    queryFn: () =>
      apiGet<BcfIssue[]>(
        ReviewApiPaths.bcfIssues(projectId as string),
      ),
  });
}

/**
 * 更新 BCF 问题状态
 * 对应 PATCH /api/v1/coordination/issues/{issueId}/status
 */
export function useUpdateBcfIssueStatus() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { issueId: string; status: BcfIssueStatus }>({
    mutationFn: ({ issueId, status }) =>
      apiPatch<void>(
        ReviewApiPaths.bcfIssueStatus(issueId),
        { status } satisfies UpdateBcfIssueStatusRequest,
      ),
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
    mutationFn: ({ issueId, assignee }) =>
      apiPatch<void>(
        ReviewApiPaths.bcfIssueAssign(issueId),
        { assignee } satisfies AssignBcfIssueRequest,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...REVIEW_QUERY_KEY, "bcf-issues"],
      });
    },
  });
}