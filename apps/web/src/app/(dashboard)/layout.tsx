import type { ReactNode } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { AuthGuard } from "@/components/auth/auth-guard";

/**
 * Dashboard 路由组布局
 * - AuthGuard：校验会话，未登录跳转 /login
 * - AppLayout：Sider + Header + Content 主框架
 *
 * 路由组括号语法 (dashboard) 不影响 URL 路径
 */
export default function DashboardGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthGuard>
      <AppLayout>{children}</AppLayout>
    </AuthGuard>
  );
}
