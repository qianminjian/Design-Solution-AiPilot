"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  AuthContext,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  ChangePasswordRequest,
} from "@design-platform/shared";
import { AuthApiPaths } from "@design-platform/shared";
import { apiGet, apiPost } from "@/lib/api-client";

/** 当前用户信息查询键 */
const AUTH_ME_QUERY_KEY = ["auth", "me"] as const;

/**
 * 获取当前登录上下文
 * 对应 GET /api/v1/auth/me
 * staleTime 5 分钟：会话信息相对稳定，避免频繁请求
 */
export function useAuth() {
  return useQuery<AuthContext>({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: () => apiGet<AuthContext>(AuthApiPaths.me),
    staleTime: 5 * 60 * 1000,
    retry: false, // 401 不重试，避免触发限流
  });
}

/**
 * 登录 mutation
 * 对应 POST /api/v1/auth/login
 * 成功后刷新当前用户信息缓存
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: (payload) =>
      apiPost<LoginResponse>(AuthApiPaths.login, payload),
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
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation<LogoutResponse, Error, void>({
    mutationFn: () => apiPost<LogoutResponse>(AuthApiPaths.logout),
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
