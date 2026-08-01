"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  PrincipalDto,
  OrganizationDto,
  MembershipDto,
  CreatePrincipalRequest,
  UpdatePrincipalRequest,
  CreateOrganizationRequest,
  CreateMembershipRequest,
  OffsetPageResponse,
  UserPreferencesDto,
  UpdateUserPreferencesRequest,
  ApiTokenDto,
  CreateApiTokenRequest,
  CreateApiTokenResponse,
  RevokeApiTokenRequest,
} from "@design-platform/shared";
import {
  IamApiPaths,
  HttpHeader,
  principalDtoSchema,
  organizationDtoSchema,
  membershipDtoSchema,
} from "@design-platform/shared";
import { z } from "zod";
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "@/lib/api-client";

/** IAM 域查询键前缀 */
const IAM_QUERY_KEY = ["iam"] as const;

/** 偏移分页响应 schema 工厂 */
function offsetPageResponseSchema<T>(itemSchema: z.ZodType<T>) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    hasMore: z.boolean(),
  });
}

/** 列表查询参数 */
export interface ListMembershipsRequest {
  page?: number;
  pageSize?: number;
  organizationId?: string;
  principalId?: string;
  role?: string;
  status?: "active" | "suspended" | "expired";
}

/** 列表查询参数 */
export interface ListPrincipalsRequest {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: "active" | "disabled" | "locked" | "pending";
}

/** 生成幂等键（UUIDv4，浏览器原生 crypto） */
function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── 主体（Principal） ──

/**
 * 主体列表查询
 * 对应 GET /api/v1/principals?page=&pageSize=&keyword=&status=
 *
 * 契约验证：软验证模式（高频查询不阻断，仅记录契约漂移）
 */
export function usePrincipals(params: ListPrincipalsRequest = {}) {
  return useQuery<OffsetPageResponse<PrincipalDto>>({
    queryKey: [
      ...IAM_QUERY_KEY,
      "principals",
      "list",
      {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 10,
        keyword: params.keyword ?? "",
        status: params.status ?? null,
      },
    ] as const,
    queryFn: () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(params.page ?? 1));
      searchParams.set("pageSize", String(params.pageSize ?? 10));
      if (params.keyword && params.keyword.trim().length > 0) {
        searchParams.set("keyword", params.keyword.trim());
      }
      if (params.status) {
        searchParams.set("status", params.status);
      }
      return apiGet<OffsetPageResponse<PrincipalDto>>(
        `${IamApiPaths.principals}?${searchParams.toString()}`,
        {
          validate: {
            schema: offsetPageResponseSchema(principalDtoSchema),
            context: "usePrincipals.list",
          },
        },
      );
    },
    placeholderData: (prev) => prev,
  });
}

/**
 * 主体详情查询
 * 对应 GET /api/v1/principals/{id}
 *
 * 契约验证：软验证模式
 */
export function usePrincipal(id: string | null | undefined) {
  return useQuery<PrincipalDto>({
    queryKey: [...IAM_QUERY_KEY, "principals", "detail", id] as const,
    queryFn: () =>
      apiGet<PrincipalDto>(IamApiPaths.principal(id as string), {
        validate: {
          schema: principalDtoSchema,
          context: "usePrincipal.detail",
        },
      }),
    enabled: typeof id === "string" && id.length > 0,
  });
}

/**
 * 创建主体 mutation
 * 对应 POST /api/v1/principals
 * 必须携带 Idempotency-Key 头
 *
 * 契约验证：软验证模式（BFF 已严格验证，前端兜底记录）
 */
export function useCreatePrincipal() {
  const queryClient = useQueryClient();
  return useMutation<PrincipalDto, Error, CreatePrincipalRequest>({
    mutationFn: (payload) =>
      apiPost<PrincipalDto>(IamApiPaths.principals, payload, {
        headers: { [HttpHeader.IDEMPOTENCY_KEY]: generateIdempotencyKey() },
        validate: {
          schema: principalDtoSchema,
          context: "usePrincipal.create",
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...IAM_QUERY_KEY, "principals", "list"],
      });
    },
  });
}

/**
 * 更新主体 mutation
 * 对应 PATCH /api/v1/principals/{id}
 * 必须携带 If-Match 头（ETag 乐观锁）
 */
export function useUpdatePrincipal() {
  const queryClient = useQueryClient();
  return useMutation<
    PrincipalDto,
    Error,
    { id: string; rowVersion: number; payload: UpdatePrincipalRequest }
  >({
    mutationFn: ({ id, rowVersion, payload }) =>
      apiPatch<PrincipalDto>(IamApiPaths.principal(id), payload, {
        headers: { [HttpHeader.IF_MATCH]: `"rev-${rowVersion}"` },
        validate: {
          schema: principalDtoSchema,
          context: "usePrincipal.update",
        },
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: [...IAM_QUERY_KEY, "principals", "list"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...IAM_QUERY_KEY, "principals", "detail", data.id],
      });
    },
  });
}

