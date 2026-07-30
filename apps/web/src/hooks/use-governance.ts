"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  GovernanceAccessGrant,
  GovernanceAccessGrantActionRequest,
  GovernanceRelease,
  GovernanceReleaseActionRequest,
  GovernanceDataAsset,
  GovernanceDataAssetActionRequest,
  GovernanceAuditLog,
  GovernanceAuditLogQuery,
  GovernanceEvidencePackage,
  GovernanceEvidencePackageActionRequest,
  GovernanceBackupPoint,
  GovernanceBackupCreateRequest,
  GovernanceBackupRestoreRequest,
  GovernanceRestoreDrill,
  GovernanceRestoreDrillCreateRequest,
} from "@design-platform/shared";
import { apiGet, apiPost } from "@/lib/api-client";

/**
 * 治理域 Hooks（D37.17 治理中心）
 *
 * 后端 Java Core Service 通过 BFF GovernanceProxyController 代理暴露。
 *
 * V0 兼容层：
 *  - Java 后端枚举返回大写（如 ACTIVE、PENDING_REVIEW）
 *  - shared zod schema 期望 lowercase（如 active、pending_review）
 *  - hook 层对响应枚举字段做 lowercase 归一化，前端组件无需感知
 *  - 写操作请求体使用 lowercase，由 Java 后端 enum valueOf 自动适配
 */

const GOVERNANCE_QUERY_KEY = ["governance"] as const;

/** 治理域 API 路径 */
const GOV_API_PATHS = {
  accessGrants: "/api/v1/access-grants",
  accessGrant: (id: string) => `/api/v1/access-grants/${id}`,
  accessGrantAction: (id: string) => `/api/v1/access-grants/${id}/actions`,
  releases: "/api/v1/releases",
  release: (id: string) => `/api/v1/releases/${id}`,
  releaseAction: (id: string) => `/api/v1/releases/${id}/actions`,
  dataAssets: "/api/v1/data-assets",
  dataAsset: (id: string) => `/api/v1/data-assets/${id}`,
  dataAssetAction: (id: string) => `/api/v1/data-assets/${id}/actions`,
  auditLogs: "/api/v1/audit-logs",
  auditLog: (id: string) => `/api/v1/audit-logs/${id}`,
  evidencePackages: "/api/v1/evidence-packages",
  evidencePackage: (id: string) => `/api/v1/evidence-packages/${id}`,
  evidencePackageAction: (id: string) =>
    `/api/v1/evidence-packages/${id}/actions`,
  backups: "/api/v1/backups",
  backup: (id: string) => `/api/v1/backups/${id}`,
  backupRestore: (id: string) => `/api/v1/backups/${id}/restore`,
  restoreDrills: "/api/v1/restore-drills",
  restoreDrill: (id: string) => `/api/v1/restore-drills/${id}`,
} as const;

/**
 * 已知的枚举字段名（值需要 lowercase 归一化）
 *
 * 仅对 Java 后端 @Enumerated(EnumType.STRING) 字段做转换，
 * 避免误转用户输入的自由文本（如 resource、reason 等）。
 */
const ENUM_FIELDS = new Set([
  "type",
  "status",
  "riskLevel",
  "result",
  "category",
  "action",
  "target",
  "scope",
  "classification",
  "redteamStatus",
  "metricsDrift",
  "actorType",
]);

/** 列表响应通用结构（与 BFF PageResponse 对齐） */
interface ListResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 递归将对象中枚举字段的字符串值转为 lowercase */
function normalizeEnumFields<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => normalizeEnumFields(item)) as unknown as T;
  }
  if (typeof input === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      input as Record<string, unknown>,
    )) {
      if (
        typeof value === "string" &&
        ENUM_FIELDS.has(key) &&
        // 仅当包含大写字母时才转换，避免重复处理已 lowercase 的值
        /[A-Z]/.test(value)
      ) {
        result[key] = value.toLowerCase();
      } else if (typeof value === "object" && value !== null) {
        result[key] = normalizeEnumFields(value);
      } else {
        result[key] = value;
      }
    }
    return result as unknown as T;
  }
  return input;
}

/** 生成幂等键（UUIDv4，浏览器原生 crypto） */
function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Access Grant（D37.17 Access Review） ──

export interface ListAccessGrantsRequest {
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
  riskLevel?: string;
}

