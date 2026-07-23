import { redirect } from "next/navigation";

/**
 * 根路径首页：重定向到 /dashboard
 * 使用服务端重定向，避免客户端额外渲染
 */
export default function HomePage(): never {
  redirect("/dashboard");
}