// ── 组织（Organization） ──

/**
 * 组织列表查询
 * 对应 GET /api/v1/organizations?page=&pageSize=
 */
export function useOrganizations(
  params: { page?: number; pageSize?: number } = {},
) {
  return useQuery<OffsetPageResponse<OrganizationDto>>({
    queryKey: [
      ...IAM_QUERY_KEY,
      "organizations",
      "list",
      {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 50,
      },
    ] as const,
    queryFn: () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(params.page ?? 1));
      searchParams.set("pageSize", String(params.pageSize ?? 50));
      return apiGet<OffsetPageResponse<OrganizationDto>>(
        `${IamApiPaths.organizations}?${searchParams.toString()}`,
        {
          validate: {
            schema: offsetPageResponseSchema(organizationDtoSchema),
            context: "useOrganizations.list",
          },
        },
      );
    },
    placeholderData: (prev) => prev,
  });
}

/**
 * 创建组织 mutation
 * 对应 POST /api/v1/organizations
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation<OrganizationDto, Error, CreateOrganizationRequest>({
    mutationFn: (payload) =>
      apiPost<OrganizationDto>(IamApiPaths.organizations, payload, {
        headers: { [HttpHeader.IDEMPOTENCY_KEY]: generateIdempotencyKey() },
        validate: {
          schema: organizationDtoSchema,
          context: "useOrganizations.create",
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...IAM_QUERY_KEY, "organizations", "list"],
      });
    },
  });
}

// ── 成员关系（Membership） ──

/**
 * 成员关系列表查询
 * 对应 GET /api/v1/memberships?page=&pageSize=&organizationId=&principalId=&role=&status=
 *
 * 契约验证：软验证模式（高频查询不阻断）
 */
export function useMemberships(params: ListMembershipsRequest = {}) {
  return useQuery<OffsetPageResponse<MembershipDto>>({
    queryKey: [
      ...IAM_QUERY_KEY,
      "memberships",
      "list",
      {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 10,
        organizationId: params.organizationId ?? null,
        principalId: params.principalId ?? null,
        role: params.role ?? null,
        status: params.status ?? null,
      },
    ] as const,
    queryFn: () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(params.page ?? 1));
      searchParams.set("pageSize", String(params.pageSize ?? 10));
      if (params.organizationId) {
        searchParams.set("organizationId", params.organizationId);
      }
      if (params.principalId) {
        searchParams.set("principalId", params.principalId);
      }
      if (params.role) {
        searchParams.set("role", params.role);
      }
      if (params.status) {
        searchParams.set("status", params.status);
      }
      return apiGet<OffsetPageResponse<MembershipDto>>(
        `${IamApiPaths.memberships}?${searchParams.toString()}`,
        {
          validate: {
            schema: offsetPageResponseSchema(membershipDtoSchema),
            context: "useMemberships.list",
          },
        },
      );
    },
    placeholderData: (prev) => prev,
  });
}

/**
 * 成员关系详情查询
 * 对应 GET /api/v1/memberships/{id}
 */
export function useMembership(id: string | null | undefined) {
  return useQuery<MembershipDto>({
    queryKey: [...IAM_QUERY_KEY, "memberships", "detail", id] as const,
    queryFn: () =>
      apiGet<MembershipDto>(IamApiPaths.membership(id as string), {
        validate: {
          schema: membershipDtoSchema,
          context: "useMembership.detail",
        },
      }),
    enabled: typeof id === "string" && id.length > 0,
  });
}

/**
 * 创建成员关系 mutation
 * 对应 POST /api/v1/memberships
 */
export function useCreateMembership() {
  const queryClient = useQueryClient();
  return useMutation<MembershipDto, Error, CreateMembershipRequest>({
    mutationFn: (payload) =>
      apiPost<MembershipDto>(IamApiPaths.memberships, payload, {
        headers: { [HttpHeader.IDEMPOTENCY_KEY]: generateIdempotencyKey() },
        validate: {
          schema: membershipDtoSchema,
          context: "useMemberships.create",
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...IAM_QUERY_KEY, "memberships", "list"],
      });
    },
  });
}

/**
 * 更新成员关系 mutation（更新 role / status）
 * 对应 PATCH /api/v1/memberships/{id}
 *
 * 必须携带 If-Match 头（ETag 乐观锁）
 */
