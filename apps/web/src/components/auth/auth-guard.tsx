"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Spin } from "antd";
import { useAuth } from "@/hooks/use-auth";

/**
 * 路由守卫
 * - 调用 useAuth() 校验当前会话
 * - 未登录时跳转 /login
 * - loading 时显示全屏 Spin
 *
 * 用于包裹 dashboard 路由组，确保所有受保护页面在渲染前完成会话校验
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data, isLoading, isError } = useAuth();

  useEffect(() => {
    // 拉取失败（401 等）视为未登录，跳转登录页
    if (isError) {
      router.replace("/login");
      return;
    }
    // 拉取成功但缺少 principal，会话无效
    if (!isLoading && !data?.principal) {
      router.replace("/login");
    }
  }, [isLoading, isError, data, router]);

  // loading 期间渲染全屏 Spin，避免子组件以未登录态渲染后又被重定向
  if (isLoading || !data?.principal) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return <>{children}</>;
}
