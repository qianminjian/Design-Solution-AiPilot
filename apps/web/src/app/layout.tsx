import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Providers } from "./providers";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "施工图全流程 AI 平台",
  description: "V1 技术试点 — 建筑专业纵向闭环",
};

/**
 * 根布局
 * - html lang="en"：OD-01 境外英文包
 * - AntdRegistry：antd SSR 样式注入兼容
 * - Providers：聚合 TanStack Query + Ant Design ConfigProvider + App
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