export function useAccessGrants(params: ListAccessGrantsRequest = {}) {
  return useQuery<ListResponse<GovernanceAccessGrant>>({
    queryKey: [
      ...GOVERNANCE_QUERY_KEY,
      "accessGrants",
      "list",
      {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        status: params.status ?? null,
        type: params.type ?? null,
        riskLevel: params.riskLevel ?? null,
      },
    ] as const,
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("page", String(params.page ?? 1));
      search.set("pageSize", String(params.pageSize ?? 20));
      if (params.status) search.set("status", params.status);
      if (params.type) search.set("type", params.type);
      if (params.riskLevel) search.set("riskLevel", params.riskLevel);
      const data = await apiGet<ListResponse<GovernanceAccessGrant>>(
        `${GOV_API_PATHS.accessGrants}?${search.toString()}`,
      );
      return normalizeEnumFields(data);
    },
    placeholderData: (prev) => prev,
  });
}

export function useAccessGrant(id: string | null | undefined) {
  return useQuery<GovernanceAccessGrant>({
    queryKey: [...GOVERNANCE_QUERY_KEY, "accessGrants", "detail", id] as const,
    queryFn: async () => {
      const data = await apiGet<GovernanceAccessGrant>(
        GOV_API_PATHS.accessGrant(id as string),
      );
      return normalizeEnumFields(data);
    },
    enabled: typeof id === "string" && id.length > 0,
  });
}

export function useAccessGrantAction() {
  const queryClient = useQueryClient();
  return useMutation<
    GovernanceAccessGrant,
    Error,
    { id: string; payload: GovernanceAccessGrantActionRequest }
  >({
    mutationFn: async ({ id, payload }) => {
      const data = await apiPost<GovernanceAccessGrant>(
        GOV_API_PATHS.accessGrantAction(id),
        payload,
        {
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        },
      );
      return normalizeEnumFields(data);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: [...GOVERNANCE_QUERY_KEY, "accessGrants", "list"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...GOVERNANCE_QUERY_KEY, "accessGrants", "detail", data.id],
      });
    },
  });
}

// ── Release（D37.17 AI/Rule Release） ──

export interface ListReleasesRequest {
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
}

export function useReleases(params: ListReleasesRequest = {}) {
  return useQuery<ListResponse<GovernanceRelease>>({
    queryKey: [
      ...GOVERNANCE_QUERY_KEY,
      "releases",
      "list",
      {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        status: params.status ?? null,
        type: params.type ?? null,
      },
    ] as const,
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("page", String(params.page ?? 1));
      search.set("pageSize", String(params.pageSize ?? 20));
      if (params.status) search.set("status", params.status);
      if (params.type) search.set("type", params.type);
      const data = await apiGet<ListResponse<GovernanceRelease>>(
        `${GOV_API_PATHS.releases}?${search.toString()}`,
      );
      return normalizeEnumFields(data);
    },
    placeholderData: (prev) => prev,
  });
}

export function useRelease(id: string | null | undefined) {
  return useQuery<GovernanceRelease>({
    queryKey: [...GOVERNANCE_QUERY_KEY, "releases", "detail", id] as const,
    queryFn: async () => {
      const data = await apiGet<GovernanceRelease>(
        GOV_API_PATHS.release(id as string),
      );
      return normalizeEnumFields(data);
    },
    enabled: typeof id === "string" && id.length > 0,
  });
}

export function useReleaseAction() {
  const queryClient = useQueryClient();
  return useMutation<
    GovernanceRelease,
    Error,
    { id: string; payload: GovernanceReleaseActionRequest }
  >({
    mutationFn: async ({ id, payload }) => {
      const data = await apiPost<GovernanceRelease>(
        GOV_API_PATHS.releaseAction(id),
        payload,
        {
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        },
      );
      return normalizeEnumFields(data);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: [...GOVERNANCE_QUERY_KEY, "releases", "list"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...GOVERNANCE_QUERY_KEY, "releases", "detail", data.id],
      });
    },
  });
}

// ── Data Asset（D37.17 Data Governance） ──

export interface ListDataAssetsRequest {
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
  classification?: string;
}

export function useDataAssets(params: ListDataAssetsRequest = {}) {
  return useQuery<ListResponse<GovernanceDataAsset>>({
    queryKey: [
      ...GOVERNANCE_QUERY_KEY,
      "dataAssets",
      "list",
      {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        status: params.status ?? null,
        type: params.type ?? null,
        classification: params.classification ?? null,
      },
    ] as const,
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("page", String(params.page ?? 1));
      search.set("pageSize", String(params.pageSize ?? 20));
      if (params.status) search.set("status", params.status);
      if (params.type) search.set("type", params.type);
      if (params.classification)
        search.set("classification", params.classification);
      const data = await apiGet<ListResponse<GovernanceDataAsset>>(
        `${GOV_API_PATHS.dataAssets}?${search.toString()}`,
      );
      return normalizeEnumFields(data);
    },
    placeholderData: (prev) => prev,
  });
}

