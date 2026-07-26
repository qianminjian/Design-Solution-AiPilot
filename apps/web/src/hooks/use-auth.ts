"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  AuthContext,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  ChangePasswordRequest,
} from "@design-platform/shared";
import {
  AuthApiPaths,
  authContextSchema,
  loginResponseSchema,
  logoutResponseSchema,
} from "@design-platform/shared";
import { apiGet, apiPost } from "@/lib/api-client";

/** 当前用户信息查询键 */
const AUTH_ME_QUERY_KEY = ["auth", "me"] as const;

/**
 * 获取当前登录上下文
 * 对应 GET /api/v1/auth/me
 * staleTime 5 分钟：会话信息相对稳定，避免频繁请求
 *
 * 契约验证（security.md §2.2）：严格模式
 *  - 认证响应结构错误将导致前端误判登录状态
 *  - 验证失败抛 ResponseValidationError，React Query 进入 error 分支
 */
export function useAuth() {
  return useQuery<AuthContext>({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: () =>
      apiGet<AuthContext>(AuthApiPaths.me, {
        validate: {
          schema: authContextSchema,
          context: "useAuth.me",
          strict: true,
        },
      }),
    staleTime: 5 * 60 * 1000,
    retry: false, // 401 不重试，避免触发限流
  });
}

/**
 * 登录 mutation
 * 对应 POST /api/v1/auth/login
 * 成功后刷新当前用户信息缓存
 *
 * 契约验证（security.md §2.2）：严格模式
 *  - 登录响应必须包含 principal/accessToken/refreshTokenSet 等必填字段
 *  - 防止 BFF/Core Service 契约漂移导致前端拿到残缺的 token 字段
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: (payload) =>
      apiPost<LoginResponse>(AuthApiPaths.login, payload, {
        validate: {
          schema: loginResponseSchema,
          context: "useAuth.login",
          strict: true,
        },
      }),
    onSuccess: () => {
      // 登录成功后拉取并缓存当前用户上下文
      void queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
    },
  });
}

/**
 * 登出 mutation
 * 对应 POST /api/v1/auth/logout
 * 成功后清除所有缓存（包含用户信息），避免泄露前一会话数据
 *
 * 契约验证：软验证模式
 *  - 登出响应结构错误不阻断登出流程，console.warn 记录便于排查
 *  - 即便 revoked 字段缺失，仍执行本地缓存清理以保证安全
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation<LogoutResponse, Error, void>({
    mutationFn: () =>
      apiPost<LogoutResponse>(AuthApiPaths.logout, undefined, {
        validate: {
          schema: logoutResponseSchema,
          context: "auth.logout",
        },
      }),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

/**
 * 修改密码 mutation
 * 对应 POST /api/v1/auth/change-password
 * 成功后刷新当前用户信息缓存（密码变更可能影响会话）
 */
export function useChangePassword() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ChangePasswordRequest>({
    mutationFn: (payload) =>
      apiPost<void>(AuthApiPaths.changePassword, payload),
    onSuccess: () => {
      // 密码变更后使当前用户上下文失效，下次访问时重新拉取
      void queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
    },
  });
}