export function useUpdateMembership() {
  const queryClient = useQueryClient();
  return useMutation<
    MembershipDto,
    Error,
    {
      id: string;
      rowVersion: number;
      payload: { role?: string; status?: "active" | "suspended" | "expired" };
    }
  >({
    mutationFn: ({ id, rowVersion, payload }) =>
      apiPatch<MembershipDto>(IamApiPaths.membership(id), payload, {
        headers: { [HttpHeader.IF_MATCH]: `"rev-${rowVersion}"` },
        validate: {
          schema: membershipDtoSchema,
          context: "useMemberships.update",
        },
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: [...IAM_QUERY_KEY, "memberships", "list"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...IAM_QUERY_KEY, "memberships", "detail", data.id],
      });
    },
  });
}

/**
 * 删除成员关系 mutation
 * 对应 DELETE /api/v1/memberships/{id}
 */
export function useDeleteMembership() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string; rowVersion: number }>({
    mutationFn: ({ id, rowVersion }) =>
      apiDelete<void>(IamApiPaths.membership(id), {
        headers: { [HttpHeader.IF_MATCH]: `"rev-${rowVersion}"` },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...IAM_QUERY_KEY, "memberships", "list"],
      });
    },
  });
}

// ── 用户偏好设置（V1） ──

const MY_PREFERENCES_QUERY_KEY = ["iam", "my-preferences"] as const;

/**
 * 查询当前用户偏好设置
 * GET /api/v1/users/me/preferences
 * 后端在数据库无记录时返回内存默认值，因此始终返回完整 DTO（不进入 error 状态）
 */
export function useMyPreferences() {
  return useQuery<UserPreferencesDto>({
    queryKey: [...MY_PREFERENCES_QUERY_KEY] as const,
    queryFn: () =>
      apiGet<UserPreferencesDto>(IamApiPaths.myPreferences, {
        // 不强制 schema 校验：后端默认值 DTO 的 id/createdAt/updatedAt 可能为 null
      }),
    staleTime: 60 * 1000, // 60s 内不重复请求
  });
}

/**
 * 更新当前用户偏好设置（upsert 语义：不存在则创建）
 * PUT /api/v1/users/me/preferences
 */
export function useUpdateMyPreferences() {
  const queryClient = useQueryClient();
  return useMutation<UserPreferencesDto, Error, UpdateUserPreferencesRequest>({
    mutationFn: (payload) =>
      apiPut<UserPreferencesDto>(IamApiPaths.myPreferences, payload),
    onSuccess: (data) => {
      // 直接更新缓存，避免再次 GET
      queryClient.setQueryData([...MY_PREFERENCES_QUERY_KEY], data);
    },
    // 失败时不重置缓存，保留上一次成功的偏好数据
  });
}

// ── API Token（V1 IAM Token API） ──

const API_TOKENS_QUERY_KEY = ["iam", "api-tokens"] as const;

/**
 * 查询当前用户的所有 API Token
 * GET /api/v1/iam/tokens
 *
 * 安全约束：响应不包含明文 token（仅 prefix）。
 */
export function useApiTokens() {
  return useQuery<ApiTokenDto[]>({
    queryKey: [...API_TOKENS_QUERY_KEY] as const,
    queryFn: () => apiGet<ApiTokenDto[]>(IamApiPaths.apiTokens),
    staleTime: 30 * 1000, // 30s 内不重复请求
  });
}

/**
 * 创建 API Token
 * POST /api/v1/iam/tokens
 *
 * 返回包含明文 token 的响应（仅本次返回，前端必须立即复制保存）。
 */
export function useCreateApiToken() {
  const queryClient = useQueryClient();
  return useMutation<CreateApiTokenResponse, Error, CreateApiTokenRequest>({
    mutationFn: (payload) =>
      apiPost<CreateApiTokenResponse>(IamApiPaths.apiTokens, payload, {
        headers: { [HttpHeader.IDEMPOTENCY_KEY]: generateIdempotencyKey() },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...API_TOKENS_QUERY_KEY],
      });
    },
  });
}

/**
 * 撤销 API Token（软撤销，不可逆）
 * DELETE /api/v1/iam/tokens/{id}
 *
 * 安全约束：仅能撤销自己的 Token，撤销后状态变为 revoked。
 */
export function useRevokeApiToken() {
  const queryClient = useQueryClient();
  return useMutation<ApiTokenDto, Error, { id: string; reason?: string }>({
    mutationFn: ({ id, reason }) => {
      const body: RevokeApiTokenRequest = reason ? { reason } : {};
      return apiDelete<ApiTokenDto>(IamApiPaths.apiToken(id), { body });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...API_TOKENS_QUERY_KEY],
      });
    },
  });
}
