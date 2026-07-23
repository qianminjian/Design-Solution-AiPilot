import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Design Platform - Sign In",
  description: "施工图全流程 AI 平台登录",
};

/**
 * 登录页
 * 服务端组件导出 metadata，客户端交互由 LoginForm 承载
 */
export default function LoginPage() {
  return <LoginForm />;
}