export function useDataAsset(id: string | null | undefined) {
  return useQuery<GovernanceDataAsset>({
    queryKey: [...GOVERNANCE_QUERY_KEY, "dataAssets", "detail", id] as const,
    queryFn: async () => {
      const data = await apiGet<GovernanceDataAsset>(
        GOV_API_PATHS.dataAsset(id as string),
      );
      return normalizeEnumFields(data);
    },
    enabled: typeof id === "string" && id.length > 0,
  });
}

export function useDataAssetAction() {
  const queryClient = useQueryClient();
  return useMutation<
    GovernanceDataAsset,
    Error,
    { id: string; payload: GovernanceDataAssetActionRequest }
  >({
    mutationFn: async ({ id, payload }) => {
      const data = await apiPost<GovernanceDataAsset>(
        GOV_API_PATHS.dataAssetAction(id),
        payload,
        {
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        },
      );
      return normalizeEnumFields(data);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: [...GOVERNANCE_QUERY_KEY, "dataAssets", "list"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...GOVERNANCE_QUERY_KEY, "dataAssets", "detail", data.id],
      });
    },
  });
}

// ── Audit Log（D37.17 Audit/Evidence 日志） ──

export function useAuditLogs(
  params: GovernanceAuditLogQuery & {
    page?: number;
    pageSize?: number;
  } = {},
) {
  return useQuery<ListResponse<GovernanceAuditLog>>({
    queryKey: [
      ...GOVERNANCE_QUERY_KEY,
      "auditLogs",
      "list",
      {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        category: params.category ?? null,
        result: params.result ?? null,
        riskLevel: params.riskLevel ?? null,
        actorId: params.actorId ?? null,
        from: params.from ?? null,
        to: params.to ?? null,
        traceId: params.traceId ?? null,
      },
    ] as const,
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("page", String(params.page ?? 1));
      search.set("pageSize", String(params.pageSize ?? 20));
      if (params.category) search.set("category", params.category);
      if (params.result) search.set("result", params.result);
      if (params.riskLevel) search.set("riskLevel", params.riskLevel);
      if (params.actorId) search.set("actorId", params.actorId);
      if (params.from) search.set("from", params.from);
      if (params.to) search.set("to", params.to);
      if (params.traceId) search.set("traceId", params.traceId);
      const data = await apiGet<ListResponse<GovernanceAuditLog>>(
        `${GOV_API_PATHS.auditLogs}?${search.toString()}`,
      );
      return normalizeEnumFields(data);
    },
    placeholderData: (prev) => prev,
  });
}

export function useAuditLog(id: string | null | undefined) {
  return useQuery<GovernanceAuditLog>({
    queryKey: [...GOVERNANCE_QUERY_KEY, "auditLogs", "detail", id] as const,
    queryFn: async () => {
      const data = await apiGet<GovernanceAuditLog>(
        GOV_API_PATHS.auditLog(id as string),
      );
      return normalizeEnumFields(data);
    },
    enabled: typeof id === "string" && id.length > 0,
  });
}

// ── Evidence Package（D37.17 Audit/Evidence 证据包） ──

export interface ListEvidencePackagesRequest {
  page?: number;
  pageSize?: number;
  status?: string;
  objectId?: string;
}

export function useEvidencePackages(params: ListEvidencePackagesRequest = {}) {
  return useQuery<ListResponse<GovernanceEvidencePackage>>({
    queryKey: [
      ...GOVERNANCE_QUERY_KEY,
      "evidencePackages",
      "list",
      {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        status: params.status ?? null,
        objectId: params.objectId ?? null,
      },
    ] as const,
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("page", String(params.page ?? 1));
      search.set("pageSize", String(params.pageSize ?? 20));
      if (params.status) search.set("status", params.status);
      if (params.objectId) search.set("objectId", params.objectId);
      const data = await apiGet<ListResponse<GovernanceEvidencePackage>>(
        `${GOV_API_PATHS.evidencePackages}?${search.toString()}`,
      );
      return normalizeEnumFields(data);
    },
    placeholderData: (prev) => prev,
  });
}

export function useEvidencePackage(id: string | null | undefined) {
  return useQuery<GovernanceEvidencePackage>({
    queryKey: [
      ...GOVERNANCE_QUERY_KEY,
      "evidencePackages",
      "detail",
      id,
    ] as const,
    queryFn: async () => {
      const data = await apiGet<GovernanceEvidencePackage>(
        GOV_API_PATHS.evidencePackage(id as string),
      );
      return normalizeEnumFields(data);
    },
    enabled: typeof id === "string" && id.length > 0,
  });
}

export function useEvidencePackageAction() {
  const queryClient = useQueryClient();
  return useMutation<
    GovernanceEvidencePackage,
    Error,
    { id: string; payload: GovernanceEvidencePackageActionRequest }
  >({
    mutationFn: async ({ id, payload }) => {
      const data = await apiPost<GovernanceEvidencePackage>(
        GOV_API_PATHS.evidencePackageAction(id),
        payload,
        {
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        },
      );
      return normalizeEnumFields(data);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: [...GOVERNANCE_QUERY_KEY, "evidencePackages", "list"],
      });
      void queryClient.invalidateQueries({
        queryKey: [
          ...GOVERNANCE_QUERY_KEY,
          "evidencePackages",
          "detail",
          data.id,
        ],
      });
    },
  });
}

