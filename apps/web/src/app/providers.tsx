"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, App as AntApp } from "antd";
import enUS from "antd/locale/en_US";
import { createQueryClient } from "@/lib/query-client";

/**
 * 全局 Provider 聚合
 * - QueryClientProvider：TanStack Query 服务端状态管理
 * - ConfigProvider：Ant Design 主题（主色 #1677ff）+ 英文 locale（OD-01 境外英文包）
 * - AntApp：提供 message/modal/notification 静态方法，子组件可通过 App.useApp() 获取
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // useState 初始化保证 QueryClient 在客户端只创建一次，避免 hydration 不一致
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={enUS}
        theme={{
          token: {
            colorPrimary: "#1677ff",
            borderRadius: 6,
          },
        }}
      >
        <AntApp>{children}</AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