// ── Backup（D37.17 Backup/Restore） ──

export interface ListBackupsRequest {
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
}

export function useBackups(params: ListBackupsRequest = {}) {
  return useQuery<ListResponse<GovernanceBackupPoint>>({
    queryKey: [
      ...GOVERNANCE_QUERY_KEY,
      "backups",
      "list",
      {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        status: params.status ?? null,
        type: params.type ?? null,
      },
    ] as const,
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("page", String(params.page ?? 1));
      search.set("pageSize", String(params.pageSize ?? 20));
      if (params.status) search.set("status", params.status);
      if (params.type) search.set("type", params.type);
      const data = await apiGet<ListResponse<GovernanceBackupPoint>>(
        `${GOV_API_PATHS.backups}?${search.toString()}`,
      );
      return normalizeEnumFields(data);
    },
    placeholderData: (prev) => prev,
  });
}

export function useBackup(id: string | null | undefined) {
  return useQuery<GovernanceBackupPoint>({
    queryKey: [...GOVERNANCE_QUERY_KEY, "backups", "detail", id] as const,
    queryFn: async () => {
      const data = await apiGet<GovernanceBackupPoint>(
        GOV_API_PATHS.backup(id as string),
      );
      return normalizeEnumFields(data);
    },
    enabled: typeof id === "string" && id.length > 0,
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();
  return useMutation<
    GovernanceBackupPoint,
    Error,
    GovernanceBackupCreateRequest
  >({
    mutationFn: async (payload) => {
      const data = await apiPost<GovernanceBackupPoint>(
        GOV_API_PATHS.backups,
        payload,
        {
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        },
      );
      return normalizeEnumFields(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...GOVERNANCE_QUERY_KEY, "backups", "list"],
      });
    },
  });
}

export function useRestoreBackup() {
  const queryClient = useQueryClient();
  return useMutation<
    GovernanceBackupPoint,
    Error,
    { id: string; payload: GovernanceBackupRestoreRequest }
  >({
    mutationFn: async ({ id, payload }) => {
      const data = await apiPost<GovernanceBackupPoint>(
        GOV_API_PATHS.backupRestore(id),
        payload,
        {
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        },
      );
      return normalizeEnumFields(data);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: [...GOVERNANCE_QUERY_KEY, "backups", "list"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...GOVERNANCE_QUERY_KEY, "backups", "detail", data.id],
      });
    },
  });
}

// ── Restore Drill（D37.17 灾备演练） ──

export interface ListRestoreDrillsRequest {
  page?: number;
  pageSize?: number;
  status?: string;
}

export function useRestoreDrills(params: ListRestoreDrillsRequest = {}) {
  return useQuery<ListResponse<GovernanceRestoreDrill>>({
    queryKey: [
      ...GOVERNANCE_QUERY_KEY,
      "restoreDrills",
      "list",
      {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        status: params.status ?? null,
      },
    ] as const,
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("page", String(params.page ?? 1));
      search.set("pageSize", String(params.pageSize ?? 20));
      if (params.status) search.set("status", params.status);
      const data = await apiGet<ListResponse<GovernanceRestoreDrill>>(
        `${GOV_API_PATHS.restoreDrills}?${search.toString()}`,
      );
      return normalizeEnumFields(data);
    },
    placeholderData: (prev) => prev,
  });
}

export function useRestoreDrill(id: string | null | undefined) {
  return useQuery<GovernanceRestoreDrill>({
    queryKey: [...GOVERNANCE_QUERY_KEY, "restoreDrills", "detail", id] as const,
    queryFn: async () => {
      const data = await apiGet<GovernanceRestoreDrill>(
        GOV_API_PATHS.restoreDrill(id as string),
      );
      return normalizeEnumFields(data);
    },
    enabled: typeof id === "string" && id.length > 0,
  });
}

export function useCreateRestoreDrill() {
  const queryClient = useQueryClient();
  return useMutation<
    GovernanceRestoreDrill,
    Error,
    GovernanceRestoreDrillCreateRequest
  >({
    mutationFn: async (payload) => {
      const data = await apiPost<GovernanceRestoreDrill>(
        GOV_API_PATHS.restoreDrills,
        payload,
        {
          headers: { "Idempotency-Key": generateIdempotencyKey() },
        },
      );
      return normalizeEnumFields(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...GOVERNANCE_QUERY_KEY, "restoreDrills", "list"],
      });
    },
  });
}
